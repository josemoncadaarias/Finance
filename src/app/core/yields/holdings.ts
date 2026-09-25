/**
 * What money leaving from here could take at most: what it holds today.
 *
 * For "move it all" (Jose, 2026-09-25): a move between products, or a
 * transfer to another account, that empties where it leaves from - withdraw
 * a whole bolsillo, top one up completely. Having to close the form, read the
 * figure off another screen and remember it was the whole problem.
 *
 * A product's figure is the one the products screen shows for it: what it
 * holds plus the yields paid into it (`balanceIn` there). With no product, the
 * account's own balance.
 */

import type { SqlDriver } from '../database/sql-driver';
import type { IsoDate } from '../database/types';
import { AccountsRepository } from '../database/repositories/accounts.repository';
import { YieldsRepository } from '../database/repositories/yields.repository';
import { TaxParametersRepository } from '../database/repositories/tax-parameters.repository';
import { AccrualEngine } from './accrual';

export async function whatItHolds(
  db: SqlDriver, accountId: number, productId: number | null, on: IsoDate,
): Promise<number> {
  if (productId === null) {
    return (await new AccountsRepository(db).balance(accountId))?.balance_minor ?? 0;
  }
  const yields = new YieldsRepository(db);
  const held = await new AccrualEngine(db, yields, new TaxParametersRepository(db)).heldByProduct(accountId, on);
  const landed = await yields.landedByProduct(accountId, on);
  return (held.get(productId) ?? 0) + (landed.total.get(productId) ?? 0);
}
