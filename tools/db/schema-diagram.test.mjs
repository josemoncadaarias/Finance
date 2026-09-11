// Keeps docs/06-schema.md honest.
//
//   node --test tools/db/schema-diagram.test.mjs
//
// A diagram that drifts from the schema is worse than no diagram: it is
// confidently wrong. So the real schema is applied to a database and the
// document is checked against what actually exists - every table, every
// foreign key, every index.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');
const DIAGRAM = join(HERE, '..', '..', 'docs', '06-schema.md');

function realSchema() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  // Every migration, not only the first: the diagram documents the schema a
  // phone actually ends up with.
  for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all().map(r => r.name);

  const foreignKeys = [];
  const indexes = [];
  for (const table of tables) {
    for (const fk of db.prepare(`PRAGMA foreign_key_list(${table})`).all()) {
      foreignKeys.push({ from: table, column: fk.from, to: fk.table, onDelete: fk.on_delete });
    }
    for (const index of db.prepare(`PRAGMA index_list(${table})`).all()) {
      if (index.origin !== 'c') continue;
      indexes.push(index.name);
    }
  }

  return { tables, foreignKeys, indexes };
}

const diagram = readFileSync(DIAGRAM, 'utf8');
const schema = realSchema();

test('the document has a mermaid ER diagram', () => {
  assert.match(diagram, /```mermaid\r?\nerDiagram/);
});

test('every table in the schema appears in the diagram', () => {
  const block = diagram.slice(diagram.indexOf('erDiagram'), diagram.indexOf('```', diagram.indexOf('erDiagram')));
  const missing = schema.tables.filter(table => !new RegExp(`\\b${table}\\b`).test(block));
  assert.deepEqual(missing, [], 'tables missing from the diagram');
  // The prose opens with a count, and a diagram that has quietly fallen a
  // table behind is the kind of document people stop trusting. Read from the
  // page rather than written here, so adding a table means updating the page
  // and nothing else.
  const said = Number(/^The (\d+) tables/m.exec(diagram)?.[1]);
  assert.equal(schema.tables.length, said,
    `the prose says ${said} tables and the schema has ${schema.tables.length}`);
});

test('the diagram invents no table', () => {
  const block = diagram.slice(diagram.indexOf('erDiagram'), diagram.indexOf('```', diagram.indexOf('erDiagram')));
  // Entity blocks are declared as `name {`.
  const declared = [...block.matchAll(/^\s{4}(\w+)\s*\{/gm)].map(m => m[1]);
  const unknown = declared.filter(name => !schema.tables.includes(name));
  assert.deepEqual(unknown, [], 'the diagram declares tables that do not exist');
});

test('every foreign key is drawn as a relationship', () => {
  const block = diagram.slice(diagram.indexOf('erDiagram'), diagram.indexOf('```', diagram.indexOf('erDiagram')));
  const relationships = [...block.matchAll(/^\s{4}(\w+)\s+\|\|--o[{|]\s+(\w+)\s*:/gm)]
    .map(m => `${m[2]}->${m[1]}`);

  const missing = [];
  for (const fk of schema.foreignKeys) {
    if (!relationships.includes(`${fk.from}->${fk.to}`)) {
      missing.push(`${fk.from}.${fk.column} -> ${fk.to}`);
    }
  }
  assert.deepEqual(missing, [], 'foreign keys with no line in the diagram');
});

test('every foreign key column is listed on its entity', () => {
  // Asserted as a list rather than one match per column: a failed `match`
  // prints the whole document, which buries the one line that is wrong.
  const unmarked = schema.foreignKeys
    .filter(fk => !new RegExp(`${fk.column}\\s+(PK, )?FK`).test(diagram))
    .map(fk => `${fk.from}.${fk.column}`);

  assert.deepEqual(unmarked, [], 'foreign key columns not marked FK in the diagram');
});

test('every explicitly created index is documented', () => {
  const missing = schema.indexes.filter(name => !diagram.includes(name));
  assert.deepEqual(missing, [], 'indexes with no row in the table of indexes');
});

test('the delete rules described match the schema', () => {
  // Spot-checks of the claims the prose makes, against the real rules.
  const rule = (from, column) =>
    schema.foreignKeys.find(fk => fk.from === from && fk.column === column)?.onDelete;

  assert.equal(rule('transactions', 'account_id'), 'RESTRICT');
  assert.equal(rule('transactions', 'category_id'), 'RESTRICT');
  assert.equal(rule('transactions', 'transfer_id'), 'CASCADE');
  assert.equal(rule('transactions', 'import_batch_id'), 'SET NULL');
  assert.equal(rule('accounts', 'group_id'), 'SET NULL');
  assert.equal(rule('accounts', 'custom_icon_id'), 'RESTRICT');
  // The cushion. A reward with no purchase behind it is a figure nobody can
  // check, so it goes when the purchase does; a withdrawal outlives the
  // movement it became, so the cushion never quietly grows back.
  assert.equal(rule('cashback_entries', 'source_transaction_id'), 'CASCADE');
  assert.equal(rule('cashback_entries', 'account_id'), 'CASCADE');
  assert.equal(rule('cushion_withdrawals', 'transaction_id'), 'SET NULL');
  assert.equal(rule('yield_rates', 'account_id'), 'CASCADE');
  assert.equal(rule('yield_days', 'account_id'), 'CASCADE');
  assert.equal(rule('yield_days', 'pocket_id'), 'CASCADE');
  assert.equal(rule('yield_pocket_balances', 'pocket_id'), 'CASCADE');
  assert.equal(rule('review_queue', 'batch_id'), 'CASCADE');
});
