/**
 * When a reminder is due and when the phone rings for it (Jose, 2026-10-22:
 * "recuérdame pagar el arriendo el 5"). Pure: the screen, Inicio, the
 * assistant and the phone's alarms all read it, so they never disagree.
 *
 * A reminder never writes a movement (rule 22): it rings, and a tap opens the
 * movement form filled in. Tested in `reminders.test.mjs`.
 */

export type Repeat = 'once' | 'monthly';

export interface Reminder {
  id: number;
  title: string;
  amountMinor: number | null;
  accountId: number | null;
  categoryId: number | null;
  note: string | null;
  repeat: Repeat;
  dayOfMonth: number | null;
  onDate: string | null;
  hour: number;
  /** The minute of that hour (migration 061); 0 when not said. */
  minute?: number;
  /** Ring this many days before the day it is due (0: on the day). */
  daysBefore: number;
  /** A fixed payment's merchant key: seeing it in the month settles that month. */
  shop: string | null;
  active: boolean;
  /** 'YYYY-MM' already settled (registered, marked paid, or seen). */
  doneMonth: string | null;
  /** This occurrence rings on this day instead. */
  snoozedTo: string | null;
}

export interface Occurrence {
  reminder: Reminder;
  /** The day it is due. */
  dueOn: string;
  /** The day the phone rings for it. */
  ringOn: string;
  /** The month it belongs to ('YYYY-MM'). */
  month: string;
  /** Due before today and not settled. */
  late: boolean;
}

export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + by));
  return t.toISOString().slice(0, 10);
}

/** The day a monthly reminder falls in a month: a day past its end is the last day. */
export function dayIn(month: string, dayOfMonth: number): string {
  return `${month}-${String(Math.min(dayOfMonth, daysIn(month))).padStart(2, '0')}`;
}

/**
 * The occurrence a reminder is waiting on, seen from `today`: this month's
 * while it is not settled (late when its day has passed), else the next one.
 * Null when it is paused or a one-off already done.
 */
export function nextOccurrence(r: Reminder, today: string): Occurrence | null {
  if (!r.active) return null;
  const at = (dueOn: string, month: string): Occurrence => {
    const ring = r.snoozedTo && monthOfDay(r.snoozedTo) <= month && r.snoozedTo >= addDays(dueOn, -7)
      ? r.snoozedTo : addDays(dueOn, -r.daysBefore);
    return { reminder: r, dueOn, ringOn: ring, month, late: dueOn < today };
  };
  if (r.repeat === 'once') {
    if (!r.onDate || r.doneMonth) return null;
    return at(r.onDate, monthOfDay(r.onDate));
  }
  if (!r.dayOfMonth) return null;
  const thisMonth = monthOfDay(today);
  if (r.doneMonth !== thisMonth && !(r.doneMonth && r.doneMonth > thisMonth)) {
    return at(dayIn(thisMonth, r.dayOfMonth), thisMonth);
  }
  let month = shiftMonth(thisMonth, 1);
  while (r.doneMonth && month <= r.doneMonth) month = shiftMonth(month, 1);
  // A snooze belongs to the occurrence it was given for.
  return at(dayIn(month, r.dayOfMonth), month);
}

/** A spending seen in a month: its shop and its day. */
export interface ShopSpend {
  shop: string;
  on: string;
}

/** How many days before its day a payment may come and still be that one's. */
export const PAID_EARLY_DAYS = 10;

function daysBetween(a: string, b: string): number {
  const at = (d: string) => { const [y, m, n] = d.split('-').map(Number); return Date.UTC(y, m - 1, n); };
  return Math.round((at(a) - at(b)) / 86_400_000);
}

/**
 * Which reminders a month's spendings settle by their shop (Jose, 2026-10-29:
 * two payments to one person, on the 14th and the 29th, and the first one
 * settled both). One spending answers one reminder: the one of its shop whose
 * day is nearest, among those due at most `PAID_EARLY_DAYS` after it - so a
 * payment made on the 15th is the 14th's, never the 29th's. Every active
 * reminder of the shop takes part, settled or not, so a spending already
 * answering one is never counted again for another. Anything without a shop
 * is settled only by the person.
 */
export function paidByShop(reminders: readonly Reminder[], month: string, spends: readonly ShopSpend[]): Set<number> {
  const due = reminders.flatMap(r => {
    if (!r.active || !r.shop) return [];
    const on = r.repeat === 'monthly' ? (r.dayOfMonth ? dayIn(month, r.dayOfMonth) : null)
      : r.onDate && monthOfDay(r.onDate) === month ? r.onDate : null;
    return on ? [{ id: r.id, shop: r.shop, on }] : [];
  });
  const paid = new Set<number>();
  for (const spend of [...spends].filter(s => monthOfDay(s.on) === month).sort((a, b) => a.on.localeCompare(b.on))) {
    const fits = due
      .filter(d => !paid.has(d.id) && d.shop === spend.shop && daysBetween(d.on, spend.on) <= PAID_EARLY_DAYS)
      .sort((a, b) => Math.abs(daysBetween(a.on, spend.on)) - Math.abs(daysBetween(b.on, spend.on)) || a.on.localeCompare(b.on));
    if (fits[0]) paid.add(fits[0].id);
  }
  return paid;
}

/** What the phone should do for one occurrence: ring at a later time, or now. */
export interface RingPlan {
  occurrence: Occurrence;
  when: 'now' | 'later';
}

/** The minute of the day a reminder rings at. */
export function ringMinute(r: Reminder): number {
  return r.hour * 60 + (r.minute ?? 0);
}

/**
 * Every occurrence to ring: later when its ring day and time are still ahead,
 * now when they passed and it is still waiting (the phone was off, the app
 * was closed). What was already rung is the caller's to remember.
 */
export function ringPlans(occurrences: readonly Occurrence[], today: string, hourNow: number, minuteNow = 0): RingPlan[] {
  const now = hourNow * 60 + minuteNow;
  return occurrences.map(o => ({
    occurrence: o,
    when: o.ringOn > today || (o.ringOn === today && now < ringMinute(o.reminder)) ? 'later' as const : 'now' as const,
  }));
}

/**
 * What one ringing is known by: the occurrence and the time it rings at, so
 * changing the time makes it ring again, and it rings only once at that time.
 */
export function ringKey(o: Occurrence): string {
  return `${o.reminder.id}@${o.dueOn}@${o.ringOn}@${ringMinute(o.reminder)}`;
}

/** Waiting now or soon, for Inicio: late, or due within `days`. */
export function dueWithin(occurrences: readonly Occurrence[], today: string, days = 7): Occurrence[] {
  const limit = addDays(today, days);
  return occurrences.filter(o => o.dueOn <= limit).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** A stable id for the phone's notification of a reminder (well apart from the cards' ids). */
export function reminderNoticeId(id: number): number {
  return 700_000 + id;
}
