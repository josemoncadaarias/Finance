// The income-tax simulation, exported as a spreadsheet.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/tax-workbook.test.mjs
//
// The file promises two things: that it shows the figures the app shows, and
// that its formulas are real - change a yellow box and everything recalculates
// the way the screen would. The first is easy to check. The second needs the
// formulas actually evaluated, so there is a small evaluator below for the
// handful of functions the sheet uses, and every formula is run against the
// engine for the exported inputs and for several others typed over them.

import test from 'node:test';
import assert from 'node:assert/strict';
import jsdom from 'jsdom';

import { simulate } from '../../src/app/core/tax/cedula-general.ts';
import { defaultInputs, fillGaps, SPREADSHEET_2026 } from '../../src/app/core/tax/defaults.ts';
import {
  taxSheet, taxWorkbook, sheetValue, effectiveInput, TAX_SHEET_STYLES,
} from '../../src/app/core/tax/tax-workbook.ts';

const TODAY = new Date(2026, 8, 11);
const pesos = value => Math.round(value * 100);
const jose = () => fillGaps(defaultInputs(2026, TODAY), SPREADSHEET_2026);

/** Inputs different enough from the export to take every formula down another path. */
const OTHER_CASES = {
  'working independently, with capital, deductions and a withholding typed in': () => ({
    ...jose(),
    employment: 'independent', baseShareScaled: undefined, healthScaled: undefined, pensionScaled: undefined,
    monthlySalaryMinor: pesos(15_000_000), dependents: 1,
    capitalIncomeMinor: pesos(20_000_000), financialYieldMinor: pesos(18_000_000), capitalCostsMinor: pesos(250_000),
    otherIncomeMinor: pesos(3_000_000), otherCostsMinor: pesos(1_000_000),
    voluntaryOwnMinor: pesos(4_000_000), housingInterestMinor: pesos(6_000_000),
    eInvoicePurchasesMinor: pesos(30_000_000), occasionalTaxMinor: pesos(500_000),
    creditFromLastYearMinor: pesos(200_000), advancePaidMinor: pesos(150_000),
    monthlyWithholdingMinor: jose().monthlyWithholdingMinor.map((month, at) => (at === 0 ? pesos(1_000_000) : month)),
    extraWithholdingMinor: [pesos(35_000), pesos(12_345.67), 0, 0],
  }),
  'a salary high enough for the ceiling, the top solidarity step and the top band': () => ({
    ...jose(), employment: 'ordinary', baseShareScaled: undefined, healthScaled: undefined, pensionScaled: undefined,
    monthlySalaryMinor: pesos(400_000_000), dependents: 6,
  }),
  'no minimum wage on record, so the typed solidarity rate, and a refund': () => ({
    ...jose(), employment: 'ordinary', baseShareScaled: undefined, healthScaled: undefined, pensionScaled: undefined,
    minimumWageMinor: 0, solidarityScaled: 15_000, monthlySalaryMinor: pesos(3_000_000),
  }),
  'no salary at all': () => ({ ...jose(), monthlySalaryMinor: 0, capitalIncomeMinor: 0, financialYieldMinor: 0 }),
  'an employee paid half in non-salary bonuses, with no dependents': () => ({
    ...jose(), employment: 'ordinary', baseShareScaled: undefined, healthScaled: undefined, pensionScaled: undefined,
    monthlySalaryMinor: pesos(20_000_000), nonSalaryMonthlyMinor: pesos(10_000_000), dependents: 0,
  }),
  'working independently with the 40% cap already full, so the UVT per dependent win': () => ({
    ...jose(),
    employment: 'independent', baseShareScaled: undefined, healthScaled: undefined, pensionScaled: undefined,
    monthlySalaryMinor: pesos(12_000_000), dependents: 3,
    voluntaryOwnMinor: pesos(60_000_000), housingInterestMinor: pesos(20_000_000),
  }),
};

