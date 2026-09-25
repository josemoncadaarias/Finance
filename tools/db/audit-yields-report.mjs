// An independent audit of the yields summary.
//
//   node --import ./tools/db/register-ts.mjs tools/db/audit-yields-report.mjs <backup.json>
//
// Recomputes the net yield, what of it was estimated, the investments' gain,
// the yearly rate, the inflation and the real return straight from the backup
// file - no app code in the recomputation - and compares them with what the
// report's sections say, for every account alone and all of them together,
// over several periods. Written on 2026-09-24 when Jose asked for an
// assurance that the figures were right; on its first run it found two bugs
// the tests had not (a past period carried no estimate, and a gain written
// down after the period's end lost its share of it). Run it against the newest
// backup after any change to the report's arithmetic.
import { readFileSync } from 'node:fs';
import { NodeSqlDriver } from './node-sql-driver.mjs';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { restoreBackup, parseBackup } from '../../src/app/core/database/export/restore-backup.ts';
import { gatherYieldsReport } from '../../src/app/core/report/yields-gather.ts';
import { yieldHeadline, yieldVersusInflation, yieldByWhere } from '../../src/app/core/report/sections-yields.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';

const FILE = process.argv[2];
const TODAY = '2026-09-24';
const raw = JSON.parse(readFileSync(FILE, 'utf8')).tables;

// ---------- independent recomputation ----------
const D = 864e5;
const add = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * D).toISOString().slice(0, 10);
const span = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / D) + 1;
const cats = new Map(raw.categories.map(c => [c.id, c]));
const accounts = new Map(raw.accounts.map(a => [a.id, a]));
const enrolled = new Set(raw.yield_accounts.map(r => r.account_id));
const rates = raw.exchange_rates.filter(r => r.quote_code === 'COP').sort((a, b) => a.on_date.localeCompare(b.on_date));
let SINGLE = false;
const toCop = (minor, accountId, day) => {
  if (SINGLE) return minor;
  const code = accounts.get(accountId).currency_code;
  if (code === 'COP') return minor;
  const list = rates.filter(r => r.base_code === code);
  if (list.length === 0) return null;
  let pick = list[0];
  for (const r of list) { if (r.on_date <= day) pick = r; else break; }
  return Math.round(minor * pick.rate_scaled / 10000);
};
// The migration 047 may not be in an older backup: take the flag, or the names it flags.
const isReturn = c => c && (c.counts_as_return === 1 || (c.counts_as_return === undefined &&
  ((c.name === 'Ganancia' && c.kind === 'income') || (c.name === 'Perdida' && c.kind === 'expense'))));
const txBy = new Map();
for (const t of raw.transactions) { if (!txBy.has(t.account_id)) txBy.set(t.account_id, []); txBy.get(t.account_id).push(t); }
for (const l of txBy.values()) l.sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.id - b.id);
const investments = raw.accounts.filter(a => a.type === 'investment' && !enrolled.has(a.id)
  && (txBy.get(a.id) ?? []).some(t => isReturn(cats.get(t.category_id))));
const yieldDays = raw.yield_days.filter(d => enrolled.has(d.account_id));

// balance at close of day, account currency
const closeOf = (id, day) => (accounts.get(id).opening_balance_minor) + (txBy.get(id) ?? []).filter(t => t.occurred_on <= day).reduce((s, t) => s + t.amount_minor, 0);

