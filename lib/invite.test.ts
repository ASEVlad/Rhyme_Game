import { describe, it, expect } from 'vitest';
import { decideInvite } from './invite';

describe('decideInvite', () => {
  it('passes through when envCode is undefined (gate disabled)', () => {
    expect(decideInvite({ envCode: undefined })).toEqual({ kind: 'pass' });
  });

  it('passes through when envCode is empty string (gate disabled)', () => {
    expect(decideInvite({ envCode: '' })).toEqual({ kind: 'pass' });
  });

  it('returns set when queryCode matches envCode', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'secret' })
    ).toEqual({ kind: 'set', code: 'secret' });
  });

  it('passes through when cookieCode matches envCode', () => {
    expect(
      decideInvite({ envCode: 'secret', cookieCode: 'secret' })
    ).toEqual({ kind: 'pass' });
  });

  it('returns closed when no code is provided', () => {
    expect(decideInvite({ envCode: 'secret' })).toEqual({ kind: 'closed' });
  });

  it('returns closed when queryCode does not match', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'wrong' })
    ).toEqual({ kind: 'closed' });
  });

  it('returns closed when cookieCode is stale and no query is present', () => {
    expect(
      decideInvite({ envCode: 'secret', cookieCode: 'old' })
    ).toEqual({ kind: 'closed' });
  });

  it('prefers a matching queryCode over an existing matching cookie (re-sets the cookie)', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'secret', cookieCode: 'secret' })
    ).toEqual({ kind: 'set', code: 'secret' });
  });

  it('passes through when query is wrong but cookie is valid', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'wrong', cookieCode: 'secret' })
    ).toEqual({ kind: 'pass' });
  });
});
