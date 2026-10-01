/**
 * A limit's form, new or changed (mockup `14d`).
 *
 * The figure a month, the categories it covers (one or several, each in one
 * limit at most), every account or one, and the notice at 80 %. While the
 * categories are chosen it offers their average of the last three months,
 * one tap away - Jose asked for that not to be forgotten.
 */

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { AccountRow, CategoryRow } from '../../core/database/types';
import { averageBefore, rowsOf, roundedAverage, shiftMonth } from '../../core/limits/limits';
import { LimitsService } from '../../core/limits/limits.service';
import { AmountBuffer } from '../entry/amount-buffer';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { plain } from './plans-words';

@Component({
  selector: 'app-limit-editor',
  templateUrl: './limit-editor.component.html',
  styleUrls: ['./limit-editor.component.scss'],
  imports: [TranslatePipe, BadgeComponent, CategorySheetComponent, AccountPickerComponent, IonIcon],
})
export class LimitEditorComponent {
  private readonly limits = inject(LimitsService);

  /** The limit being changed, or null for a new one. */
  readonly limitId = input<number | null>(null);
  /** A new limit started from "Donde más gastas". */
  readonly startOn = input<number | null>(null);
  readonly done = output<void>();

  readonly amount = signal(new AmountBuffer());
  readonly categoryIds = signal<number[]>([]);
  readonly accountId = signal<number | null>(null);
  readonly warnAt80 = signal(true);
  readonly choosingCategory = signal(false);
  readonly choosingAccount = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly average = signal<number | null>(null);

  readonly isNew = computed(() => this.limitId() === null);

  readonly chosen = computed<CategoryRow[]>(() => {
    const all = this.limits.categories();
    return this.categoryIds().map(id => all.get(id)).filter((c): c is CategoryRow => !!c);
  });

  /** Categories another limit covers, and those already chosen here. */
  readonly hidden = computed(() => [
    ...[...this.limits.taken()].filter(([, limit]) => limit !== this.limitId()).map(([category]) => category),
    ...this.categoryIds(),
  ]);

  readonly accounts = computed<AccountRow[]>(() => this.limits.accounts().filter(a => !a.archived));
  readonly account = computed(() => this.limits.accounts().find(a => a.id === this.accountId()) ?? null);

  readonly canSave = computed(() => this.amount().minor > 0 && this.categoryIds().length > 0 && !this.saving());

  constructor() {
    effect(() => {
      const id = this.limitId();
      const start = this.startOn();
      untracked(() => {
        const terms = id === null ? null : this.limits.limits().find(l => l.id === id) ?? null;
        if (terms) {
          this.amount.set(AmountBuffer.from(terms.amountMinor));
          this.categoryIds.set([...terms.categoryIds]);
          this.accountId.set(terms.accountId);
          this.warnAt80.set(terms.warnAt80);
        } else if (start !== null) {
          this.categoryIds.set([start]);
        }
      });
    });
    // The average of what is chosen, read again whenever the choice changes.
    effect(() => {
      const ids = this.categoryIds();
      const account = this.accountId();
      untracked(() => void this.loadAverage(ids, account));
    });
  }

  private async loadAverage(ids: number[], accountId: number | null): Promise<void> {
    if (ids.length === 0) { this.average.set(null); return; }
    const today = this.limits.today();
    const rows = await this.limits.rowsFor(ids, `${shiftMonth(today.slice(0, 7), -3)}-01`);
    const own = rowsOf({ id: 0, amountMinor: 1, accountId, warnAt80: false, categoryIds: ids }, rows);
    const average = averageBefore(own, today);
    this.average.set(average === null ? null : roundedAverage(average));
  }

  onAmount(text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    this.amount.set(buffer);
  }

  useAverage(): void {
    const average = this.average();
    if (average) this.amount.set(AmountBuffer.from(average));
  }

  addCategory(id: number): void {
    this.choosingCategory.set(false);
    this.categoryIds.update(ids => ids.includes(id) ? ids : [...ids, id]);
  }

  removeCategory(id: number): void {
    this.categoryIds.update(ids => ids.filter(x => x !== id));
  }

  chooseAccount(account: AccountRow | null): void {
    this.choosingAccount.set(false);
    this.accountId.set(account?.id ?? null);
  }

  money(minor: number): string {
    return plain(minor);
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.limits.save(this.limitId(), {
        amountMinor: this.amount().minor,
        accountId: this.accountId(),
        warnAt80: this.warnAt80(),
        categoryIds: this.categoryIds(),
      });
      this.done.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
