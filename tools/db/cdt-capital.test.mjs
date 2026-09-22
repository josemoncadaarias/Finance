// Saving a CDT again must not count the transfer that funded it twice.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/cdt-capital.test.mjs
//
// Jose, 2026-09-12: Pibank's 1.000.000 CDT, funded from the savings product,
// read 2.000.000 after its form was saved again. The form wrote the whole
// capital on the opening day, and the transfer of that same day added it again.

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

const NOW = () => '2026-09-12T12:00:00Z';
const TODAY = '2026-09-12';
const pesos = p => Math.round(p * 100);

async function bank({ funded }) {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const yields = new YieldsRepository(db, NOW);
  const account = await new AccountsRepository(db, NOW).create({
    name: 'Pibank', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: pesos(10_000_000),
  });
  await yields.enrol({ account_id: account, opening_on: '2026-01-01', withholding: true });
  const [savings] = await yields.pockets(account);
  await yields.setDefaultPocket(account, savings.id);
  const cdt = await yields.addPocket({
    account_id: account, name: 'CDT renta', kind: 'cdt', sort_order: 1,
    opened_on: '2026-07-28', term_months: 12, matures_into_pocket_id: savings.id,
  });
  if (funded) {
    // What creating it "from another product" writes: zero the day before, then the transfer.
    await yields.setPocketBalance({ pocket_id: cdt, valid_from: '2026-07-27', amount_minor: 0 });
    await new TransfersRepository(db, NOW).create({
      occurred_on: '2026-07-28',
      from: { account_id: account, pocket_id: savings.id, amount_minor: pesos(1_000_000) },
      to: { account_id: account, pocket_id: cdt, amount_minor: pesos(1_000_000) },
    });
  }
  const engine = new AccrualEngine(db, yields, new TaxParametersRepository(db, NOW));
  const held = async () => ((await engine.heldByPocket(account, TODAY)).get(cdt) ?? 0)
    + ((await yields.landedByPocket(account, TODAY)).total.get(cdt) ?? 0);
  return { yields, cdt, held };
}

const terms = { opened_on: '2026-07-28', matures_on: '2027-07-28', capital_minor: pesos(1_000_000) };

test('saving a funded CDT again keeps its capital, however many times', async () => {
  const { yields, cdt, held } = await bank({ funded: true });
  assert.equal(await yields.cdtFunding(cdt, terms.opened_on, terms.matures_on), pesos(1_000_000));

  await yields.setCdtCapital(cdt, terms);
  await yields.setCdtCapital(cdt, terms);

  assert.deepEqual((await yields.pocketBalances(cdt)).map(b => [b.valid_from, b.amount_minor]), [['2026-07-27', 0]]);
  assert.equal(await held(), pesos(1_000_000));
});

test('saving puts right a CDT that the old form had doubled', async () => {
  const { yields, cdt, held } = await bank({ funded: true });
  for (const old of await yields.pocketBalances(cdt)) await yields.removePocketBalance(old.id);
  await yields.setPocketBalance({ pocket_id: cdt, valid_from: '2026-07-28', amount_minor: pesos(1_000_000) });
  assert.equal(await held(), pesos(2_000_000), 'the state the old form left behind');

  await yields.setCdtCapital(cdt, terms);
  assert.equal(await held(), pesos(1_000_000));
});

test('a CDT whose capital was typed in holds exactly that', async () => {
  const { yields, cdt, held } = await bank({ funded: false });
  await yields.setCdtCapital(cdt, terms);

  assert.deepEqual((await yields.pocketBalances(cdt)).map(b => [b.valid_from, b.amount_minor]),
    [['2026-07-27', pesos(1_000_000)]]);
  assert.equal(await held(), pesos(1_000_000));
});
