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
 *   * **The balance.** The destination ends up holding exactly what it held
 *     plus what the removed product held - no more, no less.
 *   * **The history.** Movements, cushion entries, withdrawals and every day
 *     earned move across, summed where both products earned on the same day.
 *   * **Being the usual one.** If the removed product was where unassigned
 *     money lands, the destination takes that over.
 *
 * The account's own balance never changes: no movement is written or altered
 * beyond which product it names. The current month is worked out again
 * afterwards, as it is after any change to a product, now with the money where
 * it lives.
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
): Promise<void> {
  const pockets = await yields.pockets(accountId);
  const removed = pockets.find(pocket => pocket.id === pocketId);
  const into = pockets.find(pocket => pocket.id === intoId);

  if (!removed || !into) throw new Error('Both products must belong to this account.');
  if (pocketId === intoId) throw new Error('A product cannot be moved into itself.');
  if (pockets.length <= 1) throw new Error('An account keeps at least one product.');

  const engine = new AccrualEngine(db, yields, tax);

  // Read before anything moves: this is the figure the destination must end on.
  const before = await engine.heldByPocket(accountId, today);
  const target = (before.get(intoId) ?? 0) + (before.get(pocketId) ?? 0);

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
    // figure is the account's. A product with a figure of its own gets a new
    // one, so that what it holds is exactly the target.
    if (into.source !== 'manual') return;

    const held = (await engine.heldByPocket(accountId, today)).get(intoId) ?? 0;
    if (held === target) return;

    // Written on today, or on the destination's latest balance when that one
    // is dated later - the latest balance is the one that governs, and a figure
    // written before it would be ignored.
    const latest = (await yields.pocketBalances(intoId)).at(-1);
    const on = latest && latest.valid_from > today ? latest.valid_from : today;

    const remaining = await yields.pockets(accountId);
    const usual = remaining.find(pocket => pocket.is_default === 1) ?? remaining[0];
    const movedSince = await yields.movedInPocketSince(accountId, intoId, on, usual?.id === intoId);

    await yields.setPocketBalance({ pocket_id: intoId, valid_from: on, amount_minor: target - movedSince });
  });

  await engine.accrue(accountId, today);
}
