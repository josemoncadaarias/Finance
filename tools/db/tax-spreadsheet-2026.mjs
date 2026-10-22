// Test data only: the figures of one spreadsheet (2026) the tax engine was
// ported from, so the tests can compare it cell by cell against what Excel
// stored. Never shipped in the app and never laid into anybody's form
// (2026-10-22: the app used to fill them in when an account had a given name,
// which any user could have).

export const SPREADSHEET_2026 = {
  employment: 'integral',
  dependents: 2,
  monthlySalaryMinor: 2_276_176_500,
  monthsWorked: 12,
  // The spreadsheet's "ingresos no laborales" of 10.000.000 were never that:
  // they are the yields expected this year, casilla 58. Its 5.000.000 of
  // "costos" was a guess at the componente inflacionario on them, casilla 59,
  // which the form now works out from the year's percentage instead.
  capitalIncomeMinor: 1_000_000_000,
  financialYieldMinor: 1_000_000_000,
  healthPolicyMinor: 443_770_000,
  monthlyWithholdingMinor: [
    286_100_000, 286_100_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000,
    273_700_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000, 273_700_000,
  ],
  extraWithholdingMinor: [35_000_000, 0, 0, 0],
};
