/**
 * Money coming into or going out of one product's yields, or moved between
 * two products of the same account.
 *
 * The same screen as a movement or a transfer in an account - amount on a
 * keypad, the date, a note - because it is the same act, and that screen is
 * already the one people know. What differs is the point of the yields
 * module: an income or expense says what it is (cashback, a correction,
 * something else) rather than a category, and every question is about a
 * product, never an account.
 *
 * An income or expense writes a `cushion_adjustments` row: the product's
 * balance moves, the account's does not, and net worth stays where it was. A
 * transfer is two legs of one transfer inside the account, so the account's
 * balance is exactly what it was and only which product holds it changes.
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
import { TransfersRepository } from '../../core/database/repositories/transfers.repository';
import type { AccountRow } from '../../core/database/types';
import { accrueAndSettle } from '../../core/yields/cdt';
import { todayIso } from '../../core/yields/days';
import { AmountBuffer } from '../entry/amount-buffer';
import { apply, isOperator, operatorFromKey, type Operator, type Pending } from '../entry/calculator';

export interface CushionEntryRequest {
  kind: 'income' | 'expense' | 'transfer';
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
  /** The product the money touches; for a transfer, the one it leaves. */
  readonly pocketId = signal<number | null>(null);
  /** For a transfer, the product it goes into. */
  readonly toPocketId = signal<number | null>(null);
  readonly onDate = signal(todayIso());
  readonly note = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  /** Which side's product the sheet is asking for, or null when it is closed. */
  readonly pickingPocket = signal<'from' | 'to' | null>(null);
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

  readonly isTransfer = computed(() => this.request().kind === 'transfer');

  readonly title = computed(() => {
    const kind = this.request().kind;
    if (kind === 'transfer') return this.i18n.t('cushion.move.title');
    return this.i18n.t(kind === 'expense' ? 'cushion.entry.newExpense' : 'cushion.entry.newIncome');
  });

  readonly pocketName = computed(() => this.nameOf(this.pocketId()));
  readonly toPocketName = computed(() => this.nameOf(this.toPocketId()));

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
    if (this.isTransfer() && (this.toPocketId() === null || this.toPocketId() === this.pocketId())) {
      return this.i18n.t('cushion.move.samePocket');
    }
    return null;
  });

  readonly canSave = computed(() => this.missing() === null && this.pocketId() !== null);

  constructor() {
    addIcons(allIcons as unknown as Record<string, string>);
  }

  ngOnInit(): void {
    // The usual product, as a movement in the account would start on; a
    // transfer sends from it to the next one.
    const pockets = this.request().pockets;
    const usual = (pockets.find(pocket => pocket.is_default === 1) ?? pockets[0])?.id ?? null;
    this.pocketId.set(usual);
    if (this.isTransfer()) this.toPocketId.set(this.otherThan(usual));
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
      this.pending.set({ leftMinor: apply(sum.leftMinor, sum.operator, buffer.minor), operator });
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

  /** Answers the sheet. The two ends of a transfer can never be the same product. */
  choosePocket(id: number): void {
    if (this.pickingPocket() === 'to') {
      this.toPocketId.set(id);
      if (this.pocketId() === id) this.pocketId.set(this.otherThan(id));
    } else {
      this.pocketId.set(id);
      if (this.isTransfer() && this.toPocketId() === id) this.toPocketId.set(this.otherThan(id));
    }
    this.pickingPocket.set(null);
  }

  swap(): void {
    const from = this.pocketId();
    this.pocketId.set(this.toPocketId());
    this.toPocketId.set(from);
  }

  pickDate(value: string | null): void {
    if (value) this.onDate.set(value.slice(0, 10));
    this.showDate.set(false);
  }

  private nameOf(id: number | null): string {
    return this.request().pockets.find(pocket => pocket.id === id)?.name ?? '';
  }

  private otherThan(id: number | null): number | null {
    return this.request().pockets.find(pocket => pocket.id !== id)?.id ?? null;
  }

  /** Digits, comma, backspace, Enter and Escape from a physical keyboard. */
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); this.cancelled.emit(); return; }
    if (this.pickingPocket() !== null || this.showDate()) return;
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
      const minor = this.amount().minor;

      await db.transaction(async () => {
        if (kind === 'transfer') {
          // Two legs of one transfer, both in this account.
          await new TransfersRepository(db).create({
            occurred_on: this.onDate(),
            description: this.note().trim() || null,
            from: { account_id: account.id, pocket_id: this.pocketId(), amount_minor: minor },
            to: { account_id: account.id, pocket_id: this.toPocketId(), amount_minor: minor },
          });
        } else {
          await yields.adjust({
            account_id: account.id,
            on_date: this.onDate(),
            // The sign comes from the button pressed, never from what was typed.
            amount_minor: kind === 'expense' ? -minor : minor,
            kind: this.kind(),
            pocket_id: this.pocketId(),
            note: this.note().trim() || null,
          });
        }
        // What lands or leaves on a day changes what every day after it earns
        // on, so those days are worked out again. Days corrected by hand stay.
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
