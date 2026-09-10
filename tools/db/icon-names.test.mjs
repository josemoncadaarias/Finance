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
