// A bank's message becomes a proposal, and the app learns from what the
// person answers (rule 22; Jose, 2026-10-02). Every app, account and message
// here is invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/notice-proposals.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { TransfersRepository } from '../../src/app/core/database/repositories/transfers.repository.ts';
import { ProposalsRepository } from '../../src/app/core/database/repositories/proposals.repository.ts';
import { accept } from '../../src/app/core/proposals/accept.ts';
import { accountFor, signedBy, noticeBatch, noticeKey, proposalsFrom, readNotices } from '../../src/app/core/notices/notice-proposals.ts';
import { readNotice } from '../../src/app/core/notices/read-notice.ts';

const NOW = () => '2026-10-02T15:00:00Z';
const P = pesos => Math.round(pesos * 100);
const AT = Date.parse('2026-10-02T14:05:00');

const account = (id, name, extra = {}) => ({ id, name, archived: 0, currency_code: 'COP', type: 'debit', ...extra });
const notice = (text, extra = {}) => ({ package: 'com.bancoazul.app', app: 'Banco Azul', title: 'Banco Azul', text, postedAt: AT, ...extra });

test('a purchase becomes a spending proposal; a code, an offer and a balance do not', () => {
  const made = proposalsFrom([
    notice('Compraste $45.900 en TIENDA CENTRAL con tu tarjeta *1234'),
    notice('Tu codigo es 483920', { postedAt: AT + 1000 }),
    notice('Gana hasta $500.000 con nuestra promo', { postedAt: AT + 2000 }),
    notice('Tu saldo es $1.200.000', { postedAt: AT + 3000 }),
    notice('Recibiste $300.000 de Juan Gomez', { postedAt: AT + 4000 }),
  ], new Set(), [], []);
  assert.equal(made.length, 2);
  assert.equal(made[0].batch, noticeBatch('com.bancoazul.app'));
  assert.equal(made[0].proposal.amount_minor, P(-45900));
  assert.equal(made[0].proposal.description, 'TIENDA CENTRAL');
  assert.equal(made[0].proposal.occurred_on, '2026-10-02');
  assert.equal(made[0].proposal.evidence.digits, '1234');
  assert.equal(made[1].proposal.amount_minor, P(300000));
});

test('the same message re-posted within minutes is read once, and one already proposed never again', () => {
  const one = notice('Compraste $10.000 en KIOSKO');
  const again = { ...one, postedAt: AT + 60_000 };
  const made = proposalsFrom([one, again], new Set(), [], []);
  assert.equal(made.length, 1);
  assert.equal(proposalsFrom([one], new Set([made[0].proposal.evidence.key]), [], []).length, 0);
  // The same words an hour later are a second purchase.
  assert.equal(proposalsFrom([one, { ...one, postedAt: AT + 3_600_000 }], new Set(), [], []).length, 2);
});

test('a message that does not say which way the money went is proposed, marked as not sure', () => {
  const [made] = proposalsFrom([notice('Movimiento por $77.000 en tu cuenta')], new Set(), [], []);
  assert.equal(made.proposal.evidence.confidence, 'low');
});

test('the account: what the person answered before wins over a name that looks alike', () => {
  const accounts = [account(1, 'Banco Azul ahorros'), account(2, 'Tarjeta Azul 1234', { type: 'credit' }), account(3, 'Otra')];
  const purchase = notice('Compraste $45.900 en TIENDA con tu tarjeta *1234');
  const reading = readNotice(purchase.text, purchase.title);
  // Nothing answered yet: the digits in an account's own name.
  assert.deepEqual(accountFor(purchase, reading, [], accounts), { accountId: 2, from: 'name' });
  // Learned: those digits went to account 3 last time.
  const answers = [{ package: purchase.package, digits: '1234', account_id: 3 }];
  assert.deepEqual(accountFor(purchase, reading, answers, accounts), { accountId: 3, from: 'learned' });
});

test('an app that has only meant one account is that account; one that meant two asks, unless the digits say', () => {
  const accounts = [account(1, 'Ahorros'), account(2, 'Tarjeta')];
  const pkg = 'com.bancoazul.app';
  const plain = notice('Compraste $5.000 en PAN');
  const r = readNotice(plain.text);
  assert.equal(accountFor(plain, r, [{ package: pkg, digits: null, account_id: 1 }], accounts).accountId, 1);
  const two = [{ package: pkg, digits: '1111', account_id: 1 }, { package: pkg, digits: '2222', account_id: 2 }];
  assert.equal(accountFor(plain, r, two, accounts).accountId, null);
  const card = notice('Compraste $5.000 en PAN con tarjeta *2222');
  assert.equal(accountFor(card, readNotice(card.text), two, accounts).accountId, 2);
});

