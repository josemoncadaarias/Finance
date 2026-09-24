// The yields summary's analyses, on facts built by hand.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/report-yields.test.mjs
//
// Pure functions over `YieldsReportData`, so no database: the days are made
// here the way the engine makes them, and each analysis is held to what it
// claims.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  yieldHeadline, yieldByWhere, yieldByMonth, yieldVersusBefore, yieldBankVersusApp, yieldNotes,
  buildYieldsReport,
} from '../../src/app/core/report/sections-yields.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';
import { dailyRate, EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

const pct = p => Math.round((p / 100) * EA_SCALE);

const account = (id, name, currency = 'COP') => ({
  id, name, currency_code: currency, builtin_icon: 'wallet', custom_icon_id: null,
});

/** Days of one product compounding daily from `base`, the way the engine walks. */
function walk({ account_id, product_id, from, days, base, rate }) {
  const out = [];
  let balance = base;
  const daily = dailyRate(rate);
  for (let i = 0; i < days; i += 1) {
    const on = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
    const net = Math.round(balance * daily);
    out.push({
      account_id, product_id, component: 'base', on_date: on, paid_on: on,
      balance_minor: balance, annual_rate_scaled: rate, gross_minor: net, withholding_minor: 0,
      net_minor: net, actual_net_minor: null, locked: 0,
    });
    balance += net;
  }
  return out;
}

function data(overrides = {}) {
  return {
    period: { kind: 'month', from: '2026-09-01', to: '2026-09-30' },
    periodLabel: 'Septiembre 2026',
    account: null,
    accounts: [account(1, 'Dale'), account(2, 'Nu')],
    products: [
      { id: 10, account_id: 1, name: 'Alcancía' },
      { id: 20, account_id: 2, name: 'Cajita' },
    ],
    days: [
      ...walk({ account_id: 1, product_id: 10, from: '2026-07-01', days: 86, base: 1_000_000_000, rate: pct(10.5) }),
      ...walk({ account_id: 2, product_id: 20, from: '2026-07-01', days: 86, base: 200_000_000, rate: pct(9) }),
    ],
    before: { period: { kind: 'month', from: '2026-08-01', to: '2026-08-24' }, label: 'Agosto 2026', clipped: true },
    inReportCurrency: minor => minor,
    currency: 'COP',
    today: '2026-09-24',
    locale: 'es-CO',
    words: TEST_WORDS,
    ...overrides,
  };
}

const figure = (block, label) => block.figures.find(one => one.label === label)?.value;

test('the period in figures adds up what was paid, day by day, up to today', () => {
  const facts = data();
  const block = yieldHeadline(facts);
  const expected = facts.days
    .filter(day => day.on_date >= '2026-09-01' && day.on_date <= '2026-09-24')
    .reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(figure(block, TEST_WORDS['report.yields.net']).minor, expected);
  assert.equal(figure(block, TEST_WORDS['report.yields.perDay']).minor, Math.round(expected / 24),
    'twenty-four days so far, not thirty');
});

test('the effective return of one product at 10.5% comes out as 10.5%', () => {
  const block = yieldHeadline(data({
    account: account(1, 'Dale'),
    days: walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 30, base: 1_000_000_000, rate: pct(10.5) }),
  }));
  const effective = figure(block, TEST_WORDS['report.yields.effective']).value;
  assert.ok(Math.abs(effective - 10.5) < 0.05, `worked out ${effective}, not 10.5`);
});

test('the bank figure wins where Jose typed it, and the comparison says how many matched', () => {
  const days = walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_000_000_000, rate: pct(10.5) });
  days[20] = { ...days[20], locked: 1, actual_net_minor: days[20].net_minor };        // matched
  days[21] = { ...days[21], locked: 1, actual_net_minor: days[21].net_minor - 76 };   // 0.76 below
  const facts = data({ account: account(1, 'Dale'), days });

  const head = yieldHeadline(facts);
  const plain = days.reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(figure(head, TEST_WORDS['report.yields.net']).minor, plain - 76, 'the bank figure counts');

  const bank = yieldBankVersusApp(facts);
  assert.equal(bank.rows.length, 1);
  assert.equal(bank.rows[0].now.minor - bank.rows[0].before.minor, -76);
  assert.match(bank.caveat, /2 días.*1 coinciden/);
});

test('with no day checked against a statement there is no comparison to show', () => {
  assert.equal(yieldBankVersusApp(data()), null);
});

test('account by account for all of them, product by product for one', () => {
  const all = yieldByWhere(data());
  assert.deepEqual(all.rows.map(row => row.label), ['Dale', 'Nu'], 'the bigger one first');
  assert.ok(Math.abs(all.rows[0].share + all.rows[1].share - 100) < 0.2);

  const one = yieldByWhere(data({
    account: account(1, 'Dale'),
    products: [{ id: 10, account_id: 1, name: 'Principal' }, { id: 11, account_id: 1, name: 'Complemento' }],
    days: [
      ...walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_000_000_000, rate: pct(10.5) }),
      ...walk({ account_id: 1, product_id: 11, from: '2026-09-01', days: 24, base: 900_000_000, rate: pct(10.5) }),
    ],
  }));
  assert.deepEqual(one.rows.map(row => row.label), ['Principal', 'Complemento']);
});

test('month by month runs to the end of the period and leaves the running month out of the average', () => {
  const block = yieldByMonth(data());
  assert.deepEqual(block.points.map(point => point.label), ['Julio 2026', 'Agosto 2026', 'Septiembre 2026']);
  const july = block.points[0].value.minor;
  const august = block.points[1].value.minor;
  assert.equal(block.average.minor, Math.round((july + august) / 2), 'September is not finished');
});

test('against the period before, the same days on both sides', () => {
  const facts = data();
  const block = yieldVersusBefore(facts);
  const augustDale = facts.days
    .filter(day => day.product_id === 10 && day.on_date >= '2026-08-01' && day.on_date <= '2026-08-24')
    .reduce((sum, day) => sum + day.net_minor, 0);
  const dale = block.rows.find(row => row.label === 'Dale');
  assert.equal(dale.before.minor, augustDale);
  assert.ok(dale.changePercent > 0, 'compounding: this month earns more than the same days of the last');
  assert.ok(block.caveat, 'and it says the days were matched');
});

test('a currency with no rate is left out and said, never guessed', () => {
  const facts = data({
    accounts: [account(1, 'Dale'), account(3, 'ARQ', 'USD')],
    days: [
      ...walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_000_000_000, rate: pct(10.5) }),
      ...walk({ account_id: 3, product_id: 30, from: '2026-09-01', days: 24, base: 500_000, rate: pct(4) }),
    ],
    inReportCurrency: (minor, accountId) => (accountId === 3 ? null : minor),
  });
  const head = yieldHeadline(facts);
  const daleOnly = facts.days.filter(day => day.account_id === 1).reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(figure(head, TEST_WORDS['report.yields.net']).minor, daleOnly);
  assert.ok(yieldNotes(facts).lines.some(line => /USD/.test(line.text)));
});

test('a month still running gets a projection, labelled as one', () => {
  const notes = yieldNotes(data());
  assert.ok(notes.lines.some(line => /proyección/.test(line.text)));
});

test('a period with nothing earned has nothing to say', () => {
  const empty = data({ days: [] });
  assert.deepEqual(buildYieldsReport(empty), []);
});
