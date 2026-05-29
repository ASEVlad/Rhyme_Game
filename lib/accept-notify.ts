export async function sendAcceptedEmail(email: string): Promise<boolean> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rhymefor.fun';
  if (!apiKey || !from) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "You're in — start rhyming",
        text: `You're off the Rhyme Game waitlist! Sign in here: ${siteUrl}/login`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      console.warn(`[accept-notify] Resend returned ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[accept-notify] failed to send acceptance email:', err);
    return false;
  }
}
