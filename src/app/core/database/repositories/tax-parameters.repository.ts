/**
 * The dated figures a tax rule is made of.
 *
 * This table starts empty and stays empty until someone enters a figure and
 * marks it confirmed with a source. That is deliberate: the UVT, the daily
 * threshold in UVT and the withholding percentage come from the Estatuto
 * Tributario and the DIAN resolution of the year, they change, and CLAUDE.md
 * forbids taking exact figures from an LLM. A wrong figure here is a wrong tax
 * return.
 *
 * So `withholdingRule` returns null until every part of the rule is present
 * and confirmed. The accrual then runs without withholding and flags each day
 * it could not decide, rather than quietly reporting a net that is too high.
 */

import type { SqlDriver } from '../sql-driver';
import type { IsoDate } from '../types';
import type { WithholdingRule } from '../../yields/yield-math';

/** The keys the app knows about. Anything else is ignored by the rule below. */
export const TAX_KEYS = {
  /** The UVT in pesos, in minor units. */
  uvtValue: 'uvt_value_minor',
  /** Daily yield, in UVT, above which withholding starts. */
  threshold: 'yield_withholding_threshold_uvt',
  /** A fraction scaled by a million, like the rates. */
  percent: 'yield_withholding_percent',
  /** `all` or `excess`: what the percentage applies to. */
  base: 'yield_withholding_base',
} as const;

export interface TaxParameter {
  id: number;
  key: string;
  valid_from: IsoDate;
  value: string;
  source: string | null;
  confirmed: 0 | 1;
  note: string | null;
}

const COLUMNS = 'id, key, valid_from, value, source, confirmed, note';

export class TaxParametersRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  /** Every value a parameter has had, oldest first. */
  async history(key: string): Promise<TaxParameter[]> {
    return this.db.query<TaxParameter>(
      `SELECT ${COLUMNS} FROM tax_parameters WHERE key = ? ORDER BY valid_from`, [key]);
  }

  async all(): Promise<TaxParameter[]> {
    return this.db.query<TaxParameter>(
      `SELECT ${COLUMNS} FROM tax_parameters ORDER BY key, valid_from`);
  }

  /**
   * The value in force on a day: the most recent row on or before it.
   *
   * Unconfirmed rows are skipped by default. A figure someone typed to try it
   * out must not silently become the basis of a tax calculation.
   */
  async inForce(key: string, asOf: IsoDate, options: { includeUnconfirmed?: boolean } = {}): Promise<TaxParameter | null> {
    const confirmed = options.includeUnconfirmed ? '' : 'AND confirmed = 1';
    return this.db.queryOne<TaxParameter>(
      `SELECT ${COLUMNS} FROM tax_parameters
       WHERE key = ? AND valid_from <= ? ${confirmed}
       ORDER BY valid_from DESC, id DESC LIMIT 1`,
      [key, asOf]);
  }

  async set(input: {
    key: string;
    valid_from: IsoDate;
    value: string;
    source?: string | null;
    confirmed?: boolean;
    note?: string | null;
  }): Promise<void> {
    const now = this.now();
    await this.db.run(
      `INSERT INTO tax_parameters (key, valid_from, value, source, confirmed, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key, valid_from) DO UPDATE SET
         value      = excluded.value,
         source     = excluded.source,
         confirmed  = excluded.confirmed,
         note       = excluded.note,
         updated_at = excluded.updated_at`,
      [input.key, input.valid_from, input.value, input.source ?? null,
       input.confirmed ? 1 : 0, input.note ?? null, now, now]);
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM tax_parameters WHERE id = ?', [id]);
  }

  /**
   * The whole withholding rule for a day, or null if any part is missing.
   *
   * All or nothing on purpose. Three quarters of a tax rule does not produce
   * three quarters of an answer, it produces a wrong one.
   */
  async withholdingRule(asOf: IsoDate): Promise<WithholdingRule | null> {
    const [uvt, threshold, percent, base] = await Promise.all([
      this.inForce(TAX_KEYS.uvtValue, asOf),
      this.inForce(TAX_KEYS.threshold, asOf),
      this.inForce(TAX_KEYS.percent, asOf),
      this.inForce(TAX_KEYS.base, asOf),
    ]);

    if (!uvt || !threshold || !percent || !base) return null;
    if (base.value !== 'all' && base.value !== 'excess') return null;

    const uvtValueMinor = Number(uvt.value);
    const thresholdUvt = Number(threshold.value);
    const percentScaled = Number(percent.value);
    if (![uvtValueMinor, thresholdUvt, percentScaled].every(Number.isFinite)) return null;

    return { uvtValueMinor, thresholdUvt, percentScaled, base: base.value };
  }

  /** What is still needed before a withholding can be worked out at all. */
  async missingFor(asOf: IsoDate): Promise<string[]> {
    const missing: string[] = [];
    for (const key of Object.values(TAX_KEYS)) {
      if (!(await this.inForce(key, asOf))) missing.push(key);
    }
    return missing;
  }
}
