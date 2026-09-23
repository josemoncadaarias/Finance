/**
 * Turning the text of a statement into movements, and proving it.
 *
 * The reading itself is guesswork - which number on the line is the movement
 * and which is the balance the account was left at, and whether the money came
 * or went. What turns that guesswork into something trustworthy is the
 * statement's own arithmetic: **the running balance**.
 *
 * If a column of numbers moves, line after line, by exactly the amount written
 * beside it, that column is the balance and nothing else can be. And once it
 * is known, the sign of every movement follows from it rather than from a
 * keyword: the balance went down, so money left. No dictionary of Spanish
 * banking verbs, and nothing to keep up to date.
 *
 * Then the whole reading is checked end to end - the balance it starts from,
 * plus everything read, must land on the balance it ends at. Where it does
 * not, NOTHING is proposed and the screen says by how much it is off. A total
 * nobody can check is a total nobody trusts. Rule 22.
 */

import type { IsoDate } from '../database/types';
import { dateIn, moneyTokensIn, moneyIn, yearIn, type MoneyToken, type TextItem } from './tokens';

/** One line of the statement: everything printed at the same height. */
export interface StatementLine {
  page: number;
  y: number;
  items: TextItem[];
  text: string;
}

/** A movement as it was read. */
export interface StatementRow {
  occurred_on: IsoDate;
  /** Signed, in minor units: negative left the account. */
  amount_minor: number;
  description: string;
  /** What the account was left holding, where the statement says so. */
  balance_minor: number | null;
  /** The line it was read from, kept as the evidence of it. */
  line: string;
  page: number;
  /**
   * 'high' where the running balance decided the sign, which is proof.
   * 'low' where it had to be guessed from the words, which is not.
   */
  confidence: 'high' | 'low';
}

export interface StatementReading {
  rows: StatementRow[];
  /**
   * The two figures THE STATEMENT gives about ITSELF: what the account held
   * when the period began and what it held when it ended.
   *
   * Nothing here is ever compared against the account's balance in the app. A
   * statement is one month of a life that started earlier, and asking a month
   * to add up to a history would be asking a wrong question - it would report
   * every statement ever written as broken. What is asked is only whether the
   * statement agrees with itself: where it says it started, plus what it
   * lists, has to land where it says it ended.
   */
  opening_minor: number | null;
  closing_minor: number | null;
  /** What was read, so the comparison can be shown rather than asserted. */
  read_minor: number;
  /**
   * 'checked'   - the statement agrees with itself.
   * 'off'       - it does not, and `offBy_minor` says by how much.
   * 'unclear'   - its running balance and its own words disagree, which is
   *               nearly always a line with "saldo" on it that is not the one
   *               this was looking for. Worth mentioning, not worth alarm.
   * 'unchecked' - it gives neither, so there is nothing to check.
   */
  balances: 'checked' | 'off' | 'unclear' | 'unchecked';
  offBy_minor: number;
  year: number | null;
}

/** How far apart two pieces of text may sit and still be one line. */
const SAME_LINE = 3;
/** How far apart two amounts may sit and still be the same column. */
const SAME_COLUMN = 20;

/** Everything printed at the same height, in reading order. */
export function linesOf(items: readonly TextItem[]): StatementLine[] {
  const lines: StatementLine[] = [];
  const sorted = [...items].sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x));

  for (const item of sorted) {
    if (item.text.trim().length === 0) continue;
    const last = lines[lines.length - 1];
    if (last && last.page === item.page && Math.abs(last.y - item.y) <= SAME_LINE) {
      last.items.push(item);
      continue;
    }
    lines.push({ page: item.page, y: item.y, items: [item], text: '' });
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items.map(item => item.text.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ');
  }
  return lines;
}

/**
 * The other lines with "saldo" on them, which are not the two below.
 *
 * A real statement is full of them - the average balance of the month, what
 * is available to spend, the minimum to keep, the card's limit - and reading
 * one of those as the closing balance reports a statement as broken when it
 * is perfectly fine. That false alarm is worse than no check at all.
 */
const NOT_A_BALANCE = /(promedio|disponible|m[ií]nimo|minimo|cupo|retenido|canje|puntos)/i;

/** The words a statement uses for the two figures that prove the rest. */
const OPENING = /saldo\s+(anterior|inicial|al\s+inicio|inicio)/i;
const CLOSING = /(saldo\s+(final|actual|al\s+corte|nuevo)|nuevo\s+saldo|saldo\s+a\s+la\s+fecha)/i;

/** Words that say money left, for the statements with no balance column. */
const WENT_OUT = /\b(compra|pago|retiro|debito|débito|cargo|transferencia\s+enviada|envio|envío|cuota|comision|comisión|iva|4x1000|gmf)\b/i;
const CAME_IN = /\b(abono|deposito|depósito|consignacion|consignación|recibida|recibido|nomina|nómina|intereses|devolucion|devolución|reverso|credito|crédito)\b/i;

