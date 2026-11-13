/**
 * Formatters of dates, numbers and text comparison made once and kept.
 *
 * Found on 2026-11-13, when Jose said picking a day in the calendar of a
 * product's rate took a visible moment. A CPU profile of one tap on a day
 * (Chromium, 4x slower, as a phone) showed Angular costing nothing and
 * Ionic's `ion-datetime` re-rendering its months: for every day cell it
 * builds two `new Intl.DateTimeFormat(...)` (the day's number and its spoken
 * label), and for the hidden month and year wheels one per option - some 400
 * formatters per tap, each one costly to make (it loads locale data). The
 * formatter itself is immutable, so the same locale and options can always
 * answer with the same one.
 *
 * So the constructors are wrapped: same locale and options, same instance.
 * The app's own `toLocaleDateString` / `toLocaleString` / `localeCompare`
 * calls build a formatter inside the engine each time too (V8 only keeps one
 * for the default locale and options), so they go through the same cache when
 * the result is provably identical - a Date method only when its options name
 * the fields the method would otherwise add by itself.
 *
 * Installed once, first thing in `main.ts`, before Ionic draws anything.
 */

type Ctor<T> = { new (locales?: string | string[], options?: object): T; (locales?: string | string[], options?: object): T };

/** At most this many kept per kind; past it the oldest goes. */
const LIMIT = 300;

const DATE_FIELDS = ['weekday', 'year', 'month', 'day'];
const TIME_FIELDS = ['dayPeriod', 'hour', 'minute', 'second', 'fractionalSecondDigits'];

let installed = false;

function keyOf(locales: unknown, options: unknown): string | null {
  try {
    return JSON.stringify([locales ?? null, options ?? null]);
  } catch {
    return null;
  }
}

/** A constructor answering from its cache, otherwise the same as `native`. */
function cached<T extends object>(native: Ctor<T>): { ctor: Ctor<T>; get: (locales: unknown, options: unknown) => T } {
  const kept = new Map<string, T>();
  const get = (locales: unknown, options: unknown): T => {
    const key = keyOf(locales, options);
    if (key === null) return new native(locales as string, options as object);
    let found = kept.get(key);
    if (!found) {
      found = new native(locales as string, options as object);
      if (kept.size >= LIMIT) kept.delete(kept.keys().next().value as string);
      kept.set(key, found);
    }
    return found;
  };
  // Callable with or without `new`, as the native one; returning an object
  // from a constructor makes `new` hand back that object.
  const ctor = function (locales?: string | string[], options?: object) {
    return get(locales, options);
  } as unknown as Ctor<T>;
  Object.setPrototypeOf(ctor, native);
  (ctor as unknown as { prototype: unknown }).prototype = native.prototype;
  return { ctor, get };
}

function has(options: unknown, fields: string[]): boolean {
  if (!options || typeof options !== 'object') return false;
  const o = options as Record<string, unknown>;
  if (o['dateStyle'] !== undefined || o['timeStyle'] !== undefined) return false;
  return fields.some(field => o[field] !== undefined);
}

export function installIntlCache(): void {
  if (installed || typeof Intl === 'undefined') return;
  installed = true;

  const dates = cached(Intl.DateTimeFormat as unknown as Ctor<Intl.DateTimeFormat>);
  const numbers = cached(Intl.NumberFormat as unknown as Ctor<Intl.NumberFormat>);
  const collators = cached(Intl.Collator as unknown as Ctor<Intl.Collator>);
  (Intl as { DateTimeFormat: unknown }).DateTimeFormat = dates.ctor;
  (Intl as { NumberFormat: unknown }).NumberFormat = numbers.ctor;
  (Intl as { Collator: unknown }).Collator = collators.ctor;

  const dateProto = Date.prototype;
  const nativeDate = dateProto.toLocaleDateString;
  const nativeTime = dateProto.toLocaleTimeString;
  const nativeBoth = dateProto.toLocaleString;
  // The spec adds year, month and day when none of the date fields is asked
  // for (hour and minute for a time, all of them for both): only when the
  // options already name them is a formatter of those options the same.
  dateProto.toLocaleDateString = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    if (!has(options, DATE_FIELDS) || isNaN(this.getTime())) return nativeDate.call(this, locales, options);
    return dates.get(locales, options).format(this);
  };
  dateProto.toLocaleTimeString = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    if (!has(options, TIME_FIELDS) || isNaN(this.getTime())) return nativeTime.call(this, locales, options);
    return dates.get(locales, options).format(this);
  };
  dateProto.toLocaleString = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    if (!has(options, [...DATE_FIELDS, ...TIME_FIELDS]) || isNaN(this.getTime())) return nativeBoth.call(this, locales, options);
    return dates.get(locales, options).format(this);
  };

  const nativeNumber = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (this: number, locales?: string | string[], options?: Intl.NumberFormatOptions) {
    if (locales === undefined && options === undefined) return nativeNumber.call(this);
    return numbers.get(locales, options).format(Number(this));
  };

  const nativeCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = function (this: string, that: string, locales?: string | string[], options?: Intl.CollatorOptions) {
    if (locales === undefined && options === undefined) return nativeCompare.call(this, that);
    return collators.get(locales, options).compare(String(this), String(that));
  };
}
