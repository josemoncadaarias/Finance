/**
 * The income-tax simulation: cédula general, Formulario 210.
 *
 * A faithful port of the spreadsheet Jose has been using, line for line, so
 * that every figure it produces can be checked against the one he already
 * trusts. The tests do exactly that: they feed it his own numbers and compare
 * against the values Excel had computed and stored in the file.
 *
 * Three things the spreadsheet could not express, and this does:
 *
 * **What kind of work the income is.** The sheet fixes the contribution base
 * at 70% of the monthly salary and calls that "the general rule for salaried
 * workers". It is not: 70% is the rule for a *salario integral* (Ley 344 de
 * 1996 art. 18). An ordinary salary contributes on the whole of what is
 * constitutive of salary, and someone working by contract contributes on 40%
 * of what they bill — at the full rates, since nobody is paying the other
 * half for them.
 *
 * **The floor and the ceiling on that base.** A contribution base is never
 * below one minimum wage nor above twenty-five, and the solidarity-fund rate
 * rises in steps past sixteen. Both need the minimum wage of the year, which
 * the sheet never asked for.
 *
 * **Which cédula a yield belongs to.** Interest and financial yields are
 * rentas de capital (Casilla 43), not ganancias ocasionales — a ganancia
 * ocasional is a different kind of event entirely: selling an asset held for
 * two years or more, a prize, an inheritance (E.T. arts. 299 and following).
 *
 * Nothing here is confirmed with an accountant. Every rate and cap is an
 * input with a stated default, so a figure that turns out to be wrong is one
 * edit away and never buried in the code.
 */

import type { EmploymentKind, TaxInputs, TaxResult, UvtBand } from './types';

/** Rates and caps are scaled integers: 0.04 is 40_000. Money stays in cents. */
export const RATE_SCALE = 1_000_000;

/** `amount × rate`, rounded to the nearest cent. Never a float in, never out. */
export function applyRate(amountMinor: number, rateScaled: number): number {
  return Math.round((amountMinor * rateScaled) / RATE_SCALE);
}

/**
 * The progressive table of art. 241 E.T., in UVT.
 *
 * `plus` is the tax already accumulated by the bands below this one, which the
 * article states rather than leaving to be re-derived — and stating it is what
 * makes each band checkable against the law on its own.
 */
export const RATE_BANDS: readonly UvtBand[] = [
  { fromUvt: 0, rateScaled: 0, plusUvt: 0 },
  { fromUvt: 1090, rateScaled: 190_000, plusUvt: 0 },
  { fromUvt: 1700, rateScaled: 280_000, plusUvt: 116 },
  { fromUvt: 4100, rateScaled: 330_000, plusUvt: 788 },
  { fromUvt: 8670, rateScaled: 350_000, plusUvt: 2296 },
  { fromUvt: 18970, rateScaled: 370_000, plusUvt: 5901 },
  { fromUvt: 31000, rateScaled: 390_000, plusUvt: 10352 },
];

/**
 * What each kind of work contributes on, and at what rates.
 *
 * The percentages are the employee's own share for the two salaried kinds:
 * an employer pays 8.5% of health and 12% of pension alongside them, and
 * neither of those is the worker's money or the worker's deduction. Someone
 * working by contract pays the whole of both, which is why the figures look
 * so different for the same income.
 */
export const EMPLOYMENT_DEFAULTS: Record<EmploymentKind, {
  baseShareScaled: number;
  healthScaled: number;
  pensionScaled: number;
}> = {
  // The whole of what is constitutive of salary. Ley 100 de 1993 art. 204.
  ordinary: { baseShareScaled: 1_000_000, healthScaled: 40_000, pensionScaled: 40_000 },
  // 70% of the integral salary. Ley 344 de 1996 art. 18.
  integral: { baseShareScaled: 700_000, healthScaled: 40_000, pensionScaled: 40_000 },
  // 40% of what is billed, at the full rates. Ley 1955 de 2019 art. 244.
  independent: { baseShareScaled: 400_000, healthScaled: 125_000, pensionScaled: 160_000 },
};

