// The tax module in English, laid over its Spanish.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/tax-words.test.mjs
//
// Jose's rule, 2026-09-18: the app's own words follow the language, the DIAN's
// terms stay Spanish with an English gloss, and Spanish stays exactly as it
// was. These tests hold the English to that: complete, row for row, with the
// box labels untouched - so a line added to the form without its English
// fails here instead of showing up in Spanish on an English screen.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPLOYMENT_TEXT, MONTH_NAMES, TAX_FORM, TAX_SOURCES, TAX_TEXT,
} from '../../src/app/core/tax/tax-form.ts';
import {
  EMPLOYMENT_TEXT_EN, MONTH_NAMES_EN, TAX_FORM_EN, TAX_SOURCE_LABELS_EN, TAX_TEXT_EN,
} from '../../src/app/core/tax/tax-form.en.ts';
import { rowsWithIds, sourceIn, taxWords } from '../../src/app/core/tax/tax-words.ts';
import { parametersFor } from '../../src/app/core/tax/defaults.ts';

const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

test('Spanish is the form itself, not a copy of it', () => {
  const es = taxWords('es');
  assert.equal(es.text, TAX_TEXT);
  assert.equal(es.form, TAX_FORM);
  assert.equal(es.employment, EMPLOYMENT_TEXT);
  assert.equal(es.months, MONTH_NAMES);
  assert.equal(es.sources, TAX_SOURCES);
});

test('every phrase of the module has its English, with the same placeholders', () => {
  assert.deepEqual(Object.keys(TAX_TEXT_EN).sort(), Object.keys(TAX_TEXT).sort());
  for (const [key, spanish] of Object.entries(TAX_TEXT)) {
    assert.ok(TAX_TEXT_EN[key].trim(), `${key} is empty in English`);
    assert.deepEqual(placeholders(TAX_TEXT_EN[key]), placeholders(spanish), `${key} keeps its placeholders`);
  }
  assert.equal(MONTH_NAMES_EN.length, 12);
  assert.deepEqual(Object.keys(EMPLOYMENT_TEXT_EN).sort(), Object.keys(EMPLOYMENT_TEXT).sort());
  for (const source of TAX_SOURCES) {
    assert.ok(TAX_SOURCE_LABELS_EN[source.url], `the source ${source.url} has an English title`);
  }
  assert.equal(Object.keys(TAX_SOURCE_LABELS_EN).length, TAX_SOURCES.length, 'no English title for a source that is gone');
});

test('every section and row of the form has its English, and nothing more', () => {
  assert.deepEqual(Object.keys(TAX_FORM_EN).sort(), TAX_FORM.map(section => section.id).sort());

  for (const section of TAX_FORM) {
    const words = TAX_FORM_EN[section.id];
    const where = `section ${section.id}`;
    assert.ok(words.title, `${where} has a title`);
    assert.equal(words.subtitle !== undefined, section.subtitle !== undefined, `${where}: a subtitle for a subtitle`);

    const ids = rowsWithIds(section).filter(one => one.id !== null);
    const seen = new Set();
    for (const { row, id } of ids) {
      assert.ok(!seen.has(id), `${where}: ${id} names one row only`);
      seen.add(id);

      const found = words.rows[id];
      assert.ok(found, `${where}: ${id} has no English`);

      if (row.kind === 'note') {
        assert.ok(found.text, `${where}: ${id} has its text`);
        continue;
      }
      assert.ok(found.label, `${where}: ${id} has a label`);
      assert.equal(found.hint !== undefined, row.hint !== undefined, `${where}: ${id} has a hint where Spanish does`);

      // The rule itself: a box of the form keeps the DIAN's own words.
      if (row.box) {
        assert.equal(found.label, row.label, `${where}: ${id} lands in casilla ${row.box} and keeps its Spanish label`);
        assert.ok(found.gloss, `${where}: ${id} lands in casilla ${row.box} and explains it in English`);
      } else {
        assert.equal(found.gloss, undefined, `${where}: ${id} is the app's own words, so plain English with no gloss`);
      }
    }
    assert.deepEqual(Object.keys(words.rows).filter(id => !seen.has(id)), [], `${where}: English for rows that do not exist`);
  }
});

test('English changes words and nothing else about the form', () => {
  const en = taxWords('en').form;
  assert.equal(en.length, TAX_FORM.length);

  const shape = sections => sections.map(section => ({
    id: section.id,
    collapsed: section.collapsed,
    hasSubtitle: section.subtitle !== undefined,
    rows: section.rows.map(row => ({
      kind: row.kind, key: row.key, which: row.which, box: row.box, format: row.format,
      total: row.total, when: row.when, hasHint: row.hint !== undefined,
    })),
  }));
  assert.deepEqual(shape(en), shape(TAX_FORM));

  const capital = en.find(section => section.id === 'capital');
  assert.equal(capital.title, '3. Rentas de capital');
  assert.equal(capital.titleGloss, 'capital income: interest, yields…');
  const box58 = capital.rows.find(row => row.box === '58');
  assert.equal(box58.label, 'Ingresos brutos por rentas de capital');
  assert.equal(box58.gloss, 'gross capital income');
  assert.match(box58.hint, /^Interest and financial yields/);
});

test('a parameter\'s source follows the language, and a norm keeps its name', () => {
  const p = parametersFor(2026, new Date(2026, 8, 18));
  assert.equal(sourceIn(p.uvt, 'es'), 'Resolución DIAN 000238 de 2025');
  assert.equal(sourceIn(p.uvt, 'en'), 'Resolución DIAN 000238 de 2025');
  assert.equal(sourceIn(parametersFor(2025).minimumWage, 'en'), 'Minimum wage 2025 (base of the 2026 increase)');
  assert.match(sourceIn(p.inflationary, 'en'), /^12-month CPI \(IPC\) 6,24%/);
});
