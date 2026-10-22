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

/**
 * The occurrence is settled by what happened: a fixed payment's shop seen in
 * its month. Anything else is settled only by the person.
 */
export function settledBy(o: Occurrence, shopsSeen: ReadonlyMap<string, readonly string[]>): boolean {
  return !!o.reminder.shop && (shopsSeen.get(o.month) ?? []).includes(o.reminder.shop);
}

/** What the phone should do for one occurrence: ring at a later time, or now. */
export interface RingPlan {
  occurrence: Occurrence;
  when: 'now' | 'later';
}

/**
 * Every occurrence to ring: later when its ring day and hour are still ahead,
 * now when they passed and it is still waiting (the phone was off, the app
 * was closed). What was already rung is the caller's to remember.
 */
export function ringPlans(occurrences: readonly Occurrence[], today: string, hourNow: number): RingPlan[] {
  return occurrences.map(o => ({
    occurrence: o,
    when: o.ringOn > today || (o.ringOn === today && hourNow < o.reminder.hour) ? 'later' as const : 'now' as const,
  }));
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
