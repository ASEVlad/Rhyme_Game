import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { signCookie, verifyCookie } from './auth';

const SECRET = 'test-secret-key-do-not-use-in-prod';

function b64urlNode(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('auth', () => {
  it('roundtrips a fresh cookie', async () => {
    const cookie = await signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = await verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects an expired cookie', async () => {
    const cookie = await signCookie({ exp: Date.now() - 1000 }, SECRET);
    const result = await verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('expired');
  });

  it('rejects a cookie signed with a different secret', async () => {
    const cookie = await signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = await verifyCookie(cookie, 'other-secret');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered cookie', async () => {
    const cookie = await signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    const result = await verifyCookie(tampered, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a malformed cookie', async () => {
    expect((await verifyCookie('garbage', SECRET)).valid).toBe(false);
    expect((await verifyCookie('', SECRET)).valid).toBe(false);
  });

  it('reports malformed for non-cookie input', async () => {
    expect(await verifyCookie('garbage', SECRET)).toEqual({ valid: false, reason: 'malformed' });
    expect(await verifyCookie('a.b.c', SECRET)).toEqual({ valid: false, reason: 'malformed' });
  });

  it('reports bad_signature for a tampered signature', async () => {
    const cookie = await signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    const result = await verifyCookie(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('bad_signature');
  });

  it('reports malformed when payload is valid JSON but wrong shape', async () => {
    // craft a cookie whose payload decodes to a JSON number (not an object)
    const payloadStr = b64urlNode(Buffer.from('5'));
    const sig = b64urlNode(createHmac('sha256', SECRET).update(payloadStr).digest());
    const cookie = `${payloadStr}.${sig}`;
    const result = await verifyCookie(cookie, SECRET);
    expect(result).toEqual({ valid: false, reason: 'malformed' });
  });
});
