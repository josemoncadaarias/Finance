/**
 * How a card's statement is said, in the one line under it on Deudas and
 * on Más, and on its own page. One place, so the three say the same thing.
 */

import { formatMoney } from '../../core/database/money';
import type { I18nService } from '../../core/i18n/i18n.service';
import type { CardStatement } from '../../core/cards/statement';
import { fromIsoDay } from '../../core/filters/period';

export function plain(minor: number, currency = 'COP'): string {
  return formatMoney(minor, currency, { withSymbol: false });
}

/** "viernes 10 de octubre". */
export function longDay(iso: string, i18n: I18nService): string {
  return fromIsoDay(iso).toLocaleDateString(i18n.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
}

/** "25 sept". */
export function shortDate(iso: string, i18n: I18nService): string {
  return fromIsoDay(iso).toLocaleDateString(i18n.dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '');
}

/** The line under a card in a list, or '' when there is nothing to say. */
export function cardLine(s: CardStatement, i18n: I18nService, currency = 'COP'): string {
  switch (s.state) {
    case 'due':
    case 'partial':
      return i18n.t('cards.line.due', { amount: plain(s.remainingMinor, currency), date: shortDate(s.dueOn!, i18n) });
    case 'overdue':
      return i18n.t('cards.line.overdue', { amount: plain(s.remainingMinor, currency), date: shortDate(s.dueOn!, i18n) });
    case 'paid':
      return i18n.t('cards.line.paid');
    case 'noDates':
      return s.debtMinor > 0 ? i18n.t('cards.line.noDates') : '';
    default:
      return '';
  }
}
