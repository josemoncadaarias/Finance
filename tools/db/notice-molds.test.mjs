// What the person saves from a bank's message teaches that source's mold:
// the next message of the same shape is read exactly, with the account and
// category already there (Jose, 2026-10-08). Every bank and message invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/notice-molds.test.mjs

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
import { learnMold, moldFrom, readWithMolds } from '../../src/app/core/notices/molds.ts';
import { readNotices } from '../../src/app/core/notices/notice-proposals.ts';

const P = pesos => Math.round(pesos * 100);
const NOW = () => '2026-10-08T15:00:00Z';
const AT = Date.parse('2026-10-08T14:05:00');
const SRC = 'com.mensajes.app|877';

test('a mold reads the next message of the same shape: amount, shop and direction', () => {
  const mold = moldFrom({
    source: SRC, text: 'Rosa: Pago aprobado por $45.900 en TIENDA CENTRAL el 08/10 12:31. Saldo $1.200.000',
    amountMinor: P(-45900), merchant: 'TIENDA CENTRAL', accountId: 7, categoryId: 3, at: 1,
  });
  assert.ok(mold);
  assert.equal(mold.hasMerchant, true);
  const read = readWithMolds(SRC, 'Rosa: Pago aprobado por $12.000,50 en Café Luna el 09/10 08:02. Saldo $1.187.999,50', [mold]);
  assert.deepEqual(read, { amountMinor: P(12000.5), direction: 'out', merchant: 'Café Luna', accountId: 7, categoryId: null, otherAccountId: null });
  // Another source, or another shape, is not read by it.
  assert.equal(readWithMolds('otra', 'Rosa: Pago aprobado por $12.000 en X el 09/10 08:02. Saldo $1', [mold]), null);
  assert.equal(readWithMolds(SRC, 'Rosa: tu código es 123456', [mold]), null);
});

test('a message that names no shop carries the category the person gave it', () => {
  const mold = moldFrom({ source: SRC, text: 'Te llegaron $300.000 a tu cuenta', amountMinor: P(300000), merchant: 'Sueldo', accountId: 2, categoryId: 9, at: 1 });
  const read = readWithMolds(SRC, 'Te llegaron $1.500.000 a tu cuenta', [mold]);
  assert.equal(read.direction, 'in');
  assert.equal(read.amountMinor, P(1500000));
  assert.equal(read.categoryId, 9);
});

test('the amount must be in the message, and a source keeps its few best molds', () => {
  assert.equal(moldFrom({ source: SRC, text: 'Compra aprobada', amountMinor: P(-1000), merchant: null, accountId: null, categoryId: null, at: 1 }), null);
  let molds = [];
  for (let i = 0; i < 12; i += 1) {
    molds = learnMold(molds, moldFrom({ source: SRC, text: `Forma ${'x'.repeat(i)} por $1.000`, amountMinor: P(-1000), merchant: null, accountId: null, categoryId: null, at: i }));
  }
  assert.equal(molds.length, 8);
  const again = learnMold(molds, { ...molds[0], at: 99 });
  assert.equal(again.find(one => one.pattern === molds[0].pattern).uses, 2);
});

test('end to end: saved once, the next message comes with account, category, shop and sign', async () => {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const accounts = new AccountsRepository(db, NOW);
  const proposals = new ProposalsRepository(db, NOW);
  const repos = { proposals, transactions: new TransactionsRepository(db, NOW), transfers: new TransfersRepository(db, NOW) };
  const rosa = await accounts.create({ name: 'Billetera', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const otra = await accounts.create({ name: 'Otra', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opening_balance_minor: 0, opened_on: '2026-01-01' });
  const comida = await new CategoriesRepository(db, NOW).create({ name: 'Comida', kind: 'expense', builtin_icon: 'restaurant' });
  const sms = (text, at) => ({ package: 'com.mensajes.app', app: 'Mensajes', title: '877', sender: '877', text, postedAt: at });
  const run = async kept => {
    const { fresh } = readNotices(kept, await proposals.noticeKeys(), await proposals.noticeAnswers(), await accounts.list(),
      await proposals.recentNotices(), { molds: await proposals.molds(), assigned: await proposals.sourceAccounts() });
    const ids = [];
    for (const one of fresh) ids.push(...(await proposals.propose(one.batch, [one.proposal])).ids);
    return ids;
  };

  // A wording the shape reader cannot place: no movement word at all.
  const first = sms('877: Tx 45.900 COP comercio TIENDA CENTRAL ok', AT);
  const [id] = await run([first]);
  let p = await proposals.byId(id);
  assert.equal(p.account_id, null);
  // The person answers: a spending, Billetera, Comida.
  await proposals.correct(id, { account_id: rosa, category_id: comida, amount_minor: P(-45900), description: 'TIENDA CENTRAL' });
  await accept(repos, [await proposals.byId(id)]);
  assert.equal((await proposals.molds()).length, 1);

  const [next] = await run([first, sms('877: Tx 18.500 COP comercio PANADERIA SOL ok', AT + 86_400_000)]);
  p = await proposals.byId(next);
  assert.equal(p.amount_minor, P(-18500));
  assert.equal(p.description, 'PANADERIA SOL');
  assert.equal(p.account_id, rosa);
  assert.equal(JSON.parse(p.evidence).molded, true);

  // Said by hand on the notifications screen: this sender is another account.
  await proposals.assignSource('com.mensajes.app|999', otra);
  const [told] = await run([{ ...sms('Compraste $5.000 en KIOSKO', AT + 2 * 86_400_000), title: '999', sender: '999' }]);
  assert.equal((await proposals.byId(told)).account_id, otra);
});

test('a message saved as a transfer teaches its mold the other account, and the next one is proposed as a transfer', () => {
  const text = 'Rosa: Realizaste una transferencia por $10.000,00 desde tu cuenta *1111. 08/10/2026 11:57AM';
  const mold = moldFrom({ source: SRC, text, amountMinor: P(-10000), merchant: null, accountId: 7, categoryId: null, at: 1, otherAccountId: 4 });
  assert.equal(mold.otherAccountId, 4);
  const read = readWithMolds(SRC, 'Rosa: Realizaste una transferencia por $25.000,00 desde tu cuenta *1111. 09/10/2026 08:01AM', [mold]);
  assert.equal(read.otherAccountId, 4);
  assert.equal(read.amountMinor, P(25000));
  // Saved as a spending afterwards, the newest answer wins: no longer a transfer.
  const again = learnMold([mold], moldFrom({ source: SRC, text, amountMinor: P(-10000), merchant: null, accountId: 7, categoryId: 2, at: 2 }));
  assert.equal(again[0].otherAccountId, null);
});
