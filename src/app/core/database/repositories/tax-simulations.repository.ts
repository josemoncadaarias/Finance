/**
 * One income-tax simulation per tax year.
 *
 * A document rather than a row of columns: the form follows the law, the law
 * changes every year, and a column per box would turn every new line of
 * Formulario 210 into a migration. Money inside it is integer cents all the
 * same.
 */

import type { SqlDriver } from '../sql-driver';
import type { TaxInputs } from '../../tax/types';
import { withDefaults } from '../../tax/defaults';

export class TaxSimulationsRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /**
   * The simulation for a year, or null when none has been started.
   *
   * What is stored lays over the current defaults, so a simulation saved
   * before a line was added to the form still opens with that line in it.
   */
  async get(year: number): Promise<TaxInputs | null> {
    const row = await this.db.queryOne<{ inputs: string }>(
      'SELECT inputs FROM tax_simulations WHERE year = ?', [year]);
    if (!row) return null;

    let stored: Partial<TaxInputs>;
    try {
      stored = JSON.parse(row.inputs) as Partial<TaxInputs>;
    } catch {
      // A document that no longer parses is a simulation that cannot be
      // shown. Starting over from the defaults is better than a blank screen,
      // and nothing is overwritten until the person types.
      return null;
    }
    return withDefaults(year, stored);
  }

  async save(year: number, inputs: TaxInputs): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO tax_simulations (year, inputs, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(year) DO UPDATE SET inputs = excluded.inputs, updated_at = excluded.updated_at`,
      [year, JSON.stringify({ ...inputs, year }), now, now]);
  }

  /** Every year with a simulation, newest first. */
  async years(): Promise<number[]> {
    const rows = await this.db.query<{ year: number }>(
      'SELECT year FROM tax_simulations ORDER BY year DESC');
    return rows.map(row => row.year);
  }
}
