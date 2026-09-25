/**
 * The simulation as a spreadsheet, laid out like the one it replaced.
 *
 * Jose kept his tax estimate in `Simulador_Tributario_2026.xlsx` before this
 * app existed, and asked for a way back out to that shape: the same colours,
 * the same titles, yellow for what a person types and plain for what works
 * itself out. So this writes that sheet - built from the same form definition
 * the screen renders, so a box added to the screen is a row added here.
 *
 * Every figure the simulation works out is a real formula, carrying the value
 * the app computed alongside it. Changing a yellow box in Excel moves
 * everything that depends on it, exactly as on the screen, and the tests
 * evaluate each formula against the engine to prove they agree - for these
 * inputs and for others. The formulas are built from the engine's own
 * constants and rate table, never from a second copy of the numbers.
 *
 * The sheet is protected without a password: the calculated cells cannot be
 * typed over by accident, and anyone who really means to can unprotect it.
 *
 * Its words come from `tax-words.ts`, in the language the app is read in:
 * Spanish by default, which is exactly the sheet as it always was. Only words
 * change with the language - which rows exist, where they land and every
 * formula are the same in both, and the tests compare the two.
 */

import { formatMoney } from '../database/money';
import { cellRef, writeXlsx, type CellStyle, type SheetCell, type SheetSpec } from '../xlsx/xlsx-writer';
import {
  CONTRIBUTION_CEILING_WAGES, DEPENDENT_DEDUCTION_SHARE_SCALED, E_INVOICE_SHARE_SCALED,
  NON_SALARY_FREE_SHARE_SCALED,
  EMPLOYMENT_DEFAULTS, MAX_DEPENDENTS, RATE_BANDS, RATE_SCALE, SOLIDARITY_STEPS,
  SOLIDARITY_TOP_RATE_SCALED, simulate,
} from './cedula-general';
import type { Language } from '../i18n/translations';
import { parametersFor, type Sourced } from './defaults';
import { rowApplies, type FieldFormat, type InputKey, type ResultKey, type TaxText } from './tax-form';
import { sourceIn, taxWords, withGloss } from './tax-words';
import type { TaxInputs } from './types';

export { XLSX_MIME } from '../xlsx/xlsx-writer';

// ---------------------------------------------------------------------------
// The look of the original sheet
// ---------------------------------------------------------------------------

const MONEY = '\\$#,##0.00;[Red]\\-\\$#,##0.00';
const PERCENT = '0.00%';

/** The palette and type of `Simulador_Tributario_2026.xlsx`, read from its styles. */
export const TAX_SHEET_STYLES: Record<string, CellStyle> = {
  title: { font: { bold: true, size: 14, color: 'FFFFFF' }, fill: '1F4E78', align: { vertical: 'center', indent: 1 } },
  subtitle: { font: { italic: true, size: 9, color: '808080' } },
  section: { font: { bold: true, size: 11, color: 'FFFFFF' }, fill: '2E75B6', align: { vertical: 'center', indent: 1 } },
  subsection: { font: { bold: true, size: 10 }, fill: 'D9E1F2' },
  label: { font: { size: 10 } },
  labelBold: { font: { bold: true, size: 10 } },
  hint: { font: { italic: true, size: 9, color: '808080' } },
  box: { font: { italic: true, size: 9, color: '808080' }, align: { horizontal: 'center' } },
  note: { font: { italic: true, size: 9, color: '595959' } },
  info: { font: { size: 9, color: '404040' } },
  link: { font: { size: 9, color: '0563C1', underline: true } },

  // What a person types: yellow, in blue, and the only cells left unlocked.
  legendTyped: { font: { size: 10, color: '0000FF' }, fill: 'FFFFCC', border: true },
  inputMoney: { font: { size: 10, color: '0000FF' }, fill: 'FFFFCC', border: true, numberFormat: MONEY, unlocked: true },
  inputPercent: { font: { size: 10, color: '0000FF' }, fill: 'FFFFCC', border: true, numberFormat: PERCENT, unlocked: true },
  inputUvt: { font: { size: 10, color: '0000FF' }, fill: 'FFFFCC', border: true, numberFormat: '#,##0', unlocked: true },
  inputCount: { font: { size: 10, color: '0000FF' }, fill: 'FFFFCC', border: true, numberFormat: '0', unlocked: true },

  // What works itself out: plain, in black.
  legendComputed: { font: { size: 10 }, border: true },
  computedText: { font: { size: 10 }, border: true },
  computedMoney: { font: { size: 10 }, border: true, numberFormat: MONEY },
  computedPercent: { font: { size: 10 }, border: true, numberFormat: PERCENT },
  computedUvt: { font: { size: 10 }, border: true, numberFormat: '#,##0.00' },

  // A total: green, and bold.
  totalMoney: { font: { bold: true, size: 11 }, fill: 'C6E0B4', border: true, numberFormat: MONEY },
  totalPercent: { font: { bold: true, size: 11 }, fill: 'C6E0B4', border: true, numberFormat: PERCENT },
  totalUvt: { font: { bold: true, size: 11 }, fill: 'C6E0B4', border: true, numberFormat: '#,##0.00' },

  bandRate: { font: { size: 10 }, numberFormat: PERCENT },
};

