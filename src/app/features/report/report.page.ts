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
import {
  IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonSpinner,
  IonBackButton, IonToast,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MoneyPipe } from '../../shared/money.pipe';
import { formatMoney } from '../../core/database/money';
import { IconComponent } from '../../core/icons/icon.component';
import { CloudButtonComponent } from '../../core/cloud/cloud-button.component';
import { LanguageButtonComponent } from '../../core/i18n/language-button.component';
import { ReportService } from '../../core/report/report.service';
import { reportWorkbook, reportFileName } from '../../core/report/report-workbook';
import type { Block, Value } from '../../core/report/blocks';
import type { ReportData } from '../../core/report/report-data';
import { saveFile } from '../../core/files/save-file';
import { XLSX_MIME } from '../../core/xlsx/xlsx-writer';

@Component({
  selector: 'app-report',
  templateUrl: './report.page.html',
  styleUrls: ['./report.page.scss'],
  imports: [
    TranslatePipe, MoneyPipe, IconComponent, CloudButtonComponent, LanguageButtonComponent,
    IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonSpinner,
    IonBackButton, IonToast,
  ],
})
export class ReportPage {
  private readonly report = inject(ReportService);
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly blocks = signal<Block[]>([]);
  readonly data = signal<ReportData | null>(null);
  readonly working = signal(true);

  readonly exporting = signal(false);
  readonly notice = signal('');

  /** The period and account this is about, for the line under the title. */
  readonly about = computed(() => {
    const data = this.data();
    if (data === null) return '';
    return `${data.periodLabel} · ${data.account?.name ?? this.i18n.t('report.allAccounts')}`;
  });

  constructor() {
    addIcons(allIcons);

    // Rebuilt whenever the question changes underneath: another period picked
    // on the way in, a movement corrected, the language switched.
    effect(() => {
      this.database.dataVersion();
      this.i18n.language();
      if (this.database.status() === 'ready') void this.build();
    });
  }

  private async build(): Promise<void> {
    this.working.set(true);
    try {
      const { data, blocks } = await this.report.build();
      this.data.set(data);
      this.blocks.set(blocks);
      // Another period is another question, and it starts closed.
      this.open.set(new Set());
    } finally {
      this.working.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.data();
    if (data === null) return;

    this.exporting.set(true);
    await new Promise(resolve => setTimeout(resolve));
    try {
      const name = reportFileName(data);
      const saved = await saveFile(new Blob([reportWorkbook(data)], { type: XLSX_MIME }), name);
      if (saved) this.notice.set(this.i18n.t('report.saved'));
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : String(error));
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
      case 'percent': return `${value.value}%`;
      case 'count': return String(value.value);
      case 'date': return value.iso;
      default: return value.value;
    }
  }

  private money(minor: number, currency: string): string {
    return formatMoney(minor, currency);
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

  changeLabel(change: number | null): string {
    if (change === null) return '—';
    return `${change > 0 ? '+' : ''}${change}%`;
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
    this.remeasure();
  }

  toggleAll(): void {
    const closed = this.allClosed();
    this.open.set(closed ? new Set(this.blocks().map(block => block.id)) : new Set());
    this.remeasure();
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

  private readonly list = viewChild<IonContent>('list');
  private readonly atTop = signal(true);
  private readonly atBottom = signal(true);

  readonly showUp = computed(() => !this.atTop());
  readonly showDown = computed(() => !this.atBottom());

  async onScroll(): Promise<void> {
    const element = await this.list()?.getScrollElement();
    if (!element) return;

    const top = element.scrollTop <= 4;
    const bottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 4;
    if (top !== this.atTop()) this.atTop.set(top);
    if (bottom !== this.atBottom()) this.atBottom.set(bottom);
  }

  /**
   * Reads the position again after the page has changed height.
   *
   * Folding a section changes how tall the page is and no scroll event says
   * so, which would leave a "go down" button pointing at nothing.
   */
  private remeasure(): void {
    setTimeout(() => void this.onScroll(), 0);
  }

  toTop(): void {
    void this.list()?.scrollToTop(300);
  }

  toBottom(): void {
    void this.list()?.scrollToBottom(300);
  }

  /**
   * Which arrow a note wears.
   *
   * A method rather than a ternary in the template: the icon test reads names
   * out of bound attributes to check they exist, and a comparison written
   * inline had it checking for an icon called "good".
   */
  noteIcon(tone: string | undefined): string {
    return tone === 'good' ? 'trending-down-outline' : 'trending-up-outline';
  }

  /** True where the point stands above the block's own average. */
  isAbove(block: Extract<Block, { kind: 'trend' }>, label: string): boolean {
    return block.aboveAverage?.includes(label) ?? false;
  }
}
