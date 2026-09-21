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
