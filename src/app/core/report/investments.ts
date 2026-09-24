/**
 * Investment accounts in the yields summary: what they earned, and what was in
 * them.
 *
 * Jose, 2026-09-24. Fiducuenta and Multinversion have no products and nothing
 * the app works out: what they earned is written down, as movements filed
 * under a category that says it is a return (migration 047) - "subio
 * inversion" under Ganancia, "bajo inversion" under Perdida, a correction of
 * the fund under Ajuste de ganancias. Everything else that moves their
 * balance - a transfer in, a withdrawal, a bill paid from them - is money put
 * in or taken out, never a return.
 *
 * Pure, like the sections: the movements are loaded once by the service.
 */

import type { InvestmentData, YieldsReportData } from './yields-data';

const DAY = 86_400_000;

function addDays(day: string, count: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
}

/** The account's balance at the close of `day`, in its own currency. */
export function closingBalance(investment: InvestmentData, day: string): number {
  let balance = investment.opening_minor;
  for (const movement of investment.movements) {
    if (movement.on_date > day) break;
    balance += movement.amount_minor;
  }
  return balance;
}

/** Every return on record, in the report's currency, dated. */
export function investmentReturns(data: YieldsReportData): { account_id: number; on_date: string; amount: number }[] {
  const out: { account_id: number; on_date: string; amount: number }[] = [];
  for (const investment of data.investments) {
    for (const movement of investment.movements) {
      if (movement.is_return !== 1 || movement.on_date > data.today) continue;
      const amount = data.inReportCurrency(movement.amount_minor, investment.account_id, movement.on_date);
      if (amount !== null) out.push({ account_id: investment.account_id, on_date: movement.on_date, amount });
    }
  }
  return out;
}

/**
 * The balance on an average day between `first` and `last`, in the report's
 * currency - the money that was invested, whatever it earned. One walk over
 * the movements per account.
 */
export function averageBalance(data: YieldsReportData, investment: InvestmentData, first: string, last: string): number {
  if (last < first) return 0;
  let balance = closingBalance(investment, addDays(first, -1));
  let at = investment.movements.findIndex(movement => movement.on_date >= first);
  if (at < 0) at = investment.movements.length;
  let total = 0;
  let days = 0;
  for (let day = first; day <= last; day = addDays(day, 1)) {
    while (at < investment.movements.length && investment.movements[at].on_date === day) {
      balance += investment.movements[at].amount_minor;
      at += 1;
    }
    total += data.inReportCurrency(balance, investment.account_id, day) ?? 0;
    days += 1;
  }
  return days > 0 ? total / days : 0;
}

/** Each month's closing balance, in the report's currency, up to `end` (`YYYY-MM`). */
export function monthEndBalances(data: YieldsReportData, investment: InvestmentData, end: string): Map<string, number> {
  const out = new Map<string, number>();
  const start = investment.from.slice(0, 7);
  for (let month = start; month <= end; ) {
    const [year, number] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
    const day = lastDay < data.today ? lastDay : data.today;
    out.set(month, data.inReportCurrency(closingBalance(investment, day), investment.account_id, day) ?? 0);
    month = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  }
  return out;
}
