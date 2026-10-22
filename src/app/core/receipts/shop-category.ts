/**
 * Which of the person's own categories a receipt's shop belongs to (Jose,
 * 2026-10-22: "trata de leer el nombre del comercio y asócialo a alguna
 * categoría que haga match con las que tenga el usuario").
 *
 * A receipt prints the shop with its branch ("SUPERMERCADO X SEDE NORTE"),
 * while the app learned it from a bank message or a note ("SUPERMERCADO X"),
 * so an exact key is rare. In order, all of it the person's own data:
 * 1. the shop exactly as learned - its category, account and note;
 * 2. a category named after the shop's first word ("Éxito");
 * 3. a shop learned with the same first word, or two words in common - the
 *    same chain at another branch;
 * 4. a category whose name is one of the shop's words ("Restaurante El
 *    Fogón" and a category "Restaurantes");
 * 5. what the person filed notes with the shop's first word under, twice or
 *    more.
 * None of it names a shop or a chain. Pure, tested in
 * `shop-category.test.mjs`; the caller falls back to the ordinary words of
 * `common-words.ts`.
 */

import { merchantKeyOf } from '../proposals/merchant';

export interface KnownShop {
  merchant: string;
  categoryId: number;
  accountId: number | null;
  note: string | null;
  times: number;
}

export interface NamedCategory {
  id: number;
  name: string;
}

export interface PastNote {
  text: string;
  categoryId: number;
}

export interface ShopMatch {
  categoryId: number;
  accountId: number | null;
  note: string | null;
  how: 'same' | 'chain' | 'name' | 'notes';
}

/** A word folded as the merchant key folds it, its plural taken off. */
function stem(word: string): string {
  const one = word.length > 3 && word.endsWith('S') ? word.slice(0, -1) : word;
  return one.length > 4 && one.endsWith('E') ? one.slice(0, -1) : one;
}

function wordsOf(text: string): string[] {
  return merchantKeyOf(text).split(' ').filter(w => w.length >= 3);
}

/** The word of the shop that says most: its first one of four letters or more. */
export function leadingWord(shop: string): string | null {
  return wordsOf(shop).find(w => w.length >= 4) ?? null;
}

export function shopMatch(
  shop: string | null,
  known: readonly KnownShop[],
  categories: readonly NamedCategory[],
  notes: readonly PastNote[],
): ShopMatch | null {
  if (!shop) return null;
  const key = merchantKeyOf(shop);
  const words = wordsOf(shop);
  if (key.length === 0 || words.length === 0) return null;

  const same = known.find(k => k.merchant === key);
  if (same) return { categoryId: same.categoryId, accountId: same.accountId, note: same.note, how: 'same' };

  // A category the person named after the shop itself ("Éxito" for "ÉXITO
  // SEDE NORTE") says more than another branch filed elsewhere.
  const first = words[0].length >= 4 ? stem(words[0]) : null;
  const own = first ? categories.find(c => {
    const theirs = wordsOf(c.name);
    return theirs.length > 0 && stem(theirs[0]) === first;
  }) : undefined;
  if (own) return { categoryId: own.id, accountId: null, note: null, how: 'name' };

  // The same chain: the first word in common, or two words.
  const stems = new Set(words.map(stem));
  let chain: { k: KnownShop; score: number } | null = null;
  for (const k of known) {
    const theirs = k.merchant.split(' ').filter(w => w.length >= 3);
    if (theirs.length === 0) continue;
    const shared = theirs.filter(w => stems.has(stem(w))).length;
    const firstToo = stem(theirs[0]) === stem(words[0]) && theirs[0].length >= 4;
    if (!firstToo && shared < 2) continue;
    const score = shared + (firstToo ? 2 : 0);
    if (!chain || score > chain.score || (score === chain.score && k.times > chain.k.times)) chain = { k, score };
  }
  if (chain) return { categoryId: chain.k.categoryId, accountId: chain.k.accountId, note: chain.k.note, how: 'chain' };

  // A category named by one of the shop's words.
  for (const word of words) {
    if (word.length < 4) continue;
    const found = categories.find(c => wordsOf(c.name).some(w => w.length >= 4 && stem(w) === stem(word)));
    if (found) return { categoryId: found.id, accountId: null, note: null, how: 'name' };
  }

  // What the person filed notes naming the shop under.
  const lead = leadingWord(shop);
  if (lead) {
    const counts = new Map<number, number>();
    for (const n of notes) {
      if (wordsOf(n.text).some(w => stem(w) === stem(lead))) counts.set(n.categoryId, (counts.get(n.categoryId) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) return { categoryId: top[0], accountId: null, note: null, how: 'notes' };
  }
  return null;
}
