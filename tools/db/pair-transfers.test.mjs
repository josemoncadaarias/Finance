// Tests for rebuilding transfers from Monefy's mirror rows.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/pair-transfers.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseMonefyCsv } from '../../src/app/core/database/import/monefy-csv.ts';
import { pairTransfers, findGhostAccounts } from '../../src/app/core/database/import/pair-transfers.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_EXPORT = join(HERE, '..', '..', 'data', 'monefy-2026-09-08.csv');
const HEADER = 'date,account,category,amount,currency,converted amount,currency,description';

function csv(...lines) {
  const text = [HEADER, ...lines].join('\r\n');
  return Uint8Array.from([...text].map(c => c.charCodeAt(0)));
}

/** `To 'B'` on A: money leaving A. */
const out = (date, from, to, amount, description = '') =>
  `${date},${from},To '${to}',"${amount}",COP,"${amount}",COP,${description}`;

/** `From 'A'` on B: the same money arriving at B. */
const into = (date, to, from, amount, description = '') =>
  `${date},${to},From '${from}',"${amount}",COP,"${amount}",COP,${description}`;

const pairOf = source => pairTransfers(parseMonefyCsv(source).rows);

test('two halves on the same day pair exactly', () => {
  const result = pairOf(csv(
    out('13/08/2024', 'Rappi cuenta', 'ARQ', '-100,000', 'Transferencia a dolarapp'),
    into('13/08/2024', 'ARQ', 'Rappi cuenta', '100,000', 'Transferencia a dolarapp'),
  ));

  assert.equal(result.pairs.length, 1);
  assert.equal(result.unpairedOut.length, 0);
  assert.equal(result.unpairedIn.length, 0);

  const [pair] = result.pairs;
  assert.equal(pair.method, 'exact');
  assert.equal(pair.dayGap, 0);
  assert.equal(pair.out.account, 'Rappi cuenta');
  assert.equal(pair.into.account, 'ARQ');
  assert.equal(pair.out.amountMinor, -10000000);
  assert.equal(pair.into.amountMinor, 10000000);
});

test('halves recorded a couple of days apart still pair, but say so', () => {
  const result = pairOf(csv(
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('15/08/2024', 'Nequi', 'Bancolombia', '50,000'),
  ));

  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].method, 'near_date');
  assert.equal(result.pairs[0].dayGap, 2);
});

test('halves too far apart are left alone rather than guessed at', () => {
  const result = pairOf(csv(
    out('01/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('20/08/2024', 'Nequi', 'Bancolombia', '50,000'),
  ));

  assert.equal(result.pairs.length, 0);
  assert.equal(result.unpairedOut.length, 1);
  assert.equal(result.unpairedIn.length, 1);
});

test('the accounts have to name each other', () => {
  // Same day, same amount, but the incoming half came from somewhere else.
  const result = pairOf(csv(
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('13/08/2024', 'Nequi', 'Efectivo', '50,000'),
  ));

  assert.equal(result.pairs.length, 0);
  assert.equal(result.unpairedOut.length, 1);
  assert.equal(result.unpairedIn.length, 1);
});

test('amounts have to agree', () => {
  const result = pairOf(csv(
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('13/08/2024', 'Nequi', 'Bancolombia', '49,000'),
  ));
  assert.equal(result.pairs.length, 0);
});

test('two identical transfers on one day become two transfers, not one', () => {
  // This is real: the backup has 13/08/2024 Rappi -> ARQ twice for 100,000.
  const result = pairOf(csv(
    out('13/08/2024', 'Rappi cuenta', 'ARQ', '-100,000', 'Transferencia a dolarapp'),
    out('13/08/2024', 'Rappi cuenta', 'ARQ', '-100,000', 'Transferencia a dolarapp'),
    into('13/08/2024', 'ARQ', 'Rappi cuenta', '100,000', 'Transferencia a dolarapp'),
    into('13/08/2024', 'ARQ', 'Rappi cuenta', '100,000', 'Transferencia a dolarapp'),
  ));

  assert.equal(result.pairs.length, 2, 'both must survive; collapsing them loses money');
  assert.equal(result.unpairedOut.length, 0);
  assert.equal(result.unpairedIn.length, 0);
  // Each incoming row is used once and once only.
  assert.notEqual(result.pairs[0].into, result.pairs[1].into);
});

test('an incoming half is never claimed twice', () => {
  const result = pairOf(csv(
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('13/08/2024', 'Nequi', 'Bancolombia', '50,000'),
  ));

  assert.equal(result.pairs.length, 1);
  assert.equal(result.unpairedOut.length, 1, 'the second outgoing row has nothing to pair with');
  assert.equal(result.unpairedIn.length, 0);
});

test('an exact match is preferred over a near one', () => {
  const result = pairOf(csv(
    out('13/08/2024', 'Bancolombia', 'Nequi', '-50,000'),
    into('12/08/2024', 'Nequi', 'Bancolombia', '50,000'),
    into('13/08/2024', 'Nequi', 'Bancolombia', '50,000'),
  ));

  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].method, 'exact');
  assert.equal(result.pairs[0].into.occurredOn, '2024-08-13');
  assert.equal(result.unpairedIn.length, 1);
});

