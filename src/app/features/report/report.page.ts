/**
 * The financial summary: the period on screen, read rather than exported.
 *
 * It knows how to draw the five KINDS of block and nothing about which
 * analyses exist - the same contract the spreadsheet writer works to. An
 * analysis added to the list appears here on its own, and one that had
 * nothing to say about this period is simply not here.
 *
 * It asks nothing when it opens. The dates and the account were chosen on the
 * summary screen and are still chosen; asking again would be asking the user
 * to say twice what the app already knows.
 */

import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatMoney } from '../../core/database/money';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { JumpComponent } from '../../shared/ui/jump.component';
import { BusyOverlayComponent } from '../../shared/busy-overlay.component';
import { ToastService } from '../../shared/ui/toast.service';
import { AccentService } from '../../core/theme/accent.service';
import { PALETTE } from '../../core/theme/palette';
import { includesToday, periodLabel as labelOfPeriod } from '../../core/filters/period';
import { ScopeSheetsComponent } from '../../shared/scope/scope-sheets.component';
import { ReportService } from '../../core/report/report.service';
import { MovementsStore } from '../movements/movements.store';
import { reportWorkbook, reportFileName, yieldsWorkbook, yieldsFileName } from '../../core/report/report-workbook';
import { YieldsReportService } from '../../core/report/yields-report.service';
import type { YieldsReportData } from '../../core/report/yields-data';
import { FilterService } from '../../core/filters/filter.service';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import type { Block, Value } from '../../core/report/blocks';
import type { ReportData } from '../../core/report/report-data';
import { saveFile } from '../../core/files/save-file';
import { XLSX_MIME } from '../../core/xlsx/xlsx-writer';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  styleUrls: ['./report.page.scss'],
  imports: [
    TranslatePipe, ScopeSheetsComponent, BadgeComponent, JumpComponent, BusyOverlayComponent,
    IonContent, IonIcon, IonSpinner,
  ],
})
export class ReportPage {
  private readonly report = inject(ReportService);
  private readonly yieldsReport = inject(YieldsReportService);
  readonly filter = inject(FilterService);
  private readonly toast = inject(ToastService);
  private readonly accent = inject(AccentService);
  readonly accentColor = computed(() => this.accent.accent().color);
  readonly info = signal<string | null>(null);

  /** "Todas las cuentas", "Todas las cuentas que rinden", or the one on show. */
  readonly accountLabel = computed(() => {
    const account = this.store.selectedAccount();
    if (account) return account.name;
    return this.i18n.t(this.mode() === 'yields' ? 'report.yields.allAccounts' : 'summary.allAccounts');
  });

  readonly periodTitle = computed(() => {
    const text = labelOfPeriod(this.filter.period(), this.i18n.dateLocale(), this.i18n.t('period.all'));
    return text.charAt(0).toUpperCase() + text.slice(1);
  });

  readonly atNewest = computed(() => includesToday(this.filter.period()));
  readonly canStep = computed(() => {
    const kind = this.filter.period().kind;
    return kind !== 'all' && kind !== 'range';
  });

  /** "Van 27 de 30 días", while the period is not over. */
  readonly daysGoneLine = computed(() => {
    const period = this.filter.period();
    if (!period.from || !period.to || !includesToday(period)) return null;
    const day = 86_400_000;
    const at = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const total = Math.round((at(period.to) - at(period.from)) / day) + 1;
    const gone = Math.round((today - at(period.from)) / day) + 1;
    return gone < total ? this.i18n.t('ui.report.daysGone', { gone, total }) : null;
  });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * Which summary this is: of the money that moved, or of what the accounts
   * earned. One screen for both (rule 20): the same blocks, the same pickers,
   * the same spreadsheet writer, a different list of analyses. The products
   * screen opens it with `?of=yields`.
   */
  readonly mode = toSignal(
    this.route.queryParamMap.pipe(map(params => (params.get('of') === 'yields' ? 'yields' : 'money'))),
    { initialValue: 'money' as 'money' | 'yields' },
  );

