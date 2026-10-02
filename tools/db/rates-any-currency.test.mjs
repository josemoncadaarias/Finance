// Any currency the ECB publishes is valued in pesos as its dollar value
// times the TRM (Jose, 2026-10-02); one it does not publish has no value,
// never a guess. Answers are faked: no network here.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/rates-any-currency.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { rateToPesosOn } from '../../src/app/core/rates/historical-rates.ts';

const fake = (usdPer) => async (url) => {
  if (url.includes('datos.gov.co')) return { ok: true, json: async () => [{ valor: '4000.50' }] };
  const base = /base=([A-Z]+)/.exec(url)?.[1];
  const rate = usdPer[base];
  return rate === undefined
    ? { ok: false, json: async () => ({}) }
    : { ok: true, json: async () => ({ rates: { USD: rate } }) };
};

test('the dollar is the TRM; the euro, the pound and the real are their dollar value times it', async () => {
  const f = fake({ EUR: 1.1648, GBP: 1.3412, BRL: 0.18765 });
  assert.deepEqual(await rateToPesosOn('USD', '2026-10-02', f), { rate_scaled: 40_005_000, source: 'trm' });
  assert.deepEqual(await rateToPesosOn('EUR', '2026-10-02', f), { rate_scaled: Math.round(116_480 * 40_005_000 / 100_000), source: 'ecb-trm' });
  assert.deepEqual(await rateToPesosOn('GBP', '2026-10-02', f), { rate_scaled: Math.round(134_120 * 40_005_000 / 100_000), source: 'ecb-trm' });
  assert.equal((await rateToPesosOn('BRL', '2026-10-02', f)).rate_scaled, Math.round(18_765 * 40_005_000 / 100_000));
});

test('a currency the ECB does not publish, and the peso itself, have no value from here', async () => {
  const f = fake({});
  assert.equal(await rateToPesosOn('ARS', '2026-10-02', f), null);
  assert.equal(await rateToPesosOn('COP', '2026-10-02', f), null);
});
