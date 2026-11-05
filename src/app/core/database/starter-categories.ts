/**
 * The categories a brand-new database starts with.
 *
 * Found by Jose on 2026-09-23 and it was a real hole: a fresh install had
 * exactly three categories - Cashback, Corrección del banco and Otro, which
 * migration 037 makes out of the three kinds a product's own movement can be -
 * and not one of them is an expense. Since a movement that is not a transfer
 * MUST carry a category, somebody installing this app could not record the
 * first thing they spent. Jose's own list came from the app he used before,
 * so he never met the empty case.
 *
 * Deliberately not his list. His has Didi, Éxito, EPM, D1 and 4x1000 in it,
 * which are a person in Medellín and not a starting point for anybody else
 * (rule 21: the app is meant for other people too). These are the ordinary
 * ones, and every one of them can be renamed, re-pictured or archived - they
 * are a starting point, not a rule.
 *
 * In the app's own language, unlike the rest of the user's data, because on
 * the first run nobody has typed them: they are the app speaking, and it does
 * that in whichever language it was opened in. From then on they are the
 * person's own words and nothing ever translates them again.
 */

import type { SqlDriver } from './sql-driver';
import type { Language } from '../i18n/translations';
import { foldText } from '../text/fold-text';

export interface StarterCategory {
  kind: 'income' | 'expense';
  es: string;
  en: string;
  icon: string;
  /**
   * What an investment earned or lost (migration 047): the yields summary
   * counts it as a return on an account of type Inversión. Jose, 2026-09-24:
   * without these a new user would have to create and mark one before a fund
   * could show what it earned.
   */
  isReturn?: true;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  // What money goes on, roughly in the order a month spends it.
  { kind: 'expense', es: 'Mercado', en: 'Groceries', icon: 'basket-outline' },
  { kind: 'expense', es: 'Restaurante', en: 'Eating out', icon: 'restaurant-outline' },
  { kind: 'expense', es: 'Transporte', en: 'Transport', icon: 'bus-outline' },
  { kind: 'expense', es: 'Automóvil', en: 'Car', icon: 'car-outline' },
  { kind: 'expense', es: 'Casa', en: 'Home', icon: 'home-outline' },
  { kind: 'expense', es: 'Facturas', en: 'Bills', icon: 'receipt-outline' },
  { kind: 'expense', es: 'Salud', en: 'Health', icon: 'medkit-outline' },
  { kind: 'expense', es: 'Entretenimiento', en: 'Entertainment', icon: 'film-outline' },
  { kind: 'expense', es: 'Ropa', en: 'Clothes', icon: 'shirt-outline' },
  { kind: 'expense', es: 'Cuidado personal', en: 'Personal care', icon: 'cut-outline' },
  { kind: 'expense', es: 'Tecnología', en: 'Technology', icon: 'laptop-outline' },
  { kind: 'expense', es: 'Educación', en: 'Education', icon: 'school-outline' },
  { kind: 'expense', es: 'Viajes', en: 'Travel', icon: 'airplane-outline' },
  { kind: 'expense', es: 'Mascotas', en: 'Pets', icon: 'paw-outline' },
  { kind: 'expense', es: 'Regalos', en: 'Gifts', icon: 'gift-outline' },
  { kind: 'expense', es: 'Pérdida de inversión', en: 'Investment loss', icon: 'trending-down-outline', isReturn: true },
  { kind: 'expense', es: 'Otros gastos', en: 'Other', icon: 'ellipsis-horizontal-circle-outline' },

  // Where it comes from. Cashback, the bank's own correction and "Otro"
  // already exist on a fresh database, so they are not repeated here.
  { kind: 'income', es: 'Salario', en: 'Salary', icon: 'cash-outline' },
  { kind: 'income', es: 'Depósitos', en: 'Deposits', icon: 'arrow-down-circle-outline' },
  { kind: 'income', es: 'Rendimientos', en: 'Interest', icon: 'trending-up-outline' },
  { kind: 'income', es: 'Ganancia de inversión', en: 'Investment gain', icon: 'stats-chart-outline', isReturn: true },
  { kind: 'income', es: 'Ventas', en: 'Sales', icon: 'pricetags-outline' },
];

