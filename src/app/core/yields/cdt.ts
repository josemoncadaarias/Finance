/**
 * CDTs: what one will pay, and closing it when it matures.
 *
 * A CDT is not a savings product. It opens on a day, runs for a whole number of
 * months, and on the day it matures pays its whole term at once, on the
 * balance it holds - with 7% of the yield withheld, however small. Then it is
 * over: the capital and the yield go to the product the person chose (the
 * usual one unless they said otherwise), and the CDT closes itself.
 *
 * Closing it writes what Jose would otherwise do by hand:
 *
 *   * the payment is kept - locked, and named after the CDT - so the year the
 *     tax simulator reads still has the yield and what was withheld from it,
 *     even though the product it was worked out on is gone;
 *   * the net yield becomes money in the account: an income movement into the
 *     chosen product, under the category chosen for it, and the matching
 *     cashout from what the product has earned, exactly as "Pasar a la cuenta" does;
 *   * the capital moves across, and the CDT is removed, through the same
 *     removal that loses nothing a product carried.
 *
 * The engine only ever works out the payment; closing is a separate step, run
 * after every accrual, so a CDT that matured while the app was closed is
 * settled the next time it opens.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { OnProgress } from '../database/export/progress';
import type { IsoDate } from '../database/types';
import type { YieldsRepository } from '../database/repositories/yields.repository';
import type { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { TransactionsRepository } from '../database/repositories/transactions.repository';
import { AccrualEngine, type AccrualResult } from './accrual';
import { addMonthsClamped, daysBetween } from './days';
import { periodYieldMinor, ruleForProduct, withholdingMinor, type WithholdingRule } from './yield-math';
import { removeProductInto } from './remove-product';

/** The day a CDT matures: the same day of the month, `termMonths` later. */
export function cdtMaturity(openedOn: IsoDate, termMonths: number): IsoDate {
  return addMonthsClamped(openedOn, termMonths);
}

export interface CdtPreview {
  maturesOn: IsoDate;
  days: number;
  grossMinor: number;
  /** Null when the withholding parameters are not on record yet. */
  withheldMinor: number | null;
  netMinor: number;
  /** What arrives on the day it matures: the capital and the net yield. */
  receiveMinor: number;
}

/**
 * What a CDT will pay, worked out the way the engine will work it out.
 *
 * Shown while the CDT is being typed in, so the dates and the figures can be
 * checked against the bank's own before anything is saved.
 */
export function cdtPreview(input: {
  capitalMinor: number;
  annualRateScaled: number;
  openedOn: IsoDate;
  termMonths: number;
  rule: WithholdingRule | null;
  withholds: boolean;
}): CdtPreview {
  const maturesOn = cdtMaturity(input.openedOn, input.termMonths);
  const days = daysBetween(input.openedOn, maturesOn);
  const grossMinor = periodYieldMinor(input.capitalMinor, input.annualRateScaled, days);
  const withheldMinor = input.withholds ? withholdingMinor(grossMinor, ruleForProduct('cdt', input.rule)) : 0;
  const netMinor = grossMinor - (withheldMinor ?? 0);
  return { maturesOn, days, grossMinor, withheldMinor, netMinor, receiveMinor: input.capitalMinor + netMinor };
}

/** The name a closed CDT's payment keeps, in the payments list and on its locked day. */
export function cdtPaymentName(cdtName: string): string {
  return `CDT ${cdtName}`;
}

/**
 * Closes every CDT of an account that has matured by `today`.
 *
 * Returns how many were closed. A CDT that has nowhere to go - it is the only
 * product left - is left open rather than guessed at.
 */
export async function settleMaturedCdts(
  db: SqlDriver,
  yields: YieldsRepository,
  tax: TaxParametersRepository,
  accountId: number,
  today: IsoDate,
): Promise<number> {
  let settled = 0;

  const due = (await yields.products(accountId)).filter(product =>
    product.kind === 'cdt' && product.opened_on && product.term_months
    && cdtMaturity(product.opened_on, product.term_months) <= today);

  for (const cdt of due) {
    const maturesOn = cdtMaturity(cdt.opened_on!, cdt.term_months!);

    const others = (await yields.products(accountId)).filter(product => product.id !== cdt.id && product.kind !== 'cdt');
    const into = others.find(product => product.id === cdt.matures_into_product_id)
      ?? others.find(product => product.is_default === 1)
      ?? others[0];
    if (!into) continue;

    const payment = (await yields.days(accountId, maturesOn, maturesOn)).find(day => day.product_id === cdt.id);
    const net = payment ? payment.actual_net_minor ?? payment.net_minor : 0;
    const name = cdtPaymentName(cdt.name);

    await db.transaction(async () => {
      if (payment) await yields.fixPayment(cdt.id, payment.component, maturesOn, name);

      // The net yield becomes money in the account, the way "Pasar a la
      // cuenta" makes it: a movement in, and the same amount out of the
      // product. Without a category there is no movement to write, and the
      // yield simply stays in what the product it lands in has earned.
      if (net > 0 && cdt.income_category_id !== null) {
        const transactionId = await new TransactionsRepository(db).create({
          account_id: accountId,
          category_id: cdt.income_category_id,
          product_id: into.id,
          occurred_on: maturesOn,
          amount_minor: net,
          description: name,
          source: 'manual',
          locked: true,
        });
        await yields.withdraw({
          account_id: accountId,
          on_date: maturesOn,
          amount_minor: net,
          transaction_id: transactionId,
          note: name,
          product_id: into.id,
        });
      }
    });

    // The capital, the locked payment and everything else the CDT carried,
    // into the chosen product - and the CDT is gone.
    await removeProductInto(db, yields, tax, accountId, cdt.id, into.id, today);
    settled += 1;
  }

  return settled;
}

/** One account's yields, worked out, and its matured CDTs closed. */
export async function accrueAndSettle(
  db: SqlDriver,
  yields: YieldsRepository,
  tax: TaxParametersRepository,
  accountId: number,
  today: IsoDate,
): Promise<AccrualResult> {
  const result = await new AccrualEngine(db, yields, tax).accrue(accountId, today);
  await settleMaturedCdts(db, yields, tax, accountId, today);
  return result;
}

/** Every enrolled account the same way, or only the accounts in `only`. */
export async function accrueAllAndSettle(
  db: SqlDriver,
  yields: YieldsRepository,
  tax: TaxParametersRepository,
  today: IsoDate,
  onProgress?: OnProgress,
  only?: readonly number[],
): Promise<AccrualResult[]> {
  // One transaction for the lot. Every write outside one is saved to the
  // browser store on its own - the whole database, six megabytes of it, a
  // hundred and fifty times over just to open the screen - and on the phone
  // each one is a crossing into the native side. This is one commit.
  return db.transaction(async () => {
    const results = await new AccrualEngine(db, yields, tax).accrueAll(today, onProgress, only);
    for (const account of await yields.accounts()) {
      if (only !== undefined && !only.includes(account.account_id)) continue;
      await settleMaturedCdts(db, yields, tax, account.account_id, today);
    }
    return results;
  });
}
