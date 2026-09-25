// Movements the app proposes, and the two questions asked before anyone sees
// them.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/proposals.test.mjs
//
// The point of every test here is the same: nothing reaches the ledger by
// itself, and what the app says about a reading has to be checkable. Rule 22.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { ProposalsRepository } from '../../src/app/core/database/repositories/proposals.repository.ts';
import { merchantKeyOf } from '../../src/app/core/proposals/merchant.ts';
import { sameMovementAs, transferPairs } from '../../src/app/core/proposals/matching.ts';
import { accept, isComplete } from '../../src/app/core/proposals/accept.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';

const NOW = () => '2026-09-23T12:00:00Z';

async function setup() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const transactions = new TransactionsRepository(db, NOW);
  const proposals = new ProposalsRepository(db, NOW);

  const rappi = await accounts.create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP',
    builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2025-01-01',
  });
  const nu = await accounts.create({
    name: 'Nu', type: 'debit', currency_code: 'COP',
    builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2025-01-01',
  });
  const mercados = await categories.create({ name: 'Mercados', kind: 'expense', builtin_icon: 'cart' });
  const restaurante = await categories.create({ name: 'Restaurante', kind: 'expense', builtin_icon: 'restaurant' });

  const transfers = new TransfersRepository(db, NOW);

  return { db, accounts, categories, transactions, transfers, proposals, rappi, nu, mercados, restaurante };
}

// ---------------------------------------------------------------------------
// The merchant behind a description
// ---------------------------------------------------------------------------

test('the same shop is one merchant however the bank words it', () => {
  const one = merchantKeyOf('Compra por $45.000 en EXITO POBLADO 1234');
  assert.equal(merchantKeyOf('COMPRA EXITO POBLADO ref 998877'), one);
  assert.equal(merchantKeyOf('Éxito Poblado'), one);
  assert.equal(one, 'EXITO POBLADO');
});

test('a description with nothing but noise is not remembered', () => {
  assert.equal(merchantKeyOf('Compra aprobada con su tarjeta 4321'), '');
  assert.equal(merchantKeyOf(''), '');
  assert.equal(merchantKeyOf(null), '');
});

// ---------------------------------------------------------------------------
// Is this already in the ledger?
// ---------------------------------------------------------------------------

test('the same purchase read twice is recognised across its two dates and two names', () => {
  const ledger = [{
    id: 7, account_id: 1, occurred_on: '2026-09-10', amount_minor: -4_500_000,
    description: 'EXITO POBLADO',
  }];
  const reading = {
    account_id: 1, occurred_on: '2026-09-12', amount_minor: -4_500_000,
    description: 'COMPRA EXITO POB 123',
  };
  assert.equal(sameMovementAs(reading, ledger), 7);
});

test('a peso apart is a different movement', () => {
  const ledger = [{
    id: 7, account_id: 1, occurred_on: '2026-09-10', amount_minor: -4_500_000, description: 'EXITO',
  }];
  assert.equal(sameMovementAs(
    { account_id: 1, occurred_on: '2026-09-10', amount_minor: -4_500_100, description: 'EXITO' },
    ledger), null);
});

test('a week apart is a different movement, and another account always is', () => {
  const ledger = [{
    id: 7, account_id: 1, occurred_on: '2026-09-10', amount_minor: -4_500_000, description: 'EXITO',
  }];
  assert.equal(sameMovementAs(
    { account_id: 1, occurred_on: '2026-09-20', amount_minor: -4_500_000, description: 'EXITO' },
    ledger), null);
  assert.equal(sameMovementAs(
    { account_id: 2, occurred_on: '2026-09-10', amount_minor: -4_500_000, description: 'EXITO' },
    ledger), null);
});

test('two identical fares on one day are two movements, not one claimed twice', () => {
  const ledger = [
    { id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -260_000, description: 'BUS' },
    { id: 2, account_id: 1, occurred_on: '2026-09-10', amount_minor: -260_000, description: 'BUS' },
  ];
  const reading = { account_id: 1, occurred_on: '2026-09-10', amount_minor: -260_000, description: 'BUS' };

  const first = sameMovementAs(reading, ledger);
  assert.equal(first, 1);
  assert.equal(sameMovementAs(reading, ledger, new Set([first])), 2);
  assert.equal(sameMovementAs(reading, ledger, new Set([1, 2])), null, 'and no third one appears');
});

