/**
 * Formats a minor-unit amount for display.
 *
 * The only place in the app where money becomes a decimal. Everything upstream
 * works in integer cents; by the time a value reaches here it is on its way to
 * the screen and never comes back.
 */

import { Pipe, type PipeTransform } from '@angular/core';
import { formatMoney } from '../core/database/money';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(minor: number | null | undefined, currency = 'COP', withSymbol = false): string {
    if (minor === null || minor === undefined) return '—';
    return formatMoney(minor, currency, { withSymbol });
  }
}
