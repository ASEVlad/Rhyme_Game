// tests/decide-signin.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { isEmailAccepted, upsertWaitlist, isInviteCookieValid, notifyWaitlistJoin } = vi.hoisted(() => ({
  isEmailAccepted: vi.fn(),
  upsertWaitlist: vi.fn(),
  isInviteCookieValid: vi.fn(),
  notifyWaitlistJoin: vi.fn(),
}));
vi.mock('@/lib/accepted-emails', () => ({ isEmailAccepted, upsertWaitlist }));
vi.mock('@/lib/invite', () => ({ isInviteCookieValid }));
vi.mock('@/lib/waitlist-notify', () => ({ notifyWaitlistJoin }));

import { decideSignIn } from '@/lib/decide-signin';

beforeEach(() => {
  isEmailAccepted.mockReset();
  upsertWaitlist.mockReset().mockResolvedValue(false);
  isInviteCookieValid.mockReset().mockReturnValue(false);
  notifyWaitlistJoin.mockReset();
  vi.stubEnv('REGISTRATION_OPEN', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

it('accepts everyone and skips the gate checks when REGISTRATION_OPEN=true', async () => {
  vi.stubEnv('REGISTRATION_OPEN', 'true');
  expect(await decideSignIn('open@b.com')).toBe(true);
  expect(upsertWaitlist).toHaveBeenCalledWith('open@b.com', true);
  expect(isInviteCookieValid).not.toHaveBeenCalled();
  expect(isEmailAccepted).not.toHaveBeenCalled();
});

it('accepts when the invite cookie is valid (flag off)', async () => {
  isInviteCookieValid.mockReturnValue(true);
  expect(await decideSignIn('invited@b.com')).toBe(true);
  expect(upsertWaitlist).toHaveBeenCalledWith('invited@b.com', true);
});

it('accepts an already-accepted email (flag off)', async () => {
  isEmailAccepted.mockResolvedValue(true);
  expect(await decideSignIn('member@b.com')).toBe(true);
});

it('waitlists and rejects an unknown email (flag off)', async () => {
  isEmailAccepted.mockResolvedValue(false);
  expect(await decideSignIn('stranger@b.com')).toBe(false);
  expect(upsertWaitlist).toHaveBeenCalledWith('stranger@b.com', false);
});
