// Long text must never be able to lie across an icon.
//
//   node --test tools/db/text-overflow.test.mjs
//
// Jose photographed an account called "Cuenta leidy bancolombia prestamos"
// printed straight across the search button and the language flag. The rule
// meant to prevent that was already written, and had never worked:
//
//   .name {
//     display: flex;
//     text-overflow: ellipsis;   <-- does nothing here
//   }
//
// `text-overflow` acts on the inline content of a *block* container. Inside a
// flex box a bare text node becomes an anonymous flex item, which the property
// never touches. So the declaration reads as if the case is handled, sits in
// the file looking correct, and the name overflows anyway.
//
// Every value on these screens is a name the user typed - an account, a
// category, a product, a note on a movement - and none of them has a length
// the app gets to assume. So this is checked mechanically rather than screen
// by screen, which is how the first one survived four rounds of review.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..', 'src');

function everyStyleSource(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...everyStyleSource(full));
    // `.ts` too: a standalone component's styles live in its decorator.
    else if (entry.endsWith('.scss') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * The declarations a rule makes for itself, without those of its nested rules.
 *
 * Nesting is what makes this worth doing carefully: `.name { display: flex;
 * .text { text-overflow: ellipsis; } }` is correct, and a check that simply
 * searched the whole block for both strings would call it a fault.
 */
function ownDeclarations(lines, from) {
  const own = [];
  let depth = 0;

  for (let at = from; at < lines.length; at++) {
    const opens = (lines[at].match(/\{/g) ?? []).length;
    const closes = (lines[at].match(/\}/g) ?? []).length;

    // Depth 1 is this rule's own body; anything deeper belongs to a child.
    // A line that opens a brace is a child's heading even at depth 1, and a
    // one-line nested rule — `span { text-overflow: ellipsis; }` — opens and
    // closes on that same line. Counting it as this rule's own is what made
    // the check accuse two correct stylesheets.
    if (depth === 1 && at > from && opens === 0) own.push(lines[at]);

    depth += opens - closes;
    if (depth <= 0) break;
  }

  return own.join('\n');
}

const files = everyStyleSource(SOURCE);

test('there are stylesheets to check', () => {
  assert.ok(files.length > 10, `only found ${files.length}`);
});

test('no flex box tries to clip its own text', () => {
  const offenders = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('text-overflow')) continue;
    const lines = source.split('\n');
    const short = file.split('src')[1].replace(/\\/g, '/');

    lines.forEach((line, index) => {
      if (!line.includes('{') || line.trim().startsWith('//')) return;

      const own = ownDeclarations(lines, index);
      if (!/display:\s*(inline-)?flex/.test(own)) return;
      if (!own.includes('text-overflow')) return;

      offenders.push(`src${short}:${index + 1}  ${line.trim()}`);
    });
  }

  assert.deepEqual(offenders, [],
    'put the text in a child of its own and clip that; a flex box cannot clip itself');
});

test('the global net that lets long names shrink is still there', () => {
  // Every screen relies on it rather than repeating it, so its absence would
  // be silent: nothing breaks at build time, and the next long name overflows.
  const global = readFileSync(join(SOURCE, 'global.scss'), 'utf8');

  assert.match(global, /min-width:\s*0/, 'flex items must be allowed to shrink');
  assert.match(global, /overflow-wrap:\s*break-word/,
    'an unbroken run of characters needs somewhere to break');
  assert.match(global, /ion-label/, 'the net covers the label of a list row');

  // The half that made the first fix look like it had done nothing: a
  // <button> with width auto shrinks to fit its content even as a flex
  // container, so the toolbar name measured 406px inside a 280px slot.
  assert.match(global, /button,\s*input,\s*select,\s*textarea/,
    'a form control may not be wider than the box it is in');
});
