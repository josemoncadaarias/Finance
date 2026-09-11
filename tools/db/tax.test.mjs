// The income-tax simulation, checked against the spreadsheet it came from.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/tax.test.mjs
//
// Every figure asserted here was read out of `Simulador_Tributario_2026.xlsx`
// — not recomputed by hand, but the value Excel itself had stored in the file
// for each formula cell. So this is not a test of whether the arithmetic is
// self-consistent; it is a test of whether this engine produces the numbers
// Jose has been using, which is the only check that means anything.
//
// The tolerance is one peso. Excel works in float64 and this works in integer
// cents, so the two disagree in the last fraction of a cent and always will.
// A peso is far below anything that matters here — the DIAN rounds the form
// to whole thousands.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPLOYMENT_DEFAULTS, applyRate, contributionBase, simulate, solidarityRateScaled, taxInUvt,
} from '../../src/app/core/tax/cedula-general.ts';

const PESO = 100;
const pesos = value => Math.round(value * PESO);

/** Jose's own figures, cell for cell. */
function sheetInputs(overrides = {}) {
  return {
    year: 2026,
    uvtMinor: pesos(52_374),          // B8
    minimumWageMinor: 0,              // not in the sheet at all
    employment: 'integral',           // the sheet's 70% base is this rule
    dependents: 2,                    // B10
    monthlySalaryMinor: pesos(22_761_765),  // B13
    monthsWorked: 12,                 // B14
    otherLabourIncomeMinor: 0,        // B15
    solidarityScaled: 10_000,         // B21, 1%
    capitalIncomeMinor: 0,            // B30
    capitalCostsMinor: 0,             // B31
    otherIncomeMinor: pesos(10_000_000),   // B35
    otherCostsMinor: pesos(5_000_000),     // B36
    financialYieldMinor: 0,           // B41
    inflationaryScaled: 554_300,      // B42
    voluntaryPayrollMinor: 0,         // B49
    voluntaryOwnMinor: 0,             // B50
    housingInterestMinor: 0,          // B52
    healthPolicyMinor: pesos(4_437_700),   // B58
    otherDeductionsMinor: 0,          // B61
    labourExemptScaled: 250_000,      // B53
    labourExemptCapUvt: 790,          // B54
    dependentMonthlyCapUvt: 32,       // B56
    healthPolicyCapUvt: 16,           // B59
    globalCapScaled: 400_000,         // B64
    globalCapUvt: 1340,               // B65
    dependentUvt: 72,                 // B70
    eInvoicePurchasesMinor: 0,        // B72
    eInvoiceCapUvt: 240,              // B73
    occasionalTaxMinor: 0,            // B93
    monthlyWithholdingMinor: [        // B98..B109
      2_861_000, 2_861_000, 2_737_000, 2_737_000, 2_737_000, 2_737_000,
      2_737_000, 2_737_000, 2_737_000, 2_737_000, 2_737_000, 2_737_000,
    ].map(pesos),
    extraWithholdingMinor: [pesos(350_000), 0, 0, 0],  // B114..B117
    creditFromLastYearMinor: 0,       // B121
    advancePaidMinor: 0,              // B122
    voluntaryCapUvt: 3800,            // B142
    voluntaryIncomeShareScaled: 300_000,  // B143
    ...overrides,
  };
}

/** Within one peso of what Excel stored for that cell. */
function closeTo(actualMinor, expectedPesos, cell) {
  const expected = pesos(expectedPesos);
  assert.ok(Math.abs(actualMinor - expected) <= PESO,
    `${cell}: got ${(actualMinor / PESO).toFixed(2)}, sheet says ${expectedPesos}`);
}

