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
import { dateIn, monthOf, moneyTokensIn, moneyIn, yearIn, type MoneyToken, type TextItem } from './tokens';

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
  /**
   * Not a row of the list: the figure that made the statement add up, found
   * among its own summary lines ("Intereses corrientes $11.101,42").
   */
  summary?: boolean;
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
  /**
   * A credit card's statement: its signs run the other way - a purchase is
   * printed as it is and a payment carries the minus - and its own figures
   * are what was owed, not what was held.
   */
  card: boolean;
  /** The card's limit, as the statement prints it ("Cupo total"). */
  credit_limit_minor: number | null;
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

/** How a row of a card's statement starts when money came back into the card. */
const CARD_CAME_IN = /^(pagos?|abonos?|devoluci[oó]n|reverso|reintegro|nota\s+cr[eé]dito)\b/i;

/** Words that say money left, for the statements with no balance column. */
const WENT_OUT = /\b(compra|pago|retiro|debito|débito|cargo|transferencia\s+enviada|envio|envío|cuota|comision|comisión|iva|4x1000|gmf)\b/i;
const CAME_IN = /\b(abono|deposito|depósito|consignacion|consignación|recibida|recibido|nomina|nómina|intereses|devolucion|devolución|reverso|credito|crédito)\b/i;

/**
 * Reads a statement.
 *
 * `minorUnits` is the account's, because what the numbers mean is decided by
 * the account the statement belongs to and never guessed from the page.
 */
