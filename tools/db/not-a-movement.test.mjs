// "No es un movimiento" (Jose, 2026-10-14, mockups 24a-24d): a message the
// person says is not a movement teaches its source - never the whole app -
// and is not offered again. Since 2026-10-29 no source is "strict": the word
// book (word-book.test.mjs) learns what else is an advert. Every shop,
// sender and message invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/not-a-movement.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { ProposalsRepository } from '../../src/app/core/database/repositories/proposals.repository.ts';
import {
  fitsNotMold, learnNotMovement, moldFrom, quietForPhone, silencedBy, sourceNames, unlearnNotMovement,
} from '../../src/app/core/notices/molds.ts';
import { readNotices } from '../../src/app/core/notices/notice-proposals.ts';
import { saysItHappened } from '../../src/app/core/notices/read-notice.ts';
import { buildWordBook } from '../../src/app/core/notices/word-book.ts';


const NOW = () => '2026-10-14T15:00:00Z';
const AT = Date.parse('2026-10-14T14:00:00');
const APP = 'com.tienda.sol';
const empty = { notMolds: [], strict: [] };
const ADVERT = 'Hamburguesa doble a $24.900, llévala hoy y recíbela en 20 minutos';

test('the shape of a message that is not a movement fits it again with other figures, from that source only', () => {
  const quiet = learnNotMovement(empty, APP, ADVERT, 1);
  assert.equal(quiet.notMolds.length, 1);
  assert.ok(fitsNotMold(APP, 'Hamburguesa doble a $19.900, llévala hoy y recíbela en 35 minutos', quiet.notMolds));
  assert.ok(fitsNotMold(APP, ADVERT.toUpperCase(), quiet.notMolds), 'case and accents do not matter');
  assert.ok(!fitsNotMold('com.otra.app', ADVERT, quiet.notMolds), 'another source learns nothing');
  assert.ok(!fitsNotMold(APP, 'Pagaste $18.500 en Tienda Sol con tu billetera', quiet.notMolds));
  assert.equal(silencedBy(APP, ADVERT, quiet, [], false), 'taught');
  // The same message marked twice is one shape.
  assert.equal(learnNotMovement(quiet, APP, ADVERT, 2).notMolds.length, 1);
});

test('no answer makes a source strict any more; a purchase from it is always offered', () => {
  let quiet = learnNotMovement(empty, APP, ADVERT, 1);
  quiet = learnNotMovement(quiet, APP, 'Combo familiar a $49.900, solo esta noche', 2);
  assert.deepEqual(quiet.strict, []);
  const bought = 'Tu compra en Tienda Sol por $ 18.500 fue exitosa';
  assert.equal(silencedBy(APP, bought, quiet, [], saysItHappened(bought), buildWordBook([])), null);
  // A shape the person SAVED passes whatever the book says.
  const shaped = 'Tx 45.900 COP comercio TIENDA SOL ok';
  const mold = moldFrom({ source: APP, text: shaped, amountMinor: -4590000, merchant: 'TIENDA SOL', accountId: 1, categoryId: null, at: 1 });
  assert.equal(silencedBy(APP, 'Tx 12.000 COP comercio PAN ok', quiet, [mold], false), null);
});

test('"Sí era un movimiento" forgets the shapes it fits and keeps it as a movement', () => {
  let quiet = learnNotMovement(empty, APP, ADVERT, 1);
  quiet = learnNotMovement(quiet, APP, 'Combo familiar a $49.900, solo esta noche', 2);
  quiet = learnNotMovement(quiet, 'com.otra.app', ADVERT, 3);
  quiet = unlearnNotMovement(quiet, APP, ADVERT, 4);
  assert.equal(quiet.notMolds.filter(one => one.source === APP).length, 1);
  assert.equal(quiet.notMolds.filter(one => one.source === 'com.otra.app').length, 1);
  assert.deepEqual(quiet.moves.map(one => one.source), [APP]);
  assert.equal(silencedBy(APP, ADVERT, quiet, [], false), null);
  // Marked "No es un movimiento" again: no longer kept as a movement.
  assert.deepEqual(learnNotMovement(quiet, APP, ADVERT, 5).moves, []);
});

