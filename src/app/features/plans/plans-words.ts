/**
 * How a limit is said, in one place for Planes, its page, Inicio, Más and the
 * sheet at saving, so all of them say the same thing.
 */

import { formatMoney } from '../../core/database/money';
import type { I18nService } from '../../core/i18n/i18n.service';
import { fromIsoDay, monthName } from '../../core/filters/period';
import type { LimitStatus, TotalStatus } from '../../core/limits/limits';

export function plain(minor: number): string {
  return formatMoney(minor, 'COP', { withSymbol: false });
}

/** The spent share, exact, for the bar: 113.5 and not 114. */
export function ratio(s: LimitStatus | TotalStatus): number {
  return s.amountMinor > 0 ? (s.spentMinor * 100) / s.amountMinor : 0;
}

/** "Octubre 2026". */
export function monthLabel(month: string, i18n: I18nService): string {
  const name = monthName(fromIsoDay(`${month}-01`), i18n.dateLocale());
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${month.slice(0, 4)}`;
}

/** "18 oct". */
export function shortDay(iso: string, i18n: I18nService): string {
  return fromIsoDay(iso).toLocaleDateString(i18n.dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '');
}

/** "18 de octubre" / "October 18". */
export function longDay(iso: string, i18n: I18nService): string {
  return fromIsoDay(iso).toLocaleDateString(i18n.dateLocale(), { day: 'numeric', month: 'long' });
}

/** The line under a limit: by how much it went over, or what is left and how it goes. */
export function lineOf(s: LimitStatus, i18n: I18nService): string {
  if (s.state === 'passed') return i18n.t('plans.line.passed', { over: plain(s.overMinor) });
  const left = plain(s.remainingMinor);
  if (s.daysLeft === 0) return i18n.t('plans.line.closed', { left });
  if (s.state === 'fast') return i18n.t('plans.line.fast', { left });
  if (s.state === 'close') return i18n.t('plans.line.close', { left, count: s.daysLeft });
  return i18n.t('plans.line.good', { left });
}

/** The colour class of a state's figures. */
export function toneOf(state: LimitStatus['state']): string {
  return state === 'passed' ? 'ui-r' : state === 'good' ? 'ui-g' : 'ui-y';
}
