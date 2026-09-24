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

export interface StarterCategory {
  kind: 'income' | 'expense';
  es: string;
  en: string;
  icon: string;
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
  { kind: 'expense', es: 'Otros gastos', en: 'Other', icon: 'ellipsis-horizontal-circle-outline' },

  // Where it comes from. Cashback, the bank's own correction and "Otro"
  // already exist on a fresh database, so they are not repeated here.
  { kind: 'income', es: 'Salario', en: 'Salary', icon: 'cash-outline' },
  { kind: 'income', es: 'Depósitos', en: 'Deposits', icon: 'arrow-down-circle-outline' },
  { kind: 'income', es: 'Rendimientos', en: 'Interest', icon: 'trending-up-outline' },
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
                               created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?)`,
      [name, category.kind, category.icon, order++, at, at],
    );
    added++;
  }
  return added;
}
