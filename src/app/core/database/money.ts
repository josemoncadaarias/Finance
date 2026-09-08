/**
 * Money and rate arithmetic.
 *
 * The whole app stores amounts as integers in minor units (cents) and rates as
 * integers scaled by 10,000. Nothing here ever puts a monetary value through a
 * float: `parseAmountToMinor` works on the digit strings themselves, because
 * `parseFloat('9421.28') * 100` is 942127.9999999999, and that rounding error
 * is exactly the garbage the Monefy backup is full of.
 *
 * Formatting is the only place a value becomes a decimal, and by then it is on
 * its way to the screen and never comes back.
 */

/** Rates are stored multiplied by this. 4,214.00 is 42,140,000. */
export const RATE_SCALE = 10_000;

/** Both COP and USD keep cents. See docs/02-technical-decisions.md. */
export const DEFAULT_MINOR_UNITS = 2;

export class MoneyError extends Error {}

/**
 * Guards against silently losing precision. Amounts in COP cents get large
 * (66,750,767.94 is 6,675,076,794) but stay far below this ceiling; a value
 * above it means something upstream is wrong.
 */
function assertSafe(value: number, what: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${what} is not a safe integer: ${value}`);
  }
  return value;
}

/**
 * Parses a decimal amount into minor units without floating-point arithmetic.
 *
 * Accepts a plain decimal string with an optional sign: `-50200.09`, `1234`,
 * `+0.5`. Thousands separators and currency symbols are rejected — stripping
 * those is the importer's job, because what counts as a separator depends on
 * the file being read.
 *
 * Extra decimals beyond `minorUnits` are an error rather than a silent
 * truncation: money quietly losing a digit is how ledgers stop reconciling.
 */
export function parseAmountToMinor(raw: string, minorUnits: number = DEFAULT_MINOR_UNITS): number {
  const text = raw.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new MoneyError(`Not a plain decimal amount: ${JSON.stringify(raw)}`);
  }

  const [, sign, whole, fraction = ''] = match;
  if (fraction.length > minorUnits) {
    throw new MoneyError(`${text} has more than ${minorUnits} decimal places`);
  }

  const padded = fraction.padEnd(minorUnits, '0');
  const magnitude = Number(`${whole}${padded}`);
  assertSafe(magnitude, `Amount ${text}`);
  return sign === '-' ? -magnitude : magnitude;
}

/** Turns minor units back into a plain decimal string: 5020009 -> "-50200.09". */
export function minorToDecimalString(minor: number, minorUnits: number = DEFAULT_MINOR_UNITS): string {
  assertSafe(minor, 'Amount');
  const sign = minor < 0 ? '-' : '';
  const digits = Math.abs(minor).toString().padStart(minorUnits + 1, '0');
  const cut = digits.length - minorUnits;
  return minorUnits === 0 ? `${sign}${digits}` : `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/**
 * Formats an amount for display. This is the only place decimals appear.
 * COP is shown with 2 decimals the way Monefy shows it, not rounded to pesos.
 */
export function formatMoney(
  minor: number,
  currencyCode: string,
  options: { locale?: string; minorUnits?: number; withSymbol?: boolean } = {},
): string {
  const { locale = 'es-CO', minorUnits = DEFAULT_MINOR_UNITS, withSymbol = true } = options;
  const value = Number(minorToDecimalString(minor, minorUnits));

  return new Intl.NumberFormat(locale, {
    style: withSymbol ? 'currency' : 'decimal',
    currency: withSymbol ? currencyCode : undefined,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  }).format(value);
}

/** Parses a rate like "4214.00" into its scaled integer form. */
export function parseRateToScaled(raw: string): number {
  const text = raw.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    throw new MoneyError(`Not a plain decimal rate: ${JSON.stringify(raw)}`);
  }

  const [, whole, fraction = ''] = match;
  const digits = String(RATE_SCALE).length - 1;
  if (fraction.length > digits) {
    throw new MoneyError(`${text} has more than ${digits} decimal places`);
  }
  return assertSafe(Number(`${whole}${fraction.padEnd(digits, '0')}`), `Rate ${text}`);
}

/** 42140000 -> 4214. Only for display and for feeding `convert`. */
export function scaledToRate(scaled: number): number {
  return scaled / RATE_SCALE;
}

/**
 * Converts an amount in a foreign currency to its base-currency equivalent.
 *
 * Both inputs are integers, and the single division happens at the end on a
 * value that is about to be rounded anyway, so no error accumulates across
 * repeated conversions. Rounds half away from zero, which keeps a debit and
 * its mirroring credit symmetrical.
 */
export function convertToBaseMinor(amountMinor: number, rateScaled: number): number {
  assertSafe(amountMinor, 'Amount');
  assertSafe(rateScaled, 'Rate');
  if (rateScaled <= 0) {
    throw new MoneyError(`Rate must be positive, got ${rateScaled}`);
  }

  const product = amountMinor * rateScaled;
  assertSafe(product, `Amount ${amountMinor} times rate ${rateScaled}`);

  const magnitude = Math.round(Math.abs(product) / RATE_SCALE);
  return product < 0 ? -magnitude : magnitude;
}

/**
 * Derives the rate a bank actually applied, from a pair of amounts that are
 * both known. This is how the real DolarApp rates come out of the backup:
 * 2,107,000 COP for 500 USD is 4,214.00.
 */
export function deriveRateScaled(baseMinor: number, foreignMinor: number): number {
  if (foreignMinor === 0) {
    throw new MoneyError('Cannot derive a rate from a zero amount');
  }
  const scaled = Math.round((Math.abs(baseMinor) * RATE_SCALE) / Math.abs(foreignMinor));
  if (scaled <= 0) {
    throw new MoneyError(`Derived rate is not positive: ${baseMinor} / ${foreignMinor}`);
  }
  return assertSafe(scaled, 'Derived rate');
}

/** Available credit on a card: the limit less what is owed. */
export function availableCreditMinor(creditLimitMinor: number, balanceMinor: number): number {
  return creditLimitMinor - Math.abs(balanceMinor);
}
