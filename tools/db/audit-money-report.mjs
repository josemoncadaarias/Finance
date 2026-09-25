// An independent audit of the money summary (the "Movimientos" side of the
// report).
//
//   node --import ./tools/db/register-ts.mjs tools/db/audit-money-report.mjs <backup.json>
//
// Recomputes income, spending, refunds, what moved between accounts, the
// balance, the count, the daily averages, the biggest expense, spending by
// category, by account and by month, and the comparison with the period
// before - straight from the backup file, with the rules written down in
// CLAUDE.md and none of the app's code - and compares them with what the
// report's sections say, for every account alone and all of them together,
// over several periods. Written on 2026-09-24 when Jose asked for an
// assurance that every figure on the summary was right.
//
// The one piece of app code on the app's side is the movement list itself,
// built here exactly as `MovementsStore.movementsFor` builds it for the
// screen; the recomputation does not use it.

import { readFileSync } from 'node:fs';
import { NodeSqlDriver } from './node-sql-driver.mjs';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { restoreBackup, parseBackup } from '../../src/app/core/database/export/restore-backup.ts';
import { TransactionsRepository } from '../../src/app/core/database/repositories/transactions.repository.ts';
import { buildReport } from '../../src/app/core/report/sections.ts';
import { daysElapsed, equivalentBefore } from '../../src/app/core/report/report-data.ts';
import { flowOf } from '../../src/app/features/movements/group-movements.ts';
import { TEST_WORDS } from '../../src/app/core/report/report-words.ts';

const FILE = process.argv[2];
const TODAY = '2026-09-24';
const raw = JSON.parse(readFileSync(FILE, 'utf8')).tables;

// ---------- the app: the movement list as the store builds it, then the sections ----------
const db = new NodeSqlDriver();
await restoreBackup(db, parseBackup(readFileSync(FILE, 'utf8')), MIGRATION_SOURCES);
const accountsDb = await db.query('SELECT * FROM accounts');

function scopeOf(accountId) {
  if (accountId !== null) return [accountId];
  return accountsDb.filter(a => !a.archived && a.include_in_net_worth === 1).map(a => a.id);
}

async function appMovements(period, accountId) {
  const scope = scopeOf(accountId);
  const detailed = await new TransactionsRepository(db).listDetailed({
    accountIds: scope, from: period.from ?? undefined, to: period.to ?? undefined,
  });
  const inScope = new Set(scope);
  const visible = detailed.filter(row => {
    if (row.product_set_aside === 1) return false;
    return row.transfer_id === null || row.other_account_id === null
      || !inScope.has(row.other_account_id) || row.other_product_set_aside === 1;
  });
  return visible.map(row => ({
    transaction: row, accountName: row.account_name, accountType: row.account_type, currency: row.currency_code,
    label: row.transfer_id !== null ? `→ ${row.other_account_name ?? '?'}` : row.category_name ?? '?',
    icon: null, customIconId: null, flow: flowOf(row, row.account_type),
  }));
}

async function appReport(period, accountId) {
  const account = accountId === null ? null : accountsDb.find(a => a.id === accountId);
  const partial = {
    period, periodLabel: 'now', account, accounts: accountsDb,
    movements: await appMovements(period, accountId),
    basis: accountId === null ? 'base' : 'own',
    currency: account ? account.currency_code : 'COP',
    before: null, today: TODAY, locale: 'es-CO', words: TEST_WORDS,
  };
  const earlier = equivalentBefore(period, daysElapsed(partial).days);
  const data = earlier === null ? partial : {
    ...partial,
    before: { period: earlier, label: 'before', movements: await appMovements(earlier, accountId), clipped: !daysElapsed(partial).whole },
  };
  return { data, blocks: buildReport(data), earlier };
}

// ---------- independent recomputation from the raw file ----------
const products = new Map((raw.products ?? []).map(p => [p.id, p]));
const setAside = id => id !== null && id !== undefined && products.get(id)?.include_in_net_worth === 0;
const cats = new Map(raw.categories.map(c => [c.id, c]));
const accountOf = new Map(raw.accounts.map(a => [a.id, a]));
const legsOf = new Map();
for (const t of raw.transactions) if (t.transfer_id !== null) {
  if (!legsOf.has(t.transfer_id)) legsOf.set(t.transfer_id, []);
  legsOf.get(t.transfer_id).push(t);
}