test('the phone receives shapes and word weights, never a message', () => {
  const quiet = learnNotMovement(empty, APP, ADVERT, 1);
  const handed = JSON.parse(quietForPhone(quiet, [], {}, buildWordBook([{ source: APP, text: ADVERT, move: false }])));
  assert.deepEqual(Object.keys(handed).sort(), ['book', 'molds', 'names', 'notMolds']);
  assert.deepEqual(handed.names, {});
  assert.deepEqual(Object.keys(handed.notMolds[0]).sort(), ['pattern', 'source']);
  // Java reads the same patterns: no flags, no lookbehind, anchored.
  assert.match(handed.notMolds[0].pattern, /^\^.*\$$/);
  // The book holds words, never a figure.
  assert.ok(!JSON.stringify(handed.book).match(/\d{3}/));
});

test('the phone is told each source by its account, never a sender with no account', () => {
  const assigned = new Map([['com.banco.rojo', 3], ['sms|89123', 4], ['sms|55555', 0], ['com.app.ida', 99]]);
  const accounts = [{ id: 3, name: 'Banco Rojo' }, { id: 4, name: 'Billetera Verde' }];
  // "Varias cuentas" (0) and an account gone name nothing: the notice says it in words.
  assert.deepEqual(sourceNames(assigned, accounts), { 'com.banco.rojo': 'Banco Rojo', 'sms|89123': 'Billetera Verde' });
  const handed = JSON.parse(quietForPhone(empty, [], sourceNames(assigned, accounts)));
  assert.equal(handed.names['sms|89123'], 'Billetera Verde');
});

test('end to end: marked once, the message goes and its like is never offered; undo puts both back', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const proposals = new ProposalsRepository(db, NOW);
  await accounts.create({ name: 'Billetera Sol', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const note = (text, at) => ({ package: APP, app: 'Tienda Sol', title: 'Tienda Sol', text, postedAt: at });
  const run = async kept => {
    const { fresh } = readNotices(kept, await proposals.noticeKeys(), await proposals.noticeAnswers(), await accounts.list(),
      await proposals.recentNotices(), { molds: await proposals.molds(), assigned: await proposals.sourceAccounts(), quiet: await proposals.quiet() });
    const ids = [];
    for (const one of fresh) ids.push(...(await proposals.propose(one.batch, [one.proposal])).ids);
    return ids;
  };

  // An advert the shape reader cannot tell from a purchase.
  const first = note('Hamburguesa doble $24.900 hoy en Tienda Sol', AT);
  const [id] = await run([first]);
  assert.ok(id, 'proposed at first');
  const { source, before } = await proposals.notAMovement(id);
  assert.equal(source, APP);
  assert.equal((await proposals.byId(id)).status, 'rejected');

  // The same shape with another price is never offered; a purchase still is.
  const later = await run([first, note('Hamburguesa doble $19.900 hoy en Tienda Sol', AT + 60_000),
    note('Pagaste $18.500 en Tienda Sol', AT + 120_000)]);
  assert.equal(later.length, 1);
  assert.equal((await proposals.byId(later[0])).amount_minor, -1850000);

  // "Deshacer": as it was, and the proposal waits again.
  await proposals.undoNotAMovement(id, before);
  assert.equal((await proposals.byId(id)).status, 'pending');
  assert.deepEqual(await proposals.quiet(), before);

  // Marked again, then "Sí era un movimiento" from the source's page.
  await proposals.notAMovement(id);
  await proposals.isAMovement(APP, first.text, id);
  assert.equal((await proposals.byId(id)).status, 'pending');
  assert.equal((await proposals.quiet()).notMolds.length, 0);

  // From the phone's notice: learned without a proposal ever existing.
  await proposals.notMovementsFromPhone([{ source: APP, text: 'Combo familiar a $49.900 hoy', at: AT }]);
  assert.equal(await run([note('Combo familiar a $39.900 hoy', AT + 180_000)]).then(ids => ids.length), 0);
});
