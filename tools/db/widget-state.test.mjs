// What the home-screen widget is handed (Jose, 2026-11-25, mockup 59a).
// Figures invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/widget-state.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { spendRoom } from '../../src/app/core/assistant/spend-room.ts';
import { widgetStateOf, wholePesos } from '../../src/app/core/widget/widget-state.ts';

const P = pesos => Math.round(pesos * 100);
const words = {
  title: 'Hoy puedes gastar', overTitle: 'Este mes ya gastaste de más',
  line: (left, end) => `De ${left} libres hasta el ${end}`, lineOne: left => `Último día: ${left}`,
  overLine: 'Te falta', none: 'Registra tus ingresos', empty: 'Crea tu primera cuenta', stale: 'Mes nuevo',
  hiddenLine: 'Toca el ojo', expense: 'Gasto', income: 'Ingreso', assistant: 'Asistente', show: 'Mostrar', hide: 'Ocultar',
};
const room = (spent, today = '2026-11-18') => spendRoom({
  incomes: [{ month: '2026-08', inMinor: P(3_000_000) }, { month: '2026-09', inMinor: P(3_000_000) }, { month: '2026-10', inMinor: P(3_000_000) }],
  savePct: 20, goalsAskMinor: 0, spentMinor: P(spent), payments: [], today,
});

test('whole pesos, grouped as the app groups them', () => {
  assert.equal(wholePesos(P(702_000)), '$ 702.000');
  assert.equal(wholePesos(P(-120_000.55)), '−$ 120.000');
  assert.equal(wholePesos(0), '$ 0');
});

test('a month with money left hands what is left and the month end', () => {
  const r = room(1_000_000);
  const s = widgetStateOf(r, words, '30 de noviembre', false);
  assert.equal(s.mode, 'ok');
  assert.equal(s.leftMinor, r.leftMinor);
  assert.equal(s.monthEnd, '2026-11-30');
  assert.equal(s.line, `De ${wholePesos(r.leftMinor)} libres hasta el 30 de noviembre`);
  assert.equal(s.hidden, false);
});

test('the widget divides as the app does: what is left over the days left, today counted', () => {
  // The same rule SpendWidget.perDayOf follows in Java.
  const javaPerDay = (minor, days) => (minor <= 0 || days <= 0 ? 0 : Math.floor(minor / days / 10_000) * 10_000);
  for (const day of ['2026-11-01', '2026-11-18', '2026-11-30']) {
    const r = room(500_000, day);
    assert.equal(javaPerDay(r.leftMinor, r.daysLeft), r.perDayMinor, day);
  }
  const java = readFileSync(new URL('../../android/app/src/main/java/com/josemoncada/finance/SpendWidget.java', import.meta.url), 'utf8');
  assert.match(java, /return \(minor \/ days \/ 10_000\) \* 10_000;/);
  assert.match(java, /return d - now\.get\(Calendar\.DAY_OF_MONTH\) \+ 1;/);
});

test('the last day says so', () => {
  const s = widgetStateOf(room(500_000, '2026-11-30'), words, '30 de noviembre', false);
  assert.match(s.line, /^Último día/);
});

test('a month gone over shows what is missing, in red on the phone', () => {
  const s = widgetStateOf(room(2_800_000), words, '30 de noviembre', false);
  assert.equal(s.mode, 'over');
  assert.equal(s.overFigure, wholePesos(s.leftMinor));
  assert.ok(s.overFigure.startsWith('−'));
});

test('no income, or no account, says what to do instead of a figure', () => {
  const none = spendRoom({ incomes: [], savePct: 20, goalsAskMinor: 0, spentMinor: 0, payments: [], today: '2026-11-18' });
  assert.equal(widgetStateOf(none, words, '30 de noviembre', false).mode, 'none');
  assert.equal(widgetStateOf(none, words, '30 de noviembre', false).none, 'Registra tus ingresos');
  const empty = widgetStateOf(null, words, '', true);
  assert.equal(empty.mode, 'none');
  assert.equal(empty.none, 'Crea tu primera cuenta');
});

test('"Ocultar montos al abrir" starts it hidden', () => {
  assert.equal(widgetStateOf(room(0), words, '30 de noviembre', true).hidden, true);
});
