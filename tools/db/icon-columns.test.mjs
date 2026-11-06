// An account, a category or a group saved with a picture of its own.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/icon-columns.test.mjs
//
// Jose, 2026-11-06: "Nueva cuenta" with its own picture failed with
// "CHECK constraint failed: (builtin_icon IS NULL) <> (custom_icon_id IS NULL)".
// The face editor hands back the last built-in icon beside the picture, and
// the repositories wrote both. Editing such an account threw too.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { AccountsRepository } from '../../src/app/core/database/repositories/accounts.repository.ts';
import { CategoriesRepository } from '../../src/app/core/database/repositories/categories.repository.ts';
import { AccountGroupsRepository } from '../../src/app/core/database/repositories/account-groups.repository.ts';
import { CustomIconsRepository } from '../../src/app/core/database/repositories/custom-icons.repository.ts';
import { iconColumns } from '../../src/app/core/icons/icon-columns.ts';

const NOW = () => '2026-11-06T12:00:00Z';

async function world() {
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const picture = await new CustomIconsRepository(db).create({
    name: 'logo', mime_type: 'image/png', data: new Uint8Array([137, 80, 78, 71]),
  });
  return { db, picture };
}

test('a picture wins over a built-in icon; neither falls back', () => {
  assert.deepEqual(iconColumns('wallet', 7, 'x'), { builtin_icon: null, custom_icon_id: 7 });
  assert.deepEqual(iconColumns('card', null, 'x'), { builtin_icon: 'card', custom_icon_id: null });
  assert.deepEqual(iconColumns(null, null, 'x'), { builtin_icon: 'x', custom_icon_id: null });
});

test('a new account with its own picture saves, and is edited with both handed', async () => {
  const { db, picture } = await world();
  const accounts = new AccountsRepository(db, NOW);
  const id = await accounts.create({
    name: 'Mi banco', type: 'debit', currency_code: 'COP',
    builtin_icon: 'wallet', custom_icon_id: picture,
    opening_balance_minor: 136_804_98, opened_on: '2026-11-06',
  });
  let row = await accounts.findById(id);
  assert.equal(row.custom_icon_id, picture);
  assert.equal(row.builtin_icon, null);

  await accounts.update(id, { builtin_icon: 'wallet', custom_icon_id: picture, name: 'Otro' });
  row = await accounts.findById(id);
  assert.equal(row.custom_icon_id, picture);

  await accounts.update(id, { builtin_icon: 'card', custom_icon_id: null });
  row = await accounts.findById(id);
  assert.equal(row.builtin_icon, 'card');
  assert.equal(row.custom_icon_id, null);
});

test('a category and a group with their own picture save and edit', async () => {
  const { db, picture } = await world();
  const categories = new CategoriesRepository(db, NOW);
  const cat = await categories.create({ name: 'Mía', kind: 'expense', builtin_icon: 'pricetag', custom_icon_id: picture });
  await categories.update(cat, { builtin_icon: 'pricetag', custom_icon_id: picture });
  const groups = new AccountGroupsRepository(db, NOW);
  const group = await groups.create({ name: 'Grupo', builtin_icon: 'wallet', custom_icon_id: picture });
  await groups.update(group, { builtin_icon: 'wallet', custom_icon_id: picture });
  const [c] = await db.query('SELECT builtin_icon, custom_icon_id FROM categories WHERE id = ?', [cat]);
  const [g] = await db.query('SELECT builtin_icon, custom_icon_id FROM account_groups WHERE id = ?', [group]);
  assert.deepEqual({ ...c }, { builtin_icon: null, custom_icon_id: picture });
  assert.deepEqual({ ...g }, { builtin_icon: null, custom_icon_id: picture });
});
