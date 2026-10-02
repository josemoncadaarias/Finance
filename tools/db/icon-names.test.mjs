// Tests for icon-name handling.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/icon-names.test.mjs
//
// Written after category rows rendered no icon at all: names reach the app
// from three places that disagree about the "-outline" suffix, appending it
// blindly produced "car-outline-outline", and Ionicons draws an unknown name
// as nothing rather than complaining.

import test from 'node:test';
import assert from 'node:assert/strict';

import { outlined, bareIcon, everyCatalogIcon, ACCOUNT_ICONS, CATEGORY_ICONS_CATALOG }
  from '../../src/app/core/icons/icon-catalog.ts';
import { CATEGORY_ICONS } from '../../src/app/core/database/category-icons.ts';

test('a name gets its suffix once, whichever form it arrives in', () => {
  assert.equal(outlined('car'), 'car-outline');
  assert.equal(outlined('car-outline'), 'car-outline', 'never doubled');
  assert.equal(outlined(null), 'pricetag-outline', 'something rather than nothing');
  assert.equal(outlined(undefined), 'pricetag-outline');
  assert.equal(outlined(' wallet '), 'wallet-outline');
});

test('the bare name is what the catalog is compared against', () => {
  assert.equal(bareIcon('car-outline'), 'car');
  assert.equal(bareIcon('car'), 'car');
  assert.equal(bareIcon(null), null);
});

test('the catalog stores bare names, so the picker can match either form', () => {
  for (const group of [...ACCOUNT_ICONS, ...CATEGORY_ICONS_CATALOG]) {
    for (const icon of group.icons) {
      assert.equal(icon.endsWith('-outline'), false,
        `${icon} in ${group.key} carries a suffix the catalog should not`);
    }
  }
  assert.ok(everyCatalogIcon().length > 40);
});

test("every icon the importer assigns survives the round trip", () => {
  // These are the names Jose's real categories get on import.
  for (const [category, icon] of Object.entries(CATEGORY_ICONS)) {
    const rendered = outlined(icon);
    assert.equal(rendered.endsWith('-outline'), true, `${category} renders as ${rendered}`);
    assert.equal(rendered.includes('-outline-outline'), false,
      `${category} would render as ${rendered}, which draws nothing`);
  }
});

test('a category with a picture of its own keeps it when the app starts', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { applyCategoryIcons } = await import('../../src/app/core/database/category-icons.ts');
  const { CategoriesRepository } = await import('../../src/app/core/database/repositories/categories.repository.ts');
  const { CustomIconsRepository } = await import('../../src/app/core/database/repositories/custom-icons.repository.ts');
  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const name = Object.keys(CATEGORY_ICONS)[0];
  const picture = await new CustomIconsRepository(db).create({ name: 'mine', mime_type: 'image/png', data: new Uint8Array([1, 2, 3]) });
  const id = await new CategoriesRepository(db).create({ name, kind: 'expense', custom_icon_id: picture });
  // It used to give such a row a built-in icon too, which the table refuses: the app would not open.
  await applyCategoryIcons(db);
  const row = await db.queryOne('SELECT builtin_icon, custom_icon_id FROM categories WHERE id = ?', [id]);
  assert.deepEqual([row.builtin_icon, row.custom_icon_id], [null, picture]);
});
