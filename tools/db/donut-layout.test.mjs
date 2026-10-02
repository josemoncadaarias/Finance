// The spending donut's colours and geometry (mockups 16i-16m; Jose,
// 2026-10-02). Pure functions, no browser.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/donut-layout.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHART_DARK, MAX_NAMED, SPOT_COUNT, chartColours, crossingsOf, layoutDonut, placeIcons,
} from '../../src/app/features/movements/donut-layout.ts';

test('a category keeps the chart colour nearest its own, the largest choosing first', () => {
  const picked = chartColours([{ own: '#ff9152' }, { own: '#4cb8f5' }]);
  assert.equal(CHART_DARK[picked[0]], '#d95926', 'orange stays orange');
  assert.equal(CHART_DARK[picked[1]], '#3987e5', 'sky blue becomes the blue');
});

test('no two slices share a colour: a taken one, no colour or a picture take the first free', () => {
  const picked = chartColours([{ own: '#ff9152' }, { own: '#ff6b6b' }, { own: null }, { own: null }, { own: '#ff9152' }]);
  assert.equal(new Set(picked).size, picked.length);
  assert.equal(picked[2], 0, 'the first free is the first of the palette');
});

test('eight colours at most: that is how many categories get one', () => {
  assert.equal(MAX_NAMED, 8);
  const picked = chartColours(Array.from({ length: 8 }, () => ({ own: '#3987e5' })));
  assert.deepEqual([...picked].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('icons go to distinct places, in the ring\'s order, spread round all of them', () => {
  for (let n = 1; n <= 9; n++) {
    const mids = Array.from({ length: n }, (_, i) => (i + 0.5) * 360 / n);
    const spots = placeIcons(mids);
    assert.equal(new Set(spots.map(s => `${s.x},${s.y}`)).size, n);
    // Clockwise order kept: the angles, once turned to start at the first, rise.
    const turned = spots.map(s => (s.angle - spots[0].angle + 360) % 360);
    assert.deepEqual([...turned].sort((a, b) => a - b), turned, `order for ${n}`);
  }
  assert.equal(SPOT_COUNT, 12);
  assert.throws(() => placeIcons(Array.from({ length: 13 }, (_, i) => i * 27)));
});

test('the largest slice alone on one side no longer takes the whole side', () => {
  // Jose's month: 48, 21, 10, 9, 7 and the rest 4.
  const { spots } = layoutDonut([48, 21, 10, 9, 7, 4]);
  const xs = spots.map(s => s.x);
  assert.ok(xs.some(x => x > 250) && xs.some(x => x < 100), 'both sides used');
});

test('every line is drawn in right angles', () => {
  const { lines } = layoutDonut([33, 20, 7, 6, 6, 6, 6, 5, 11]);
  for (const d of lines) {
    // Only the straight legs: "M x y" and "L x y" points; corners are short curves between them.
    const legs = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    const corners = [...d.matchAll(/Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g)].map(m => [Number(m[3]), Number(m[4])]);
    // Each leg starts where the last corner ended (or at M) and ends at the next L: straight along x or y.
    const starts = [legs[0], ...corners];
    const ends = legs.slice(1);
    ends.forEach((end, i) => {
      const start = starts[i];
      assert.ok(Math.abs(start[0] - end[0]) < 0.2 || Math.abs(start[1] - end[1]) < 0.2, `leg ${i} of ${d}`);
    });
  }
});

test('one category alone is the whole ring', () => {
  const { arcs, spots } = layoutDonut([1]);
  assert.equal(arcs[0].a1, 360);
  assert.equal(spots.length, 1);
});

test('no line crosses another or the ring, even with small slices bunched beside a big one', () => {
  // The last two are Jose's 2026 on his card (a big "rest" after six small
  // ones crossed two lines when the icons were only spread evenly) and a
  // worse case of the same shape.
  const cases = [[46, 23, 11, 10, 7, 4], [48, 21, 10, 9, 7, 4], [90, 5, 5], [30, 20, 10, 8, 7, 6, 5, 14],
    Array(8).fill(12.5), [26, 21, 6, 5, 5, 4, 4, 29], [60, 3, 3, 3, 3, 3, 3, 22]];
  for (const shares of cases) {
    const { arcs, spots } = layoutDonut(shares);
    assert.equal(crossingsOf(arcs.map(arc => arc.mid), spots), 0, shares.join(', '));
  }
});
