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
    // The sheet has no column for work billed rather than employed, nor for
    // a controlled foreign entity. Zero keeps it the sheet it was.
    feeIncomeMinor: 0,                // casilla 43
    feeNonTaxableMinor: 0,            // casilla 44
    feeCostsMinor: 0,                 // casilla 45
    capitalIncomeMinor: 0,            // B30
    capitalCostsMinor: 0,             // B31
    passiveCapitalMinor: 0,           // casilla 62
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

// ---------------------------------------------------------------------------
// Jose's own 2025 return, as the DIAN received it (form 2118750959688, filed
// 2026-08-13). Four columns of the cedula general, not two - which is how the
// missing casillas 43 to 46 and 62 were found.
// ---------------------------------------------------------------------------

test('the four columns of the cedula general add up the way the filed return does', () => {
  const filed = simulate(sheetInputs({
    // Rentas de trabajo sin relación laboral: 43 − 44 − 45 = 46.
    feeIncomeMinor: pesos(284_000),
    feeNonTaxableMinor: 0,
    feeCostsMinor: 0,

    // Rentas de capital: 58 − 59 − 60 = 61, with the inflationary component
    // typed as the bank certified it rather than worked out.
    capitalIncomeMinor: pesos(55_668_000),
    capitalNonTaxableTyped: true,
    capitalNonTaxableTypedMinor: pesos(26_135_000),
    capitalCostsMinor: 0,
    passiveCapitalMinor: 0,

    otherIncomeMinor: 0,
    otherCostsMinor: 0,
  }));

  assert.equal(filed.feeNetMinor, pesos(284_000), 'casilla 46');
  assert.equal(filed.capitalNetMinor, pesos(29_533_000), 'casilla 61');

  // And both columns reach the total: casilla 91 is 42 + 57 + 73 + 90.
  const without = simulate(sheetInputs({
    capitalIncomeMinor: pesos(55_668_000),
    capitalNonTaxableTyped: true,
    capitalNonTaxableTypedMinor: pesos(26_135_000),
    otherIncomeMinor: 0,
    otherCostsMinor: 0,
  }));
  assert.equal(filed.generalNetMinor - without.generalNetMinor, pesos(284_000),
    'the fee column is in the total, and only once');

  // An ECE's passive income joins the capital column, peso for peso.
  const withEce = simulate(sheetInputs({
    capitalIncomeMinor: pesos(55_668_000),
    capitalNonTaxableTyped: true,
    capitalNonTaxableTypedMinor: pesos(26_135_000),
    passiveCapitalMinor: pesos(1_000_000),
    otherIncomeMinor: 0,
    otherCostsMinor: 0,
  }));
  assert.equal(withEce.generalNetMinor - without.generalNetMinor, pesos(1_000_000), 'casilla 62');
});

