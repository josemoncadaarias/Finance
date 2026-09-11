// The arithmetic behind a daily yield.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/yield-math.test.mjs
//
// This is the part of the module that has to be right before anything is built
// on top of it. A wrong daily rate is not a visible bug: it produces a
// plausible number that is quietly a few percent off, every day, for years.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EA_SCALE, DAYS_IN_YEAR, dailyRate, dailyYieldMinor, bandFor,
  withholdingMinor, accrueDay, parsePercentToScaled, scaledPercentToString,
} from '../../src/app/core/yields/yield-math.ts';

/** 11.45% E.A., the way a bank quotes it, in the scale the app stores. */
const pct = p => Math.round((p / 100) * EA_SCALE);

test('the daily rate compounds back to the annual one', () => {
  // The whole point of an effective annual rate: 365 days of it is the year.
  for (const percent of [0.5, 4, 11.45, 12, 30]) {
    const daily = dailyRate(pct(percent));
    const year = Math.pow(1 + daily, DAYS_IN_YEAR) - 1;
    assert.ok(Math.abs(year - percent / 100) < 1e-12,
      `${percent}% E.A. compounded 365 times gave ${(year * 100).toFixed(9)}%`);
  }
});

test('the daily rate is not the annual one divided by 365', () => {
  // Dividing pays too little, because it ignores the compounding the quoted
  // rate already contains. At 12% the gap is about 5.4% of the daily figure -
  // small enough to look right, large enough to matter over five years.
  const daily = dailyRate(pct(12));
  const naive = 0.12 / 365;
  assert.ok(daily < naive);
  assert.ok(naive / daily > 1.05);
});

test('a day of yield on a real balance', () => {
  // 10,000,000.00 COP at 12% E.A.
  const yieldMinor = dailyYieldMinor(1_000_000_000, pct(12));
  assert.equal(yieldMinor, Math.round(1_000_000_000 * dailyRate(pct(12))));
  // Around 3,105 pesos a day; the exact cent is the assertion above.
  assert.ok(yieldMinor > 310_000 && yieldMinor < 311_000);
});

test('nothing is earned on nothing, and nothing on a debt', () => {
  assert.equal(dailyYieldMinor(0, pct(12)), 0);
  assert.equal(dailyYieldMinor(-500_000_000, pct(12)), 0, 'a debt does not pay its holder interest');
  assert.equal(dailyYieldMinor(1_000_000_000, 0), 0);
});

test('the result is always an integer number of cents', () => {
  for (const balance of [1, 7, 12_345, 999_999_999, 66_750_767_94]) {
    const y = dailyYieldMinor(balance, pct(11.45));
    assert.equal(Number.isInteger(y), true, `${balance} produced ${y}`);
  }
});

test('a band applies to the whole balance, and the bands do not overlap', () => {
  const bands = [
    { annual_rate_scaled: pct(2), min_balance_minor: 0, max_balance_minor: 500_000_000 },
    { annual_rate_scaled: pct(9), min_balance_minor: 500_000_000, max_balance_minor: null },
  ];

  assert.equal(bandFor(bands, 0).annual_rate_scaled, pct(2));
  assert.equal(bandFor(bands, 499_999_999).annual_rate_scaled, pct(2));
  // The upper end is exclusive, so exactly 5,000,000.00 belongs to the top band.
  assert.equal(bandFor(bands, 500_000_000).annual_rate_scaled, pct(9));
  assert.equal(bandFor(bands, 99_999_999_999).annual_rate_scaled, pct(9));
});

test('with no band in force there is no rate to apply', () => {
  assert.equal(bandFor([], 1_000_000_000), null);
  const day = accrueDay(1_000_000_000, null, null, false);
  assert.equal(day.gross_minor, 0);
  assert.equal(day.annual_rate_scaled, 0);
});

// ---------------------------------------------------------------------------
// Withholding
//
// The figures below are invented for the test. They are NOT the real UVT or
// the real rate: those come from the Estatuto Tributario, are entered by hand
// and marked confirmed, and this app never guesses them. What is tested here
// is the shape of the rule, not its content.
// ---------------------------------------------------------------------------

const RULE = { uvtValueMinor: 5_000_000, thresholdUvt: 2, percentScaled: pct(7), base: 'all' };

test('below the threshold nothing is withheld', () => {
  // Threshold: 2 UVT x 50,000.00 = 100,000.00
  assert.equal(withholdingMinor(9_999_999, RULE), 0);
});

test('at the threshold it already withholds', () => {
  // The norm says "un interes diario de 0.055 UVT o MAS", so the boundary
  // itself is inside the rule, not outside it.
  assert.equal(withholdingMinor(10_000_000, RULE), Math.round(10_000_000 * 0.07));
  assert.equal(withholdingMinor(10_000_001, RULE), Math.round(10_000_001 * 0.07));
});

