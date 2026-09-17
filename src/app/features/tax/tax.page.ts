/**
 * The income-tax simulator.
 *
 * One screen, laid out like the form it simulates: boxes you type into, and
 * boxes that fill themselves in as you do. Jose asked for exactly that rather
 * than a sequence of steps, and it is the right call - a return is not a
 * wizard, it is a page where changing one figure moves twenty others, and
 * seeing them move is how a person understands what a figure does.
 *
 * Nothing waits for a Save button. Every change is written a moment after the
 * typing stops, per tax year, because this is a form filled in over months and
 * a figure lost to a forgotten tap is a figure typed twice.
 *
 * Words live in `core/tax/tax-form.ts`, in Spanish, as the project's language
 * rule says the tax module should.
 */

import { Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
  IonMenuButton, IonSpinner, IonModal, IonList, IonItem, IonLabel, IonNote,
} from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { formatMoney, parseTypedAmountToMinor } from '../../core/database/money';
import { groupTypedAmount } from '../../core/database/typed-amount';
import { parsePercentToScaled } from '../../core/yields/yield-math';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { TransactionsRepository } from '../../core/database/repositories/transactions.repository';
import { YieldsRepository } from '../../core/database/repositories/yields.repository';
import { TaxSimulationsRepository } from '../../core/database/repositories/tax-simulations.repository';
import { EMPLOYMENT_DEFAULTS, RATE_BANDS, simulate } from '../../core/tax/cedula-general';
import {
  SPREADSHEET_2026, SPREADSHEET_2026_OWNER_ACCOUNT,
  borrowedFromLater, defaultInputs, fillGaps, parametersFor, useThisYearsParameters, type Sourced,
} from '../../core/tax/defaults';
import {
  EMPLOYMENT_TEXT, MONTH_NAMES, TAX_FORM, TAX_SOURCES, TAX_TEXT, rowApplies,
  type FieldFormat, type FormRow, type InputKey, type ResultKey,
} from '../../core/tax/tax-form';
import type { EmploymentKind, TaxInputs } from '../../core/tax/types';
import { taxWorkbook, XLSX_MIME } from '../../core/tax/tax-workbook';
import { saveFile } from '../../core/files/save-file';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';

/** A category the salary could be recorded under, with what it holds this year. */
interface SalaryOption {
  id: number;
  name: string;
  totalMinor: number;
  count: number;
}

@Component({
  selector: 'app-tax',
  templateUrl: './tax.page.html',
  styleUrls: ['./tax.page.scss'],
  imports: [
    LanguageButtonComponent, BusyOverlayComponent,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon,
    IonMenuButton, IonSpinner, IonModal, IonList, IonItem, IonLabel, IonNote,
  ],
})
export class TaxPage {
  readonly database = inject(DatabaseService);
  readonly status = this.database.status;

  readonly text = TAX_TEXT;
  readonly sources = TAX_SOURCES;
  readonly sections = TAX_FORM;
  readonly bands = RATE_BANDS;
  readonly months = MONTH_NAMES;
  readonly employmentText = EMPLOYMENT_TEXT;
  readonly employmentKinds: EmploymentKind[] = ['ordinary', 'integral', 'independent'];

  readonly year = signal(new Date().getFullYear());
  readonly inputs = signal<TaxInputs>(defaultInputs(new Date().getFullYear()));

  /** The year's UVT, minimum wage and inflationary component, with their standing. */
  readonly parameters = computed(() => parametersFor(this.year()));

  /** The same three, ready to print: what each is, its figure, and where it came from. */
  readonly references = computed(() => {
    const p = this.parameters();
    return [
      { label: this.text.refUvt, shown: '$ ' + this.format(p.uvt.value, 'money'), sourced: p.uvt },
      { label: this.text.refMinimumWage, shown: '$ ' + this.format(p.minimumWage.value, 'money'), sourced: p.minimumWage },
      { label: this.text.refInflationary, shown: this.percent(p.inflationary.value), sourced: p.inflationary },
    ];
  });

  /** The whole form, worked out again on every keystroke. It is cheap. */
  readonly result = computed(() => simulate(this.inputs()));

  readonly owes = computed(() => this.result().toPayMinor > 0);
  readonly refund = computed(() => this.result().inFavourMinor > 0);

  /** Which band of art. 241 the taxable income falls in, for the table. */
  readonly activeBand = computed(() => {
    const uvt = this.result().taxableUvt;
    let at = 0;
    this.bands.forEach((band, index) => { if (uvt > band.fromUvt) at = index; });
    return at;
  });

