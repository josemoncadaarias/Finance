// The assistant reads a sentence by its shape (Jose, 2026-10-19, mockups
// 39a-39l): nothing burned in for one person. Every account, category and
// sentence here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/read-phrase.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { NOTHING_LEARNED, readPhrase } from '../../src/app/core/assistant/read-phrase.ts';
import { wordCategoryOf } from '../../src/app/core/proposals/common-words.ts';

const P = pesos => Math.round(pesos * 100);
const TODAY = '2026-10-19'; // a Monday

const ctx = (extra = {}) => ({
  accounts: [
    { id: 1, name: 'Bancolombia', type: 'debit' },
    { id: 2, name: 'Rappi cuenta', type: 'debit' },
    { id: 3, name: 'Rappi Card', type: 'credit' },
    { id: 4, name: 'Efectivo', type: 'cash' },
    { id: 5, name: 'Banco Índigo', type: 'debit' },
    { id: 6, name: 'Ahorros', type: 'debit' },
  ],
  products: [
    { id: 50, accountId: 5, name: 'Ahorros Índigo' },
    { id: 51, accountId: 5, name: 'Bolsillo viajes' },
  ],
  categories: [
    { id: 10, name: 'Mercado', kind: 'expense' },
    { id: 11, name: 'Restaurante', kind: 'expense' },
    { id: 12, name: 'Transporte', kind: 'expense' },
    { id: 13, name: 'Ropa', kind: 'expense' },
    { id: 14, name: 'Deporte', kind: 'expense' },
    { id: 20, name: 'Salario', kind: 'income' },
  ],
  merchants: new Map([['EXITO', 10]]),
  commonWord: (word, side) => wordCategoryOf(word, side === 'income' ? 1 : -1)?.es ?? null,
  learned: NOTHING_LEARNED,
  today: TODAY,
  ...extra,
});

test('a spending with its amount, shop, account and category (39c)', () => {
  const r = readPhrase('Gasté 45 mil en el Éxito con la Rappi Card', ctx());
  assert.equal(r.intent, 'register');
  assert.equal(r.side, 'expense');
  assert.equal(r.amountMinor, P(45000));
  assert.equal(r.accountId, 3);
  assert.equal(r.categoryId, 10);
  assert.equal(r.categoryFrom, 'learned');
  assert.equal(r.thing, 'Éxito');
  assert.equal(r.onDate, TODAY);
});

test('a word shared by two accounts asks which one; a learned word answers it', () => {
  const r = readPhrase('Gasté 45 mil en el Éxito con la Rappi', ctx());
  assert.equal(r.accountId, null);
  assert.deepEqual([...r.accountChoices].sort(), [2, 3]);
  const taught = readPhrase('Gasté 45 mil en el Éxito con la Rappi', ctx({ learned: { accounts: { rappi: 3 }, shapes: {} } }));
  assert.equal(taught.accountId, 3);
});

test('yesterday, a common word for the category, no account (39c)', () => {
  const r = readPhrase('Ayer 12 mil de bus', ctx());
  assert.equal(r.amountMinor, P(12000));
  assert.equal(r.onDate, '2026-10-18');
  assert.equal(r.categoryId, 12);
  assert.equal(r.categoryFrom, 'common');
  assert.equal(r.intent, 'unsure');
  assert.equal(r.accountId, null);
});

test('money coming in, in words', () => {
  const r = readPhrase('Me llegó el sueldo de cuatro millones', ctx());
  assert.equal(r.intent, 'register');
  assert.equal(r.side, 'income');
  assert.equal(r.amountMinor, P(4_000_000));
  assert.equal(r.categoryId, 20);
});

test('a transfer between two accounts', () => {
  const r = readPhrase('Pasé 200 mil de Bancolombia a Ahorros', ctx());
  assert.equal(r.side, 'transfer');
  assert.equal(r.amountMinor, P(200000));
  assert.equal(r.accountId, 1);
  assert.equal(r.toAccountId, 6);
});

test('a transfer naming only where it went', () => {
  const r = readPhrase('Pasé 200 mil a Ahorros', ctx());
  assert.equal(r.accountId, null);
  assert.equal(r.toAccountId, 6);
});