test('the merchant decides between two movements of the same amount', () => {
  const ledger = [
    { id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -50_000, description: 'RAPPI' },
    { id: 2, account_id: 1, occurred_on: '2026-09-11', amount_minor: -50_000, description: 'EXITO POBLADO' },
  ];
  const reading = {
    account_id: 1, occurred_on: '2026-09-09', amount_minor: -50_000, description: 'COMPRA EXITO POBLADO 77',
  };
  assert.equal(sameMovementAs(reading, ledger), 2, 'the nearer date loses to the same shop');
});

test('a reading missing its amount or its account asks nothing', () => {
  const ledger = [{ id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -1, description: null }];
  assert.equal(sameMovementAs({ account_id: 1, occurred_on: '2026-09-10', amount_minor: null, description: null }, ledger), null);
  assert.equal(sameMovementAs({ account_id: null, occurred_on: '2026-09-10', amount_minor: -1, description: null }, ledger), null);
});

// ---------------------------------------------------------------------------
// Is this half of a transfer?
// ---------------------------------------------------------------------------

test('money leaving one account and arriving in another is one transfer', () => {
  const pairs = transferPairs([
    { id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -200_000_00, description: 'Envio a Nu' },
    { id: 2, account_id: 2, occurred_on: '2026-09-10', amount_minor: 200_000_00, description: 'Recibido de Rappi' },
  ]);
  assert.deepEqual(pairs, [[1, 2]]);
});

test('the same figure spent and received in one account is not a transfer', () => {
  assert.deepEqual(transferPairs([
    { id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -50_000, description: 'Gasto' },
    { id: 2, account_id: 1, occurred_on: '2026-09-11', amount_minor: 50_000, description: 'Ingreso' },
  ]), []);
});

test('a salary arriving in two accounts does not pair with a payment of its size', () => {
  const pairs = transferPairs([
    { id: 1, account_id: 1, occurred_on: '2026-09-10', amount_minor: -1_000_000_00, description: 'Arriendo' },
    { id: 2, account_id: 2, occurred_on: '2026-09-10', amount_minor: 1_000_000_00, description: 'Nomina' },
    { id: 3, account_id: 3, occurred_on: '2026-09-10', amount_minor: 1_000_000_00, description: 'Nomina' },
  ]);
  assert.equal(pairs.length, 1, 'one pair at most, never two claims on the same row');
  assert.equal(pairs[0][0], 1);
});

// ---------------------------------------------------------------------------
// Against a real database
// ---------------------------------------------------------------------------

test('a proposal is not a movement until somebody says so', async () => {
  const { db, proposals, transactions, rappi } = await setup();

  await proposals.propose('extracto-1', [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-10',
    amount_minor: -45_000_00, description: 'EXITO POBLADO',
    evidence: { line: '10/09 EXITO POBLADO 45.000,00' },
  }]);

  assert.equal((await transactions.list()).length, 0, 'nothing reached the ledger');
  const [waiting] = await proposals.pending();
  assert.equal(waiting.status, 'pending');
  assert.equal(waiting.amount_minor, -45_000_00);
  assert.equal(JSON.parse(waiting.evidence).line, '10/09 EXITO POBLADO 45.000,00',
    'and what it was read from is still there');
  await db.close();
});

test('a category learned once is proposed the next time', async () => {
  const { db, proposals, mercados, rappi } = await setup();

  await proposals.learn('Compra EXITO POBLADO 998', mercados, '2026-09-01');
  await proposals.propose('extracto-1', [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-10',
    amount_minor: -45_000_00, description: 'EXITO POBLADO ref 4412', evidence: {},
  }]);

  const [waiting] = await proposals.pending();
  assert.equal(waiting.category_id, mercados);
  assert.equal(waiting.category_from, 'learned');
  await db.close();
});

test('teaching it something else replaces the answer rather than arguing', async () => {
  const { db, proposals, mercados, restaurante } = await setup();

  await proposals.learn('EXITO POBLADO', mercados, '2026-09-01');
  await proposals.learn('EXITO POBLADO', mercados, '2026-09-02');
  await proposals.learn('EXITO POBLADO', restaurante, '2026-09-03');

  assert.equal(await proposals.learnedCategoryOf('exito poblado'), restaurante);
  const [row] = await proposals.learned();
  assert.equal(row.times, 1, 'the count starts again on a change of mind');
  await db.close();
});

