// A question that goes on from the one before (Jose, 2026-11-06, mockups
// 55a-55g). Every account, category and sentence here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/follow-up.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NOTHING_LEARNED, readPhrase } from '../../src/app/core/assistant/read-phrase.ts';
import { followUp } from '../../src/app/core/assistant/follow-up.ts';
import { fromIsoDay, periodContaining, shiftPeriod } from '../../src/app/core/filters/period.ts';

const TODAY = '2026-11-06';
const NOW = fromIsoDay(TODAY);
const P = pesos => Math.round(pesos * 100);

const ctx = {
  accounts: [
    { id: 1, name: 'Banco Azul', type: 'debit' },
    { id: 2, name: 'Ahorro Verde', type: 'debit' },
    { id: 3, name: 'Tarjeta Coral', type: 'credit' },
  ],
  products: [],
  categories: [
    { id: 10, name: 'Mercado', kind: 'expense' },
    { id: 11, name: 'Restaurantes', kind: 'expense' },
    { id: 12, name: 'Ropa', kind: 'expense' },
    { id: 20, name: 'Salario', kind: 'income' },
  ],
  merchants: new Map(),
  learned: NOTHING_LEARNED,
  today: TODAY,
};

/** Reads a sentence after the questions before it, the newest first. */
const next = (text, history) => followUp(text, readPhrase(text, ctx), history);

const restaurantsThisMonth = { intent: 'spentIn', said: '¿Cuánto llevo en restaurantes este mes?', categoryIds: [11], accountId: null, period: null };
const october = shiftPeriod(periodContaining('month', NOW), -1);

test('"¿y el mes pasado?" keeps the category and changes the period (55a)', () => {
  const f = next('¿y el mes pasado?', [restaurantsThisMonth]);
  assert.equal(f.kind, 'ask');
  assert.equal(f.asked.intent, 'spentIn');
  assert.deepEqual(f.asked.categoryIds, [11]);
  assert.equal(f.asked.period.from, october.from);
  assert.deepEqual(f.pieces, [
    { what: 'question', from: 'before' }, { what: 'category', from: 'before' }, { what: 'period', from: 'now' },
  ]);
});

test('a month by its name alone, with no "y", goes on too', () => {
  const f = next('¿en septiembre?', [restaurantsThisMonth]);
  assert.equal(f.kind, 'ask');
  assert.equal(f.asked.period.from, '2026-09-01');
});

test('"¿y en mercado?" keeps the period and changes the category; "los dos juntos" adds them (55b)', () => {
  const restaurantsOctober = { ...restaurantsThisMonth, period: october };
  const f = next('¿y en mercado?', [restaurantsOctober]);
  assert.equal(f.kind, 'ask');
  assert.deepEqual(f.asked.categoryIds, [10]);
  assert.equal(f.asked.period.from, october.from);
  const both = next('¿y los dos juntos?', [f.asked, restaurantsOctober]);
  assert.equal(both.kind, 'ask');
  assert.deepEqual(both.asked.categoryIds.sort(), [10, 11]);
  assert.equal(both.asked.period.from, october.from);
});

test('a category after "¿cómo voy?" is what went to it that period', () => {
  const how = { intent: 'howAmI', said: '¿Cómo voy?', categoryIds: [], accountId: null, period: october };
  const f = next('¿y en ropa?', [how]);
  assert.equal(f.asked.intent, 'spentIn');
  assert.deepEqual(f.asked.categoryIds, [12]);
  assert.equal(f.asked.period.from, october.from);
  assert.deepEqual(f.pieces[0], { what: 'question', from: 'now' });
});

test('"¿y en Ahorro Verde?" and "¿y en total?" change the account (55c)', () => {
  const blue = { intent: 'have', said: '¿Cuánto tengo en Banco Azul?', categoryIds: [], accountId: 1, period: null };
  const green = next('¿y en Ahorro Verde?', [blue]);
  assert.equal(green.kind, 'ask');
  assert.equal(green.asked.intent, 'have');
  assert.equal(green.asked.accountId, 2);
  const total = next('¿y en total?', [green.asked, blue]);
  assert.equal(total.kind, 'ask');
  assert.equal(total.asked.accountId, null);
  assert.deepEqual(total.pieces, [{ what: 'question', from: 'before' }, { what: 'account', from: 'now' }]);
});

