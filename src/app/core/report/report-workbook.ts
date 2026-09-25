/**
 * The report as a spreadsheet: one sheet of what it adds up to, one of every
 * movement behind it.
 *
 * This is one of the two readers of a block, and it knows which KINDS of block
 * exist - not which analyses do. A new analysis writes itself out here for
 * free; a new kind of block is the rarer, deliberate change.
 *
 * Money is written as a real number with a currency format, never as text.
 * The whole point of handing someone a spreadsheet instead of a picture is
 * that they can sort it, filter it and add it up themselves, and a column of
 * text does none of that.
 */

import {
  writeXlsx, type CellStyle, type ChartSpec, type SheetCell, type SheetSpec,
} from '../xlsx/xlsx-writer';
import type { Movement } from '../../features/movements/group-movements';
import { type Block, type Value } from './blocks';
import { buildReport } from './sections';
import { fill } from './report-words';
import { daysElapsed, daysBetween, type ReportData } from './report-data';
import { paidOf, type YieldsReportData } from './yields-data';

/**
 * The palette.
 *
 * The app's own colours, so the file looks like where it came from: money in
 * is the summary screen's green, money out its red. Greys do the structure, so
 * that colour only ever means something.
 */
const INK = '1F2933';
const QUIET = '6B7785';
const HEAD = 'F5F7FA';
const IN = '2DA160';
const OUT = 'D94141';

/** Two decimals and thousands, the way the app shows money. */
const MONEY_FORMAT = '#,##0.00';

const STYLES: Record<string, CellStyle> = {
  title: { font: { bold: true, size: 16, color: INK } },
  subtitle: { font: { size: 10, color: QUIET } },
  caveat: { font: { size: 10, italic: true, color: OUT } },

  section: { font: { bold: true, size: 12, color: INK } },

  head: {
    font: { bold: true, size: 10, color: INK },
    fill: HEAD,
    border: true,
    align: { vertical: 'center', wrap: true },
  },
  headRight: {
    font: { bold: true, size: 10, color: INK },
    fill: HEAD,
    border: true,
    align: { horizontal: 'right', vertical: 'center', wrap: true },
  },

  label: { font: { size: 10, color: INK }, border: true },
  quiet: { font: { size: 10, color: QUIET }, border: true },
  note: { font: { size: 9, color: QUIET } },

  money: { font: { size: 10, color: INK }, border: true, numberFormat: MONEY_FORMAT },
  moneyIn: { font: { size: 10, color: IN }, border: true, numberFormat: MONEY_FORMAT },
  moneyOut: { font: { size: 10, color: OUT }, border: true, numberFormat: MONEY_FORMAT },
  share: { font: { size: 10, color: QUIET }, border: true, numberFormat: '0%' },
  number: { font: { size: 10, color: INK }, border: true, numberFormat: '#,##0' },
  day: { font: { size: 10, color: INK }, border: true, numberFormat: 'yyyy-mm-dd' },
  rate: { font: { size: 10, color: QUIET }, border: true, numberFormat: '0.00%' },

  figure: { font: { bold: true, size: 11, color: INK }, numberFormat: MONEY_FORMAT },
  figureIn: { font: { bold: true, size: 11, color: IN }, numberFormat: MONEY_FORMAT },
  figureOut: { font: { bold: true, size: 11, color: OUT }, numberFormat: MONEY_FORMAT },
  figurePercent: { font: { bold: true, size: 11, color: INK }, numberFormat: '0.0%' },
  figureCount: { font: { bold: true, size: 11, color: INK }, numberFormat: '#,##0' },
  figureText: { font: { bold: true, size: 11, color: INK } },

  totalLabel: { font: { bold: true, size: 10, color: INK }, fill: HEAD, border: true },
  total: { font: { bold: true, size: 10, color: INK }, fill: HEAD, border: true, numberFormat: MONEY_FORMAT },
};