test('it learns from the movements already typed in, and never overrules the person', async () => {
  const { db, proposals, transactions, rappi, mercados, restaurante } = await setup();

  // Somebody's own history: the same shop filed the same way most of the time.
  for (const [on, category] of [
    ['2026-06-01', mercados], ['2026-07-01', mercados],
    ['2026-08-01', restaurante], ['2026-08-15', mercados],
  ]) {
    await transactions.create({
      account_id: rappi, category_id: category, occurred_on: on,
      amount_minor: -50_000, description: 'COMPRA EXITO POBLADO 998', source: 'manual',
    });
  }
  // And one the person has already answered for by hand.
  await transactions.create({
    account_id: rappi, category_id: mercados, occurred_on: '2026-08-20',
    amount_minor: -10_000, description: 'RAPPI COLOMBIA', source: 'manual',
  });
  await proposals.learn('RAPPI COLOMBIA', restaurante, '2026-08-20');

  const learned = await proposals.learnFromLedger();

  assert.ok(learned >= 1);
  assert.equal(await proposals.learnedCategoryOf('COMPRA EXITO POB 4471'), mercados,
    'the category it was filed under most often');
  assert.equal(await proposals.learnedCategoryOf('RAPPI COL BOG'), restaurante,
    'and what the person taught is left alone');
  await db.close();
});

test('a reading the ledger may already hold is flagged, and not skipped', async () => {
  const { db, proposals, transactions, rappi, mercados } = await setup();

  const already = await transactions.create({
    account_id: rappi, category_id: mercados, occurred_on: '2026-09-10',
    amount_minor: -45_000_00, description: 'EXITO POBLADO', source: 'manual',
  });

  await proposals.propose('extracto-1', [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-12',
    amount_minor: -45_000_00, description: 'COMPRA EXITO POB 123', evidence: {},
  }]);

  const [waiting] = await proposals.pending();
  assert.equal(waiting.maybe_same_as, already, 'it says which movement it may be');
  assert.equal(waiting.status, 'pending', 'and still waits for a person');
  await db.close();
});

test('the two halves of a transfer find each other', async () => {
  const { db, proposals, rappi, nu } = await setup();

  const { ids: [out, into] } = await proposals.propose('extracto-1', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-10', amount_minor: -200_000_00,
      description: 'Envio a Nu', evidence: {} },
    { source: 'statement', account_id: nu, occurred_on: '2026-09-10', amount_minor: 200_000_00,
      description: 'De Rappi', evidence: {} },
  ]);

  assert.equal((await proposals.byId(out)).pairs_with, into);
  assert.equal((await proposals.byId(into)).pairs_with, out);
  await db.close();
});

test('a rejected reading stays rejected, and the count only sees what waits', async () => {
  const { db, proposals, rappi } = await setup();

  const { ids: [one, two] } = await proposals.propose('extracto-1', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-10', amount_minor: -1_000_00,
      description: 'Uno', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-11', amount_minor: -2_000_00,
      description: 'Dos', evidence: {} },
  ]);

  assert.equal(await proposals.pendingCount(), 2);
  await proposals.reject(one);
  assert.equal(await proposals.pendingCount(), 1);
  assert.equal((await proposals.byId(one)).status, 'rejected');
  assert.equal((await proposals.pending())[0].id, two);
  await db.close();
});

test('a notification nobody could read still arrives, saying so', async () => {
  const { db, proposals } = await setup();

  await proposals.propose('avisos-1', [{
    source: 'notification', account_id: null, occurred_on: '2026-09-23',
    amount_minor: null, description: null,
    evidence: { package: 'com.banco.app', text: 'Tienes un nuevo movimiento' },
  }]);

  const [waiting] = await proposals.pending();
  assert.equal(waiting.amount_minor, null);
  assert.equal(waiting.account_id, null);
  assert.equal(JSON.parse(waiting.evidence).package, 'com.banco.app',
    'the person is told which app it came from, and types the rest');
  await db.close();
});

