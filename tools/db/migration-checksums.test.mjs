// An applied migration is history and must never change.
//
//   node --test tools/db/migration-checksums.test.mjs
//
// The rule is written at the top of migration-runner.ts, and on 2026-09-09 it
// was broken anyway: a column was added to 004 after 004 had already run on
// Jose's phone. Editing it changed nothing there - a database past version 4
// never reads that file again - so the column simply did not exist, and the
// next migration failed with "table yield_rates has no column named
// requires_monthly_spend_minor". The app would not open.
//
// A rule that only lives in a comment gets broken. This is the same rule with
// teeth: every migration's contents are hashed and the hash is checked in. Any
// edit to a file that already exists fails here, immediately, on the machine
// that made it - instead of days later on a device.
//
// When the failure is legitimate, it is always the same fix: **add a new
// migration**, never edit an old one. Then record the new file's hash:
//
//   node tools/db/record-migration-checksums.mjs
//
// Changing an existing line in this JSON by hand is the one thing to be
// suspicious of. Adding a line is routine.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');
const CHECKSUMS = join(HERE, 'migration-checksums.json');

const recorded = JSON.parse(readFileSync(CHECKSUMS, 'utf8'));
const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

const hashOf = file =>
  createHash('sha256').update(readFileSync(join(MIGRATIONS, file))).digest('hex');

test('no migration that already shipped has been edited', () => {
  const changed = files
    .filter(file => recorded[file] !== undefined && recorded[file] !== hashOf(file));

  assert.deepEqual(changed, [],
    'these migrations changed after being recorded. A database that has already ' +
    'passed them will never see the change, and the next migration will fail on ' +
    'a device instead of here. Add a NEW migration instead.');
});

test('every migration has a recorded checksum', () => {
  const unrecorded = files.filter(file => recorded[file] === undefined);

  assert.deepEqual(unrecorded, [],
    'run: node tools/db/record-migration-checksums.mjs');
});

test('no recorded migration has been deleted or renamed', () => {
  // Deleting one is the same mistake wearing a different hat: every database
  // out there has a user_version that counts it.
  const missing = Object.keys(recorded).filter(file => !files.includes(file));

  assert.deepEqual(missing, [], 'recorded migrations that are no longer on disk');
});
