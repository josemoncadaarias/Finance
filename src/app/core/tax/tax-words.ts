/**
 * The tax module's words in the language the app is being read in.
 *
 * Spanish is `tax-form.ts` itself, handed back untouched: the same objects,
 * not copies, so the Spanish screen and spreadsheet cannot drift from what
 * they were. English is `tax-form.en.ts` laid over it row by row, keeping the
 * Spanish structure - ids, keys, boxes, formats, when a row applies - and
 * changing only words. A row the English has no entry for keeps its Spanish,
 * the same fallback as the rest of the app, and the tests fail on it.
 */

import type { Language } from '../i18n/translations';
import type { Sourced } from './defaults';
import {
  EMPLOYMENT_TEXT, MONTH_NAMES, TAX_FORM, TAX_SOURCES, TAX_TEXT,
  type EmploymentWords, type FormRow, type FormSection, type TaxSource, type TaxText,
} from './tax-form';
import {
  EMPLOYMENT_TEXT_EN, MONTH_NAMES_EN, TAX_FORM_EN, TAX_SOURCE_LABELS_EN, TAX_TEXT_EN, type SectionWords,
} from './tax-form.en';

export interface TaxWords {
  text: TaxText;
  form: readonly FormSection[];
  employment: EmploymentWords;
  months: readonly string[];
  sources: readonly TaxSource[];
}

const SPANISH: TaxWords = {
  text: TAX_TEXT,
  form: TAX_FORM,
  employment: EMPLOYMENT_TEXT,
  months: MONTH_NAMES,
  sources: TAX_SOURCES,
};

let english: TaxWords | null = null;

export function taxWords(language: Language): TaxWords {
  if (language !== 'en') return SPANISH;
  english ??= {
    text: TAX_TEXT_EN,
    form: TAX_FORM.map(section => translateSection(section, TAX_FORM_EN[section.id])),
    employment: EMPLOYMENT_TEXT_EN,
    months: MONTH_NAMES_EN,
    sources: TAX_SOURCES.map(source => ({ ...source, label: TAX_SOURCE_LABELS_EN[source.url] ?? source.label })),
  };
  return english;
}

/** Where a parameter came from, in the reader's language. */
export function sourceIn(sourced: Sourced, language: Language): string {
  return language === 'en' ? sourced.sourceEn : sourced.source;
}

/** A label with its gloss, where a line of text has room for only one string. */
export function withGloss(label: string, gloss: string | undefined): string {
  return gloss ? `${label} (${gloss})` : label;
}

/**
 * How a row is found in a translation: `input.<key>`, `computed.<key>` or
 * `note.<n>`, the n-th note of its section. Special rows carry no words of
 * their own and have none.
 */
export function rowWordsId(row: FormRow, noteIndex: number): string | null {
  switch (row.kind) {
    case 'input':
    case 'computed':
      return `${row.kind}.${row.key}`;
    case 'note':
      return `note.${noteIndex}`;
    default:
      return null;
  }
}

/** Every row of a section with its words id, notes counted in order. */
export function rowsWithIds(section: FormSection): { row: FormRow; id: string | null }[] {
  let notes = 0;
  return section.rows.map(row => ({ row, id: rowWordsId(row, row.kind === 'note' ? notes++ : 0) }));
}

function translateSection(section: FormSection, words: SectionWords | undefined): FormSection {
  if (!words) return section;
  return {
    ...section,
    title: words.title,
    titleGloss: words.titleGloss,
    subtitle: section.subtitle === undefined ? undefined : (words.subtitle ?? section.subtitle),
    rows: rowsWithIds(section).map(({ row, id }) => {
      const found = id ? words.rows[id] : undefined;
      if (!found) return row;
      switch (row.kind) {
        case 'note':
          return { ...row, text: found.text ?? row.text };
        case 'input':
        case 'computed':
          return {
            ...row,
            label: found.label ?? row.label,
            gloss: found.gloss,
            hint: row.hint === undefined ? undefined : (found.hint ?? row.hint),
          };
        default:
          return row;
      }
    }),
  };
}
