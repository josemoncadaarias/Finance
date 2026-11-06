// What the assistant offers when it does not understand, and what it keeps of
// it (Jose, 2026-11-06). Every sentence here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/near-question.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { nearQuestions, rootsOf } from '../../src/app/core/assistant/near-question.ts';
import { coverFigures, missedText, withMissed, MISSED_KEPT } from '../../src/app/core/assistant/missed.ts';

const CATALOG = [
  '¿Cómo voy este mes?', '¿En qué gasté más?', '¿Qué pago cada mes?', '¿Qué pagos fijos me faltan este mes?',
  '¿Cuánto me han dado mis cuentas?', '¿Qué pagué este mes?', '¿Cuánto me entró este mes?', '¿Cuánto debo?',
  '¿Qué recordatorios tengo?', '¿Cuál fue mi gasto más grande?',
];

test('words of the same root meet, and the words every question has count for nothing', () => {
  assert.deepEqual([...rootsOf('¿Qué he pagado?')], ['pagad']);
  assert.ok(rootsOf('pagué').has('pague'));
  assert.equal(rootsOf('¿qué cuánto mis?').size, 0);
});

test('the closest questions come first; nothing shared, nothing offered', () => {
  assert.equal(nearQuestions('dime las cosas que pagué', CATALOG)[0], '¿Qué pagué este mes?');
  assert.equal(nearQuestions('cuanto me entró la quincena', CATALOG)[0], '¿Cuánto me entró este mes?');
  assert.deepEqual(nearQuestions('hola', CATALOG), []);
  assert.ok(nearQuestions('recordatorios pendientes', CATALOG).includes('¿Qué recordatorios tengo?'));
  assert.ok(nearQuestions('gasto grande del año', CATALOG, 3).length <= 3);
});

test('a sentence not understood is kept with its figures covered, once, the newest last', () => {
  assert.equal(coverFigures('Cuanto de los 1.250.000 que pagué'), 'Cuanto de los # que pagué');
  const now = Date.UTC(2026, 10, 6);
  let list = withMissed([], 'qué onda con mi plata', now);
  list = withMissed(list, 'QUÉ ONDA con mi plata', now + 1);
  assert.equal(list.length, 1);
  for (let i = 0; i < MISSED_KEPT + 5; i++) list = withMissed(list, `frase ${i}`, now + 10 + i);
  assert.equal(list.length, MISSED_KEPT);
  assert.equal(list[list.length - 1].text, `frase ${MISSED_KEPT + 4}`);
  // Older than 30 days, gone.
  const later = withMissed(list, 'otra', now + 31 * 86_400_000);
  assert.deepEqual(later.map(m => m.text), ['otra']);
  assert.match(missedText(later), /^2026-12-07 · otra$/);
});
