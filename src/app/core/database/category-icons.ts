/**
 * An icon for each of Jose's real categories.
 *
 * Monefy draws its donut with the category icons around the ring, and that is
 * most of how it reads at a glance: you recognise the shape before you read the
 * word. The backup carries no icon, so the importer gave every category the
 * same wallet, which made the ring a row of identical placeholders.
 *
 * These are the 25 categories his five years of history actually use, ordered
 * by how often they appear. Anything else falls back to a neutral mark and can
 * be set by hand once the category editor exists.
 */

import type { SqlDriver } from './sql-driver';

export const DEFAULT_CATEGORY_ICON = 'pricetag-outline';

/**
 * Keyed by the category name exactly as Monefy spells it, since that is what
 * the importer matches on.
 */
export const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  'Ahorros': 'trending-up-outline',
  'Taxi': 'car-outline',
  'Restaurante': 'restaurant-outline',
  'Casa': 'home-outline',
  'Facturas': 'receipt-outline',
  'Comida': 'basket-outline',
  'Tecnología y Plataformas digitales': 'laptop-outline',
  'Salud': 'medkit-outline',
  'Depósitos': 'arrow-down-circle-outline',
  'Entretenimiento': 'wine-outline',
  'Regalos': 'gift-outline',
  'Viajes': 'earth-outline',
  'Ropa': 'shirt-outline',
  'Transporte': 'bus-outline',
  'Salario': 'cash-outline',
  'Celulares': 'phone-portrait-outline',
  'Cosméticos y belleza': 'cut-outline',
  'Comunicaciones': 'call-outline',
  'Cine': 'film-outline',
  'Mascotas': 'paw-outline',
  'Vuelos': 'airplane-outline',
  'Videojuegos': 'game-controller-outline',
  'Higiene': 'water-outline',
  'Automóvil': 'car-sport-outline',
  'Deportes': 'football-outline',
};

export function iconForCategory(name: string): string {
  return CATEGORY_ICONS[name] ?? DEFAULT_CATEGORY_ICON;
}

/**
 * Gives every category its icon, on an existing database.
 *
 * Runs at startup beside the account settings, and for the same reason: an
 * icon that only arrives with the next import is an icon Jose does not have.
 * A category whose icon was changed to something outside this table is left
 * alone — that is a choice, not a placeholder.
 */
export async function applyCategoryIcons(driver: SqlDriver): Promise<number> {
  const rows = await driver.query<{ id: number; name: string; builtin_icon: string | null }>(
    'SELECT id, name, builtin_icon FROM categories',
  );

  let updated = 0;
  const placeholders = new Set(['wallet', DEFAULT_CATEGORY_ICON, null]);

  for (const row of rows) {
    const wanted = CATEGORY_ICONS[row.name];
    if (!wanted || row.builtin_icon === wanted) continue;
    if (!placeholders.has(row.builtin_icon as never)) continue;

    await driver.run(
      'UPDATE categories SET builtin_icon = ?, updated_at = ? WHERE id = ?',
      [wanted, new Date().toISOString(), row.id],
    );
    updated += 1;
  }

  return updated;
}
