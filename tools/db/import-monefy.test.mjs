// Tests for writing a Monefy export into the database.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/import-monefy.test.mjs
//
// The last test imports the real 12,898-row export end to end.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { importMonefy } from '../../src/app/core/database/import/import-monefy.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { formatMoney } from '../../src/app/core/database/money.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_EXPORT = join(HERE, '..', '..', 'data', 'monefy-2026-09-08.csv');
const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';
const NOW = () => '2026-09-08T12:00:00Z';

function csv(...lines) {
  const text = [HEADER, ...lines].join('\r\n');
  return Uint8Array.from([...text].map(c => c.charCodeAt(0)));
}

async function freshDb() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  return db;
}

const run = (db, source, options = {}) =>
  importMonefy(db, source, { fileName: 'test.csv', fileHash: 'hash', now: NOW, ...options });

test('imports accounts, categories and transactions', async () => {
  const db = await freshDb();
  const summary = await run(db, csv(
    `25/06/2021,Nequi,Initial balance 'Nequi',"9,421.28",COP,"9,421.28",COP,`,
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    '27/06/2021,Bancolombia,Salario,"3,000,000",COP,"3,000,000",COP,Pago',
  ));

  assert.equal(summary.rowsRead, 3);
  // The opening balance is not a transaction; it became a property of Nequi.
  assert.equal(summary.rowsInserted, 2);

  const accounts = new AccountsRepository(db, NOW);
  const nequi = await accounts.findByName('Nequi');
  assert.equal(nequi.opening_balance_minor, 942128);
  assert.equal((await accounts.balance(nequi.id)).balance_minor, 942128);

  // The category's kind comes from the sign of the rows that use it.
  const kinds = Object.fromEntries(
    (await db.query('SELECT name, kind FROM categories')).map(r => [r.name, r.kind]),
  );
  assert.equal(kinds['Restaurante'], 'expense');
  assert.equal(kinds['Salario'], 'income');
  await db.close();
});

test('a transfer becomes one transfer with two legs', async () => {
  const db = await freshDb();
  const summary = await run(db, csv(
    `13/08/2024,Rappi cuenta,To 'Nequi',"-100,000",COP,"-100,000",COP,Traslado`,
    `13/08/2024,Nequi,From 'Rappi cuenta',"100,000",COP,"100,000",COP,Traslado`,
  ));

  assert.equal(summary.transfersCreated, 1);
  assert.equal(summary.rowsInserted, 2);
  assert.equal((await db.query('SELECT id FROM transfers')).length, 1);

  const accounts = new AccountsRepository(db, NOW);
  const balances = Object.fromEntries(
    (await accounts.balances()).map(b => [b.account.name, b.balance_minor]),
  );
  assert.equal(balances['Rappi cuenta'], -10000000);
  assert.equal(balances['Nequi'], 10000000);
  await db.close();
});

test("the credit card's opening balance becomes a limit, not money", async () => {
  const db = await freshDb();
  await run(db, csv(
    `21/08/2021,Tarjeta crédito rappi,Initial balance 'Tarjeta crédito rappi',"800,000",COP,"800,000",COP,`,
    '22/08/2021,Tarjeta crédito rappi,Restaurante,"-50,000",COP,"-50,000",COP,Almuerzo',
  ));

  const accounts = new AccountsRepository(db, NOW);
  const card = await accounts.findByName('Tarjeta crédito rappi');
  assert.equal(card.type, 'credit');
  assert.equal(card.opening_balance_minor, 0);
  assert.equal(card.credit_limit_minor, 110000000);

  const balance = await accounts.balance(card.id);
  assert.equal(balance.balance_minor, -5000000, 'the balance is the debt');
  assert.equal(balance.available_credit_minor, 110000000 - 5000000);
  await db.close();
});

