// Runs every database test with the resolution hook already in place:
//
//   node tools/db/run-tests.mjs
//
// Once the Angular project exists this becomes an npm script. Until then it is
// the one command to remember. Regenerates the migration module first, so a
// stale statements.generated.ts can never be what the tests run against.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const generate = spawnSync(process.execPath, [join(HERE, 'build-migrations.mjs')], { stdio: 'inherit' });
if (generate.status !== 0) {
  process.exit(generate.status ?? 1);
}

const tests = readdirSync(HERE).filter(f => f.endsWith('.test.mjs')).map(f => join(HERE, f));
const run = spawnSync(
  process.execPath,
  ['--import', pathToFileURL(join(HERE, 'register-ts.mjs')).href, '--test', ...tests],
  { stdio: 'inherit' },
);
process.exit(run.status ?? 1);
