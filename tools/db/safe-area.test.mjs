// Nothing ends underneath Android's own buttons.
//
//   node --test tools/db/safe-area.test.mjs
//
// The app is drawn edge to edge, so a page really does extend behind the
// gesture bar or the three buttons at the bottom of the phone. A list that
// simply ends there ends under them: the last row cannot be read and cannot be
// tapped.
//
// Jose found this on the accounts screen, then on the products screen, and
// each time it was fixed on that screen alone - which left every other list
// with the same bug waiting. There is one default in global.scss now, and this
// is what stops a screen quietly overriding it back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', 'src');

function everyStyle(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...everyStyle(full));
    // Styles live in .scss, and in the `styles:` of a few components.
    else if (entry.endsWith('.scss') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

test('the global default is there', () => {
  const global = readFileSync(join(ROOT, 'global.scss'), 'utf8');
  assert.match(global, /ion-content\s*\{[^}]*--padding-bottom:[^;]*--ion-safe-area-bottom/,
    'global.scss no longer gives every ion-content room for the phone buttons');
});

test('a screen that sets its own bottom padding leaves that room too', () => {
  // Overriding the default is fine - a screen with floating buttons needs
  // more - but the override has to carry the inset, or it silently undoes it.
  const offenders = [];

  for (const file of everyStyle(ROOT)) {
    // Without this, the words "ion-content" inside a comment explaining
    // something else start a rule that never existed.
    const source = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const rule of source.matchAll(/ion-content[^{;]*\{([^}]*)\}/g)) {
      for (const declaration of rule[1].matchAll(/--padding-bottom:\s*([^;]+);/g)) {
        if (declaration[1].includes('safe-area')) continue;
        offenders.push(`${file.slice(ROOT.length + 1)}: ${declaration[1].trim()}`);
      }
    }
  }

  assert.deepEqual(offenders, [],
    'these end under the phone\'s own buttons; add var(--ion-safe-area-bottom, 0px)');
});