test('it reproduces the spreadsheet, line for line', () => {
  const out = simulate(sheetInputs());

  closeTo(out.grossLabourMinor, 273_141_180, 'B16 total ingresos brutos de trabajo');
  closeTo(out.monthlyBaseMinor, 15_933_235.5, 'B22 IBC mensual');
  closeTo(out.healthMinor, 7_647_953.04, 'B23 aporte salud');
  closeTo(out.pensionMinor, 7_647_953.04, 'B24 aporte pensión');
  closeTo(out.solidarityMinor, 1_911_988.26, 'B25 fondo de solidaridad');
  closeTo(out.contributionsMinor, 17_207_894.34, 'B26 total aportes');
  closeTo(out.labourNetMinor, 255_933_285.66, 'B27 renta líquida de trabajo');

  closeTo(out.capitalNetMinor, 0, 'B32 renta líquida de capital');
  closeTo(out.otherNetMinor, 5_000_000, 'B37 renta líquida no laboral');
  closeTo(out.generalNetMinor, 260_933_285.66, 'B46 renta líquida cédula general');

  closeTo(out.labourExemptMinor, 41_375_460, 'B55 renta exenta de trabajo');
  closeTo(out.dependentDeductionMinor, 20_111_616, 'B57 deducción dependiente 10%');
  closeTo(out.healthPolicyMinor, 4_437_700, 'B60 deducción pólizas de salud');
  closeTo(out.beforeCapMinor, 65_924_776, 'B62 subtotal sin límite');
  closeTo(out.capMinor, 70_181_160, 'B66 límite aplicable');
  closeTo(out.cappedMinor, 65_924_776, 'B67 exentas y deducciones limitadas');

  closeTo(out.dependentsMinor, 7_541_856, 'B71 deducción por dependientes');
  closeTo(out.eInvoiceMinor, 0, 'B74 deducción factura electrónica');
  closeTo(out.deductionsMinor, 73_466_632, 'B76 total exentas y deducciones');

  closeTo(out.taxableMinor, 187_466_653.66, 'B79 renta líquida ordinaria');
  assert.ok(Math.abs(out.taxableUvt - 3579.3839244663382) < 0.001, 'B80 base en UVT');
  closeTo(out.taxMinor, 33_636_023.02, 'B94 impuesto neto de renta');

  closeTo(out.monthlyWithheldMinor, 33_092_000, 'B110 subtotal retención mensual');
  closeTo(out.extraWithheldMinor, 350_000, 'B118 subtotal retenciones adicionales');
  closeTo(out.withheldMinor, 33_442_000, 'B120 total retenciones');
  closeTo(out.toPayMinor, 194_023.02, 'B127 saldo a pagar');
  closeTo(out.inFavourMinor, 0, 'B128 saldo a favor');
  closeTo(out.savePerMonthMinor, 16_168.59, 'B137 ahorro mensual sugerido');

  closeTo(out.grossPerMonthMinor, 23_595_098.33, 'B131 ingreso bruto mensual');
  closeTo(out.netPerMonthMinor, 19_374_273.81, 'B135 salario neto mensual');

  closeTo(out.roomMinor, 4_256_384, 'B141 espacio disponible');
  closeTo(out.voluntaryCeilingMinor, 84_942_354, 'B144 tope absoluto aporte voluntario');
  closeTo(out.voluntaryOptimalMinor, 4_256_384, 'B145 aporte voluntario óptimo');
  closeTo(out.voluntaryMissingMinor, 4_256_384, 'B146 faltante por trasladar');
});

test('the progressive table matches the article it comes from', () => {
  // The examples in art. 241 E.T. itself: each band starts where the one
  // before it ends, and the accumulated figure the article states is what a
  // base at the top of the previous band produces.
  assert.equal(taxInUvt(0), 0);
  assert.equal(taxInUvt(1090), 0, 'nothing is owed up to 1,090 UVT');
  // The article rounds each of these to a whole UVT when it states them, so
  // the accumulated figures below are 116, 788, 2296, 5901 and 10352 in the
  // text and a decimal here. The table applies the decimal, which is what the
  // spreadsheet does and what the DIAN's own calculator does.
  assert.ok(Math.abs(taxInUvt(1700) - 115.9) < 0.001);
  assert.ok(Math.abs(taxInUvt(4100) - 788) < 0.001);
  assert.ok(Math.abs(taxInUvt(8670) - 2296.1) < 0.001);
  assert.ok(Math.abs(taxInUvt(18970) - 5901) < 0.001);
  assert.ok(Math.abs(taxInUvt(31000) - 10352.1) < 0.001);

  // And one past the top, where the marginal rate is 39%.
  assert.ok(Math.abs(taxInUvt(32000) - 10742) < 0.001);
});