/**
 * Fills an empty database with them, and does nothing to any other.
 *
 * "Empty" is measured as "no expense category at all", which is true of a
 * fresh install and of nothing else: the three that come with the schema are
 * all income, and anybody who has used the app for a day has expenses.
 * Jose's own database has forty-nine, so this looks at it once on every start
 * and leaves it exactly as it is.
 *
 * A name that already exists is skipped rather than failing:
 * `idx_categories_name_kind` would refuse the twin, and a half-seeded
 * database is worse than none.
 */
export async function seedStarterCategories(
  driver: SqlDriver,
  language: Language,
  now: () => string = () => new Date().toISOString(),
): Promise<number> {
  const [{ expenses }] = await driver.query<{ expenses: number }>(
    "SELECT COUNT(*) AS expenses FROM categories WHERE kind = 'expense'",
  );
  if (expenses > 0) return 0;

  const taken = new Set(
    (await driver.query<{ name: string; kind: string }>('SELECT name, kind FROM categories'))
      .map(row => `${row.kind}:${row.name.toLocaleLowerCase()}`),
  );

  const at = now();
  let added = 0;
  let order = 0;
  for (const category of STARTER_CATEGORIES) {
    const name = language === 'en' ? category.en : category.es;
    if (taken.has(`${category.kind}:${name.toLocaleLowerCase()}`)) continue;
    await driver.run(
      `INSERT INTO categories (name, kind, builtin_icon, archived, sort_order,
                               counts_as_return, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      [name, category.kind, category.icon, order++, category.isReturn ? 1 : 0, at, at],
    );
    added++;
  }
  return added;
}

/** The settings key saying how many of the starter list a database was offered. */
export const STARTERS_OFFERED_KEY = 'categories.starters.offered';

/** A name compared without case, accents, spaces or its plural. */
function sameName(name: string): string {
  return foldText(name).replace(/\s+/g, ' ').trim().split(' ')
    .map(word => word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
    .map(word => word.length > 4 && word.endsWith('e') ? word.slice(0, -1) : word)
    .join(' ');
}

/**
 * Every starter category for everybody, not only a new install (Jose,
 * 2026-11-05: "todas las categorías por defecto de una app vacía deben estar
 * disponibles para todo el mundo"). Adds, once, each one the database has no
 * category for on that side - compared without case, accents or plural, and
 * against archived ones too, so "Mercados" keeps "Mercado" out and one the
 * person put away is not brought back. Remembers how many of the list it
 * offered, so a category the person deletes afterwards never returns, and
 * one added to the list later is offered once too.
 */
export async function addMissingStarters(
  driver: SqlDriver,
  language: Language,
  now: () => string = () => new Date().toISOString(),
): Promise<number> {
  const offered = Number((await driver.queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', [STARTERS_OFFERED_KEY]))?.value ?? 0);
  if (offered >= STARTER_CATEGORIES.length) return 0;

  const taken = new Set(
    (await driver.query<{ name: string; kind: string }>('SELECT name, kind FROM categories'))
      .map(row => `${row.kind}:${sameName(row.name)}`),
  );
  let order = ((await driver.queryOne<{ top: number | null }>('SELECT MAX(sort_order) AS top FROM categories'))?.top ?? 0) + 1;
  const at = now();
  let added = 0;
  for (const category of STARTER_CATEGORIES.slice(offered)) {
    const name = language === 'en' ? category.en : category.es;
    const other = language === 'en' ? category.es : category.en;
    if (taken.has(`${category.kind}:${sameName(name)}`) || taken.has(`${category.kind}:${sameName(other)}`)) continue;
    await driver.run(
      `INSERT INTO categories (name, kind, builtin_icon, archived, sort_order,
                               counts_as_return, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
      [name, category.kind, category.icon, order++, category.isReturn ? 1 : 0, at, at],
    );
    taken.add(`${category.kind}:${sameName(name)}`);
    added++;
  }
  await driver.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [STARTERS_OFFERED_KEY, String(STARTER_CATEGORIES.length), at]);
  return added;
}