test('ordinary transactions are never treated as transfer halves', () => {
  const result = pairOf(csv(
    '26/06/2021,Bancolombia,Restaurante,"-50,200",COP,"-50,200",COP,Rappi',
    `25/06/2021,Nequi,Initial balance 'Nequi',"9,421.28",COP,"9,421.28",COP,`,
  ));

  assert.equal(result.pairs.length, 0);
  assert.equal(result.unpairedOut.length, 0);
  assert.equal(result.unpairedIn.length, 0);
});

test('pairs the real export', { skip: !existsSync(REAL_EXPORT) && 'export not present' }, () => {
  const parsed = parseMonefyCsv(readFileSync(REAL_EXPORT));
  const result = pairTransfers(parsed.rows);

  const outgoing = parsed.rows.filter(r => r.kind === 'transfer_out').length;
  const incoming = parsed.rows.filter(r => r.kind === 'transfer_in').length;

  // Nothing is lost and nothing is double-counted.
  assert.equal(result.pairs.length + result.unpairedOut.length, outgoing);
  assert.equal(result.pairs.length + result.unpairedIn.length, incoming);

  // No incoming row is used by two pairs.
  assert.equal(new Set(result.pairs.map(p => p.into)).size, result.pairs.length);
  assert.equal(new Set(result.pairs.map(p => p.out)).size, result.pairs.length);

  // Every pair moves money out of one account and into another.
  for (const pair of result.pairs) {
    assert.ok(pair.out.amountMinor <= 0, 'the outgoing half must not be positive');
    assert.ok(pair.into.amountMinor >= 0, 'the incoming half must not be negative');
    assert.equal(Math.abs(pair.out.amountMinor), Math.abs(pair.into.amountMinor));
    assert.notEqual(pair.out.account, pair.into.account, 'a transfer needs two accounts');
  }

  const byMethod = result.pairs.reduce((counts, pair) => {
    counts[pair.method] = (counts[pair.method] ?? 0) + 1;
    return counts;
  }, {});

  console.log(
    `    real export: ${result.pairs.length} transfers ` +
    `(${JSON.stringify(byMethod)}), ` +
    `unpaired ${result.unpairedOut.length} out / ${result.unpairedIn.length} in`,
  );
});

test('an account referred to but never present is recognised as a ghost', () => {
  const parsed = parseMonefyCsv(csv(
    out('15/07/2021', 'Bancolombia', 'Renta Fija Plazo', '-500,000', 'Ingreso fondo'),
    out('29/07/2021', 'Bancolombia', 'Renta Fija Plazo', '-500,000', 'Traslado'),
    into('13/06/2022', 'Bancolombia', 'Renta Fija Plazo', '1,200,000', 'Cancelacion fondo'),
    out('13/08/2024', 'Rappi cuenta', 'ARQ', '-100,000'),
    into('13/08/2024', 'ARQ', 'Rappi cuenta', '100,000'),
  ));

  const ghosts = findGhostAccounts(parsed.rows, parsed.accounts);
  assert.equal(ghosts.length, 1, 'ARQ is a real account and must not be a ghost');

  const [fund] = ghosts;
  assert.equal(fund.name, 'Renta Fija Plazo');
  assert.equal(fund.receivedRows, 2);
  assert.equal(fund.sentRows, 1);
  assert.equal(fund.firstSeen, '2021-07-15');
  assert.equal(fund.lastSeen, '2022-06-13');
  // It took in 1,000,000 and gave back 1,200,000: it ends 200,000 in credit.
  assert.equal(fund.netMinor, 100000000 - 120000000);
});

test('every unpaired row in the real export is explained by a ghost account',
  { skip: !existsSync(REAL_EXPORT) && 'export not present' }, () => {
  const parsed = parseMonefyCsv(readFileSync(REAL_EXPORT));
  const result = pairTransfers(parsed.rows);
  const ghostNames = new Set(findGhostAccounts(parsed.rows, parsed.accounts).map(g => g.name));

  const unpaired = [...result.unpairedOut, ...result.unpairedIn];
  const unexplained = unpaired.filter(row => !ghostNames.has(row.counterparty));

  assert.equal(unexplained.length, 0,
    `these unpaired rows name an account that does exist: ${unexplained.map(r => r.lineNumber).join(', ')}`);

  // And no successfully paired transfer involves one.
  assert.equal(result.pairs.filter(p => ghostNames.has(p.out.counterparty)).length, 0);

  console.log(`    real export: ${unpaired.length} unpaired rows, all explained by ${ghostNames.size} deleted accounts`);
});
