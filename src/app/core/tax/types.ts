/**
 * What the income-tax simulation takes in and gives back.
 *
 * Every rate, cap and threshold is an input rather than a constant. The law
 * changes every year and some of these figures are published months after the
 * year they apply to, so a number written into the code is a number that goes
 * quietly wrong — and being visibly out of date is correct where being
 * confidently wrong about a tax figure is not.
 *
 * Money is in minor units, as everywhere else. Rates are scaled integers: 0.04
 * is 40_000, and 12.5% is 125_000.
 */

/**
 * What kind of work the income comes from.
 *
 * It decides what is contributed on and at what rate, and those differ enough
 * that the same gross income produces a very different answer:
 *
 * - `ordinary` — an ordinary salary. Contributions on the whole of what is
 *   constitutive of salary, at the employee's own 4% and 4%.
 * - `integral` — a salario integral (at least 13 minimum wages, CST art. 132).
 *   Contributions on 70% of it, Ley 344 de 1996 art. 18.
 * - `independent` — working by contract. Contributions on 40% of what is
 *   billed, Ley 1955 de 2019 art. 244, and at the full 12.5% and 16%, since
 *   there is no employer paying the other share.
 */
export type EmploymentKind = 'ordinary' | 'integral' | 'independent';

/** One step of the progressive table of art. 241 E.T. */
export interface UvtBand {
  fromUvt: number;
  rateScaled: number;
  /** Tax accumulated by the bands below, as the article states it. */
  plusUvt: number;
}

export interface TaxInputs {
  year: number;
  /** The UVT of the tax year, in minor units. A DIAN resolution each December. */
  uvtMinor: number;
  /**
   * The monthly minimum wage of the year, in minor units.
   *
   * Used for the floor and ceiling on the contribution base and for the steps
   * of the solidarity fund. Zero means "not on record", and then none of those
   * is applied — a bound invented from nothing would quietly change a figure
   * the user is checking against a payslip.
   */
  minimumWageMinor: number;

  employment: EmploymentKind;
  dependents: number;

  monthlySalaryMinor: number;
  monthsWorked: number;
  otherLabourIncomeMinor: number;

  /** Overrides for what this kind of work contributes on, and at what rates. */
  baseShareScaled?: number;
  healthScaled?: number;
  pensionScaled?: number;
  /** Used only when there is no minimum wage to work the steps out from. */
  solidarityScaled: number;

  capitalIncomeMinor: number;
  capitalCostsMinor: number;
  otherIncomeMinor: number;
  otherCostsMinor: number;

  /** Informative: the part of a yield that is inflation (E.T. arts. 38-41). */
  financialYieldMinor: number;
  inflationaryScaled: number;

  voluntaryPayrollMinor: number;
  voluntaryOwnMinor: number;
  housingInterestMinor: number;
  healthPolicyMinor: number;
  otherDeductionsMinor: number;

  labourExemptScaled: number;
  labourExemptCapUvt: number;
  dependentMonthlyCapUvt: number;
  healthPolicyCapUvt: number;
  globalCapScaled: number;
  globalCapUvt: number;
  dependentUvt: number;
  eInvoicePurchasesMinor: number;
  eInvoiceCapUvt: number;

  occasionalTaxMinor: number;

  /** Twelve figures, one per month. */
  monthlyWithholdingMinor: readonly number[];
  extraWithholdingMinor: readonly number[];
  /** What each extra withholding was for. Words for the person; ignored by the arithmetic. */
  extraWithholdingLabels?: readonly string[];
  creditFromLastYearMinor: number;
  advancePaidMinor: number;

  voluntaryCapUvt: number;
  voluntaryIncomeShareScaled: number;
}

export interface TaxResult {
  grossLabourMinor: number;
  monthlyBaseMinor: number;
  solidarityRateScaled: number;
  healthMinor: number;
  pensionMinor: number;
  solidarityMinor: number;
  contributionsMinor: number;
  labourNetMinor: number;
  capitalNetMinor: number;
  otherNetMinor: number;
  inflationaryMinor: number;
  generalNetMinor: number;
  voluntaryMinor: number;
  labourExemptMinor: number;
  dependentDeductionMinor: number;
  healthPolicyMinor: number;
  beforeCapMinor: number;
  capMinor: number;
  cappedMinor: number;
  dependentsMinor: number;
  eInvoiceMinor: number;
  deductionsMinor: number;
  taxableMinor: number;
  taxableUvt: number;
  taxMinor: number;
  monthlyWithheldMinor: number;
  extraWithheldMinor: number;
  withheldMinor: number;
  creditedMinor: number;
  toPayMinor: number;
  inFavourMinor: number;
  savePerMonthMinor: number;
  contributionsPerMonthMinor: number;
  voluntaryPerMonthMinor: number;
  withheldPerMonthMinor: number;
  voluntaryMissingPerMonthMinor: number;
  grossPerMonthMinor: number;
  netPerMonthMinor: number;
  roomMinor: number;
  voluntaryCeilingMinor: number;
  voluntaryOptimalMinor: number;
  voluntaryMissingMinor: number;
}