test('a column of the cedula general never goes negative', () => {
  // Costs larger than what they produced do not become a discount against the
  // other columns: the DIAN's instruction for each of these boxes is "the
  // positive result", and a loss belongs in the pérdida líquida box instead.
  const overspent = simulate(sheetInputs({
    feeIncomeMinor: pesos(1_000_000),
    feeCostsMinor: pesos(4_000_000),
  }));
  assert.equal(overspent.feeNetMinor, 0, 'casilla 46 floors at zero');
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

test('the monthly lines match the spreadsheet too', async () => {
  // B132 to B134 and B147: the per-month figures the planning section shows.
  const out = simulate(sheetInputs());
  closeTo(out.contributionsPerMonthMinor, 1_433_991.19, 'B132 aportes obligatorios al mes');
  closeTo(out.voluntaryPerMonthMinor, 0, 'B133 aporte voluntario al mes');
  closeTo(out.withheldPerMonthMinor, 2_786_833.33, 'B134 retención al mes');
  closeTo(out.voluntaryMissingPerMonthMinor, 354_698.67, 'B147 faltante mensual');
});

test('a simulation is kept per year, and survives the form growing', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { TaxSimulationsRepository } = await import(
    '../../src/app/core/database/repositories/tax-simulations.repository.ts');
  const { defaultInputs, withDefaults } = await import('../../src/app/core/tax/defaults.ts');

  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const repo = new TaxSimulationsRepository(db, () => '2026-09-11T00:00:00Z');

  assert.equal(await repo.get(2026), null, 'nothing until someone starts one');

  const typed = { ...defaultInputs(2026), monthlySalaryMinor: pesos(22_761_765), employment: 'integral' };
  await repo.save(2026, typed);
  await repo.save(2025, { ...defaultInputs(2025), dependents: 3 });

  const back = await repo.get(2026);
  assert.equal(back.monthlySalaryMinor, pesos(22_761_765));
  assert.equal(back.employment, 'integral');
  assert.equal((await repo.get(2025)).dependents, 3, 'each year is its own');
  assert.deepEqual(await repo.years(), [2026, 2025]);

  // A simulation saved before a line existed still opens with that line, and
  // the fixed-length lists come back at their length rather than short.
  const old = withDefaults(2026, { monthlySalaryMinor: 5, monthlyWithholdingMinor: [1, 2] });
  assert.equal(old.monthlyWithholdingMinor.length, 12);
  assert.deepEqual(old.monthlyWithholdingMinor.slice(0, 3), [1, 2, 0]);
  assert.equal(old.voluntaryCapUvt, 3800, 'a cap added later arrives with its default');

  // Never zero where a reasonable figure exists: a year with no resolution yet
  // borrows the latest one, and the screen labels it as borrowed.
  assert.equal(defaultInputs(2026).uvtMinor, pesos(52_374));
  assert.equal(defaultInputs(2027).uvtMinor, pesos(52_374), 'borrowed from 2026');

  await db.close();
});

test('the yields of a year add up across every enrolled account', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { YieldsRepository } = await import('../../src/app/core/database/repositories/yields.repository.ts');
  const { AccountsRepository } = await import('../../src/app/core/database/repositories/accounts.repository.ts');

  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const now = () => '2026-09-11T00:00:00Z';
  const yields = new YieldsRepository(db, now);
  const account = await new AccountsRepository(db, now).create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2021-07-01',
  });
  await yields.enrol({ account_id: account, opening_on: '2025-12-30' });
  const [product] = await yields.products(account);

  const day = (on_date, gross, withheld) => db.run(
    `INSERT INTO yield_days (product_id, account_id, component, on_date, balance_minor, annual_rate_scaled,
       payout, gross_minor, withholding_minor, net_minor, computed_at)
     VALUES (?, ?, 'base', ?, 0, 90000, 'daily', ?, ?, ?, ?)`,
    [product.id, account, on_date, gross, withheld, gross - withheld, now()]);

  await day('2025-12-31', 5_000, 0);     // the year before: not counted
  await day('2026-01-01', 10_000, 700);
  await day('2026-12-31', 20_000, 1_400);

  // Cashback counts apart: rentas de capital too, but not a financial yield.
  await yields.adjust({ account_id: account, on_date: '2026-03-10', amount_minor: 4_000, kind: 'cashback', source: 'cashback' });
  await yields.adjust({ account_id: account, on_date: '2026-03-11', amount_minor: 900 });   // a correction: not cashback
  await yields.adjust({ account_id: account, on_date: '2025-03-10', amount_minor: 7_000, kind: 'cashback', source: 'cashback' });

  const totals = await yields.yearTotals(2026);
  assert.deepEqual(totals, { grossMinor: 30_000, withheldMinor: 2_100, days: 2, cashbackMinor: 4_000 });
  assert.deepEqual(await yields.yearTotals(2024), { grossMinor: 0, withheldMinor: 0, days: 0, cashbackMinor: 0 });

  await db.close();
});

test('each parameter says whether it is official, borrowed or estimated', async () => {
  const { uvtFor, minimumWageFor, inflationaryFor } = await import('../../src/app/core/tax/defaults.ts');

  // The minimum wage WITHOUT the transport allowance, which is not salary and
  // is no part of any contribution base. Decreto 1469 de 2025.
  const wage2026 = minimumWageFor(2026);
  assert.equal(wage2026.value, pesos(1_750_905));
  assert.equal(wage2026.standing, 'official');

  // A year with nothing published borrows the latest one, and says so.
  const wage2027 = minimumWageFor(2027);
  assert.equal(wage2027.value, pesos(1_750_905));
  assert.equal(wage2027.standing, 'reference');
  assert.equal(wage2027.fromYear, 2026);
  assert.equal(uvtFor(2027).standing, 'reference');

  // The inflationary component. Published the year after, so for the year in
  // progress there are two answers, depending on how much of it has passed.
  const official = inflationaryFor(2025);
  assert.equal(official.value, 554_300, '5,10% / 9,20%, Decreto 898 de 2026');
  assert.equal(official.standing, 'official');

  // Early in the year: last year's figure, borrowed.
  const march = inflationaryFor(2026, new Date(2026, 2, 15));
  assert.equal(march.standing, 'reference');
  assert.equal(march.value, 554_300);
  assert.equal(march.fromYear, 2025);

  // Past the first half: this year's own data. 6,24% / 10,05%.
  const september = inflationaryFor(2026, new Date(2026, 8, 11));
  assert.equal(september.standing, 'estimate');
  assert.equal(september.value, Math.round((6.24 / 10.05) * 1_000_000));
  assert.ok(Math.abs(september.value / 10_000 - 62.09) < 0.01, 'about 62,09%');

  // July is the turn - six months have passed.
  assert.equal(inflationaryFor(2026, new Date(2026, 5, 30)).standing, 'reference', 'June is still the first half');
  assert.equal(inflationaryFor(2026, new Date(2026, 6, 1)).standing, 'estimate');
});