/** A sheet being written, which is a cursor and a list of cells. */
class Sheet {
  readonly cells: SheetCell[] = [];
  readonly merges: string[] = [];
  /** Charts collected as the sheet is written, since only then are the
      ranges they read known. */
  readonly charts: ChartSpec[] = [];
  row = 1;

  put(col: number, style: string, content?: SheetCell['content']): void {
    this.cells.push({ row: this.row, col, style, content });
  }

  text(col: number, style: string, value: string): void {
    this.put(col, style, { text: value });
  }

  number(col: number, style: string, value: number): void {
    this.put(col, style, { number: value });
  }

  blank(): void {
    this.row += 1;
  }
}

/** Minor units as the decimal figure a spreadsheet should hold. */
function asNumber(value: Value): number | null {
  if (value.kind === 'money') return value.minor / 100;
  // Excel's percent format multiplies by 100 itself, so 42% is stored as 0.42.
  if (value.kind === 'percent') return value.value / 100;
  if (value.kind === 'count') return value.value;
  return null;
}

/**
 * The longest unbroken run of consecutive rows in a list of row numbers.
 *
 * A chart reads a RANGE, so the rows it draws have to be next to each other.
 * Anything outside the run is left out rather than dragged in by a range that
 * happens to span it.
 */
function longestRun(rows: readonly number[]): number[] {
  let best: number[] = [];
  let current: number[] = [];

  for (const row of rows) {
    if (current.length > 0 && row !== current[current.length - 1] + 1) current = [];
    current.push(row);
    if (current.length > best.length) best = [...current];
  }

  return best;
}

/** Which money style a value wears, by what it means. */
function moneyStyle(minor: number, flow?: string): string {
  if (flow === 'in' || flow === 'received') return 'moneyIn';
  if (flow === 'out' || flow === 'moved' || flow === 'refund') return 'moneyOut';
  return minor < 0 ? 'moneyOut' : 'money';
}

// ---------------------------------------------------------------------------
// The summary sheet
// ---------------------------------------------------------------------------

/** A section's title, and under it the line saying what it shows, when it has one. */
function sectionHead(sheet: Sheet, block: Block): void {
  sheet.text(0, 'section', block.title);
  if (block.about) {
    sheet.row += 1;
    sheet.text(0, 'subtitle', block.about);
  }
}

function writeFigures(sheet: Sheet, block: Extract<Block, { kind: 'figures' }>): void {
  sectionHead(sheet, block);
  sheet.row += 2;

  for (const figure of block.figures) {
    sheet.text(0, 'label', figure.label);

    const number = asNumber(figure.value);
    if (number === null) {
      sheet.text(2, 'figureText', figure.value.kind === 'text' ? figure.value.value : '');
    } else if (figure.value.kind === 'percent') {
      sheet.number(2, 'figurePercent', number);
    } else if (figure.value.kind === 'count') {
      sheet.number(2, 'figureCount', number);
    } else {
      sheet.number(2, figure.tone === 'good' ? 'figureIn' : figure.tone === 'bad' ? 'figureOut' : 'figure', number);
    }

    if (figure.note) sheet.text(3, 'note', figure.note);
    sheet.row += 1;
  }

  sheet.blank();
}

