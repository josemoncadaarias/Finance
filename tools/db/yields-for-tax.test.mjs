// The yields the income-tax form brings in for one year.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/yields-for-tax.test.mjs
//
// Jose, 2026-09-25: everything that earned in the year, the estimated months
// included, in pesos - and nothing from an account of type Inversión, whose
// return is taxed only when the fund certifies it as realized.

import test from 'node:test';
import assert from 'node:assert/strict';

import { yieldsOfTaxYear } from '../../src/app/core/report/yields-for-tax.ts';

const row = (account_id, on_date, gross, withheld = 0, estimated = false) => ({
  account_id, product_id: estimated ? -account_id : account_id * 10, component: 'base', on_date,
  paid_on: on_date, balance_minor: 0, annual_rate_scaled: 0, gross_minor: gross,
  withholding_minor: withheld, net_minor: gross - withheld, actual_net_minor: null, locked: 0,
  ...(estimated ? { estimated: true } : {}),
});

const data = days => ({
  accounts: [
    { id: 1, name: 'Ahorro Verde', type: 'debit', currency_code: 'COP' },
    { id: 2, name: 'Dólares', type: 'debit', currency_code: 'USD' },
    { id: 3, name: 'Fondo', type: 'investment', currency_code: 'COP' },
    { id: 4, name: 'Euros', type: 'debit', currency_code: 'EUR' },
  ],
  days,
  // Dollars at 4,000 pesos; euros have no rate on record.
  inReportCurrency: (minor, accountId) => (accountId === 2 ? minor * 4000 : accountId === 4 ? null : minor),
});

test('worked-out days, estimated days, pesos, and no investment account', () => {
  const got = yieldsOfTaxYear(data([
    row(1, '2025-12-31', 999_00),                 // the year before: out
    row(1, '2026-03-10', 500_00, 0, true),        // estimated
    row(1, '2026-09-10', 1_000_00, 70_00),        // worked out, withheld
    row(2, '2026-09-10', 2_00),                   // two dollars: 8,000 pesos
    row(3, '2026-09-10', 50_000_00),              // an investment with a product: out
    row(4, '2026-09-10', 3_00),                   // no rate: out, counted
    row(1, '2027-01-01', 999_00),                 // the year after: out
  ]), 2026);

  assert.equal(got.workedMinor, 1_000_00 + 8_000_00, 'pesos plus the dollars at their rate');
  assert.equal(got.estimatedMinor, 500_00);
  assert.equal(got.withheldMinor, 70_00, 'withholding only where the engine worked it out');
  assert.equal(got.workedDays, 2);
  assert.equal(got.estimatedDays, 1);
  assert.equal(got.leftOutDays, 1);
  assert.deepEqual(got.investmentsLeftOut, ['Fondo']);
});

test('a year with nothing in it is all zeroes', () => {
  const got = yieldsOfTaxYear(data([row(1, '2026-09-10', 1_000_00)]), 2024);
  assert.equal(got.workedMinor + got.estimatedMinor + got.withheldMinor, 0);
  assert.equal(got.workedDays + got.estimatedDays, 0);
});
