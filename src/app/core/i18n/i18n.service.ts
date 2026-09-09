/**
 * Which language the app speaks, and the words it uses to do it.
 *
 * A signal rather than a build-time choice. Angular's own i18n compiles one
 * bundle per language, which means changing language means reloading the app
 * from a different URL — on a phone that is a jarring thing to do to someone
 * who just wanted to tap a flag. Here the language is state, every label reads
 * it, and the screen re-renders in place.
 *
 * The choice lives in `localStorage`, not in the database: it has to be known
 * before the database is open, since the first thing the app can say is
 * "opening the database…".
 */

import { Injectable, computed, signal } from '@angular/core';

import { DICTIONARIES, LANGUAGES, SPANISH, type Language, type TranslationKey } from './translations';

const STORAGE_KEY = 'finance.language';

/** Spanish by default: it is the language the app was written for. */
const DEFAULT: Language = 'es';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly language = signal<Language>(readStored());

  readonly languages = LANGUAGES;

  readonly current = computed(() =>
    LANGUAGES.find(l => l.code === this.language()) ?? LANGUAGES[0]);

  /**
   * The locale used for dates and numbers.
   *
   * Money keeps Colombian formatting whatever the language is — a peso amount
   * is written the same way by someone reading the app in English, and
   * switching the thousands separator mid-session would make the same figure
   * look like a different one.
   */
  readonly dateLocale = computed(() => (this.language() === 'en' ? 'en-GB' : 'es-CO'));

  set(language: Language): void {
    this.language.set(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // A private window or blocked storage: the choice holds for this session
      // and that is enough. Not being able to remember it is not a reason to
      // refuse to change it.
    }
  }

  /**
   * The phrase for a key, with `{placeholders}` filled in.
   *
   * An unknown key falls back to Spanish and then to the key itself: a screen
   * showing a Spanish word is a smaller failure than one showing
   * `summary.empty.title`.
   */
  t(key: TranslationKey, values?: Record<string, string | number>): string {
    const phrase = DICTIONARIES[this.language()]?.[key] ?? SPANISH[key] ?? key;
    if (!values) return phrase;

    return phrase.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in values ? String(values[name]) : whole);
  }
}

function readStored(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // Storage can throw outright, not just come back empty.
  }
  return DEFAULT;
}
