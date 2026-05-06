import { describe, it, expect } from 'vitest';
import { signCookie, verifyCookie } from './auth';

const SECRET = 'test-secret-key-do-not-use-in-prod';

describe('auth', () => {
  it('roundtrips a fresh cookie', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects an expired cookie', () => {
    const cookie = signCookie({ exp: Date.now() - 1000 }, SECRET);
    const result = verifyCookie(cookie, SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('expired');
  });

  it('rejects a cookie signed with a different secret', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const result = verifyCookie(cookie, 'other-secret');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('bad_signature');
  });

  it('rejects a tampered cookie', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    const result = verifyCookie(tampered, SECRET);
    expect(result.valid).toBe(false);
  });

  it('rejects a malformed cookie', () => {
    expect(verifyCookie('garbage', SECRET).valid).toBe(false);
    expect(verifyCookie('', SECRET).valid).toBe(false);
  });

  it('reports malformed for non-cookie input', () => {
    expect(verifyCookie('garbage', SECRET)).toEqual({ valid: false, reason: 'malformed' });
    expect(verifyCookie('a.b.c', SECRET)).toEqual({ valid: false, reason: 'malformed' });
  });

  it('reports bad_signature for a tampered signature', () => {
    const cookie = signCookie({ exp: Date.now() + 60_000 }, SECRET);
    const tampered = cookie.slice(0, -2) + 'XX';
    const result = verifyCookie(tampered, SECRET);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('bad_signature');
  });

  it('reports malformed when payload is valid JSON but wrong shape', async () => {
    // craft a cookie whose payload decodes to a JSON number (not an object)
    const { createHmac } = await import('crypto');
    const payloadStr = Buffer.from('5').toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const sig = createHmac('sha256', SECRET).update(payloadStr).digest('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const cookie = `${payloadStr}.${sig}`;
    const result = verifyCookie(cookie, SECRET);
    expect(result).toEqual({ valid: false, reason: 'malformed' });
  });
});