test('filling the gaps never replaces a figure someone typed', async () => {
  const { defaultInputs, fillGaps, SPREADSHEET_2026 } = await import('../../src/app/core/tax/defaults.ts');

  const typed = {
    ...defaultInputs(2026),
    monthlySalaryMinor: pesos(15_000_000),               // typed: stays
    monthlyWithholdingMinor: [pesos(100), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, pesos(200)],
  };

  const filled = fillGaps(typed, SPREADSHEET_2026);

  assert.equal(filled.monthlySalaryMinor, pesos(15_000_000), 'what was typed is theirs');
  assert.equal(filled.dependents, 2, 'an untouched zero is a gap');
  assert.equal(filled.healthPolicyMinor, pesos(4_437_700));
  assert.equal(filled.employment, 'integral', 'the starting kind was never a choice');

  // Month by month: the two typed months kept, the ten empty ones filled.
  assert.equal(filled.monthlyWithholdingMinor[0], pesos(100));
  assert.equal(filled.monthlyWithholdingMinor[1], pesos(2_861_000));
  assert.equal(filled.monthlyWithholdingMinor[11], pesos(200));

  // A kind of work chosen on purpose is not a gap.
  const chosen = fillGaps({ ...defaultInputs(2026), employment: 'independent' }, SPREADSHEET_2026);
  assert.equal(chosen.employment, 'independent');

  // And filled from the spreadsheet, the simulation lands where it does.
  const sheet = simulate(fillGaps(defaultInputs(2026), SPREADSHEET_2026));
  closeTo(sheet.grossLabourMinor, 273_141_180, 'B16 from the filled simulation');
});

test('a year opened long ago gets its own UVT back, and a typed one is left alone', async () => {
  const { defaultInputs, useThisYearsParameters } = await import('../../src/app/core/tax/defaults.ts');

  // What Jose actually had: tax year 2024 saved when the module used the
  // current year's figures for every year. The screen said "Oficial: UVT
  // $47.065" and the box said 52.374.
  const stale = {
    ...defaultInputs(2024),
    uvtMinor: pesos(52_374),            // 2026's
    minimumWageMinor: pesos(1_423_500), // 2025's
    monthlySalaryMinor: pesos(9_000_000),
  };

  const fixed = useThisYearsParameters(stale);

  assert.equal(fixed.uvtMinor, pesos(47_065), "2024's own UVT");
  assert.equal(fixed.minimumWageMinor, pesos(1_300_000), "2024's own minimum wage");
  assert.equal(fixed.monthlySalaryMinor, pesos(9_000_000), 'nothing else is touched');

  // A figure off the tables can only have been chosen, so it stays.
  const chosen = useThisYearsParameters({ ...defaultInputs(2024), uvtMinor: pesos(47_100) });
  assert.equal(chosen.uvtMinor, pesos(47_100), 'a hand-corrected figure is a decision');

  // And a year already holding its own is left exactly as it is.
  const right = defaultInputs(2025);
  assert.deepEqual(useThisYearsParameters(right), right);
});

test('the fill is remembered per year, and only lands on the owner database', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { TaxSimulationsRepository } = await import(
    '../../src/app/core/database/repositories/tax-simulations.repository.ts');
  const { AccountsRepository } = await import('../../src/app/core/database/repositories/accounts.repository.ts');

  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const now = () => '2026-09-11T00:00:00Z';
  const repo = new TaxSimulationsRepository(db, now);

  assert.equal(await repo.gapsFilled(2026), false);
  await repo.markGapsFilled(2026);
  assert.equal(await repo.gapsFilled(2026), true);
  assert.equal(await repo.gapsFilled(2025), false, 'each year on its own');

  assert.equal(await repo.hasAccountNamed('Rappi cuenta'), false, 'a fresh database is nobody\'s');
  await new AccountsRepository(db, now).create({
    name: 'Rappi cuenta', type: 'debit', currency_code: 'COP', builtin_icon: 'wallet', opened_on: '2021-07-01',
  });
  assert.equal(await repo.hasAccountNamed('Rappi cuenta'), true);

  await db.close();
});