const LABEL = 0;
const VALUE = 1;
const BOX = 2;
const HINT = 4;

// ---------------------------------------------------------------------------
// Figures as the sheet holds them
// ---------------------------------------------------------------------------

/** Pesos rather than cents, fractions rather than scaled rates. */
export function sheetValue(value: number, format: FieldFormat): number {
  if (format === 'money') return value / 100;
  if (format === 'percent') return value / RATE_SCALE;
  return value;
}

/** An input as the simulation uses it: an override, or what the kind of work implies. */
export function effectiveInput(inputs: TaxInputs, key: InputKey): number {
  const stored = (inputs as unknown as Record<string, number | undefined>)[key];
  if (stored !== undefined) return stored;
  if (key === 'baseShareScaled' || key === 'healthScaled' || key === 'pensionScaled') {
    return EMPLOYMENT_DEFAULTS[inputs.employment][key];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// The formulas
// ---------------------------------------------------------------------------

type Ref<K> = (key: K) => string;
interface Ranges { months: string; extra: string }

/** `ROUND(x, 2)`: the engine rounds every rate applied to the nearest cent. */
const cents = (expression: string) => `ROUND(${expression},2)`;
const rate = (scaled: number) => String(scaled / RATE_SCALE);

/** The progressive table of art. 241, as nested IFs over the engine's own bands. */
function taxInUvtFormula(uvt: string): string {
  let formula = '0';
  for (const band of RATE_BANDS) {
    formula = `IF(${uvt}>${band.fromUvt},(${uvt}-${band.fromUvt})*${rate(band.rateScaled)}+${band.plusUvt},${formula})`;
  }
  return formula;
}

/** The solidarity-fund steps, as nested IFs over the engine's own table. */
function solidarityFormula(ratio: string): string {
  let formula = rate(SOLIDARITY_TOP_RATE_SCALED);
  for (const step of [...SOLIDARITY_STEPS].reverse()) {
    formula = `IF(${ratio}<${step.belowWages},${rate(step.rateScaled)},${formula})`;
  }
  return formula;
}

/** The non-salary payments as the engine clamps them: never below 0 nor above the pay. */
const nonSalaryOf = (i: Ref<InputKey>) =>
  `MIN(MAX(${i('nonSalaryMonthlyMinor')},0),MAX(${i('monthlySalaryMinor')},0))`;
/** The 10% of art. 387, only with at least one dependent. */
const tenAvailable = (i: Ref<InputKey>, o: Ref<ResultKey>) =>
  `IF(${i('dependents')}>0,MIN(${cents(`${o('grossLabourMinor')}*${rate(DEPENDENT_DEDUCTION_SHARE_SCALED)}`)},`
  + `${i('dependentMonthlyCapUvt')}*${i('uvtMinor')}*12),0)`;
/** 72 UVT a dependent, at most four. */
const perDependent = (i: Ref<InputKey>) =>
  `MIN(MAX(${i('dependents')},0),${MAX_DEPENDENTS})*${i('dependentUvt')}*${i('uvtMinor')}`;

/**
 * One formula per figure the engine works out, mirroring `simulate` line for
 * line. Typed as a record over every result key, so a figure added to the
 * engine without a formula here does not compile.
 */
const FORMULAS: Record<ResultKey, (i: Ref<InputKey>, o: Ref<ResultKey>, ranges: Ranges, inputs: TaxInputs) => string> = {
  grossLabourMinor: i => `${i('monthlySalaryMinor')}*${i('monthsWorked')}+${i('otherLabourIncomeMinor')}`,
  // An employee's non-salary payments leave the salary part, and what of them
  // passes 40% of the pay comes back on top; someone independent has neither.
  nonSalaryExcessMinor: (i, _o, _ranges, inputs) => inputs.employment === 'independent' ? '0'
    : `MAX(${nonSalaryOf(i)}-${cents(`${i('monthlySalaryMinor')}*${rate(NON_SALARY_FREE_SHARE_SCALED)}`)},0)`,
  monthlyBaseMinor: (i, o, _ranges, inputs) => {
    const independent = inputs.employment === 'independent';
    const part = independent ? i('monthlySalaryMinor') : `(${i('monthlySalaryMinor')}-${nonSalaryOf(i)})`;
    const added = independent ? '' : `+${o('nonSalaryExcessMinor')}`;
    const share = `${cents(`${part}*${i('baseShareScaled')}`)}${added}`;
    const wage = i('minimumWageMinor');
    return `IF(${part}${added}<=0,0,IF(${wage}<=0,${share},`
      + `MIN(MAX(${share},${wage}),${wage}*${CONTRIBUTION_CEILING_WAGES})))`;
  },
  solidarityRateScaled: (i, o) =>
    `IF(${i('minimumWageMinor')}<=0,${i('solidarityScaled')},`
    + `${solidarityFormula(`${o('monthlyBaseMinor')}/${i('minimumWageMinor')}`)})`,
  healthMinor: (i, o) => `${cents(`${o('monthlyBaseMinor')}*${i('healthScaled')}`)}*${i('monthsWorked')}`,
  pensionMinor: (i, o) => `${cents(`${o('monthlyBaseMinor')}*${i('pensionScaled')}`)}*${i('monthsWorked')}`,
  solidarityMinor: (i, o) => `${cents(`${o('monthlyBaseMinor')}*${o('solidarityRateScaled')}`)}*${i('monthsWorked')}`,
  contributionsMinor: (_, o) => `${o('healthMinor')}+${o('pensionMinor')}+${o('solidarityMinor')}`,
  labourNetMinor: (_, o) => `${o('grossLabourMinor')}-${o('contributionsMinor')}`,

  // Either way of answering casilla 59 is a different formula over different
  // cells, and only the cells of the way chosen are on the sheet.
  capitalNonTaxableMinor: (i, _o, _ranges, inputs) =>
    inputs.capitalNonTaxableTyped
      ? `MIN(${i('capitalNonTaxableTypedMinor')},${i('capitalIncomeMinor')})`
      : `MIN(${cents(`${i('financialYieldMinor')}*${i('inflationaryScaled')}`)},${i('capitalIncomeMinor')})`,
  capitalNetMinor: (i, o) =>
    `MAX(${i('capitalIncomeMinor')}-${o('capitalNonTaxableMinor')}-${i('capitalCostsMinor')},0)`,
  feeNetMinor: i =>
    `MAX(${i('feeIncomeMinor')}-${i('feeNonTaxableMinor')}-${i('feeCostsMinor')},0)`,
  otherNetMinor: i => `${i('otherIncomeMinor')}-${i('otherCostsMinor')}`,
  generalNetMinor: (i, o) =>
    `${o('labourNetMinor')}+${o('feeNetMinor')}+${o('capitalNetMinor')}`
    + `+${i('passiveCapitalMinor')}+${o('otherNetMinor')}`,

  voluntaryMinor: i => `${i('voluntaryPayrollMinor')}+${i('voluntaryOwnMinor')}`,
  labourExemptMinor: (i, o) =>
    `MIN(${cents(`${o('labourNetMinor')}*${i('labourExemptScaled')}`)},${i('labourExemptCapUvt')}*${i('uvtMinor')})`,
  // The 10% needs a dependent. Independent: the 10% only where it lowers the
  // base at least as much as the UVT per dependent would (the engine's rule).
  dependentDeductionMinor: (i, o, _ranges, inputs) => {
    const ten = tenAvailable(i, o);
    if (inputs.employment !== 'independent') return ten;
    const others = `(${o('voluntaryMinor')}+${i('housingInterestMinor')}+${o('labourExemptMinor')}`
      + `+${o('healthPolicyMinor')}+${i('otherDeductionsMinor')})`;
    const gain = `(MIN(${others}+${ten},${o('capMinor')})-MIN(${others},${o('capMinor')}))`;
    return `IF(${gain}>=${perDependent(i)},${ten},0)`;
  },
  healthPolicyMinor: i => `MIN(${i('healthPolicyMinor')},${i('healthPolicyCapUvt')}*${i('uvtMinor')}*12)`,
  beforeCapMinor: (i, o) =>
    `${o('voluntaryMinor')}+${i('housingInterestMinor')}+${o('labourExemptMinor')}`
    + `+${o('dependentDeductionMinor')}+${o('healthPolicyMinor')}+${i('otherDeductionsMinor')}`,
  capMinor: (i, o) =>
    `MIN(${cents(`${o('generalNetMinor')}*${i('globalCapScaled')}`)},${i('globalCapUvt')}*${i('uvtMinor')})`,
  cappedMinor: (_, o) => `MIN(${o('beforeCapMinor')},${o('capMinor')})`,

  dependentsMinor: (i, o, _ranges, inputs) => inputs.employment !== 'independent' ? perDependent(i)
    : `IF(${o('dependentDeductionMinor')}=0,${perDependent(i)},0)`,
  eInvoiceMinor: i =>
    `MIN(${cents(`${i('eInvoicePurchasesMinor')}*${rate(E_INVOICE_SHARE_SCALED)}`)},${i('eInvoiceCapUvt')}*${i('uvtMinor')})`,
  deductionsMinor: (_, o) => `${o('cappedMinor')}+${o('dependentsMinor')}+${o('eInvoiceMinor')}`,

  taxableMinor: (_, o) => `${o('generalNetMinor')}-${o('deductionsMinor')}`,
  taxableUvt: (i, o) => `IF(${i('uvtMinor')}=0,0,${o('taxableMinor')}/${i('uvtMinor')})`,
  taxMinor: (i, o) => `${cents(`(${taxInUvtFormula(o('taxableUvt'))})*${i('uvtMinor')}`)}+${i('occasionalTaxMinor')}`,

  monthlyWithheldMinor: (_, __, ranges) => `SUM(${ranges.months})`,
  extraWithheldMinor: (_, __, ranges) => `SUM(${ranges.extra})`,
  withheldMinor: (_, o) => `${o('monthlyWithheldMinor')}+${o('extraWithheldMinor')}`,
  creditedMinor: (i, o) => `${o('withheldMinor')}+${i('creditFromLastYearMinor')}+${i('advancePaidMinor')}`,
  toPayMinor: (_, o) => `MAX(${o('taxMinor')}-${o('creditedMinor')},0)`,
  inFavourMinor: (_, o) => `MAX(${o('creditedMinor')}-${o('taxMinor')},0)`,

  savePerMonthMinor: (_, o) => cents(`${o('toPayMinor')}/12`),
  contributionsPerMonthMinor: (_, o) => cents(`${o('contributionsMinor')}/12`),
  voluntaryPerMonthMinor: (_, o) => cents(`${o('voluntaryMinor')}/12`),
  withheldPerMonthMinor: (_, o) => cents(`${o('withheldMinor')}/12`),
  voluntaryMissingPerMonthMinor: (_, o) => cents(`MAX(${o('voluntaryOptimalMinor')}-${o('voluntaryMinor')},0)/12`),
  grossPerMonthMinor: (i, o) =>
    cents(`(${o('grossLabourMinor')}+${i('feeIncomeMinor')}+${i('capitalIncomeMinor')}+${i('otherIncomeMinor')})/12`),
  netPerMonthMinor: (_, o) =>
    `${o('grossPerMonthMinor')}-${cents(`${o('contributionsMinor')}/12`)}`
    + `-${cents(`${o('voluntaryMinor')}/12`)}-${cents(`${o('withheldMinor')}/12`)}`,

  roomMinor: (i, o) =>
    `MAX(${o('capMinor')}-(${i('housingInterestMinor')}+${o('labourExemptMinor')}+${o('dependentDeductionMinor')}`
    + `+${o('healthPolicyMinor')}+${i('otherDeductionsMinor')}),0)`,
  voluntaryCeilingMinor: (i, o) =>
    `MIN(${i('voluntaryCapUvt')}*${i('uvtMinor')},`
    + `${cents(`(${o('grossLabourMinor')}+${i('feeIncomeMinor')}+${i('capitalIncomeMinor')}+${i('otherIncomeMinor')})*${i('voluntaryIncomeShareScaled')}`)})`,
  voluntaryOptimalMinor: (_, o) => `MIN(${o('roomMinor')},${o('voluntaryCeilingMinor')})`,
  voluntaryMissingMinor: (_, o) => `MAX(${o('voluntaryOptimalMinor')}-${o('voluntaryMinor')},0)`,
};

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export interface TaxSheet {
  spec: SheetSpec;
  /** Where each input landed, and how it is written there. */
  inputCells: Partial<Record<InputKey, { ref: string; format: FieldFormat }>>;
  /** Where each calculated figure landed - its first appearance. */
  resultCells: Partial<Record<ResultKey, { ref: string; format: FieldFormat }>>;
  monthCells: string[];
  extraCells: string[];
}

export function taxWorkbook(
  inputs: TaxInputs, today: Date = new Date(), language: Language = 'es',
): Uint8Array<ArrayBuffer> {
  return writeXlsx(taxSheet(inputs, today, language).spec, TAX_SHEET_STYLES);
}

export function taxSheet(inputs: TaxInputs, today: Date = new Date(), language: Language = 'es'): TaxSheet {
  const words = taxWords(language);
  const text = words.text;
  const result = simulate(inputs);
  const parameters = parametersFor(inputs.year, today);

  const cells: SheetCell[] = [];
  const merges: string[] = [];
  const rowHeights: Record<number, number> = {};
  const inputCells: TaxSheet['inputCells'] = {};
  const resultCells: TaxSheet['resultCells'] = {};
  const monthCells: string[] = [];
  const extraCells: string[] = [];
  const formulas: { cell: SheetCell; build: () => string; cached: number | string }[] = [];

  let row = 0;
  const next = () => ++row;
  const put = (at: number, col: number, style: string, content?: SheetCell['content']): SheetCell => {
    const cell = { row: at, col, style, content };
    cells.push(cell);
    return cell;
  };

  /** A line across the whole sheet, merged, in one style. */
  const band = (style: string, text: string, height?: number): number => {
    const at = next();
    put(at, LABEL, style, { text });
    for (let col = 1; col <= HINT; col++) put(at, col, style);
    merges.push(`A${at}:E${at}`);
    if (height) rowHeights[at] = height;
    return at;
  };

  const blank = () => next();

  /**
   * A box to type into. `key` is null for an entry of a list - a month of
   * withholding - which is tracked by position and passes its own value.
   */
  const input = (
    key: InputKey | null, format: FieldFormat, label: string,
    box?: string, hint?: string, value?: number,
  ): string => {
    const at = next();
    put(at, LABEL, 'label', { text: label });
    const raw = value ?? (key ? effectiveInput(inputs, key) : 0);
    put(at, VALUE, `input${capitalise(format)}`, { number: sheetValue(raw, format) });
    if (box) put(at, BOX, 'box', { text: fill(text.sheetBox, { box }) });
    if (hint) put(at, HINT, 'hint', { text: hint });

    const ref = cellRef(at, VALUE);
    if (key) inputCells[key] ??= { ref, format };
    return ref;
  };

  const i: Ref<InputKey> = key => {
    const found = inputCells[key];
    if (!found) throw new Error(`The sheet has no cell for the input ${key}`);
    return found.ref;
  };
  const o: Ref<ResultKey> = key => {
    const found = resultCells[key];
    if (!found) throw new Error(`The sheet has no cell for the figure ${key}`);
    return found.ref;
  };

  // ---- Title, legend, and the answer -------------------------------------

  band('title', text.sheetTitle, 26);
  band('subtitle', fill(text.sheetSubtitle, { year: inputs.year, date: isoDate(today) }));
  band('subtitle', text.sheetBoxColumn);
  const frozenRows = row;
  blank();

  const legend = (style: string, sample: string, text: string) => {
    const at = next();
    put(at, LABEL, style, { text: sample });
    put(at, VALUE, 'label', { text });
    merges.push(`B${at}:E${at}`);
  };
  legend('legendTyped', text.legendTyped, text.sheetLegendTyped);
  legend('legendComputed', text.legendComputed, text.sheetLegendComputed);
  blank();

  const summary: { label: string; key: ResultKey }[] = [
    { label: text.toPay, key: 'toPayMinor' },
    { label: text.inFavour, key: 'inFavourMinor' },
    { label: text.sheetSavePerMonth, key: 'savePerMonthMinor' },
  ];
  band('section', text.sheetSummary.toUpperCase(), 20);
  for (const line of summary) {
    const at = next();
    put(at, LABEL, 'labelBold', { text: line.label });
    const cell = put(at, VALUE, 'totalMoney');
    formulas.push({ cell, build: () => o(line.key), cached: sheetValue(result[line.key], 'money') });
  }

  // ---- The form, section by section -------------------------------------

  for (const section of words.form) {
    blank();
    band('section', withGloss(section.title, section.titleGloss).toUpperCase()
      + (section.subtitle ? `  ·  ${section.subtitle}` : ''), 20);

    for (const formRow of section.rows) {
      // The rows of the way casilla 59 was not answered are not part of this
      // person's form, so they are not part of their spreadsheet either.
      if (!rowApplies(formRow.when, inputs)) continue;

      switch (formRow.kind) {
        case 'input':
          input(formRow.key, formRow.format, withGloss(formRow.label, formRow.gloss), formRow.box, formRow.hint);
          break;

        case 'computed': {
          const at = next();
          put(at, LABEL, formRow.total ? 'labelBold' : 'label', { text: withGloss(formRow.label, formRow.gloss) });
          const style = `${formRow.total ? 'total' : 'computed'}${capitalise(formRow.format)}`;
          const cell = put(at, VALUE, style);
          if (formRow.box) put(at, BOX, 'box', { text: fill(text.sheetBox, { box: formRow.box }) });
          if (formRow.hint) put(at, HINT, 'hint', { text: formRow.hint });

          const key = formRow.key;
          const cached = sheetValue((result as unknown as Record<ResultKey, number>)[key], formRow.format);
          if (resultCells[key]) {
            // The same figure shown twice points at its first cell.
            const first = resultCells[key]!.ref;
            formulas.push({ cell, build: () => first, cached });
          } else {
            resultCells[key] = { ref: cellRef(at, VALUE), format: formRow.format };
            formulas.push({ cell, build: () => FORMULAS[key](i, o, ranges, inputs), cached });
          }
          break;
        }

        case 'note':
          if (section.id === 'notes') band('note', `- ${formRow.text}`);
          else band('subsection', formRow.text);
          break;

        case 'special':
          switch (formRow.which) {
            case 'references':
              for (const [label, shown, sourced] of [
                [text.refUvt, money(parameters.uvt.value), parameters.uvt],
                [text.refMinimumWage, money(parameters.minimumWage.value), parameters.minimumWage],
                [text.refInflationary, percent(parameters.inflationary.value), parameters.inflationary],
              ] as const) {
                band('info', referenceLine(text, language, label, shown, sourced));
              }
              break;

            case 'inflationaryMode':
              band('info', `${text.sheetInflationaryMode}: ${inputs.capitalNonTaxableTyped
                ? text.inflationaryModeTyped : text.inflationaryModeWorked}`);
              break;

            case 'inflationReference':
              band('info', referenceLine(
                text, language, text.refInflationary,
                percent(parameters.inflationary.value), parameters.inflationary));
              break;

            case 'employment': {
              const at = next();
              put(at, LABEL, 'label', { text: text.sheetEmployment });
              put(at, VALUE, 'computedText', { text: words.employment[inputs.employment].title });
              put(at, HINT, 'hint', { text: words.employment[inputs.employment].detail });
              // The kind of work is words; what the arithmetic uses is the
              // share of the salary contributed on, so that is the cell.
              input('baseShareScaled', 'percent', text.sheetBaseShare, undefined, text.sheetBaseShareHint);
              break;
            }

            case 'rateTable': {
              const head = next();
              put(head, LABEL, 'labelBold', { text: text.sheetRateRange });
              put(head, VALUE, 'labelBold', { text: text.sheetRateMarginal });
              put(head, BOX, 'labelBold', { text: text.sheetRateFormula });
              merges.push(`C${head}:E${head}`);
              for (const bandRow of RATE_BANDS) {
                const at = next();
                put(at, LABEL, 'label', { text: fill(text.rateBand, { from: bandRow.fromUvt.toLocaleString('es-CO') }) });
                put(at, VALUE, 'bandRate', { number: bandRow.rateScaled / RATE_SCALE });
                put(at, BOX, 'hint', {
                  text: fill(text.sheetRateRow, {
                    from: bandRow.fromUvt, rate: bandRow.rateScaled / 10_000, plus: bandRow.plusUvt,
                  }),
                });
                merges.push(`C${at}:E${at}`);
              }
              break;
            }

            case 'monthlyWithholding':
              words.months.forEach((month, at) => {
                monthCells.push(input(
                  null, 'money', fill(text.sheetMonth, { month }), undefined, undefined,
                  inputs.monthlyWithholdingMinor[at] ?? 0));
              });
              break;

            case 'extraWithholding':
              for (let at = 0; at < 4; at++) {
                const concept = inputs.extraWithholdingLabels?.[at];
                const label = fill(text.sheetExtra, { n: at + 1 }) + (concept ? `: ${concept}` : '');
                extraCells.push(input(
                  null, 'money', label, undefined, undefined,
                  inputs.extraWithholdingMinor[at] ?? 0));
              }
              break;

            case 'sources': {
              const caption = next();
              put(caption, LABEL, 'labelBold', { text: text.sourcesTitle });
              for (const source of words.sources) {
                const at = next();
                const cell = put(at, LABEL, 'link');
                for (let col = 1; col <= HINT; col++) put(at, col, 'link');
                merges.push(`A${at}:E${at}`);
                formulas.push({
                  cell,
                  build: () => `HYPERLINK("${quote(source.url)}","${quote(source.label)}")`,
                  cached: source.label,
                });
              }
              break;
            }

            // Bringing figures in from the app has no meaning in a file.
            case 'salaryPrefill':
            case 'yieldsPrefill':
              break;
          }
          break;
      }
    }
  }

  blank();
  band('note', text.disclaimer);

  const ranges: Ranges = {
    months: `${monthCells[0]}:${monthCells[monthCells.length - 1]}`,
    extra: `${extraCells[0]}:${extraCells[extraCells.length - 1]}`,
  };

  for (const pending of formulas) {
    pending.cell.content = { formula: pending.build(), cached: pending.cached };
  }

  return {
    spec: {
      name: fill(text.sheetName, { year: inputs.year }),
      columnWidths: [62, 20, 12, 2, 100],
      cells,
      merges,
      rowHeights,
      frozenRows,
      protect: true,
    },
    inputCells,
    resultCells,
    monthCells,
    extraCells,
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function referenceLine(
  text: TaxText, language: Language, label: string, shown: string, sourced: Sourced,
): string {
  const standing = sourced.standing === 'official' ? text.standingOfficial
    : sourced.standing === 'estimate' ? text.standingEstimate
    : fill(text.standingReference, { year: sourced.fromYear });
  return `${label}: ${shown} · ${standing} · ${sourceIn(sourced, language)}`;
}

function money(minor: number): string {
  return formatMoney(minor, 'COP');
}

function percent(scaled: number): string {
  return `${(scaled / 10_000).toFixed(2).replace('.', ',')}%`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function quote(text: string): string {
  return text.replace(/"/g, '""');
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole);
}
