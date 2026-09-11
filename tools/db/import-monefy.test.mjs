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
import { YieldsRepository } from '../../src/app/core/database/repositories/yields.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
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

test('the accounts Jose keeps out of net worth are excluded', async () => {
  const db = await freshDb();
  await run(db, csv(
    '10/04/2024,eToro,Depósitos,"1,000,000",COP,"1,000,000",COP,Inversión etoro 250 usd',
    '13/11/2024,XTB,Depósitos,"400,000",COP,"400,000",COP,Fondeo',
    '27/07/2026,Pibank para renta,Depósitos,"2,470,000",COP,"2,470,000",COP,Aparte para renta',
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
  ));

  const accounts = new AccountsRepository(db, NOW);
  const flags = Object.fromEntries(
    (await accounts.list()).map(a => [a.name, a.include_in_net_worth]),
  );

  // Monefy exports eight columns and none of them is this flag, so it can only
  // come from what Jose stated.
  assert.equal(flags['eToro'], 0);
  assert.equal(flags['XTB'], 0);
  assert.equal(flags['Pibank para renta'], 0);
  assert.equal(flags['Bancolombia'], 1);

  // Their money is still in the ledger; it just does not count in the total.
  assert.equal((await accounts.balance((await accounts.findByName('eToro')).id)).balance_minor !== 0, true);
  const netWorth = await accounts.netWorthMinor();
  assert.equal(netWorth, -5020000, 'only Bancolombia counts');
  await db.close();
});

test('re-importing corrects an account that was left counting', async () => {
  const db = await freshDb();
  const source = csv('10/04/2024,eToro,Depósitos,"1,000,000",COP,"1,000,000",COP,Inversión etoro 250 usd');
  await run(db, source);

  const accounts = new AccountsRepository(db, NOW);
  const etoro = await accounts.findByName('eToro');
  // Simulate a database imported before the flag was known.
  await db.run('UPDATE accounts SET include_in_net_worth = 1 WHERE id = ?', [etoro.id]);

  await run(db, source);

  const after = await accounts.findById(etoro.id);
  assert.equal(after.include_in_net_worth, 0,
    'the plan is the authority for this, so a re-import fixes it');
  await db.close();
});

test('a new movement in a foreign account arrives flagged, and old ones stay put', async () => {
  const db = await freshDb();

  // First import: the history as it stands.
  await run(db, csv(
    `13/08/2024,ARQ,Initial balance 'ARQ',"0",COP,"0",COP,`,
    '20/08/2024,ARQ,Ahorros,"1,000,000",COP,"1,000,000",COP,deposito 237 usd',
    '21/08/2024,Bancolombia,Restaurante,"-50,000",COP,"-50,000",COP,Almuerzo',
  ));

  const flagged = await db.query(
    `SELECT r.id, r.reason, t.description
     FROM review_queue r JOIN transactions t ON t.id = r.entity_id
     WHERE r.kind = 'foreign_new_movement'`);
  assert.equal(flagged.length, 1, 'the dollar row, not the peso one');
  assert.match(flagged[0].reason, /held in USD/);
  assert.match(flagged[0].description, /deposito 237 usd/);

  // Jose corrects the dollar figure by hand and closes the review.
  const arqRow = await db.queryOne(
    `SELECT t.id FROM transactions t JOIN accounts a ON a.id = t.account_id
     WHERE a.name = 'ARQ USD' AND t.description LIKE 'deposito%'`);
  await new TransactionsRepository(db, NOW).update(arqRow.id, { amount_minor: 23700 });
  await db.run('UPDATE review_queue SET resolved = 1, resolved_at = ? WHERE id = ?',
    [NOW(), flagged[0].id]);

  // A later export: the same rows again, plus one new dollar movement.
  await run(db, csv(
    `13/08/2024,ARQ,Initial balance 'ARQ',"0",COP,"0",COP,`,
    '20/08/2024,ARQ,Ahorros,"1,000,000",COP,"1,000,000",COP,deposito 237 usd',
    '21/08/2024,Bancolombia,Restaurante,"-50,000",COP,"-50,000",COP,Almuerzo',
    '09/09/2026,ARQ,Ahorros,"2,000,000",COP,"2,000,000",COP,otro deposito',
    '09/09/2026,Bancolombia,Restaurante,"-30,000",COP,"-30,000",COP,Cena',
  ));

  // The corrected row is exactly as it was left: not rewritten, not re-flagged.
  const corrected = await db.queryOne('SELECT amount_minor, locked FROM transactions WHERE id = ?', [arqRow.id]);
  assert.equal(corrected.amount_minor, 23700, 'the hand-corrected figure survives');
  assert.equal(corrected.locked, 1);

  const open = await db.query(
    `SELECT r.reason, t.description FROM review_queue r
     JOIN transactions t ON t.id = r.entity_id
     WHERE r.kind = 'foreign_new_movement' AND r.resolved = 0`);
  assert.equal(open.length, 1, 'only the new dollar movement');
  assert.equal(open[0].description, 'otro deposito');

  // And the new peso movement went in without ceremony.
  const cena = await db.queryOne("SELECT id FROM transactions WHERE description = 'Cena'");
  assert.ok(cena, 'the peso row was imported');
  assert.equal(
    (await db.query('SELECT id FROM review_queue WHERE entity_id = ? AND resolved = 0', [cena.id])).length,
    0, 'a peso row needs no review');

  await db.close();
});

