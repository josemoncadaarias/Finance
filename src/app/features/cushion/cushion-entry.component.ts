/**
 * Money coming into or going out of one product's yields.
 *
 * The same screen as a movement in an account - amount on a keypad, a grid to
 * say what it is, the date, a note - because it is the same act, and the one
 * screen is already the one people know. Two things are different, and both
 * are the point of the yields module: what it is is cashback, a correction or
 * something else rather than a category, and the question is only which
 * product, never which account. It writes a `cushion_adjustments` row and
 * nothing else, so the account's balance and net worth do not move.
 */

import { Component, HostListener, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
  IonList, IonItem, IonLabel, IonFooter, IonContent,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as allIcons from 'ionicons/icons';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { monthName } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { YieldsRepository, type YieldPocket } from '../../core/database/repositories/yields.repository';
import { TaxParametersRepository } from '../../core/database/repositories/tax-parameters.repository';
import type { AccountRow } from '../../core/database/types';
import { accrueAndSettle } from '../../core/yields/cdt';
import { todayIso } from '../../core/yields/days';
import { AmountBuffer } from '../entry/amount-buffer';
import { apply, isOperator, operatorFromKey, type Operator, type Pending } from '../entry/calculator';

export interface CushionEntryRequest {
  kind: 'income' | 'expense';
  account: AccountRow;
  pockets: readonly YieldPocket[];
}

type EntryKind = 'cashback' | 'correction' | 'other';

@Component({
  selector: 'app-cushion-entry',
  imports: [
    TranslatePipe,
    IonHeader, IonToolbar, IonButton, IonButtons, IonIcon, IonTextarea, IonDatetime, IonModal,
    IonList, IonItem, IonLabel, IonFooter, IonContent,
  ],
  templateUrl: './cushion-entry.component.html',
  // The movement screen's own styles, so the two can never drift apart.
  styleUrls: ['../entry/entry.component.scss'],
})
export class CushionEntryComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);

  readonly request = input.required<CushionEntryRequest>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly amount = signal(new AmountBuffer());
  readonly pending = signal<Pending | null>(null);
  readonly kind = signal<EntryKind>('cashback');
  readonly pocketId = signal<number | null>(null);
  readonly onDate = signal(todayIso());
  readonly note = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly pickingPocket = signal(false);
  readonly showDate = signal(false);

  /** What it is, in place of a category. Cashback is not withheld and yield is. */
  readonly kinds: readonly {
    value: EntryKind;
    label: 'cushion.kind.cashback' | 'cushion.kind.correction' | 'cushion.kind.other';
    icon: string;
  }[] = [
    { value: 'cashback', label: 'cushion.kind.cashback', icon: 'pricetag-outline' },
    { value: 'correction', label: 'cushion.kind.correction', icon: 'build-outline' },
    { value: 'other', label: 'cushion.kind.other', icon: 'ellipsis-horizontal-circle-outline' },
  ];

  readonly keys = [
    '1', '2', '3', '+',
    '4', '5', '6', '-',
    '7', '8', '9', '×',
    ',', '0', '=', '÷',
  ];

  readonly pocketName = computed(() =>
    this.request().pockets.find(pocket => pocket.id === this.pocketId())?.name ?? '');

  readonly pendingLabel = computed(() => {
    const sum = this.pending();
    return sum ? `${formatMoney(sum.leftMinor, this.request().account.currency_code, { withSymbol: false })} ${sum.operator}` : '';
  });

  readonly dateLabel = computed(() => {
    const iso = this.onDate();
    if (iso === todayIso()) return this.i18n.t('period.today');
    const [year, month, day] = iso.split('-').map(Number);
    return `${day} ${monthName(new Date(year, month - 1, day), this.i18n.dateLocale())} ${year}`;
  });

  readonly missing = computed<string | null>(() => {
    if (this.pending() !== null) return this.i18n.t('entry.need.finishSum');
    if (this.amount().minor <= 0) return this.i18n.t('entry.need.amount');
    return null;
  });

  readonly canSave = computed(() => this.missing() === null && this.pocketId() !== null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    // The usual product, as a movement in the account would start on.
    const pockets = this.request().pockets;
    this.pocketId.set((pockets.find(pocket => pocket.is_default === 1) ?? pockets[0])?.id ?? null);
  }

  press(key: string): void {
    if (isOperator(key)) { this.operate(key); return; }
    if (key === '=') { this.equals(); return; }

    const buffer = this.amount();
    if (key === '<') buffer.backspace();
    else if (key === ',') buffer.separator();
    else buffer.push(key);
    // A new object so the signal notices: the buffer mutates in place.
    this.amount.set(Object.assign(Object.create(AmountBuffer.prototype), buffer));
  }

  operate(operator: Operator): void {
    const buffer = this.amount();
    const sum = this.pending();
    if (sum && !buffer.isEmpty) {
      const result = apply(sum.leftMinor, sum.operator, buffer.minor);
      this.pending.set({ leftMinor: result, operator });
    } else if (!buffer.isEmpty) {
      this.pending.set({ leftMinor: buffer.minor, operator });
    } else if (sum) {
      this.pending.set({ ...sum, operator });
      return;
    } else {
      return;
    }
    this.amount.set(new AmountBuffer());
  }

  equals(): void {
    const sum = this.pending();
    if (!sum) return;
    const buffer = this.amount();
    const result = buffer.isEmpty ? sum.leftMinor : apply(sum.leftMinor, sum.operator, buffer.minor);
    this.pending.set(null);
    this.amount.set(AmountBuffer.from(Math.max(result, 0)));
  }

  clearAmount(): void {
    this.pending.set(null);
    this.amount.set(new AmountBuffer());
  }

  clearNote(): void {
    this.note.set('');
  }

  choosePocket(id: number): void {
    this.pocketId.set(id);
    this.pickingPocket.set(false);
  }

  pickDate(value: string | null): void {
    if (value) this.onDate.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  /** Digits, comma, backspace, Enter and Escape from a physical keyboard. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); this.cancelled.emit(); return; }
    if (this.pickingPocket() || this.showDate()) return;
    if ((event.target as HTMLElement | null)?.closest('ion-textarea, input, textarea')) return;

    const operator = operatorFromKey(event.key);
    if (operator) { event.preventDefault(); this.operate(operator); return; }
    if (event.key === '=') { event.preventDefault(); this.equals(); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.pending() !== null) this.equals();
      else if (this.canSave()) void this.save();
      return;
    }
    if (/^[0-9]$/.test(event.key)) { event.preventDefault(); this.press(event.key); return; }
    if (event.key === ',' || event.key === '.') { event.preventDefault(); this.press(','); return; }
    if (event.key === 'Backspace') { event.preventDefault(); this.press('<'); }
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.error.set('');

    try {
      const db = this.database.driver;
      const yields = new YieldsRepository(db);
      const tax = new TaxParametersRepository(db);
      const { account, kind } = this.request();
      // The sign comes from the button pressed, never from what was typed.
      const signed = kind === 'expense' ? -this.amount().minor : this.amount().minor;

      await db.transaction(async () => {
        await yields.adjust({
          account_id: account.id,
          on_date: this.onDate(),
          amount_minor: signed,
          kind: this.kind(),
          pocket_id: this.pocketId(),
          note: this.note().trim() || null,
        });
        // Money that lands on a day changes what every day after it earns on,
        // so those days are worked out again. Days corrected by hand stay.
        await yields.clearDays(account.id, this.onDate());
      });

      await accrueAndSettle(db, yields, tax, account.id, todayIso());
      this.database.dataChanged();
      this.saved.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
