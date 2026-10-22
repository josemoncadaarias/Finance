import test from 'node:test';
import assert from 'node:assert/strict';

import { FEEDBACK_TO, feedbackMail } from '../../src/app/core/feedback/feedback-mail.ts';

const WORDS = { kind: { bug: 'Fallo', idea: 'Mejora', question: 'Pregunta' }, device: 'Datos del teléfono', reading: 'Lo que leyó la app' };

test('the person\'s words alone when nothing else is kept in', () => {
  const m = feedbackMail({ kind: 'idea', text: '  Quisiera ver mis gastos por semana  ', version: '1.0.1133' }, WORDS);
  assert.equal(m.to, FEEDBACK_TO);
  assert.equal(m.subject, '[Finance] Mejora · v1.0.1133');
  assert.equal(m.body, 'Quisiera ver mis gastos por semana');
});

test('the phone\'s details and the reading go under the words, each with its heading', () => {
  const m = feedbackMail({ kind: 'bug', text: 'El total salió mal', version: '1.0.1133',
    device: ['Versión de Finance: 1.0.1133', 'Idioma: es'], reading: '{"lines":[]}' }, WORDS);
  assert.equal(m.body, 'El total salió mal\n\n— Datos del teléfono —\nVersión de Finance: 1.0.1133\nIdioma: es\n\n— Lo que leyó la app —\n{"lines":[]}');
});

test('in a browser there is no version in the subject', () => {
  assert.equal(feedbackMail({ kind: 'question', text: 'Hola', version: null }, WORDS).subject, '[Finance] Pregunta');
});

test('the link carries everything encoded, accents and line breaks included', () => {
  const m = feedbackMail({ kind: 'bug', text: 'Línea 1\nañadí & más?', version: '1.0.1' }, WORDS);
  assert.ok(m.href.startsWith(`mailto:${FEEDBACK_TO}?subject=`));
  const query = new URLSearchParams(m.href.slice(m.href.indexOf('?') + 1).replace(/\+/g, '%2B'));
  assert.equal(query.get('subject'), '[Finance] Fallo · v1.0.1');
  assert.equal(query.get('body'), 'Línea 1\nañadí & más?');
});
