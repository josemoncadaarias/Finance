// Compares two Monefy CSV exports.
//
//   node --import ./tools/db/register-ts.mjs tools/db/compare-exports.mjs OLD.csv NEW.csv
//
// This exists to settle the one assumption the re-import design rests on: that
// Monefy exports rows in a stable order, so a row keeps its import_seq slot
// from one export to the next. It also reports what actually changed between
// two exports, which is what the importer will have to deal with.
//
// Read-only. It touches no database and writes no files.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { parseAmountToMinor } from '../../src/app/core/database/money.ts';
import { fingerprintOf, assignSequences, formatFingerprint }
  from '../../src/app/core/database/import/fingerprint.ts';

const [, , oldPath, newPath] = process.argv;
if (!oldPath || !newPath) {
  console.error('Usage: node --import ./tools/db/register-ts.mjs tools/db/compare-exports.mjs OLD.csv NEW.csv');
  process.exit(1);
}

/** Splits one CSV line, honouring the quotes Monefy puts around amounts. */
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** `dd/mm/yyyy` -> `yyyy-mm-dd`. Verified as the only format the CSV uses. */
function toIsoDate(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) throw new Error(`Unexpected date format: ${JSON.stringify(raw)}`);
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** Monefy writes amounts with thousands separators: `-51,774.09`. */
function toMinor(raw) {
  return parseAmountToMinor(raw.replace(/,/g, '').trim());
}

function loadExport(path) {
  // The file is Windows-1252, not UTF-8. Reading it as UTF-8 mangles every
  // accent, and the account name is part of the fingerprint.
  const text = new TextDecoder('windows-1252').decode(readFileSync(path));
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  const [, ...dataLines] = lines;

  const rows = dataLines.map((line, index) => {
    const [date, account, category, amount, , , , ...rest] = splitCsvLine(line);
    const description = rest.join(',');
    return {
      lineNumber: index + 2,
      occurredOn: toIsoDate(date),
      account,
      category,
      amountMinor: toMinor(amount),
      description,
    };
  });

  const fingerprints = rows.map(row => fingerprintOf(row));
  const sequences = assignSequences(fingerprints);
  rows.forEach((row, index) => {
    row.fingerprint = fingerprints[index];
    row.seq = sequences[index];
    row.key = `${fingerprints[index]}#${sequences[index]}`;
  });

  return { path, rows };
}