test('with no salary there is no contribution base, minimum wage or not', async () => {
  const { contributionBase } = await import('../../src/app/core/tax/cedula-general.ts');
  const { defaultInputs } = await import('../../src/app/core/tax/defaults.ts');

  assert.equal(contributionBase(0, 1_000_000, pesos(1_750_905)), 0);
  assert.equal(contributionBase(pesos(1_000_000), 1_000_000, pesos(1_750_905)), pesos(1_750_905), 'the floor still holds');

  // An untouched form, now that the minimum wage is filled in, owes nothing
  // and shows no negative income.
  const blank = simulate(defaultInputs(2026));
  assert.equal(blank.generalNetMinor, 0);
  assert.equal(blank.toPayMinor, 0);
});

test('rentas de capital: casilla 59 is the componente inflacionario of the yields, and 61 never goes negative', async () => {
  const { defaultInputs } = await import('../../src/app/core/tax/defaults.ts');
  const base = { ...defaultInputs(2026), inflationaryScaled: 554_300 };   // 55,43%

  // 8 million of yields plus 2 million of cashback: only the yields carry it.
  const mixed = simulate({ ...base, capitalIncomeMinor: pesos(10_000_000), financialYieldMinor: pesos(8_000_000) });
  assert.equal(mixed.capitalNonTaxableMinor, pesos(4_434_400), 'casilla 59: 55,43% of 8.000.000');
  assert.equal(mixed.capitalNetMinor, pesos(10_000_000) - pesos(4_434_400), 'casilla 61');
  assert.equal(mixed.generalNetMinor, mixed.capitalNetMinor, 'and it is what reaches the cédula general');

  // Never more than the gross it is part of, and 61 is the positive result.
  const odd = simulate({ ...base, capitalIncomeMinor: pesos(1_000), financialYieldMinor: pesos(5_000), capitalCostsMinor: pesos(500) });
  assert.equal(odd.capitalNonTaxableMinor, pesos(1_000));
  assert.equal(odd.capitalNetMinor, 0);
});

test('a 2026 simulation saved with the yields in rentas no laborales is moved to rentas de capital', async () => {
  const { NodeSqlDriver } = await import('./node-sql-driver.mjs');
  const { migrate } = await import('../../src/app/core/database/migrations/migration-runner.ts');
  const { MIGRATION_SOURCES } = await import('../../src/app/core/database/migrations/statements.generated.ts');
  const { TaxSimulationsRepository } = await import(
    '../../src/app/core/database/repositories/tax-simulations.repository.ts');

  const db = new NodeSqlDriver();
  await migrate(db, MIGRATION_SOURCES);
  const put = (year, doc) => db.run(
    "INSERT INTO tax_simulations (year, inputs, created_at, updated_at) VALUES (?, ?, 'x', 'x')",
    [year, JSON.stringify(doc)]);
  const repo = new TaxSimulationsRepository(db, () => '2026-09-11T00:00:00Z');

  // What revision 1 of the fill stored.
  await put(2026, { otherIncomeMinor: pesos(10_000_000), otherCostsMinor: pesos(5_000_000) });
  const moved = await repo.get(2026);
  assert.equal(moved.otherIncomeMinor, 0);
  assert.equal(moved.otherCostsMinor, 0);
  assert.equal(moved.capitalIncomeMinor, pesos(10_000_000), 'casilla 58');
  assert.equal(moved.financialYieldMinor, pesos(10_000_000));
  assert.equal(moved.formRevision, 2);

  // Saved again, it is revision 2 and stays exactly as it is.
  await repo.save(2026, { ...moved, otherIncomeMinor: pesos(10_000_000), otherCostsMinor: pesos(5_000_000), capitalIncomeMinor: 0 });
  const kept = await repo.get(2026);
  assert.equal(kept.otherIncomeMinor, pesos(10_000_000), 'typed under revision 2: theirs');

  // Other figures, or another year, are never moved.
  await put(2025, { otherIncomeMinor: pesos(10_000_000), otherCostsMinor: pesos(5_000_000) });
  assert.equal((await repo.get(2025)).otherIncomeMinor, pesos(10_000_000));

  await db.close();
});