function writeRanked(sheet: Sheet, block: Extract<Block, { kind: 'ranked' }>, words: ReportData['words']): void {
  sectionHead(sheet, block);
  sheet.row += 2;

  sheet.text(0, 'head', block.rowsAre);
  sheet.text(1, 'headRight', words['report.column.amount']);
  sheet.text(2, 'headRight', words['report.column.share']);
  // Recurring spending counts months, not movements: the column says which.
  sheet.text(3, 'headRight', block.countsAre ?? words['report.column.count']);
  sheet.row += 1;

  /*
   * Which rows a chart may read.
   *
   * Not simply "the first eight". A categories block lists what came IN
   * first, and those rows carry no share of the spending - a doughnut drawn
   * over the top of the list would have been four slices of salary and one
   * of the groceries. Only the run of rows that are shares of one thing can
   * be drawn, and that run is found rather than assumed.
   */
  const shared: number[] = [];

  for (const row of block.rows) {
    sheet.text(0, 'label', row.note ? `${row.label} — ${row.note}` : row.label);

    const number = asNumber(row.value);
    if (number !== null && row.value.kind === 'money') {
      sheet.number(1, moneyStyle(row.value.minor, row.flow), number);
      if ((row.share ?? 0) > 0) shared.push(sheet.row);
    }

    // A share that is absent is left EMPTY, not written as zero: income has no
    // share of what was spent, and a 0% would read as "this was nothing".
    if (row.share !== undefined) sheet.number(2, 'share', row.share / 100);
    if (row.behind !== undefined) sheet.number(3, 'number', row.behind);
    sheet.row += 1;
  }

  /*
   * A ring of those shares, beside the list.
   *
   * Only where there are enough of them to have a shape: a doughnut of two
   * slices says less than the two figures beside it, and one of forty is a
   * colour wheel. Eight at most, and they are the largest eight because the
   * rows arrive in order of size.
   */
  const run = longestRun(shared);
  if (run.length >= 3) {
    const from = run[0];
    const to = run[Math.min(run.length, 8) - 1];
    sheet.charts.push({
      kind: 'doughnut',
      title: block.title,
      categories: { col: 0, fromRow: from, toRow: to },
      series: [{ name: block.title, col: 1 }],
      at: { col: 5, row: from - 1, width: 6, height: Math.max(to - from + 2, 12) },
    });
  }

  if (block.total && block.totalLabel) {
    sheet.text(0, 'totalLabel', block.totalLabel);
    const number = asNumber(block.total);
    if (number !== null) sheet.number(1, 'total', number);
    sheet.put(2, 'totalLabel');
    sheet.put(3, 'totalLabel');
    sheet.row += 1;
  }

  sheet.blank();
}

function writeComparison(sheet: Sheet, block: Extract<Block, { kind: 'comparison' }>): void {
  sectionHead(sheet, block);
  sheet.row += 1;
  if (block.caveat) {
    sheet.text(0, 'caveat', block.caveat);
    sheet.row += 1;
  }
  sheet.row += 1;

  sheet.text(0, 'head', '');
  sheet.text(1, 'headRight', block.beforeLabel);
  sheet.text(2, 'headRight', block.nowLabel);
  sheet.text(3, 'headRight', '%');
  sheet.row += 1;

  const moneyRows: number[] = [];
  for (const row of block.rows) {
    sheet.text(0, 'label', row.label);
    if (row.before.kind === 'money' && row.now.kind === 'money') moneyRows.push(sheet.row);
    for (const [col, value] of [[1, row.before], [2, row.now]] as const) {
      const number = asNumber(value);
      if (number !== null) sheet.number(col, 'money', number);
    }
    if (row.changePercent !== null) {
      const worse = row.growthIs === 'bad' ? row.changePercent > 0 : row.changePercent < 0;
      sheet.number(3, worse ? 'moneyOut' : 'moneyIn', row.changePercent / 100);
    }
    // The line that explains the row, beside it: a row of its own would break
    // the run of figures the chart reads.
    if (row.note) sheet.text(4, 'quiet', row.note);
    sheet.row += 1;
  }

  /*
   * The two stretches as paired columns - which is what a pair of bars is for.
   *
   * Only the rows that are money. The comparison ends with a count of
   * movements, and 1,145 of them drawn on an axis that reaches a hundred
   * million is a bar nobody can see, on a chart that now has two meanings.
   */
  const money = longestRun(moneyRows);
  if (money.length >= 2) {
    const from = money[0];
    const to = money[money.length - 1];
    sheet.charts.push({
      kind: 'bar',
      title: block.title,
      categories: { col: 0, fromRow: from, toRow: to },
      series: [
        { name: block.beforeLabel, col: 1 },
        { name: block.nowLabel, col: 2 },
      ],
      at: { col: 5, row: from - 1, width: 8, height: Math.max(money.length + 2, 14) },
    });
  }

  sheet.blank();
}

