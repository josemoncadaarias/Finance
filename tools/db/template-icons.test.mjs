// Every icon name written into a template must actually exist.
//
//   node --test tools/db/template-icons.test.mjs
//
// Ionicons draws an unknown name as empty space. No error, no warning, no gap
// in the console — just a button that looks like it has nothing on it. That has
// already cost this project three rounds of "no veo el lápiz", each one found
// by Jose on a screen rather than here.
//
// Both shapes are checked: the literal `name="..."` and a quoted string inside
// a `[name]="..."` binding, which is how every icon that changes with state is
// written. A name that is genuinely computed — `iconOf(account)` — comes from
// the catalog, which `icon-names.test.mjs` covers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as ionicons from 'ionicons/icons';
import { DRAWN_ICONS } from '../../src/app/core/icons/drawn-icons.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..', 'src', 'app');

/** `arrow-forward-outline` is exported as `arrowForwardOutline`. */
function asExportName(name) {
  return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Known to Ionicons, or drawn by the app itself.
 *
 * The app registers its own with `addIcons` at start-up - there is no piggy
 * bank in Ionicons and the products screen is about one - so the names it
 * draws are as real as theirs, and just as fatal to leave out.
 */
function exists(name) {
  return asExportName(name) in ionicons || name in DRAWN_ICONS;
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
const relative = file => file.slice(SOURCE.length + 1);

test('there are templates to check', () => {
  assert.ok(templates.length > 5, `only found ${templates.length}`);
});

test('every literal icon name in a template exists in ionicons', () => {
  const missing = [];
  let checked = 0;

  for (const file of templates) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<ion-icon\b[^>]*?\sname="([a-z0-9-]+)"/g)) {
      checked += 1;
      if (!exists(match[1])) {
        missing.push(`${relative(file)}: ${match[1]}`);
      }
    }
  }

  assert.ok(checked > 20, `the pattern only matched ${checked} names; it has stopped working`);
  assert.deepEqual(missing, [], 'icon names that would render as empty space');
});

test('a name quoted inside a bound icon exists too', () => {
  // `[name]="cond ? 'a-outline' : 'b-outline'"` is how every icon that changes
  // with state is written, and the check above never saw one of them: it only
  // looks at `name="..."`. A quoted string inside the binding is just as fixed
  // as a literal attribute, so it is checked the same way.
  const missing = [];
  let checked = 0;

  for (const file of templates) {
    const html = readFileSync(file, 'utf8');
    for (const tag of html.matchAll(/<ion-icon\b[^>]*?\[name\]="([^"]*)"/g)) {
      for (const quoted of tag[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) {
        checked += 1;
        if (!(asExportName(quoted[1]) in ionicons)) {
          missing.push(`${relative(file)}: ${quoted[1]}`);
        }
      }
    }
  }

  assert.ok(checked > 0, 'the pattern matched no bound names; it has stopped working');
  assert.deepEqual(missing, [], 'bound icon names that would render as empty space');
});

function everySource(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...everySource(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('icon names written in component code exist too', () => {
  // Some lists are built in TypeScript — the drawer's sections, the theme
  // choices — so their icons never reach a template and would otherwise go
  // unchecked. Every .ts under src/app, not only the one that had them first.
  const missing = [];
  let checked = 0;

  for (const file of everySource(SOURCE)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/icon:\s*'([a-z0-9-]+)'/g)) {
      checked += 1;
      if (!exists(match[1])) {
        missing.push(`${relative(file)}: ${match[1]}`);
      }
    }
  }

  assert.ok(checked > 5, `only ${checked} icons found in code; the pattern has stopped working`);
  assert.deepEqual(missing, [], 'icons in code that would render as empty space');
});

test('an account or category icon is never drawn without its image', () => {
  // A category and an account each carry either a name from the catalog or a
  // picture the user supplied — the schema allows exactly one. So a template
  // that reads `builtin_icon` and nothing else renders nothing at all for
  // everything Jose gave a real logo to, silently, and it looks like a default
  // icon rather than a bug.
  //
  // That was found and fixed one screen at a time on the accounts list, the
  // summary header, the movement list and the donut, and was still live in six
  // more places. `<app-icon>` is the one place it is drawn now, and this is
  // what keeps it that way.
  const offenders = [];

  for (const file of templates) {
    const source = readFileSync(file, 'utf8');
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('builtin_icon')) return;
      // `<app-icon [builtin]="...builtin_icon">` is the sanctioned shape.
      if (line.includes('[builtin]')) return;
      offenders.push(`${file.split('src')[1]}:${index + 1}  ${line.trim()}`);
    });
  }

  assert.deepEqual(offenders, [],
    'draw these with <app-icon [builtin] [customId]> instead');
});

test('an icon the app draws is written the way addIcons takes them', () => {
  // Every value Ionicons exports is a data URI. A raw `<svg>` string handed to
  // `addIcons` is taken for a URL and fetched, the fetch fails, and nothing is
  // drawn and nothing is said - which is exactly what happened to the piggy
  // bank: Jose opened the drawer and the products entry had no icon at all.
  const wrong = Object.entries(DRAWN_ICONS)
    .filter(([, svg]) => !svg.startsWith('data:image/svg+xml'))
    .map(([name]) => name);

  assert.ok(Object.keys(DRAWN_ICONS).length > 0, 'there are icons to check');
  assert.deepEqual(wrong, [], 'these would be fetched as a URL and draw nothing');

  for (const [name, svg] of Object.entries(DRAWN_ICONS)) {
    // A newline ends a URI, and a double quote ends the attribute the icon is
    // written into.
    assert.equal(svg.includes('\n'), false, `${name} has a line break in it`);
    assert.equal(svg.includes('"'), false, `${name} has a double quote in it`);
    assert.ok(svg.includes('<svg'), `${name} carries no drawing`);
  }
});