test('a dollar amount in the description wins over the peso figure', async () => {
  const db = await freshDb();
  const summary = await run(db, csv(
    `13/08/2024,Rappi cuenta,To 'ARQ',"-2,107,000",COP,"-2,107,000",COP,Transferencia a dolarapp 500 usd`,
    `13/08/2024,ARQ,From 'Rappi cuenta',"2,107,000",COP,"2,107,000",COP,Transferencia a dolarapp 500 usd`,
  ));

  assert.equal(summary.usdRecovered, 1, 'only the dollar side takes the figure');

  const legs = await db.query(
    `SELECT a.name, t.amount_minor, t.rate_scaled, t.amount_base_minor, t.confidence, t.rate_source
     FROM transactions t JOIN accounts a ON a.id = t.account_id ORDER BY a.name`,
  );
  const arq = legs.find(l => l.name === 'ARQ USD');
  const rappi = legs.find(l => l.name === 'Rappi cuenta');

  assert.equal(arq.amount_minor, 50000, 'US$500.00, not the peso figure');
  assert.equal(arq.rate_scaled, 4214 * 10000);
  assert.equal(arq.amount_base_minor, 210700000, 'the pesos stay as the frozen base');
  assert.equal(arq.rate_source, 'manual');
  assert.equal(arq.confidence, 'high');

  // The peso half keeps pesos: the note is written on both, but means one.
  assert.equal(rappi.amount_minor, -210700000);
  assert.equal(rappi.rate_scaled, null);
  await db.close();
});

test('a figure that implies an absurd rate is not believed', async () => {
  const db = await freshDb();
  // Real row: the 600 usd is what had to be deposited to earn the bonus.
  const summary = await run(db, csv(
    '13/11/2024,ARQ,Depósitos,"2,107,000",COP,"2,107,000",COP,Transferencia a dolarapp 500 usd',
    '14/11/2024,XTB,Depósitos,"400,000",COP,"400,000",COP,Bono por nueva cuenta y fondeo de 600 usd',
  ));

  assert.equal(summary.usdRecovered, 1);
  assert.equal(summary.usdEstimated, 1);

  const xtb = await db.queryOne(
    `SELECT t.amount_minor, t.confidence, t.rate_source FROM transactions t
     JOIN accounts a ON a.id = t.account_id WHERE a.name = 'XTB'`,
  );
  assert.notEqual(xtb.amount_minor, 60000, 'the 600 usd must not have been taken at face value');
  assert.equal(xtb.confidence, 'low');
  assert.equal(xtb.rate_source, 'derived');

  assert.ok((await db.query(`SELECT id FROM review_queue WHERE kind = 'estimated_amount'`)).length > 0);
  await db.close();
});

test('a transfer to a deleted account is reconstructed, not dropped', async () => {
  const db = await freshDb();
  const summary = await run(db, csv(
    `15/07/2021,Bancolombia,To 'Renta Fija Plazo',"-500,000",COP,"-500,000",COP,Ingreso fondo`,
  ));

  assert.equal(summary.synthesizedLegs, 1);
  assert.equal(summary.transfersCreated, 1);

  const accounts = new AccountsRepository(db, NOW);
  const fund = await accounts.findByName('Renta Fija Plazo');
  assert.equal(fund.archived, 1, 'it no longer exists, so it is archived');

  // The money balances: it left Bancolombia and arrived somewhere.
  const balances = Object.fromEntries(
    (await accounts.balances({ includeArchived: true })).map(b => [b.account.name, b.balance_minor]),
  );
  assert.equal(balances['Bancolombia'], -50000000);
  assert.equal(balances['Renta Fija Plazo'], 50000000);

  assert.ok((await db.query(`SELECT id FROM review_queue WHERE kind = 'reconstructed_transfer'`)).length > 0);
  await db.close();
});

test('re-importing the same file changes nothing', async () => {
  const db = await freshDb();
  const source = csv(
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    `13/08/2024,Rappi cuenta,To 'Nequi',"-100,000",COP,"-100,000",COP,Traslado`,
    `13/08/2024,Nequi,From 'Rappi cuenta',"100,000",COP,"100,000",COP,Traslado`,
  );

  const first = await run(db, source);
  const before = await db.query('SELECT id FROM transactions');

  const second = await run(db, source);
  const after = await db.query('SELECT id FROM transactions');

  assert.equal(second.rowsInserted, 0, 'nothing new to add');
  assert.equal(second.rowsSkipped, first.rowsInserted);
  assert.deepEqual(after.map(r => r.id), before.map(r => r.id), 'not one row was rewritten');
  assert.equal((await db.query('SELECT id FROM transfers')).length, 1);
  await db.close();
});