test('can I afford it: a question, with the thing and its category (39d)', () => {
  const r = readPhrase('¿Me alcanza para unos tenis de 300 mil?', ctx({ merchants: new Map([['TENIS', 13]]) }));
  assert.equal(r.intent, 'afford');
  assert.equal(r.amountMinor, P(300000));
  assert.equal(r.thing, 'tenis');
  assert.equal(r.categoryId, 13);
});

test('a word nobody taught yet is handed back, and a bare 250 is 250 mil (39e)', () => {
  const r = readPhrase('¿Puedo comprarme unas guayos de 250?', ctx());
  assert.equal(r.intent, 'afford');
  assert.equal(r.amountMinor, P(250000));
  assert.equal(r.amountGuessed, true);
  assert.equal(r.amountText, '250');
  assert.equal(r.thing, 'guayos');
  assert.equal(r.categoryId, null);
});

test('no category at all: the whole picture (39i)', () => {
  const r = readPhrase('¿Me puedo gastar 2 millones en algo?', ctx());
  assert.equal(r.intent, 'afford');
  assert.equal(r.amountMinor, P(2_000_000));
  assert.equal(r.categoryId, null);
  assert.equal(r.thing, null);
});

test('from one account (39j)', () => {
  const r = readPhrase('¿Puedo pagar 800 mil desde Bancolombia?', ctx());
  assert.equal(r.intent, 'afford');
  assert.equal(r.accountId, 1);
  assert.equal(r.amountMinor, P(800000));
});

test('a name said as the thing is not a place: "un viaje" with a pocket called Viajes', () => {
  const r = readPhrase('¿Me alcanza para un viaje de 3 millones?', ctx({ products: [{ id: 52, accountId: 5, name: 'Viaje' }] }));
  assert.equal(r.accountId, null);
  assert.equal(r.productId, null);
  assert.equal(r.thing, 'viaje');
});

test('a product names its account (39l)', () => {
  const r = readPhrase('Gasté 50 mil del bolsillo viajes', ctx());
  assert.equal(r.productId, 51);
  assert.equal(r.accountId, 5);
});

test('no verb: it asks, and the answer is kept for that shape (39f)', () => {
  const first = readPhrase('200 mil en mercado', ctx());
  assert.equal(first.intent, 'unsure');
  assert.equal(first.categoryId, 10);
  const learned = { accounts: {}, shapes: { [first.shape]: 'register' } };
  const next = readPhrase('80 mil en restaurante', ctx({ learned }));
  assert.equal(next.intent, 'register');
  assert.equal(next.side, 'expense');
  assert.equal(next.categoryId, 11);
});

test('the questions without an amount', () => {
  assert.equal(readPhrase('¿Cuánto llevo en restaurantes?', ctx()).intent, 'spentIn');
  assert.equal(readPhrase('¿Cuánto llevo en restaurantes?', ctx()).categoryId, 11);
  assert.equal(readPhrase('¿Cuánto puedo gastar al día?', ctx()).intent, 'perDay');
  assert.equal(readPhrase('¿Cómo calculas lo de mis metas?', ctx()).intent, 'howGoals');
  assert.equal(readPhrase('hola', ctx()).intent, 'unknown');
});

test('amounts written every way', () => {
  const amount = text => readPhrase(`gasté ${text} en mercado`, ctx()).amountMinor;
  assert.equal(amount('$45.000'), P(45000));
  assert.equal(amount('45.000'), P(45000));
  assert.equal(amount('45,000'), P(45000));
  assert.equal(amount('45000'), P(45000));
  assert.equal(amount('45k'), P(45000));
  assert.equal(amount('45mil'), P(45000));
  assert.equal(amount('1.250.000'), P(1_250_000));
  assert.equal(amount('1,5 millones'), P(1_500_000));
  assert.equal(amount('dos millones quinientos mil'), P(2_500_000));
  assert.equal(amount('cuarenta y cinco mil'), P(45000));
  assert.equal(amount('medio millón'), P(500_000));
  assert.equal(amount('un millón'), P(1_000_000));
  assert.equal(amount('50 lucas'), P(50000));
  assert.equal(amount('2 palos'), P(2_000_000));
  assert.equal(amount('12.500,50'), Math.round(12500.5 * 100));
  assert.equal(amount('800 pesos'), P(800));
});