test('the same day, if the rule taxed only the excess', () => {
  // Same numbers, one parameter different, a very different answer. Which one
  // is right is a question for the Estatuto and an accountant, which is
  // exactly why it is configuration and not code.
  const excess = { ...RULE, base: 'excess' };
  assert.equal(withholdingMinor(30_000_000, excess), Math.round(20_000_000 * 0.07));
  assert.equal(withholdingMinor(30_000_000, RULE), Math.round(30_000_000 * 0.07));
});

test('missing parameters mean unknown, not zero', () => {
  assert.equal(withholdingMinor(30_000_000, null), null);

  const day = accrueDay(1_000_000_000, { annual_rate_scaled: pct(12), min_balance_minor: 0, max_balance_minor: null }, null, true);
  assert.equal(day.withholding_unknown, true);
  assert.equal(day.withholding_minor, 0);
  assert.equal(day.net_minor, day.gross_minor, 'the yield still accrues; the withholding is flagged');
});

test('cashback-style accounts do not withhold at all', () => {
  const band = { annual_rate_scaled: pct(12), min_balance_minor: 0, max_balance_minor: null };
  const day = accrueDay(1_000_000_000, band, RULE, false);
  assert.equal(day.withholding_minor, 0);
  assert.equal(day.withholding_unknown, false, 'not withholding is an answer, not a gap');
  assert.equal(day.net_minor, day.gross_minor);
});

test('net is always gross minus withholding, which the schema also checks', () => {
  const band = { annual_rate_scaled: pct(30), min_balance_minor: 0, max_balance_minor: null };
  const day = accrueDay(50_000_000_000, band, RULE, true);
  assert.ok(day.withholding_minor > 0);
  assert.equal(day.net_minor, day.gross_minor - day.withholding_minor);
});

// ---------------------------------------------------------------------------
// Typing a rate in
// ---------------------------------------------------------------------------

test('a rate typed the Colombian way lands on the right integer', () => {
  // A percent scaled by 10,000 is the same number as a fraction scaled by a
  // million, which is what the column holds.
  assert.equal(parsePercentToScaled('10,5'), 105000);
  assert.equal(parsePercentToScaled('10.5'), 105000, 'a dot works too');
  assert.equal(parsePercentToScaled('9,25'), 92500);
  assert.equal(parsePercentToScaled('11'), 110000);
  assert.equal(parsePercentToScaled('3,1'), 31000);
  assert.equal(parsePercentToScaled('7,5'), 75000);
  assert.equal(parsePercentToScaled('0'), 0);
  assert.equal(parsePercentToScaled(' 10,5 % '), 105000, 'a stray sign or space is fine');
});

test('these are the same numbers migration 005 seeded', () => {
  // The rates Jose read off his accounts on 2026-09-09, typed rather than
  // written into SQL. They have to agree, or a rate edited in the app would
  // silently differ from the one it replaced.
  const seeded = { '9': 90000, '10,5': 105000, '10': 100000, '11': 110000,
                   '7,5': 75000, '9,25': 92500, '8': 80000, '3,1': 31000,
                   '2': 20000, '4': 40000, '5': 50000 };
  for (const [typed, stored] of Object.entries(seeded)) {
    assert.equal(parsePercentToScaled(typed), stored, typed);
  }
});

test('a rate that is not a rate is refused rather than guessed at', () => {
  for (const bad of ['', '  ', 'abc', '10,5,5', '-3', '.', '10,12345']) {
    assert.throws(() => parsePercentToScaled(bad), `should have refused: "${bad}"`);
  }
});

test('a stored rate goes back into the field it came from', () => {
  for (const scaled of [90000, 105000, 92500, 31000, 0, 110000]) {
    assert.equal(parsePercentToScaled(scaledPercentToString(scaled)), scaled);
  }
  assert.equal(scaledPercentToString(105000), '10.5', 'no trailing zeros to edit around');
  assert.equal(scaledPercentToString(110000), '11');
});

test('a CDT has no threshold: 7% of every peso of yield', async () => {
  const { ruleForProduct } = await import('../../src/app/core/yields/yield-math.ts');
  const cdt = ruleForProduct('cdt', RULE);

  assert.equal(withholdingMinor(9_999_999, cdt), Math.round(9_999_999 * 0.07),
    'below the savings threshold, and still withheld');
  assert.equal(withholdingMinor(9_999_999, ruleForProduct('high_yield', RULE)), 0,
    'the savings rule is exactly what it was');
  assert.equal(ruleForProduct('cdt', null), null, 'missing parameters are still unknown, not zero');
});
