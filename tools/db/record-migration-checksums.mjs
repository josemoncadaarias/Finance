// Records the checksum of every migration.
//
//   node tools/db/record-migration-checksums.mjs
//
// Run this after ADDING a migration. Never run it to make a failing checksum
// test pass: that test failing means an already-applied migration was edited,
// and the fix for that is a new migration, not a new hash. See
// migration-checksums.test.mjs.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');
const CHECKSUMS = join(HERE, 'migration-checksums.json');

const before = JSON.parse(readFileSync(CHECKSUMS, 'utf8'));
const after = {};

for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
  after[file] = createHash('sha256').update(readFileSync(join(MIGRATIONS, file))).digest('hex');
}

const changed = Object.keys(after).filter(file => before[file] && before[file] !== after[file]);
if (changed.length > 0) {
  console.error('Refusing to record. These migrations already had a checksum and changed:\n');
  for (const file of changed) console.error(`  ${file}`);
  console.error('\nA migration that has run somewhere cannot be edited. Add a new one instead.');
  process.exit(1);
}

writeFileSync(CHECKSUMS, `${JSON.stringify(after, null, 2)}\n`);

const added = Object.keys(after).filter(file => !before[file]);
console.log(added.length > 0
  ? `Recorded: ${added.join(', ')}`
  : 'Nothing new to record.');
