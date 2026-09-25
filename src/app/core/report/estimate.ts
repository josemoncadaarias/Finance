/**
 * What an account with products probably earned before the app began working
 * it out.
 *
 * Jose, 2026-09-24: his products started being worked out in September, so a
 * summary of 2026 counted eight and a half months of nothing. What each
 * product says it had already earned cannot fill the gap: that record is
 * years of yields in one figure, and taking it as this year's would be a lie.
 *
 * So an estimate, for any account and any user, from two things the app does
 * know:
 *
 *   - the account's balance on every earlier day, exactly, from its own
 *     movements - the same base the engine uses, the close of the day before;
 *   - the rate it actually earned on its first days worked out: what those
 *     days paid over what was in the products, net of withholding, with every
 *     part of the rate and every product in it.
 *
 * It assumes that rate held all along, which a bank that changed its rate
 * breaks; and the movements do not carry the yields already inside the
 * balance, so the base falls a little short. The screen says both, and every
 * such day is marked `estimated` so nothing mistakes it for a worked-out one.
 * Pure: the caller hands over the days and the balances.
 */

import type { InvestmentData, YieldDayRow } from './yields-data';

/** How many of the first worked-out days set the rate. */
const FIRST_DAYS = 7;

const DAY = 86_400_000;

function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
}

/**
 * The estimated days, one row per account per day, from `windowStart` (or the
 * day the account was opened, if later) to the day before its first
 * worked-out day. `ledgers` are the accounts' balances where the window opens
 * and their movements from there - the shape investments use.
 */
export function estimateBeforeRecord(
  days: readonly YieldDayRow[],
  ledgers: readonly InvestmentData[],
  openedOn: ReadonlyMap<number, string>,
  windowStart: string,
  today: string,
): YieldDayRow[] {
  const out: YieldDayRow[] = [];
  for (const ledger of ledgers) {
    const own = days.filter(day => day.account_id === ledger.account_id && day.on_date <= today);
    if (own.length === 0) continue;
    const first = own.reduce((earliest, day) => (day.on_date < earliest ? day.on_date : earliest), own[0].on_date);

    const opened = openedOn.get(ledger.account_id) ?? windowStart;
    const start = [windowStart, opened, ledger.from].sort()[2];
    if (start >= first) continue;

    // The rate of the first days: what they paid over what was earning.
    const until = addDays(first, FIRST_DAYS - 1);
    const early = own.filter(day => day.on_date <= until);
    const paid = early.reduce((sum, day) => sum + (day.actual_net_minor ?? day.net_minor), 0);
    const bases = new Map<string, number>();
    for (const day of early) bases.set(`${day.product_id}|${day.on_date}`, day.balance_minor);
    const capital = [...bases.values()].reduce((sum, base) => sum + base, 0);
    if (capital <= 0 || paid <= 0) continue;
    const daily = paid / capital;
    const annualScaled = Math.round((Math.pow(1 + daily, 365) - 1) * 1_000_000);

    // Walk the balance: the base of a day is the close of the day before.
    let balance = ledger.opening_minor;
    let at = 0;
    for (let day = ledger.from; day < first; day = addDays(day, 1)) {
      if (day >= start) {
        const base = Math.max(balance, 0);
        const net = Math.round(base * daily);
        out.push({
          account_id: ledger.account_id,
          product_id: -ledger.account_id,
          component: 'estimate',
          on_date: day,
          paid_on: day,
          balance_minor: base,
          annual_rate_scaled: annualScaled,
          gross_minor: net,
          withholding_minor: 0,
          net_minor: net,
          actual_net_minor: null,
          locked: 0,
          estimated: true,
        });
      }
      while (at < ledger.movements.length && ledger.movements[at].on_date === day) {
        balance += ledger.movements[at].amount_minor;
        at += 1;
      }
    }
  }
  return out;
}
