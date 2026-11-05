// Every icon the app gives an account or a category can be chosen again
// (Jose, 2026-11-05: the sample data's "Intereses CDT" wore a ribbon no
// picker offered, so on another phone it could not be found).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/icon-catalog.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as ionicons from 'ionicons/icons';
import { ACCOUNT_ICONS, CATEGORY_ICONS_CATALOG, APP_ICONS } from '../../src/app/core/icons/icon-catalog.ts';

const SOURCES = [
  'src/app/core/database/starter-categories.ts',
  'src/app/core/database/category-icons.ts',
  'src/app/core/demo/showcase.ts',
  'src/app/core/database/repositories/product-kinds.repository.ts',
  'src/app/core/database/migrations/statements.generated.ts',
];

const used = new Set(SOURCES.flatMap(file =>
  [...readFileSync(file, 'utf8').matchAll(/'([a-z]+(?:-[a-z]+)*)-outline'/g)].map(m => m[1])));

const offered = groups => new Set(groups.flatMap(g => g.icons));

test('every icon the app gives a category is in the categories picker', () => {
  const all = offered(CATEGORY_ICONS_CATALOG);
  assert.deepEqual([...used].filter(icon => !all.has(icon)), []);
});

test('every icon the app gives an account is in the accounts picker too', () => {
  const all = offered(ACCOUNT_ICONS);
  assert.deepEqual([...used].filter(icon => !all.has(icon)), []);
});

test('every icon offered exists in Ionicons, and no picker repeats one', () => {
  const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Outline';
  assert.deepEqual(APP_ICONS.filter(name => !ionicons[camel(name)]), []);
  for (const groups of [ACCOUNT_ICONS, CATEGORY_ICONS_CATALOG]) {
    const names = groups.flatMap(g => g.icons);
    assert.equal(new Set(names).size, names.length);
  }
});