/**
 * The solidarity-fund rate, which rises in steps with the base.
 *
 * Ley 797 de 2003 art. 8, amending Ley 100 art. 27: nothing below four minimum
 * wages, 1% from four to sixteen, and then a tenth of a point per wage up to
 * 2%. Returns a scaled rate, so 1% is 10_000.
 *
 * With no minimum wage on record the steps cannot be worked out at all, and
 * the honest answer is the rate the user typed rather than a guess: that is
 * what `typedScaled` is for.
 */
export function solidarityRateScaled(
  monthlyBaseMinor: number,
  minimumWageMinor: number,
  typedScaled: number,
): number {
  if (minimumWageMinor <= 0) return typedScaled;

  const wages = monthlyBaseMinor / minimumWageMinor;
  for (const step of SOLIDARITY_STEPS) {
    if (wages < step.belowWages) return step.rateScaled;
  }
  return SOLIDARITY_TOP_RATE_SCALED;
}

/**
 * The monthly contribution base.
 *
 * A share of the income, then held between one minimum wage and twenty-five.
 * Both bounds are skipped when no minimum wage is on record, because a bound
 * invented from nothing is worse than no bound: it would quietly change the
 * figure the user is checking against their payslip.
 */
export function contributionBase(
  monthlyIncomeMinor: number,
  shareScaled: number,
  minimumWageMinor: number,
): number {
  // No income, no contributions. The floor is for a salary below the minimum,
  // not for the absence of one - applied to zero it charged health and pension
  // on money never earned and pushed the renta líquida below zero.
  if (monthlyIncomeMinor <= 0) return 0;
  const share = applyRate(monthlyIncomeMinor, shareScaled);
  if (minimumWageMinor <= 0) return share;
  return Math.min(Math.max(share, minimumWageMinor), minimumWageMinor * CONTRIBUTION_CEILING_WAGES);
}

/*
 * The fixed figures of the law the simulation leans on, named once.
 *
 * The exported spreadsheet writes its formulas from these same constants, so
 * the file and the screen cannot drift apart by one of them being edited and
 * the other not.
 */

/**
 * The solidarity-fund steps, Ley 797 de 2003 art. 8: below each number of
 * minimum wages, the rate that applies. At or above the last, the top rate.
 */
export const SOLIDARITY_STEPS: readonly { belowWages: number; rateScaled: number }[] = [
  { belowWages: 4, rateScaled: 0 },
  { belowWages: 16, rateScaled: 10_000 },
  { belowWages: 17, rateScaled: 12_000 },
  { belowWages: 18, rateScaled: 14_000 },
  { belowWages: 19, rateScaled: 16_000 },
  { belowWages: 20, rateScaled: 18_000 },
];
export const SOLIDARITY_TOP_RATE_SCALED = 20_000;

/** A contribution base never goes above twenty-five minimum wages. */
export const CONTRIBUTION_CEILING_WAGES = 25;

/** The deduction for a dependent: 10% of gross labour income, art. 387 E.T. */
export const DEPENDENT_DEDUCTION_SHARE_SCALED = 100_000;

/** 1% of purchases backed by an electronic invoice, art. 336 num. 5 E.T. */
export const E_INVOICE_SHARE_SCALED = 10_000;

/** Dependents counted for the 72 UVT deduction, art. 336 E.T. */
export const MAX_DEPENDENTS = 4;

/** The tax owed on a base expressed in UVT, by the table of art. 241. */
export function taxInUvt(baseUvt: number): number {
  let owed = 0;
  for (const band of RATE_BANDS) {
    if (baseUvt <= band.fromUvt) break;
    owed = ((baseUvt - band.fromUvt) * band.rateScaled) / RATE_SCALE + band.plusUvt;
  }
  return owed;
}

