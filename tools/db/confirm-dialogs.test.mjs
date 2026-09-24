// A confirmation that never appears.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/confirm-dialogs.test.mjs
//
// `app-confirm` is an `ion-modal`, and an ion-modal presents when `isOpen`
// goes from false to true. One created with it ALREADY true has nothing to
// transition from, so it is never shown - and the button that opens it looks
// simply dead. That is how the restore confirmation shipped on 2026-09-24:
// the code was right, the flag was set, and nothing happened on the screen.
//
// The shape that works is the one the review screen has always used: the
// dialog stays in the page and a signal opens it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', 'src', 'app');

function* walk(folder) {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith('.html') || path.endsWith('.ts')) yield path;
  }
}

test('no confirmation is created already open', () => {
  const offenders = [];

  for (const path of walk(APP)) {
    const source = readFileSync(path, 'utf8');
    for (const found of source.matchAll(/<app-confirm[^>]*\[open\]="([^"]*)"/g)) {
      // A literal true means the element is being created open, which only
      // ever happens inside an @if - and then it never shows.
      if (found[1].trim() === 'true') {
        offenders.push(relative(APP, path).replace(/\\/g, '/'));
      }
    }
  }

  assert.deepEqual(offenders, [],
    'bind [open] to the signal and leave the dialog in the page:\n  '
    + offenders.join('\n  '));
});
