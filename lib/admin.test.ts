import { describe, it, expect, afterEach } from 'vitest';
import { isAdmin } from './admin';

const ORIGINAL = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe('isAdmin', () => {
  it('returns true for an email in the comma-separated list', () => {
    process.env.ADMIN_EMAILS = 'a@x.com,b@y.com';
    expect(isAdmin('b@y.com')).toBe(true);
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    process.env.ADMIN_EMAILS = '  Admin@Example.com , other@x.com ';
    expect(isAdmin('admin@example.com')).toBe(true);
  });

  it('returns false for an email not in the list', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdmin('intruder@x.com')).toBe(false);
  });

  it('returns false when ADMIN_EMAILS is empty or unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin('a@x.com')).toBe(false);
    process.env.ADMIN_EMAILS = '';
    expect(isAdmin('a@x.com')).toBe(false);
  });

  it('returns false for null / undefined / empty email', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin('')).toBe(false);
  });
});
