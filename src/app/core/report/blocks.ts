/**
 * What an analysis of a period returns.
 *
 * The contract between the analyses and the things that show them. An analysis
 * returns a block of DATA - never HTML, never spreadsheet cells - and a screen
 * and the .xlsx writer each know how to read a block without knowing which
 * analyses exist. That is what makes a new analysis a function and one line in
 * a list, instead of an edit to three places.
 *
 * Two rules keep it that way:
 *
 *   - **A value carries its number, not its wording.** Money stays in minor
 *     units, a share stays a number. The screen formats it with the app's own
 *     money helper; the spreadsheet writes a real number Excel can add up and
 *     re-format. A block holding "$9.800.000" would be a dead end in both.
 *   - **The kinds are a small closed set**, each one designed properly. An
 *     analysis picks one. Adding a kind is a bigger change on purpose: it is
 *     what stops the report from reading like five apps glued together.
 */

import type { Flow } from '../../features/movements/group-movements';

/** How a figure reads: good news, bad news, or neither. Never colour alone. */
export type Tone = 'good' | 'bad' | 'warn' | 'plain';

/**
 * One value, with enough about it to be drawn or written but nothing about
 * how. `minor` is always minor units, the way the whole app holds money.
 */
export type Value =
  | { kind: 'money'; minor: number; currency: string }
  /** A share of something, 0 to 100. */
  | { kind: 'percent'; value: number }
  | { kind: 'count'; value: number }
  | { kind: 'text'; value: string }
  | { kind: 'date'; iso: string };

export const money = (minor: number, currency: string): Value => ({ kind: 'money', minor, currency });
export const percent = (value: number): Value => ({ kind: 'percent', value });
export const count = (value: number): Value => ({ kind: 'count', value });
export const text = (value: string): Value => ({ kind: 'text', value });
export const date = (iso: string): Value => ({ kind: 'date', iso });

/**
 * The headline numbers of the period: what came in, what went out, what is
 * left. A handful at most - past six they stop being headlines.
 */
export interface FiguresBlock {
  kind: 'figures';
  id: string;
  title: string;
  /** One line saying what the section shows and what it leaves out, under its title. */
  about?: string;
  figures: {
    label: string;
    value: Value;
    tone?: Tone;
    /** A second line under it: what it is measured against, or a caveat. */
    note?: string;
  }[];
}

/**
 * A list in order of size, each row with its share - the categories behind the
 * donut, the biggest movements, the accounts. `share` is what draws the bar.
 */
export interface RankedBlock {
  kind: 'ranked';
  id: string;
  title: string;
  /** One line saying what the section shows and what it leaves out, under its title. */
  about?: string;
  /** What the rows are, for the column header: "Categoría", "Cuenta". */
  rowsAre: string;
  /** What the count column counts, when it is not movements. */
  countsAre?: string;
  rows: {
    label: string;
    value: Value;
    /** 0 to 100. Absent where a share would mean nothing. */
    share?: number;
    /** How many movements are behind it. */
    behind?: number;
    /** A second line: what tells this row from the one under it. */
    note?: string;
    /** So the screen can draw the same icon the summary screen draws. */
    icon?: string | null;
    customIconId?: number | null;
    /** What the row means for the money, which is what colours it. */
    flow?: Flow;
    tone?: Tone;
  }[];
  totalLabel?: string;
  total?: Value;
}

/**
 * One period against another: before, now, and what changed. Built but not
 * yet used - the comparisons are the next piece of work, and the kind is here
 * so they do not arrive as a fourth shape invented on the spot.
 */
export interface ComparisonBlock {
  kind: 'comparison';
  id: string;
  title: string;
  /** One line saying what the section shows and what it leaves out, under its title. */
  about?: string;
  /** What the two columns are: "Agosto" and "Septiembre". */
  beforeLabel: string;
  nowLabel: string;
  /**
   * Set when the two are not the same length - this month so far against a
   * whole one. The report says so rather than printing a change that is a lie
   * to two decimals.
   */
  caveat?: string;
  rows: {
    label: string;
    /** So a category is recognised by its picture here too. */
    icon?: string | null;
    customIconId?: number | null;
    before: Value;
    now: Value;
    /** The change as a percentage. Null when there is nothing to divide by. */
    changePercent: number | null;
    /** Whether growth here is good news. Spending grows the wrong way. */
    growthIs: 'good' | 'bad';
    /** A second line under the name: what explains the change. */
    note?: string;
  }[];
}

/** The same figure over several periods: months of a year, days of a month. */
export interface TrendBlock {
  kind: 'trend';
  id: string;
  title: string;
  /** One line saying what the section shows and what it leaves out, under its title. */
  about?: string;
  points: {
    label: string;
    value: Value;
    /** How much of the value is of another kind - what was estimated - drawn lighter inside the bar. */
    part?: Value;
  }[];
  /** What `part` is, when a point carries one. */
  partLabel?: string;
  /** The line drawn across it, when there is one worth drawing. */
  averageLabel?: string;
  average?: Value;
  /** The points standing above that average, named rather than eyeballed. */
  aboveAverage?: readonly string[];
}

/** Something worth saying in words, with the figures inside the sentence. */
export interface NoteBlock {
  kind: 'note';
  id: string;
  title: string;
  /** One line saying what the section shows and what it leaves out, under its title. */
  about?: string;
  lines: { text: string; tone?: Tone }[];
}

export type Block = FiguresBlock | RankedBlock | ComparisonBlock | TrendBlock | NoteBlock;

/**
 * An analysis.
 *
 * Pure: the same data gives the same block, which is why these are tested by
 * the database test runner with no browser anywhere near them.
 *
 * **Null means it has nothing to say about this period**, and then it is
 * simply not in the report. "The biggest ten" over three movements is noise,
 * and a comparison with no earlier period is a table of zeroes. This is what
 * keeps a report that grows from filling up with empty sections.
 */
export type Section<Data> = (data: Data) => Block | null;
