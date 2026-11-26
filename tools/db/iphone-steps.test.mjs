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

test('on an iPhone the assistant guides the Shortcuts setup, not "Android only"', async () => {
  const { guide } = await import('../../src/app/features/assistant/answers.ts');
  const s = { t: (key) => es[key] ?? key };
  const facts = { cards: [], loans: [], photos: true, notices: false };
  const iphone = guide(s, 'notices', { ...facts, shortcuts: true });
  const browser = guide(s, 'notices', facts);
  const text = (a) => JSON.stringify(a.card);
  assert.equal(iphone.said.key, 'ai.guide.noticesIphone.said');
  assert.ok(text(iphone).includes(es['ai.guide.noticesIphone.3']));
  assert.ok(!text(iphone).includes(es['ai.guide.androidOnly']));
  assert.ok(text(browser).includes(es['ai.guide.androidOnly']));
});

test('"Tus bancos" on an iPhone: one row per sender or card, with its account', async () => {
  const { sourcesOf } = await import('../../src/app/core/notices/iphone-sources.ts');
  const caught = [
    { package: 'sms', sender: '89001', postedAt: 100 },
    { package: 'sms', sender: '89001', postedAt: 300 },
    { package: 'applepay', sender: 'Tarjeta Azul', postedAt: 200 },
    { package: 'sms', sender: '77002', postedAt: 50 },
    { package: 'com.other', postedAt: 400 },
  ];
  const said = new Map([['sms|77002', 0]]);
  const answers = [{ package: 'applepay|Tarjeta Azul', account_id: 7 }, { package: 'sms|89001', account_id: 99 }];
  const rows = sourcesOf(caught, said, answers, new Set([7, 8]));
  assert.deepEqual(rows.map(r => [r.key, r.count, r.accountId, r.several]), [
    ['sms|89001', 2, null, false],       // its learned account is gone
    ['applepay|Tarjeta Azul', 1, 7, false],
    ['sms|77002', 1, null, true],        // "Varias cuentas"
  ]);
});
