// A company's figures from its annual filings, as the SEC publishes them (2026-11-19).
// The facts below are invented, in the SEC's own shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cikFor, companyOf, companyStale, ratiosOf } from '../../src/app/core/stocks/company.ts';

const year = (start, end, val, extra = {}) => ({ start, end, val, form: '10-K', filed: `${end.slice(0, 4)}-03-01`, ...extra });
const at = (end, val, extra = {}) => ({ end, val, form: '10-K', filed: `${end.slice(0, 4)}-03-01`, ...extra });
const usd = rows => ({ units: { USD: rows } });

const FACTS = {
  cik: '0000123456', entityName: 'SOLAR ANDINA CORP',
  facts: {
    'us-gaap': {
      Revenues: usd([year('2024-01-01', '2024-12-31', 800), year('2025-01-01', '2025-12-31', 1000),
        // A quarter, and a later 10-Q: never the year read.
        { start: '2026-01-01', end: '2026-03-31', val: 300, form: '10-Q', filed: '2026-05-01' }]),
      NetIncomeLoss: usd([year('2024-01-01', '2024-12-31', 100), year('2025-01-01', '2025-12-31', 150),
        // The same year filed again, amended: the newer filing wins.
        year('2025-01-01', '2025-12-31', 160, { form: '10-K/A', filed: '2026-04-15' })]),
      GrossProfit: usd([year('2025-01-01', '2025-12-31', 600)]),
      // Reported only for an old year: left out, never taken from another year.
      OperatingIncomeLoss: usd([year('2012-01-01', '2012-12-31', 50)]),
      StockholdersEquity: usd([at('2025-12-31', 800)]),
      LongTermDebt: usd([at('2025-12-31', 400)]),
      AssetsCurrent: usd([at('2025-12-31', 300)]),
      LiabilitiesCurrent: usd([at('2025-12-31', 200)]),
      NetCashProvidedByUsedInOperatingActivities: usd([year('2025-01-01', '2025-12-31', 250)]),
      // An old concept with old rows, and the one used today.
      PaymentsToAcquirePropertyPlantAndEquipment: usd([year('2019-01-01', '2019-12-31', 10)]),
      PaymentsToAcquireProductiveAssets: usd([year('2025-01-01', '2025-12-31', 50)]),
      EarningsPerShareDiluted: { units: { 'USD/shares': [year('2025-01-01', '2025-12-31', 1.6)] } },
    },
  },
};

test('the latest annual filing is read whole, every figure of that same year', () => {
  const c = companyOf(FACTS, '2026-11-19T00:00:00Z');
  assert.equal(c.cik, 123456);
  assert.equal(c.yearEnd, '2025-12-31');
  assert.equal(c.currency, 'USD');
  assert.equal(c.revenue, 1000);
  assert.equal(c.revenueBefore, 800);
  assert.equal(c.netIncome, 160, 'the amended filing');
  assert.equal(c.operatingIncome, null, 'an old year is never used');
  assert.equal(c.capex, 50, 'the concept reported for that year');
  assert.equal(c.eps, 1.6);
  const r = ratiosOf(c);
  assert.equal(Math.round(r.revenueGrowth), 25);
  assert.equal(Math.round(r.grossMargin), 60);
  assert.equal(Math.round(r.netMargin), 16);
  assert.equal(Math.round(r.roe), 20);
  assert.equal(r.debtToEquity, 0.5);
  assert.equal(r.currentRatio, 1.5);
  assert.equal(r.freeCash, 200);
  assert.equal(r.operatingMargin, null);
});

test('a filer in IFRS and its own currency is read too; a fund has nothing', () => {
  const ifrs = { cik: 7, entityName: 'NUBE DATOS A/S', facts: { 'ifrs-full': {
    Revenue: { units: { DKK: [{ start: '2025-01-01', end: '2025-12-31', val: 5000, form: '20-F', filed: '2026-02-01' }] } },
    ProfitLoss: { units: { DKK: [{ start: '2025-01-01', end: '2025-12-31', val: 900, form: '20-F', filed: '2026-02-01' }] } },
    Equity: { units: { DKK: [{ end: '2025-12-31', val: 3000, form: '20-F', filed: '2026-02-01' }] } },
  } } };
  const c = companyOf(ifrs, '2026-11-19T00:00:00Z');
  assert.equal(c.currency, 'DKK');
  assert.equal(Math.round(ratiosOf(c).roe), 30);
  assert.equal(companyOf({ cik: 9, entityName: 'FONDO', facts: {} }, 'x'), null);
});

test('our ticker found in the SEC list; another market is not there; read again a year on', () => {
  const list = [{ cik_str: 1, ticker: 'BRK-B', title: 'B' }, { cik_str: 2, ticker: 'SOLR', title: 'S' }];
  assert.equal(cikFor('BRKB', list)?.cik_str, 1);
  assert.equal(cikFor('BRK.B', list)?.cik_str, 1);
  assert.equal(cikFor('SOLR.US', list)?.cik_str, 2);
  assert.equal(cikFor('SOLR.UK', list), null);
  const c = companyOf(FACTS, '2026-11-19T00:00:00Z');
  assert.equal(companyStale(c, '2026-12-01'), false);
  assert.equal(companyStale(c, '2027-01-02'), true);
  assert.equal(companyStale(null, '2026-12-01'), true);
});