test('with nothing answered, the app\'s name in exactly one account\'s name is a suggestion', () => {
  const accounts = [account(1, 'Nequi'), account(2, 'Bancolombia ahorros'), account(3, 'Efectivo')];
  const msg = notice('Enviaste $20.000 a Ana', { package: 'com.nequi.app', app: 'Nequi', title: 'Nequi' });
  assert.deepEqual(accountFor(msg, readNotice(msg.text), [], accounts), { accountId: 1, from: 'name' });
  // "Banco" says nothing: it is in every bank's name.
  const vague = notice('Compraste $1.000 en X', { app: 'Banco', title: '' });
  assert.equal(accountFor(vague, readNotice(vague.text), [], [account(1, 'Banco Uno'), account(2, 'Banco Dos')]).accountId, null);
});

test('end to end: proposed, answered, and the next message of the same app arrives already filed', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const categories = new CategoriesRepository(db, NOW);
  const proposals = new ProposalsRepository(db, NOW);
  const repos = { proposals, transactions: new TransactionsRepository(db, NOW), transfers: new TransfersRepository(db, NOW) };
  const ahorros = await accounts.create({ name: 'Ahorros', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: P(1_000_000), opened_on: '2026-01-01' });
  const comida = await categories.create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });

  const first = notice('Compraste $32.000 en CAFE LUNA');
  const run = async kept => {
    const made = proposalsFrom(kept, await proposals.noticeKeys(), await proposals.noticeAnswers(), await accounts.list());
    const ids = [];
    for (const one of made) ids.push(...(await proposals.propose(one.batch, [one.proposal])).ids);
    return ids;
  };

  const [id] = await run([first]);
  let p = await proposals.byId(id);
  assert.equal(p.account_id, null, 'nothing to learn from yet');
  assert.equal(p.category_id, null);

  // The person answers: account and category.
  await proposals.correct(id, { account_id: ahorros, category_id: comida });
  await accept(repos, [await proposals.byId(id)]);

  // Reading the same messages again proposes nothing new.
  assert.deepEqual(await run([first]), []);

  // The next message from that app, the same shop: account and category already there.
  const [next] = await run([first, notice('Compraste $18.500 en CAFE LUNA', { postedAt: AT + 86_400_000 })]);
  p = await proposals.byId(next);
  assert.equal(p.account_id, ahorros);
  assert.equal(p.category_id, comida);
  assert.equal(p.amount_minor, P(-18500));

  // Put away from the review screen, it does not come back.
  await proposals.forget(noticeBatch(first.package));
  assert.deepEqual(await run([first, notice('Compraste $18.500 en CAFE LUNA', { postedAt: AT + 86_400_000 })]), []);
});

// An SMS is its sender's: two banks texting through the same messaging app
// are two sources (Jose, 2026-10-02). Every name and message is invented.
const sms = (sender, text, extra = {}) => ({
  package: 'com.mensajes.app', app: 'Mensajes', title: sender, sender, text, postedAt: AT, ...extra,
});

test('a text message: one batch per sender, the sender named, the key as before for apps', () => {
  const made = proposalsFrom([
    sms('Banco Azul', 'Compraste $45.900 en TIENDA CENTRAL'),
    sms('891333', 'Retiro por $200.000. Saldo $650.000', { postedAt: AT + 1000 }),
  ], new Set(), [], []);
  assert.equal(made.length, 2);
  assert.equal(made[0].batch, noticeBatch('com.mensajes.app|Banco Azul'));
  assert.equal(made[1].batch, noticeBatch('com.mensajes.app|891333'));
  assert.equal(made[0].proposal.evidence.sender, 'Banco Azul');
  assert.equal(made[0].proposal.evidence.file, 'Banco Azul · Mensajes');
  // An app's own notification keeps the key it always had, so nothing proposed before comes back.
  assert.equal(noticeKey(notice('Compraste $1 en X')), `com.bancoazul.app|${AT}|17`);
});

