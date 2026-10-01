/**
 * How a goal is said, in one place for Presupuestos, a goal's page, Más and
 * Inicio, so they all say the same thing.
 */

import type { I18nService } from '../../core/i18n/i18n.service';
import type { GoalStatus } from '../../core/goals/goals';
import type { PlaceView } from '../../core/goals/goals.service';
import { monthLabel, plain } from './plans-words';

/** The faces a goal can wear: an icon and its colour. */
export const GOAL_FACES: readonly { icon: string; color: string }[] = [
  { icon: 'flag-outline', color: '#34c98b' },
  { icon: 'shield-checkmark-outline', color: '#34c98b' },
  { icon: 'airplane-outline', color: '#4cb8f5' },
  { icon: 'home-outline', color: '#ff9152' },
  { icon: 'car-outline', color: '#6378ff' },
  { icon: 'laptop-outline', color: '#9b7bff' },
  { icon: 'school-outline', color: '#6378ff' },
  { icon: 'gift-outline', color: '#d77bff' },
  { icon: 'heart-outline', color: '#ff6b9a' },
  { icon: 'medkit-outline', color: '#ef5b66' },
  { icon: 'umbrella-outline', color: '#2ec4b6' },
  { icon: 'cash-outline', color: '#a3d955' },
];

/** The line under a goal on its card: what it takes, and where the pace lands. */
export function goalLine(s: GoalStatus, dueMonth: string | null, months: number | null, i18n: I18nService, withPace = true): string {
  if (s.state === 'reached') return i18n.t('goals.line.reached');
  const pace = !withPace ? '' : s.arrivalMonth ? i18n.t('goals.line.arrives', { month: monthLabel(s.arrivalMonth, i18n).toLowerCase() })
    : i18n.t(s.tooSlow ? 'goals.line.tooSlow' : 'goals.line.noPace');
  const head = months ? i18n.t('goals.line.months', { count: months }) + ' · ' : '';
  if (dueMonth === null) return (head + i18n.t('goals.line.noDate') + ' ' + pace).trim();
  if (s.monthsLeft === 0) return i18n.t('goals.line.overdue', { left: plain(s.remainingMinor) });
  if (s.state === 'late') {
    return (i18n.t('goals.line.late', { needed: plain(s.neededPerMonthMinor ?? 0), pace: plain(Math.max(0, s.paceMinor)) }) + ' ' + pace).trim();
  }
  return i18n.t('goals.line.onTime', {
    left: plain(s.remainingMinor), month: monthLabel(dueMonth, i18n).toLowerCase(), needed: plain(s.neededPerMonthMinor ?? 0),
  }) + (pace ? ' ' + pace : '');
}

/** "Banco Azul · Cajita Viaje", or the account alone. */
export function placeName(p: PlaceView): string {
  const account = p.account?.name ?? '';
  return p.product ? `${account} · ${p.product.name}` : account;
}

/** "Cajita Viaje y Global Viajes", or "3 lugares". */
export function placesLine(places: readonly PlaceView[], allAccounts: boolean, i18n: I18nService): string {
  if (allAccounts) return i18n.t('goals.allAccounts');
  const names = places.map(p => p.product?.name ?? p.account?.name ?? '');
  if (names.length === 0) return i18n.t('goals.noPlace');
  if (names.length <= 2) return names.join(i18n.t('goals.and'));
  return i18n.t('goals.places', { count: names.length });
}