// ---------------------------------------------------------------------------
// Accepting one
// ---------------------------------------------------------------------------

test('accepting a proposal writes an ordinary movement, and teaches the app', async () => {
  const { db, proposals, transactions, transfers, rappi, mercados } = await setup();

  const { ids: [id] } = await proposals.propose('extracto-1', [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-10',
    amount_minor: -45_000_00, description: 'COMPRA EXITO POBLADO 4471', evidence: {},
  }]);
  await proposals.correct(id, { category_id: mercados });

  const result = await accept({ proposals, transactions, transfers },
    [await proposals.byId(id)]);

  assert.equal(result.written, 1);
  const [movement] = await transactions.list();
  assert.equal(movement.amount_minor, -45_000_00);
  assert.equal(movement.category_id, mercados);
  assert.equal(movement.description, 'COMPRA EXITO POBLADO 4471');
  assert.equal(movement.source, 'manual', 'a movement like any other afterwards');

  assert.equal((await proposals.byId(id)).status, 'accepted');
  assert.equal((await proposals.byId(id)).transaction_id, movement.id);
  assert.equal(await proposals.learnedCategoryOf('EXITO POB 99'), mercados,
    'and the shop is remembered for the next one');
  await db.close();
});

test('the two halves of a transfer are accepted as one transfer', async () => {
  const { db, proposals, transactions, transfers, rappi, nu } = await setup();

  const { ids } = await proposals.propose('extracto-1', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-10', amount_minor: -200_000_00,
      description: 'Envio a Nu', evidence: {} },
    { source: 'statement', account_id: nu, occurred_on: '2026-09-10', amount_minor: 200_000_00,
      description: 'De Rappi', evidence: {} },
  ]);
  const both = await Promise.all(ids.map(id => proposals.byId(id)));

  const result = await accept({ proposals, transactions, transfers }, both);

  assert.equal(result.written, 1, 'one transfer, not two movements');
  const movements = await transactions.list();
  assert.equal(movements.length, 2, 'which is two legs');
  assert.ok(movements.every(movement => movement.transfer_id !== null));
  assert.ok(both.every(async proposal => (await proposals.byId(proposal.id)).status === 'accepted'));
  await db.close();
});

test('a reading that is still missing something is refused, not written half-formed', async () => {
  const { db, proposals, transactions, transfers } = await setup();

  const { ids: [id] } = await proposals.propose('avisos-1', [{
    source: 'notification', account_id: null, occurred_on: '2026-09-23',
    amount_minor: null, description: null, evidence: { text: 'Tienes un nuevo movimiento' },
  }]);
  const proposal = await proposals.byId(id);
  assert.equal(isComplete(proposal), false);

  const result = await accept({ proposals, transactions, transfers }, [proposal]);

  assert.equal(result.written, 0);
  assert.deepEqual(result.refused, [{ id, reason: 'incomplete' }]);
  assert.equal((await transactions.list()).length, 0);
  assert.equal((await proposals.byId(id)).status, 'pending', 'and it is still waiting');
  await db.close();
});

test('the same statement imported twice does not ask everything again', async () => {
  const { db, proposals, rappi } = await setup();
  const statement = [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-10', amount_minor: -45_000_00,
      description: 'COMPRA EXITO POBLADO', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-11', amount_minor: -30_000_00,
      description: 'COMPRA RAPPI', evidence: {} },
  ];

  const first = await proposals.propose('extracto.pdf 1', statement);
  assert.equal(first.ids.length, 2);
  assert.equal(first.knownAlready, 0);

  // Jose did this within a minute of the screen existing, and saw every row
  // twice with two sets of buttons.
  const again = await proposals.propose('extracto.pdf 2', statement);
  assert.equal(again.ids.length, 0);
  assert.equal(again.knownAlready, 2);
  assert.equal(await proposals.pendingCount(), 2, 'still two questions, not four');

  // And what was thrown away stays thrown away: a rejection that a second
  // import undoes is not a rejection.
  await proposals.reject(first.ids[0]);
  const third = await proposals.propose('extracto.pdf 3', statement);
  assert.equal(third.ids.length, 0);
  assert.equal(await proposals.pendingCount(), 1);
  await db.close();
});

