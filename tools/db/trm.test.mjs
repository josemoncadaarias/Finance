// Tests for the TRM client.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/trm.test.mjs
//
// Never touches the network: the fetcher is passed in. What matters here is
// what happens when the answer is wrong, because an invented rate would go
// straight into net worth.

import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchTrm, TrmError } from '../../src/app/core/rates/trm-client.ts';

/** A stand-in for fetch that answers with whatever is handed to it. */
function answering(body, { ok = true, status = 200 } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => body,
  });
}

test('a real answer becomes a dated rate in minor units', async () => {
  // Exactly what the service returned on 2026-09-10.
  const quotes = await fetchTrm(3, {
    fetcher: answering([
      { valor: '3099.48', unidad: 'COP', vigenciadesde: '2026-09-10T00:00:00.000',
        vigenciahasta: '2026-09-10T00:00:00.000' },
      { valor: '3116.47', unidad: 'COP', vigenciadesde: '2026-09-09T00:00:00.000',
        vigenciahasta: '2026-09-09T00:00:00.000' },
      { valor: '3126.08', unidad: 'COP', vigenciadesde: '2026-09-05T00:00:00.000',
        vigenciahasta: '2026-09-08T00:00:00.000' },
    ]),
  });

  assert.deepEqual(quotes[0], { on_date: '2026-09-10', rate_scaled: 30994800 });
  assert.deepEqual(quotes[1], { on_date: '2026-09-09', rate_scaled: 31164700 });

  // Friday's quote covers the weekend. It is stored under the day it starts,
  // and "the most recent on or before" does the rest.
  assert.equal(quotes[2].on_date, '2026-09-05');
});

test('a row that cannot be trusted is dropped, not defaulted', async () => {
  const quotes = await fetchTrm(5, {
    fetcher: answering([
      { valor: 'no es un número', vigenciadesde: '2026-09-10T00:00:00.000' },
      { valor: '0', vigenciadesde: '2026-09-09T00:00:00.000' },
      { valor: '-100', vigenciadesde: '2026-09-08T00:00:00.000' },
      { vigenciadesde: '2026-09-07T00:00:00.000' },
      { valor: '3100.00', vigenciadesde: 'ayer' },
      { valor: '3100.00', vigenciadesde: '2026-09-04T00:00:00.000' },
    ]),
  });

  // Only the last one survives, and nothing was invented for the rest.
  assert.equal(quotes.length, 1);
  assert.deepEqual(quotes[0], { on_date: '2026-09-04', rate_scaled: 31000000 });
});

test('nothing usable is an error, not an empty success', async () => {
  await assert.rejects(
    () => fetchTrm(1, { fetcher: answering([{ valor: 'x', vigenciadesde: 'y' }]) }),
    TrmError);

  await assert.rejects(() => fetchTrm(1, { fetcher: answering([]) }), TrmError);

  // Something that is not a list at all.
  await assert.rejects(() => fetchTrm(1, { fetcher: answering({ error: 'nope' }) }), TrmError);
});

test('a refusal or a dead network is an error the caller can act on', async () => {
  await assert.rejects(
    () => fetchTrm(1, { fetcher: answering([], { ok: false, status: 503 }) }),
    /answered 503/);

  await assert.rejects(
    () => fetchTrm(1, { fetcher: async () => { throw new Error('offline'); } }),
    /could not be fetched/);
});

test('the request asks for the newest quotes, and asks politely', async () => {
  let seen = '';
  await fetchTrm(400, {
    fetcher: async url => {
      seen = String(url);
      return { ok: true, status: 200, json: async () => [
        { valor: '3100.00', vigenciadesde: '2026-09-10T00:00:00.000' }] };
    },
  });

  assert.match(seen, /vigenciadesde%20DESC/, 'newest first');
  assert.match(seen, /\$limit=400/);

  // A limit nobody should be able to talk the service into.
  let big = '';
  await fetchTrm(100000, {
    fetcher: async url => {
      big = String(url);
      return { ok: true, status: 200, json: async () => [
        { valor: '3100.00', vigenciadesde: '2026-09-10T00:00:00.000' }] };
    },
  });
  assert.match(big, /\$limit=500/, 'capped');
});
