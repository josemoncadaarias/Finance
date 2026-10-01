/**
 * A goal's form, new or changed (mockups `15d`-`15g`, `15m`).
 *
 * The name and its face, the figure (or, for an emergency fund, so many
 * months of what is really spent), the month to reach it by, and where the
 * money sits: one or several accounts or products, each counting all it holds
 * or only what comes in from now - or every account. A place another goal
 * holds is shown and cannot be taken, so no peso counts in two goals.
 */

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import type { AccountRow } from '../../core/database/types';
import type { GoalKind, PlaceCounts } from '../../core/goals/goals';
import { GoalsService } from '../../core/goals/goals.service';
import { placeKey } from '../../core/goals/goals.repository';
import { monthOf, shiftMonth } from '../../core/limits/limits';
import { AmountBuffer } from '../entry/amount-buffer';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { GOAL_FACES } from './goal-words';
import { monthLabel, plain } from './plans-words';

interface Chosen { accountId: number; productId: number | null; counts: PlaceCounts }
interface Spot { accountId: number; productId: number | null; nativeMinor: number; pesos: number | null }

@Component({
  selector: 'app-goal-editor',
  templateUrl: './goal-editor.component.html',
  styleUrls: ['./limit-editor.component.scss', './goal-editor.component.scss'],
  imports: [TranslatePipe, BadgeComponent, IonIcon, IonModal],
})
export class GoalEditorComponent {
  readonly goals = inject(GoalsService);
  private readonly i18n = inject(I18nService);

  /** The goal being changed, or null for a new one. */
  readonly goalId = input<number | null>(null);
  /** A new goal's kind: an ordinary one or an emergency fund. */
  readonly kind = input<GoalKind>('custom');
  readonly done = output<void>();

  readonly name = signal('');
  readonly face = signal(GOAL_FACES[0]);
  readonly amount = signal(new AmountBuffer());
  readonly dueMonth = signal<string | null>(null);
  readonly months = signal<number | null>(null);
  readonly goalKind = signal<GoalKind>('custom');
  readonly allAccounts = signal(false);
  readonly chosen = signal<Chosen[]>([]);
  readonly spots = signal<Spot[]>([]);
  readonly allNow = signal<{ everything: number; others: { name: string; pesos: number }[] } | null>(null);

  readonly choosingPlaces = signal(false);
  readonly choosingMonth = signal(false);
  readonly choosingFace = signal(false);
  /** The place whose "qué cuenta" sheet is open. */
  readonly counting = signal<Chosen | null>(null);
  /** The places ticked while the sheet is open. */
  readonly picking = signal<{ all: boolean; keys: Set<string> }>({ all: false, keys: new Set() });
  readonly saving = signal(false);
  readonly error = signal('');

  readonly isNew = computed(() => this.goalId() === null);
  readonly emergency = computed(() => this.goalKind() === 'emergency');
  readonly monthChoices = computed(() => Array.from({ length: 60 }, (_, i) => shiftMonth(monthOf(this.goals.today()), i + 1)));
  readonly faces = GOAL_FACES;

  /** The accounts a goal can use, each with its products under it. */
  readonly usable = computed<{ account: AccountRow; products: { id: number; name: string }[] }[]>(() =>
    this.goals.accounts().filter(a => !a.archived && a.type !== 'credit' && !this.goals.isLoan(a.id))
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map(account => ({ account, products: this.goals.products().filter(p => p.account_id === account.id).map(p => ({ id: p.id, name: p.name })) })));

  /** Another goal holding this place, or the whole account it sits in. */
  takenBy(accountId: number, productId: number | null): string | null {
    const id = this.goalId();
    const taken = this.goals.taken();
    const own = (t: { id: number; name: string } | undefined) => t && t.id !== id ? t.name : null;
    return own(taken.get(placeKey(accountId, productId)))
      ?? (productId !== null ? own(taken.get(placeKey(accountId, null))) : null)
      ?? (productId === null ? own([...taken].find(([k, t]) => k.startsWith(`${accountId}:`) && k !== `${accountId}:0` && t.id !== id)?.[1]) : null);
  }

  readonly allTakenBy = computed(() => {
    const g = this.goals.allAccountsGoal();
    return g && g.id !== this.goalId() ? g.name : null;
  });

  spot(accountId: number, productId: number | null): Spot | null {
    return this.spots().find(s => s.accountId === accountId && s.productId === productId) ?? null;
  }

  account(id: number): AccountRow | null {
    return this.goals.accounts().find(a => a.id === id) ?? null;
  }

  productName(id: number | null): string {
    return id === null ? '' : this.goals.products().find(p => p.id === id)?.name ?? '';
  }

  /** What one chosen place counts today, in pesos. */
  counted(c: Chosen): number {
    if (c.counts === 'from_start') {
      const existing = this.goals.view(this.goalId() ?? -1)?.places.find(p => p.place.accountId === c.accountId && p.place.productId === c.productId);
      return existing && existing.place.counts === 'from_start' ? existing.pesos : 0;
    }
    return this.spot(c.accountId, c.productId)?.pesos ?? 0;
  }

  readonly together = computed(() => {
    if (this.allAccounts()) {
      const all = this.allNow();
      return all ? all.everything - all.others.reduce((sum, o) => sum + o.pesos, 0) : 0;
    }
    this.spots();
    return this.chosen().reduce((sum, c) => sum + this.counted(c), 0);
  });

