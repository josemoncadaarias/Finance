/**
 * A company's figures from its last annual filing with the SEC (2026-11-19).
 *
 * Pure. The SEC publishes, free and with no key, every filing of every
 * company listed in the United States as XBRL facts (`data.sec.gov`,
 * "companyfacts"): one list per concept (revenue, profit, assets...), each
 * value with the period it covers and the filing it came from. US companies
 * report in US-GAAP; foreign ones that file a 20-F (Novo Nordisk, Nu) in
 * IFRS, often in their own currency. ETFs and funds file no such statements:
 * they have none of this.
 *
 * Only the latest ANNUAL filing is read (10-K, 20-F, 40-F, or their
 * amendments), so every figure belongs to one same year and they can be set
 * against each other; a concept the company did not report for that year is
 * left out, never taken from another year (Berkshire's "operating income"
 * stops in 2012). The year before is read too, for the growth.
 */

/** One row of the SEC's list of tickers: `company_tickers.json`. */
export interface SecTicker {
  cik_str: number;
  ticker: string;
  title: string;
}

/** What the app keeps per ticker, read once a filing. Money in the filing's units, as reported. */
export interface Company {
  cik: number;
  name: string;
  /** The currency the filing reports in: "USD", "DKK"... */
  currency: string;
  /** The last day of the fiscal year read. */
  yearEnd: string;
  form: string;
  filed: string;
  revenue: number | null;
  revenueBefore: number | null;
  netIncome: number | null;
  netIncomeBefore: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  debt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  operatingCash: number | null;
  capex: number | null;
  /** Per share, in the filing's currency. */
  eps: number | null;
  dividendsPerShare: number | null;
  /** When the app read it, ISO. */
  readAt: string;
}

