/**
 * What a simulation starts with, and where every figure in it came from.
 *
 * Jose's rule for this module: never leave a figure at zero when a reasonable
 * one exists. A zero UVT makes every cap zero; a zero minimum wage switches off
 * the floor, the ceiling and the solidarity steps; a zero inflationary
 * component hides part of the yields. Each of those produces an answer that
 * looks precise and is simply wrong. A figure borrowed from last year, or
 * estimated from this year's data so far, is closer to the truth than any of
 * them - so long as the screen says which it is.
 *
 * So every parameter here comes with its standing:
 *
 * - `official` - published for this very year, with the norm that published it;
 * - `reference` - the latest year that has one, borrowed until this year's is out;
 * - `estimate` - worked out from data available today, with the data and its date.
 *
 * None of these is fetched at runtime. They are figures looked up by hand,
 * each with its source, and written here - the project rule is that exact
 * figures come from deterministic sources and never from a guess, and a figure
 * with a citation beside it is the most deterministic source there is.
 */

import type { TaxInputs } from './types';

export type Standing = 'official' | 'reference' | 'estimate';

/** A parameter's value for a year, and how much to trust it. */
export interface Sourced {
  value: number;
  standing: Standing;
  /** The year the figure belongs to, which differs from the one asked for when borrowed. */
  fromYear: number;
  source: string;
}

/**
 * The UVT, in minor units.
 *
 * 2026: Resolución DIAN 000238 del 15 de diciembre de 2025, $52.374 - the same
 * figure the withholding module uses.
 */
const UVT: Readonly<Record<number, { minor: number; source: string }>> = {
  2026: { minor: 5_237_400, source: 'Resolución DIAN 000238 de 2025' },
};

/**
 * The monthly minimum wage, in minor units, WITHOUT the transport allowance.
 *
 * The allowance is not salary - it compensates the commute - so it is not part
 * of any contribution base, and the floor and ceiling on a base are measured in
 * minimum wages without it. For 2026 the wage is $1.750.905 and the allowance
 * $249.095 on top, $2.000.000 together; only the first belongs here.
 *
 * 2026: Decreto 1469 del 29 de diciembre de 2025 (allowance: Decreto 1470).
 * 2025: $1.423.500, the figure the 2026 increase of 23% is measured from. Its
 * own decree number is not written here because it was not checked, and a
 * citation nobody verified is worse than none.
 */
const MINIMUM_WAGE: Readonly<Record<number, { minor: number; source: string }>> = {
  2025: { minor: 142_350_000, source: 'Salario mínimo 2025 (base del aumento de 2026)' },
  2026: { minor: 175_090_500, source: 'Decreto 1469 de 2025' },
};

/**
 * The inflationary component of financial yields, as published.
 *
 * E.T. art. 40-1: the year's inflation certified by the DANE divided by the
 * most representative deposit rate certified by the Superintendencia
 * Financiera. 2025: 5,10% / 9,20% = 55,43%, Decreto 898 del 29 de julio de
 * 2026. It is published the year AFTER the tax year it applies to.
 */
const INFLATIONARY_OFFICIAL: Readonly<Record<number, { scaled: number; source: string }>> = {
  2025: { scaled: 554_300, source: 'Decreto 898 de 2026 (5,10% ÷ 9,20%)' },
};

/**
 * The same division, done now with what has been published so far this year.
 *
 * 2026, as of 11 September: inflation over the last twelve months 6,24%
 * (DANE, August 2026), over the DTF of the week of 7 to 13 September 10,05%
 * (Banco de la República). The certified figures come after the year closes,
 * so this is a projection of where they will land, not a reading of them.
 *
 * The DTF is replaced by the IBR in January 2027, so the estimate for 2027
 * will need a different rate on the bottom of the division.
 */
const INFLATIONARY_ESTIMATE: Readonly<Record<number, {
  inflationPct: number; ratePct: number; asOf: string; source: string;
}>> = {
  2026: {
    inflationPct: 6.24,
    ratePct: 10.05,
    asOf: '2026-09-11',
    source: 'IPC 12 meses 6,24% (DANE, agosto 2026) ÷ DTF 10,05% (BanRep, 7 al 13 sep 2026)',
  },
};

/** The latest year at or before `year` that has an entry, if any. */
function latestAtOrBefore<T>(table: Readonly<Record<number, T>>, year: number): [number, T] | null {
  const years = Object.keys(table).map(Number).filter(known => known <= year).sort((a, b) => b - a);
  const found = years[0];
  return found === undefined ? null : [found, table[found]];
}

/** The earliest year that has an entry, for a year before any of them. */
function earliest<T>(table: Readonly<Record<number, T>>): [number, T] {
  const found = Object.keys(table).map(Number).sort((a, b) => a - b)[0];
  return [found, table[found]];
}

export function uvtFor(year: number): Sourced {
  const [fromYear, entry] = latestAtOrBefore(UVT, year) ?? earliest(UVT);
  return {
    value: entry.minor,
    standing: fromYear === year ? 'official' : 'reference',
    fromYear,
    source: entry.source,
  };
}

export function minimumWageFor(year: number): Sourced {
  const [fromYear, entry] = latestAtOrBefore(MINIMUM_WAGE, year) ?? earliest(MINIMUM_WAGE);
  return {
    value: entry.minor,
    standing: fromYear === year ? 'official' : 'reference',
    fromYear,
    source: entry.source,
  };
}