test('what kind of work it is changes the contribution base and the rates', () => {
  // The same gross income three ways. This is the thing the spreadsheet could
  // not say, and it moves the answer by millions.
  const salary = pesos(22_761_765);

  const ordinary = simulate(sheetInputs({ employment: 'ordinary' }));
  const integral = simulate(sheetInputs({ employment: 'integral' }));
  const contractor = simulate(sheetInputs({ employment: 'independent' }));

  // An ordinary salary contributes on the whole of it; an integral one on 70%.
  assert.equal(ordinary.monthlyBaseMinor, salary);
  assert.equal(integral.monthlyBaseMinor, applyRate(salary, 700_000));
  assert.equal(contractor.monthlyBaseMinor, applyRate(salary, 400_000));

  // Someone working by contract pays both halves: 12.5% and 16% against 4%
  // and 4%. On a smaller base, and it still comes to far more.
  assert.ok(contractor.contributionsMinor > ordinary.contributionsMinor,
    'the whole of both contributions outweighs the smaller base');

  // And more contributions is less taxable income, so less tax.
  assert.ok(contractor.taxMinor < ordinary.taxMinor);
});

test('the contribution base is held between one minimum wage and twenty-five', () => {
  const wage = pesos(1_623_500);

  // Somebody billing very little still contributes on a whole minimum wage.
  assert.equal(contributionBase(pesos(1_000_000), 400_000, wage), wage);

  // And a very large salary stops at twenty-five of them.
  assert.equal(contributionBase(pesos(100_000_000), 1_000_000, wage), wage * 25);

  // With no minimum wage on record neither bound is applied, because a bound
  // invented from nothing would quietly change a figure being checked against
  // a payslip.
  assert.equal(contributionBase(pesos(1_000_000), 400_000, 0), pesos(400_000));
});

test('the solidarity fund rises in steps, and only above four minimum wages', () => {
  const wage = pesos(1_623_500);
  const at = multiple => solidarityRateScaled(wage * multiple, wage, 10_000);

  assert.equal(at(3), 0, 'nothing below four');
  assert.equal(at(4), 10_000, '1% from four');
  assert.equal(at(15), 10_000);
  assert.equal(at(16), 12_000, 'and a tenth of a point per wage from sixteen');
  assert.equal(at(17), 14_000);
  assert.equal(at(18), 16_000);
  assert.equal(at(19), 18_000);
  assert.equal(at(21), 20_000, 'capped at 2%');

  // Without a minimum wage the steps cannot be worked out, so the rate the
  // user typed stands rather than a guess.
  assert.equal(solidarityRateScaled(pesos(9_000_000), 0, 12_000), 12_000);
});

test('the employee share is only the employee share', () => {
  // 4% and 4%, not the 12.5% and 16% the job costs in total: the other part
  // is the employer's money and never the worker's deduction.
  assert.equal(EMPLOYMENT_DEFAULTS.ordinary.healthScaled, 40_000);
  assert.equal(EMPLOYMENT_DEFAULTS.ordinary.pensionScaled, 40_000);
  assert.equal(EMPLOYMENT_DEFAULTS.integral.healthScaled, 40_000);

  // Working by contract there is no employer, so both halves are paid.
  assert.equal(EMPLOYMENT_DEFAULTS.independent.healthScaled, 125_000);
  assert.equal(EMPLOYMENT_DEFAULTS.independent.pensionScaled, 160_000);
});
