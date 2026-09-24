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
  yieldHeadline, yieldByWhere, yieldByMonth, yieldVersusBefore, yieldNotes,
  yieldVersusInflation, yieldGrowth, yieldEarnedSoFar,
  buildYieldsReport,
} from '../../src/app/core/report/sections-yields.ts';
import { inflationOver } from '../../src/app/core/inflation/inflation.ts';
import { parseIpc } from '../../src/app/core/inflation/ipc-client.ts';
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
    inflation: [],
    investments: [],
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

test('the bank figure wins where Jose typed it', () => {
  const days = walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_000_000_000, rate: pct(10.5) });
  days[20] = { ...days[20], locked: 1, actual_net_minor: days[20].net_minor };        // matched
  days[21] = { ...days[21], locked: 1, actual_net_minor: days[21].net_minor - 76 };   // 0.76 below
  const facts = data({ account: account(1, 'Dale'), days });

  const head = yieldHeadline(facts);
  const plain = days.reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(figure(head, TEST_WORDS['report.yields.net']).minor, plain - 76, 'the bank figure counts');
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

// --- Inflation -------------------------------------------------------------

/** The DANE's real index for 2025 and 2026, as migration 046 ships it. */
const IPC = [
  ['2024-08', 14399], ['2024-09', 14424], ['2024-10', 14418], ['2024-11', 14422], ['2024-12', 14488],
  ['2025-01', 14624], ['2025-02', 14790], ['2025-03', 14868], ['2025-04', 14966], ['2025-05', 15014],
  ['2025-06', 15030], ['2025-07', 15071], ['2025-08', 15099], ['2025-09', 15148], ['2025-10', 15176],
  ['2025-11', 15187], ['2025-12', 15227], ['2026-01', 15407], ['2026-02', 15573], ['2026-03', 15694],
  ['2026-04', 15817], ['2026-05', 15891], ['2026-06', 15953], ['2026-07', 15979], ['2026-08', 16042],
].map(([month, index_scaled]) => ({ month, index_scaled }));

test('inflation over a whole year is the DANE figure for that year', () => {
  const year = inflationOver(IPC, '2025-01-01', '2025-12-31');
  assert.ok(Math.abs(year.rate - 0.0510) < 0.0001, `${year.rate} is not the 5.10% the DANE published`);
  assert.deepEqual(year.estimated, []);
  const january = inflationOver(IPC, '2026-01-01', '2026-01-31');
  assert.ok(Math.abs(january.rate - 0.0118) < 0.0001, 'January 2026 was 1.18%');
});

test('a month not published yet is estimated, and says so', () => {
  const september = inflationOver(IPC, '2026-09-01', '2026-09-24');
  assert.deepEqual(september.estimated, ['2026-09']);
  assert.equal(september.lastPublished, '2026-08');
  // The average month of the year to August: 16042 / 15099 over twelve.
  const typical = Math.pow(16042 / 15099, 1 / 12) - 1;
  assert.ok(Math.abs(september.rate - (Math.pow(1 + typical, 24 / 30) - 1)) < 1e-9);
  assert.equal(inflationOver(IPC, '2020-01-01', '2020-01-31'), null, 'before anything on record: nothing');
});

test('against inflation: the real return and what inflation took, on the same days as the headline', () => {
  const facts = data({ inflation: IPC });
  const block = yieldVersusInflation(facts);
  const infl = inflationOver(IPC, '2026-09-01', '2026-09-24');
  const head = yieldHeadline(facts);
  const effective = figure(head, TEST_WORDS['report.yields.effective']).value / 100;
  const real = figure(block, TEST_WORDS['report.yields.inflation.real']).value / 100;
  assert.ok(Math.abs(real - ((1 + effective) / (1 + infl.annual) - 1)) < 0.0002);
  const took = figure(block, TEST_WORDS['report.yields.inflation.took']).minor;
  const kept = figure(block, TEST_WORDS['report.yields.inflation.kept']).minor;
  const net = figure(head, TEST_WORDS['report.yields.net']).minor;
  assert.equal(took + kept, net, 'what was earned is what inflation took plus what is left');
  assert.equal(yieldVersusInflation(data()), null, 'no months on record: nothing to say');
  assert.equal(yieldVersusInflation(data({ inflation: IPC, currency: 'USD' })), null, 'the index is for pesos');
});

test('the service answer is read into months, and a broken one is an error', () => {
  const months = parseIpc({ SERIES: [{ id: 15000, data: [[1785474000000, 159.79], [1788152400000, 160.42]] }] });
  assert.deepEqual(months, [{ month: '2026-07', index_scaled: 15979 }, { month: '2026-08', index_scaled: 16042 }]);
  assert.throws(() => parseIpc({ SERIES: [] }));
  assert.throws(() => parseIpc(''));
});

// --- Growth ----------------------------------------------------------------