test('a later export adds only its new rows', async () => {
  const db = await freshDb();
  const older = '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi';
  const newer = '27/06/2021,Bancolombia,Comida,"-30,000",COP,"-30,000",COP,Mercado';

  await run(db, csv(older));
  const second = await run(db, csv(older, newer));

  assert.equal(second.rowsInserted, 1);
  assert.equal(second.rowsSkipped, 1);
  assert.equal((await db.query('SELECT id FROM transactions')).length, 2);
  await db.close();
});

test('a hand-edited row survives a re-import untouched', async () => {
  const db = await freshDb();
  const source = csv('26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi');
  await run(db, source);

  const transactions = new TransactionsRepository(db, NOW);
  const [row] = await transactions.list();
  await transactions.update(row.id, { description: 'Almuerzo con Leidy', amount_minor: -5030000 });

  await run(db, source);

  const after = await transactions.findById(row.id);
  assert.equal(after.locked, 1);
  assert.equal(after.description, 'Almuerzo con Leidy', 'the correction stands');
  assert.equal(after.amount_minor, -5030000);
  assert.equal((await db.query('SELECT id FROM transactions')).length, 1, 'and no duplicate appeared');
  await db.close();
});

test('a failed import leaves the database untouched', async () => {
  const db = await freshDb();
  await run(db, csv('26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi'));
  const before = (await db.query('SELECT id FROM transactions')).length;

  await assert.rejects(() => run(db, csv('not-a-date,Bancolombia,Restaurante,"-1",COP,"-1",COP,x')));

  assert.equal((await db.query('SELECT id FROM transactions')).length, before);
  assert.equal((await db.query('SELECT id FROM import_batches')).length, 1, 'no half-written batch');
  await db.close();
});

test('imports the real export', { skip: !existsSync(REAL_EXPORT) && 'export not present' }, async () => {
  const db = await freshDb();
  const bytes = readFileSync(REAL_EXPORT);

  const started = Date.now();
  const summary = await importMonefy(db, bytes, {
    fileName: 'monefy-2026-09-08.csv',
    fileHash: 'sha-not-computed-in-test',
    now: NOW,
  });
  const elapsed = Date.now() - started;

  assert.equal(summary.rowsRead, 12898);
  assert.equal(summary.accountsCreated, 36);
  assert.equal(summary.groupsCreated, 2);

  // Every row is accounted for: 8 opening balances are not transactions.
  // 8 opening balances and 2 credit-limit changes are not transactions.
  assert.equal(summary.rowsInserted, 12898 - 8 - 2);
  assert.equal(summary.creditLimitChanges, 2);

  const counted = await db.queryOne('SELECT COUNT(*) AS n FROM transactions');
  assert.equal(counted.n, summary.rowsInserted + summary.synthesizedLegs);

  // No transfer lost a leg.
  const orphans = await db.queryOne(`
    SELECT COUNT(*) AS n FROM transfers t
    WHERE (SELECT COUNT(*) FROM transactions WHERE transfer_id = t.id) <> 2`);
  assert.equal(orphans.n, 0);

  // Foreign keys and constraints all hold on real data.
  assert.equal((await db.query('PRAGMA foreign_key_check')).length, 0);

  const accounts = new AccountsRepository(db, NOW);
  const card = await accounts.findByName('Tarjeta crédito rappi');
  const cardBalance = await accounts.balance(card.id);
  // The card's rows sum to +273,507.73 with the 800,000 opening and the two
  // Aumento cupo rows included. All three are limit, not money, so the debt is
  // 826,492.27 and 273,507.73 of the limit is free — the figure Monefy shows.
  assert.equal(cardBalance.balance_minor, -82649227);
  assert.equal(cardBalance.available_credit_minor, 27350773);

  const balances = await accounts.balances({ includeArchived: true });
  console.log(`\n    Imported ${summary.rowsRead} rows in ${elapsed} ms`);
  console.log(`    ${summary.transfersCreated} transfers (${summary.synthesizedLegs} reconstructed), ` +
    `${summary.categoriesCreated} categories, ${summary.reviewsRaised} reviews`);
  console.log(`    dollars: ${summary.usdRecovered} recovered from descriptions, ${summary.usdEstimated} estimated`);
  console.log('\n    Balances:');
  for (const b of balances.filter(b => b.balance_minor !== 0).slice(0, 40)) {
    const flag = b.account.archived ? ' (archived)' : '';
    console.log('      ' + b.account.name.padEnd(34) +
      formatMoney(b.balance_minor, b.account.currency_code, { withSymbol: false }).padStart(18) +
      ' ' + b.account.currency_code + flag);
  }

  const reviews = await db.query('SELECT kind, COUNT(*) AS n FROM review_queue GROUP BY kind ORDER BY n DESC');
  console.log('\n    Review queue:');
  for (const r of reviews) console.log('      ' + String(r.n).padStart(5) + '  ' + r.kind);

  await db.close();
});

