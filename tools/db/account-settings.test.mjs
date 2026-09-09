// Tests that account configuration converges on an existing database.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/account-settings.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { applyAccountSettings } from '../../src/app/core/database/account-settings.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';

const NOW = () => '2026-09-09T12:00:00Z';

async function freshDb() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  return db;
}

test('a database imported before the rule existed gets corrected', async () => {
  const db = await freshDb();
  const accounts = new AccountsRepository(db, NOW);

  // Exactly the state Jose's browser was in: imported while every account
  // still counted.
  for (const name of ['eToro', 'XTB', 'Pibank para renta', 'Bancolombia']) {
    await accounts.create({
      name, type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
      include_in_net_worth: true, opened_on: '2024-01-01',
    });
  }

  const applied = await applyAccountSettings(db);

  assert.deepEqual(applied.changed.map(c => c.name).sort(),
    ['Pibank para renta', 'XTB', 'eToro']);

  const flags = Object.fromEntries((await accounts.list()).map(a => [a.name, a.include_in_net_worth]));
  assert.equal(flags['eToro'], 0);
  assert.equal(flags['XTB'], 0);
  assert.equal(flags['Pibank para renta'], 0);
  assert.equal(flags['Bancolombia'], 1, 'accounts with no rule are left alone');
  await db.close();
});

test('running it again changes nothing', async () => {
  const db = await freshDb();
  const accounts = new AccountsRepository(db, NOW);
  await accounts.create({
    name: 'eToro', type: 'investment', currency_code: 'USD', builtin_icon: 'wallet',
    include_in_net_worth: true, opened_on: '2024-01-01',
  });

  assert.equal((await applyAccountSettings(db)).changed.length, 1);
  assert.equal((await applyAccountSettings(db)).changed.length, 0, 'converged, so nothing to do');
  await db.close();
});

test('the flag reaches every currency of a multi-currency account', async () => {
  const db = await freshDb();
  const accounts = new AccountsRepository(db, NOW);
  // Not one of the excluded ones today, but the matching has to work by
  // prefix or a rule on ARQ would never reach 'ARQ USD'.
  await accounts.create({
    name: 'XTB USD', type: 'investment', currency_code: 'USD', builtin_icon: 'wallet',
    include_in_net_worth: true, opened_on: '2024-01-01',
  });

  const applied = await applyAccountSettings(db);
  assert.deepEqual(applied.changed.map(c => c.name), ['XTB USD']);
  await db.close();
});

test('an account the rules do not mention is never touched', async () => {
  const db = await freshDb();
  const accounts = new AccountsRepository(db, NOW);
  const id = await accounts.create({
    name: 'Lulo', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet',
    include_in_net_worth: false, opened_on: '2024-01-01',
  });

  await applyAccountSettings(db);

  // Lulo has no rule, so a choice made elsewhere survives.
  assert.equal((await accounts.findById(id)).include_in_net_worth, 0);
  await db.close();
});