// ---------------------------------------------------------------------------
// A formula evaluator for what the sheet uses: + - * / comparisons, ranges,
// IF MIN MAX SUM ROUND HYPERLINK.
// ---------------------------------------------------------------------------

function columnName(col) {
  let n = col + 1;
  let name = '';
  while (n > 0) { const rest = (n - 1) % 26; name = String.fromCharCode(65 + rest) + name; n = Math.floor((n - 1) / 26); }
  return name;
}

function tokenize(source) {
  const pattern = /\s*(?:(\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)|"((?:[^"]|"")*)"|([A-Z]+)\(|([A-Z]+\d+)|(<=|>=|<>|[-+*/(),:<>=]))/y;
  const tokens = [];
  pattern.lastIndex = 0;
  while (pattern.lastIndex < source.length) {
    const start = pattern.lastIndex;
    const match = pattern.exec(source);
    if (!match) {
      if (source.slice(start).trim() === '') break;
      throw new Error(`Cannot read "${source.slice(start)}" in ${source}`);
    }
    if (match[1] !== undefined) tokens.push({ kind: 'number', value: Number(match[1]) });
    else if (match[2] !== undefined) tokens.push({ kind: 'string', value: match[2].replace(/""/g, '"') });
    else if (match[3] !== undefined) tokens.push({ kind: 'function', value: match[3] });
    else if (match[4] !== undefined) tokens.push({ kind: 'ref', value: match[4] });
    else tokens.push({ kind: 'op', value: match[5] });
  }
  return tokens;
}

/** Excel's ROUND: half away from zero, on the fifteen digits it keeps. */
function excelRound(value, digits) {
  const factor = 10 ** digits;
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  return Math.sign(value) * Math.round(scaled) / factor;
}

function evaluatorFor(spec, overrides = new Map()) {
  const cells = new Map(spec.cells.map(cell => [`${columnName(cell.col)}${cell.row}`, cell]));
  const memo = new Map();

  const value = ref => {
    if (overrides.has(ref)) return overrides.get(ref);
    if (memo.has(ref)) return memo.get(ref);
    const content = cells.get(ref)?.content;
    let result = 0;
    if (content && 'number' in content) result = content.number;
    else if (content && 'text' in content) result = content.text;
    else if (content && 'formula' in content) result = evaluate(content.formula);
    memo.set(ref, result);
    return result;
  };

  const range = (from, to) => {
    const [, col, first] = from.match(/^([A-Z]+)(\d+)$/);
    const [, col2, last] = to.match(/^([A-Z]+)(\d+)$/);
    assert.equal(col, col2, `ranges here are one column: ${from}:${to}`);
    const values = [];
    for (let row = Number(first); row <= Number(last); row++) values.push(value(`${col}${row}`));
    return values;
  };

  const call = (name, args) => {
    const flat = args.flat();
    switch (name) {
      case 'IF': return args[0] ? args[1] : args[2];
      case 'MIN': return Math.min(...flat);
      case 'MAX': return Math.max(...flat);
      case 'SUM': return flat.reduce((sum, one) => sum + one, 0);
      case 'ROUND': return excelRound(args[0], args[1]);
      case 'HYPERLINK': return args[1];
      default: throw new Error(`The evaluator does not know ${name}`);
    }
  };

  function evaluate(source) {
    const tokens = tokenize(source);
    let at = 0;
    const peek = () => tokens[at];
    const isOp = (...ops) => peek()?.kind === 'op' && ops.includes(peek().value);
    const take = expected => {
      const token = tokens[at++];
      if (expected !== undefined && token?.value !== expected) {
        throw new Error(`Expected ${expected} in ${source}, found ${token?.value}`);
      }
      return token;
    };

    const comparison = () => {
      const left = additive();
      if (!isOp('<', '<=', '>', '>=', '=', '<>')) return left;
      const op = take().value;
      const right = additive();
      return { '<': left < right, '<=': left <= right, '>': left > right, '>=': left >= right, '=': left === right, '<>': left !== right }[op];
    };
    const additive = () => {
      let result = term();
      while (isOp('+', '-')) { const op = take().value; const right = term(); result = op === '+' ? result + right : result - right; }
      return result;
    };
    const term = () => {
      let result = unary();
      while (isOp('*', '/')) { const op = take().value; const right = unary(); result = op === '*' ? result * right : result / right; }
      return result;
    };
    const unary = () => (isOp('-') ? (take(), -unary()) : primary());
    const primary = () => {
      const token = take();
      if (!token) throw new Error(`Formula ends too soon: ${source}`);
      if (token.kind === 'number' || token.kind === 'string') return token.value;
      if (token.kind === 'ref') return isOp(':') ? (take(), range(token.value, take().value)) : value(token.value);
      if (token.kind === 'function') {
        const args = [];
        if (!isOp(')')) { args.push(comparison()); while (isOp(',')) { take(); args.push(comparison()); } }
        take(')');
        return call(token.value, args);
      }
      if (token.value === '(') { const inner = comparison(); take(')'); return inner; }
      throw new Error(`Unexpected ${token.value} in ${source}`);
    };

    const result = comparison();
    if (at !== tokens.length) throw new Error(`Left over in ${source}: ${tokens.slice(at).map(t => t.value).join('')}`);
    return result;
  }

  return { value };
}

