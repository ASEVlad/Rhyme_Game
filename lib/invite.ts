import { cookies } from 'next/headers';

export type InviteDecision =
  | { kind: 'pass' }
  | { kind: 'set'; code: string };

export interface InviteInput {
  envCode: string | undefined;
  queryCode?: string;
}

export function decideInvite({ envCode, queryCode }: InviteInput): InviteDecision {
  if (envCode && queryCode === envCode) {
    return { kind: 'set', code: envCode };
  }
  return { kind: 'pass' };
}

export function isInviteCookieValid(): boolean {
  const env = process.env.INVITE_CODE;
  if (!env) return false;
  try {
    const cookie = cookies().get('rhyme-invite')?.value;
    return cookie === env;
  } catch {
    return false;
  }
}