/**
 * Reads a statement.
 *
 * `minorUnits` is the account's, because what the numbers mean is decided by
 * the account the statement belongs to and never guessed from the page.
 */
export function readStatement(items: readonly TextItem[], minorUnits: number): StatementReading {
  const lines = linesOf(items);
  const year = yearIn(lines.map(line => line.text).join(' '));

  const stated = statedBalances(lines, minorUnits);

  // Every line that begins with a date is a movement; everything else on the
  // page is a heading, a total or the bank's telephone number.
  const dated = lines
    .map(line => ({ line, on: dateIn(line.text, year), money: moneyTokensIn(line.items, minorUnits) }))
    .filter((row): row is { line: StatementLine; on: IsoDate; money: MoneyToken[] } =>
      row.on !== null && row.money.length > 0);

  const balanceColumn = balanceColumnOf(dated);
  const rows: StatementRow[] = [];
  let previous = stated.opening;

  for (const { line, on, money } of dated) {
    const balance = balanceColumn === null
      ? null
      : money.find(token => Math.abs(token.x - balanceColumn) <= SAME_COLUMN) ?? null;
    const others = money.filter(token => token !== balance);
    if (others.length === 0 && balance === null) continue;

    // The balance moved by exactly what this line did. That is the sign, and
    // it is arithmetic rather than a reading of the words.
    let amount: number | null = null;
    let confidence: 'high' | 'low' = 'low';
    if (balance !== null && previous !== null) {
      const moved = signedOf(balance) - previous;
      const written = others.map(token => token.minor);
      if (moved !== 0 && (written.length === 0 || written.includes(Math.abs(moved)))) {
        amount = moved;
        confidence = 'high';
      }
    }
    if (amount === null && others.length > 0) {
      // The movement is written before the balance it left behind, so where
      // the balance column was never found the first amount is the movement
      // and a second one is the balance nobody could prove.
      const token = others[0];
      amount = token.minor * signFromWords(line.text, token);
    }
    if (amount === null || amount === 0) {
      if (balance !== null) previous = signedOf(balance);
      continue;
    }

    rows.push({
      occurred_on: on,
      amount_minor: amount,
      description: descriptionOf(line, money),
      balance_minor: balance === null ? null : signedOf(balance),
      line: line.text,
      page: line.page,
      confidence,
    });
    if (balance !== null) previous = signedOf(balance);
    else if (previous !== null) previous += amount;
  }

  const read = rows.reduce((sum, row) => sum + row.amount_minor, 0);

  /*
   * Which pair of figures to believe.
   *
   * There are two ways to know where the period began and ended: the words
   * "Saldo anterior" and "Saldo final", and the statement's own running
   * balance column. The column is the better witness by a long way - it is
   * the bank's own arithmetic, line by line, and it cannot be confused with
   * anything else on the page. The words can: a real statement has several
   * lines with "saldo" on them, and the ones this does not know about are the
   * ones that will be picked.
   *
   * So where there is a column, it decides, and the words are ignored. That
   * is what stopped Jose's Uala statement from being reported as off by three
   * and a half million pesos it was never off by - a false alarm, in a
   * paragraph, about a file that had been read correctly.
   *
   * Without a column the words are all there is, and then they are checked
   * against the sum: that is a real check, and the one case where "this does
   * not add up" means something.
   */
  const first = rows[0];
  const last = rows[rows.length - 1];
  const fromColumn = first !== undefined && first.balance_minor !== null
    && last !== undefined && last.balance_minor !== null;

  const opening = fromColumn ? first.balance_minor! - first.amount_minor : stated.opening;
  const closing = fromColumn ? last.balance_minor : stated.closing;

  const balances = ((): 'checked' | 'off' | 'unclear' | 'unchecked' => {
    if (opening === null || closing === null) return 'unchecked';
    if (opening + read !== closing) return 'off';
    // The column adds up. Where the words on the page say something else, one
    // of the two was misread - and it is far likelier to be the words, so it
    // is said quietly rather than as a fault.
    const saidOtherwise = fromColumn
      && ((stated.opening !== null && stated.opening !== opening)
        || (stated.closing !== null && stated.closing !== closing));
    return saidOtherwise ? 'unclear' : 'checked';
  })();

  return {
    rows,
    opening_minor: opening,
    closing_minor: closing,
    read_minor: read,
    balances,
    offBy_minor: balances === 'off' ? closing! - (opening! + read) : 0,
    year,
  };
}

const signedOf = (token: MoneyToken): number => (token.negative ? -token.minor : token.minor);

/**
 * The column the running balance is written in, if there is one.
 *
 * Asked of the numbers themselves: a column is the balance when, line after
 * line, the distance between one of its values and the one before matches an
 * amount written on that same line. Two lines agreeing is a coincidence;
 * most of a page agreeing is not.
 */