test('days named by the week or the month', () => {
  assert.equal(readPhrase('el viernes gasté 20 mil en taxi', ctx()).onDate, '2026-10-16');
  assert.equal(readPhrase('antier gasté 20 mil en taxi', ctx()).onDate, '2026-10-17');
  assert.equal(readPhrase('gasté 20 mil en taxi el 5', ctx()).onDate, '2026-10-05');
  assert.equal(readPhrase('gasté 20 mil en taxi el 25', ctx()).onDate, '2026-09-25');
});

test('English too', () => {
  const r = readPhrase('I spent 30 thousand on a taxi yesterday', ctx());
  assert.equal(r.intent, 'register');
  assert.equal(r.amountMinor, P(30000));
  assert.equal(r.onDate, '2026-10-18');
  assert.equal(r.categoryId, 12);
});

// Jose, 2026-10-19, from the phone: a move between products of one account,
// said by voice, with "Rappi" heard as "rap y".
const withPockets = () => ctx({
  products: [
    { id: 50, accountId: 5, name: 'Ahorros Índigo' },
    { id: 51, accountId: 5, name: 'Bolsillo viajes' },
    { id: 60, accountId: 2, name: 'Bolsillo Principal' },
    { id: 61, accountId: 2, name: 'Cuenta de ahorros' },
    { id: 62, accountId: 1, name: 'Cuenta de ahorros' },
  ],
});

test('"transferencia ... entre un producto a otro de rap y cuenta": a move between products', () => {
  const r = readPhrase('transferencia de $200,000 entre bolsillo principal a la cuenta de ahorros de rap y cuenta', withPockets());
  assert.equal(r.intent, 'register');
  assert.equal(r.side, 'transfer');
  assert.equal(r.amountMinor, P(200000));
  assert.equal(r.accountId, 2);
  assert.equal(r.toAccountId, 2);
  assert.equal(r.fromProductId, 60);
  assert.equal(r.toProductId, 61);
});

test('only where it went, inside the account named by sound', () => {
  const r = readPhrase('pasé $200,000 a la cuenta de ahorros en la rap y cuenta', withPockets());
  assert.equal(r.side, 'transfer');
  assert.equal(r.accountId, 2);
  assert.equal(r.toAccountId, 2);
  assert.equal(r.fromProductId, null);
  assert.equal(r.toProductId, 61);
});

test('dictation drops the "a": "pasé 200 mil ahorros en la rappi cuenta"', () => {
  // With no account called "Ahorros": one so named would be that account.
  const c = withPockets();
  c.accounts = c.accounts.filter(a => a.id !== 6);
  const r = readPhrase('pasé $200,000 ahorros en la rappi cuenta', c);
  assert.equal(r.accountId, 2);
  assert.equal(r.toAccountId, 2);
  assert.equal(r.toProductId, 61);
});

test('an account heard by sound: "rapi cuenta", "neki"', () => {
  const r = readPhrase('pasé 50 mil de bancolombia a la rapi cuenta', withPockets());
  assert.equal(r.accountId, 1);
  assert.equal(r.toAccountId, 2);
  const s = readPhrase('gasté 20 mil en mercado con neki', ctx({ accounts: [{ id: 9, name: 'Nequi', type: 'debit' }] }));
  assert.equal(s.accountId, 9);
});

test('a product of one account to another account', () => {
  const r = readPhrase('moví 100 mil del bolsillo viajes a Bancolombia', withPockets());
  assert.equal(r.side, 'transfer');
  assert.equal(r.accountId, 5);
  assert.equal(r.fromProductId, 51);
  assert.equal(r.toAccountId, 1);
  assert.equal(r.toProductId, null);
});

// Other people, other words (Jose, 2026-10-19: "no tienen que ser palabras
// mías exactas"). Invented accounts and products; each sentence is said the
// way somebody else might say the same thing.
const others = () => ({
  accounts: [
    { id: 1, name: 'Bancolombia', type: 'debit' },
    { id: 2, name: 'Nequi', type: 'debit' },
    { id: 3, name: 'Daviplata', type: 'debit' },
    { id: 4, name: 'Efectivo', type: 'cash' },
    { id: 5, name: 'Tarjeta Visa', type: 'credit' },
    { id: 7, name: 'Banco Azul', type: 'debit' },
  ],
  products: [
    { id: 70, accountId: 7, name: 'Principal' },
    { id: 71, accountId: 7, name: 'Bolsillo Viajes' },
    { id: 72, accountId: 7, name: 'Cajita Emergencias' },
    { id: 20, accountId: 2, name: 'Colchón' },
  ],
  categories: [
    { id: 10, name: 'Mercado', kind: 'expense' },
    { id: 11, name: 'Familia', kind: 'expense' },
    { id: 20, name: 'Salario', kind: 'income' },
  ],
  merchants: new Map(),
  learned: NOTHING_LEARNED,
  today: TODAY,
});

