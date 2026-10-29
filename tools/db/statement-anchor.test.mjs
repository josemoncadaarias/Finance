// The opening balance set from a statement that adds up (mockups 43a-43e).
// Figures invented.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/statement-anchor.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { openingFor, squaringFor } from '../../src/app/core/statements/anchor.ts';

const P = pesos => Math.round(pesos * 100);
const base = { balances: 'checked', statementDay: '2026-09-30', closingMinor: P(4_120_300),
  oursAtStatement: P(2_040_300), anchor: null, oursAtAnchor: null };

test('a statement that adds up and differs offers the bank\'s figure (43a)', () => {
  assert.deepEqual(squaringFor(base), { kind: 'match', day: '2026-09-30', theirs: P(4_120_300), ours: P(2_040_300) });
  assert.equal(openingFor(P(500_000), P(2_040_300), P(4_120_300)), P(2_580_000));
});

test('a statement that does not add up offers nothing (43d)', () => {
  for (const balances of ['off', 'unclear', 'unchecked']) {
    assert.equal(squaringFor({ ...base, balances }).kind, 'blocked');
  }
});

test('one that agrees is kept as the anchor, only when it adds up', () => {
  assert.deepEqual(squaringFor({ ...base, oursAtStatement: P(4_120_300) }),
    { kind: 'agrees', day: '2026-09-30', theirs: P(4_120_300) });
  assert.equal(squaringFor({ ...base, balances: 'off', oursAtStatement: P(4_120_300) }), null);
});

test('an older statement read later puts the anchor\'s day back, today does not move (43e)', () => {
  const anchor = { day: '2026-09-30', balanceMinor: P(4_120_300) };
  // August's movements saved: the 30th of September now says 647,850 more.
  const older = { ...base, statementDay: '2026-08-31', closingMinor: P(1_000), oursAtStatement: P(9),
    anchor, oursAtAnchor: P(4_768_150) };
  assert.deepEqual(squaringFor(older), { kind: 'older', day: '2026-09-30', theirs: P(4_120_300), ours: P(4_768_150) });
  assert.equal(openingFor(P(2_580_000), P(4_768_150), P(4_120_300)), P(1_932_150));
  // Even when the older statement itself did not add up: its rows were answered by the person.
  assert.equal(squaringFor({ ...older, balances: 'off' }).kind, 'older');
  // Nothing moved on the anchor's day: nothing to ask.
  assert.equal(squaringFor({ ...older, oursAtAnchor: P(4_120_300) }), null);
});

test('a newer statement is judged on its own, against its own close', () => {
  const anchor = { day: '2026-08-31', balanceMinor: P(1) };
  assert.equal(squaringFor({ ...base, anchor, oursAtAnchor: P(5) }).kind, 'match');
});

test('no closing figure, no day: nothing', () => {
  assert.equal(squaringFor({ ...base, closingMinor: null }), null);
  assert.equal(squaringFor({ ...base, statementDay: null }), null);
});
