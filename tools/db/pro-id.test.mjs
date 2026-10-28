// The Finance Pro id (core/paywall/pro-id.ts): the same for one Google account
// however it is written, never the address itself. Invented addresses only.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/pro-id.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { isAnonymous, proIdOf } from '../../src/app/core/paywall/pro-id.ts';

test('one Google account is one id, however it is typed, and the address is not in it', async () => {
  const a = await proIdOf('Ana.Perez@example.com');
  assert.match(a, /^fp-[0-9a-f]{24}$/);
  assert.equal(await proIdOf('  ana.perez@EXAMPLE.com '), a);
  assert.notEqual(await proIdOf('otra.persona@example.com'), a);
  assert.ok(!a.includes('ana'));
  assert.equal(await proIdOf('not an address'), null);
});

test('the store\'s anonymous id is told apart', () => {
  assert.equal(isAnonymous('$RCAnonymousID:abc123'), true);
  assert.equal(isAnonymous(null), true);
  assert.equal(isAnonymous('fp-0123456789abcdef01234567'), false);
});
