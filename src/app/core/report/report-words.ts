/**
 * The report's words, resolved once and handed to the analyses.
 *
 * The analyses are pure functions, so they cannot reach for a service; and
 * they must not carry Spanish in their source, because the app is
 * multilingual and no user-facing string belongs in code. So the words are
 * looked up once, here, and travel inside `ReportData`.
 *
 * A test hands over `PLACEHOLDER_WORDS` and checks the figures, which is what
 * it is actually testing.
 */

import { SPANISH, type TranslationKey } from '../i18n/translations';

/** Every word the report says. Adding an analysis adds its labels here. */
export const REPORT_KEYS = [
  'report.title',
  'report.file',
  'report.sheet.summary',
  'report.sheet.movements',
  'report.period',
  'report.account',
  'report.allAccounts',
  'report.madeOn',
  'report.partial',

  'report.headline',
  'report.headline.income',
  'report.headline.expenses',
  'report.headline.balance',
  'report.headline.saved',
  'report.headline.savedNote',
  'report.headline.movements',
  // The two the summary screen shows beside income and spending, in its own
  // words: the report must not name the same thing differently.
  'summary.moved',
  'summary.received',
  'report.headline.perDay',
  'report.headline.perDayNote',
  'report.headline.biggest',
  'report.headline.topCategory',
  'report.headline.overspent',
  'report.headline.inPerDay',

  'report.versus',
  'report.versus.sameDays',
  'report.versus.categories',

  'report.byMonth',
  'report.byMonth.average',
  'report.byMonth.above',

  'report.recurring',
  'report.recurring.months',
  'report.recurring.each',
  'report.recurring.total',
  'report.recurring.what',

  'report.repeated',
  'report.repeated.row',
  'report.repeated.each',
  'report.repeated.total',

  'report.jump',
  'report.jump.grew',
  'report.jump.noNote',
  'report.jump.gone',

  'report.categories',
  'report.categories.row',
  'report.categories.total',

  'report.biggest',
  'report.biggest.row',

  'report.accounts',
  'report.accounts.row',

  'report.column.share',
  'report.column.amount',
  'report.column.count',
  'report.movement.date',
  'report.movement.account',
  'report.movement.category',
  'report.movement.note',
  'report.movement.amount',
  'report.movement.currency',
  'report.movement.inPesos',
  'report.movement.kind',
  'report.flow.in',
  'report.flow.out',
  'report.flow.moved',
  'report.flow.received',
  'report.flow.refund',

  // The yields summary (sections-yields.ts).
  'report.yields.title',
  'report.yields.file',
  'report.yields.sheet.days',
  'report.yields.days.base',
  'report.yields.days.rate',
  'report.yields.days.gross',
  'report.yields.nothing',
  'report.yields.allAccounts',
  'report.yields.headline',
  'report.yields.net',
  'report.yields.perDay',
  'report.yields.perDayNote',
  'report.yields.effective',
  'report.yields.effectiveNote',
  'report.yields.interest',
  'report.yields.interestNote',
  'report.yields.invested',
  'report.yields.investedNote',
  'report.yields.investedRateNote',
  'report.yields.growth',
  'report.yields.soFar',
  'report.yields.note.growth',
  'report.yields.inflation',
  'report.yields.inflation.real',
  'report.yields.inflation.ahead',
  'report.yields.inflation.behind',
  'report.yields.inflation.rate',
  'report.yields.inflation.published',
  'report.yields.inflation.estimated',
  'report.yields.inflation.took',
  'report.yields.inflation.tookNote',
  'report.yields.inflation.kept',
  'report.yields.inflation.keptNote',
  'report.yields.withheld',
  'report.yields.withheldNote',
  'report.yields.byAccount',
  'report.yields.byProduct',
  'report.yields.rows.accounts',
  'report.yields.rows.products',
  'report.yields.rateNote',
  'report.yields.byMonth',
  'report.yields.byMonth.average',
  'report.yields.versusBefore',
  'report.yields.sameDays',
  'report.yields.bank.computed',
  'report.yields.bank.paid',
  'report.yields.notes',
  'report.yields.note.projection',
  'report.yields.note.pending',
  'report.yields.note.withheldDays',
  'report.yields.note.bestRate',
  'report.yields.note.noRate',
  'report.yields.open',
] as const satisfies readonly TranslationKey[];

export type ReportWordKey = (typeof REPORT_KEYS)[number];
export type ReportWords = Record<ReportWordKey, string>;

/** Builds them from whatever the app uses to translate. */
export function reportWords(translate: (key: ReportWordKey) => string): ReportWords {
  const words = {} as ReportWords;
  for (const key of REPORT_KEYS) words[key] = translate(key);
  return words;
}

/**
 * The words a test runs with: the real Spanish ones.
 *
 * Not the keys themselves, which was the first idea. A phrase carries
 * `{placeholders}` that the analyses fill in, and keys have none - so a test
 * could not tell a figure that was substituted from one that was silently
 * dropped. Running on the real phrases also means a placeholder renamed in
 * the dictionary and not in the code fails here, which is exactly where it
 * should fail.
 *
 * The tests still never assert the wording, only what was put into it, so
 * improving a phrase breaks nothing.
 */
export const TEST_WORDS: ReportWords = reportWords(key => SPANISH[key]);

/**
 * `{placeholders}` in a phrase that already came out of the dictionary.
 *
 * Here rather than beside the analyses: they are split across two files now,
 * and having one import it from the other made a cycle - the list of analyses
 * ran before the file holding half of them had finished loading.
 */
export function fill(phrase: string, values: Record<string, string | number>): string {
  return phrase.replace(/\{(\w+)\}/g, (whole, name: string) =>
    (name in values ? String(values[name]) : whole));
}
