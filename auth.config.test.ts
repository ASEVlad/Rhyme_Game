import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isEmailAllowed } from './auth.config';

describe('isEmailAllowed', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('returns true for an email on the allowlist', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com,bob@example.com');
    expect(isEmailAllowed('alice@example.com')).toBe(true);
  });

  it('returns false for an email not on the list', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed('eve@example.com')).toBe(false);
  });

  it('trims whitespace around emails in the list', () => {
    vi.stubEnv('ALLOWED_EMAILS', ' alice@example.com , bob@example.com ');
    expect(isEmailAllowed('alice@example.com')).toBe(true);
  });

  it('returns false when ALLOWED_EMAILS is empty', () => {
    vi.stubEnv('ALLOWED_EMAILS', '');
    expect(isEmailAllowed('alice@example.com')).toBe(false);
  });

  it('returns false for null email', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed(null)).toBe(false);
  });

  it('returns false for undefined email', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed(undefined)).toBe(false);
  });
});
