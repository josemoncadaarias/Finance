// The iPhone's guide (features/notifications/iphone-banks.component.ts) draws
// Finance's two Shortcuts actions as the iPhone shows them. Their titles and
// blanks must be the ones FinanceIntents.swift declares, or a person looks for
// an action that is not there. And every step of both guides has its words.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPANISH as es, ENGLISH as en } from '../../src/app/core/i18n/translations.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const swift = readFileSync(join(ROOT, 'ios/App/App/FinanceIntents.swift'), 'utf8');
const ts = readFileSync(join(ROOT, 'src/app/features/notifications/iphone-banks.component.ts'), 'utf8');

test('the guide names the actions as FinanceIntents.swift does', () => {
  const titles = [...swift.matchAll(/static var title: LocalizedStringResource = "([^"]+)"/g)].map(m => m[1]);
  const blanks = [...swift.matchAll(/@Parameter\(title: "([^"]+)"\)/g)].map(m => m[1]);
  assert.equal(titles.length, 2);
  for (const title of titles) assert.ok(ts.includes(`title: '${title}'`), title);
  for (const blank of blanks) assert.ok(ts.includes(`{ text: '${blank}', blank: true }`), blank);
});

test('every step of both guides has its words in both languages', () => {
  const steps = Number(ts.match(/export const STEPS = (\d+)/)[1]);
  for (const door of ['sms', 'pay']) {
    for (let n = 1; n <= steps; n++) {
      for (const part of ['title', 'text']) {
        const key = `ui.iphone.${door}.${n}.${part}`;
        assert.ok(es[key], `es ${key}`);
        assert.ok(en[key], `en ${key}`);
      }
    }
  }
});