test('a movement deleted by hand does not come back on the next import', async () => {
  const db = await freshDb();

  const rows = [
    `21/08/2021,Bancolombia,Initial balance 'Bancolombia',"100,000",COP,"100,000",COP,`,
    '22/08/2021,Bancolombia,Restaurante,"-50,000",COP,"-50,000",COP,Almuerzo',
    '23/08/2021,Bancolombia,Taxi,"-12,000",COP,"-12,000",COP,Carrera',
  ];
  await run(db, csv(...rows));

  const taxi = await db.queryOne("SELECT id FROM transactions WHERE description = 'Carrera'");
  assert.ok(taxi, 'it was imported');

  // Jose deletes it: it was a duplicate, or it never happened.
  await new TransactionsRepository(db, NOW).delete(taxi.id);
  assert.equal(
    (await db.queryOne("SELECT COUNT(*) n FROM transactions WHERE description = 'Carrera'")).n, 0);

  // The next export still carries it, as Monefy's exports always carry
  // everything. It must not return.
  const second = await run(db, csv(...rows,
    '09/09/2026,Bancolombia,Comida,"-30,000",COP,"-30,000",COP,Mercado'));

  assert.equal(
    (await db.queryOne("SELECT COUNT(*) n FROM transactions WHERE description = 'Carrera'")).n, 0,
    'the deleted movement stays deleted');

  // And the genuinely new row did arrive: this protects a decision, it does
  // not stop the import working.
  assert.ok(await db.queryOne("SELECT id FROM transactions WHERE description = 'Mercado'"));
  assert.equal(second.rowsInserted, 1, 'one new row, not two');

  // The decision can be undone, so nothing is permanent by accident.
  const transactions = new TransactionsRepository(db, NOW);
  const tomb = await db.queryOne('SELECT import_fingerprint f, import_seq s FROM deleted_imports');
  await transactions.forgetDeletion(tomb.f, tomb.s);

  await run(db, csv(...rows));
  assert.equal(
    (await db.queryOne("SELECT COUNT(*) n FROM transactions WHERE description = 'Carrera'")).n, 1,
    'forgetting the deletion lets it come back');

  await db.close();
});

test('an imported movement lands in the account usual product', async () => {
  // The Monefy file has no idea an account is split into products — that is a
  // thing this app knows and the file does not — so every row arrives in the
  // usual one, which is where money lands and leaves from by definition.
  //
  // The usual one is marked by the user, NOT the first in the list. Sort order
  // records only when each product was created, and Jose created his savings
  // products last, so "the first" is whichever alcancía happened to predate
  // them — and a re-imported history would have gone there.
  const db = await freshDb();
  await run(db, csv('26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi'));

  const accounts = new AccountsRepository(db, NOW);
  const banco = await accounts.findByName('Bancolombia');

  const yields = new YieldsRepository(db, NOW);
  await yields.enrol({
    account_id: banco.id, opening_cushion_minor: 0, opening_on: '2026-09-01',
  });
  const alcancia = await yields.addPocket({
    account_id: banco.id, name: 'Alcancía', source: 'manual', sort_order: 1 });
  const savings = await yields.addPocket({
    account_id: banco.id, name: 'Cuenta de ahorros', source: 'manual', sort_order: 2 });
  await yields.setDefaultPocket(banco.id, savings);

  await run(db, csv('27/06/2021,Bancolombia,Restaurante,"-12,000",COP,"-12,000",COP,Cena'));

  const row = await db.queryOne(
    "SELECT pocket_id FROM transactions WHERE description = 'Cena'");
  assert.equal(row.pocket_id, savings, 'the usual one, not the first');
  assert.notEqual(row.pocket_id, alcancia);

  await db.close();
});

test('a renamed account is still recognised by the name the backup uses', async () => {
  // Jose renamed "Tarjeta credito rappi" to "Rappi Card", and the next import
  // did not recognise it — the importer matches the exact name the file
  // carries — so it created a second account under the old name and put one
  // movement in it.
  //
  // Renaming is a normal thing to do, so this was a hole rather than a
  // mistake. Remembering the old name is what makes it survivable, and the
  // rename itself is what records it: nothing has to be remembered by hand.
  const db = await freshDb();
  await run(db, csv('26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi'));

  const accounts = new AccountsRepository(db, NOW);
  const banco = await accounts.findByName('Bancolombia');
  await accounts.update(banco.id, { name: 'Banco de Colombia' });

  const summary = await run(db, csv(
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    '27/06/2021,Bancolombia,Restaurante,"-12,000",COP,"-12,000",COP,Cena',
  ));

  assert.equal(summary.accountsCreated, 0, 'no second account under the old name');

  const all = await db.query("SELECT name FROM accounts WHERE name LIKE '%olombia%'");
  assert.equal(all.length, 1, 'still one account');
  assert.equal(all[0].name, 'Banco de Colombia');

  // And the new row went to it.
  const row = await db.queryOne("SELECT account_id FROM transactions WHERE description = 'Cena'");
  assert.equal(row.account_id, banco.id);

  await db.close();
});

