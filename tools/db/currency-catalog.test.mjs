// The currencies a person can add (37c): one row per code, each with its
// flag and both names, and a search that finds them by code, name or country.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, searchCatalog, currencyName, flagOf } from '../../src/app/core/currencies/catalog.ts';

test('every code once, three capital letters, a flag and both names', () => {
  const seen = new Set();
  for (const one of CATALOG) {
    assert.match(one.code, /^[A-Z]{3}$/);
    assert.ok(!seen.has(one.code), `${one.code} twice`);
    seen.add(one.code);
    assert.ok(one.flag && one.es && one.en && one.symbol, one.code);
  }
  for (const code of ['COP', 'USD', 'EUR']) assert.ok(seen.has(code));
});

test('the dollar, the euro and the ECB list are worked out by the app', () => {
  for (const code of ['USD', 'EUR', 'GBP', 'MXN', 'BRL', 'JPY']) assert.equal(CATALOG.find(c => c.code === code).auto, true, code);
  for (const code of ['CLP', 'PEN', 'ARS']) assert.equal(CATALOG.find(c => c.code === code).auto, false, code);
});

test('search by code, name in either language, accents or country', () => {
  assert.equal(searchCatalog('eur')[0].code, 'EUR');
  assert.ok(searchCatalog('peru').some(c => c.code === 'PEN'));
  assert.ok(searchCatalog('libra').some(c => c.code === 'GBP'));
  assert.ok(searchCatalog('pound').some(c => c.code === 'GBP'));
  assert.ok(searchCatalog('españa').some(c => c.code === 'EUR'));
  assert.equal(searchCatalog('').length, CATALOG.length);
  assert.equal(searchCatalog('zzzz').length, 0);
});

test('names follow the language; a code outside the list keeps its own', () => {
  assert.equal(currencyName('USD', 'Dólar', 'en'), 'US dollar');
  assert.equal(currencyName('XYZ', 'Mi moneda', 'en'), 'Mi moneda');
  assert.equal(flagOf('EUR'), '🇪🇺');
  assert.equal(flagOf('XYZ'), '');
});
