// Tests for deciding which accounts to create, and in which currency.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/account-plan.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseMonefyCsv } from '../../src/app/core/database/import/monefy-csv.ts';
import { findGhostAccounts } from '../../src/app/core/database/import/pair-transfers.ts';
import { planAccounts, openingBalances, historyTargets }
  from '../../src/app/core/database/import/account-plan.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_EXPORT = join(HERE, '..', '..', 'data', 'monefy-2026-09-08.csv');
const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';

function csv(...lines) {
  const text = [HEADER, ...lines].join('\r\n');
  return Uint8Array.from([...text].map(c => c.charCodeAt(0)));
}

const opening = (date, account, amount) =>
  `${date},${account},Initial balance '${account}',"${amount}",COP,"${amount}",COP,`;
const spend = (date, account, category, amount) =>
  `${date},${account},${category},"${amount}",COP,"${amount}",COP,`;

function planOf(source, ghosts = []) {
  const parsed = parseMonefyCsv(source);
  return { parsed, plan: planAccounts(parsed, ghosts) };
}

test('an opening balance becomes the account opening balance, not a movement', () => {
  const { plan } = planOf(csv(
    opening('25/06/2021', 'Nequi', '9,421.28'),
    spend('26/06/2021', 'Nequi', 'Comida', '-1,000'),
  ));

  const nequi = plan.accounts.find(a => a.name === 'Nequi');
  assert.equal(nequi.openingBalanceMinor, 942128);
  assert.equal(nequi.openedOn, '2021-06-25');
});

test("the credit card's opening balance is dropped, because it was the limit", () => {
  // Monefy stored the card as limit - debt, so it opens at the limit.
  const { parsed, plan } = planOf(csv(
    opening('21/08/2021', 'Tarjeta crédito rappi', '800,000'),
    spend('22/08/2021', 'Tarjeta crédito rappi', 'Restaurante', '-50,000'),
  ));

  const card = plan.accounts.find(a => a.name === 'Tarjeta crédito rappi');
  assert.equal(card.type, 'credit');
  assert.equal(card.openingBalanceMinor, 0, 'the 800,000 was never money');
  assert.equal(card.creditLimitMinor, 110000000, 'the current limit, not the 2021 one');
  assert.equal(card.confirmed, true);

  // openingBalances applies the same rule on its own.
  assert.equal(openingBalances(parsed.rows).get('Tarjeta crédito rappi').amountMinor, 0);
});

test('an account with no opening balance starts at zero, on its first row', () => {
  const { plan } = planOf(csv(spend('07/03/2024', 'Ualá', 'Comida', '-1,000')));

  const uala = plan.accounts.find(a => a.name === 'Ualá');
  assert.equal(uala.openingBalanceMinor, 0);
  assert.equal(uala.openedOn, '2024-03-07');
});

test('a multi-currency account becomes one row per currency', () => {
  const { plan } = planOf(csv(spend('13/08/2024', 'ARQ', 'Viajes', '-100,000')));

  const rows = plan.accounts.filter(a => a.sourceName === 'ARQ');
  assert.deepEqual(rows.map(a => a.currency).sort(), ['EUR', 'USD']);
  assert.deepEqual(rows.map(a => a.name).sort(), ['ARQ EUR', 'ARQ USD']);
  assert.ok(rows.every(a => a.groupName === 'ARQ'));
  assert.deepEqual(plan.groups, [{ name: 'ARQ', currencies: ['USD', 'EUR'] }]);

  // Only one side takes the history; the other starts empty, which is right:
  // the backup holds no evidence of the euro side at all.
  const receiving = rows.filter(a => a.receivesHistory);
  assert.equal(receiving.length, 1);
  assert.equal(receiving[0].currency, 'USD');

  // And the split is flagged, because the file cannot say which side a row
  // belonged to.
  assert.ok(plan.reviews.some(r => r.kind === 'multi_currency_split' && r.account === 'ARQ'));
});

test('Global66 imports into its peso side', () => {
  const { plan } = planOf(csv(spend('01/02/2026', 'Global66', 'Casa', '-154,000')));

  const receiving = plan.accounts.filter(a => a.sourceName === 'Global66' && a.receivesHistory);
  assert.equal(receiving.length, 1);
  assert.equal(receiving[0].currency, 'COP');
  assert.equal(receiving[0].name, 'Global66 COP');
});