test('"¿por qué?" after a summary asks why the spending moved, the same period (55d)', () => {
  const how = { intent: 'howAmI', said: '¿Cómo voy este mes?', categoryIds: [], accountId: null, period: null };
  for (const said of ['¿por qué?', 'y por qué', 'porque', '¿y eso por qué?']) {
    const f = next(said, [how]);
    assert.equal(f.kind, 'ask', said);
    assert.equal(f.asked.intent, 'whyMore');
    assert.equal(f.asked.period, null);
  }
  // After something that has no "why", it is no follow-up.
  assert.equal(next('¿por qué?', [{ ...how, intent: 'have' }]).kind, 'none');
});

test('another movement takes the account and the day of the one before (55e)', () => {
  const groceries = { intent: 'register', said: 'Gasté 45 mil en el mercado', categoryIds: [10], accountId: 1, period: null, side: 'expense', onDate: '2026-11-05' };
  const f = next('y 12 mil en la panadería', [groceries]);
  assert.equal(f.kind, 'register');
  assert.equal(f.reading.amountMinor, P(12000));
  assert.equal(f.reading.side, 'expense');
  assert.equal(f.reading.accountId, 1);
  assert.equal(f.reading.onDate, '2026-11-05');
  assert.deepEqual(f.pieces, [{ what: 'account', from: 'before' }, { what: 'day', from: 'before' }]);
  // What is said wins: another account, another day.
  const card = next('y 30 mil con la Tarjeta Coral hoy', [groceries]);
  assert.equal(card.reading.accountId, 3);
  assert.equal(card.reading.onDate, TODAY);
  assert.deepEqual(card.pieces, [{ what: 'account', from: 'now' }, { what: 'day', from: 'now' }]);
});

test('"con la Coral" moves the last movement to that account', () => {
  const groceries = { intent: 'register', said: 'y 12 mil en la panadería', categoryIds: [], accountId: 1, period: null, side: 'expense', onDate: TODAY };
  assert.deepEqual(next('con la Tarjeta Coral', [groceries]), { kind: 'moveTo', accountId: 3 });
});

test('a follow-up that cannot be placed is asked back (55g)', () => {
  const due = { intent: 'have', said: '¿Cuánto tengo?', categoryIds: [], accountId: null, period: null };
  assert.equal(next('¿y el otro?', [due]).kind, 'unclear');
  assert.equal(next('¿y el otro?', [restaurantsThisMonth]).kind, 'unclear');
});

test('a whole question of its own is that question, never a follow-up', () => {
  for (const said of ['¿Cuánto debo?', 'y ¿cuánto debo?', 'Gasté 20 mil en ropa', '¿Cómo voy este mes?']) {
    assert.equal(next(said, [restaurantsThisMonth]).kind, 'none', said);
  }
  // With nothing asked before there is nothing to go on from.
  assert.equal(next('¿y el mes pasado?', []).kind, 'none');
  // A short sentence that says nothing new is not taken for a follow-up.
  assert.equal(next('hola', [restaurantsThisMonth]).kind, 'none');
});

test('after a question with no pieces to change, "¿y el otro?" is asked back and an amount is a movement', () => {
  const due = { intent: 'due', said: '¿Qué pagos tengo este mes?', categoryIds: [], accountId: null, period: null };
  assert.equal(next('¿y el otro?', [due]).kind, 'unclear');
  assert.equal(next('y 20 mil en ropa', [due]).kind, 'none');
});

test('a movement whose account is still being asked is gone on from with no account', () => {
  const asking = { intent: 'register', said: 'Gasté 45 mil en el mercado', categoryIds: [10], accountId: null, period: null, side: 'expense', onDate: TODAY };
  const f = next('y 12 mil en la panadería', [asking]);
  assert.equal(f.kind, 'register');
  assert.equal(f.reading.accountId, null);
});