  /** To the other summary, on the same account and dates, replacing this one in history. */
  switchTo(which: 'money' | 'yields'): void {
    if (which === this.mode()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { of: which === 'yields' ? 'yields' : null },
      replaceUrl: true,
    });
  }

  /** The yields summary's facts, while that is the one on screen. */
  readonly yieldsData = signal<YieldsReportData | null>(null);

  readonly title = computed(() => this.i18n.t(this.mode() === 'yields' ? 'report.yields.title' : 'report.title'));
  readonly nothing = computed(() => this.i18n.t(this.mode() === 'yields' ? 'report.yields.nothing' : 'report.nothing'));
  readonly periodLabel = computed(() =>
    (this.mode() === 'yields' ? this.yieldsData()?.periodLabel : this.data()?.periodLabel) ?? '');
  private readonly database = inject(DatabaseService);
  private readonly store = inject(MovementsStore);
  readonly i18n = inject(I18nService);

  readonly blocks = signal<Block[]>([]);
  readonly data = signal<ReportData | null>(null);
  readonly working = signal(true);

  readonly exporting = signal(false);
  readonly exportName = signal('');

  /** The period and account this is about, for the line under the title. */
  readonly about = computed(() => {
    if (this.mode() === 'yields') {
      const facts = this.yieldsData();
      if (facts === null) return '';
      return `${facts.periodLabel} · ${facts.account?.name ?? this.i18n.t('report.yields.allAccounts')}`;
    }
    const data = this.data();
    if (data === null) return '';
    return `${data.periodLabel} · ${data.account?.name ?? this.i18n.t('report.allAccounts')}`;
  });

  constructor() {
    addIcons(allIcons);

    /*
     * Rebuilt whenever the question changes: another period or account picked
     * from the bar above, a movement corrected, the language switched.
     *
     * Reading the store's own list is what ties this to the pickers. They
     * write to `FilterService`, the store reloads from that, and only then is
     * there anything to analyse - so watching the filter directly would run
     * this against the previous period's movements and then again against the
     * right ones.
     */
    effect(() => {
      // The money summary waits for the store's own list (see above); the
      // yields summary reads the period and the account directly, since the
      // days are its own query and nothing has to reload first.
      if (this.mode() === 'yields') {
        this.filter.period();
        this.filter.accountId();
      } else {
        this.store.inScope();
      }
      this.database.dataVersion();
      this.i18n.language();
      if (this.database.status() === 'ready') void this.build();
    });
  }

  private async build(): Promise<void> {
    this.working.set(true);
    try {
      if (this.mode() === 'yields') {
        const { data, blocks } = await this.yieldsReport.build();
        this.yieldsData.set(data);
        this.blocks.set(blocks);
      } else {
        const { data, blocks } = await this.report.build();
        this.data.set(data);
        this.blocks.set(blocks);
      }
      // Another period is another question, and it starts closed.
      this.open.set(new Set());
    } finally {
      this.working.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const yields = this.mode() === 'yields' ? this.yieldsData() : null;
    const data = this.mode() === 'yields' ? null : this.data();
    if (yields === null && data === null) return;

    this.exporting.set(true);
    await new Promise(resolve => setTimeout(resolve));
    try {
      const name = yields ? yieldsFileName(yields) : reportFileName(data!);
      this.exportName.set(name);
      const bytes = yields ? yieldsWorkbook(yields, this.blocks()) : reportWorkbook(data!);
      const saved = await saveFile(new Blob([bytes], { type: XLSX_MIME }), name);
      if (saved) this.toast.say(this.i18n.t('report.saved'));
    } catch (error) {
      this.toast.say(error instanceof Error ? error.message : String(error));
    } finally {
      this.exporting.set(false);
    }
  }

  // -------------------------------------------------------------------------
  // Reading a block
  // -------------------------------------------------------------------------

  /**
   * A value as the reader should see it.
   *
   * The blocks carry numbers, never wording - that is what lets the same block
   * become a cell in a spreadsheet and a line on this screen. The formatting
   * is this screen's job, and it uses the app's own money helper so a figure
   * here reads exactly as it does on the summary screen.
   */
  show(value: Value): string {
    switch (value.kind) {
      case 'money': return this.money(value.minor, value.currency);
      case 'percent': return this.percent(value.value);
      case 'count': return String(value.value);
      case 'date': return value.iso;
      default: return value.value;
    }
  }

  /** 8,62 % in Spanish and 8.62% in English, as each writes it. */
  percent(value: number): string {
    const number = (value === 0 ? 0 : value).toLocaleString(this.i18n.dateLocale(), { maximumFractionDigits: 2 });
    return this.i18n.dateLocale().startsWith('es') ? `${number} %` : `${number}%`;
  }

  private money(minor: number, currency: string): string {
    return formatMoney(minor, currency, { withSymbol: false });
  }

  /** How wide to draw a row's bar. Kept off zero so a tiny share still shows. */
  barWidth(share: number | undefined): string {
    if (share === undefined) return '0';
    return `${Math.max(share, 1)}%`;
  }

  /**
   * Whether a change is the bad kind.
   *
   * Spending that grew and income that fell are both bad news, and which is
   * which is the block's business, not this screen's - it says so per row.
   */
  isWorse(change: number | null, growthIs: 'good' | 'bad'): boolean {
    if (change === null || change === 0) return false;
    return growthIs === 'bad' ? change > 0 : change < 0;
  }

  isBetter(change: number | null, growthIs: 'good' | 'bad'): boolean {
    if (change === null || change === 0) return false;
    return !this.isWorse(change, growthIs);
  }

  /** Which way it moved, said with a shape as well as a colour. */
  changeIcon(change: number | null): string {
    if (change === null || change === 0) return 'remove-outline';
    return change > 0 ? 'arrow-up-outline' : 'arrow-down-outline';
  }

  /**
   * How much it moved, in the shortest form that still reads.
   *
   * Past a point a percentage stops being a number anyone holds in their
   * head: "+4201%" is not 4201 of anything, it is "forty-three times". So
   * from ten times over, it is said as a multiplier. Below that the
   * percentage is the natural way to say it, and it keeps its sign.
   */
  changeLabel(change: number | null): string {
    if (change === null) return '—';
    if (change >= 900) {
      const times = (change + 100) / 100;
      return `x${times >= 10 ? Math.round(times) : times.toFixed(1)}`;
    }
    return `${change > 0 ? '+' : ''}${this.percent(change)}`;
  }

  /**
   * A ring of the shares a ranked list carries.
   *
   * The list already says the figures; the ring says the SHAPE of them - that
   * two categories are most of the month, or that a dozen are all much the
   * same - which is the thing a column of percentages is worst at. Drawn from
   * the same palette as the summary screen's donut, so the same spending
   * wears the same colour on both screens.
   *
   * Only where a share means something: a list of the biggest movements has
   * none, and a ring of one slice is a circle.
   */
  ringOf(block: Extract<Block, { kind: 'ranked' }>): { path: string; colour: string; label: string }[] {
    const shares = block.rows.filter(row => (row.share ?? 0) > 0);
    if (shares.length < 2) return [];

    const total = shares.reduce((sum, row) => sum + (row.share ?? 0), 0);
    if (total <= 0) return [];

    let at = -Math.PI / 2;
    return shares.map((row, index) => {
      const sweep = ((row.share ?? 0) / total) * Math.PI * 2;
      const path = arc(at, at + sweep);
      at += sweep;
      return { path, colour: SPENT[index % SPENT.length], label: row.label };
    });
  }

  /**
   * Which bar of a trend has been tapped, and so which figure is being read.
   *
   * The amounts used to sit above every bar. At eleven digits each they were
   * what made the chart wider than the phone, and the sideways scroll that
   * left behind was one Jose could not find - so the months ran out at June
   * with the rest of the year off the edge. Every month fits now, and the one
   * figure anyone wants at a time is the one they point at.
   */
  readonly picked = signal<string | null>(null);

  pick(label: string): void {
    this.picked.update(current => (current === label ? null : label));
  }

  pickedPoint(block: Extract<Block, { kind: 'trend' }>): Extract<Block, { kind: 'trend' }>['points'][number] | null {
    const label = this.picked();
    return block.points.find(point => point.label === label) ?? null;
  }

  /** How much of a bar its lighter part fills. */
  partOf(point: { value: Value; part?: Value }): string {
    if (point.value.kind !== 'money' || point.part?.kind !== 'money' || point.value.minor === 0) return '0';
    return `${Math.min(Math.max((point.part.minor / point.value.minor) * 100, 0), 100)}%`;
  }

  /** The tallest point of a trend, so the bars have something to scale to. */
  peakOf(block: Extract<Block, { kind: 'trend' }>): number {
    return block.points.reduce((most, point) =>
      Math.max(most, point.value.kind === 'money' ? Math.abs(point.value.minor) : 0), 0);
  }

  heightOf(block: Extract<Block, { kind: 'trend' }>, value: Value): string {
    const peak = this.peakOf(block);
    if (peak <= 0 || value.kind !== 'money') return '2%';
    return `${Math.max(Math.round((Math.abs(value.minor) / peak) * 100), 2)}%`;
  }

  // -------------------------------------------------------------------------
  // Which sections are open, and getting about a long screen
  // -------------------------------------------------------------------------

  /**
   * The sections the reader has opened.
   *
   * Closed to begin with, and closed again whenever the report is rebuilt for
   * another period. The whole thing at once is several screens of reading,
   * and which part is wanted is the reader's question rather than the app's.
   */
  private readonly open = signal<ReadonlySet<string>>(new Set());

  isOpen(id: string): boolean {
    return this.open().has(id);
  }

  readonly allClosed = computed(() => this.open().size === 0);

  toggle(id: string): void {
    this.open.update(current => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  toggleAll(): void {
    const closed = this.allClosed();
    this.open.set(closed ? new Set(this.blocks().map(block => block.id)) : new Set());
  }

  /** How much is behind a closed section, so it can be chosen without opening. */
  sizeOf(block: Block): string {
    if (block.kind === 'figures') return String(block.figures.length);
    if (block.kind === 'ranked') return String(block.rows.length);
    if (block.kind === 'comparison') return String(block.rows.length);
    if (block.kind === 'trend') return String(block.points.length);
    return String(block.lines.length);
  }

  /** "Septiembre 2026" is three letters wide on a bar chart. */
  shortMonth(label: string): string {
    return label.split(' ')[0].slice(0, 3);
  }

  noteIcon(tone: string | undefined): string {
    return tone === 'good' ? 'trending-down-outline' : 'trending-up-outline';
  }

  /** True where the point stands above the block's own average. */
  // -------------------------------------------------------------------------
  // The redesign (mockups 5a-5t)
  // -------------------------------------------------------------------------

  /** Each section's own picture, by what it is about. */
  iconOf(block: Block): string {
    const id = block.id;
    const pick: [RegExp, string][] = [
      [/infla/, 'flame-outline'], [/compar|before|previous|against/, 'git-compare-outline'],
      [/change|jump/, 'flash-outline'], [/where|categor|went/, 'pie-chart-outline'],
      [/recurr|repeat|charge/, 'repeat-outline'], [/month|trend|cumul/, 'bar-chart-outline'],
      [/account|best|top/, 'trophy-outline'], [/largest|biggest/, 'arrow-up-outline'],
      [/note|worth/, 'bulb-outline'], [/growth|balance/, 'trending-up-outline'],
    ];
    for (const [pattern, icon] of pick) if (pattern.test(id)) return icon;
    return block.kind === 'figures' ? 'stats-chart-outline' : block.kind === 'note' ? 'bulb-outline'
      : block.kind === 'trend' ? 'bar-chart-outline' : block.kind === 'comparison' ? 'git-compare-outline' : 'list-outline';
  }

  colorOf(block: Block): string {
    const colours = [PALETTE.zafiro, PALETTE.violeta, PALETTE.ambar, PALETTE.mandarina, PALETTE.cielo, PALETTE.esmeralda, PALETTE.rosa, PALETTE.turquesa];
    const index = this.blocks().findIndex(one => one.id === block.id);
    return colours[Math.max(index, 0) % colours.length];
  }

  /** What a closed section says under its title: its key figure (5b). */
  keyOf(block: Block): string {
    switch (block.kind) {
      case 'figures': {
        const share = block.figures.find(figure => figure.value.kind === 'percent');
        const first = share ?? block.figures.find(figure => figure.value.kind === 'money' && figure.value.minor !== 0) ?? block.figures[0];
        return first ? `${first.label} ${this.show(first.value)}` : '';
      }
      case 'comparison': {
        const row = block.rows.find(one => one.changePercent !== null) ?? block.rows[0];
        return row ? `${row.label} ${row.changePercent === null ? '' : this.changeLabel(row.changePercent)}`.trim() : '';
      }
      case 'ranked': {
        const row = block.rows[0];
        if (!row) return '';
        return row.share !== undefined ? `${row.label} ${this.percent(Math.round(row.share))}` : `${row.label} · ${this.show(row.value)}`;
      }
      case 'trend': {
        if (block.average && block.averageLabel) return `${block.averageLabel} ${this.short(block.average)}`;
        const last = block.points.at(-1);
        return last ? this.short(last.value) : '';
      }
      default: {
        const count = block.lines.length;
        return count === 1 ? this.i18n.t('ui.report.note') : this.i18n.t('ui.report.notes', { count });
      }
    }
  }

  /** "5,4 M", "352 mil": a figure short enough for a line under a title. */
  private short(value: Value): string {
    if (value.kind !== 'money') return this.show(value);
    const units = Math.abs(value.minor) / 100;
    const sign = value.minor < 0 ? '−' : '';
    const locale = this.i18n.dateLocale();
    if (units >= 1_000_000) return sign + this.i18n.t('chart.millions', { n: (units / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 }) });
    if (units >= 1_000) return sign + this.i18n.t('chart.thousands', { n: Math.round(units / 1_000).toLocaleString(locale) });
    return this.show(value);
  }

  toneClass(tone: string | undefined): string {
    return tone === 'good' ? 'ui-g' : tone === 'bad' ? 'ui-r' : tone === 'warn' ? 'ui-y' : '';
  }

  flowClass(flow: string | undefined): string {
    return flow === 'in' || flow === 'received' ? 'ui-g' : '';
  }

  /** A long ranking shows its first five, and "Ver las N restantes". */
  readonly rowLimit = 5;
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  expand(id: string): void {
    this.expanded.update(current => new Set([...current, id]));
  }

  shownRows(block: Extract<Block, { kind: 'ranked' }>): Extract<Block, { kind: 'ranked' }>['rows'] {
    return this.isExpanded(block.id) ? block.rows : block.rows.slice(0, this.rowLimit);
  }

  barColor(index: number): string {
    const colours = [PALETTE.mandarina, PALETTE.esmeralda, PALETTE.arena, PALETTE.coral, PALETTE.cielo, PALETTE.violeta, PALETTE.rosa, PALETTE.oro];
    return colours[index % colours.length];
  }

  /** Where the average line sits, as a share of the tallest bar. */
  avgBottom(block: Extract<Block, { kind: 'trend' }>): string {
    const peak = this.peakOf(block);
    if (peak <= 0 || block.average?.kind !== 'money') return '0';
    return `calc(20px + (100% - 20px) * ${Math.min(Math.abs(block.average.minor) / peak, 1)})`;
  }

  lastPoint(block: Extract<Block, { kind: 'trend' }>): Extract<Block, { kind: 'trend' }>['points'][number] | null {
    return block.points.at(-1) ?? null;
  }

  capital(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  isAbove(block: Extract<Block, { kind: 'trend' }>, label: string): boolean {
    return block.aboveAverage?.includes(label) ?? false;
  }
}

/*
 * The ring's geometry.
 *
 * The summary screen's own palette, so a category that is amber in the donut
 * is amber here. Shared by value rather than imported from that component:
 * the donut draws `Slice`s and this draws block rows, and giving one of them
 * the other's shape to satisfy an import would be the tail wagging the dog.
 */
const SPENT = ['#c8553d', '#e0913f', '#b5457a', '#7f5aa6', '#a8603c', '#d16b8a', '#6b5b95', '#c9a227'];

const RING = 60;
const OUTER = 26;
const INNER = 16;

/** One slice of the ring, between two angles. */
function arc(from: number, to: number): string {
  // A full circle cannot be drawn as one arc - its two ends are the same
  // point and the path collapses - so it is drawn as two halves.
  if (to - from >= Math.PI * 2 - 0.0001) {
    const half = from + Math.PI;
    return `${arc(from, half)} ${arc(half, from + Math.PI * 2)}`;
  }

  const big = to - from > Math.PI ? 1 : 0;
  const on = (radius: number, angle: number) =>
    `${(RING / 2 + Math.cos(angle) * radius).toFixed(2)} ${(RING / 2 + Math.sin(angle) * radius).toFixed(2)}`;

  return `M ${on(OUTER, from)} A ${OUTER} ${OUTER} 0 ${big} 1 ${on(OUTER, to)}`
    + ` L ${on(INNER, to)} A ${INNER} ${INNER} 0 ${big} 0 ${on(INNER, from)} Z`;
}
