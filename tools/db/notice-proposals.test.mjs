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
import { accountFor, noticeBatch, proposalsFrom } from '../../src/app/core/notices/notice-proposals.ts';
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
