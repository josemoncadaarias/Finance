/**
 * `{{ 'entry.save' | t }}` in a template.
 *
 * Impure on purpose: the language is a signal, and a pure pipe would keep
 * showing the old words until something else happened to change. The cost is a
 * map lookup per binding per change detection cycle, which is nothing next to
 * the alternative of a screen half-translated until it is touched.
 */

import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from './i18n.service';
import type { TranslationKey } from './translations';

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, values?: Record<string, string | number>): string {
    return this.i18n.t(key, values);
  }
}