// ---------------------------------------------------------------------------
// Casilla 59 the other way round. The componente inflacionario is a figure a
// bank certificate often states outright, and the percentage it is worked out
// from is published months after the year ends, so Jose asked (2026-09-15) to
// be able to write the box down instead of reaching it through a percentage.

test('casilla 59 can be typed instead of worked out', () => {
  const worked = simulate(sheetInputs({
    capitalIncomeMinor: pesos(10_000_000),
    financialYieldMinor: pesos(8_000_000),
    inflationaryScaled: 554_300,
  }));
  assert.equal(worked.capitalNonTaxableMinor, pesos(8_000_000) * 0.5543,
    '55.43% of the financial yields');

  const typed = simulate(sheetInputs({
    capitalIncomeMinor: pesos(10_000_000),
    financialYieldMinor: pesos(8_000_000),
    inflationaryScaled: 554_300,
    capitalNonTaxableTyped: true,
    capitalNonTaxableTypedMinor: pesos(3_000_000),
  }));
  assert.equal(typed.capitalNonTaxableMinor, pesos(3_000_000), 'the certificate wins');
  assert.equal(typed.capitalNetMinor, pesos(7_000_000), 'casilla 61 follows it');

  // The yields and the percentage are left alone, so switching back finds them.
  const back = simulate(sheetInputs({
    capitalIncomeMinor: pesos(10_000_000),
    financialYieldMinor: pesos(8_000_000),
    inflationaryScaled: 554_300,
    capitalNonTaxableTyped: false,
    capitalNonTaxableTypedMinor: pesos(3_000_000),
  }));
  assert.equal(back.capitalNonTaxableMinor, worked.capitalNonTaxableMinor);
});

test('a typed casilla 59 still cannot exceed the income it comes out of', () => {
  const result = simulate(sheetInputs({
    capitalIncomeMinor: pesos(2_000_000),
    capitalNonTaxableTyped: true,
    capitalNonTaxableTypedMinor: pesos(9_000_000),
  }));
  assert.equal(result.capitalNonTaxableMinor, pesos(2_000_000));
  assert.equal(result.capitalNetMinor, 0, 'casilla 61 is never negative');
});

// ---------------------------------------------------------------------------
// A year gets its own figures. Only 2026 was on record, so opening 2023 filled
// the form with 2026's UVT and minimum wage - a return filed on those is wrong
// rather than approximate, and Jose caught it on 2026-09-16.

import { borrowedFromLater, parametersFor, uvtFor, minimumWageFor } from '../../src/app/core/tax/defaults.ts';

test('each tax year uses its own UVT and its own minimum wage', () => {
  const uvt = {
    2022: 38_004, 2023: 42_412, 2024: 47_065, 2025: 49_799, 2026: 52_374,
  };
  for (const [year, value] of Object.entries(uvt)) {
    const found = uvtFor(Number(year));
    assert.equal(found.value, pesos(value), `UVT ${year}`);
    assert.equal(found.standing, 'official', `UVT ${year} is the year's own`);
    assert.equal(found.fromYear, Number(year));
  }

  const wage = {
    2022: 1_000_000, 2023: 1_160_000, 2024: 1_300_000, 2025: 1_423_500, 2026: 1_750_905,
  };
  for (const [year, value] of Object.entries(wage)) {
    const found = minimumWageFor(Number(year));
    assert.equal(found.value, pesos(value), `salario mínimo ${year}`);
    assert.equal(found.standing, 'official');
  }
});

test('a figure standing in for a year it cannot describe says so', () => {
  // Older than anything on record: the earliest is borrowed, and it is later
  // than the year asked for - which is the case worth warning about.
  const old = parametersFor(2015);
  assert.equal(old.uvt.standing, 'reference');
  assert.equal(borrowedFromLater(old.uvt, 2015), true);

  // A year that has its own figure borrows nothing.
  const known = parametersFor(2024);
  assert.equal(borrowedFromLater(known.uvt, 2024), false);
  assert.equal(borrowedFromLater(known.minimumWage, 2024), false);

  // The inflationary component is published the year after, so a recent year
  // borrows or estimates it - and that is a reference from the past or an
  // estimate, never a figure from a year still to come.
  const thisYear = parametersFor(2025);
  assert.equal(borrowedFromLater(thisYear.inflationary, 2025), false);
});
