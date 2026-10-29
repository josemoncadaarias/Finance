// The word book (Jose, 2026-10-29: "la app debe aprender TODO POR SI SOLA"):
// every message saved from a source and every "No es un movimiento" are
// examples, and a new message is judged by the words it shares with each
// kind. Every app, sender, shop and message invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/word-book.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWordBook, verdictOf, wordsOf } from '../../src/app/core/notices/word-book.ts';
import { learnNotMovement, silencedBy } from '../../src/app/core/notices/molds.ts';
import { readNotice, saysItHappened, saysWhichWay } from '../../src/app/core/notices/read-notice.ts';
import { readNotices } from '../../src/app/core/notices/notice-proposals.ts';

const APP = 'com.tienda.sol';
const SMS = 'sms|89123';
const PURCHASE = text => `Tu compra en ${text} fue exitosa. Consulta los detalles de tu compra en tus transacciones.`;

// What a person answered: two adverts and a purchase from the app; one
// advert from the SMS sender.
const answered = [
  { source: APP, move: false, text: 'Combo doble a $19.900, antes: 29.900. Pide ya en Sol' },
  { source: APP, move: false, text: 'Llévate 2x1 en hamburguesas con tu SolCard este fin de semana' },
  { source: APP, move: true, text: PURCHASE('Taxis Rapidos por $ 23.216') },
  { source: SMS, move: false, text: 'Sol: Conoce la ciudad estrenando ruta con Aerolinea Azul. Paga a 0% de interés hasta 6 cuotas con tu SolCard y $0 mínimo. Aplican T&C. Vigilado SFC.' },
];

function judged(book, source, text) {
  return verdictOf(book, source, text, saysWhichWay(text));
}

test('words are single words and pairs, folded, with no figures', () => {
  const words = wordsOf('Compraste $45.900 en ÉXITO');
  assert.ok(words.includes('compraste'));
  assert.ok(words.includes('en exito'));
  assert.ok(!words.some(one => /\d/.test(one)));
});

test('a purchase like one saved is a movement; an advert like one marked is an advert', () => {
  const book = buildWordBook(answered);
  assert.equal(judged(book, APP, PURCHASE('Telefonia Norte por $ 40.799')), 'movement');
  assert.equal(judged(book, APP, 'Pide ya tu combo a $15.900, antes 22.900'), 'advert');
  assert.equal(judged(book, SMS, 'Sol: Viaja a la playa con Aerolinea Roja. Paga a 0% de interés hasta 12 cuotas con tu SolCard. Aplican T&C. Vigilado SFC.'), 'advert');
});

test('a source known only by its adverts never hides a message that says which way money went', () => {
  const book = buildWordBook(answered);
  // Its own sign-off ("Vigilado SFC") is shared with its real messages.
  assert.equal(judged(book, SMS, 'Sol: Compra por $50.000 en Tienda Luna con tu SolCard. Vigilado SFC.'), null);
  // And money said to have moved is never silenced by the book.
  const said = 'Sol: Compraste $50.000 en Tienda Luna con tu SolCard. Vigilado SFC.';
  const quiet = answered.filter(one => !one.move).reduce((q, one) => learnNotMovement(q, one.source, one.text, 1), { notMolds: [], strict: [] });
  assert.equal(silencedBy(SMS, said, quiet, [], saysItHappened(said), book, saysWhichWay(said)), null);
});

test('before the person marks anything, the book never hides a message', () => {
  const book = buildWordBook([]);
  assert.notEqual(verdictOf(book, APP, 'Aprovecha 30% de descuento hoy'), 'advert');
  assert.notEqual(verdictOf(book, 'otra', 'Pide ya: 2x1 solo por hoy'), 'advert');
});

test('another bank benefits from what was taught about the others', () => {
  const book = buildWordBook(answered);
  // A source never answered judges by everybody's examples.
  assert.equal(judged(book, 'com.banco.nuevo', PURCHASE('Libreria Central por $ 12.000')), 'movement');
});

test('an offer of credit and a price of $0 are no movement', () => {
  const advert = 'Conoce la ciudad estrenando ruta. Paga a 0% de interés hasta 6 cuotas con tu tarjeta y $0 mínimo. Aplican T&C.';
  assert.equal(readNotice(advert).kind, 'none');
  assert.equal(readNotice('Solicítala sin cuota de manejo, aplican términos y condiciones. Cupo de $2.000.000').kind, 'none');
});

test('a purchase told as done is money that moved, a refused one is not', () => {
  assert.ok(saysItHappened(PURCHASE('Telefonia Norte por $ 40.799')));
  assert.ok(!saysItHappened('Tu compra en Telefonia Norte por $ 40.799 no fue exitosa'));
  const read = readNotice(PURCHASE('Telefonia Norte por $ 40.799'));
  assert.equal(read.kind, 'movement');
  assert.equal(read.amountMinor, 4079900);
  assert.equal(read.direction, 'out');
});

test('end to end: what the book learned decides what is proposed', () => {
  const quiet = answered.filter(one => !one.move).reduce((q, one) => learnNotMovement(q, one.source, one.text, 1), { notMolds: [], strict: [] });
  const book = buildWordBook(answered);
  const at = Date.parse('2026-10-29T12:00:00');
  const note = (source, text, i) => source === SMS
    ? { package: 'sms', sender: '89123', app: 'SMS', title: '89123', text, postedAt: at + i * 60_000 }
    : { package: APP, app: 'Sol', title: 'Sol', text, postedAt: at + i * 60_000 };
  const accounts = [{ id: 1, name: 'Billetera Sol', type: 'debit', currency_code: 'COP', archived: 0 }];
  const { fresh } = readNotices([
    note(APP, PURCHASE('Telefonia Norte por $ 40.799'), 0),
    note(APP, 'Combo triple a $29.900, antes: 39.900. Pide ya en Sol', 1),
    note(SMS, 'Sol: Viaja con Aerolinea Roja. Paga a 0% de interés hasta 12 cuotas con tu SolCard. Aplican T&C.', 2),
  ], new Set(), [], accounts, [], { molds: [], assigned: new Map(), quiet, book });
  assert.deepEqual(fresh.map(one => one.proposal.amount_minor), [-4079900]);
});
