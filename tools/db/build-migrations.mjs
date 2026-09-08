// Turns the .sql migration files into a TypeScript module the app can import.
//
//   node tools/db/build-migrations.mjs
//
// The .sql files stay the single source of truth: they are what the schema
// tests run against and what a human reads. Angular's build cannot import a
// .sql file directly, so this writes their contents into a generated .ts file.
// Run it after editing any migration; CI and the pretest script both check
// that the generated file is up to date.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');
const OUTPUT = join(MIGRATIONS_DIR, 'statements.generated.ts');

/** `001_initial_schema.sql` -> { version: 1, name: 'initial_schema' } */
function parseName(fileName) {
  const match = /^(\d{3})_([a-z0-9_]+)\.sql$/.exec(fileName);
  if (!match) {
    throw new Error(`Migration file name must be NNN_snake_case.sql, got: ${fileName}`);
  }
  return { version: Number(match[1]), name: match[2] };
}

export function buildSource() {
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    throw new Error(`No .sql migrations found in ${MIGRATIONS_DIR}`);
  }

  const migrations = files.map(file => {
    const { version, name } = parseName(file);
    return { version, name, file, sql: readFileSync(join(MIGRATIONS_DIR, file), 'utf8') };
  });

  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(`Migrations must be numbered consecutively from 001; found ${migration.file} at position ${index + 1}`);
    }
  });

  const entries = migrations.map(({ version, name, file, sql }) => {
    // Backticks and ${ would end the template literal early. Neither appears in
    // SQL we write, but escaping them keeps a future migration from breaking
    // the build in a baffling way.
    const escaped = sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return `  {\n    version: ${version},\n    name: '${name}',\n    file: '${file}',\n    sql: \`${escaped}\`,\n  },`;
  });

  return `// GENERATED FILE - DO NOT EDIT.
// Produced by tools/db/build-migrations.mjs from the .sql files in this folder.
// Edit the .sql, then re-run: node tools/db/build-migrations.mjs

export interface MigrationSource {
  /** Matches PRAGMA user_version once applied. */
  version: number;
  name: string;
  file: string;
  sql: string;
}

export const MIGRATION_SOURCES: readonly MigrationSource[] = [
${entries.join('\n')}
];
`;
}

// Everything below is the command-line behaviour. It is guarded so that
// importing `buildSource` from a test does not write a file as a side effect.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

function main() {
const source = buildSource();

// `--check` verifies the committed file matches the .sql files without writing.
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(OUTPUT, 'utf8');
  } catch {
    console.error(`Missing ${OUTPUT}. Run: node tools/db/build-migrations.mjs`);
    process.exit(1);
  }
  if (current !== source) {
    console.error('statements.generated.ts is out of date. Run: node tools/db/build-migrations.mjs');
    process.exit(1);
  }
  console.log('statements.generated.ts is up to date.');
} else {
  writeFileSync(OUTPUT, source, 'utf8');
  console.log(`Wrote ${OUTPUT}`);
}
}
