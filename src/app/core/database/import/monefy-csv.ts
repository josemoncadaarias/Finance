/**
 * Reads a Monefy CSV export into rows the importer can work with.
 *
 * This module only parses and classifies; it writes nothing and decides
 * nothing. Everything it reports is derived from the file, so an odd row
 * becomes an odd `MonefyRow` rather than a silent guess.
 *
 * Three things about the file drive the code below, all verified against the
 * real export:
 *
 *   - It is **Windows-1252**, not UTF-8. Decoding it as UTF-8 mangles every
 *     accent, and account names feed the import fingerprint.
 *   - Dates are `dd/mm/yyyy` throughout, unambiguously (days reach 31, months
 *     never pass 12).
 *   - Amounts carry thousands separators and may have decimals:
 *     `-1,119,699` and `-51,774.09`.
 */

import { parseAmountToMinor } from '../money';
import { fingerprintOf, assignSequences } from './fingerprint';

/** What the category column turned out to mean. */
export type MonefyRowKind =
  /** An ordinary income or expense. */
  | 'transaction'
  /** The outgoing half of a transfer: category `To 'X'`. */
  | 'transfer_out'
  /** The incoming half of a transfer: category `From 'Y'`. */
  | 'transfer_in'
  /** A pseudo-category standing in for an opening balance. */
  | 'initial_balance';

export interface MonefyRow {
  /** 1-based line in the file, counting the header. Points at the real line. */
  lineNumber: number;
  kind: MonefyRowKind;
  occurredOn: string;
  account: string;
  /** The category exactly as written, pseudo-categories included. */
  rawCategory: string;
  /** For a transfer or an opening balance, the account named in the category. */
  counterparty: string | null;
  /** For an ordinary transaction, the real category. Null otherwise. */
  category: string | null;
  amountMinor: number;
  currency: string;
  description: string;
  /** Set by `parseMonefyCsv`, together with `importSeq`. */
  fingerprint: string;
  importSeq: number;
}

export interface MonefyCsvResult {
  rows: MonefyRow[];
  /** Header fields as found, for a sanity check against what is expected. */
  header: string[];
  /** Distinct account names, in first-seen order. */
  accounts: string[];
  /** Distinct real categories, pseudo-categories excluded. */
  categories: string[];
}

export class MonefyCsvError extends Error {
  readonly lineNumber: number;

  constructor(message: string, lineNumber: number) {
    super(`Line ${lineNumber}: ${message}`);
    this.name = 'MonefyCsvError';
    this.lineNumber = lineNumber;
  }
}

const EXPECTED_HEADER = ['date', 'account', 'category', 'amount', 'currency', 'converted amount', 'currency', 'description'];

const TO_PATTERN = /^To '(.+)'$/;
const FROM_PATTERN = /^From '(.+)'$/;
const INITIAL_BALANCE_PATTERN = /^Initial balance '(.+)'$/;

/**
 * Splits one CSV line, honouring the double quotes Monefy wraps amounts in.
 *
 * Written by hand rather than pulled from a library: this is one known format
 * with one quirk, and a dependency that has to be installed and kept current
 * is a poor trade for thirty lines.
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/** `dd/mm/yyyy` to `yyyy-mm-dd`, rejecting anything else rather than guessing. */
export function parseMonefyDate(raw: string, lineNumber: number): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!match) {
    throw new MonefyCsvError(`Date is not dd/mm/yyyy: ${JSON.stringify(raw)}`, lineNumber);
  }

  const [, day, month, year] = match;
  const dayNumber = Number(day);
  const monthNumber = Number(month);

  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    throw new MonefyCsvError(`Date is out of range: ${JSON.stringify(raw)}`, lineNumber);
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Monefy writes amounts with thousands separators: `-1,119,699`, `-51,774.09`.
 * Stripping them is this parser's job, not the money helper's, because what
 * counts as a separator depends on the file being read.
 */
export function parseMonefyAmount(raw: string, lineNumber: number): number {
  try {
    return parseAmountToMinor(raw.replace(/,/g, '').trim());
  } catch (error) {
    throw new MonefyCsvError(
      `Amount cannot be read: ${JSON.stringify(raw)} (${error instanceof Error ? error.message : String(error)})`,
      lineNumber,
    );
  }
}

