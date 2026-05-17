import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { decideInvite, isInviteCookieValid } from './invite';

const mockCookies = cookies as unknown as ReturnType<typeof vi.fn>;

describe('decideInvite', () => {
  it('passes through when envCode is undefined (gate disabled)', () => {
    expect(decideInvite({ envCode: undefined })).toEqual({ kind: 'pass' });
  });

  it('passes through when envCode is empty string (gate disabled)', () => {
    expect(decideInvite({ envCode: '' })).toEqual({ kind: 'pass' });
  });

  it('returns set when queryCode matches envCode', () => {
    expect(decideInvite({ envCode: 'secret', queryCode: 'secret' })).toEqual({
      kind: 'set',
      code: 'secret',
    });
  });

  it('passes through when no query is provided', () => {
    expect(decideInvite({ envCode: 'secret' })).toEqual({ kind: 'pass' });
  });

  it('passes through when queryCode does not match', () => {
    expect(decideInvite({ envCode: 'secret', queryCode: 'wrong' })).toEqual({
      kind: 'pass',
    });
  });
});

describe('isInviteCookieValid', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    vi.unstubAllEnvs();
  });

  it('returns false when INVITE_CODE is unset (without reading cookies)', () => {
    vi.stubEnv('INVITE_CODE', '');
    expect(isInviteCookieValid()).toBe(false);
    expect(mockCookies).not.toHaveBeenCalled();
  });

  it('returns true when the cookie value equals INVITE_CODE', () => {
    vi.stubEnv('INVITE_CODE', 'expected-code');
    mockCookies.mockReturnValue({
      get: (name: string) =>
        name === 'rhyme-invite' ? { value: 'expected-code' } : undefined,
    });
    expect(isInviteCookieValid()).toBe(true);
  });

  it('returns false when the cookie value does not match', () => {
    vi.stubEnv('INVITE_CODE', 'expected-code');
    mockCookies.mockReturnValue({
      get: () => ({ value: 'wrong' }),
    });
    expect(isInviteCookieValid()).toBe(false);
  });

  it('returns false when the cookie is absent', () => {
    vi.stubEnv('INVITE_CODE', 'expected-code');
    mockCookies.mockReturnValue({
      get: () => undefined,
    });
    expect(isInviteCookieValid()).toBe(false);
  });

  it('returns false when cookies() throws (outside request scope)', () => {
    vi.stubEnv('INVITE_CODE', 'expected-code');
    mockCookies.mockImplementation(() => {
      throw new Error('called outside request scope');
    });
    expect(isInviteCookieValid()).toBe(false);
  });
});