test('the duplicate credit card is merged into the real one and removed', async () => {
  // Migration 023 found the surviving account by matching its name against
  // 'rappi card', which is a guess about spelling and did not hold. 024 does
  // not guess: the duplicate is the account the BACKUP names — a fact, since
  // it is the name in the file — and what it merges into is the other
  // credit-card account with the most movements. The account Jose has used for
  // years has thousands of rows; the one created by accident has one.
  // Built up to the migration BEFORE this one, so the duplicate exists when it
  // runs. `freshDb` applies everything, which would have 024 tidying an empty
  // database and finding nothing to do.
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES.slice(0, 23));

  const accounts = new AccountsRepository(db, NOW);
  const card = await accounts.create({
    name: 'Rappi Card', type: 'credit', currency_code: 'COP',
    builtin_icon: 'card', credit_limit_minor: 110_000_000, opened_on: '2021-06-25',
  });
  const duplicate = await accounts.create({
    name: 'Tarjeta crédito rappi', type: 'credit', currency_code: 'COP',
    builtin_icon: 'card', credit_limit_minor: 110_000_000, opened_on: '2021-06-25',
  });

  const categories = new CategoriesRepository(db, NOW);
  const comida = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'cart' });
  const transactions = new TransactionsRepository(db, NOW);

  // The real card has history; the duplicate has the one row the import made.
  for (const day of ['2026-08-01', '2026-08-02', '2026-08-03']) {
    await transactions.create({
      account_id: card, category_id: comida, occurred_on: day,
      amount_minor: -10_000, source: 'monefy', import_fingerprint: `f-${day}`, import_seq: 1,
    });
  }
  await transactions.create({
    account_id: duplicate, category_id: comida, occurred_on: '2026-09-09',
    amount_minor: -25_000, source: 'monefy', import_fingerprint: 'f-new', import_seq: 1,
  });

  await migrate(db, MIGRATION_SOURCES);

  const left = await db.query("SELECT name FROM accounts WHERE type = 'credit'");
  assert.deepEqual(left.map(row => row.name), ['Rappi Card'], 'the duplicate is gone');

  // Moved, not deleted: deleting would take its fingerprint with it, and the
  // next import would meet the row as new and make the account all over again.
  const moved = await db.queryOne(
    "SELECT account_id FROM transactions WHERE import_fingerprint = 'f-new'");
  assert.equal(moved.account_id, card);

  // And the backup's name now points at the account that survived.
  const alias = await db.queryOne(
    "SELECT account_id FROM account_aliases WHERE source_name LIKE 'Tarjeta cr%dito rappi'");
  assert.equal(alias.account_id, card);

  await db.close();
});

test('the account goes even with nowhere to move its movements', async () => {
  // The case both earlier attempts left standing. Each only acted if another
  // condition held — a name spelled a certain way, another credit account to
  // move rows to — and when it did not, nothing happened and nothing said so.
  //
  // Here there is no other credit card at all, so there is nowhere to move
  // the movement to. The account still goes, and the fingerprint of the row
  // that goes with it is recorded as deleted, which is what stops the next
  // import meeting that row as new and building the account all over again.
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES.slice(0, 24));

  const accounts = new AccountsRepository(db, NOW);
  const orphan = await accounts.create({
    name: 'Tarjeta crédito rappi', type: 'credit', currency_code: 'COP',
    builtin_icon: 'card', credit_limit_minor: 110_000_000, opened_on: '2021-06-25',
  });
  const categories = new CategoriesRepository(db, NOW);
  const comida = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'cart' });
  await new TransactionsRepository(db, NOW).create({
    account_id: orphan, category_id: comida, occurred_on: '2026-09-09',
    amount_minor: -25_000, source: 'monefy',
    import_fingerprint: 'f-alone', import_seq: 1,
  });

  await migrate(db, MIGRATION_SOURCES);

  assert.equal(
    (await db.query("SELECT id FROM accounts WHERE name = 'Tarjeta crédito rappi'")).length, 0,
    'gone, with no conditions attached');

  const skipped = await db.queryOne(
    "SELECT import_seq FROM deleted_imports WHERE import_fingerprint = 'f-alone'");
  assert.equal(skipped.import_seq, 1, 'and the next import will not bring it back');

  await db.close();
});