const TOLERANCE = { money: 0.05, percent: 1e-9, uvt: 1e-4, count: 0 };

function assertFormulasMatch(sheet, expected, overrides, story) {
  const { value } = evaluatorFor(sheet.spec, overrides);
  for (const [key, { ref, format }] of Object.entries(sheet.resultCells)) {
    const want = sheetValue(expected[key], format);
    const got = value(ref);
    assert.ok(Math.abs(got - want) <= TOLERANCE[format],
      `${story}: ${key} in ${ref} works out to ${got}, the app says ${want}`);
  }
}

// ---------------------------------------------------------------------------

test('every figure the app works out has a cell of its own', () => {
  const sheet = taxSheet(jose(), TODAY);
  const missing = Object.keys(simulate(jose())).filter(key => !sheet.resultCells[key]);
  assert.deepEqual(missing, []);
});

test('the file opens showing exactly the figures the app shows', () => {
  const inputs = jose();
  const result = simulate(inputs);
  const sheet = taxSheet(inputs, TODAY);
  const cells = new Map(sheet.spec.cells.map(cell => [`${columnName(cell.col)}${cell.row}`, cell]));

  for (const [key, { ref, format }] of Object.entries(sheet.resultCells)) {
    assert.equal(cells.get(ref).content.cached, sheetValue(result[key], format), `${key} as stored in ${ref}`);
  }
  // The inputs too, in pesos and fractions rather than cents and scaled rates.
  assert.equal(cells.get(sheet.inputCells.monthlySalaryMinor.ref).content.number, 22_761_765);
  assert.equal(cells.get(sheet.inputCells.baseShareScaled.ref).content.number, 0.7, 'integral salary: 70%');
  assert.equal(cells.get(sheet.monthCells[0]).content.number, 2_861_000);
});

test('each formula works out to the app\'s own figure', () => {
  const inputs = jose();
  assertFormulasMatch(taxSheet(inputs, TODAY), simulate(inputs), new Map(), 'as exported');
});

for (const [story, make] of Object.entries(OTHER_CASES)) {
  test(`the formulas are live: ${story}`, () => {
    // The file exported for Jose's figures, with other figures typed over its
    // yellow boxes - which is what someone editing it in Excel does. The kind
    // of work is not a box in the file (it decides which rows and which
    // dependents rule the file carries), so the file is exported for the
    // kind of work of the case being typed in.
    const other = make();
    const sheet = taxSheet({ ...jose(), employment: other.employment }, TODAY);
    const overrides = new Map();

    for (const [key, { ref, format }] of Object.entries(sheet.inputCells)) {
      overrides.set(ref, sheetValue(effectiveInput(other, key), format));
    }
    other.monthlyWithholdingMinor.forEach((minor, at) => overrides.set(sheet.monthCells[at], minor / 100));
    other.extraWithholdingMinor.forEach((minor, at) => overrides.set(sheet.extraCells[at], minor / 100));

    assertFormulasMatch(sheet, simulate(other), overrides, story);
  });
}

