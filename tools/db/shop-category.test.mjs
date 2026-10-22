// A receipt's shop matched to the person's own categories (Jose, 2026-10-22).
// Every shop, category and note here is INVENTED.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/shop-category.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { shopMatch } from '../../src/app/core/receipts/shop-category.ts';

const KNOWN = [
  { merchant: 'MERCADO LAS PALMAS', categoryId: 1, accountId: 7, note: 'Mercado del mes', times: 12 },
  { merchant: 'FARMACIA ROSA', categoryId: 2, accountId: null, note: null, times: 3 },
  { merchant: 'CAFE AURORA', categoryId: 3, accountId: null, note: null, times: 1 },
];
const CATEGORIES = [
  { id: 1, name: 'Mercado' },
  { id: 4, name: 'Restaurantes' },
  { id: 5, name: 'Ropa y calzado' },
];

test('the shop exactly as the app learned it', () => {
  const m = shopMatch('Mercado Las Palmas', KNOWN, CATEGORIES, []);
  assert.deepEqual(m, { categoryId: 1, accountId: 7, note: 'Mercado del mes', how: 'same' });
});

test('the same chain at another branch', () => {
  const m = shopMatch('MERCADO LAS PALMAS SEDE NORTE', KNOWN, CATEGORIES, []);
  assert.equal(m.categoryId, 1);
  assert.equal(shopMatch('Cafe Aurora Calle 80', KNOWN, CATEGORIES, []).how, 'chain');
  assert.equal(shopMatch('Farmacia Rosa Calle 80', KNOWN, CATEGORIES, []).categoryId, 2);
});

test('a category named by one of the shop\'s words, plural or not', () => {
  const m = shopMatch('RESTAURANTE EL FOGON', KNOWN, CATEGORIES, []);
  assert.deepEqual(m, { categoryId: 4, accountId: null, note: null, how: 'name' });
});

test('what the person filed notes naming the shop under', () => {
  const notes = [
    { text: 'Almuerzo Donde Lucho', categoryId: 4 },
    { text: 'donde lucho domingo', categoryId: 4 },
    { text: 'Lucho prestamo', categoryId: 9 },
  ];
  const m = shopMatch('DONDE LUCHO PARRILLA', [], CATEGORIES, notes);
  assert.equal(m.how, 'notes');
  assert.equal(m.categoryId, 4);
});

test('a category named after the shop wins over a branch filed elsewhere', () => {
  const known = [{ merchant: 'ALMACEN SOL CENTRO', categoryId: 6, accountId: 3, note: null, times: 9 }];
  const categories = [{ id: 6, name: 'Casa' }, { id: 7, name: 'Almacén Sol' }];
  assert.equal(shopMatch('ALMACEN SOL SEDE NORTE', known, categories, []).categoryId, 7);
});

test('one note is no habit, and a shop with nothing in common is nobody\'s', () => {
  assert.equal(shopMatch('DONDE LUCHO', [], [], [{ text: 'donde lucho', categoryId: 4 }]), null);
  assert.equal(shopMatch('TALLER OMEGA', KNOWN, CATEGORIES, []), null);
  assert.equal(shopMatch(null, KNOWN, CATEGORIES, []), null);
});
