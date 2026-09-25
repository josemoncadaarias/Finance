/**
 * Gathers what the yields summary reads, once, and runs its analyses.
 *
 * The period and the account are the app's own - the same `FilterService`
 * the summary screen and the money summary answer to - so arriving here from
 * an account's yields, or changing the dates on this screen, is one question
 * asked once. The queries themselves are `gatherYieldsReport`, which runs in
 * Node too.
 */

import { inject, Injectable } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { FilterService } from '../filters/filter.service';
import { I18nService } from '../i18n/i18n.service';
import { InflationService } from '../inflation/inflation.service';
import { todayIso } from '../yields/days';
import type { Block } from './blocks';
import { reportWords } from './report-words';
import { buildYieldsReport } from './sections-yields';
import type { YieldsReportData } from './yields-data';
import { gatherYieldsReport } from './yields-gather';
import { yieldsOfTaxYear, type TaxYearYields } from './yields-for-tax';

@Injectable({ providedIn: 'root' })
export class YieldsReportService {
  private readonly database = inject(DatabaseService);
  private readonly filter = inject(FilterService);
  private readonly i18n = inject(I18nService);
  private readonly inflation = inject(InflationService);

  async build(): Promise<{ data: YieldsReportData; blocks: Block[] }> {
    const data = await this.gather();
    return { data, blocks: buildYieldsReport(data) };
  }

  /**
   * One tax year of yields for the income-tax form: the summary's own days
   * for that whole year, every account, estimates included (`yields-for-tax`).
   * No inflation is read - the form does not ask about it here.
   */
  async forTaxYear(year: number): Promise<TaxYearYields> {
    const data = await gatherYieldsReport(this.database.driver, {
      period: { kind: 'range', from: `${year}-01-01`, to: `${year}-12-31` },
      accountId: null,
      today: todayIso(),
      locale: this.i18n.dateLocale(),
      words: reportWords(key => this.i18n.t(key)),
      allLabel: this.i18n.t('period.all'),
      inflation: [],
    });
    return yieldsOfTaxYear(data, year);
  }

  async gather(): Promise<YieldsReportData> {
    // Newer months are asked for without waiting: they show next time.
    const inflation = await this.inflation.months();
    void this.inflation.refreshIfDue(inflation);

    return gatherYieldsReport(this.database.driver, {
      period: this.filter.period(),
      accountId: this.filter.accountId(),
      today: todayIso(),
      locale: this.i18n.dateLocale(),
      words: reportWords(key => this.i18n.t(key)),
      allLabel: this.i18n.t('period.all'),
      inflation,
    });
  }
}
