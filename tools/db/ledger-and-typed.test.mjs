// An account with a product that follows its balance beside products with a
// typed figure: the first holds what the others leave, never the whole
// balance, so money moved into a typed product is counted - and earns - once.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/ledger-and-typed.test.mjs
//
// Found building the demo backup (2026-10-02): Ahorro Verde, 38 million with a
// 3 million pocket typed in, earned on 41 million and showed the pocket as
// money not yet counted in net worth.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { TaxParametersRepository } from '../../src/app/core/database/repositories/tax-parameters.repository.ts';
import { AccrualEngine } from '../../src/app/core/yields/accrual.ts';
import { EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

const NOW = () => '2026-10-02T12:00:00Z';
const P = pesos => Math.round(pesos * 100);

async function account() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const yields = new YieldsRepository(db, NOW);
  const id = await new AccountsRepository(db, NOW).create({
    name: 'Ahorro', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-08-31', opening_balance_minor: P(10_000_000),
  });
  await yields.enrol({ account_id: id, opening_on: '2026-08-31', withholding: false });
  const [main] = await yields.products(id);
  assert.equal(main.source, 'ledger');
  const pocket = await yields.addProduct({ account_id: id, name: 'Bolsillo', source: 'manual', sort_order: 1 });
  // 2 of the 10 million are in the pocket on the day it is set up.
  await yields.setProductBalance({ product_id: pocket, valid_from: '2026-08-31', amount_minor: P(2_000_000) });
  await new TransfersRepository(db, NOW).create({
    occurred_on: '2026-09-10',
    from: { account_id: id, product_id: main.id, amount_minor: P(1_000_000) },
    to: { account_id: id, product_id: pocket, amount_minor: P(1_000_000) },
  });
  const rate = Math.round(0.1 * EA_SCALE);
  await yields.setRate({ account_id: id, product_id: main.id, valid_from: '2026-08-31', annual_rate_scaled: rate });
  await yields.setRate({ account_id: id, product_id: pocket, valid_from: '2026-08-31', annual_rate_scaled: rate });
  return { db, yields, id, main: main.id, pocket, engine: new AccrualEngine(db, yields, new TaxParametersRepository(db, NOW)) };
}

test('the product that follows the account holds what the typed ones leave', async () => {
  const { engine, id, main, pocket } = await account();
  const held = await engine.heldByProduct(id, '2026-09-30');
  assert.equal(held.get(pocket), P(3_000_000));
  assert.equal(held.get(main), P(7_000_000));
  assert.equal(held.get(main) + held.get(pocket), P(10_000_000), 'the account, counted once');
});

test('and the yield is worked out on the account once, not on it plus the pocket', async () => {
  const { engine, yields, id } = await account();
  await engine.accrueAll('2026-09-30');
  const days = await yields.days(id, '2026-09-20', '2026-09-20');
  const base = days.reduce((sum, day) => sum + day.balance_minor, 0);
  // The ten million, plus what they have earned so far and earn on too -
  // never the thirteen million the pocket used to make of them.
  const earned = (await yields.days(id, '2026-09-01', '2026-09-19')).reduce((sum, day) => sum + day.net_minor, 0);
  assert.ok(base >= P(10_000_000) && base <= P(10_000_000) + earned, `base ${base / 100}`);
});
