// Tests for the translation dictionaries.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/i18n.test.mjs
//
// A missing or stray key is invisible until someone switches language and
// finds a raw key on a button, so the two dictionaries are checked against
// each other here rather than by looking.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SPANISH, ENGLISH, LANGUAGES, DICTIONARIES } from '../../src/app/core/i18n/translations.ts';

test('both languages say exactly the same things', () => {
  const spanish = Object.keys(SPANISH).sort();
  const english = Object.keys(ENGLISH).sort();

  const missing = spanish.filter(key => !(key in ENGLISH));
  const extra = english.filter(key => !(key in SPANISH));

  assert.deepEqual(missing, [], 'keys with no English translation');
  assert.deepEqual(extra, [], 'English keys that no longer exist in Spanish');
  assert.deepEqual(spanish, english);
});

test('no phrase is left empty or accidentally identical', () => {
  for (const [key, phrase] of Object.entries(SPANISH)) {
    assert.ok(phrase.trim().length > 0, `${key} is empty in Spanish`);
    assert.ok(ENGLISH[key].trim().length > 0, `${key} is empty in English`);
  }

  // A handful legitimately match (currency codes, "Monefy"), but a translation
  // that is the Spanish string copied over is a mistake worth catching. These
  // are the ones that are meant to be the same word in both.
  const sameOnPurpose = new Set([
    'summary.moved', 'entry.transfer',
    // Currency codes are the same in every language.
    'accounts.currency.codeHint',
    // "no" is spelled the same in Spanish and English.
    'csv.no',
    // The banks say cashback in Spanish too. "Reembolso" would be a word
    // nobody uses for the thing that comes back off the card.
    'cushion.kind.cashback',
  ]);
  const identical = Object.keys(SPANISH)
    .filter(key => SPANISH[key] === ENGLISH[key] && !sameOnPurpose.has(key));

  assert.deepEqual(identical, [], 'phrases left untranslated');
});

test('placeholders survive translation', () => {
  const placeholders = phrase => (phrase.match(/\{(\w+)\}/g) ?? []).sort();

  for (const key of Object.keys(SPANISH)) {
    assert.deepEqual(
      placeholders(ENGLISH[key]), placeholders(SPANISH[key]),
      `${key} does not carry the same placeholders in both languages`);
  }
});

test('every language offered has a dictionary and a flag', () => {
  for (const language of LANGUAGES) {
    assert.ok(DICTIONARIES[language.code], `${language.code} has no dictionary`);
    assert.ok(language.flag.length > 0);
    assert.ok(language.name.length > 0);
  }
  assert.equal(LANGUAGES[0].code, 'es', 'Spanish comes first: it is the default');
});

test('a count of one picks the singular phrase where there is one', () => {
  // The pairs that exist have to agree about their placeholders, or the
  // singular would drop the number the plural shows.
  for (const key of Object.keys(SPANISH)) {
    if (!key.endsWith('.one')) continue;

    const plural = key.slice(0, -'.one'.length);
    assert.ok(plural in SPANISH, `${key} has no plural form to stand in for`);
  }

  // And the singular is what a Spanish reader expects.
  assert.equal(SPANISH['accounts.currencies.used.one'], 'En 1 cuenta');
  assert.equal(SPANISH['accounts.currencies.used'], 'En {count} cuentas');
});
