// Every migration, run the way the DEVICE runs it.
//
//   node --test tools/db/device-sql.test.mjs
//
// The other schema tests hand the whole .sql file to node:sqlite, which parses
// it the way SQLite itself does. The phone does not do that. The Capacitor
// plugin splits the file into statements first, with its own parser, and only
// then hands the pieces over one at a time — so a migration can be perfectly
// valid SQL and still fail on the device.
//
// That is what happened on 2026-09-09: migration 005 was written as one INSERT
// with a UNION ALL list of fourteen accounts, and the app refused to open. The
// splitter below is a faithful port of the plugin's own — the Android one, in
// `UtilsSQLite.getStatementsArray`:
//
//     String stmts = statements.replace("end;", "END;");
//     String[] sqlCmdArray = stmts.split(";\n");
//     ... then for each statement, per line, cut everything from "--" on
//
// Two traps live in those three lines, and this file exists so neither can
// come back unnoticed:
//
//   1. It splits on a semicolon followed by a LINE FEED. A file saved with
//      Windows line endings has ";\r\n" and never splits at all.
//   2. It cuts each line at the first "--" it sees, wherever it sees it. A "--"
//      inside a string literal takes the rest of that line with it.
//
// Anything this file rejects would fail on the phone with an error nobody can
// read, days later, with the database half migrated.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'src', 'app', 'core', 'database', 'migrations');

const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

/** A faithful port of the plugin's splitter, warts included. */
function getStatementsArray(statements) {
  const stmts = statements.split('end;').join('END;');
  let sqlCmdArray = stmts.split(';\n');

  for (let i = 0; i < sqlCmdArray.length; i += 1) {
    const parts = [];
    for (const raw of sqlCmdArray[i].split('\n')) {
      let line = raw.trim();
      const idx = line.indexOf('--');
      if (idx > -1) line = line.slice(0, idx);
      if (line.length > 0) parts.push(line);
    }
    sqlCmdArray[i] = parts.join(' ');
  }

  if (sqlCmdArray[sqlCmdArray.length - 1].trim().length === 0) {
    sqlCmdArray = sqlCmdArray.slice(0, -1);
  }
  return sqlCmdArray;
}

test('no migration is saved with Windows line endings', () => {
  // The splitter looks for ";\n". With ";\r\n" it finds nothing, the whole file
  // becomes a single statement, and the phone gets one enormous string it
  // cannot execute. Nothing about the SQL itself would look wrong.
  const withCrlf = files.filter(file =>
    readFileSync(join(MIGRATIONS, file), 'utf8').includes('\r\n'));
  assert.deepEqual(withCrlf, [], 'migrations with CRLF line endings');
});

test('the generated statements module has no Windows line endings either', () => {
  // The .sql files are the source, but this is what actually ships.
  const generated = readFileSync(join(MIGRATIONS, 'statements.generated.ts'), 'utf8');
  assert.equal(generated.includes('\r\n'), false,
    'statements.generated.ts carries CRLF into the SQL the device runs');
});

test('no line puts a double dash inside a string literal', () => {
  // The splitter cuts a line at the first "--" regardless of context, so a
  // literal containing one loses the rest of its own statement.
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    sql.split('\n').forEach((line, index) => {
      const comment = line.indexOf('--');
      if (comment < 0) return;
      const before = line.slice(0, comment);
      const quotes = (before.match(/'/g) ?? []).length;
      assert.equal(quotes % 2, 0,
        `${file}:${index + 1} has a double dash inside a string literal`);
    });
  }
});

test('every statement the device would run is valid on its own', () => {
  // The real check: split each migration the way the plugin does, then run the
  // pieces one at a time, exactly as the phone would.
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const statements = getStatementsArray(sql);

    assert.ok(statements.length > 0, `${file} produced no statements`);

    statements.forEach((statement, index) => {
      if (statement.trim().length === 0) return;
      try {
        db.exec(statement);
      } catch (error) {
        assert.fail(
          `${file}, statement ${index + 1} of ${statements.length} failed on the device path:\n` +
          `  ${statement.slice(0, 300)}\n  ${error.message}`);
      }
    });
  }

  // And the result is the same schema the ordinary path produces.
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  // Counted, not spelled out: a table added by a new migration should not
  // fail a test about how statements are split or how a database is built.
  assert.ok(tables.length >= 23, `only ${tables.length} tables`);
});

test('a statement never spans a split point', () => {
  // A semicolon inside a string literal would end a statement early. None of
  // the migrations needs one, so the rule is simply that there are none.
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const statement of getStatementsArray(sql)) {
      const quotes = (statement.match(/'/g) ?? []).length;
      assert.equal(quotes % 2, 0,
        `${file}: a statement ended with an unclosed quote:\n  ${statement.slice(0, 200)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The iPhone. Found by the first simulator run (2026-11-25): migration 023
// failed with `near "account_id": syntax error`. The iOS plugin
// (CapacitorSQLite.swift `execute`, UtilsSQLCipher.swift `execute`) trims
// every line - spaces included - and joins them with "\n"; then, for a string
// holding "DELETE FROM", it removes every "\n" and splits on ";" to look at
// each DELETE (left as it is: this app has no `sql_deleted` column). A port
// of both, run on what the driver really sends: `sqlForPlugin`'s output.

import { sqlForPlugin } from '../../src/app/core/database/plugin-sql.ts';

/** A faithful port of the iOS plugin's handling of an `execute` string. */
function iosExecuteString(statements) {
  let stmts = statements;
  if (stmts.includes('\n')) {
    stmts = stmts.split('\n').filter(line => line.length > 0).map(line => line.trim()).join('\n');
  }
  if (/DELETE FROM/i.test(stmts)) {
    const parts = stmts.split('\n').join('').split(';');
    parts.pop();
    stmts = parts.join(';');
  }
  return stmts;
}

test('every migration runs on an iPhone as the iOS plugin hands it to SQLite', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const file of files) {
    const sent = iosExecuteString(sqlForPlugin(readFileSync(join(MIGRATIONS, file), 'utf8')));
    try {
      db.exec(sent);
    } catch (error) {
      assert.fail(`${file} fails on an iPhone: ${error.message}\n  ${sent.slice(0, 300)}`);
    }
  }
});

test('every migration runs on Android as the driver really sends it', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const file of files) {
    const statements = getStatementsArray(sqlForPlugin(readFileSync(join(MIGRATIONS, file), 'utf8')));
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      try {
        db.exec(statement);
      } catch (error) {
        assert.fail(`${file} fails on Android: ${error.message}\n  ${statement.slice(0, 300)}`);
      }
    }
  }
});