function rawFigures(from, to, accountId) {
  const scope = new Set(accountId !== null ? [accountId]
    : raw.accounts.filter(a => !a.archived && a.include_in_net_worth === 1).map(a => a.id));
  const own = accountId !== null;
  let income = 0, out = 0, refund = 0, moved = 0, received = 0, count = 0, biggest = 0;
  const byCategory = new Map(), byAccount = new Map(), byMonth = new Map();
  for (const t of raw.transactions) {
    if (!scope.has(t.account_id)) continue;
    if (from !== null && t.occurred_on < from) continue;
    if (to !== null && t.occurred_on > to) continue;
    if (setAside(t.product_id)) continue;
    if (t.transfer_id !== null) {
      const other = legsOf.get(t.transfer_id).find(x => x.id !== t.id);
      if (other && scope.has(other.account_id) && !setAside(other.product_id)) continue;
    }
    count++;
    const amount = Math.abs(own ? t.amount_minor : t.amount_base_minor);
    const month = t.occurred_on.slice(0, 7);
    if (t.transfer_id !== null) { if (t.amount_minor < 0) moved += amount; else received += amount; continue; }
    if (t.amount_minor < 0) {
      out += amount;
      biggest = Math.max(biggest, amount);
      const c = cats.get(t.category_id)?.name ?? '?';
      byCategory.set(c, (byCategory.get(c) ?? 0) + amount);
      byAccount.set(t.account_id, (byAccount.get(t.account_id) ?? 0) + amount);
      byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
    } else if (accountOf.get(t.account_id).type === 'credit') {
      refund += amount;
      const c = cats.get(t.category_id)?.name ?? '?';
      byCategory.set(c, (byCategory.get(c) ?? 0) - amount);
      byAccount.set(t.account_id, (byAccount.get(t.account_id) ?? 0) - amount);
      byMonth.set(month, (byMonth.get(month) ?? 0) - amount);
    } else income += amount;
  }
  return { income, spent: out - refund, moved, received, count, biggest, byCategory, byAccount, byMonth };
}

// ---------- compare ----------
let bad = 0, checks = 0;
const same = (a, b, what, where) => {
  checks++;
  if (a !== b) { bad++; console.log(`XX ${what.padEnd(26)} ${where}: audit ${a} app ${b}`); }
};
const valueOf = (block, label) => block?.figures?.find(f => f.label === TEST_WORDS[label])?.value;

const periods = [
  { kind: 'month', from: '2026-09-01', to: '2026-09-30' }, { kind: 'month', from: '2026-08-01', to: '2026-08-31' },
  { kind: 'month', from: '2026-01-01', to: '2026-01-31' }, { kind: 'year', from: '2026-01-01', to: '2026-12-31' },
  { kind: 'year', from: '2025-01-01', to: '2025-12-31' }, { kind: 'day', from: '2026-09-24', to: '2026-09-24' },
  { kind: 'range', from: '2025-12-15', to: '2026-01-15' },
];
const ids = [null, ...raw.accounts.filter(a => !a.archived).map(a => a.id)];
for (const accountId of ids) for (const period of periods) {
  const where = `${accountId === null ? 'all' : accountOf.get(accountId).name} ${period.from}..${period.to}`;
  const { data, blocks, earlier } = await appReport(period, accountId);
  const r = rawFigures(period.from, period.to, accountId);
  const head = blocks.find(b => b.id === 'headline');
  if (!head) { same(r.count, 0, 'nothing to report', where); continue; }
  same(r.income, valueOf(head, 'report.headline.income').minor, 'income', where);
  same(r.spent, valueOf(head, 'report.headline.expenses').minor, 'spending', where);
  same(r.income - r.spent, valueOf(head, 'report.headline.balance').minor, 'balance', where);
  same(r.moved, valueOf(head, 'summary.moved')?.minor ?? 0, 'moved to own accounts', where);
  same(r.received, valueOf(head, 'summary.received')?.minor ?? 0, 'received from own accounts', where);
  same(r.count, valueOf(head, 'report.headline.movements').value, 'movements', where);
  same(r.biggest, valueOf(head, 'report.headline.biggest')?.minor ?? 0, 'biggest expense', where);
  const { days } = daysElapsed(data);
  if (days > 0 && r.spent > 0) same(Math.round(r.spent / days), valueOf(head, 'report.headline.perDay').minor, 'spent per day', where);

  // Categories: each spending category, as the screen labels it.
  const categories = blocks.find(b => b.id === 'categories');
  for (const [name, total] of r.byCategory) {
    if (total === 0) continue;
    const row = categories?.rows.find(one => one.label === name && one.flow === 'out');
    same(total, row?.value.minor ?? null, `category ${name}`, where);
  }
  same(r.spent + r.moved, categories?.total.minor ?? 0, 'categories total', where);

  // By account.
  const accounts = blocks.find(b => b.id === 'accounts');
  if (accounts) for (const [id, total] of r.byAccount) {
    same(total, accounts.rows.find(one => one.label === accountOf.get(id).name)?.value.minor ?? null, `account ${accountOf.get(id).name}`, where);
  }

  // By month.
  const months = blocks.find(b => b.id === 'by-month');
  if (months) for (const point of months.points) {
    const [name, year] = point.label.split(' ');
    const index = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      .indexOf(name.toLowerCase()) + 1;
    const key = `${year}-${String(index).padStart(2, '0')}`;
    same(r.byMonth.get(key) ?? 0, point.value.minor, `month ${key}`, where);
  }

  // Against the period before: the same figures over the same days.
  const versus = blocks.find(b => b.id === 'versus');
  if (earlier && versus) {
    const w = rawFigures(earlier.from, earlier.to, accountId);
    same(w.income, versus.rows[0].before.minor, 'before: income', where);
    same(w.spent, versus.rows[1].before.minor, 'before: spending', where);
    same(w.count, versus.rows[3].before.value, 'before: movements', where);
  }
}
console.log('checks', checks, bad === 0 ? 'all agree' : 'differences: ' + bad);