test('the growth chart is the balance at each month close, and the running total only rises', () => {
  const facts = data();
  const growth = yieldGrowth(facts);
  assert.deepEqual(growth.points.map(point => point.label), ['Julio 2026', 'Agosto 2026', 'Septiembre 2026']);
  const lastOf = (product, month) => facts.days.filter(day => day.product_id === product && day.on_date.startsWith(month)).at(-1).balance_minor;
  const close = month => lastOf(10, month) + lastOf(20, month);
  assert.equal(growth.points[0].value.minor, 0, 'measured from the first month');
  assert.equal(growth.points[1].value.minor, close('2026-08') - close('2026-07'));

  const soFar = yieldEarnedSoFar(facts);
  const values = soFar.points.map(point => point.value.minor);
  assert.ok(values.every((value, at) => at === 0 || value > values[at - 1]));
  assert.equal(values.at(-1), facts.days.reduce((sum, day) => sum + day.net_minor, 0));
});

// --- Investments without products ------------------------------------------

/**
 * A fund like Fiducuenta: 100 million at the start of July, 10 million put
 * in on 15 August, and its gains and losses written down as movements.
 */
function fund() {
  return {
    account_id: 3,
    from: '2026-07-01',
    opening_minor: 100_000_000_00,
    movements: [
      { on_date: '2026-07-10', amount_minor: 600_000_00, is_return: 1 },
      { on_date: '2026-07-20', amount_minor: -150_000_00, is_return: 1 },
      { on_date: '2026-08-15', amount_minor: 10_000_000_00, is_return: 0 },   // money put in
      { on_date: '2026-08-28', amount_minor: 700_000_00, is_return: 1 },
      { on_date: '2026-09-04', amount_minor: 300_000_00, is_return: 1 },
      { on_date: '2026-09-10', amount_minor: -90_000_00, is_return: 0 },      // a bill paid from it
      { on_date: '2026-09-18', amount_minor: -50_000_00, is_return: 1 },
    ],
  };
}
const withFund = (overrides = {}) => data({
  accounts: [account(1, 'Dale'), account(2, 'Nu'), account(3, 'Fiducuenta')],
  investments: [fund()],
  ...overrides,
});

test('what an investment earned is only what it wrote down as a return, never what was put in', () => {
  const plain = yieldHeadline(data());
  const block = yieldHeadline(withFund());
  const net = figure(block, TEST_WORDS['report.yields.net']).minor;
  assert.equal(net - figure(plain, TEST_WORDS['report.yields.net']).minor, 300_000_00 - 50_000_00,
    'September: +300,000 and -50,000; the bill paid from it is not a loss');
  assert.equal(figure(block, TEST_WORDS['report.yields.invested']).minor, 250_000_00);
  assert.equal(figure(block, TEST_WORDS['report.yields.interest']).minor, figure(plain, TEST_WORDS['report.yields.net']).minor,
    'interest and the investment are told apart');
});

test('an investment alone: its return on the money that was in it', () => {
  const block = yieldHeadline(data({
    account: account(3, 'Fiducuenta'), accounts: [account(3, 'Fiducuenta')], products: [], days: [], investments: [fund()],
  }));
  assert.equal(figure(block, TEST_WORDS['report.yields.net']).minor, 250_000_00);
  // 250,000 over 24 days on about 110 million: roughly 3.5% a year.
  const effective = figure(block, TEST_WORDS['report.yields.effective']).value;
  assert.ok(effective > 3 && effective < 4, `${effective}`);
});

test('the investment is a row of its own, and every chart counts it', () => {
  const where = yieldByWhere(withFund());
  const row = where.rows.find(one => one.label === 'Fiducuenta');
  assert.equal(row.value.minor, 250_000_00);
  assert.match(row.note, /inversión/);

  const months = yieldByMonth(withFund());
  const plainMonths = yieldByMonth(data());
  assert.equal(months.points[0].value.minor - plainMonths.points[0].value.minor, 450_000_00, 'July: +600,000 -150,000');

  const growth = yieldGrowth(withFund());
  const plainGrowth = yieldGrowth(data());
  // August closed 10.7 million above July in the fund: 10 million put in and 700,000 earned.
  assert.equal(growth.points[1].value.minor - plainGrowth.points[1].value.minor, 10_700_000_00);

  const before = yieldVersusBefore(withFund());
  const againstAugust = before.rows.find(one => one.label === 'Fiducuenta');
  assert.equal(againstAugust.before.minor, 0, 'the first 24 days of August wrote nothing down');
  assert.equal(againstAugust.now.minor, 250_000_00);
});

test('the growth chart starts once every account is on record, never before', () => {
  // A savings account whose yields begin in September, beside a fund on
  // record since July: before September its money is unrecorded, not absent.
  const late = walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_000_000_000, rate: pct(10.5) });
  const facts = data({
    accounts: [account(1, 'Dale'), account(3, 'Fiducuenta')],
    products: [{ id: 10, account_id: 1, name: 'Alcancía' }],
    days: late,
    investments: [fund()],
  });
  assert.equal(yieldGrowth(facts), null, 'one month on record for both is not a chart');
  const notes = yieldNotes(facts);
  assert.ok(!notes || notes.lines.every(line => !/Desde el cierre/.test(line.text)));
  assert.ok(yieldEarnedSoFar(facts), 'what was earned is still on record, month by month');
});