export function readStatement(
  items: readonly TextItem[],
  minorUnits: number,
  options: { card?: boolean } = {},
): StatementReading {
  const lines = linesOf(items);
  const whole = lines.map(line => line.text).join(' ');
  const year = yearIn(whole);
  const card = options.card ?? looksLikeCard(whole);
  // On a card the balance is a debt: it grows as money leaves.
  const way = card ? -1 : 1;
  // What the account held, in the app's terms, from a figure as printed.
  const held = (token: MoneyToken): number => way * signedOf(token);

  const stated = card ? cardBalances(lines, minorUnits) : statedBalances(lines, minorUnits);

  // Every line that begins with a date is a movement; everything else on the
  // page is a heading, a total or the bank's telephone number.
  const dateOfLine = datingOf(lines, year);
  const dated = lines
    .map(line => ({ line, on: dateOfLine(line), money: amountsOf(line, minorUnits) }))
    .filter((row): row is { line: StatementLine; on: IsoDate; money: MoneyToken[] } =>
      row.on !== null && row.money.length > 0);

  // A card's statement has no running balance: its other columns (what was
  // billed of an installment purchase, what is left of it) can still line
  // up by chance with a purchase, and must not be taken for one.
  const balanceColumn = card ? null : balanceColumnOf(dated);
  const sides = sideColumnsOf(lines);
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
      const moved = held(balance) - previous;
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
      const byColumn = card || token.negative || token.positive ? null : sideOfColumn(sides, token);
      amount = token.minor * (byColumn ?? signFromWords(line.text, token, card, descriptionOf(line, money, year)));
      // A sign written on the line itself, in the bank's own ink, is not the
      // last resort this function usually is, and the review screen should
      // not warn about it.
      // On a card, an unsigned row being a purchase is the statement's own
      // convention, not a guess.
      if (token.negative || token.positive || card) confidence = 'high';
    }
    if (amount === null || amount === 0) {
      if (balance !== null) previous = held(balance);
      continue;
    }

    rows.push({
      occurred_on: on,
      amount_minor: amount,
      description: descriptionOf(line, money, year),
      balance_minor: balance === null ? null : held(balance),
      line: line.text,
      page: line.page,
      confidence,
    });
    if (balance !== null) previous = held(balance);
    else if (previous !== null) previous += amount;
  }

  acrossNewYear(rows);

  let read = rows.reduce((sum, row) => sum + row.amount_minor, 0);

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

  // What is missing for the statement to add up may be printed on it, just
  // not as a row: a card's interest, a fee, the 4x1000 - in its summary
  // ("+ Intereses corrientes $11.101,42"). Found there, it is proposed as one
  // more movement, saying where it came from; found nowhere, the statement
  // stays "No cuadra" (Jose, 2026-10-15).
  if (opening !== null && closing !== null && rows.length > 0 && opening + read !== closing) {
    const missing = closing - (opening + read);
    const found = summaryLineFor(lines, Math.abs(missing), minorUnits, new Set(dated.map(row => row.line)));
    if (found !== null) {
      const last = rows.reduce((latest, row) => (row.occurred_on > latest ? row.occurred_on : latest), rows[0].occurred_on);
      rows.push({
        occurred_on: last,
        amount_minor: missing,
        description: found.label,
        balance_minor: null,
        line: found.line.text,
        page: found.line.page,
        confidence: 'high',
        summary: true,
      });
      read += missing;
    }
  }

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
    card,
    credit_limit_minor: card ? figureAfter(lines, CARD_LIMIT, minorUnits) : null,
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
      // A column that stays put proves nothing: a card statement's
      // "capital pendiente" sits at 0,00 line after line, beside other 0,00s.
      if (previous !== null && value !== previous) {
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

/**
 * The amounts of a movement's line. A bare run of digits - an authorisation
 * or a reference number - is no amount beside amounts written as such
 * ("45.900,00", "$45.900"): only where nothing on the line is written that
 * way is it read as one.
 */
function amountsOf(line: StatementLine, minorUnits: number): MoneyToken[] {
  const money = moneyTokensIn(line.items, minorUnits);
  const written = money.filter(token => !/^[-+]?\d+$/.test(token.text));
  return written.length > 0 ? written : money;
}

/**
 * A statement that prints what left and what came in in two columns of their
 * own - "Débitos" and "Créditos", "Cargos" and "Abonos" - says the sign by the
 * column, and its headings say which column is which. Only used where the
 * line carries no sign and no running balance proved one.
 */
const OUT_HEADING = /^(d[eé]bitos?|cargos?|retiros?|salidas?|egresos?|valor\s+d[eé]bito)$/i;
const IN_HEADING = /^(cr[eé]ditos?|abonos?|dep[oó]sitos?|entradas?|ingresos?|valor\s+cr[eé]dito)$/i;

function sideColumnsOf(lines: readonly StatementLine[]): { out: number; in: number } | null {
  for (const line of lines) {
    const out = line.items.find(item => OUT_HEADING.test(item.text.trim()));
    const into = line.items.find(item => IN_HEADING.test(item.text.trim()));
    if (out && into && Math.abs(out.x - into.x) > SAME_COLUMN) return { out: out.x, in: into.x };
  }
  return null;
}

function sideOfColumn(sides: { out: number; in: number } | null, token: MoneyToken): -1 | 1 | null {
  if (sides === null) return null;
  return Math.abs(token.x - sides.in) < Math.abs(token.x - sides.out) ? 1 : -1;
}

/**
 * A statement from December into January that writes its days without a
 * year ("28/12", "05/01") takes the one year its heading repeats for all of
 * them, and one side lands a year off. Where both ends of the year are read
 * that way, November and December belong to the year before January's.
 */
function acrossNewYear(rows: StatementRow[]): void {
  const yearless = rows.filter(row => !/\b\d{4}\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2}\b/.test(row.line.slice(0, 40)));
  const month = (row: StatementRow) => Number(row.occurred_on.slice(5, 7));
  const late = yearless.filter(row => month(row) >= 11);
  const early = yearless.filter(row => month(row) <= 2);
  if (late.length === 0 || early.length === 0) return;
  for (const row of late) {
    if (row.occurred_on.slice(0, 4) !== early[0].occurred_on.slice(0, 4)) continue;
    const back = `${Number(row.occurred_on.slice(0, 4)) - 1}${row.occurred_on.slice(4)}`;
    row.occurred_on = back as IsoDate;
  }
}

/**
 * A summary line carrying exactly the figure that is missing, and the words
 * printed just before it on that line - which say what it is. Never a line
 * already read as a movement, and never a total or a balance: those carry
 * the same figures for other reasons ("Pago total", "Saldo", "Cupo").
 */
const NOT_A_CHARGE = /(saldo|total|cupo|disponible|m[ií]nimo|l[ií]mite|pago\s+(total|m)|consumos\s+del|capital\s+facturado|acumulaci|redenci)/i;

