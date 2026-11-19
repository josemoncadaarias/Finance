// Alerts for strong moves of the shares held (2026-11-19). Invented tickers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertsFor, alertSettingsOf, keptTold } from '../../src/app/core/stocks/alerts.ts';

const TODAY = '2026-11-19';
const one = (symbol, dayPct, { day = TODAY, source = 'sheet', held = 1e8 } = {}) => ({
  position: { symbol, quantityE8: held, currency: 'USD' },
  quote: { priceE6: 10_000_000, previousE6: 9_000_000, day, source },
  valueMinor: 1000, gainMinor: 0, gainPct: 0, dayMinor: Math.round(dayPct * 10), dayPct,
});

test('a strong move of a share held rings once a day per direction', () => {
  const on = { on: true, pct: 5 };
  const list = [one('SOLR', 6.2), one('NUBE', -7.5), one('TECX', 4.9), one('MUNDO', 12, { day: '2026-11-18' }),
    one('RIOB', 9, { source: 'manual' }), one('VIEJA', 20, { held: 0 }), one('QUIETA', -5)];
  const found = alertsFor(list, on, TODAY, new Set());
  assert.deepEqual(found.map(a => a.symbol), ['NUBE', 'SOLR', 'QUIETA'], 'the biggest first; only today\'s fetched prices of what is held');
  assert.equal(found[0].key, `NUBE|${TODAY}|down`);
  // Told: nothing again, unless it turned the other way.
  const told = new Set(found.map(a => a.key));
  assert.deepEqual(alertsFor(list, on, TODAY, told), []);
  assert.deepEqual(alertsFor([one('SOLR', -6)], on, TODAY, told).map(a => a.symbol), ['SOLR']);
  // Off: nothing at all; a higher threshold: fewer.
  assert.deepEqual(alertsFor(list, { on: false, pct: 5 }, TODAY, new Set()), []);
  assert.deepEqual(alertsFor(list, { on: true, pct: 10 }, TODAY, new Set()), []);
});

test('the settings read back whatever was stored, and the told list keeps today only', () => {
  assert.deepEqual(alertSettingsOf(null), { on: false, pct: 5 });
  assert.deepEqual(alertSettingsOf('{"on":true,"pct":3}'), { on: true, pct: 3 });
  assert.deepEqual(alertSettingsOf('{"on":true,"pct":-2}'), { on: true, pct: 5 });
  assert.deepEqual(alertSettingsOf('nonsense'), { on: false, pct: 5 });
  assert.deepEqual(keptTold(['A|2026-11-18|up', `B|${TODAY}|down`], TODAY), [`B|${TODAY}|down`]);
});
