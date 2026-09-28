/**
 * Reading a statement, as the person sees it: one screen, whoever asked.
 *
 * Two places read statements - the "+" (for an account that exists, or a new
 * one) and the account form - and each used to carry its own spinner, its own
 * `window.prompt` for the password and its own alert when a file could not be
 * read. The redesign draws that once (mockups `6u`, `6v`, `6y`): the four
 * stages with the page and the percentage, "Nada se guarda hasta el final"
 * and Cancelar; the password as a dialog; a file with no text as a dialog
 * with "Elegir otro". This service holds that state, and
 * `StatementFlowComponent`, placed once in the shell, draws it.
 *
 *     const result = await flow.run(file, (password, watch) =>
 *       statements.importInto(accountId, file, password, watch));
 *
 * `run` answers the reader's result, `null` when the person stopped or gave
 * up, or `'again'` when they asked to choose another file.
 */

import { Injectable, computed, inject, signal } from '@angular/core';

import { I18nService } from '../i18n/i18n.service';
import {
  StatementCancelled, StatementLocked, StatementUnreadable,
  type ReadingProgress,
} from './pdf-text';

export interface ReadingWatch {
  signal?: AbortSignal;
  onProgress?: (progress: ReadingProgress) => void;
}

type Reader<T> = (password: string | undefined, watch: ReadingWatch) => Promise<T>;

@Injectable({ providedIn: 'root' })
export class StatementFlowService {
  private readonly i18n = inject(I18nService);

  /** The reading screen is on show. */
  readonly active = signal(false);
  readonly fileName = signal('');
  readonly part = signal(0);
  readonly stage = signal<ReadingProgress['stage']>('opening');
  readonly page = signal<{ page: number; pages: number } | null>(null);

  /** The password dialog is open. */
  readonly askingPassword = signal(false);
  /** The file could not be read: the dialog, and what went wrong. */
  readonly unreadable = signal<string | null>(null);

  readonly percent = computed(() => Math.min(99, Math.round(this.part() * 100)));
  readonly stageIndex = computed(() =>
    ['opening', 'pages', 'reading', 'writing'].indexOf(this.stage()));
  readonly pageLabel = computed(() => {
    const at = this.page();
    return at === null
      ? this.i18n.t(`statement.stage.${this.stage()}` as 'statement.stage.opening')
      : this.i18n.t('statement.stage.page', at);
  });

  private stopper: AbortController | null = null;
  private answerPassword: ((typed: string | null) => void) | null = null;
  private answerUnreadable: ((again: boolean) => void) | null = null;

  async run<T>(file: File, read: Reader<T>): Promise<T | null | 'again'> {
    this.fileName.set(file.name);
    this.active.set(true);
    let password: string | undefined;
    try {
      for (;;) {
        this.reset();
        try {
          return await read(password, this.watch());
        } catch (problem) {
          if (problem instanceof StatementCancelled) return null;
          if (problem instanceof StatementLocked) {
            const typed = await this.askPassword();
            if (typed === null) return null;
            password = typed;
            continue;
          }
          const reason = problem instanceof StatementUnreadable
            ? problem.reason
            : problem instanceof Error ? problem.message : String(problem);
          const again = await this.sayUnreadable(reason);
          return again ? 'again' : null;
        }
      }
    } finally {
      this.active.set(false);
      this.stopper = null;
    }
  }

  cancel(): void {
    this.stopper?.abort();
  }

  givePassword(typed: string | null): void {
    this.askingPassword.set(false);
    const answer = this.answerPassword;
    this.answerPassword = null;
    answer?.(typed && typed.length > 0 ? typed : null);
  }

  closeUnreadable(again: boolean): void {
    this.unreadable.set(null);
    const answer = this.answerUnreadable;
    this.answerUnreadable = null;
    answer?.(again);
  }

  private reset(): void {
    this.part.set(0);
    this.stage.set('opening');
    this.page.set(null);
  }

  private watch(): ReadingWatch {
    this.stopper = new AbortController();
    return {
      signal: this.stopper.signal,
      onProgress: progress => {
        this.part.set(progress.part);
        this.stage.set(progress.stage);
        this.page.set(progress.page && progress.pages ? { page: progress.page, pages: progress.pages } : null);
      },
    };
  }

  private askPassword(): Promise<string | null> {
    this.askingPassword.set(true);
    return new Promise(resolve => { this.answerPassword = resolve; });
  }

  private sayUnreadable(reason: string): Promise<boolean> {
    this.unreadable.set(reason);
    return new Promise(resolve => { this.answerUnreadable = resolve; });
  }
}