function writeTrend(sheet: Sheet, block: Extract<Block, { kind: 'trend' }>, words: ReportData['words']): void {
  sectionHead(sheet, block);
  sheet.row += 2;

  // What of each figure was estimated, in a column of its own and named.
  if (block.partLabel) {
    sheet.text(2, 'headRight', block.partLabel);
    sheet.row += 1;
  }
  const firstRow = sheet.row;
  for (const point of block.points) {
    sheet.text(0, 'label', point.label);
    const number = asNumber(point.value);
    if (number !== null) sheet.number(1, 'money', number);
    const part = point.part ? asNumber(point.part) : null;
    if (part !== null) sheet.number(2, 'money', part);
    sheet.row += 1;
  }

  // Months side by side, which is the whole reason for reading them together.
  if (block.points.length >= 2) {
    sheet.charts.push({
      kind: 'bar',
      title: block.title,
      categories: { col: 0, fromRow: firstRow, toRow: sheet.row - 1 },
      series: [{ name: block.title, col: 1 }],
      at: { col: 5, row: firstRow - 1, width: 8, height: Math.max(block.points.length + 2, 14) },
    });
  }

  if (block.average && block.averageLabel) {
    sheet.text(0, 'totalLabel', block.averageLabel);
    const number = asNumber(block.average);
    if (number !== null) sheet.number(1, 'total', number);
    sheet.row += 1;
  }

  // Which of them stand above that line, named rather than left to be found
  // by running an eye down a column of figures.
  if (block.aboveAverage && block.aboveAverage.length > 0) {
    sheet.text(0, 'note', fill(words['report.byMonth.above'], {
      months: block.aboveAverage.join(', '),
    }));
    sheet.row += 1;
  }

  sheet.blank();
}

function writeNote(sheet: Sheet, block: Extract<Block, { kind: 'note' }>): void {
  sectionHead(sheet, block);
  sheet.row += 2;

  for (const line of block.lines) {
    sheet.text(0, line.tone === 'bad' || line.tone === 'warn' ? 'caveat' : 'subtitle', line.text);
    sheet.row += 1;
  }

  sheet.blank();
}

function summarySheet(data: ReportData, blocks: readonly Block[]): SheetSpec {
  const words = data.words;
  const sheet = new Sheet();

  sheet.text(0, 'title', words['report.title']);
  sheet.row += 1;
  sheet.text(0, 'subtitle', `${words['report.period']}: ${data.periodLabel}`);
  sheet.row += 1;
  sheet.text(0, 'subtitle',
    `${words['report.account']}: ${data.account?.name ?? words['report.allAccounts']}`);
  sheet.row += 1;
  sheet.text(0, 'subtitle', fill(words['report.madeOn'], { date: data.today }));
  sheet.row += 1;

  // A period still running is said so once, at the top, where it colours
  // everything read below it.
  const { days, whole } = daysElapsed(data);
  if (!whole && data.period.from && data.period.to) {
    sheet.text(0, 'caveat', fill(words['report.partial'], {
      days,
      total: daysBetween(data.period.from, data.period.to),
    }));
    sheet.row += 1;
  }
  sheet.blank();

  for (const block of blocks) {
    if (block.kind === 'figures') writeFigures(sheet, block);
    else if (block.kind === 'ranked') writeRanked(sheet, block, words);
    else if (block.kind === 'comparison') writeComparison(sheet, block);
    else if (block.kind === 'trend') writeTrend(sheet, block, words);
    else writeNote(sheet, block);
  }

  return {
    name: words['report.sheet.summary'],
    // Room to the right of the figures for the charts to sit in.
    columnWidths: [42, 16, 13, 13, 4, 12, 12, 12, 12, 12, 12, 12, 12],
    cells: sheet.cells,
    merges: sheet.merges,
    charts: sheet.charts,
  };
}

