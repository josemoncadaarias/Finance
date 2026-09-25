// A row that cannot be ticked by tapping it.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/selection-rows.test.mjs
//
// While choosing several, the whole row takes the tap and the round tick is
// only a picture of it. It was a <button> at first, and on the notifications
// screen that made every row dead except its circle (Jose, 2026-09-25, on his
// phone): an ion-item holding a single button forwards a tap anywhere on the
// row to that button, so the row ticked itself and then unticked through it.
// The review screen escaped only because its rows hold other buttons too.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', 'src', 'app');

function* templates(folder) {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) yield* templates(path);
    else if (path.endsWith('.html')) yield path;
  }
}

test('the tick of a selectable row is never a button', () => {
  const offenders = [];
  let ticks = 0;
  for (const path of templates(APP)) {
    const html = readFileSync(path, 'utf8');
    for (const tag of html.match(/<[a-z-]+[^>]*class="[^"]*\btick\b[^"]*"[^>]*>/g) ?? []) {
      ticks += 1;
      if (/^<(button|ion-button|a)\b/.test(tag)) offenders.push(relative(APP, path));
    }
  }
  assert.ok(ticks >= 2, 'the review and notifications screens both draw a tick');
  assert.deepEqual(offenders, [], 'a tick is a picture; the ion-item takes the tap');
});
