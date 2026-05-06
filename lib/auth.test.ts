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
});
