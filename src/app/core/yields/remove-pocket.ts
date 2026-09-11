/**
 * Removing a product without losing anything it carried.
 *
 * Deleting the row alone was quietly destructive. Every day the product earned
 * went with it, so the account's cushion - and the year the tax simulator
 * reads - shrank. Every movement that named it lost its product and landed in
 * whichever product takes unassigned money, moving a balance nobody chose to
 * move. And it happened on one tap, with no question asked.
 *
 * So removing a product hands all of it to another one, chosen by the person:
 *
 *   * **The history.** Movements, cushion entries, withdrawals and every day
 *     earned move across, summed where both products earned on the same day.
 *   * **The balance.** Whatever the removed product held that did not come
 *     with those movements - its own stated figure, mostly - arrives on the
 *     destination as an entry dated today: a movement in its history, with the
 *     removed product's name on it. The destination's own stated balance is
 *     never rewritten; it used to be, which left no trace of where the money
 *     came from and changed a figure read off the bank.
 *   * **Being the usual one.** If the removed product was where unassigned
 *     money lands, the destination takes that over.
 *
 * The account's own balance never changes: no movement of the account is
 * written or altered beyond which product it names. The current month is
 * worked out again afterwards, now with the money where it lives.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import type { YieldsRepository } from '../database/repositories/yields.repository';
import type { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { AccrualEngine } from './accrual';

export async function removePocketInto(
  db: SqlDriver,
  yields: YieldsRepository,
  tax: TaxParametersRepository,
  accountId: number,
  pocketId: number,
  intoId: number,
  today: IsoDate,
  /** The note on the entry that carries the balance across. */
  note?: string,
): Promise<void> {
  const pockets = await yields.pockets(accountId);
  const removed = pockets.find(pocket => pocket.id === pocketId);
  const into = pockets.find(pocket => pocket.id === intoId);

  if (!removed || !into) throw new Error('Both products must belong to this account.');
  if (pocketId === intoId) throw new Error('A product cannot be moved into itself.');
  if (pockets.length <= 1) throw new Error('An account keeps at least one product.');

  const engine = new AccrualEngine(db, yields, tax);

  // What each product holds. Only this is carried by the entry: the yield it
  // earned travels with its own days, which the merge moves across, and those
  // are worked out again afterwards on the new balance - counting them here
  // too would carry them twice.
  const held = async () => {
    const byPocket = await engine.heldByPocket(accountId, today);
    return (id: number) => byPocket.get(id) ?? 0;
  };

  // Read before anything moves: this is what the destination must end up holding.
  const before = await held();
  const target = before(intoId) + before(pocketId);

  await db.transaction(async () => {
    await yields.mergePocketInto(pocketId, intoId);
    await yields.removePocket(pocketId);

    if (removed.is_default === 1) {
      await yields.setDefaultPocket(accountId, intoId);
    }

    if (removed.source === 'ledger') {
      // The product that followed the account's balance is gone, and some
      // product has to go on following it.
      await yields.setPocketSource(intoId, 'ledger');
      return;
    }

    // A product that follows the account's balance needs nothing written: its
    // figure is the account's.
    if (into.source !== 'manual') return;

    const missing = target - (await held())(intoId);
    if (missing === 0) return;

    // Dated today, or on the destination's latest balance when that one is
    // dated later - an entry before it would already be inside that figure.
    const latest = (await yields.pocketBalances(intoId)).at(-1);
    const on = latest && latest.valid_from > today ? latest.valid_from : today;

    await yields.adjust({
      account_id: accountId, pocket_id: intoId, on_date: on, amount_minor: missing,
      kind: 'other', note: note ?? removed.name,
    });
  });

  await engine.accrue(accountId, today);
}