// ---------------------------------------------------------------------------
// The movements sheet
// ---------------------------------------------------------------------------

/**
 * Every movement behind the figures.
 *
 * Not an analysis - it is the evidence, and the reason the file is worth more
 * than a screenshot: the user can sort it, filter it and check any figure on
 * the first sheet against the rows that made it.
 *
 * Both amounts are there when they differ. A dollar account's row says 30.00
 * USD and 126,450.00 pesos, at the rate of its own day, so nothing has to be
 * taken on trust.
 */
function movementsSheet(data: ReportData, movements: readonly Movement[]): SheetSpec {
  const words = data.words;
  const sheet = new Sheet();

  const headings = [
    words['report.movement.date'],
    words['report.movement.account'],
    words['report.movement.category'],
    words['report.movement.note'],
    words['report.movement.kind'],
    words['report.movement.amount'],
    words['report.movement.currency'],
    words['report.movement.inPesos'],
  ];
  headings.forEach((heading, col) => sheet.text(col, col >= 5 ? 'headRight' : 'head', heading));
  sheet.row += 1;

  const flowWord: Record<string, string> = {
    in: words['report.flow.in'],
    out: words['report.flow.out'],
    moved: words['report.flow.moved'],
    received: words['report.flow.received'],
    refund: words['report.flow.refund'],
  };

  const newestFirst = [...movements].sort((a, b) =>
    (a.transaction.occurred_on < b.transaction.occurred_on ? 1 : -1));

  for (const movement of newestFirst) {
    const row = movement.transaction;
    sheet.text(0, 'day', row.occurred_on);
    sheet.text(1, 'label', movement.accountName);
    sheet.text(2, 'label', movement.label);
    sheet.text(3, 'quiet', row.description ?? '');
    sheet.text(4, 'quiet', flowWord[movement.flow] ?? movement.flow);

    // Signed as the ledger holds it, so the column adds up to the period.
    sheet.number(5, moneyStyle(row.amount_minor, movement.flow), row.amount_minor / 100);
    sheet.text(6, 'quiet', movement.currency);
    sheet.number(7, moneyStyle(row.amount_base_minor, movement.flow), row.amount_base_minor / 100);
    sheet.row += 1;
  }

  return {
    name: words['report.sheet.movements'],
    columnWidths: [12, 20, 22, 34, 16, 15, 9, 16],
    cells: sheet.cells,
    // The headings stay in view: this sheet is thousands of rows long, and a
    // column of figures with no heading is a column nobody can read.
    frozenRows: 1,
  };
}

// ---------------------------------------------------------------------------

/** The whole file. */
export function reportWorkbook(data: ReportData): Uint8Array<ArrayBuffer> {
  const blocks = buildReport(data);
  return writeXlsx([summarySheet(data, blocks), movementsSheet(data, data.movements)], STYLES);
}

/** The file's name, with the period in it so two of them never collide. */
export function reportFileName(data: ReportData): string {
  const period = (data.period.from && data.period.to)
    ? `${data.period.from}_${data.period.to}`
    : 'todo';
  return fill(data.words['report.file'], { period });
}

// ---------------------------------------------------------------------------
// The yields summary
// ---------------------------------------------------------------------------

/**
 * The yields summary's file: the same first sheet the money summary writes -
 * the same blocks, drawn by the same writers, charts included - and, as the
 * evidence behind it, every day that was worked out.
 */