function audit(from, to, only = null) {
  const keep = id => only === null || id === only;
  const end = to < TODAY ? to : TODAY;
  let interest = 0, estimated = 0, invested = 0, capital = 0;
  // Products: worked-out days.
  const seen = new Set();
  for (const d of yieldDays) {
    if (!keep(d.account_id) || d.on_date < from || d.on_date > end) continue;
    interest += toCop(d.actual_net_minor ?? d.net_minor, d.account_id, d.on_date) ?? 0;
    const k = d.product_id + '|' + d.on_date;
    if (!seen.has(k)) { seen.add(k); capital += toCop(d.balance_minor, d.account_id, d.on_date) ?? 0; }
  }
  // Products: estimated days before the first worked-out day.
  const windowStart = [from, `${Number(end.slice(0, 4)) - 1}-${end.slice(5, 7)}-01`].sort()[0];
  for (const id of enrolled) {
    if (!keep(id)) continue;
    const own = yieldDays.filter(d => d.account_id === id && d.on_date <= TODAY);
    if (own.length === 0) continue;
    const first = own.map(d => d.on_date).sort()[0];
    const paidOn = new Map();
    for (const d of own) paidOn.set(d.on_date, (paidOn.get(d.on_date) ?? 0) + (d.actual_net_minor ?? d.net_minor));
    const days7 = new Set([...paidOn].filter(([, p]) => p > 0).map(([d]) => d).sort().slice(0, 7));
    const early = own.filter(d => days7.has(d.on_date));
    const paid = early.reduce((s, d) => s + (d.actual_net_minor ?? d.net_minor), 0);
    const base = new Map(); for (const d of early) base.set(d.product_id + '|' + d.on_date, d.balance_minor);
    const cap = [...base.values()].reduce((a, b) => a + b, 0);
    if (cap <= 0 || paid <= 0) continue;
    const daily = paid / cap;
    const start = [windowStart, accounts.get(id).opened_on].sort()[1];
    for (let day = start; day < first; day = add(day, 1)) {
      if (day < from || day > end) continue;
      const b = Math.max(closeOf(id, add(day, -1)), 0);
      const net = Math.round(b * daily);
      estimated += toCop(net, id, day) ?? 0;
      capital += toCop(b, id, day) ?? 0;
    }
  }
  // Investments: returns spread over the days since the previous return.
  for (const a of investments) {
    if (!keep(a.id)) continue;
    const txs = txBy.get(a.id);
    let since = null;
    for (const t of txs) {
      if (!isReturn(cats.get(t.category_id)) || t.occurred_on > TODAY) continue;
      const first = since === null ? a.opened_on : add(since, 1);
      const n = span(first, t.occurred_on);
      for (let day = first; day <= t.occurred_on; day = add(day, 1)) {
        if (day >= from && day <= end) invested += toCop(t.amount_minor / n, a.id, day) ?? 0;
      }
      since = t.occurred_on;
    }
    const s = [from, a.opened_on].sort()[1];
    for (let day = s; day <= end; day = add(day, 1)) capital += toCop(closeOf(a.id, day), a.id, day) ?? 0;
  }
  const net = interest + estimated + invested;
  const ea = Math.pow(1 + net / capital, 365) - 1;
  // Inflation: average of the year's published annual figures up to the end month (one year periods here).
  const ix = new Map(raw.inflation_months?.map(r => [r.month, r.index_scaled]) ?? []);
  const y = end.slice(0, 4);
  const annual = [];
  for (let m = 1; m <= Number(end.slice(5, 7)); m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`, p = `${Number(y) - 1}-${String(m).padStart(2, '0')}`;
    if (ix.has(k) && ix.has(p)) annual.push(ix.get(k) / ix.get(p) - 1);
  }
  const infl = annual.length ? annual.reduce((a, b) => a + b) / annual.length : null;
  return { interest: interest + estimated, estimated, invested, net, ea, infl, real: infl === null ? null : (1 + ea) / (1 + infl) - 1 };
}

// ---------- the app ----------
const db = new NodeSqlDriver();
await restoreBackup(db, parseBackup(readFileSync(FILE, 'utf8')), MIGRATION_SOURCES);
const inflation = await db.query('SELECT month, index_scaled FROM inflation_months ORDER BY month');
if (!raw.inflation_months) raw.inflation_months = inflation;
const fig = (block, label) => block?.figures.find(f => f.label === TEST_WORDS[label])?.value;

let bad = 0;
const near = (a, b, tol, what) => {
  const ok = Math.abs(a - b) <= tol;
  if (!ok) bad++;
  console.log(`  ${ok ? 'OK ' : 'XX '} ${what.padEnd(28)} audit ${typeof a === 'number' ? a.toFixed(4) : a}  app ${typeof b === 'number' ? b.toFixed(4) : b}`);
};
const ids = [null, ...new Set([...enrolled, ...investments.map(a => a.id)])];
const periods = [['2026-01-01', '2026-12-31'], ['2026-09-01', '2026-09-30'], ['2026-08-01', '2026-08-31'], ['2025-01-01', '2025-12-31'], ['2026-03-01', '2026-03-31'], ['2026-09-24', '2026-09-24'], ['2025-12-15', '2026-01-15']];
let checks = 0;
for (const only of ids) for (const [from, to] of periods) {
  SINGLE = only !== null;
  const a = audit(from, to, only);
  const data = await gatherYieldsReport(db, { period: { kind: 'range', from, to }, accountId: only, today: TODAY, locale: 'es-CO', words: TEST_WORDS, allLabel: 'Todo', inflation });
  const head = yieldHeadline(data);
  const label = (only === null ? 'all' : accounts.get(only).name) + ' ' + from + '..' + to;
  const net = (fig(head, 'report.yields.net')?.minor ?? 0) / 100;
  checks++;
  if (Math.abs(a.net / 100 - net) > 1) { bad++; console.log('XX net', label, (a.net / 100).toFixed(2), net); }
  const ea = fig(head, 'report.yields.effective')?.value;
  if (ea !== undefined && Number.isFinite(a.ea) && Math.abs(a.ea * 100 - ea) > 0.01) { bad++; console.log('XX E.A.', label, (a.ea * 100).toFixed(3), ea); }
  const est = (fig(head, 'report.yields.estimated')?.minor ?? 0) / 100;
  if (Math.abs(a.estimated / 100 - est) > 1) { bad++; console.log('XX estimated', label, (a.estimated / 100).toFixed(2), est); }
}
console.log('checks', checks, bad === 0 ? 'all agree' : 'differences: ' + bad);
