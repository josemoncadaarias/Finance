/**
 * What the amount field is holding while someone types an amount.
 *
 * Kept as the digits typed rather than as a number, for the same reason the
 * rest of the app stores integers: a running `value = value * 10 + digit` on a
 * float loses the last cent long before anyone notices, and the amount being
 * typed is exactly where that would be least forgivable.
 *
 * Pesos are typed first and cents only if wanted — `50200` is fifty thousand
 * two hundred pesos, not five hundred and two. Colombian amounts are usually
 * whole pesos, and making every entry cost two extra taps to say ",00" is the
 * kind of friction that sends someone back to the app they came from.
 */

import { parseAmountToMinor } from '../../core/database/money';

/** Digits before the separator. More than this is not a real amount. */
const MAX_WHOLE = 12;

export class AmountBuffer {
  private whole = '';
  private fraction = '';
  private typingFraction = false;

  /**
   * The digits as typed, for showing back. Empty means nothing yet.
   *
   * Grouped in thousands, because Colombian amounts run long: 975894,47 has
   * to be counted digit by digit to be read, and someone correcting an amount
   * needs to see at a glance whether it says nine hundred thousand or nine
   * million. Grouping is display only — `minor` never sees it.
   */
  get text(): string {
    if (this.whole === '' && !this.typingFraction) return '';
    const whole = groupThousands(this.whole === '' ? '0' : this.whole);
    return this.typingFraction ? `${whole},${this.fraction}` : whole;
  }

  /** The digits without grouping, for anything that has to parse them back. */
  get raw(): string {
    if (this.whole === '' && !this.typingFraction) return '';
    const whole = this.whole === '' ? '0' : this.whole;
    return this.typingFraction ? `${whole},${this.fraction}` : whole;
  }

  get isEmpty(): boolean {
    return this.whole === '' && this.fraction === '';
  }

  /** The amount in minor units. Zero while nothing has been typed. */
  get minor(): number {
    if (this.isEmpty) return 0;
    const whole = this.whole === '' ? '0' : this.whole;
    const fraction = this.fraction.padEnd(2, '0');
    return parseAmountToMinor(`${whole}.${fraction}`);
  }

  push(digit: string): void {
    if (!/^[0-9]$/.test(digit)) return;

    if (this.typingFraction) {
      if (this.fraction.length < 2) this.fraction += digit;
      return;
    }

    // A leading zero means nothing, and lets someone type 0,50 naturally.
    if (this.whole === '0') this.whole = '';
    if (this.whole.length < MAX_WHOLE) this.whole += digit;
  }

  /** Starts the cents. Pressing it twice does nothing. */
  separator(): void {
    if (this.typingFraction) return;
    if (this.whole === '') this.whole = '0';
    this.typingFraction = true;
  }

  backspace(): void {
    if (this.typingFraction) {
      if (this.fraction.length > 0) {
        this.fraction = this.fraction.slice(0, -1);
      } else {
        this.typingFraction = false;
      }
      return;
    }
    this.whole = this.whole.slice(0, -1);
  }

  clear(): void {
    this.whole = '';
    this.fraction = '';
    this.typingFraction = false;
  }

  /** The same digits in a new object, so a signal holding it notices. */
  copy(): AmountBuffer {
    return Object.assign(new AmountBuffer(), this);
  }

  /** Fills the buffer from an existing amount, for editing. */
  static from(minor: number): AmountBuffer {
    const buffer = new AmountBuffer();
    const magnitude = Math.abs(minor);
    buffer.whole = String(Math.trunc(magnitude / 100));

    const cents = magnitude % 100;
    if (cents !== 0) {
      buffer.typingFraction = true;
      buffer.fraction = String(cents).padStart(2, '0');
    }
    return buffer;
  }
}

/** An amount after an edit, and where the cursor goes in its text. */
export interface AmountEdit {
  buffer: AmountBuffer;
  caret: number;
}

/**
 * Replaces `before.text` from `start` to `end` with `inserted`, wherever the
 * cursor was - the person may put it on any digit to correct it (Jose,
 * 2026-10-02).
 *
 * The text shows full stops between thousands and a comma before the cents,
 * so an edit is made on the digits alone and the result grouped again:
 *   - a digit is a digit wherever it lands;
 *   - one comma or full stop typed starts the cents - the phone's decimal
 *     keyboard offers one or the other by its language - and only when there
 *     are none yet;
 *   - in pasted text a comma is the cents, and a full stop only when it has
 *     one or two digits after it and no comma came with it;
 *   - erasing a grouping full stop alone erases the digit before it, which is
 *     what the backspace key meant.
 */
export function editAmount(before: AmountBuffer, start: number, end: number, inserted: string): AmountEdit {
  const shown = before.text;
  start = Math.max(0, Math.min(start, shown.length));
  end = Math.max(start, Math.min(end, shown.length));
  if (inserted === '' && end - start === 1 && shown[start] === '.' && start > 0) start -= 1;

  // The digits and the comma, without the grouping: what `raw` holds.
  const rawAt = (i: number) => shown.slice(0, i).replace(/\./g, '').length;
  const raw = before.raw;
  const from = rawAt(start);
  const to = rawAt(end);

  const single = inserted.length === 1;
  const point = !single && !inserted.includes(',') && /\.\d{1,2}$/.test(inserted) ? inserted.lastIndexOf('.') : -1;
  let added = '';
  [...inserted].forEach((character, i) => {
    if (/[0-9]/.test(character)) added += character;
    else if (character === ',' || (single && character === '.') || i === point) added += ',';
  });

  const tail = raw.slice(to);
  // A separator already there, outside what was replaced, stays the one.
  if ((raw.slice(0, from) + tail).includes(',')) added = added.replace(/,/g, '');
  const head = raw.slice(0, from) + added;
  const buffer = bufferOf(head + tail);
  // The cursor follows what was before it: the same buffer built from the
  // head alone says how many of its characters survived.
  const kept = Math.min(bufferOf(head).raw.length, buffer.raw.length);
  return { buffer, caret: textIndexOf(buffer.text, kept) };
}

/**
 * What the phone's keyboard did to the field, read from its new value: the
 * part that changed is what lies between what stayed the same at both ends.
 * `caret` - where the cursor is after the edit - settles which digit it was
 * when the same digit sits side by side ("45.900" with a 9 typed after a 9).
 */
export function typedInto(before: AmountBuffer, value: string, caret?: number): AmountEdit {
  const shown = before.text;
  const at = caret ?? value.length;
  const prefixLimit = Math.max(0, at - Math.max(0, value.length - shown.length));
  let p = 0;
  while (p < shown.length && p < value.length && p < prefixLimit && shown[p] === value[p]) p++;
  let s = 0;
  const suffixLimit = Math.min(shown.length - p, value.length - p, Math.max(0, value.length - at));
  while (s < suffixLimit && shown[shown.length - 1 - s] === value[value.length - 1 - s]) s++;
  return editAmount(before, p, shown.length - s, value.slice(p, value.length - s));
}

/** The digits and at most one comma, as typed one by one. */
function bufferOf(raw: string): AmountBuffer {
  const buffer = new AmountBuffer();
  for (const character of raw) {
    if (character === ',') buffer.separator();
    else buffer.push(character);
  }
  return buffer;
}

/** Where, in the grouped text, the first `count` digits and comma end. */
function textIndexOf(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '.') seen++;
    if (seen === count) return i + 1;
  }
  return text.length;
}

/** 1234567 -> 1.234.567, the Colombian way round. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