test('what Jose confirmed is not flagged; what was inferred is', () => {
  const { plan } = planOf(csv(
    spend('10/04/2024', 'eToro', 'Comida', '-1,000'),
    spend('20/07/2024', 'Lulo', 'Comida', '-1,000'),
  ));

  const etoro = plan.accounts.find(a => a.name === 'eToro');
  assert.equal(etoro.currency, 'USD');
  assert.equal(etoro.type, 'investment');
  assert.equal(etoro.confirmed, true);
  assert.equal(plan.reviews.some(r => r.account === 'eToro'), false);

  // Lulo is not in the table: it defaults, and says so.
  const lulo = plan.accounts.find(a => a.name === 'Lulo');
  assert.equal(lulo.currency, 'COP');
  assert.equal(lulo.type, 'debit');
  assert.equal(lulo.confirmed, false);
  assert.ok(plan.reviews.some(r => r.kind === 'assumed_account' && r.account === 'Lulo'));
});

test('a deleted account is recreated archived and flagged', () => {
  const ghost = {
    name: 'Renta Fija Plazo',
    receivedRows: 5, sentRows: 2,
    firstSeen: '2021-07-15', lastSeen: '2022-06-13',
    netMinor: -586266655,
  };
  const { plan } = planOf(csv(spend('15/07/2021', 'Bancolombia', 'Comida', '-1,000')), [ghost]);

  const fund = plan.accounts.find(a => a.name === 'Renta Fija Plazo');
  assert.equal(fund.archived, true, 'it no longer exists, so it must not clutter the live list');
  assert.equal(fund.isGhost, true);
  assert.equal(fund.openedOn, '2021-07-15');
  assert.equal(fund.openingBalanceMinor, 0);
  // The name is legible enough to guess a fund, but it stays unconfirmed.
  assert.equal(fund.type, 'investment');
  assert.equal(fund.confirmed, false);

  const review = plan.reviews.find(r => r.kind === 'deleted_account');
  assert.match(review.reason, /7 transfer halves/);
});

test('history goes to exactly one account per backup name', () => {
  const { plan } = planOf(csv(
    spend('13/08/2024', 'ARQ', 'Viajes', '-100,000'),
    spend('01/02/2026', 'Global66', 'Casa', '-154,000'),
    spend('26/06/2021', 'Bancolombia', 'Comida', '-1,000'),
  ));

  const targets = historyTargets(plan);
  assert.equal(targets.get('ARQ').name, 'ARQ USD');
  assert.equal(targets.get('Global66').name, 'Global66 COP');
  assert.equal(targets.get('Bancolombia').name, 'Bancolombia');
  assert.equal(targets.size, 3, 'one target per source account, never two');
});

test('plans the real export', { skip: !existsSync(REAL_EXPORT) && 'export not present' }, () => {
  const parsed = parseMonefyCsv(readFileSync(REAL_EXPORT));
  const ghosts = findGhostAccounts(parsed.rows, parsed.accounts);
  const plan = planAccounts(parsed, ghosts);

  // 22 accounts, two of which split in two, plus 12 reconstructed.
  assert.equal(plan.accounts.length, 22 + 2 + 12);
  assert.equal(plan.accounts.filter(a => a.isGhost).length, 12);
  assert.equal(plan.accounts.filter(a => a.archived).length, 12);
  assert.deepEqual(plan.groups.map(g => g.name).sort(), ['ARQ', 'Global66']);

  // Every backup account has exactly one place to write its rows.
  const targets = historyTargets(plan);
  for (const name of parsed.accounts) {
    assert.ok(targets.has(name), `${name} has nowhere to write its rows`);
  }

  // No account name is created twice, or the unique index would reject it.
  const names = plan.accounts.map(a => a.name);
  assert.equal(new Set(names).size, names.length);

  // A group holds each currency once.
  for (const group of plan.groups) {
    const inGroup = plan.accounts.filter(a => a.groupName === group.name);
    assert.equal(new Set(inGroup.map(a => a.currency)).size, inGroup.length);
  }

  // Only the credit card carries a limit, and it is the current one.
  const withLimit = plan.accounts.filter(a => a.creditLimitMinor !== null);
  assert.equal(withLimit.length, 1);
  assert.equal(withLimit[0].name, 'Tarjeta crédito rappi');
  assert.equal(withLimit[0].creditLimitMinor, 110000000);
  assert.equal(withLimit[0].openingBalanceMinor, 0);

  const opened = plan.accounts.filter(a => a.openingBalanceMinor !== 0);
  // 8 accounts declare an opening balance; the card's is dropped as the limit.
  assert.equal(opened.length, 7);

  const byKind = plan.reviews.reduce((counts, r) => {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    return counts;
  }, {});
  console.log(`    real export: ${plan.accounts.length} accounts ` +
    `(${plan.accounts.filter(a => a.confirmed).length} confirmed, ${plan.accounts.filter(a => a.isGhost).length} reconstructed), ` +
    `${plan.groups.length} groups, reviews ${JSON.stringify(byKind)}`);
});
