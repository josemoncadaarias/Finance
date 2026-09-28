/**
 * The face a product wears on screen: an icon and the id its colour is drawn
 * from (a product has no icon or colour of its own in the schema).
 *
 * The usual product is a wallet, a CDT a lock; any other is drawn from an
 * ordinary word in its name - a pocket for the market, for a trip, for the
 * car - and a cube, a "bolsillo", when the name says nothing. Words of both
 * languages and never brands, for the same reason the app keeps no list of
 * banks (CLAUDE.md, rule 22). Display only.
 */

import type { YieldProduct } from '../database/repositories/yields.repository';
import { foldText as fold } from '../text/fold-text';

const WORDS: [RegExp, string][] = [
  [/mercad|market|grocer|comida|food/, 'basket-outline'],
  [/viaj|travel|trip|vacacion|holiday/, 'airplane-outline'],
  [/carro|auto|car\b|moto|vehicul/, 'car-outline'],
  [/casa|hogar|home|arriend|rent|vivienda/, 'home-outline'],
  [/emergenc|salud|health|medic/, 'medkit-outline'],
  [/educa|estudi|school|colegio|universi/, 'school-outline'],
  [/regalo|gift|navidad|christmas/, 'gift-outline'],
  [/impuest|tax|renta\b|dian/, 'receipt-outline'],
  [/inversi|invest|meta|goal|plan/, 'flag-outline'],
];

export function productIcon(product: Pick<YieldProduct, 'name' | 'kind' | 'is_default'>): string {
  if (product.kind === 'cdt') return 'lock-closed-outline';
  if (product.is_default === 1) return 'wallet-outline';
  const name = fold(product.name);
  for (const [pattern, icon] of WORDS) {
    if (pattern.test(name)) return icon;
  }
  return 'cube-outline';
}

/** The seed a product's palette colour is drawn from: offset from accounts'. */
export function productSeed(product: Pick<YieldProduct, 'id'>): number {
  return product.id * 7 + 3;
}
