/** Maps an amount's sign to a CSS class, so colour follows the money. */

import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({ name: 'sign' })
export class SignPipe implements PipeTransform {
  transform(minor: number | null | undefined): 'positive' | 'negative' | 'zero' {
    if (!minor) return 'zero';
    return minor > 0 ? 'positive' : 'negative';
  }
}
