// The Drive copy never fills the person's Drive: older versions of the
// backup and older copies set aside are deleted past the newest few.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/drive-prune.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { pruneRevisions, setAside } from '../../src/app/core/cloud/drive-backup.ts';

function fakeDrive(answers) {
  const deleted = [];
  globalThis.fetch = async (url, init = {}) => {
    if (init.method === 'DELETE') { deleted.push(String(url)); return new Response('', { status: 204 }); }
    for (const [match, body] of answers) if (String(url).includes(match)) return new Response(JSON.stringify(body), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  return deleted;
}

test('only the newest versions of the backup stay, the current one never goes', async () => {
  const revisions = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, modifiedTime: `2026-10-0${i}T00:00:00Z`.replace('0010', '10') }));
  const deleted = fakeDrive([['/revisions?', { revisions: [...revisions].reverse() }]]);
  await pruneRevisions('t', 'F');
  // 10 versions: the current (r9) and three before it stay.
  assert.deepEqual(deleted.map(url => url.split('/').pop()), ['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
});

test('a few versions are left alone', async () => {
  const deleted = fakeDrive([['/revisions?', { revisions: [{ id: 'a', modifiedTime: '1' }, { id: 'b', modifiedTime: '2' }] }]]);
  await pruneRevisions('t', 'F');
  assert.deepEqual(deleted, []);
});

test('setting a copy aside keeps only the newest three set aside', async () => {
  const deleted = fakeDrive([
    ['/copy?', { name: 'finance-backup-replaced-x.json' }],
    ['name+contains', { files: ['n1', 'n2', 'n3', 'o1', 'o2'].map(id => ({ id })) }],
  ]);
  await setAside('t', { id: 'C', modifiedTime: '2026-10-08T10:00:00Z', size: 1, schemaVersion: 1, rows: 1 });
  assert.deepEqual(deleted.map(url => url.split('/').pop()), ['o1', 'o2']);
});

test('a Drive that refuses never breaks the save', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await pruneRevisions('t', 'F');
});
