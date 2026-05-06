export type CookiePayload = { exp: number /* ms-since-epoch */ };

export type VerifyResult =
  | { valid: true; payload: CookiePayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' };

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const std = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return new Uint8Array(sig);
}

export function constantTimeEq(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const ab = typeof a === 'string' ? enc.encode(a) : a;
  const bb = typeof b === 'string' ? enc.encode(b) : b;
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function signCookie(payload: CookiePayload, secret: string): Promise<string> {
  const payloadStr = b64url(enc.encode(JSON.stringify(payload)));
  const sigBytes = await hmac(payloadStr, secret);
  const sig = b64url(sigBytes);
  return `${payloadStr}.${sig}`;
}

export async function verifyCookie(cookie: string, secret: string): Promise<VerifyResult> {
  if (!cookie || typeof cookie !== 'string') return { valid: false, reason: 'malformed' };
  const parts = cookie.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadStr, sigStr] = parts;
  const expectedSig = await hmac(payloadStr, secret);
  let providedSig: Uint8Array;
  try {
    providedSig = fromB64url(sigStr);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!constantTimeEq(providedSig, expectedSig)) {
    return { valid: false, reason: 'bad_signature' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(fromB64url(payloadStr)));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!parsed || typeof parsed !== 'object' || typeof (parsed as { exp?: unknown }).exp !== 'number') {
    return { valid: false, reason: 'malformed' };
  }
  const payload = parsed as CookiePayload;
  if (payload.exp < Date.now()) return { valid: false, reason: 'expired' };
  return { valid: true, payload };
}

export const COOKIE_NAME = 'rg_auth';
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
