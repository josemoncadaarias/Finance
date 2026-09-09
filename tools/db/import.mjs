// Imports a Monefy export into a real database file.
//
//   node --import ./tools/db/register-ts.mjs tools/db/import.mjs
//   node --import ./tools/db/register-ts.mjs tools/db/import.mjs data/monefy-2026-09-08.csv finance.db
//
// Defaults to the newest export in data/ and writes build/finance.db. Safe to
// run again: rows already stored are recognised and skipped, and anything
// edited by hand is left alone.
//
// The resulting file is plain SQLite. Open it with any SQLite browser, or:
//   node --input-type=module -e "import('node:sqlite').then(...)"

import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { importMonefy } from '../../src/app/core/database/import/import-monefy.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { formatMoney } from '../../src/app/core/database/money.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

/**
 * Sorts export file names chronologically.
 *
 * Plain string order is wrong here, and quietly so: `-` sorts before `.`, so
 * `monefy-2026-09-08-1748.csv` lands *before* `monefy-2026-09-08.csv` and the
 * older file wins. Sorting on the parsed date and time fixes it, and treats a
 * name with no time as the earliest that day - which is right, since the time
 * only gets added to the second export of a day.
 */
export function exportOrder(fileName) {
  const match = /^monefy-(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2}))?\.csv$/.exec(fileName);
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00'] = match;
  return `${year}${month}${day}${hour}${minute}`;
}

/** The newest export in data/, by the date and time in its name. */
export function newestExport(dataDir = join(ROOT, 'data')) {
  const dated = readdirSync(dataDir)
    .map(name => ({ name, order: exportOrder(name) }))
    .filter(entry => entry.order !== null)
    .sort((a, b) => a.order.localeCompare(b.order));

  if (dated.length === 0) {
    throw new Error(`No monefy-YYYY-MM-DD[-HHMM].csv found in ${dataDir}`);
  }
  return join(dataDir, dated[dated.length - 1].name);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {

const [, , csvArg, dbArg] = process.argv;
const csvPath = csvArg ? join(ROOT, csvArg) : newestExport();
const dbPath = dbArg ? join(ROOT, dbArg) : join(ROOT, 'build', 'finance.db');

mkdirSync(dirname(dbPath), { recursive: true });

const bytes = readFileSync(csvPath);
const fileHash = createHash('sha256').update(bytes).digest('hex');

console.log(`Reading  ${basename(csvPath)}  (${(bytes.length / 1024).toFixed(0)} KB)`);
console.log(`Writing  ${dbPath}${existsSync(dbPath) ? '  (exists; importing on top of it)' : ''}\n`);

const db = new NodeSqlDriver(dbPath);
const migration = await migrate(db, MIGRATION_SOURCES);
if (migration.applied.length > 0) {
  console.log(`Schema   migrated ${migration.from} -> ${migration.to}\n`);
}

const started = Date.now();
const summary = await importMonefy(db, bytes, { fileName: basename(csvPath), fileHash });
const elapsed = Date.now() - started;

console.log(`Imported ${summary.rowsRead} rows in ${elapsed} ms`);
console.log(`  inserted   ${summary.rowsInserted}`);
console.log(`  skipped    ${summary.rowsSkipped}  (already stored)`);
console.log(`  accounts   ${summary.accountsCreated} in ${summary.groupsCreated} multi-currency groups`);
console.log(`  categories ${summary.categoriesCreated}`);
console.log(`  transfers  ${summary.transfersCreated}  (${summary.synthesizedLegs} with a reconstructed leg)`);
console.log(`  dollars    ${summary.usdRecovered} read from descriptions, ${summary.usdEstimated} estimated`);
console.log(`  reviews    ${summary.reviewsRaised}`);

const accounts = new AccountsRepository(db);
const grouped = await accounts.balancesByGroup({ includeArchived: true });

console.log('\nBalances');
console.log('-'.repeat(62));
for (const entry of grouped) {
  if (entry.group) console.log(`  ${entry.group.name}`);
  for (const balance of entry.balances) {
    if (balance.balance_minor === 0 && !entry.group) continue;
    const { account } = balance;
    const label = (entry.group ? '    ' : '  ') + account.name + (account.archived ? ' (archived)' : '');
    const amount = formatMoney(balance.balance_minor, account.currency_code, { withSymbol: false });
    console.log(label.padEnd(42) + amount.padStart(16) + ' ' + account.currency_code);
    if (balance.available_credit_minor !== null) {
      console.log('  '.padEnd(42) +
        formatMoney(balance.available_credit_minor, account.currency_code, { withSymbol: false }).padStart(16) +
        ' available of ' + formatMoney(account.credit_limit_minor, account.currency_code, { withSymbol: false }));
    }
  }
}

const netWorth = await accounts.netWorthMinor();
console.log('-'.repeat(62));
console.log('  Net worth (COP, from frozen base amounts)'.padEnd(42) +
  formatMoney(netWorth, 'COP', { withSymbol: false }).padStart(16));
console.log('\n  Note: the brokers show what was put in, not what they are worth');
console.log('  today. See docs/01-monefy-backup-analysis.md.');

const reviews = await db.query(
  'SELECT kind, COUNT(*) AS n FROM review_queue WHERE resolved = 0 GROUP BY kind ORDER BY n DESC',
);
console.log('\nReview queue');
console.log('-'.repeat(62));
for (const review of reviews) {
  console.log('  ' + String(review.n).padStart(5) + '  ' + review.kind);
}

await db.close();
console.log(`\nDone. ${dbPath}`);

}