test('a text message: the account is learned per sender, and the sender\'s name matches an account', () => {
  const accounts = [account(1, 'Banco Azul ahorros'), account(2, 'Banco Rojo'), account(3, 'Efectivo')];
  const azul = sms('Banco Azul', 'Compraste $5.000 en PAN');
  // Before any answer: the sender's name in exactly one account's name ("Banco" says nothing).
  assert.deepEqual(accountFor(azul, readNotice(azul.text), [], accounts), { accountId: 1, from: 'name' });
  // What was answered for another sender of the same app does not leak across.
  const answers = [{ package: 'com.mensajes.app|Banco Rojo', digits: null, account_id: 2 }];
  assert.deepEqual(accountFor(azul, readNotice(azul.text), answers, accounts), { accountId: 1, from: 'name' });
  const rojo = sms('Banco Rojo', 'Compraste $7.000 en PAN');
  assert.deepEqual(accountFor(rojo, readNotice(rojo.text), answers, accounts), { accountId: 2, from: 'learned' });
});

// One purchase, several messages: the bank's SMS and its app's own
// notification (Jose, 2026-10-08). Every name and message is invented.
const push = (text, extra = {}) => ({ package: 'com.billeterarosa.app', app: 'Billetera Rosa', title: 'Billetera Rosa', text, postedAt: AT, ...extra });

test('an SMS and the app\'s notification of one purchase are one proposal, which says both', () => {
  const { fresh, joining } = readNotices([
    sms('899979', 'Billetera Rosa: compra por $45.900 en TIENDA CENTRAL con tarjeta *1234'),
    push('Pagaste $45.900 en Tienda Central', { postedAt: AT + 40_000 }),
  ], new Set(), [], []);
  assert.equal(fresh.length, 1);
  assert.deepEqual(joining, []);
  const [one] = fresh;
  assert.equal(one.proposal.amount_minor, P(-45900));
  assert.equal(one.proposal.evidence.sightings.length, 1);
  assert.equal(one.proposal.evidence.sightings[0].evidence.package, 'com.billeterarosa.app');
  assert.equal(one.proposal.evidence.digits, '1234');
});

test('the same card digits are enough; so is the same account; a different one never joins', () => {
  const accounts = [account(1, 'Rosa'), account(2, 'Otra')];
  // No shop named in one of them, the card's digits in both.
  let made = readNotices([
    sms('899979', 'Compra aprobada por $20.000 tarjeta *1234'),
    push('Compraste $20.000 en PANADERIA con *1234', { postedAt: AT + 30_000 }),
  ], new Set(), [], []).fresh;
  assert.equal(made.length, 1);
  // Different card digits: two purchases.
  made = readNotices([
    sms('899979', 'Compra aprobada por $20.000 tarjeta *1234'),
    push('Compraste $20.000 con *9876', { postedAt: AT + 30_000 }),
  ], new Set(), [], []).fresh;
  assert.equal(made.length, 2);
  // The same account learned for both sources.
  const answers = [{ package: 'com.mensajes.app|899979', digits: null, account_id: 1 }, { package: 'com.billeterarosa.app', digits: null, account_id: 1 }];
  made = readNotices([
    sms('899979', 'Movimiento: retiro por $50.000'),
    push('Retiraste $50.000', { postedAt: AT + 30_000 }),
  ], new Set(), answers, accounts).fresh;
  assert.equal(made.length, 1);
  // Money in against money out never joins.
  made = readNotices([
    sms('899979', 'Recibiste $50.000 de JUAN'),
    push('Pagaste $50.000 en JUAN', { postedAt: AT + 30_000 }),
  ], new Set(), [], []).fresh;
  assert.equal(made.length, 2);
});

test('two identical purchases told by both channels stay two, each with its pair', () => {
  const { fresh } = readNotices([
    sms('899979', 'Compra por $3.200 en BUS URBANO'),
    push('Pagaste $3.200 en Bus Urbano', { postedAt: AT + 20_000 }),
    sms('899979', 'Compra por $3.200 en BUS URBANO', { postedAt: AT + 5 * 60_000 }),
    push('Pagaste $3.200 en Bus Urbano', { postedAt: AT + 5 * 60_000 + 20_000 }),
  ], new Set(), [], []);
  assert.equal(fresh.length, 2);
  assert.ok(fresh.every(one => one.proposal.evidence.sightings?.length === 1));
});

test('one source never reports a movement twice: its own repeat an hour later is another purchase', () => {
  const { fresh } = readNotices([
    sms('899979', 'Compra por $3.200 en BUS URBANO'),
    sms('899979', 'Compra por $3.200 en BUS URBANO', { postedAt: AT + 10 * 60_000 }),
  ], new Set(), [], []);
  assert.equal(fresh.length, 2);
});

