/**
 * The arithmetic of a daily yield.
 *
 * Rates are quoted as an effective annual rate (E.A.), which already includes
 * compounding: 12% E.A. does not mean 1% a month, it means that a peso left
 * alone for a year becomes 1.12 pesos. So the daily rate is not the annual one
 * divided by 365 - that would pay too little - but the number that, compounded
 * 365 times, gives the annual one:
 *
 *     daily = (1 + annual) ^ (1/365) - 1
 *
 * 365 and not 366 in a leap year: that is the convention Colombian banks quote
 * E.A. against, and mixing the two would make a leap year pay slightly more
 * than the rate promised.
 *
 * Everything that leaves this file is an integer in minor units. The power has
 * to be worked out in floating point - JavaScript has no decimal type - so it
 * is done in the one form that keeps every digit: `expm1(log1p(x)/365)`
 * computes the daily rate directly instead of computing 1.000317... and then
 * subtracting one, which would throw away four significant digits before the
 * multiplication even starts.
 */

/** E.A. rates are stored as a fraction scaled by a million: 11.45% is 114500. */
export const EA_SCALE = 1_000_000;

/** Days an effective annual rate is spread over. Not 366 in a leap year. */
export const DAYS_IN_YEAR = 365;

/**
 * The daily rate behind an effective annual one, as a plain fraction.
 *
 * Returned as a float on purpose: it is a rate, not money. Nothing rounds
 * until it has been multiplied by a balance.
 */
export function dailyRate(annualRateScaled: number): number {
  if (annualRateScaled <= 0) return 0;
  return Math.expm1(Math.log1p(annualRateScaled / EA_SCALE) / DAYS_IN_YEAR);
}

/**
 * What a balance earns in one day, rounded to the cent.
 *
 * A negative balance earns nothing. An overdrawn account or a credit card does
 * not pay interest to its holder, and a formula that quietly returned a
 * negative yield would subtract from the cushion.
 */
export function dailyYieldMinor(balanceMinor: number, annualRateScaled: number): number {
  if (balanceMinor <= 0) return 0;
  return Math.round(balanceMinor * dailyRate(annualRateScaled));
}

/**
 * The rate that applies to a balance, out of the bands in force.
 *
 * Some accounts pay a different rate depending on how much is in them. A band
 * covers `min_balance_minor` up to but not including `max_balance_minor`, and
 * the rate of the band the balance falls into applies to the whole balance -
 * not tier by tier. That is how the products this app is for actually quote
 * it, and it is the assumption to revisit first if a figure disagrees with a
 * statement.
 */
export interface RateBand {
  annual_rate_scaled: number;
  min_balance_minor: number;
  max_balance_minor: number | null;
}

/**
 * The rate to use for a band whose condition was not met.
 *
 * Missing a condition is not the same as earning nothing. Uala pays 10.5% in a
 * month with 400,000 spent on the card and 5% in a month without, so the
 * answer is a second rate rather than an absent one. A band with no fallback
 * really does pay nothing that month, which is why null is still allowed.
 */
export function rateWhenConditionMissed(fallbackAnnualRateScaled: number | null): number {
  return fallbackAnnualRateScaled ?? 0;
}

// Generic so a caller carrying extra fields on its bands - a condition, a
// note - gets them back rather than a bare RateBand.
export function bandFor<T extends RateBand>(bands: T[], balanceMinor: number): T | null {
  const match = bands.find(band =>
    balanceMinor >= band.min_balance_minor &&
    (band.max_balance_minor === null || balanceMinor < band.max_balance_minor));
  return match ?? null;
}

/**
 * The withholding rule of a day, built from the tax parameters in force.
 *
 * Every field comes from `tax_parameters`, none of it from code. `base` says
 * whether the percentage applies to the whole yield of the day or only to the
 * part above the threshold - the two give very different answers and the
 * Estatuto Tributario is what settles it, so it is configuration too.
 */
export interface WithholdingRule {
  /** The UVT in pesos, in minor units. */
  uvtValueMinor: number;
  /** Daily yield, in UVT, above which withholding starts. */
  thresholdUvt: number;
  /** A fraction scaled by a million, like the rates. */
  percentScaled: number;
  base: 'all' | 'excess';
}

/** What kind of product a pocket is. It decides how its yield is withheld. */
export type ProductKind = 'high_yield' | 'cdt';