/**
 * The inflationary component to start a year's simulation with.
 *
 * In order of preference:
 *
 * 1. The official figure for that year, once it is published.
 * 2. Past the first half of the year - Jose's line, six months - an estimate
 *    from this year's own data, because by then the year has said enough about
 *    itself to beat last year's figure.
 * 3. Otherwise last year's official figure, as a reference.
 *
 * `today` is a parameter so the rule can be tested at any point in a year.
 */
export function inflationaryFor(year: number, today: Date = new Date()): Sourced {
  const official = INFLATIONARY_OFFICIAL[year];
  if (official) {
    return { value: official.scaled, standing: 'official', fromYear: year, source: official.source };
  }

  const pastHalf = today.getFullYear() > year
    || (today.getFullYear() === year && today.getMonth() >= 6);
  const estimate = INFLATIONARY_ESTIMATE[year];
  if (pastHalf && estimate) {
    return {
      value: Math.round((estimate.inflationPct / estimate.ratePct) * 1_000_000),
      standing: 'estimate',
      fromYear: year,
      source: estimate.source,
    };
  }

  const borrowed = latestAtOrBefore(INFLATIONARY_OFFICIAL, year - 1) ?? earliest(INFLATIONARY_OFFICIAL);
  return {
    value: borrowed[1].scaled,
    standing: 'reference',
    fromYear: borrowed[0],
    source: borrowed[1].source,
  };
}

/** The three parameters that change by year, with their standing, for the screen to explain. */
export function parametersFor(year: number, today: Date = new Date()): {
  uvt: Sourced; minimumWage: Sourced; inflationary: Sourced;
} {
  return {
    uvt: uvtFor(year),
    minimumWage: minimumWageFor(year),
    inflationary: inflationaryFor(year, today),
  };
}

export function defaultInputs(year: number, today: Date = new Date()): TaxInputs {
  const parameters = parametersFor(year, today);

  return {
    year,
    uvtMinor: parameters.uvt.value,
    minimumWageMinor: parameters.minimumWage.value,

    employment: 'ordinary',
    dependents: 0,

    monthlySalaryMinor: 0,
    monthsWorked: 12,
    otherLabourIncomeMinor: 0,

    // Only used while there is no minimum wage to work the steps out from,
    // which with the table above is never. Kept at the spreadsheet's 1%.
    solidarityScaled: 10_000,

    capitalIncomeMinor: 0,
    capitalCostsMinor: 0,
    otherIncomeMinor: 0,
    otherCostsMinor: 0,

    financialYieldMinor: 0,
    inflationaryScaled: parameters.inflationary.value,

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
 * Jose's own figures for 2026, from `Simulador_Tributario_2026.xlsx`.
 *
 * His estimate of the year, cell by cell, so the simulation opens as the
 * spreadsheet he has been maintaining rather than as an empty form. They are
 * his data - salary, dependents, withholding - in the same way the opening
 * balances in the early migrations are, and they are only ever laid into
 * boxes that are still at zero.
 *
 * The employment kind is `integral`: the spreadsheet's 70% contribution base
 * is that rule, and it is the kind that reproduces his figures.
 */
/**
 * The account that identifies Jose's database.
 *
 * His spreadsheet figures belong to him and only ever go into his simulation.
 * The early migrations guard their real balances the same way - by an account
 * only his database has - so a fresh install, or anyone else's, starts from an
 * honest empty form rather than from someone else's salary.
 */
export const SPREADSHEET_2026_OWNER_ACCOUNT = 'Rappi cuenta';

export const SPREADSHEET_2026: Partial<TaxInputs> = {
  employment: 'integral',
  dependents: 2,
  monthlySalaryMinor: 2_276_176_500,
  monthsWorked: 12,
  otherIncomeMinor: 1_000_000_000,
  otherCostsMinor: 500_000_000,
  healthPolicyMinor: 443_770_000,
  monthlyWithholdingMinor: [
    286_100_000, 286_100_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000,
    273_700_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000,
  ],
  extraWithholdingMinor: [35_000_000, 0, 0, 0],
};

/**
 * Lays references into every box still at zero, and nothing else.
 *
 * "Still at zero" is the whole of the care here. A figure the person typed is
 * theirs and is never replaced; a zero that was never touched is a gap. The
 * caller makes this a one-time act per year, so a zero typed on purpose after
 * it ran is left alone too.
 */
export function fillGaps(inputs: TaxInputs, references: Partial<TaxInputs>): TaxInputs {
  const next: Record<string, unknown> = { ...inputs };

  for (const [key, value] of Object.entries(references)) {
    const current = (inputs as unknown as Record<string, unknown>)[key];

    if (Array.isArray(value) && Array.isArray(current)) {
      next[key] = current.map((one, at) => (one === 0 ? (value[at] ?? 0) : one));
    } else if (typeof value === 'number' && current === 0) {
      next[key] = value;
    } else if (typeof value === 'string' && key === 'employment' && current === 'ordinary') {
      // The default kind is a gap too: nobody chose "ordinary", it was simply
      // what the form started on.
      next[key] = value;
    }
  }

  return next as unknown as TaxInputs;
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
