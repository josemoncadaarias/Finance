// The SQL the app hands the SQLite plugin.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/plugin-sql.test.mjs
//
// The plugin does not run a migration as it is. In the browser, jeep-sqlite
// removes every newline from a string that mentions DELETE FROM, which turns
// the first comment into a comment over the whole migration; on a device the
// string is split on ";\n". Both are imitated here on sql.js - the same SQLite
// build the browser plugin runs - and every migration has to build exactly the
// database it builds when SQLite reads it directly.

import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';

import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { sqlForPlugin } from '../../src/app/core/database/plugin-sql.ts';

const SQL = await initSqlJs();

/** jeep-sqlite's `execute`, minus its rewrite of DELETE statements for sync tables, which none of ours are. */
function browserExec(db, sql) {
  const text = sql.toLowerCase().includes('delete from') ? sql.replace(/\n/g, '') : sql;
  db.exec(text);
}

/** The device plugin: one statement at a time, split on a semicolon at the end of a line. */
function deviceExec(db, sql) {
  for (const statement of sql.split(';\n')) {
    if (statement.trim().length > 0) db.exec(statement);
  }
}

/** Every table's columns, every index, and every row - what a migration leaves behind. */
function snapshot(db) {
  const names = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]
    .values.map(row => row[0]);
  const out = {};
  for (const name of names) {
    const columns = db.exec(`PRAGMA table_info("${name}")`)[0].values.map(row => `${row[1]} ${row[2]} ${row[3]} ${row[4]}`);
    const rows = db.exec(`SELECT * FROM "${name}"`)[0]?.values ?? [];
    out[name] = { columns, rows };
  }
  out.__indexes = (db.exec("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values ?? [])
    .map(row => row[0]);
  return out;
}

function build(run) {
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATION_SOURCES) run(db, migration.sql);
  const result = snapshot(db);
  db.close();
  return result;
}

const reference = build((db, sql) => db.exec(sql));

test('every migration builds the same database through the browser plugin', () => {
  assert.deepEqual(build((db, sql) => browserExec(db, sqlForPlugin(sql))), reference);
});

test('and through the device plugin', () => {
  assert.deepEqual(build((db, sql) => deviceExec(db, sqlForPlugin(sql))), reference);
});

test('without the rewrite, the browser plugin silently skipped migration 030', () => {
  // The failure this exists for, kept on record: no error, and no column.
  const broken = build((db, sql) => browserExec(db, sql));
  const columns = broken.yield_pockets.columns.map(column => column.split(' ')[0]);
  assert.equal(columns.includes('payout'), false);
});

test('a comment marker inside a quoted string is not a comment', () => {
  assert.equal(sqlForPlugin("INSERT INTO t VALUES ('a -- b'); -- gone\n"), "INSERT INTO t VALUES ('a -- b');\n");
  assert.equal(sqlForPlugin("SELECT 1\nFROM t;\n"), 'SELECT 1 \nFROM t;\n');
});
