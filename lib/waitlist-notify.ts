export async function notifyWaitlistJoin(email: string): Promise<void> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.WAITLIST_NOTIFY_EMAIL;

  if (!apiKey || !from || !to) return;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'New Rhyme Game waitlist signup',
        text: `${email} joined the waitlist at ${new Date().toISOString()}.`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      console.warn(`[waitlist-notify] Resend returned ${res.status}: ${detail}`);
    }
  } catch (err) {
    console.warn('[waitlist-notify] failed to send notify email:', err);
  }
}