/**
 * Works out what a category column means.
 *
 * Monefy has no transfer entity: a transfer is two mirror rows whose
 * categories are `To 'X'` and `From 'Y'`. Opening balances are faked the same
 * way, as `Initial balance 'Z'`. Pairing those rows up is the importer's job;
 * all that happens here is recognising them.
 */
export function classifyCategory(rawCategory: string): Pick<MonefyRow, 'kind' | 'category' | 'counterparty'> {
  const toMatch = TO_PATTERN.exec(rawCategory);
  if (toMatch) {
    return { kind: 'transfer_out', category: null, counterparty: toMatch[1] };
  }

  const fromMatch = FROM_PATTERN.exec(rawCategory);
  if (fromMatch) {
    return { kind: 'transfer_in', category: null, counterparty: fromMatch[1] };
  }

  const initialMatch = INITIAL_BALANCE_PATTERN.exec(rawCategory);
  if (initialMatch) {
    return { kind: 'initial_balance', category: null, counterparty: initialMatch[1] };
  }

  return { kind: 'transaction', category: rawCategory, counterparty: null };
}

/**
 * Parses a whole export.
 *
 * Takes bytes rather than a string so the Windows-1252 decoding happens here,
 * where it is documented, instead of being every caller's problem to remember.
 */
export function parseMonefyCsv(bytes: Uint8Array): MonefyCsvResult {
  const text = new TextDecoder('windows-1252').decode(bytes);
  const lines = text.split(/\r?\n/);

  const headerLine = lines.find(line => line.trim() !== '');
  if (headerLine === undefined) {
    throw new MonefyCsvError('The file is empty', 1);
  }

  const header = splitCsvLine(headerLine).map(field => field.trim());
  if (header.length !== EXPECTED_HEADER.length) {
    throw new MonefyCsvError(
      `Expected ${EXPECTED_HEADER.length} columns, found ${header.length}: ${header.join(', ')}`,
      1,
    );
  }

  const rows: MonefyRow[] = [];
  const accounts: string[] = [];
  const categories: string[] = [];
  const seenAccounts = new Set<string>();
  const seenCategories = new Set<string>();

  let headerPassed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (line.trim() === '') continue;
    if (!headerPassed) {
      headerPassed = true;
      continue;
    }

    const fields = splitCsvLine(line);
    if (fields.length < EXPECTED_HEADER.length) {
      throw new MonefyCsvError(`Expected ${EXPECTED_HEADER.length} columns, found ${fields.length}`, lineNumber);
    }

    // A description containing an unquoted comma would split into extra
    // fields; everything past the eighth belongs to it.
    const [date, account, rawCategory, amount, currency] = fields;
    const description = fields.slice(EXPECTED_HEADER.length - 1).join(',');

    const classified = classifyCategory(rawCategory);
    const row: MonefyRow = {
      lineNumber,
      ...classified,
      occurredOn: parseMonefyDate(date, lineNumber),
      account: account.trim(),
      rawCategory,
      amountMinor: parseMonefyAmount(amount, lineNumber),
      currency: currency.trim(),
      description: description.trim(),
      fingerprint: '',
      importSeq: 0,
    };
    rows.push(row);

    if (!seenAccounts.has(row.account)) {
      seenAccounts.add(row.account);
      accounts.push(row.account);
    }
    if (row.category !== null && !seenCategories.has(row.category)) {
      seenCategories.add(row.category);
      categories.push(row.category);
    }
  }

  // Fingerprints are assigned in file order, which is what makes the sequence
  // numbers stable between exports.
  const fingerprints = rows.map(row =>
    fingerprintOf({
      occurredOn: row.occurredOn,
      account: row.account,
      category: row.rawCategory,
      amountMinor: row.amountMinor,
      description: row.description,
    }),
  );
  const sequences = assignSequences(fingerprints);
  rows.forEach((row, index) => {
    row.fingerprint = fingerprints[index];
    row.importSeq = sequences[index];
  });

  return { rows, header, accounts, categories };
}