test('two identical charges in one statement stay two questions', async () => {
  const { db, proposals, rappi } = await setup();
  const twice = {
    source: 'statement', account_id: rappi, occurred_on: '2026-09-10',
    amount_minor: -260_000, description: 'BUS', evidence: {},
  };

  const proposed = await proposals.propose('extracto.pdf', [twice, { ...twice }]);
  assert.equal(proposed.ids.length, 2, 'the same fare twice in one day is two fares');
  assert.equal(proposed.knownAlready, 0);
  await db.close();
});

test('taking a batch off the screen is not the same as throwing it away', async () => {
  const { db, proposals, rappi } = await setup();
  const statement = [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-10',
    amount_minor: -45_000_00, description: 'COMPRA EXITO POBLADO', evidence: {},
  }];

  await proposals.propose('extracto.pdf 1', statement);
  assert.equal(await proposals.forget('extracto.pdf 1'), 1);
  assert.equal(await proposals.pendingCount(), 0, 'off the screen');

  // Nothing was decided, so the same statement says it again. That is the
  // whole difference from discarding, which is remembered.
  const again = await proposals.propose('extracto.pdf 2', statement);
  assert.equal(again.ids.length, 1);
  assert.equal(await proposals.pendingCount(), 1);
  await db.close();
});

test('forgetting leaves what was already answered alone', async () => {
  const { db, proposals, transactions, transfers, rappi, mercados } = await setup();
  const { ids } = await proposals.propose('extracto.pdf', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-10', amount_minor: -1_000_00,
      description: 'UNO', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-11', amount_minor: -2_000_00,
      description: 'DOS', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-12', amount_minor: -3_000_00,
      description: 'TRES', evidence: {} },
  ]);
  await proposals.correct(ids[0], { category_id: mercados });
  await accept({ proposals, transactions, transfers }, [await proposals.byId(ids[0])]);
  await proposals.reject(ids[1]);

  assert.equal(await proposals.forget('extracto.pdf'), 1, 'only the one still waiting');
  assert.equal((await proposals.byId(ids[0])).status, 'accepted');
  assert.equal((await proposals.byId(ids[1])).status, 'rejected');
  assert.equal(await proposals.byId(ids[2]), null);
  await db.close();
});

test('a movement with no category is refused, because the schema says so', async () => {
  const { db, proposals, transactions, transfers, rappi } = await setup();

  // "RETIRO CAJERO" is nobody's shop, so nothing was learned for it and no
  // category was proposed. Written as it stands it fails at the database -
  // `(transfer_id IS NULL) = (category_id IS NOT NULL)` - which is the last
  // place a person pressing save should meet a failure.
  const { ids: [id] } = await proposals.propose('extracto.pdf', [{
    source: 'statement', account_id: rappi, occurred_on: '2026-09-16',
    amount_minor: -300_000_00, description: 'RETIRO CAJERO CC SANTAFE', evidence: {},
  }]);

  const refused = await accept({ proposals, transactions, transfers }, [await proposals.byId(id)]);
  assert.equal(refused.written, 0);
  assert.deepEqual(refused.refused, [{ id, reason: 'incomplete' }]);
  assert.equal((await transactions.list()).length, 0);
});

test('a shop that repeats is answered once, for all of its movements', async () => {
  const { db, proposals, rappi, mercados } = await setup();

  await proposals.propose('extracto.pdf', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-02', amount_minor: -20_000_00,
      description: 'COMPRA EXITO POBLADO 4471', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-14', amount_minor: -35_000_00,
      description: 'COMPRA EXITO POBLADO 8812', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-22', amount_minor: -12_000_00,
      description: 'COMPRA EXITO POBLADO', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-25', amount_minor: -44_900_00,
      description: 'COMPRA NETFLIX COM', evidence: {} },
  ]);

  const filed = await proposals.fileAllAs('EXITO POBLADO', mercados);
  assert.equal(filed, 3, 'the three visits to the same shop, whatever the receipt number');

  const waiting = await proposals.pending();
  assert.equal(waiting.filter(one => one.category_id === mercados).length, 3);
  assert.equal(waiting.find(one => one.description.includes('NETFLIX')).category_id, null,
    'and nothing else was touched');

  // And it was learned, so the next statement proposes it without asking.
  assert.equal(await proposals.learnedCategoryOf('EXITO POBLADO CALLE 10'), mercados);
  await db.close();
});

