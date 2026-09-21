/**
 * Gathers everything the analyses read, once, and runs them.
 *
 * The one place that talks to the database on the report's behalf. An
 * analysis never does: they all read the `ReportData` this builds, so the
 * cost of the whole report is what is fetched here - this period, and the
 * stretch before it that gives every comparison something to stand against.
 *
 * The movements come from the summary screen's own store, through the same
 * filtering the screen uses. Not a query of its own: the report and the
 * screen have to be able to agree, and two queries eventually will not.
 */

import { inject, Injectable } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import { FilterService } from '../filters/filter.service';
import { periodLabel } from '../filters/period';
import { MovementsStore } from '../../features/movements/movements.store';
import { todayIso } from '../yields/days';
import { buildReport } from './sections';
import type { Block } from './blocks';
import { daysElapsed, equivalentBefore, type ReportData } from './report-data';
import { reportWords } from './report-words';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly store = inject(MovementsStore);
  private readonly filter = inject(FilterService);
  private readonly i18n = inject(I18nService);

  /** Everything the analyses need, for the period and account on screen. */
  async gather(): Promise<ReportData> {
    const period = this.filter.period();
    const locale = this.i18n.dateLocale();
    const words = reportWords(key => this.i18n.t(key));
    const today = todayIso();

    const movements = this.store.inScope();

    const partial: ReportData = {
      period,
      periodLabel: periodLabel(period, locale, this.i18n.t('period.all')),
      account: this.store.selectedAccount(),
      accounts: this.store.accounts(),
      movements,
      basis: this.store.basis(),
      currency: this.store.currency(),
      before: null,
      today,
      locale,
      words,
    };

    // The same number of days of the period before, which is the only
    // comparison worth drawing. One extra query, and only one: every analysis
    // that compares reads this same list.
    const earlier = equivalentBefore(period, daysElapsed(partial).days);
    if (earlier === null) return partial;

    return {
      ...partial,
      before: {
        period: earlier,
        label: periodLabel(earlier, locale, this.i18n.t('period.all')),
        movements: await this.store.movementsFor(earlier),
        // It is cut short whenever this period is: 21 days against 21.
        clipped: !daysElapsed(partial).whole,
      },
    };
  }

  /** The report itself: the analyses that had something to say. */
  async build(): Promise<{ data: ReportData; blocks: Block[] }> {
    const data = await this.gather();
    return { data, blocks: buildReport(data) };
  }
}