/** The concepts asked for, in the order tried: US-GAAP first, then IFRS. */
const CONCEPTS = {
  revenue: ['us-gaap:Revenues', 'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 'us-gaap:SalesRevenueNet',
    'us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax', 'ifrs-full:Revenue', 'ifrs-full:RevenueFromContractsWithCustomers'],
  netIncome: ['us-gaap:NetIncomeLoss', 'us-gaap:ProfitLoss', 'ifrs-full:ProfitLossAttributableToOwnersOfParent', 'ifrs-full:ProfitLoss'],
  grossProfit: ['us-gaap:GrossProfit', 'ifrs-full:GrossProfit'],
  operatingIncome: ['us-gaap:OperatingIncomeLoss', 'ifrs-full:ProfitLossFromOperatingActivities'],
  assets: ['us-gaap:Assets', 'ifrs-full:Assets'],
  liabilities: ['us-gaap:Liabilities', 'ifrs-full:Liabilities'],
  equity: ['us-gaap:StockholdersEquity', 'us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    'ifrs-full:EquityAttributableToOwnersOfParent', 'ifrs-full:Equity'],
  cash: ['us-gaap:CashAndCashEquivalentsAtCarryingValue', 'us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
    'ifrs-full:CashAndCashEquivalents'],
  debt: ['us-gaap:LongTermDebt', 'us-gaap:LongTermDebtNoncurrent', 'ifrs-full:NoncurrentPortionOfNoncurrentBorrowings', 'ifrs-full:Borrowings'],
  currentAssets: ['us-gaap:AssetsCurrent', 'ifrs-full:CurrentAssets'],
  currentLiabilities: ['us-gaap:LiabilitiesCurrent', 'ifrs-full:CurrentLiabilities'],
  operatingCash: ['us-gaap:NetCashProvidedByUsedInOperatingActivities', 'ifrs-full:CashFlowsFromUsedInOperatingActivities'],
  capex: ['us-gaap:PaymentsToAcquirePropertyPlantAndEquipment', 'us-gaap:PaymentsToAcquireProductiveAssets',
    'us-gaap:PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets', 'ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  eps: ['us-gaap:EarningsPerShareDiluted', 'us-gaap:EarningsPerShareBasic', 'ifrs-full:DilutedEarningsLossPerShare', 'ifrs-full:BasicEarningsLossPerShare'],
  dividendsPerShare: ['us-gaap:CommonStockDividendsPerShareDeclared', 'us-gaap:CommonStockDividendsPerShareCashPaid'],
} as const;

type Concept = keyof typeof CONCEPTS;
/** Figures over a year; the rest are a balance at the year's last day. */
const OVER_A_YEAR: ReadonlySet<Concept> = new Set(['revenue', 'netIncome', 'grossProfit', 'operatingIncome', 'operatingCash', 'capex', 'eps', 'dividendsPerShare']);
const ANNUAL = /^(10-K|20-F|40-F)(\/A)?$/;

interface Fact { start?: string; end: string; val: number; form?: string; filed?: string }
interface CompanyFacts { cik?: number | string; entityName?: string; facts?: Record<string, Record<string, { units?: Record<string, Fact[]> }>> }

function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The SEC's ticker for one of ours: "BRKB" and "BRK.B" are "BRK-B"; a
 * ticker of another market ("VUAA.UK") has no filings there.
 */
export function cikFor(symbol: string, tickers: readonly SecTicker[]): SecTicker | null {
  const market = symbol.match(/\.([A-Z]{2})$/);
  if (market && market[1] !== 'US') return null;
  const bare = symbol.replace(/\.US$/, '').replace(/[.\-]/g, '');
  return tickers.find(one => one.ticker.replace(/[.\-]/g, '') === bare) ?? null;
}

/** Every annual value of a concept, one per year end, the latest filing winning. */
type Annual = { name: string; unit: string; byEnd: Map<string, Fact> };

/** Of several concepts, the one reported for the latest year (a company may change the concept it uses). */
function latestOf(facts: CompanyFacts, names: readonly string[], overAYear: boolean, unitWanted: (unit: string) => boolean): Annual | null {
  let best: Annual | null = null;
  let bestEnd = '';
  for (const name of names) {
    const found = annualOf(facts, [name], overAYear, unitWanted);
    const end = found ? [...found.byEnd.keys()].sort().pop()! : '';
    if (found && end > bestEnd) { best = found; bestEnd = end; }
  }
  return best;
}

function annualOf(facts: CompanyFacts, names: readonly string[], overAYear: boolean, unitWanted: (unit: string) => boolean): Annual | null {
  for (const name of names) {
    const [ns, concept] = name.split(':');
    const units = facts.facts?.[ns]?.[concept]?.units;
    if (!units) continue;
    for (const [unit, rows] of Object.entries(units)) {
      if (!unitWanted(unit)) continue;
      const byEnd = new Map<string, Fact>();
      for (const row of rows) {
        if (!row.form || !ANNUAL.test(row.form) || typeof row.val !== 'number') continue;
        if (overAYear) {
          if (!row.start) continue;
          const length = days(row.start, row.end);
          if (length < 350 || length > 380) continue;
        }
        const kept = byEnd.get(row.end);
        if (!kept || (row.filed ?? '') > (kept.filed ?? '')) byEnd.set(row.end, row);
      }
      if (byEnd.size > 0) return { name, unit, byEnd };
    }
  }
  return null;
}

const moneyUnit = (unit: string) => /^[A-Z]{3}$/.test(unit);
const perShareUnit = (unit: string) => /^[A-Z]{3}\/shares$/.test(unit);

/** The latest year's figures, or null when the company files no annual statements (a fund). */
export function companyOf(facts: CompanyFacts, readAt: string): Company | null {
  const revenue = latestOf(facts, CONCEPTS.revenue, true, moneyUnit);
  const netIncome = latestOf(facts, CONCEPTS.netIncome, true, moneyUnit);
  const anchor = revenue ?? netIncome;
  if (!anchor) return null;
  // The year read is the latest one the revenue (or the profit) was reported for.
  const yearEnd = [...anchor.byEnd.keys()].sort().pop()!;
  const head = anchor.byEnd.get(yearEnd)!;
  const currency = anchor.unit;
  const before = (found: ReturnType<typeof annualOf>) => {
    if (!found) return null;
    const earlier = [...found.byEnd.keys()].filter(end => { const gap = days(end, yearEnd); return gap >= 330 && gap <= 400; }).sort().pop();
    return earlier ? found.byEnd.get(earlier)!.val : null;
  };
  // The first concept, in order, that the company reported for that very year.
  const at = (concept: Concept): number | null => {
    const unitWanted = concept === 'eps' || concept === 'dividendsPerShare'
      ? (unit: string) => perShareUnit(unit) && unit.startsWith(currency) : (unit: string) => unit === currency;
    for (const name of CONCEPTS[concept]) {
      const value = annualOf(facts, [name], OVER_A_YEAR.has(concept), unitWanted)?.byEnd.get(yearEnd)?.val;
      if (value !== undefined) return value;
    }
    return null;
  };
  return {
    cik: Number(facts.cik ?? 0),
    name: facts.entityName ?? '',
    currency,
    yearEnd,
    form: head.form ?? '',
    filed: head.filed ?? '',
    revenue: revenue?.byEnd.get(yearEnd)?.val ?? null,
    revenueBefore: before(revenue),
    netIncome: netIncome?.byEnd.get(yearEnd)?.val ?? null,
    netIncomeBefore: before(netIncome),
    grossProfit: at('grossProfit'),
    operatingIncome: at('operatingIncome'),
    assets: at('assets'),
    liabilities: at('liabilities'),
    equity: at('equity'),
    cash: at('cash'),
    debt: at('debt'),
    currentAssets: at('currentAssets'),
    currentLiabilities: at('currentLiabilities'),
    operatingCash: at('operatingCash'),
    capex: at('capex'),
    eps: at('eps'),
    dividendsPerShare: at('dividendsPerShare'),
    readAt,
  };
}

/** The ratios people read, worked out from the same year's figures. Percent where it is one. */
export interface CompanyRatios {
  revenueGrowth: number | null;
  profitGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  freeCash: number | null;
}

const share = (part: number | null, whole: number | null) => part === null || whole === null || whole === 0 ? null : part / whole * 100;
const growth = (now: number | null, before: number | null) => now === null || before === null || before <= 0 ? null : (now - before) / before * 100;

export function ratiosOf(c: Company): CompanyRatios {
  return {
    revenueGrowth: growth(c.revenue, c.revenueBefore),
    profitGrowth: growth(c.netIncome, c.netIncomeBefore),
    grossMargin: share(c.grossProfit, c.revenue),
    operatingMargin: share(c.operatingIncome, c.revenue),
    netMargin: share(c.netIncome, c.revenue),
    // Against a negative equity a return means nothing.
    roe: c.equity !== null && c.equity > 0 ? share(c.netIncome, c.equity) : null,
    debtToEquity: c.debt !== null && c.equity !== null && c.equity > 0 ? c.debt / c.equity : null,
    currentRatio: c.currentAssets !== null && c.currentLiabilities !== null && c.currentLiabilities > 0 ? c.currentAssets / c.currentLiabilities : null,
    // Without what was spent on equipment, the cash left free is not known.
    freeCash: c.operatingCash === null || c.capex === null ? null : c.operatingCash - c.capex,
  };
}

/** A company is read again once its next annual filing may be out: about a year after the one kept, checked monthly. */
export function companyStale(c: Company | null, today: string): boolean {
  if (c === null) return true;
  return days(c.readAt.slice(0, 10), today) >= 30 && days(c.yearEnd, today) >= 365;
}
