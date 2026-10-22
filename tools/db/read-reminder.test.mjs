// Reminders said in words (Jose, 2026-10-22), in the ways different people
// would say them. Every bill and name here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/read-reminder.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { readReminder, nextDayOfMonth, REMIND, REMINDERS_LIST } from '../../src/app/core/assistant/read-reminder.ts';

const TODAY = '2026-10-22'; // a Thursday
const fold = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CASES = [
  ['Recuérdame pagar el arriendo el 5 de cada mes', { title: 'Pagar el arriendo', repeat: 'monthly', dayOfMonth: 5 }],
  ['recuerdame cada mes el 15 pagar la luz', { title: 'Pagar la luz', repeat: 'monthly', dayOfMonth: 15 }],
  ['avísame todos los 30 que pague el internet', { title: 'Pague el internet', repeat: 'monthly', dayOfMonth: 30 }],
  ['Recuérdame mañana a las 9 pagarle a Pedro', { title: 'Pagarle a Pedro', repeat: 'once', onDate: '2026-10-23', hour: 9 }],
  ['avisame el viernes a las 7 de la noche que pague el gimnasio', { title: 'Pague el gimnasio', repeat: 'once', onDate: '2026-10-23', hour: 19 }],
  ['no me dejes olvidar el seguro del carro el 15 de noviembre', { title: 'El seguro del carro', repeat: 'once', onDate: '2026-11-15' }],
  ['recuérdame el 5 pagar la tarjeta', { title: 'Pagar la tarjeta', repeat: null, dayOfMonth: 5 }],
  ['recuérdame en 3 días renovar el soat', { title: 'Renovar el soat', repeat: 'once', onDate: '2026-10-25' }],
  ['recuérdame pagar la administración un día antes del 10 de cada mes', { title: 'Pagar la administración', repeat: 'monthly', dayOfMonth: 10, daysBefore: 1 }],
  ['Remind me to pay the rent on the 1st of every month', { title: 'Pay the rent', repeat: 'monthly', dayOfMonth: 1 }],
  ['remind me tomorrow at 8am to call the bank', { title: 'Call the bank', repeat: 'once', onDate: '2026-10-23', hour: 8 }],
  ['hazme acordar de pagar el colegio el 3 de enero', { title: 'Pagar el colegio', repeat: 'once', onDate: '2027-01-03' }],
];

for (const [said, expected] of CASES) {
  test(`a reminder, said one way: "${said}"`, () => {
    assert.ok(REMIND.test(fold(said)), 'is a reminder');
    const r = readReminder(said, TODAY);
    for (const [k, v] of Object.entries(expected)) assert.equal(r[k], v, `${k} of "${said}"`);
  });
}

test('the reminders there are, asked any way', () => {
  for (const said of ['¿qué recordatorios tengo?', 'mis recordatorios', 'cuántos recordatorios hay', 'what reminders do I have']) {
    assert.ok(REMINDERS_LIST.test(fold(said)), said);
  }
});

test('the next date of a day of the month: this month when still ahead, else the next', () => {
  assert.equal(nextDayOfMonth(TODAY, 25), '2026-10-25');
  assert.equal(nextDayOfMonth(TODAY, 5), '2026-11-05');
  assert.equal(nextDayOfMonth('2027-01-31', 31), '2027-01-31');
});