function heading(text) {
  console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

const older = loadExport(oldPath);
const newer = loadExport(newPath);

console.log(`Comparing ${basename(oldPath)} (${older.rows.length} rows)`);
console.log(`     with ${basename(newPath)} (${newer.rows.length} rows)`);

// --- 1. Do existing rows keep their slot? -----------------------------------
//
// This is the check that matters, and it is narrower than "the file is in the
// same order". A row is recognised on re-import by its fingerprint plus its
// import_seq, and seq is its position *among rows sharing that fingerprint*.
// So a new row inserted in the middle is harmless: it only shifts seq numbers
// if it shares a fingerprint with rows after it.
//
// Positional order is reported too, but as information rather than a verdict:
// Monefy sorts by date, so a row added on a day that already has rows lands in
// the middle, and that is normal.
heading('1. Do the old rows keep their slots?');

const newerKeySet = new Set(newer.rows.map(row => row.key));
const lostSlot = older.rows.filter(row => !newerKeySet.has(row.key));

if (lostSlot.length === 0) {
  console.log(`SAFE: all ${older.rows.length} rows from the old export still hold the same`);
  console.log('      fingerprint and sequence number, so a re-import recognises every');
  console.log('      one of them and rewrites nothing.');
} else {
  console.log(`WARNING: ${lostSlot.length} row(s) no longer hold their slot.`);
  console.log('         A re-import would treat these as new and duplicate them.');
  for (const row of lostSlot.slice(0, 8)) {
    console.log(`  seq ${row.seq}  ${formatFingerprint(row.fingerprint)}`);
  }
}

let commonPrefix = 0;
while (
  commonPrefix < older.rows.length &&
  commonPrefix < newer.rows.length &&
  older.rows[commonPrefix].key === newer.rows[commonPrefix].key
) {
  commonPrefix += 1;
}

console.log('');
if (commonPrefix === older.rows.length) {
  console.log(`Positions: the old export is an exact prefix of the new one; the`);
  console.log(`           ${newer.rows.length - commonPrefix} new row(s) were appended at the end.`);
} else {
  console.log(`Positions: they diverge at row ${commonPrefix + 1}, which is expected — Monefy`);
  console.log('           keeps the file in date order, so a row added on a day that already');
  console.log('           had rows is inserted rather than appended. Harmless on its own;');
  console.log('           the check above is the one that matters.');
}

// --- 2. What changed --------------------------------------------------------
heading('2. Rows added, removed and unchanged');

const olderKeys = new Map(older.rows.map(row => [row.key, row]));
const newerKeys = new Map(newer.rows.map(row => [row.key, row]));

const added = newer.rows.filter(row => !olderKeys.has(row.key));
const removed = older.rows.filter(row => !newerKeys.has(row.key));

console.log(`unchanged: ${older.rows.length - removed.length}`);
console.log(`added:     ${added.length}`);
console.log(`missing:   ${removed.length}   <- edited or deleted inside Monefy`);

if (added.length > 0) {
  console.log('\nFirst few added:');
  for (const row of added.slice(0, 8)) {
    console.log(`  ${formatFingerprint(row.fingerprint)}`);
  }
  if (added.length > 8) console.log(`  ... and ${added.length - 8} more`);
}

if (removed.length > 0) {
  console.log('\nFirst few missing (these land in the review queue, never auto-deleted):');
  for (const row of removed.slice(0, 8)) {
    console.log(`  line ${row.lineNumber}: ${formatFingerprint(row.fingerprint)}`);
  }
  if (removed.length > 8) console.log(`  ... and ${removed.length - 8} more`);
}

// --- 3. Duplicate fingerprints ---------------------------------------------
heading('3. Legitimately identical rows');

function duplicateGroups({ rows }) {
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.fingerprint, (counts.get(row.fingerprint) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

const oldDuplicates = duplicateGroups(older);
const newDuplicates = duplicateGroups(newer);
console.log(`old export: ${oldDuplicates.length} fingerprints appear more than once`);
console.log(`new export: ${newDuplicates.length}`);

for (const [fingerprint, count] of newDuplicates.slice(0, 10)) {
  console.log(`  x${count}  ${formatFingerprint(fingerprint)}`);
}

// --- 4. Accounts and categories --------------------------------------------
heading('4. New accounts and categories');

function setOf(rows, field) {
  return new Set(rows.map(row => row[field]));
}

const newAccounts = [...setOf(newer.rows, 'account')].filter(a => !setOf(older.rows, 'account').has(a));
const oldCategories = setOf(older.rows, 'category');
const newCategories = [...setOf(newer.rows, 'category')].filter(c => !oldCategories.has(c));

console.log(`accounts:   ${setOf(newer.rows, 'account').size} total, ${newAccounts.length} new`);
if (newAccounts.length > 0) console.log(`  ${newAccounts.join(', ')}`);
console.log(`categories: ${setOf(newer.rows, 'category').size} total, ${newCategories.length} new`);
if (newCategories.length > 0) console.log(`  ${newCategories.slice(0, 20).join(', ')}`);

// --- 5. Date range ----------------------------------------------------------
heading('5. Date range');
const dates = newer.rows.map(row => row.occurredOn).sort();
console.log(`new export covers ${dates[0]} to ${dates[dates.length - 1]}`);
console.log(`old export ended  ${older.rows.map(r => r.occurredOn).sort().at(-1)}`);