/**
 * The withholding rule as it applies to a kind of product.
 *
 * A high-yield savings product withholds only on a day whose interest reaches
 * the threshold (Decreto 1625 art. 1.2.4.2.87, written for savings deposits),
 * so it gets the rule as configured. A CDT has no threshold: the 7% applies to
 * every peso of its yield - stated by Jose on 2026-09-11, still to be confirmed
 * with an accountant. Same rate, same UVT; only the threshold goes.
 *
 * Missing parameters stay missing for both: `null` in, `null` out, so a day
 * is flagged as unknown rather than written with a silent zero.
 */
export function ruleForProduct(kind: ProductKind, rule: WithholdingRule | null): WithholdingRule | null {
  if (rule === null || kind !== 'cdt') return rule;
  return { ...rule, thresholdUvt: 0, base: 'all' };
}

/**
 * The withholding on one day's yield.
 *
 * `null` for the rule means the parameters are missing or unconfirmed, and the
 * answer is not zero but "unknown": the caller flags the day rather than
 * pretending nothing was withheld.
 */
export function withholdingMinor(grossMinor: number, rule: WithholdingRule | null): number | null {
  if (rule === null) return null;
  if (grossMinor <= 0) return 0;

  // "un interes diario de ... 0.055 UVT o mas" - at the threshold it already
  // withholds, so the test is strictly below, not at or below.
  const thresholdMinor = Math.round(rule.thresholdUvt * rule.uvtValueMinor);
  if (grossMinor < thresholdMinor) return 0;

  const taxable = rule.base === 'all' ? grossMinor : grossMinor - thresholdMinor;
  return Math.round(taxable * (rule.percentScaled / EA_SCALE));
}

/** One day of accrual, as it is written to `yield_days`. */
export interface AccruedDay {
  balance_minor: number;
  annual_rate_scaled: number;
  gross_minor: number;
  withholding_minor: number;
  net_minor: number;
  withholding_unknown: boolean;
}

/**
 * One day, end to end: balance and rate in, gross, withholding and net out.
 *
 * The balance passed in is the accrual base, which is the account's ledger
 * balance plus whatever the cushion already holds. The bank paid those yields
 * into the account even though the ledger never recorded them, so the real
 * balance earning interest tomorrow includes them. Leaving them out would
 * quietly under-pay, more so the longer the history runs.
 */
export function accrueDay(
  balanceMinor: number,
  band: RateBand | null,
  rule: WithholdingRule | null,
  withholds: boolean,
): AccruedDay {
  const rate = band?.annual_rate_scaled ?? 0;
  const gross = dailyYieldMinor(balanceMinor, rate);

  if (!withholds) {
    return {
      balance_minor: balanceMinor,
      annual_rate_scaled: rate,
      gross_minor: gross,
      withholding_minor: 0,
      net_minor: gross,
      withholding_unknown: false,
    };
  }

  const withheld = withholdingMinor(gross, rule);
  return {
    balance_minor: balanceMinor,
    annual_rate_scaled: rate,
    gross_minor: gross,
    withholding_minor: withheld ?? 0,
    net_minor: gross - (withheld ?? 0),
    withholding_unknown: withheld === null,
  };
}

/**
 * A rate as a person types it, into the integer the app stores.
 *
 * `10,5` and `10.5` both mean 10.5% E.A., which is 0.105 as a fraction and
 * 105000 in `EA_SCALE`. Done with integer arithmetic rather than by parsing a
 * float and multiplying: the same reason money never touches a float here.
 *
 * A percentage keeps four decimals, which is what a bank ever quotes, and is
 * exactly the room the scale has left after turning a percent into a fraction.
 */
export function parsePercentToScaled(raw: string): number {
  const text = raw.trim().replace(',', '.').replace('%', '').trim();
  if (text.length === 0) throw new Error('A rate is required');
  if (!/^\d*\.?\d*$/.test(text) || text === '.') {
    throw new Error(`Not a rate: ${raw}`);
  }

  const [whole, decimals = ''] = text.split('.');
  if (decimals.length > 4) {
    throw new Error(`A rate keeps at most four decimals: ${raw}`);
  }

  const units = whole.length > 0 ? Number(whole) : 0;
  const fraction = Number(decimals.padEnd(4, '0') || '0');
  return units * 10_000 + fraction;
}

/** `105000` -> `10.5`, for putting a stored rate back into an input. */
export function scaledPercentToString(scaled: number): string {
  const text = (scaled / 10_000).toFixed(4);
  // Trailing zeros are noise in a field someone is about to edit.
  return text.replace(/\.?0+$/, '');
}