  readonly saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  readonly salarySheet = signal(false);
  readonly salaryOptions = signal<SalaryOption[]>([]);
  readonly salaryNotice = signal('');
  readonly yieldsNotice = signal('');
  readonly excelNotice = signal('');

  /** Set while the spreadsheet is being written, which holds the screen. */
  readonly busyLabel = signal('');

  /**
   * What is being typed into a field, while it is being typed.
   *
   * Without it every keystroke would be parsed and written back formatted,
   * and "22.7" would become "22,70" under the cursor. The figure behind it
   * still updates as the typing goes on, so the rest of the form follows.
   */
  private readonly drafts = signal<ReadonlyMap<string, string>>(new Map());

  private readonly closed = signal<ReadonlySet<string>>(
    new Set(TAX_FORM.filter(section => section.collapsed).map(section => section.id)));

  private pending: { year: number; inputs: TaxInputs } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const ready = this.database.status() === 'ready';
      const year = this.year();
      untracked(() => { if (ready) void this.load(year); });
    });
  }

  // ---------------------------------------------------------------------------
  // Loading and saving
  // ---------------------------------------------------------------------------

  private simulations(): TaxSimulationsRepository {
    return new TaxSimulationsRepository(this.database.driver);
  }

  /**
   * Opens a year, filling its empty boxes the first time it is opened.
   *
   * Never zero where a reasonable figure exists - Jose's rule for this module.
   * The year's parameters go into any that are empty: official where
   * published, borrowed from last year or estimated where not. And for 2026,
   * on his own database only, the figures of the spreadsheet he has been
   * keeping.
   *
   * Only boxes still at zero are touched, and only once per year, so nothing
   * typed is ever replaced and a zero set on purpose afterwards stays zero.
   */
  private async load(year: number): Promise<void> {
    const repo = this.simulations();
    let inputs = (await repo.get(year)) ?? defaultInputs(year);

    if (!(await repo.gapsFilled(year))) {
      const p = parametersFor(year);
      const references: Partial<TaxInputs> = {
        uvtMinor: p.uvt.value,
        minimumWageMinor: p.minimumWage.value,
        inflationaryScaled: p.inflationary.value,
      };
      if (year === 2026 && await repo.hasAccountNamed(SPREADSHEET_2026_OWNER_ACCOUNT)) {
        Object.assign(references, SPREADSHEET_2026);
      }

      inputs = fillGaps(inputs, references);
      await repo.save(year, inputs);
      await repo.markGapsFilled(year);
    }

    // A year opened before the module knew one year from another was filled
    // with the current year's UVT and minimum wage. Its own go back in.
    const corrected = useThisYearsParameters(inputs);
    if (corrected !== inputs
        && (corrected.uvtMinor !== inputs.uvtMinor
            || corrected.minimumWageMinor !== inputs.minimumWageMinor)) {
      inputs = corrected;
      await repo.save(year, inputs);
    }

    this.inputs.set(inputs);
    this.drafts.set(new Map());
    this.salaryNotice.set('');
    this.yieldsNotice.set('');
    this.saveState.set('idle');
    this.remeasure();
  }

  /** Written a moment after the typing stops, for the year it was typed in. */
  private schedule(): void {
    this.pending = { year: this.year(), inputs: this.inputs() };
    this.saveState.set('saving');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 700);
  }

  private async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const pending = this.pending;
    if (!pending) return;
    this.pending = null;
    await this.simulations().save(pending.year, pending.inputs);
    this.saveState.set('saved');
  }

  async stepYear(by: number): Promise<void> {
    await this.flush();
    this.year.update(year => year + by);
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  isOpen(id: string): boolean {
    return !this.closed().has(id);
  }

  toggle(id: string): void {
    this.closed.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    this.remeasure();
  }

  readonly allCollapsed = computed(() => this.closed().size === TAX_FORM.length);

  /** Folds every section, or opens every one when they are all folded already. */
  toggleAll(): void {
    this.closed.set(this.allCollapsed()
      ? new Set()
      : new Set(TAX_FORM.map(section => section.id)));
    this.remeasure();
  }

  // ---------------------------------------------------------------------------
  // Moving through a long form
  // ---------------------------------------------------------------------------

  /**
   * The same floating controls as the movements list: to the top, fold or
   * open everything, to the bottom.
   *
   * Unlike the list, the fold control stays in view all the time - this form
   * has no fold button of its own at the top to stand in for it, and Jose
   * asked for it fixed. The arrows keep their place when they have nothing to
   * do, so the button between them never moves under the thumb.
   */
  private readonly content = viewChild<IonContent>('form');
  readonly atTop = signal(true);
  readonly atBottom = signal(false);

  /** Re-reads the position, writing a signal only when an answer changes. */
  private async measure(): Promise<void> {
    const content = this.content();
    if (!content) return;

    const element = await content.getScrollElement();
    const top = element.scrollTop <= 4;
    const bottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 4;

    if (top !== this.atTop()) this.atTop.set(top);
    if (bottom !== this.atBottom()) this.atBottom.set(bottom);
  }

  /** Folding changes how tall the form is, and no scroll event says so. */
  private remeasure(): void {
    setTimeout(() => void this.measure(), 0);
  }

  onScroll(): void {
    void this.measure();
  }

  async toTop(): Promise<void> {
    await this.content()?.scrollToTop(300);
    await this.measure();
  }

  async toBottom(): Promise<void> {
    await this.content()?.scrollToBottom(300);
    await this.measure();
  }

  // ---------------------------------------------------------------------------
  // Typed fields
  // ---------------------------------------------------------------------------

  /**
   * The value behind an input row.
   *
   * Three of them - what is contributed on, and at which rates - are
   * overrides: while nobody has typed one, the figure comes from the kind of
   * work, and changing the kind of work changes it.
   */
  private valueOf(key: InputKey): number {
    const inputs = this.inputs();
    const stored = (inputs as unknown as Record<string, number | undefined>)[key];
    if (stored !== undefined) return stored;

    const rules = EMPLOYMENT_DEFAULTS[inputs.employment];
    if (key === 'healthScaled') return rules.healthScaled;
    if (key === 'pensionScaled') return rules.pensionScaled;
    if (key === 'baseShareScaled') return rules.baseShareScaled;
    return 0;
  }

  fieldText(row: FormRow): string {
    if (row.kind !== 'input') return '';
    return this.drafts().get(row.key) ?? this.format(this.valueOf(row.key), row.format);
  }

  onField(row: FormRow, raw: string): void {
    if (row.kind !== 'input') return;
    this.draft(row.key, raw);

    const parsed = this.parse(raw, row.format);
    if (parsed === null) return;

    this.inputs.update(inputs => ({ ...inputs, [row.key]: parsed }));
    this.schedule();
  }

  endDraft(key: string): void {
    this.drafts.update(current => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }

  private draft(key: string, raw: string): void {
    this.drafts.update(current => new Map(current).set(key, raw));
  }

  computedText(row: FormRow): string {
    if (row.kind !== 'computed') return '';
    const value = (this.result() as unknown as Record<ResultKey, number>)[row.key];
    return this.format(value, row.format, true);
  }

  // ---------------------------------------------------------------------------
  // Employment
  // ---------------------------------------------------------------------------

  /**
   * Switches the kind of work, and drops any rate typed for the previous one.
   *
   * A 12.5% health rate typed for a contract has no business surviving a
   * switch to a salary, where the person pays 4%: the rates follow the kind of
   * work unless someone types them again.
   */
  /**
   * Which way casilla 59 is answered: worked out from the yields, or typed.
   *
   * The rows of the other way leave the form rather than being greyed out, and
   * whatever was typed into them stays where it is - switching back finds it
   * as it was left.
   */
  setInflationaryTyped(typed: boolean): void {
    this.inputs.update(inputs => ({ ...inputs, capitalNonTaxableTyped: typed }));
    this.schedule();
  }

  /** Whether a row belongs on the form as it is being filled in. */
  shows(row: FormRow): boolean {
    return rowApplies(row.when, this.inputs().capitalNonTaxableTyped === true);
  }

  setEmployment(kind: EmploymentKind): void {
    this.inputs.update(inputs => ({
      ...inputs,
      employment: kind,
      baseShareScaled: undefined,
      healthScaled: undefined,
      pensionScaled: undefined,
    }));
    for (const key of ['baseShareScaled', 'healthScaled', 'pensionScaled']) this.endDraft(key);
    this.schedule();
  }

  // ---------------------------------------------------------------------------
  // Monthly and extra withholding
  // ---------------------------------------------------------------------------

  monthText(index: number): string {
    return this.drafts().get(`month${index}`)
      ?? this.format(this.inputs().monthlyWithholdingMinor[index] ?? 0, 'money');
  }

  onMonth(index: number, raw: string): void {
    this.draft(`month${index}`, raw);
    const parsed = this.parse(raw, 'money');
    if (parsed === null) return;

    this.inputs.update(inputs => {
      const months = [...inputs.monthlyWithholdingMinor];
      months[index] = parsed;
      return { ...inputs, monthlyWithholdingMinor: months };
    });
    this.schedule();
  }

  extraText(index: number): string {
    return this.drafts().get(`extra${index}`)
      ?? this.format(this.inputs().extraWithholdingMinor[index] ?? 0, 'money');
  }

  extraLabel(index: number): string {
    return this.inputs().extraWithholdingLabels?.[index] ?? '';
  }

  onExtra(index: number, raw: string): void {
    this.draft(`extra${index}`, raw);
    const parsed = this.parse(raw, 'money');
    if (parsed === null) return;

    this.inputs.update(inputs => {
      const extra = [...inputs.extraWithholdingMinor];
      extra[index] = parsed;
      return { ...inputs, extraWithholdingMinor: extra };
    });
    this.schedule();
  }

  onExtraLabel(index: number, label: string): void {
    this.inputs.update(inputs => {
      const labels = [...(inputs.extraWithholdingLabels ?? ['', '', '', ''])];
      labels[index] = label;
      return { ...inputs, extraWithholdingLabels: labels };
    });
    this.schedule();
  }

  // ---------------------------------------------------------------------------
  // Brought in from the app, as a starting point
  // ---------------------------------------------------------------------------

  /**
   * The income categories with anything recorded in the year, largest first.
   *
   * The person says which one is their salary rather than the app guessing
   * from a name - the same lesson as the default product, which was matched by
   * name for one commit and should never have been.
   */
  async openSalary(): Promise<void> {
    const year = this.year();
    const driver = this.database.driver;

    const [categories, totals] = await Promise.all([
      new CategoriesRepository(driver).list({ kind: 'income' }),
      new TransactionsRepository(driver).totalsByCategory({
        from: `${year}-01-01`, to: `${year}-12-31`,
      }),
    ]);

    const byId = new Map(totals.map(row => [row.category_id, row]));
    this.salaryOptions.set(categories
      .map(category => ({
        id: category.id,
        name: category.name,
        totalMinor: byId.get(category.id)?.total_base_minor ?? 0,
        count: byId.get(category.id)?.count ?? 0,
      }))
      .filter(option => option.totalMinor > 0)
      .sort((a, b) => b.totalMinor - a.totalMinor));

    this.salarySheet.set(true);
  }

  /**
   * Spreads what was recorded across the months worked.
   *
   * It is the net, and the form wants the gross, so the notice says so in as
   * many words. What this saves is the typing, not the thinking.
   */
  useSalary(option: SalaryOption): void {
    const months = Math.max(1, this.inputs().monthsWorked || 12);
    const monthly = Math.round(option.totalMinor / months);

    this.inputs.update(inputs => ({ ...inputs, monthlySalaryMinor: monthly }));
    this.endDraft('monthlySalaryMinor');
    this.salaryNotice.set(fill(this.text.salaryUsed, {
      total: this.money(option.totalMinor), category: option.name, months,
    }));
    this.salarySheet.set(false);
    this.schedule();
  }

  /**
   * The yields this app worked out for the year, and the cashback recorded in
   * it, into rentas de capital (casilla 58). Only the yields count as
   * financial yields, which is what the componente inflacionario of casilla 59
   * is applied to: cashback carries none.
   *
   * Capital, not ganancias ocasionales: interest and financial yields are
   * rentas de capital for a natural person, and a ganancia ocasional is a
   * different kind of event. The withholding goes into the first free extra
   * line, labelled, so it is visibly the app's figure and not the bank's.
   *
   * Approximate twice over, and the notice says so: these are yields as
   * accrued day by day, where the return counts what the bank actually paid;
   * and the bank's own certificate is the figure that goes on the form.
   */
  async useYields(): Promise<void> {
    const totals = await new YieldsRepository(this.database.driver).yearTotals(this.year());
    if (totals.days === 0 && totals.cashbackMinor === 0) {
      this.yieldsNotice.set(fill(this.text.yieldsNone, { year: this.year() }));
      return;
    }

    const label = this.text.yieldsWithholdingLabel;
    this.inputs.update(inputs => {
      const extra = [...inputs.extraWithholdingMinor];
      const labels = [...(inputs.extraWithholdingLabels ?? ['', '', '', ''])];

      let slot = labels.indexOf(label);
      if (slot < 0) slot = extra.findIndex((value, at) => value === 0 && !labels[at]);
      if (slot >= 0 && totals.withheldMinor > 0) {
        extra[slot] = totals.withheldMinor;
        labels[slot] = label;
      }

      return {
        ...inputs,
        capitalIncomeMinor: totals.grossMinor + totals.cashbackMinor,
        financialYieldMinor: totals.grossMinor,
        extraWithholdingMinor: extra,
        extraWithholdingLabels: labels,
      };
    });

    for (const key of ['capitalIncomeMinor', 'financialYieldMinor']) this.endDraft(key);
    for (let at = 0; at < 4; at++) this.endDraft(`extra${at}`);

    this.yieldsNotice.set(fill(this.text.yieldsUsed, {
      gross: this.money(totals.grossMinor),
      cashback: this.money(totals.cashbackMinor),
      withheld: this.money(totals.withheldMinor),
      days: totals.days,
    }));
    this.schedule();
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  /**
   * The simulation as a spreadsheet shaped like the one it replaced.
   *
   * Formulas, not only figures: a yellow box changed in Excel moves everything
   * that depends on it, which is what made the original worth keeping.
   */
  async downloadExcel(): Promise<void> {
    const name = fill(this.text.excelFile, { year: this.year() });
    // Every box of the form becomes a live formula, which is a second or two
    // of a screen that would otherwise look stuck.
    this.busyLabel.set(this.text.excelWriting);
    await new Promise(resolve => setTimeout(resolve));
    try {
      const saved = await saveFile(new Blob([taxWorkbook(this.inputs())], { type: XLSX_MIME }), name);
      if (saved) this.excelNotice.set(fill(this.text.excelSaved, { file: name }));
    } catch (error) {
      this.excelNotice.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busyLabel.set('');
    }
  }

  money(minor: number): string {
    return formatMoney(minor, 'COP');
  }

  /** A reference percentage, to two decimals: "62,09%", the way it is published. */
  percent(scaled: number): string {
    return `${(scaled / 10_000).toFixed(2).replace('.', ',')}%`;
  }

  /** "Oficial", "Referencia 2025" or "Estimado", for the badge beside a parameter. */
  standingLabel(sourced: Sourced): string {
    if (sourced.standing === 'official') return this.text.standingOfficial;
    if (sourced.standing === 'estimate') return this.text.standingEstimate;
    if (borrowedFromLater(sourced, this.year())) {
      return fill(this.text.standingLater, { year: sourced.fromYear });
    }
    return fill(this.text.standingReference, { year: sourced.fromYear });
  }

  /** True when a figure from a later year is standing in for this one. */
  fromLater(sourced: Sourced): boolean {
    return borrowedFromLater(sourced, this.year());
  }

  /** The same question about the whole year, for the warning above the list. */
  readonly anyFromLater = computed(() => {
    const p = this.parameters();
    return [p.uvt, p.minimumWage, p.inflationary].some(one => borrowedFromLater(one, this.year()));
  });

  fill(template: string, values: Record<string, string | number>): string {
    return fill(template, values);
  }

  /**
   * A figure for a box.
   *
   * Money typed in is shown without a symbol and, when it is whole pesos,
   * without decimals - "22.761.765" is what a payslip says. Computed money
   * keeps the symbol, since it is a result to read rather than a field to
   * edit.
   */
  /**
   * A money field regroups by thousands as it is typed, as the figures around
   * it are shown; any other field is left as typed.
   */
  typed(target: EventTarget | null, format: FieldFormat): string {
    const input = target as HTMLInputElement;
    if (format !== 'money') return input.value;
    const grouped = groupTypedAmount(input.value);
    if (grouped !== input.value) input.value = grouped;
    return grouped;
  }

  private format(value: number, format: FieldFormat, computedValue = false): string {
    if (format === 'money') {
      if (computedValue) return formatMoney(value, 'COP');
      if (value % 100 === 0) return formatMoney(value / 100, 'COP', { minorUnits: 0, withSymbol: false });
      return formatMoney(value, 'COP', { withSymbol: false });
    }
    if (format === 'percent') {
      const percent = value / 10_000;
      return `${Number(percent.toFixed(4)).toString().replace('.', ',')}${computedValue ? '%' : ''}`;
    }
    if (format === 'uvt') {
      return value.toLocaleString('es-CO', { maximumFractionDigits: computedValue ? 2 : 0 });
    }
    return String(value);
  }

  /** What was typed, or null while it is not a figure yet. */
  private parse(raw: string, format: FieldFormat): number | null {
    const text = raw.trim();
    if (text === '') return 0;

    try {
      if (format === 'money') return parseTypedAmountToMinor(text);
      if (format === 'percent') return parsePercentToScaled(text);
    } catch {
      return null;
    }

    const digits = text.replace(/[.\s]/g, '');
    if (!/^\d+$/.test(digits)) return null;
    const whole = Number(digits);
    return format === 'count' && whole > 99 ? 99 : whole;
  }
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole);
}