function summaryLineFor(
  lines: readonly StatementLine[], missing: number, minorUnits: number, movements: ReadonlySet<StatementLine>,
): { line: StatementLine; label: string } | null {
  for (const line of lines) {
    if (movements.has(line)) continue;
    let label: string[] = [];
    for (const item of line.items) {
      const money = moneyIn(item.text, minorUnits);
      if (money === null) {
        label.push(item.text.trim());
        continue;
      }
      const words = label.join(' ').replace(/^[+\-\s]+/, '').trim();
      if (money.minor === missing && /[A-Za-zÁÉÍÓÚáéíóú]{3}/.test(words) && !NOT_A_CHARGE.test(words)) {
        return { line, label: words };
      }
      label = [];
    }
  }
  return null;
}

/** A card statement's other columns: rates, "N/A", "1 de 8" installments. */
const NOT_WORDS = /^(N\/A|-|\d+([.,]\d+)?\s*%|\d+\s+de\s+\d+)$/i;

/** What the line says, with the numbers and the date taken out of it. */
function descriptionOf(line: StatementLine, money: readonly MoneyToken[], year: number | null): string {
  const amounts = new Set(money.map(token => token.text));
  const words = line.items
    .map(item => item.text.trim())
    .filter(text => text.length > 0 && !amounts.has(text) && !amounts.has(moneyIn(text, 2)?.text ?? '') && !NOT_WORDS.test(text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ');
  // What leads the date (a card's word, an authorisation number) and the
  // date itself go, however it was written - and a second date right after
  // it, which is the day the bank posted it.
  let start = 0;
  for (let lead = 0; lead <= LEAD_MAX && lead < words.length; lead++) {
    const after = dateEnd(words, lead, year);
    if (after > lead) {
      start = after;
      const second = dateEnd(words, start, year);
      if (second > start) start = second;
      break;
    }
  }
  return words.slice(start).join(' ').trim();
}

/** Where a date starting at word `from` ends, or `from` when none starts there. */
function dateEnd(words: readonly string[], from: number, year: number | null): number {
  if (dateIn(words.slice(from).join(' '), year) === null) return from;
  // The longest run of words that still reads as the same date: "03 Ago 2026"
  // is three words, "2026-08-03" one.
  const whole = dateIn(words.slice(from).join(' '), year);
  // Only words a date is made of: with a digit, or a month's name.
  let end = from;
  for (let take = 1; take <= 3 && from + take <= words.length; take++) {
    const word = words[from + take - 1].replace(/[.,]$/, '');
    if (!/\d/.test(word) && monthOf(word) === undefined) break;
    if (dateIn(words.slice(from, from + take).join(' '), year) === whole) end = from + take;
  }
  return end === from ? from + 1 : end;
}

/**
 * The sign, where no balance column proved it.
 *
 * Last resort, and the row it produces is marked 'low' so the review screen
 * can say it was a guess. A statement that says nothing either way is read as
 * money leaving, which is what most lines of most statements are.
 */
function signFromWords(text: string, token: MoneyToken, card = false, description = ''): -1 | 1 {
  // A card's statement prints what was charged as it is and what was paid
  // with a minus or "CR": either is money coming back into the card, and so
  // is an unsigned row that STARTS by saying it is a payment or a refund -
  // "PAGO POR PSE", never "MERCADO PAGO", which is a purchase.
  if (card) {
    if (token.negative || /\b(CR|CREDITO|CRÉDITO)\b/i.test(token.text)) return 1;
    if (token.positive) return -1;
    return CARD_CAME_IN.test(description) ? 1 : -1;
  }
  if (token.negative) return -1;
  if (token.positive) return 1;
  if (CAME_IN.test(text) && !WENT_OUT.test(text)) return 1;
  return -1;
}

/**
 * The date of a movement's line: at its start, or after what the statement
 * prints in front of every row - the card ("Virtual", "Física"), a dash, an
 * authorisation number - which the very start missed (Rappi Card, Jose,
 * 2026-10-15: none of its forty rows was read).
 *
 * What comes before the date has to have the same SHAPE on at least two
 * dated rows: words as they are, every run of digits as one "9", so
 * "Virtual" leads like "Virtual" and 483920 like 117355. A heading such as
 * "Fecha de corte 20/09/2026" leads nothing else, and is never a movement.
 * The date is looked for piece by piece (as the PDF placed them) and word by
 * word (for a PDF that hands a row over as one piece), never past the fourth.
 */
const LEAD_MAX = 3;

function datingOf(lines: readonly StatementLine[], year: number | null): (line: StatementLine) => IsoDate | null {
  const shapeOf = (parts: readonly string[]): string =>
    parts.map(part => part.trim().toLowerCase().replace(/\d+/g, '9')).join(' ');

  /** Every way of splitting the line into a lead and a dated rest. */
  const candidates = (line: StatementLine): { key: string; on: IsoDate }[] => {
    const found: { key: string; on: IsoDate }[] = [];
    const pieces = line.items.map(item => item.text.trim()).filter(Boolean);
    const words = line.text.split(' ');
    for (const parts of [pieces, words]) {
      for (let skip = 1; skip <= LEAD_MAX && skip < parts.length; skip++) {
        const lead = parts.slice(0, skip);
        // A lead is a short tag, never a sentence or an amount.
        if (lead.join(' ').length > 24 || lead.some(part => moneyIn(part, 2) !== null && !/^\d+$/.test(part))) break;
        const on = dateIn(parts.slice(skip).join(' '), year);
        if (on !== null) {
          found.push({ key: shapeOf(lead), on });
          break;
        }
      }
    }
    return found;
  };

  const leads = new Map<string, number>();
  for (const line of lines) {
    if (dateIn(line.text, year) !== null) continue;
    for (const key of new Set(candidates(line).map(found => found.key))) {
      leads.set(key, (leads.get(key) ?? 0) + 1);
    }
  }

  return line => {
    const at = dateIn(line.text, year);
    if (at !== null) return at;
    return candidates(line).find(found => (leads.get(found.key) ?? 0) >= 2)?.on ?? null;
  };
}

/**
 * A credit card's statement says so in words every bank uses - at least two
 * of them, since a debit account's statement may well list a "PAGO TARJETA
 * DE CREDITO" among its movements.
 */
const CARD_WORDS = [
  /pago\s+m[ií]nimo/i,
  /cupo\s+(total|utilizado|disponible)/i,
  /pago\s+total/i,
  /fecha\s+(l[ií]mite\s+)?de\s+pago/i,
  /tarjeta\s+de\s+cr[eé]dito/i,
];
const looksLikeCard = (text: string): boolean => CARD_WORDS.filter(words => words.test(text)).length >= 2;
const CARD_OPENING = /saldo\s+(del\s+)?(periodo|per[ií]odo|mes)\s+anterior/i;
const CARD_CLOSING = /pago\s+total/i;
const CARD_LIMIT = /cupo\s+total/i;

/**
 * The figure printed right after some words, on the first line that has
 * them: "Pago total $1.487.278,42". Read by position, since the same line of
 * a card statement also carries the minimum, the limit or the cashback.
 */
function figureAfter(lines: readonly StatementLine[], words: RegExp, minorUnits: number): number | null {
  for (const line of lines) {
    const at = line.items.findIndex(item => words.test(item.text));
    if (at < 0) continue;
    const after = line.items[at].text.replace(new RegExp(`^.*?${words.source}`, 'i'), '');
    const pieces = [after, ...line.items.slice(at + 1).map(item => item.text)];
    for (const piece of pieces) {
      const money = moneyIn(piece.replace(/^[\s:]+/, ''), minorUnits);
      if (money) return money.negative ? -money.minor : money.minor;
    }
  }
  return null;
}

/** A card's two figures, as what was owed: a debt is negative in the app. */
function cardBalances(lines: readonly StatementLine[], minorUnits: number): {
  opening: number | null;
  closing: number | null;
} {
  const before = figureAfter(lines, CARD_OPENING, minorUnits);
  const total = figureAfter(lines, CARD_CLOSING, minorUnits);
  return {
    opening: before === null ? null : 0 - before,
    closing: total === null ? null : 0 - total,
  };
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
  /** A credit card's statement, and the limit it prints. */
  card: boolean;
  credit_limit_minor: number | null;
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
    card: reading.card,
    credit_limit_minor: reading.credit_limit_minor,
    opening_minor: reading.opening_minor,
    opened_on: first === null ? null : first.occurred_on,
  };
}

/** The same, for a single line of text - used by the tests and the readers. */
export { moneyIn, dateIn, yearIn };
