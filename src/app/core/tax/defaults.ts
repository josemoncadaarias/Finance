/**
 * What a new simulation starts with.
 *
 * Two kinds of figure, treated differently.
 *
 * **The person's own figures start at zero.** A salary, a withholding, a
 * health policy: there is no sensible guess, and a plausible-looking default
 * is worse than an empty one because it gets left in.
 *
 * **The law's figures start filled in**, from the spreadsheet Jose built and
 * checked against his filed return, each with the article it comes from. They
 * are still inputs - every one is editable on the screen - because they change
 * by law and some are published months after the year they govern.
 *
 * The UVT is filled in only for a year whose resolution is on record. For any
 * other year it is zero, and the screen asks for it: a UVT carried over from
 * another year would be wrong in every single line below it, silently.
 */

import type { TaxInputs } from './types';

/**
 * UVT by tax year, in minor units, each with its source.
 *
 * Only what has a citation goes here. 2026: Resolución DIAN 000238 del 15 de
 * diciembre de 2025, $52.374 - the same figure the withholding module already
 * uses, confirmed then.
 */
export const UVT_BY_YEAR: Readonly<Record<number, number>> = {
  2026: 5_237_400,
};

export function defaultInputs(year: number): TaxInputs {
  return {
    year,
    uvtMinor: UVT_BY_YEAR[year] ?? 0,
    // Not on record for any year yet. Zero keeps the floor, the ceiling and
    // the solidarity steps switched off rather than invented.
    minimumWageMinor: 0,

    employment: 'ordinary',
    dependents: 0,

    monthlySalaryMinor: 0,
    monthsWorked: 12,
    otherLabourIncomeMinor: 0,

    // What the spreadsheet used: 1%, applied as typed while there is no
    // minimum wage to work the steps out from.
    solidarityScaled: 10_000,

    capitalIncomeMinor: 0,
    capitalCostsMinor: 0,
    otherIncomeMinor: 0,
    otherCostsMinor: 0,

    financialYieldMinor: 0,
    // Published the year after the tax year it applies to, so it starts empty.
    inflationaryScaled: 0,

    voluntaryPayrollMinor: 0,
    voluntaryOwnMinor: 0,
    housingInterestMinor: 0,
    healthPolicyMinor: 0,
    otherDeductionsMinor: 0,

    labourExemptScaled: 250_000,   // 25%, E.T. art. 206 num. 10
    labourExemptCapUvt: 790,       // tope anual, Ley 2277 de 2022
    dependentMonthlyCapUvt: 32,    // 10% con tope de 32 UVT al mes, art. 387
    healthPolicyCapUvt: 16,        // 16 UVT al mes, art. 387
    globalCapScaled: 400_000,      // 40%, art. 336 num. 3
    globalCapUvt: 1340,            // art. 336 num. 3
    dependentUvt: 72,              // por dependiente, art. 336 num. 3 lit. b
    eInvoicePurchasesMinor: 0,
    eInvoiceCapUvt: 240,           // 1% con tope de 240 UVT, art. 336 num. 5

    occasionalTaxMinor: 0,

    monthlyWithholdingMinor: Array.from({ length: 12 }, () => 0),
    extraWithholdingMinor: [0, 0, 0, 0],
    extraWithholdingLabels: ['', '', '', ''],
    creditFromLastYearMinor: 0,
    advancePaidMinor: 0,

    voluntaryCapUvt: 3800,              // art. 126-1
    voluntaryIncomeShareScaled: 300_000, // 30% de los ingresos, art. 126-1
  };
}

/**
 * A stored simulation, with anything added to the form since it was saved.
 *
 * The form will grow - a new line, a new cap - and a simulation saved before
 * that must still open. So what is stored lays over the defaults rather than
 * replacing them, and the fixed-length lists are padded back to their length.
 */
export function withDefaults(year: number, stored: Partial<TaxInputs>): TaxInputs {
  const base = defaultInputs(year);
  const merged: TaxInputs = { ...base, ...stored, year };

  const pad = (list: readonly number[] | undefined, length: number) =>
    Array.from({ length }, (_, at) => list?.[at] ?? 0);

  return {
    ...merged,
    monthlyWithholdingMinor: pad(stored.monthlyWithholdingMinor, 12),
    extraWithholdingMinor: pad(stored.extraWithholdingMinor, 4),
    extraWithholdingLabels: Array.from({ length: 4 }, (_, at) =>
      stored.extraWithholdingLabels?.[at] ?? ''),
  };
}