/**
 * The whole simulation, in the order the form asks for it.
 *
 * Every line of the result is named for what it is rather than for the cell it
 * came from, and carries the box of Formulario 210 it maps to, so the screen
 * can say where each figure ends up without knowing any of this.
 */
export function simulate(input: TaxInputs): TaxResult {
  const uvt = input.uvtMinor;
  const rules = EMPLOYMENT_DEFAULTS[input.employment];

  // ---- 1. Rentas de trabajo ------------------------------------------------

  const grossLabourMinor =
    input.monthlySalaryMinor * input.monthsWorked + input.otherLabourIncomeMinor;

  const monthlyBaseMinor = contributionBase(
    input.monthlySalaryMinor,
    input.baseShareScaled ?? rules.baseShareScaled,
    input.minimumWageMinor,
  );

  const healthScaled = input.healthScaled ?? rules.healthScaled;
  const pensionScaled = input.pensionScaled ?? rules.pensionScaled;
  const fspScaled = solidarityRateScaled(
    monthlyBaseMinor, input.minimumWageMinor, input.solidarityScaled);

  const months = input.monthsWorked;
  const healthMinor = applyRate(monthlyBaseMinor, healthScaled) * months;
  const pensionMinor = applyRate(monthlyBaseMinor, pensionScaled) * months;
  const solidarityMinor = applyRate(monthlyBaseMinor, fspScaled) * months;

  const contributionsMinor = healthMinor + pensionMinor + solidarityMinor;
  const labourNetMinor = grossLabourMinor - contributionsMinor;

  // ---- 2. Rentas de capital (casillas 58 to 61) ----------------------------

  // Casilla 59: the componente inflacionario of the financial yields is not
  // income (E.T. arts. 38-41). The spreadsheet left it as a note to subtract by
  // hand and carried a guess of it as costs of rentas no laborales; on the real
  // return it is its own box, and Jose's 2025 return has it there. Only the
  // financial yields carry it - cashback and rents do not - and it can never
  // exceed the gross income it is part of.
  const capitalNonTaxableMinor = Math.min(
    applyRate(input.financialYieldMinor, input.inflationaryScaled),
    input.capitalIncomeMinor,
  );

  // Casilla 61 is "the positive result" of 58 - 59 - 60, per the DIAN's
  // instructions for the form.
  const capitalNetMinor = Math.max(
    input.capitalIncomeMinor - capitalNonTaxableMinor - input.capitalCostsMinor, 0);

  // ---- 3. Rentas no laborales (casillas 74 to 78) --------------------------

  const otherNetMinor = input.otherIncomeMinor - input.otherCostsMinor;

  const generalNetMinor = labourNetMinor + capitalNetMinor + otherNetMinor;

  // ---- 4. Exempt income and deductions, against the 40% / 1,340 UVT cap ----

  const voluntaryMinor = input.voluntaryPayrollMinor + input.voluntaryOwnMinor;

  const labourExemptMinor = Math.min(
    applyRate(labourNetMinor, input.labourExemptScaled),
    input.labourExemptCapUvt * uvt,
  );
  const dependentDeductionMinor = Math.min(
    applyRate(grossLabourMinor, DEPENDENT_DEDUCTION_SHARE_SCALED),
    input.dependentMonthlyCapUvt * uvt * 12,
  );
  const healthPolicyMinor = Math.min(
    input.healthPolicyMinor, input.healthPolicyCapUvt * uvt * 12);

  const beforeCapMinor = voluntaryMinor + input.housingInterestMinor
    + labourExemptMinor + dependentDeductionMinor + healthPolicyMinor
    + input.otherDeductionsMinor;

  const capMinor = Math.min(
    applyRate(generalNetMinor, input.globalCapScaled),
    input.globalCapUvt * uvt,
  );
  const cappedMinor = Math.min(beforeCapMinor, capMinor);

  // ---- 5. Deductions that do not compete for that cap ----------------------

  const dependentsMinor = Math.min(input.dependents, MAX_DEPENDENTS) * input.dependentUvt * uvt;
  const eInvoiceMinor = Math.min(
    applyRate(input.eInvoicePurchasesMinor, E_INVOICE_SHARE_SCALED),
    input.eInvoiceCapUvt * uvt,
  );

  const deductionsMinor = cappedMinor + dependentsMinor + eInvoiceMinor;

  // ---- The tax itself ------------------------------------------------------

  const taxableMinor = generalNetMinor - deductionsMinor;
  const taxableUvt = uvt === 0 ? 0 : taxableMinor / uvt;
  const taxMinor = Math.round(taxInUvt(taxableUvt) * uvt) + input.occasionalTaxMinor;

  // ---- Withholding and what is left to pay --------------------------------

  const monthlyWithheldMinor = input.monthlyWithholdingMinor.reduce((sum, one) => sum + one, 0);
  const extraWithheldMinor = input.extraWithholdingMinor.reduce((sum, one) => sum + one, 0);
  const withheldMinor = monthlyWithheldMinor + extraWithheldMinor;

  const creditedMinor = withheldMinor + input.creditFromLastYearMinor + input.advancePaidMinor;
  const toPayMinor = Math.max(taxMinor - creditedMinor, 0);
  const inFavourMinor = Math.max(creditedMinor - taxMinor, 0);

  // ---- What it means for the year ahead ------------------------------------

  const grossPerMonthMinor = Math.round(
    (grossLabourMinor + input.capitalIncomeMinor + input.otherIncomeMinor) / 12);
  const netPerMonthMinor = grossPerMonthMinor
    - Math.round(contributionsMinor / 12)
    - Math.round(voluntaryMinor / 12)
    - Math.round(withheldMinor / 12);

  // ---- Room left for a voluntary pension contribution ----------------------

  const usedWithoutVoluntaryMinor = input.housingInterestMinor + labourExemptMinor
    + dependentDeductionMinor + healthPolicyMinor + input.otherDeductionsMinor;
  const roomMinor = Math.max(capMinor - usedWithoutVoluntaryMinor, 0);
  const voluntaryCeilingMinor = Math.min(
    input.voluntaryCapUvt * uvt,
    applyRate(grossLabourMinor + input.capitalIncomeMinor + input.otherIncomeMinor,
              input.voluntaryIncomeShareScaled),
  );
  const voluntaryOptimalMinor = Math.min(roomMinor, voluntaryCeilingMinor);

  return {
    grossLabourMinor,
    monthlyBaseMinor,
    solidarityRateScaled: fspScaled,
    healthMinor,
    pensionMinor,
    solidarityMinor,
    contributionsMinor,
    labourNetMinor,
    capitalNetMinor,
    otherNetMinor,
    capitalNonTaxableMinor,
    generalNetMinor,
    voluntaryMinor,
    labourExemptMinor,
    dependentDeductionMinor,
    healthPolicyMinor,
    beforeCapMinor,
    capMinor,
    cappedMinor,
    dependentsMinor,
    eInvoiceMinor,
    deductionsMinor,
    taxableMinor,
    taxableUvt,
    taxMinor,
    monthlyWithheldMinor,
    extraWithheldMinor,
    withheldMinor,
    creditedMinor,
    toPayMinor,
    inFavourMinor,
    savePerMonthMinor: Math.round(toPayMinor / 12),
    contributionsPerMonthMinor: Math.round(contributionsMinor / 12),
    voluntaryPerMonthMinor: Math.round(voluntaryMinor / 12),
    withheldPerMonthMinor: Math.round(withheldMinor / 12),
    voluntaryMissingPerMonthMinor: Math.round(Math.max(voluntaryOptimalMinor - voluntaryMinor, 0) / 12),
    grossPerMonthMinor,
    netPerMonthMinor,
    roomMinor,
    voluntaryCeilingMinor,
    voluntaryOptimalMinor,
    voluntaryMissingMinor: Math.max(voluntaryOptimalMinor - voluntaryMinor, 0),
  };
}
