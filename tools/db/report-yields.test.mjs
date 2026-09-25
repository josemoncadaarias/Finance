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
import { inflationReference } from '../../src/app/core/inflation/inflation.ts';
import { estimateBeforeRecord } from '../../src/app/core/report/estimate.ts';
import { parseIpc } from '../../src/app/core/inflation/ipc-client.ts';
import { yieldsWorkbook } from '../../src/app/core/report/report-workbook.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';
import { dailyRate, EA_SCALE } from '../../src/app/core/yields/yield-math.ts';

const pct = p => Math.round((p / 100) * EA_SCALE);

const account = (id, name, currency = 'COP', opened_on = '2025-01-01') => ({
  id, name, currency_code: currency, builtin_icon: 'wallet', custom_icon_id: null, opened_on,
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

/** The DANE's annual inflation for a month, from the index. */
const annualOf = month => {
  const index = new Map(IPC.map(one => [one.month, one.index_scaled]));
  return index.get(month) / index.get(`${Number(month.slice(0, 4)) - 1}${month.slice(4)}`) - 1;
};

test('the inflation a period is set against is the average of the year so far, as the DANE published it', () => {
  // December 2025 was 5.10% and January 2026 5.35%, as the DANE announced.
  assert.ok(Math.abs(annualOf('2025-12') - 0.0510) < 0.0001);
  assert.ok(Math.abs(annualOf('2026-01') - 0.0535) < 0.0001);

  const september = inflationReference(IPC, '2026-09-01', '2026-09-24');
  const soFar = ['01', '02', '03', '04', '05', '06', '07', '08'].map(m => annualOf(`2026-${m}`));
  assert.ok(Math.abs(september.annual - soFar.reduce((a, b) => a + b) / 8) < 1e-12,
    'January to August 2026, averaged: September is not out yet');
  assert.ok(Math.abs(september.annual - 0.0577) < 0.0001, '5.77%, not the 7.98% of annualising January');
  assert.equal(september.firstMonth, '2026-01');
  assert.equal(september.lastMonth, '2026-08');
  assert.equal(inflationReference(IPC, '2026-01-01', '2026-09-24').annual, september.annual,
    'the whole year so far is the same average');
});

test('with nothing of the year published, last December; never another year', () => {
  const only2025 = IPC.filter(one => one.month < '2026-01');
  const early = inflationReference(only2025, '2026-01-01', '2026-01-05');
  assert.equal(early.borrowed, '2025-12');
  assert.ok(Math.abs(early.annual - 0.0510) < 0.0001);

  // March 2026 is measured with January to March 2026 only.
  const march = inflationReference(IPC, '2026-03-01', '2026-03-31');
  assert.ok(Math.abs(march.annual - (annualOf('2026-01') + annualOf('2026-02') + annualOf('2026-03')) / 3) < 1e-12);

  // Across a year end, each year with its own figures, by its days.
  const across = inflationReference(IPC, '2025-12-01', '2026-01-31');
  const y2025 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    .map(m => annualOf(`2025-${m}`)).filter(Number.isFinite);   // the fixture starts in August 2024
  const avg2025 = y2025.reduce((a, b) => a + b) / y2025.length;
  assert.ok(Math.abs(across.annual - (avg2025 * 31 + annualOf('2026-01') * 31) / 62) < 1e-12);
  assert.equal(inflationReference(IPC, '2020-01-01', '2020-01-31'), null, 'before anything on record: nothing');
});

test('against inflation: the real return and what inflation took, on the same peso-days as the headline', () => {
  const facts = data({ inflation: IPC });
  const block = yieldVersusInflation(facts);
  const reference = inflationReference(IPC, '2026-09-01', '2026-09-24');
  const head = yieldHeadline(facts);
  const effective = figure(head, TEST_WORDS['report.yields.effective']).value / 100;
  const real = figure(block, TEST_WORDS['report.yields.inflation.real']).value / 100;
  assert.ok(Math.abs(real - ((1 + effective) / (1 + reference.annual) - 1)) < 0.0002);
  assert.ok(Math.abs(figure(block, TEST_WORDS['report.yields.inflation.rate']).value - 5.77) < 0.01);
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
    previous_return_on: null,
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

/**
 * Each return spread over the days since the one before (the fund's window
 * opens on 1 July): 600,000 over 1-10 July, -150,000 over 11-20 July,
 * 700,000 over 21 July-28 August (39 days), 300,000 over 29 August-4
 * September (7 days), -50,000 over 5-18 September.
 */
const part = (amount, days, span) => amount * days / span;
const FUND_SEPTEMBER = part(300_000_00, 4, 7) - 50_000_00;
const FUND_JULY = 600_000_00 - 150_000_00 + part(700_000_00, 11, 39);
const FUND_AUGUST_TO_24 = part(700_000_00, 24, 39);

test('what an investment earned is only what it wrote down as a return, never what was put in', () => {
  const plain = yieldHeadline(data());
  const block = yieldHeadline(withFund());
  const net = figure(block, TEST_WORDS['report.yields.net']).minor;
  assert.ok(Math.abs(net - figure(plain, TEST_WORDS['report.yields.net']).minor - FUND_SEPTEMBER) <= 1,
    'the part of each return that falls in September; the bill paid from it is not a loss');
  assert.ok(Math.abs(figure(block, TEST_WORDS['report.yields.invested']).minor - FUND_SEPTEMBER) <= 1);
  assert.equal(figure(block, TEST_WORDS['report.yields.interest']).minor, figure(plain, TEST_WORDS['report.yields.net']).minor,
    'interest and the investment are told apart');
});

test('a gain written down after a week is a week of gain, not one day', () => {
  // 700,000 written down once after 7 days, or 100,000 every day: the same
  // yearly rate, because it is measured over the days it covers.
  const lump = { ...fund(), from: '2026-09-01', movements: [{ on_date: '2026-09-07', amount_minor: 700_000_00, is_return: 1 }] };
  const daily = { ...fund(), from: '2026-09-01', movements: Array.from({ length: 7 }, (_, at) => ({
    on_date: `2026-09-0${at + 1}`, amount_minor: 100_000_00, is_return: 1 })) };
  const rate = investment => figure(yieldHeadline(data({
    account: account(3, 'Fiducuenta'), accounts: [account(3, 'Fiducuenta')], products: [], days: [],
    investments: [investment], period: { kind: 'range', from: '2026-09-01', to: '2026-09-07' },
  })), TEST_WORDS['report.yields.effective']).value;
  assert.ok(Math.abs(rate(lump) - rate(daily)) < 0.2, `${rate(lump)} against ${rate(daily)}`);
});

test('the yearly rate is measured in peso-days: money counts only the days it was earning', () => {
  // A fund on record all of September beside a product worked out for its
  // last 10 days only: the product's balance must not be spread over 24 days.
  const late = walk({ account_id: 1, product_id: 10, from: '2026-09-15', days: 10, base: 1_000_000_000, rate: pct(10.5) });
  const facts = data({
    accounts: [account(1, 'Dale'), account(3, 'Fiducuenta')],
    products: [{ id: 10, account_id: 1, name: 'Alcancía' }],
    days: late,
    investments: [fund()],
  });
  const head = yieldHeadline(facts);
  const seen = late.filter(day => day.on_date <= '2026-09-24');
  const interest = seen.reduce((sum, day) => sum + day.net_minor, 0);
  const productCapital = seen.reduce((sum, day) => sum + day.balance_minor, 0);
  let fundCapital = 0;
  for (let d = 1; d <= 24; d += 1) {
    const day = `2026-09-${String(d).padStart(2, '0')}`;
    fundCapital += 100_000_000_00 + fund().movements.filter(m => m.on_date <= day).reduce((sum, m) => sum + m.amount_minor, 0);
  }
  const expected = (Math.pow(1 + (interest + FUND_SEPTEMBER) / (productCapital + fundCapital), 365) - 1) * 100;
  const effective = figure(head, TEST_WORDS['report.yields.effective']).value;
  assert.ok(Math.abs(effective - expected) < 0.01, `${effective} against ${expected}`);
});

test('an investment alone: its return on the money that was in it', () => {
  const block = yieldHeadline(data({
    account: account(3, 'Fiducuenta'), accounts: [account(3, 'Fiducuenta')], products: [], days: [], investments: [fund()],
  }));
  assert.ok(Math.abs(figure(block, TEST_WORDS['report.yields.net']).minor - FUND_SEPTEMBER) <= 1);
  const effective = figure(block, TEST_WORDS['report.yields.effective']).value;
  assert.ok(effective > 1 && effective < 3, `${effective}`);
});

test('the investment is a row of its own, and every chart counts it', () => {
  const where = yieldByWhere(withFund());
  const row = where.rows.find(one => one.label === 'Fiducuenta');
  assert.ok(Math.abs(row.value.minor - FUND_SEPTEMBER) <= 1);
  assert.match(row.note, /inversión/);

  const months = yieldByMonth(withFund());
  const plainMonths = yieldByMonth(data());
  assert.ok(Math.abs(months.points[0].value.minor - plainMonths.points[0].value.minor - FUND_JULY) <= 1);

  const growth = yieldGrowth(withFund());
  const plainGrowth = yieldGrowth(data());
  // August closed 10.7 million above July in the fund: 10 million put in and 700,000 written down.
  assert.equal(growth.points[1].value.minor - plainGrowth.points[1].value.minor, 10_700_000_00);

  const before = yieldVersusBefore(withFund());
  const againstAugust = before.rows.find(one => one.label === 'Fiducuenta');
  assert.ok(Math.abs(againstAugust.before.minor - FUND_AUGUST_TO_24) <= 1, 'the first 24 days of August');
  assert.ok(Math.abs(againstAugust.now.minor - FUND_SEPTEMBER) <= 1);
});

// --- Before the app worked an account out ----------------------------------

test('the days before an account was worked out are estimated from its balance and its first rate', () => {
  const worked = walk({ account_id: 1, product_id: 10, from: '2026-09-01', days: 24, base: 1_500_000_000, rate: pct(10.5) });
  const ledger = {
    account_id: 1, from: '2026-08-01', opening_minor: 1_000_000_000, previous_return_on: null,
    movements: [{ on_date: '2026-08-15', amount_minor: 500_000_000, is_return: 0 }],
  };
  const estimated = estimateBeforeRecord(worked, [ledger], new Map([[1, '2026-01-01']]), '2026-08-01', '2026-09-24');
  assert.equal(estimated.length, 31, 'every day of August');
  assert.ok(estimated.every(day => day.estimated && day.product_id === -1));
  assert.equal(estimated[0].balance_minor, 1_000_000_000);
  assert.equal(estimated[15].balance_minor, 1_500_000_000, 'the 16th earns on the close of the 15th');
  const first7 = worked.slice(0, 7);
  const daily = first7.reduce((s, d) => s + d.net_minor, 0) / first7.reduce((s, d) => s + d.balance_minor, 0);
  assert.equal(estimated[0].net_minor, Math.round(1_000_000_000 * daily));
  assert.ok(Math.abs(estimated[0].annual_rate_scaled / 1e6 - 0.105) < 0.0005, 'the rate it was earning: 10.5%');

  assert.deepEqual(estimateBeforeRecord(worked, [ledger], new Map([[1, '2026-01-01']]), '2026-09-01', '2026-09-24'), [],
    'nothing to estimate when the record already covers the window');
});

test('an estimate is counted, and said, apart from what was worked out', () => {
  const worked = walk({ account_id: 1, product_id: 10, from: '2026-09-10', days: 15, base: 1_000_000_000, rate: pct(10.5) });
  const ledger = { account_id: 1, from: '2026-09-01', opening_minor: 1_000_000_000, previous_return_on: null, movements: [] };
  const estimated = estimateBeforeRecord(worked, [ledger], new Map([[1, '2025-01-01']]), '2026-09-01', '2026-09-24');
  const facts = data({
    accounts: [account(1, 'Dale')], products: [{ id: 10, account_id: 1, name: 'Alcancía' }],
    days: [...estimated, ...worked],
  });
  const head = yieldHeadline(facts);
  const guessed = estimated.reduce((sum, day) => sum + day.net_minor, 0);
  assert.equal(figure(head, TEST_WORDS['report.yields.estimated']).minor, guessed);
  const notes = yieldNotes(facts);
  assert.ok(notes.lines.some(line => line.tone === 'warn' && /estimado/.test(line.text)));
  assert.ok(Math.abs(figure(head, TEST_WORDS['report.yields.effective']).value - 10.5) < 0.1, 'still the rate it was earning');
  assert.equal(yieldGrowth(facts), null, 'an estimate is not a balance on record');
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

test('each section says what it shows, on the screen and in the spreadsheet', () => {
  const facts = data();
  const blocks = buildYieldsReport(facts);
  assert.ok(blocks.length > 3);
  assert.ok(blocks.filter(block => block.kind !== 'note').every(block => block.about), 'every section but the notes');
  const xml = new TextDecoder().decode(yieldsWorkbook(facts, blocks));
  assert.ok(xml.includes(TEST_WORDS['report.yields.about.headline']), 'the line reaches the sheet');
});

// --- When the app knows less than the period asks about --------------------

test('an account the app only knows from part of the period is named, with the date', () => {
  // Any user: an account created in the app on 15 September, a period of all September.
  const late = walk({ account_id: 2, product_id: 20, from: '2026-09-15', days: 10, base: 200_000_000, rate: pct(9) });
  const early = walk({ account_id: 1, product_id: 10, from: '2026-08-01', days: 55, base: 1_000_000_000, rate: pct(10.5) });
  const notes = yieldNotes(data({ days: [...early, ...late] }));
  const line = notes.lines.find(one => /solo tiene información/.test(one.text));
  assert.ok(line, 'said');
  assert.equal(line.tone, 'warn');
  assert.match(line.text, /Nu desde el 15 de septiembre de 2026/);
  assert.doesNotMatch(line.text, /Dale/, 'an account on record all along is not named');

  // An account opened in the app's world on 15 September is missing nothing before it.
  const opened = yieldNotes(data({ days: [...early, ...late], accounts: [account(1, 'Dale'), account(2, 'Nu', 'COP', '2026-09-15')] }));
  assert.ok(!opened.lines.some(one => /solo tiene información/.test(one.text)), 'nothing is missing before an account existed');

  const quiet = yieldNotes(data());
  assert.ok(!quiet?.lines.some(one => /solo tiene información/.test(one.text)), 'nothing to say when every day is known');
});

test('an investment with no gain written down for over a month is named', () => {
  const stale = { ...fund(), movements: fund().movements.filter(one => one.on_date < '2026-08-01') };
  const notes = yieldNotes(withFund({ investments: [stale] }));
  assert.ok(notes.lines.some(one => one.tone === 'warn' && /Fiducuenta: la última ganancia o pérdida registrada es del 20 de julio/.test(one.text)));
  const fresh = yieldNotes(withFund());
  assert.ok(!fresh.lines.some(one => /la última ganancia o pérdida/.test(one.text)));
});

test('against the period before, an estimated side is said', () => {
  const worked = walk({ account_id: 1, product_id: 10, from: '2026-09-10', days: 15, base: 1_000_000_000, rate: pct(10.5) });
  const ledger = { account_id: 1, from: '2026-08-01', opening_minor: 1_000_000_000, previous_return_on: null, movements: [] };
  const estimated = estimateBeforeRecord(worked, [ledger], new Map([[1, '2025-01-01']]), '2026-08-01', '2026-09-24');
  const block = yieldVersusBefore(data({
    accounts: [account(1, 'Dale')], products: [{ id: 10, account_id: 1, name: 'Alcancía' }], days: [...estimated, ...worked],
  }));
  assert.match(block.caveat, /estimada/);
  assert.doesNotMatch(yieldVersusBefore(data()).caveat, /estimada/, 'nothing estimated, nothing said');
});
