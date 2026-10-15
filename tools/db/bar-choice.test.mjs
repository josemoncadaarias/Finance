// "Barra de abajo": which three screens the floating bar carries, in what
// order, where the app opens and which button an address lights
// (core/ui/bar-choice.ts).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/bar-choice.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { BAR_SCREENS, DEFAULT_BAR, barOf, buttonFor, leftTheBar, movedBar, startRoute, withChoice } from '../../src/app/core/ui/bar-choice.ts';
import { SPANISH as es, ENGLISH as en } from '../../src/app/core/i18n/translations.ts';

test('the bar comes as Inicio, Cuentas, Reporte and opens on Inicio', () => {
  assert.deepEqual(barOf(undefined), ['home', 'accounts', 'report']);
  assert.equal(startRoute(barOf(null)), '/movements');
  assert.deepEqual(leftTheBar(DEFAULT_BAR), []);
});

test('anything stored that is not three different known screens is how the app comes', () => {
  for (const bad of [[], ['home'], ['home', 'home', 'report'], ['home', 'nope', 'report'], 'home', ['home', 'accounts', 'report', 'debts']])
    assert.deepEqual(barOf(bad), [...DEFAULT_BAR], JSON.stringify(bad));
  assert.deepEqual(barOf(['debts', 'home', 'plans']), ['debts', 'home', 'plans']);
});

test('a button changed takes the new screen; one already on the bar swaps places', () => {
  assert.deepEqual(withChoice(DEFAULT_BAR, 2, 'debts'), ['home', 'accounts', 'debts']);
  assert.deepEqual(withChoice(DEFAULT_BAR, 0, 'report'), ['report', 'accounts', 'home']);
  assert.deepEqual(withChoice(DEFAULT_BAR, 1, 'accounts'), ['home', 'accounts', 'report']);
});

test('dragging reorders, and the app opens on the first button', () => {
  const bar = movedBar(['home', 'debts', 'plans'], 1, 0);
  assert.deepEqual(bar, ['debts', 'home', 'plans']);
  assert.equal(startRoute(bar), '/debts');
  assert.deepEqual(leftTheBar(bar), ['accounts', 'report']);
});

test('an address lights its own button, the closest one, or Más', () => {
  assert.equal(buttonFor(DEFAULT_BAR, '/debts/3'), 'accounts');
  assert.equal(buttonFor(['debts', 'accounts', 'report'], '/debts/3'), 'debts');
  assert.equal(buttonFor(['accounts', 'debts', 'report'], '/debts'), 'debts');
  assert.equal(buttonFor(['accounts', 'yields', 'report'], '/products?account=2'), 'yields');
  assert.equal(buttonFor(DEFAULT_BAR, '/movements?x=1'), 'home');
  assert.equal(buttonFor(DEFAULT_BAR, '/plans/goal/1'), 'more');
  assert.equal(buttonFor(DEFAULT_BAR, '/view/bar'), 'more');
});

test('every screen has its words in both languages', () => {
  for (const s of BAR_SCREENS) for (const dict of [es, en]) {
    assert.ok(dict[s.label], `${s.id} label`);
    assert.ok(dict[s.about], `${s.id} about`);
  }
});
