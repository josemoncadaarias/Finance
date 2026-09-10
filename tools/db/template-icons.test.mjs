// Every icon name written into a template must actually exist.
//
//   node --test tools/db/template-icons.test.mjs
//
// Ionicons draws an unknown name as empty space. No error, no warning, no gap
// in the console — just a button that looks like it has nothing on it. That has
// already cost this project three rounds of "no veo el lápiz", each one found
// by Jose on a screen rather than here.
//
// So every literal `name="..."` on an `<ion-icon>` is checked against the names
// the ionicons package actually exports. A name built at runtime (`[name]="..."`)
// is not checked here — those come from the catalog, which `icon-names.test.mjs`
// covers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as ionicons from 'ionicons/icons';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..', 'src', 'app');

/** `arrow-forward-outline` is exported as `arrowForwardOutline`. */
function asExportName(name) {
  return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function everyTemplate(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...everyTemplate(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const templates = everyTemplate(SOURCE);

test('there are templates to check', () => {
  assert.ok(templates.length > 5, `only found ${templates.length}`);
});

test('every literal icon name in a template exists in ionicons', () => {
  const missing = [];

  for (const file of templates) {
    const html = readFileSync(file, 'utf8');
    // Only static names: a bound [name] is computed and covered elsewhere.
    for (const match of html.matchAll(/<ion-icon\b[^>]*?\sname="([a-z0-9-]+)"/g)) {
      const name = match[1];
      if (!(asExportName(name) in ionicons)) {
        missing.push(`${file.slice(SOURCE.length + 1)}: ${name}`);
      }
    }
  }

  assert.deepEqual(missing, [],
    'icon names that would render as empty space');
});

test('icon names written in component code exist too', () => {
  // The drawer builds its list in TypeScript, so its icons never appear in a
  // template and would otherwise go unchecked.
  const source = readFileSync(join(SOURCE, 'app.component.ts'), 'utf8');
  const missing = [];

  for (const match of source.matchAll(/icon:\s*'([a-z0-9-]+)'/g)) {
    if (!(asExportName(match[1]) in ionicons)) missing.push(match[1]);
  }

  assert.deepEqual(missing, [], 'drawer icons that would render as empty space');
});
