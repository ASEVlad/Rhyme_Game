import { createHmac, timingSafeEqual } from 'crypto';

export type CookiePayload = { exp: number };

export type VerifyResult =
  | { valid: true; payload: CookiePayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' };

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

export function signCookie(payload: CookiePayload, secret: string): string {
  const payloadStr = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(hmac(payloadStr, secret));
  return `${payloadStr}.${sig}`;
}

export function verifyCookie(cookie: string, secret: string): VerifyResult {
  if (!cookie || typeof cookie !== 'string') return { valid: false, reason: 'malformed' };
  const parts = cookie.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };
  const [payloadStr, sigStr] = parts;
  const expectedSig = hmac(payloadStr, secret);
  let providedSig: Buffer;
  try {
    providedSig = fromB64url(sigStr);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (providedSig.length !== expectedSig.length) return { valid: false, reason: 'bad_signature' };
  if (!timingSafeEqual(providedSig, expectedSig)) return { valid: false, reason: 'bad_signature' };
  let payload: CookiePayload;
  try {
    payload = JSON.parse(fromB64url(payloadStr).toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, payload };
}

export const COOKIE_NAME = 'rg_auth';
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