test('only the boxes a person types into are left unlocked', () => {
  const sheet = taxSheet(jose(), TODAY);
  assert.equal(sheet.spec.protect, true);

  const inputRefs = new Set([
    ...Object.values(sheet.inputCells).map(cell => cell.ref), ...sheet.monthCells, ...sheet.extraCells,
  ]);

  for (const cell of sheet.spec.cells) {
    const ref = `${columnName(cell.col)}${cell.row}`;
    const unlocked = TAX_SHEET_STYLES[cell.style]?.unlocked === true;
    assert.ok(TAX_SHEET_STYLES[cell.style], `${ref} uses a style that exists`);
    assert.equal(unlocked, inputRefs.has(ref), `${ref} is ${unlocked ? 'unlocked' : 'locked'}`);
    if (cell.content && 'formula' in cell.content) assert.equal(unlocked, false, `${ref} holds a formula`);
  }
});

test('the file is a sound zip of well-formed parts, in the original\'s colours', () => {
  const bytes = taxWorkbook(jose(), TODAY);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054B50, 'end of central directory');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);

  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = data => {
    let value = 0xFFFFFFFF;
    for (const byte of data) value = table[(value ^ byte) & 0xFF] ^ (value >>> 8);
    return (value ^ 0xFFFFFFFF) >>> 0;
  };

  const decoder = new TextDecoder();
  const parts = new Map();
  for (let entry = 0; entry < count; entry++) {
    assert.equal(view.getUint32(at, true), 0x02014B50, 'central directory entry');
    const expectedCrc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    assert.equal(view.getUint32(offset, true), 0x04034B50, `local header of ${name}`);
    const start = offset + 30 + view.getUint16(offset + 26, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc(data), expectedCrc, `CRC of ${name}`);

    parts.set(name, decoder.decode(data));
    at += 46 + nameLength;
  }

  assert.deepEqual([...parts.keys()].sort(), [
    '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels',
    'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
  ]);

  const parser = new new jsdom.JSDOM('').window.DOMParser();
  for (const [name, text] of parts) {
    const doc = parser.parseFromString(text, 'application/xml');
    assert.equal(doc.getElementsByTagName('parsererror').length, 0, `${name} is well-formed XML`);
    assert.ok(!/NaN|undefined|\[object/.test(text), `${name} holds no placeholder values`);
  }

  const sheet = parts.get('xl/worksheets/sheet1.xml');
  assert.ok(sheet.includes('<sheetProtection sheet="1"'), 'protected');
  assert.ok(sheet.includes('state="frozen"'), 'the title stays in view');
  assert.ok((sheet.match(/<f>/g) ?? []).length > 40, 'formulas, not only figures');
  assert.ok(sheet.includes('SIMULADOR DECLARACI'), 'the original title');

  const styles = parts.get('xl/styles.xml');
  for (const colour of ['1F4E78', '2E75B6', 'D9E1F2', 'FFFFCC', 'C6E0B4', '0000FF']) {
    assert.ok(styles.includes(`FF${colour}`), `the original's ${colour}`);
  }
  assert.ok(styles.includes('<protection locked="0"/>'), 'the typed boxes are unlocked');
});


// ---------------------------------------------------------------------------
// The spreadsheet follows the way casilla 59 was answered: the rows of the
// other way are not on the form, so they are not on the sheet either.

