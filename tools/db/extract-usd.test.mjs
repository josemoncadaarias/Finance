// Tests for recovering dollar amounts from descriptions.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/extract-usd.test.mjs
//
// Every description quoted here is real, from data/monefy-2026-09-08.csv.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { findUsdMentions, assessUsdMention } from '../../src/app/core/database/import/extract-usd.ts';
import { parseMonefyCsv } from '../../src/app/core/database/import/monefy-csv.ts';
import { RATE_SCALE } from '../../src/app/core/database/money.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_EXPORT = join(HERE, '..', '..', 'data', 'monefy-2026-09-08.csv');

test('finds the dollar figure however it is written', () => {
  const cases = [
    ['Transferencia a dolarapp 500 usd', 50000],
    ['Transferencia a dolarapp 71.71 usd', 7171],
    ['Transferencia a dolarapp 0.87 usd', 87],
    ['Inversión etoro 250 usd', 25000],
    ['Suscripción anual google one (19.03 usd)', 1903],
    ['Transferencia a dolarapp 1683.07 usd', 168307],
    ['Compra 1 dólar airtm', 100],
    ['Retiro de 1,250.50 usd', 125050],
  ];

  for (const [description, expected] of cases) {
    const [mention] = findUsdMentions(description);
    assert.ok(mention, `nothing found in: ${description}`);
    assert.equal(mention.usdMinor, expected, description);
  }
});

test('does not invent a figure where there is none', () => {
  assert.deepEqual(findUsdMentions('Transferencia a dolarapp'), []);
  assert.deepEqual(findUsdMentions('Mercado OR'), []);
  assert.deepEqual(findUsdMentions(''), []);
  // A number stuck to a word is not an amount.
  assert.deepEqual(findUsdMentions('Cuenta XTB50 usda'), []);
});

test('accepts a figure whose implied rate is believable', () => {
  // 2,107,000 COP for 500 USD is 4,214.00 - a rate the file itself yields.
  const result = assessUsdMention('Transferencia a dolarapp 500 usd', 210700000);

  assert.equal(result.verdict, 'accepted');
  assert.equal(result.usdMinor, 50000);
  assert.equal(result.impliedRateScaled, 4214 * RATE_SCALE);
});

test('the sign of the peso amount does not matter', () => {
  const spent = assessUsdMention('Suscripción anual google one (19.03 usd)', -7900000);
  assert.equal(spent.verdict, 'accepted');
  assert.equal(spent.usdMinor, 1903);
});

test('rejects the figure that refers to something other than this row', () => {
  // Real row: XTB +400,000 COP, "Bono por nueva cuenta y fondeo de 600 usd".
  // The 600 dollars is what had to be deposited to earn the bonus, not the
  // bonus. Believed, it would imply 667 pesos to the dollar.
  const result = assessUsdMention('Bono por nueva cuenta y fondeo de 600 usd', 40000000);

  assert.equal(result.verdict, 'implausible_rate');
  // 400,000 COP against 600 USD: 666.67 per dollar, scaled by 10,000.
  assert.equal(result.impliedRateScaled, 6_666_667);
  assert.match(result.reason, /not a credible rate/);
  // The figure is still reported, so a human can see what was rejected.
  assert.equal(result.usdMinor, 60000);
});

test('refuses to choose when several figures are mentioned', () => {
  const result = assessUsdMention('Cambio 100 usd y luego 50 usd mas', 84000000);

  assert.equal(result.verdict, 'ambiguous');
  assert.equal(result.usdMinor, null, 'picking one would be a guess');
  assert.equal(result.mentions.length, 2);
});

test('says so when there is nothing to check against', () => {
  assert.equal(assessUsdMention('Transferencia a dolarapp', 210700000).verdict, 'absent');
  assert.equal(assessUsdMention('Ajuste 0 usd', 100).verdict, 'no_rate');
  assert.equal(assessUsdMention('Ajuste 10 usd', 0).verdict, 'no_rate');
});

test('judges the real export', { skip: !existsSync(REAL_EXPORT) && 'export not present' }, () => {
  const parsed = parseMonefyCsv(readFileSync(REAL_EXPORT));
  // Only rows that will land in a dollar account are worth reconstructing; a
  // transfer writes the same note on both halves, and the peso half must not
  // pick it up.
  const usdAccounts = new Set(['ARQ', 'eToro', 'XTB', 'Plenti']);

  const verdicts = {};
  const accepted = [];

  for (const row of parsed.rows) {
    if (!usdAccounts.has(row.account)) continue;
    const result = assessUsdMention(row.description, row.amountMinor);
    verdicts[result.verdict] = (verdicts[result.verdict] ?? 0) + 1;
    if (result.verdict === 'accepted') accepted.push({ row, result });
  }

  assert.ok(accepted.length > 0, 'the real file must yield usable dollar amounts');

  // Every accepted rate sits in the band the file's own derived rates occupy.
  for (const { result } of accepted) {
    assert.ok(result.impliedRateScaled >= 3000 * RATE_SCALE);
    assert.ok(result.impliedRateScaled <= 6000 * RATE_SCALE);
  }

  const rates = accepted.map(a => a.result.impliedRateScaled / RATE_SCALE).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];

  console.log(
    `    real export: ${JSON.stringify(verdicts)}; ` +
    `${accepted.length} usable, rates ${rates[0].toFixed(0)}-${rates[rates.length - 1].toFixed(0)} (median ${median.toFixed(0)})`,
  );
});