  /** What each month needs, as it is typed. */
  readonly perMonth = computed(() => {
    const due = this.dueMonth();
    const left = Math.max(0, this.amount().minor - this.together());
    if (!due || left === 0) return null;
    const [ty, tm] = due.split('-').map(Number);
    const [fy, fm] = monthOf(this.goals.today()).split('-').map(Number);
    const months = Math.max(1, (ty * 12 + tm) - (fy * 12 + fm));
    return { left, months, each: Math.ceil(left / months) };
  });

  readonly canSave = computed(() => this.name().trim() !== '' && this.amount().minor > 0
    && (this.allAccounts() || this.chosen().length > 0) && !this.saving());

  constructor() {
    effect(() => {
      const id = this.goalId();
      const kind = this.kind();
      untracked(() => {
        const view = id === null ? null : this.goals.view(id);
        if (view) {
          const t = view.terms;
          this.name.set(t.name);
          this.face.set(GOAL_FACES.find(f => f.icon === t.icon) ?? { icon: t.icon, color: t.color ?? GOAL_FACES[0].color });
          this.amount.set(AmountBuffer.from(t.amountMinor));
          this.dueMonth.set(t.dueMonth);
          this.months.set(t.months);
          this.goalKind.set(t.kind);
          this.allAccounts.set(t.allAccounts);
          this.chosen.set(t.places.map(p => ({ accountId: p.accountId, productId: p.productId, counts: p.counts })));
        } else {
          this.goalKind.set(kind);
          if (kind === 'emergency') {
            this.name.set(this.i18n.t('goals.emergency.name'));
            this.face.set(GOAL_FACES[1]);
            this.setMonths(6);
          }
        }
        void this.loadSpots();
      });
    });
  }

  private async loadSpots(): Promise<void> {
    this.spots.set(await this.goals.places());
    this.allNow.set(await this.goals.allAccountsNow(this.goalId()));
  }

  onAmount(text: string): void {
    const buffer = new AmountBuffer();
    for (const character of text) {
      if (/[0-9]/.test(character)) buffer.push(character);
      else if (character === ',') buffer.separator();
    }
    this.amount.set(buffer);
  }

  setMonths(months: number): void {
    this.months.set(months);
    this.amount.set(AmountBuffer.from(this.goals.emergencyFor(months)));
  }

  monthText(month: string | null): string {
    return month === null ? this.i18n.t('goals.form.noDate') : monthLabel(month, this.i18n);
  }

  chooseMonth(month: string | null): void {
    this.dueMonth.set(month);
    this.choosingMonth.set(false);
  }

  openPlaces(): void {
    this.picking.set({ all: this.allAccounts(), keys: new Set(this.chosen().map(c => placeKey(c.accountId, c.productId))) });
    this.choosingPlaces.set(true);
  }

  isPicked(accountId: number, productId: number | null): boolean {
    return this.picking().keys.has(placeKey(accountId, productId));
  }

  toggle(accountId: number, productId: number | null): void {
    if (this.takenBy(accountId, productId)) return;
    this.picking.update(p => {
      const keys = new Set(p.keys);
      const key = placeKey(accountId, productId);
      if (keys.has(key)) keys.delete(key);
      else {
        keys.add(key);
        // A whole account and one of its products cannot both be taken: the product is inside it.
        if (productId === null) for (const k of [...keys]) { if (k.startsWith(`${accountId}:`) && k !== key) keys.delete(k); }
        else keys.delete(placeKey(accountId, null));
      }
      return { all: false, keys };
    });
  }

  toggleAll(): void {
    if (this.allTakenBy()) return;
    this.picking.update(p => ({ all: !p.all, keys: p.all ? p.keys : new Set() }));
  }

  readonly pickedPesos = computed(() => {
    const p = this.picking();
    if (p.all) return this.together();
    return [...p.keys].reduce((sum, key) => {
      const [a, pr] = key.split(':').map(Number);
      return sum + (this.spot(a, pr === 0 ? null : pr)?.pesos ?? 0);
    }, 0);
  });

  donePlaces(): void {
    const p = this.picking();
    this.allAccounts.set(p.all);
    if (p.all) this.chosen.set([]);
    else {
      const before = this.chosen();
      this.chosen.set([...p.keys].map(key => {
        const [a, pr] = key.split(':').map(Number);
        const productId = pr === 0 ? null : pr;
        return before.find(c => c.accountId === a && c.productId === productId) ?? { accountId: a, productId, counts: 'all' as PlaceCounts };
      }));
    }
    this.choosingPlaces.set(false);
  }

  remove(c: Chosen): void {
    this.chosen.update(list => list.filter(x => x !== c));
  }

  setCounts(counts: PlaceCounts): void {
    const c = this.counting();
    if (c) this.chosen.update(list => list.map(x => x === c ? { ...x, counts } : x));
    this.counting.set(null);
  }

  nativeText(c: Chosen): string {
    const account = this.account(c.accountId);
    const spot = this.spot(c.accountId, c.productId);
    if (!account || !spot) return '';
    if (account.currency_code === 'COP') return plain(spot.nativeMinor);
    return `${account.currency_code} ${plain(spot.nativeMinor)}`;
  }

  money = plain;

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.goals.save(this.goalId(), {
        name: this.name().trim(),
        icon: this.face().icon,
        color: this.face().color,
        amountMinor: this.amount().minor,
        dueMonth: this.dueMonth(),
        kind: this.goalKind(),
        months: this.emergency() ? this.months() : null,
        allAccounts: this.allAccounts(),
        places: this.allAccounts() ? [] : this.chosen(),
      });
      this.done.emit();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