test('a typed casilla 59 exports as a box to type in, not as a percentage', () => {
  const inputs = { ...jose(), capitalNonTaxableTyped: true, capitalNonTaxableTypedMinor: pesos(3_000_000) };
  const sheet = taxSheet(inputs, TODAY);

  assert.ok(sheet.inputCells.capitalNonTaxableTypedMinor, 'the typed figure has a cell');
  assert.equal(sheet.inputCells.financialYieldMinor, undefined, 'the yields row is not on this form');
  assert.equal(sheet.inputCells.inflationaryScaled, undefined, 'nor the percentage');

  assertFormulasMatch(sheet, simulate(inputs), new Map(), 'casilla 59 typed');
});

test('worked out, the sheet keeps the percentage and not the typed box', () => {
  const sheet = taxSheet(jose(), TODAY);
  assert.ok(sheet.inputCells.financialYieldMinor);
  assert.ok(sheet.inputCells.inflationaryScaled);
  assert.equal(sheet.inputCells.capitalNonTaxableTypedMinor, undefined);
});

// ---------------------------------------------------------------------------
// In English the sheet changes words and nothing else: the same cells, the
// same styles, the same formulas. The only formula whose text differs is a
// source's HYPERLINK, whose second argument is the words shown for the link.

const withoutLinkText = formula => formula.replace(/^HYPERLINK\(("(?:[^"]|"")*"),"(?:[^"]|"")*"\)$/, 'HYPERLINK($1)');

for (const [story, inputs] of Object.entries({
  'casilla 59 worked out': () => jose(),
  'casilla 59 typed': () => ({ ...jose(), capitalNonTaxableTyped: true, capitalNonTaxableTypedMinor: pesos(3_000_000) }),
})) {
  test(`the English sheet is the Spanish one in other words: ${story}`, () => {
    const es = taxSheet(inputs(), TODAY, 'es');
    const en = taxSheet(inputs(), TODAY, 'en');

    assert.deepEqual(en.inputCells, es.inputCells);
    assert.deepEqual(en.resultCells, es.resultCells);
    assert.deepEqual(en.monthCells, es.monthCells);
    assert.deepEqual(en.extraCells, es.extraCells);
    assert.deepEqual(en.spec.merges, es.spec.merges);
    assert.equal(en.spec.cells.length, es.spec.cells.length);

    let formulas = 0;
    es.spec.cells.forEach((cell, at) => {
      const other = en.spec.cells[at];
      const ref = `${columnName(cell.col)}${cell.row}`;
      assert.equal(other.row, cell.row, ref);
      assert.equal(other.col, cell.col, ref);
      assert.equal(other.style, cell.style, `${ref} keeps its style`);
      if (cell.content && 'formula' in cell.content) {
        formulas++;
        assert.equal(withoutLinkText(other.content.formula), withoutLinkText(cell.content.formula), `${ref} keeps its formula`);
        if (typeof cell.content.cached === 'number') assert.equal(other.content.cached, cell.content.cached, `${ref} keeps its value`);
      }
      if (cell.content && 'number' in cell.content) assert.equal(other.content.number, cell.content.number, `${ref} keeps its figure`);
    });
    assert.ok(formulas > 40, 'the comparison saw the formulas');

    assertFormulasMatch(en, simulate(inputs()), new Map(), `in English, ${story}`);
  });
}

test('the English sheet speaks English and keeps the DIAN\'s terms', () => {
  const sheet = taxSheet(jose(), TODAY, 'en');
  const texts = sheet.spec.cells.map(cell => cell.content?.text).filter(Boolean);

  assert.equal(sheet.spec.name, 'Income tax 2026');
  assert.ok(texts.includes('Ingresos brutos por rentas de capital (gross capital income)'));
  assert.ok(texts.includes('3. RENTAS DE CAPITAL (CAPITAL INCOME: INTEREST, YIELDS…)  ·  Casillas 58 to 62'));
  assert.ok(texts.includes('Retención en la fuente (withholding tax) — January'));
  assert.ok(texts.includes('Csl. 58'), 'a box keeps its number');
  assert.ok(!texts.includes('Salario mensual bruto'), 'the app\'s own words are English');
});