export function yieldsWorkbook(data: YieldsReportData, blocks: readonly Block[]): Uint8Array<ArrayBuffer> {
  const words = data.words;
  const sheet = new Sheet();

  sheet.text(0, 'title', words['report.yields.title']);
  sheet.row += 1;
  sheet.text(0, 'subtitle', `${words['report.period']}: ${data.periodLabel}`);
  sheet.row += 1;
  sheet.text(0, 'subtitle',
    `${words['report.account']}: ${data.account?.name ?? words['report.yields.allAccounts']}`);
  sheet.row += 1;
  sheet.text(0, 'subtitle', fill(words['report.madeOn'], { date: data.today }));
  sheet.row += 1;
  sheet.blank();

  for (const block of blocks) {
    if (block.kind === 'figures') writeFigures(sheet, block);
    else if (block.kind === 'ranked') writeRanked(sheet, block, words);
    else if (block.kind === 'comparison') writeComparison(sheet, block);
    else if (block.kind === 'trend') writeTrend(sheet, block, words);
    else writeNote(sheet, block);
  }

  const summary: SheetSpec = {
    name: words['report.sheet.summary'],
    columnWidths: [42, 16, 13, 13, 4, 12, 12, 12, 12, 12, 12, 12, 12],
    cells: sheet.cells,
    merges: sheet.merges,
    charts: sheet.charts,
  };
  return writeXlsx([summary, yieldDaysSheet(data)], STYLES);
}

/**
 * Every day of the period, one row per product and part of its rate: what it
 * earned on, at what rate, gross, withheld, net, and what the bank paid where
 * Jose typed it in. The figures on the first sheet can all be checked here.
 */
function yieldDaysSheet(data: YieldsReportData): SheetSpec {
  const words = data.words;
  const sheet = new Sheet();
  const inPeriod = (day: string) =>
    (data.period.from === null || day >= data.period.from)
    && (data.period.to === null || day <= data.period.to) && day <= data.today;

  const headings = [
    words['report.movement.date'],
    words['report.movement.account'],
    words['report.yields.rows.products'],
    words['report.yields.days.base'],
    words['report.yields.days.rate'],
    words['report.yields.days.gross'],
    words['report.yields.withheld'],
    words['report.yields.bank.computed'],
    words['report.yields.bank.paid'],
    words['report.movement.currency'],
  ];
  headings.forEach((heading, col) => sheet.text(col, col >= 3 && col <= 8 ? 'headRight' : 'head', heading));
  sheet.row += 1;

  const accountOf = new Map(data.accounts.map(one => [one.id, one]));
  const productOf = new Map(data.products.map(one => [one.id, one.name]));
  const newestFirst = data.days.filter(day => inPeriod(day.on_date))
    .sort((a, b) => (a.on_date < b.on_date ? 1 : a.on_date > b.on_date ? -1 : a.product_id - b.product_id));

  for (const day of newestFirst) {
    sheet.text(0, 'day', day.on_date);
    sheet.text(1, 'label', accountOf.get(day.account_id)?.name ?? '');
    const part = day.component === 'base' ? '' : ` · ${day.component}`;
    // An estimated day says so in the product column, in the same words as the screen.
    sheet.text(2, day.estimated ? 'quiet' : 'label',
      day.estimated ? words['report.yields.estimatedRow'] : `${productOf.get(day.product_id) ?? ''}${part}`);
    sheet.number(3, 'money', day.balance_minor / 100);
    sheet.number(4, 'rate', day.annual_rate_scaled / 1_000_000);
    sheet.number(5, 'money', day.gross_minor / 100);
    sheet.number(6, day.withholding_minor > 0 ? 'moneyOut' : 'money', day.withholding_minor / 100);
    sheet.number(7, 'money', day.net_minor / 100);
    if (day.actual_net_minor !== null) sheet.number(8, 'moneyIn', paidOf(day) / 100);
    else sheet.text(8, 'quiet', '');
    sheet.text(9, 'quiet', accountOf.get(day.account_id)?.currency_code ?? '');
    sheet.row += 1;
  }

  return {
    name: words['report.yields.sheet.days'],
    columnWidths: [12, 18, 26, 17, 10, 13, 13, 13, 15, 9],
    cells: sheet.cells,
    frozenRows: 1,
  };
}

/** Named with the period, so two of them never collide. */
export function yieldsFileName(data: YieldsReportData): string {
  const period = (data.period.from && data.period.to)
    ? `${data.period.from}_${data.period.to}`
    : 'todo';
  return fill(data.words['report.yields.file'], { period });
}