test('several chosen by hand are filed or rejected together, and only those', async () => {
  const { db, proposals, rappi, mercados } = await setup();

  const { ids } = await proposals.propose('extracto.pdf', [
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-02', amount_minor: -20_000_00,
      description: 'COMPRA TIENDA UNO', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-03', amount_minor: -30_000_00,
      description: 'COMPRA OTRA TIENDA', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-04', amount_minor: -40_000_00,
      description: 'PAGO SERVICIO', evidence: {} },
    { source: 'statement', account_id: rappi, occurred_on: '2026-09-05', amount_minor: -50_000_00,
      description: 'COMPRA LEJANA', evidence: {} },
  ]);

  assert.equal(await proposals.fileThese([ids[0], ids[1]], mercados), 2, 'two shops, one answer');
  let waiting = await proposals.pending();
  assert.deepEqual(waiting.filter(one => one.category_id === mercados).map(one => one.id), [ids[0], ids[1]]);
  assert.equal(waiting.find(one => one.id === ids[0]).category_from, 'typed');

  assert.equal(await proposals.rejectThese([ids[1], ids[2]]), 2);
  waiting = await proposals.pending();
  assert.deepEqual(waiting.map(one => one.id), [ids[0], ids[3]], 'the other two are still waiting');

  // A rejected one is not pending, so neither method reaches it again.
  assert.equal(await proposals.fileThese([ids[1]], mercados), 0);
  assert.equal(await proposals.rejectThese([]), 0);
  await db.close();
});

// ---------------------------------------------------------------------------
// Squaring an account with its statement
// ---------------------------------------------------------------------------

test('the opening balance takes the history nobody typed in', async () => {
  const { db, accounts, transactions, rappi, mercados } = await setup();

  // An account made in this app at zero, given one month of statement: three
  // movements, and a bank that says it held four million at the end of it.
  for (const [on, amount] of [['2026-09-02', -200_000], ['2026-09-10', -300_000], ['2026-09-28', 1_000_000]]) {
    await transactions.create({
      account_id: rappi, category_id: mercados, occurred_on: on,
      amount_minor: amount, source: 'manual',
    });
  }
  assert.equal(await accounts.balanceOn(rappi, '2026-09-30'), 500_000, 'one month of it');

  const opening = await accounts.squareWith(rappi, '2026-09-30', 4_000_000);

  assert.equal(opening, 3_500_000, 'the years before it, which is what was missing');
  assert.equal(await accounts.balanceOn(rappi, '2026-09-30'), 4_000_000, 'and now it says what the bank says');
  await db.close();
});

test('squaring again after an older statement lands right, not twice', async () => {
  const { db, accounts, transactions, rappi, mercados } = await setup();

  await transactions.create({
    account_id: rappi, category_id: mercados, occurred_on: '2026-09-10',
    amount_minor: -500_000, source: 'manual',
  });
  await accounts.squareWith(rappi, '2026-09-30', 4_000_000);

  // August arrives later and its movements are accepted too.
  await transactions.create({
    account_id: rappi, category_id: mercados, occurred_on: '2026-08-15',
    amount_minor: -1_200_000, source: 'manual',
  });
  const opening = await accounts.squareWith(rappi, '2026-09-30', 4_000_000);

  assert.equal(opening, 5_700_000, 'the opening figure gave up exactly what August explained');
  assert.equal(await accounts.balanceOn(rappi, '2026-09-30'), 4_000_000, 'and the balance never moved');
  await db.close();
});

test('movements after the statement are not a disagreement with it', async () => {
  const { db, accounts, transactions, rappi, mercados } = await setup();

  await accounts.squareWith(rappi, '2026-09-30', 4_000_000);
  await transactions.create({
    account_id: rappi, category_id: mercados, occurred_on: '2026-10-05',
    amount_minor: -150_000, source: 'manual',
  });

  assert.equal(await accounts.balanceOn(rappi, '2026-09-30'), 4_000_000, 'the statement still agrees');
  assert.equal(await accounts.balanceOn(rappi, '2026-10-31'), 3_850_000, 'and October is October');
  await db.close();
});