test('a re-import adds no new categories and no repeated reviews', async () => {
  const db = await freshDb();
  const source = csv(
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    `15/07/2021,Bancolombia,To 'Renta Fija Plazo',"-500,000",COP,"-500,000",COP,Ingreso fondo`,
  );

  const first = await run(db, source);
  assert.ok(first.categoriesCreated > 0);
  assert.ok(first.reviewsRaised > 0);

  const reviewsAfterFirst = (await db.query('SELECT id FROM review_queue')).length;

  const second = await run(db, source);
  assert.equal(second.categoriesCreated, 0, 'the categories already existed');
  assert.equal(second.reviewsRaised, 0, 'the same doubts must not pile up');
  assert.equal((await db.query('SELECT id FROM review_queue')).length, reviewsAfterFirst);
  await db.close();
});

test('a limit increase is not treated as money arriving', async () => {
  const db = await freshDb();
  // The real shape: the card opens at its 2021 limit, and the increase is
  // logged as a deposit because Monefy has no other way to express it.
  const summary = await run(db, csv(
    `21/08/2021,Tarjeta crédito rappi,Initial balance 'Tarjeta crédito rappi',"800,000",COP,"800,000",COP,`,
    '22/08/2021,Tarjeta crédito rappi,Restaurante,"-500,000",COP,"-500,000",COP,Compras',
    '01/02/2023,Tarjeta crédito rappi,Depósitos,"200,000",COP,"200,000",COP,Aumento cupo',
    '10/11/2024,Tarjeta crédito rappi,Depósitos,"100,000",COP,"100,000",COP,Aumento cupo',
  ));

  assert.equal(summary.creditLimitChanges, 2);
  assert.equal(summary.rowsInserted, 1, 'only the purchase is a real movement');

  const accounts = new AccountsRepository(db, NOW);
  const card = await accounts.findByName('Tarjeta crédito rappi');
  const balance = await accounts.balance(card.id);

  // Believed as deposits, the two increases would have cut the debt to 200,000.
  assert.equal(balance.balance_minor, -50000000, 'the debt is the purchase alone');
  assert.equal(balance.available_credit_minor, 110000000 - 50000000);

  assert.equal((await db.query(`SELECT id FROM review_queue WHERE kind = 'credit_limit_change'`)).length, 2);
  // 800,000 + 200,000 + 100,000 is the configured 1,100,000, so no mismatch.
  assert.equal((await db.query(`SELECT id FROM review_queue WHERE kind = 'credit_limit_mismatch'`)).length, 0);
  await db.close();
});

test('a limit that disagrees with the file is reported', async () => {
  const db = await freshDb();
  await run(db, csv(
    `21/08/2021,Tarjeta crédito rappi,Initial balance 'Tarjeta crédito rappi',"800,000",COP,"800,000",COP,`,
    '01/02/2023,Tarjeta crédito rappi,Depósitos,"50,000",COP,"50,000",COP,Aumento cupo',
  ));

  // 800,000 + 50,000 is 850,000, not the configured 1,100,000.
  const mismatch = await db.queryOne(`SELECT reason FROM review_queue WHERE kind = 'credit_limit_mismatch'`);
  assert.ok(mismatch, 'the disagreement must be reported, not resolved silently');
  assert.match(mismatch.reason, /850\.000,00/);
  await db.close();
});