test('only the amount and the minute agree: proposed apart, the later naming the earlier as a possible twin', () => {
  const { fresh } = readNotices([
    sms('899979', 'Movimiento por $77.000'),
    push('Retiraste $77.000', { postedAt: AT + 60_000 }),
  ], new Set(), [], []);
  assert.equal(fresh.length, 2);
  assert.equal(fresh[0].proposal.evidence.twin, undefined);
  assert.equal(fresh[1].proposal.evidence.twin.key, fresh[0].proposal.evidence.key);
  // Too far apart, nothing is asked.
  const apart = readNotices([
    sms('899979', 'Movimiento por $77.000'),
    push('Retiraste $77.000', { postedAt: AT + 3 * 3_600_000 }),
  ], new Set(), [], []).fresh;
  assert.equal(apart[1].proposal.evidence.twin, undefined);
});

test('end to end: a later message joins the proposal already written, its key is spent, and it can be separated', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const proposals = new ProposalsRepository(db, NOW);
  const rosa = await accounts.create({ name: 'Rosa', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const run = async kept => {
    const { fresh, joining } = readNotices(kept, await proposals.noticeKeys(), await proposals.noticeAnswers(),
      await accounts.list(), await proposals.recentNotices());
    await proposals.join(joining);
    const ids = [];
    for (const one of fresh) ids.push(...(await proposals.propose(one.batch, [one.proposal])).ids);
    return { ids, joining };
  };

  // The SMS arrives first and is read on its own.
  const first = sms('899979', 'Compra por $45.900 en TIENDA CENTRAL *1234');
  const [id] = (await run([first])).ids;
  // The app's notification, read the next time the app opens, joins it.
  const second = push('Pagaste $45.900 en Tienda Central *1234', { postedAt: AT + 90_000 });
  const again = await run([first, second]);
  assert.deepEqual(again.ids, []);
  assert.equal(again.joining.length, 1);
  assert.equal((await proposals.pending()).length, 1);
  const read = JSON.parse((await proposals.byId(id)).evidence);
  assert.equal(read.sightings[0].evidence.key, noticeKey(second));
  // Spent: read once more, nothing changes.
  assert.equal((await run([first, second])).joining.length, 0);
  assert.ok((await proposals.noticeKeys()).has(noticeKey(second)));

  // A second identical purchase by SMS later is a new proposal, never swallowed.
  const third = sms('899979', 'Compra por $45.900 en TIENDA CENTRAL *1234', { postedAt: AT + 30 * 60_000 });
  assert.equal((await run([first, second, third])).ids.length, 1);
  assert.equal((await proposals.pending()).length, 2);

  // Separated: the notification is a proposal of its own again, in its own batch, naming its twin.
  assert.equal(await proposals.separate(id), 1);
  const now = await proposals.pending();
  assert.equal(now.length, 3);
  const apart = now.find(one => one.batch === noticeBatch('com.billeterarosa.app'));
  assert.equal(JSON.parse(apart.evidence).twin.key, noticeKey(first));
  assert.equal(JSON.parse((await proposals.byId(id)).evidence).sightings, undefined);
  // And reading again brings nothing back.
  assert.deepEqual((await run([first, second, third])).ids, []);

  // Answered, both sources learn the account.
  await proposals.correct(id, { account_id: rosa });
  await db.run("UPDATE movement_proposals SET status = 'accepted' WHERE id = ?", [id]);
  assert.ok((await proposals.noticeAnswers()).some(a => a.package === 'com.mensajes.app|899979' && a.account_id === rosa));
});

test('a message signed by the bank goes to that bank, even through a short code other banks share', () => {
  const accounts = [account(1, 'Rappi cuenta'), account(2, 'Bold'), account(3, 'Nu')];
  const sms = { ...notice('BoldCF: Realizaste una transferencia por $10.000'), sender: '899979' };
  const reading = readNotice(sms.text, sms.title);
  // The short code meant Rappi before; the signature wins.
  const answers = [{ package: 'com.bancoazul.app|899979', digits: null, account_id: 1 }];
  assert.deepEqual(accountFor(sms, reading, answers, accounts), { accountId: 2, from: 'name' });
  assert.equal(signedBy('899979 - BoldCF: Realizaste', accounts), 2);
  // A name further on is where the money went, not whose message it is.
  assert.equal(signedBy('Transferiste $50.000 a Bold', accounts), null);
  // Too short a word never signs ("Nu" against "nuevo").
  assert.equal(signedBy('Nuevo movimiento por $5.000', accounts), null);
});
