// Typing slips (Jose, 2026-10-29): the assistant's vocabulary comes out of its
// own patterns, never a list somebody keeps.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/mend-slips.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { knows, slipsBetween, slipsOf, vocabularyOf } from '../../src/app/core/assistant/mend-slips.ts';

test('the words of a pattern: alternatives, optional letters, classes, endings and stems', () => {
  const v = vocabularyOf([/\b(abre|abreme)\b.*\b(productos?|rendimient\w*)\b/, /^(?:pas|mand)(?:o|aste|ar)$/, /\bpag[oau]\b/]);
  for (const word of ['abre', 'abreme', 'productos', 'producto', 'paso', 'pasaste', 'pasar', 'mando', 'mandaste', 'pago', 'paga', 'pagu']) {
    assert.ok(v.words.has(word), word);
  }
  assert.deepEqual(v.stems, ['rendimient']);
  assert.ok(knows('rendimientos', v));
  assert.ok(!v.words.has('ve'), 'nothing under four letters');
});

test('slips: changed, added, left out, swapped', () => {
  assert.equal(slipsBetween('abrir', 'absir'), 1);
  assert.equal(slipsBetween('abrir', 'abrri'), 1);
  assert.equal(slipsBetween('productos', 'prodctos'), 1);
  assert.equal(slipsBetween('productos', 'productoss'), 1);
  assert.equal(slipsBetween('recordatorios', 'recodratorois'), 2);
});

test('what a slip meant, nearest first, never another first letter', () => {
  const v = vocabularyOf([/\b(abrir|abre|cuanto|cuantos|metas?|rendimient\w*|transferencias?)\b/]);
  assert.deepEqual(slipsOf('absir', v).map(one => one.word), ['abrir']);
  assert.equal(slipsOf('rendimeintos', v)[0].word, 'rendimientos', 'a stem keeps the ending typed');
  assert.equal(slipsOf('trasnferencia', v)[0].word, 'transferencia');
  assert.equal(slipsOf('transfrencias', v)[0].word, 'transferencias', 'two slips allowed from nine letters');
  assert.deepEqual(slipsOf('cunto', v).map(one => one.word).slice(0, 1), ['cuanto']);
  assert.deepEqual(slipsOf('obrir', v), [], 'another first letter is another word');
  assert.deepEqual(slipsOf('meta', v), [], 'a known word is no slip');
  assert.deepEqual(slipsOf('mta', v), [], 'nothing under four letters');
  assert.deepEqual(slipsOf('metass', v).map(one => one.word), ['metas']);
});
