// Finding movements by the words of their notes (mockups 41b-41f), and the
// questions that ask for it, the biggest spending and saving more.
// Invented notes and accounts only.
import test from 'node:test';
import assert from 'node:assert/strict';

import { everyMonths, matchNotes, monthsBetween, nearWord, nextInMonths, termsOf } from '../../src/app/core/assistant/note-search.ts';
import { NOTHING_LEARNED, readPhrase } from '../../src/app/core/assistant/read-phrase.ts';

const ctx = {
  accounts: [{ id: 1, name: 'Banco Azul', type: 'debit' }, { id: 2, name: 'Tarjeta Coral', type: 'credit' }],
  products: [],
  categories: [{ id: 10, name: 'Transporte', kind: 'expense' }, { id: 11, name: 'Salud', kind: 'expense' }, { id: 12, name: 'Ahorro', kind: 'expense' }],
  merchants: new Map(),
  learned: NOTHING_LEARNED,
  today: '2026-10-23',
};
const intent = text => readPhrase(text, ctx).intent;

test('nearly the same word is the same word', () => {
  assert.ok(nearWord('odontologo', 'odontologia'));
  assert.ok(nearWord('odontologia', 'odontologo'));
  assert.ok(nearWord('mantenimiento', 'mantenimientos'));
  assert.ok(nearWord('mantenimiento', 'mantenimeinto'), 'two letters swapped in a long word');
  assert.ok(nearWord('tenis', 'tennis'), 'one letter off');
  assert.ok(nearWord('dentista', 'odontologo'), 'a synonym');
  assert.ok(nearWord('gasolina', 'tanqueo'));
  assert.ok(nearWord('cita', 'citas'));
  assert.ok(!nearWord('moto', 'motor'), 'a short word needs to be the same');
  assert.ok(!nearWord('carro', 'carrito'));
  assert.ok(!nearWord('casa', 'caso'));
});

test('the words of a question that say what is looked for', () => {
  assert.deepEqual(termsOf('¿Cuándo fue el último mantenimiento de la moto?'), ['mantenimiento', 'moto']);
  assert.deepEqual(termsOf('¿Cuándo pagué el SOAT?'), ['soat']);
  assert.deepEqual(termsOf('¿Cuándo fue la última vez que fui al odontólogo?'), ['odontologo']);
  assert.deepEqual(termsOf('When did I last pay the dentist?'), ['dentist']);
});

const rows = [
  { id: 1, onDate: '2026-04-22', note: 'Mantenimiento moto\nKm: 6638. Próximo mantenimiento 3000 km o 6 meses.', category: 'Transporte' },
  { id: 2, onDate: '2025-10-18', note: 'Mantenimiento moto', category: 'Transporte' },
  { id: 3, onDate: '2025-04-09', note: 'mantenimiento de la moto', category: 'Transporte' },
  { id: 4, onDate: '2026-09-03', note: 'Dentista limpieza', category: 'Salud' },
  { id: 5, onDate: '2026-02-12', note: 'Consulta odontologia', category: 'Salud' },
  { id: 6, onDate: '2026-10-01', note: 'Mantenimiento carro', category: 'Transporte' },
  { id: 7, onDate: '2026-08-01', note: 'Gasolina moto', category: 'Transporte' },
];

test('a movement found by every word, newest first, with the words that matched', () => {
  const m = matchNotes(rows, termsOf('¿Cuándo fue el último mantenimiento de la moto?'));
  assert.deepEqual(m.all.map(r => r.id), [1, 2, 3]);
  assert.deepEqual(m.hits.get(1), ['mantenimiento', 'moto']);
});

test('a word nearly written finds it: odontólogo finds odontología and dentista', () => {
  const m = matchNotes(rows, termsOf('¿Cuándo fui al odontólogo?'));
  assert.deepEqual(m.all.map(r => r.id), [4, 5]);
});

test('nothing has every word: the ones with most of them, to offer', () => {
  const m = matchNotes(rows, ['revision', 'bicicleta']);
  assert.deepEqual(m.all, []);
  // "revisión" is a synonym of "mantenimiento": half the words, offered.
  assert.deepEqual(m.some.map(r => r.id), [6, 1, 2, 3]);
  assert.deepEqual(matchNotes(rows, ['piscina']).some, []);
});

test('how often, and when the note says the next one is', () => {
  assert.equal(everyMonths(['2026-04-22', '2025-10-18', '2025-04-09']), 6);
  assert.equal(everyMonths(['2026-04-22']), null);
  assert.equal(nextInMonths(rows[0].note), 6);
  assert.equal(nextInMonths('Mantenimiento moto'), null);
  assert.equal(monthsBetween('2026-04-22', '2026-10-23'), 6);
  assert.equal(monthsBetween('2026-04-22', '2026-10-21'), 5);
});

test('the questions are read, said in different ways', () => {
  for (const t of ['¿Cuándo fue el último mantenimiento de la moto?', 'cuando pague el soat', '¿Cuándo fue la última vez que fui al médico?',
    'ultima vez que tanquee', 'When did I last pay the gym?', 'último pago del arriendo']) {
    assert.equal(intent(t), 'lastTime', t);
  }
  for (const t of ['¿Cuál fue mi gasto más grande este mes?', 'mis gastos más grandes', 'la compra más cara de septiembre', 'What was my biggest expense?']) {
    assert.equal(intent(t), 'biggest', t);
  }
  for (const t of ['¿Qué puedo hacer para ahorrar más?', 'como ahorro mas', 'quiero gastar menos', 'How can I save more?']) {
    assert.equal(intent(t), 'saveMore', t);
  }
  for (const t of ['¿Qué puedes hacer?', 'que te puedo preguntar', 'ayuda', 'What can you do?']) {
    assert.equal(intent(t), 'help', t);
  }
  assert.equal(intent('¿Cuánto me cuesta la moto?'), 'spentIn');
  assert.equal(intent('¿Cuánto gasté en la moto este año?'), 'spentIn');
  // What was read before keeps its meaning.
  assert.equal(intent('¿En qué gasté más?'), 'topSpending');
  assert.equal(intent('¿Cómo van mis ahorros?'), 'plans');
  assert.equal(intent('¿Qué pagos tengo este mes?'), 'due');
});