const MOVES = [
  // [sentence, from account, from product, to account, to product]
  ['Pasé 100 mil de Bancolombia a Nequi', 1, null, 2, null],
  ['le pasé 100 mil a nequi desde bancolombia', 1, null, 2, null],
  ['transferí 100.000 de bancolombia para nequi', 1, null, 2, null],
  ['hice una transferencia de 100 mil de Bancolombia a Nequi', 1, null, 2, null],
  ['mandé cien mil a Nequi de Bancolombia', 1, null, 2, null],
  ['envié 100 lucas de bancolombia a nequi', 1, null, 2, null],
  ['trasladamos 100 mil de Bancolombia hacia Nequi', 1, null, 2, null],
  ['voy a pasar 100 mil de bancolombia a nequi', 1, null, 2, null],
  ['moví 100 mil desde Daviplata hasta Bancolombia', 3, null, 1, null],
  ['consigné 300 mil en Bancolombia desde Daviplata', 3, null, 1, null],
  ['giro de 50 mil de nequi a daviplata', 2, null, 3, null],
  ['100 mil de bancolombia a nequi', 1, null, 2, null],
  ['metí 200 mil al bolsillo viajes', 7, null, 7, 71],
  ['guardé 200 mil en la cajita emergencias de banco azul', 7, null, 7, 72],
  ['separé 150 mil para el bolsillo de viajes', 7, null, 7, 71],
  ['saqué 80 mil del bolsillo viajes a la principal', 7, 71, 7, 70],
  ['retiré 50 mil de la cajita emergencias', 7, 72, 7, null],
  ['muevo 1 millón de la principal a la cajita de emergencias', 7, 70, 7, 72],
  ['pásale 20 mil al colchón', 2, null, 2, 20],
  ['saqué 200 mil del cajero de Bancolombia', 1, null, 4, null],
  ['retiré 100 mil de nequi', 2, null, 4, null],
  ['pagué la tarjeta visa 500 mil desde bancolombia', 1, null, 5, null],
  ['abono de 300 mil a la tarjeta visa con nequi', 2, null, 5, null],
  ['pagué 400 mil a la visa', null, null, 5, null],
  ['pago de la tarjeta visa 250 mil desde nequi', 2, null, 5, null],
  ['transferred 100 thousand from Bancolombia to Nequi', 1, null, 2, null],
  ['I moved 200k into bolsillo viajes', 7, null, 7, 71],
  ['pase 100 mil de banco lombia a neki', 1, null, 2, null],
  ['pasé 100 mil de davi plata a nequi', 3, null, 2, null],
];

for (const [sentence, from, fromProduct, to, toProduct] of MOVES) {
  test(`a move, said another way: "${sentence}"`, () => {
    const r = readPhrase(sentence, others());
    assert.equal(r.side, 'transfer', 'side');
    assert.equal(r.accountId, from, 'from');
    assert.equal(r.fromProductId ?? null, fromProduct, 'from product');
    assert.equal(r.toAccountId, to, 'to');
    assert.equal(r.toProductId ?? null, toProduct, 'to product');
  });
}

const NOT_MOVES = [
  // [sentence, side]
  ['me pasaron 200 mil a Nequi', 'income'],
  ['me consignaron el sueldo, 3 millones, en bancolombia', 'income'],
  ['me devolvieron 50 mil en daviplata', 'income'],
  ['gasté 80 mil en mercado con nequi', 'expense'],
  ['compré mercado de 120 mil con la tarjeta visa', 'expense'],
  ['pagué 60 mil de mercado con bancolombia', 'expense'],
  ['pagué el mercado con la tarjeta visa, 90 mil', 'expense'],
];
for (const [sentence, side] of NOT_MOVES) {
  test(`not a move: "${sentence}"`, () => {
    assert.equal(readPhrase(sentence, others()).side, side);
  });
}