function balanceColumnOf(dated: readonly { money: MoneyToken[] }[]): number | null {
  if (dated.length < 2) return null;

  const columns: number[] = [];
  for (const { money } of dated) {
    for (const token of money) {
      if (!columns.some(x => Math.abs(x - token.x) <= SAME_COLUMN)) columns.push(token.x);
    }
  }

  let best: { x: number; agreed: number } | null = null;
  for (const x of columns) {
    let agreed = 0;
    let checked = 0;
    let previous: number | null = null;
    for (const { money } of dated) {
      const here = money.find(token => Math.abs(token.x - x) <= SAME_COLUMN);
      if (!here) continue;
      const value = signedOf(here);
      if (previous !== null) {
        checked += 1;
        const moved = Math.abs(value - previous);
        if (money.some(token => token !== here && token.minor === moved)) agreed += 1;
      }
      previous = value;
    }
    // Two thirds of what could be checked, and at least one agreement. One
    // is already specific: the distance between two numbers landing exactly on
    // a third written beside them is not something that happens by accident.
    // Two thirds rather than all of it forgives the line where the bank folded
    // two entries into one.
    if (agreed >= 1 && agreed / checked >= 0.66 && (best === null || agreed > best.agreed)) {
      best = { x, agreed };
    }
  }
  return best?.x ?? null;
}

/** What the line says, with the numbers and the date taken out of it. */
function descriptionOf(line: StatementLine, money: readonly MoneyToken[]): string {
  const amounts = new Set(money.map(token => token.text));
  return line.items
    .map(item => item.text.trim())
    .filter(text => text.length > 0 && !amounts.has(text))
    .join(' ')
    .replace(/^\S*\d{1,4}[-/.]\d{1,2}([-/.]\d{2,4})?\S*\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The sign, where no balance column proved it.
 *
 * Last resort, and the row it produces is marked 'low' so the review screen
 * can say it was a guess. A statement that says nothing either way is read as
 * money leaving, which is what most lines of most statements are.
 */
function signFromWords(text: string, token: MoneyToken): -1 | 1 {
  if (token.negative) return -1;
  if (CAME_IN.test(text) && !WENT_OUT.test(text)) return 1;
  return -1;
}

/** The two figures the statement states about itself. */
function statedBalances(lines: readonly StatementLine[], minorUnits: number): {
  opening: number | null;
  closing: number | null;
} {
  let opening: number | null = null;
  let closing: number | null = null;
  for (const line of lines) {
    const money = moneyTokensIn(line.items, minorUnits);
    if (money.length === 0) continue;
    const last = money[money.length - 1];
    if (NOT_A_BALANCE.test(line.text)) continue;
    if (opening === null && OPENING.test(line.text)) opening = signedOf(last);
    if (CLOSING.test(line.text)) closing = signedOf(last);
  }
  return { opening, closing };
}

/**
 * What a statement says about the account it belongs to.
 *
 * Enough to fill in a form somebody would otherwise type: the bank's name
 * from the top of the page, the day the period began, and what the account
 * held then - which is exactly the opening balance of an account created from
 * this statement, because opening plus these movements lands on the closing
 * balance the bank printed.
 *
 * Every field may be missing, and a missing one is asked for rather than
 * invented.
 */
export interface StatementAccount {
  name: string | null;
  opening_minor: number | null;
  opened_on: IsoDate | null;
}

/** Words that are the bank's paperwork rather than its name. */
const NOT_A_NAME = /(extracto|estado\s+de\s+cuenta|periodo|per[ií]odo|cuenta\s+n|nit|p[aá]gina|resumen|fecha)/i;

export function accountIn(reading: StatementReading, items: readonly TextItem[]): StatementAccount {
  const lines = linesOf(items);

  // The first line of the first page that reads like a name: banks put their
  // own at the top, and what is up there and is not paperwork is it.
  let name: string | null = null;
  for (const line of lines.slice(0, 6)) {
    // The leftmost piece of the line, not the whole line: a bank puts its own
    // name on the left and the words 'Extracto de cuenta' on the right of the
    // same row, and reading the row whole threw the name away with them.
    const text = (line.items[0]?.text ?? '').trim();
    if (text.length < 3 || text.length > 60) continue;
    if (NOT_A_NAME.test(text)) continue;
    if (moneyIn(text, 2) !== null) continue;
    // A line that starts with a date is a movement, and a movement is not a
    // bank however few of them the page has.
    if (dateIn(text, 2000) !== null) continue;
    // A legal suffix is the bank's lawyers, not what anybody calls it.
    name = text.replace(/\s+(S\.?A\.?S?\.?|LTDA\.?|BIC)\b.*$/i, '').trim();
    break;
  }

  // The day the period began is the day before its first movement: the
  // opening balance is what the account held when that day started.
  const first = reading.rows[0] ?? null;

  return {
    name: name === null || name.length === 0 ? null : name,
    opening_minor: reading.opening_minor,
    opened_on: first === null ? null : first.occurred_on,
  };
}

/** The same, for a single line of text - used by the tests and the readers. */
export { moneyIn, dateIn, yearIn };
