const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export type GeminiTool = {
  name: string;
  description: string;
  /** JSON Schema for the tool arguments. */
  parameters: Record<string, unknown>;
};

export type GeminiToolCall = {
  prompt: string;
  tool: GeminiTool;
  temperature?: number;
  /** Models to try in order; later entries are fallbacks. Defaults to Flash. */
  models?: string[];
  maxTokens?: number;
};

/** All GEMINI_API_KEY / GEMINI_API_KEY1… values present in the environment. */
export function getGeminiKeys(): string[] {
  return Object.keys(process.env)
    .filter((k) => /^GEMINI_API_KEY\d*$/.test(k))
    .sort()
    .map((k) => process.env[k])
    .filter((v): v is string => !!v && v.trim().length > 0);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Round-robin starting key so load spreads across keys/requests.
let cursor = 0;

function parseToolArgs(text: string): Record<string, unknown> | null {
  let data: any;
  try { data = JSON.parse(text); } catch { return null; }
  const message = data?.choices?.[0]?.message;
  let raw: string | undefined = message?.tool_calls?.[0]?.function?.arguments;
  if (!raw && typeof message?.content === 'string') {
    const m = message.content.match(/\{[\s\S]*\}/);
    raw = m ? m[0] : undefined;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Call Gemini (OpenAI-compatible endpoint) forcing a single function/tool call
 * and return its parsed arguments object, or null if every model/key fails.
 *
 * Resilience: rotates across all keys, retries transient 429/503 once per key,
 * skips dead keys (403), and falls through `models` in order.
 */
export async function callGeminiTool(
  call: GeminiToolCall,
  keys: string[] = getGeminiKeys(),
): Promise<Record<string, unknown> | null> {
  if (!keys.length) return null;
  const models = call.models?.length ? call.models : ['gemini-2.5-flash'];
  const start = cursor++ % keys.length;

  for (const model of models) {
    const body = JSON.stringify({
      model,
      ...(call.temperature !== undefined && { temperature: call.temperature }),
      ...(call.maxTokens !== undefined && { max_tokens: call.maxTokens }),
      tools: [{ type: 'function', function: call.tool }],
      tool_choice: { type: 'function', function: { name: call.tool.name } },
      messages: [{ role: 'user', content: call.prompt }],
    });

    for (let i = 0; i < keys.length; i++) {
      const apiKey = keys[(start + i) % keys.length];
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
          res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body,
          });
        } catch {
          break; // network error — try next key
        }
        if (res.ok) {
          const args = parseToolArgs(await res.text());
          if (args) return args;
          break; // parsed nothing useful — try next key
        }
        if (res.status === 429 || res.status === 503) {
          await sleep(700);
          continue; // transient — retry same key once, then next key
        }
        break; // 400/403/etc — key/model unusable, try next key
      }
    }
    // model exhausted across all keys — fall through to next model
  }
  return null;
}
