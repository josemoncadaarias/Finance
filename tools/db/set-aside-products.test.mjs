// A product set outside net worth.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/set-aside-products.test.mjs
//
// Jose's tax CDTs live inside Pibank, next to the savings he spends from. That
// money is spoken for: set aside, its movements leave the account's balance on
// the summary and net worth, and the transfer that fed it reads as money gone.
// The bank's own balance - what the yields screen compares products against -
// still counts everything.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';

const NOW = () => '2026-09-12T12:00:00Z';
const pesos = p => Math.round(p * 100);

async function pibankWithCdt() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const yields = new YieldsRepository(db, NOW);
  const transfers = new TransfersRepository(db, NOW);

  const rappi = await accounts.create({
    name: 'Rappi', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: pesos(20_000_000),
  });
  const pibank = await accounts.create({
    name: 'Pibank', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    opened_on: '2026-01-01', opening_balance_minor: 0,
  });
  await yields.enrol({ account_id: pibank, opening_on: '2026-01-01', withholding: true });
  const [savings] = await yields.products(pibank);
  await yields.setDefaultProduct(pibank, savings.id);
  const cdt = await yields.addProduct({
    account_id: pibank, name: 'CDT renta', kind: 'cdt', sort_order: 1,
    opened_on: '2026-07-28', term_months: 12, matures_into_product_id: savings.id,
  });

  // Into Pibank with no product named: it lands in the usual one.
  await transfers.create({
    occurred_on: '2026-07-27',
    from: { account_id: rappi, amount_minor: pesos(10_000_000) },
    to: { account_id: pibank, amount_minor: pesos(10_000_000) },
  });
  // From Pibank's savings into the CDT, inside the one account.
  await transfers.create({
    occurred_on: '2026-07-28',
    from: { account_id: pibank, product_id: savings.id, amount_minor: pesos(1_000_000) },
    to: { account_id: pibank, product_id: cdt, amount_minor: pesos(1_000_000) },
  });
  // And straight from Rappi into the CDT.
  await transfers.create({
    occurred_on: '2026-07-29',
    from: { account_id: rappi, amount_minor: pesos(500_000) },
    to: { account_id: pibank, product_id: cdt, amount_minor: pesos(500_000) },
  });

  return { db, accounts, yields, transactions: new TransactionsRepository(db, NOW), rappi, pibank, savings, cdt };
}

test('every product counts until one is set aside, so nothing moves on its own', async () => {
  const { accounts, yields, pibank, cdt } = await pibankWithCdt();

  assert.equal((await yields.products(pibank)).find(p => p.id === cdt).include_in_net_worth, 1);
  assert.equal((await accounts.balance(pibank, { leaveOutSetAside: true })).balance_minor, pesos(10_500_000));
  assert.equal(await accounts.netWorthMinor('2026-09-12'), pesos(20_000_000));
});

test('a product set aside leaves the balance shown and net worth, not the bank balance', async () => {
  const { accounts, yields, rappi, pibank, cdt } = await pibankWithCdt();
  await yields.setProductNetWorth(cdt, false);

  assert.equal((await accounts.balance(pibank)).balance_minor, pesos(10_500_000),
    'the bank balance, which the yields screen compares products against, keeps everything');
  assert.equal((await accounts.balance(pibank, { leaveOutSetAside: true })).balance_minor, pesos(9_000_000));
  assert.equal(
    (await accounts.balancesByGroup({ leaveOutSetAside: true }))
      .flatMap(group => group.balances).find(b => b.account.id === pibank).balance_minor,
    pesos(9_000_000));
  assert.equal((await accounts.balance(rappi, { leaveOutSetAside: true })).balance_minor, pesos(9_500_000));
  assert.equal(await accounts.netWorthMinor('2026-09-12'), pesos(18_500_000),
    'the 1.5M in the CDT is out of net worth');
});

test('each movement says whether it, or the other end of its transfer, is set aside', async () => {
  const { yields, transactions, rappi, pibank, cdt } = await pibankWithCdt();
  await yields.setProductNetWorth(cdt, false);
  const rows = await transactions.listDetailed({ accountIds: [rappi, pibank] });
  const on = (day, account) => rows.filter(row => row.occurred_on === day && row.account_id === account);

  const [intoCdt, outOfSavings] = [
    on('2026-07-28', pibank).find(row => row.amount_minor > 0),
    on('2026-07-28', pibank).find(row => row.amount_minor < 0),
  ];
  assert.equal(intoCdt.product_set_aside, 1);
  assert.equal(outOfSavings.product_set_aside, 0);
  assert.equal(outOfSavings.other_product_set_aside, 1);
  assert.equal(outOfSavings.other_product_name, 'CDT renta');

  const [fromRappi] = on('2026-07-29', rappi);
  assert.equal(fromRappi.other_product_set_aside, 1, 'money sent from another account into it is gone too');
  assert.equal(on('2026-07-27', rappi)[0].other_product_set_aside, 0);
});

test('the usual product always counts', async () => {
  const { yields, pibank, savings, cdt } = await pibankWithCdt();

  await assert.rejects(() => yields.setProductNetWorth(savings.id, false));

  await yields.setProductNetWorth(cdt, false);
  await yields.setDefaultProduct(pibank, cdt);
  assert.equal((await yields.products(pibank)).find(p => p.id === cdt).include_in_net_worth, 1,
    'becoming the usual product brings it back into net worth');
});
