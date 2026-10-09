// A showcase backup: every screen and every feature of the app with something
// in it, for demonstrations and for explaining what the app can do.
//
//   node --import ./tools/db/register-ts.mjs tools/db/showcase-data.mjs [folder]
//
// Asked for by Jose on 2026-10-02. Invented people and money, never his: it
// may be shown to anybody. Everything is written through the app's own
// repositories and worked out by its own engines, so each figure is one the
// app would really produce. Dated as of 2026-10-02: screens that read "this
// month" (caps, a card's statement, a loan's next installment) say most on
// the days right after it.
//
// What it holds, by screen:
//   - Inicio / Cuentas: debit, cash, credit, investment and loan accounts; a
//     group holding pesos and dollars; a euro account; one account outside
//     net worth; an archived card; an account and a category with their own
//     pictures; colours on accounts and categories.
//   - Every movement kind: spending, income, refunds on a card, transfers,
//     across currencies (with the rate the provider applied), a foreign
//     movement valued at the official rate, recurring charges and one charge
//     repeated twice in a month, notes that repeat (the usual note).
//   - Cards: a limit raised and later lowered; one card with a statement part
//     paid, another overdue; one archived.
//   - Products and yields: a withheld savings account with a typed product
//     and cashback (a product-only income, and a cash-in to net worth); a
//     rate cut; a spending bonus met some months and missed others; a dollar
//     account; a CDT; a product set aside from net worth; days checked
//     against the bank; a payment moved to the day the bank really paid and
//     one corrected; a product category of the person's own.
//   - Investments: a fund with gains, losses and a correction of the gain.
//   - Debts: a car loan disbursed into an account with installments paid and
//     a payment ahead; a loan started before the app with an overdue
//     installment and default interest; a UVR mortgage.
//   - Presupuestos: caps passed, close, fine and on one account; goals on
//     time, late, with no date, an emergency fund over every account, and one
//     reached and archived.
//   - Movimientos por revisar: a statement batch (learned and suggested
//     categories, a row that may be one already typed, a missing category)
//     and two bank notifications, one that could not be read.
//   - Simulador de renta: 2026 filled in.
//   - Bank notifications themselves are NOT here: Android keeps them outside
//     the database, so no backup carries them.
//
// Written into the folder given, or G:\My Drive\Finance App\Pruebas.
// What it writes is `buildShowcase` (src/app/core/demo/showcase.ts), the same
// sample data the app offers a new user, on the day it was first written.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NodeSqlDriver } from './node-sql-driver.mjs';
import { migrate } from '../../src/app/core/database/migrations/migration-runner.ts';
import { MIGRATION_SOURCES } from '../../src/app/core/database/migrations/statements.generated.ts';
import { exportBackup, toJson } from '../../src/app/core/database/export/export-backup.ts';
import { seedStarterCategories } from '../../src/app/core/database/starter-categories.ts';
import { buildShowcase } from '../../src/app/core/demo/showcase.ts';

const TODAY = '2026-10-02';
const NOW = () => `${TODAY}T09:00:00Z`;

const db = new NodeSqlDriver();
await migrate(db, MIGRATION_SOURCES);
await seedStarterCategories(db, 'es', NOW);
await buildShowcase(db, TODAY, undefined, NOW);

const folder = process.argv[2] ?? 'G:/My Drive/Finance App/Pruebas';
mkdirSync(folder, { recursive: true });
const name = 'finance-demostracion-completa.json';
const backup = await exportBackup(db);
writeFileSync(join(folder, name), toJson(backup));
const counts = Object.entries(backup.tables).filter(([, list]) => list.length > 0)
  .map(([table, list]) => `${table} ${list.length}`).join(', ');
console.log(`escrito en ${folder}:\n  ${name}\n  ${counts}`);
