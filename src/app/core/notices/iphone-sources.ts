/**
 * What an iPhone's Shortcuts automations handed the app, said per sender or
 * card: the iPhone's "Tus bancos" on Notificaciones del teléfono
 * (`features/notifications/iphone-banks.component.ts`). Pure, so it is tested
 * (`iphone-steps.test.mjs`).
 */

import { SEVERAL_ACCOUNTS, noticeSource } from './notice-proposals';

/** The two doors an iPhone has into Por revisar. */
export type Door = 'sms' | 'pay';

/** The package each door's messages are kept under (`MessageInbox.swift`). */
export const PACKAGE: Record<Door, string> = { sms: 'sms', pay: 'applepay' };

/**
 * One sender or card that a Shortcuts automation has handed messages from:
 * Android's "Tus bancos" row, on an iPhone. Its key is the source Por
 * revisar learns by (`noticeSource`: "sms|899999", "applepay|Visa 1234").
 */
export interface IphoneSource {
  key: string;
  door: Door;
  name: string;
  count: number;
  last: number;
  /** The account the person said, or else the one its saved messages went to. */
  accountId: number | null;
  /** "Varias cuentas": each message that does not say its bank is asked. */
  several: boolean;
}

/**
 * The senders and cards on record, newest first, each with the account the
 * person said ("¿De qué cuenta es?") or else the one its saved messages went
 * to (`noticeAnswers`, newest first). Pure, so it is tested.
 */
export function sourcesOf(
  caught: readonly { package: string; sender?: string; postedAt: number }[],
  said: ReadonlyMap<string, number>,
  answers: readonly { package: string; account_id: number }[],
  accounts: ReadonlySet<number>,
): IphoneSource[] {
  const found = new Map<string, IphoneSource>();
  for (const one of caught) {
    const door: Door | null = one.package === PACKAGE.sms ? 'sms' : one.package === PACKAGE.pay ? 'pay' : null;
    if (!door) continue;
    const key = noticeSource(one);
    const known = found.get(key);
    if (known) {
      known.count++;
      known.last = Math.max(known.last, one.postedAt);
      continue;
    }
    const chosen = said.get(key);
    const learned = answers.find(answer => answer.package === key && accounts.has(answer.account_id))?.account_id ?? null;
    const accountId = chosen !== undefined && chosen !== SEVERAL_ACCOUNTS && accounts.has(chosen) ? chosen
      : chosen === SEVERAL_ACCOUNTS ? null : learned;
    found.set(key, {
      key, door, name: one.sender?.trim() || '', count: 1, last: one.postedAt,
      accountId, several: chosen === SEVERAL_ACCOUNTS,
    });
  }
  return [...found.values()].sort((a, b) => b.last - a.last);
}
