export type InviteDecision =
  | { kind: 'pass' }
  | { kind: 'set'; code: string }
  | { kind: 'closed' };

export interface InviteInput {
  envCode: string | undefined;
  queryCode?: string;
  cookieCode?: string;
}

export function decideInvite({
  envCode,
  queryCode,
  cookieCode,
}: InviteInput): InviteDecision {
  if (!envCode) return { kind: 'pass' };
  if (queryCode === envCode) return { kind: 'set', code: envCode };
  if (cookieCode === envCode) return { kind: 'pass' };
  return { kind: 'closed' };
}
