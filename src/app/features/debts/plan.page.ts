/**
 * "Salir de tus deudas" (Jose, 2026-10-29, mockups `48a`-`48l`).
 *
 * One question on top - how much more can you put in each month, the app
 * suggesting half of what is usually left over - and one answer: the month
 * you are free of debts, what that saves in interest and how many months
 * sooner than paying every debt only what it is paid today. Two orders, said
 * by what they get you: "Pagar menos intereses" (the highest rate first,
 * recommended) and "Cerrar una pronto" (the smallest first). The arithmetic
 * is `core/debts/debt-plan.ts`; the debts are the assistant's own
 * (`AssistantService.planInputs`), so both say the same.
 *
 * Nothing is written here: a debt tapped says what to pay it this month and
 * opens the one movement form, or the loan's Abonar.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonSpinner } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AssistantService } from '../../core/assistant/assistant.service';
import { ComposeService } from '../../core/ui/compose.service';
import { isoDay, monthName } from '../../core/filters/period';
import { formatMoney } from '../../core/database/money';
import { EA_SCALE } from '../../core/loans/schedule';
import { usualPayer } from '../../core/cards/card-data';
import { keepExtra, keepOrder, keptExtra, keptOrder } from '../../core/debts/plan-prefs';
import { extraChoices, extrasToOffer, planDebts, type Plan, type PlanDebt, type PlanStep } from '../../core/debts/debt-plan';
import { AmountBuffer } from '../entry/amount-buffer';
import { AmountInputDirective } from '../../shared/ui/amount-input.directive';
import { AskButtonComponent } from '../../shared/ui/ask-button.component';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

/** The bars of "Cuándo se acaba cada una", one colour each in order. */
const BAR_COLORS = ['#ff6b6b', '#9b7bff', '#4cb8f5', '#2ecc71', '#f6b93b', '#ff9f43'];

@Component({
  selector: 'app-debt-plan',
  templateUrl: './plan.page.html',
  styleUrls: ['./plan.page.scss'],
  imports: [TranslatePipe, AmountInputDirective, AskButtonComponent, BadgeComponent, EmptyStateComponent, IonContent, IonIcon, IonModal, IonSpinner],
})
export class DebtPlanPage {
  private readonly database = inject(DatabaseService);
  private readonly assistant = inject(AssistantService);
  private readonly compose = inject(ComposeService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  readonly debts = signal<PlanDebt[] | null>(null);
  readonly leftOver = signal(0);
  readonly extra = signal(new AmountBuffer());
  readonly by = signal<'rate' | 'balance'>(keptOrder());
  readonly whyOpen = signal(false);
  readonly choicesOpen = signal(false);
  readonly stepOpen = signal<PlanStep | null>(null);
  readonly colors = BAR_COLORS;

  private readonly load = effect(() => {
    this.database.dataVersion();
    if (this.database.status() !== 'ready') return;
    untracked(() => void this.read());
  });

  private async read(): Promise<void> {
    const { debts, leftOverMinor } = await this.assistant.planInputs();
    this.leftOver.set(leftOverMinor);
    if (this.debts() === null) this.extra.set(AmountBuffer.from(keptExtra(leftOverMinor)));
    this.debts.set(debts);
  }

  readonly extraMinor = computed(() => this.extra().isEmpty ? 0 : this.extra().minor);

  setExtra(buffer: AmountBuffer): void {
    this.extra.set(buffer);
    keepExtra(buffer.isEmpty ? 0 : buffer.minor);
  }

  choose(by: 'rate' | 'balance'): void {
    this.by.set(by);
    keepOrder(by);
  }

  readonly plan = computed<Plan | null>(() => {
    const debts = this.debts();
    return debts && debts.length > 0 ? planDebts(debts, this.extraMinor(), this.by()) : null;
  });
  /** The other order, for what it costs or gets beside this one. */
  readonly other = computed<Plan | null>(() => {
    const debts = this.debts();
    return debts && debts.length > 0 ? planDebts(debts, this.extraMinor(), this.by() === 'rate' ? 'balance' : 'rate') : null;
  });
  readonly single = computed(() => (this.plan()?.steps.length ?? 0) <= 1);
  /** Both orders the same: nothing to choose between. */
  readonly sameOrder = computed(() => {
    const a = this.plan(), b = this.other();
    return !a || !b || a.steps.map(s => s.debt.id).join() === b.steps.map(s => s.debt.id).join();
  });
  /** What paying 100,000 more would save, said when nothing is put in (48i). */
  readonly smallHelp = computed(() => {
    const debts = this.debts();
    if (!debts || this.extraMinor() > 0) return null;
    const plan = planDebts(debts, 10_000_000, this.by());
    return plan.endless || plan.savedMinor <= 0 ? null : plan.savedMinor;
  });
  readonly referenced = computed(() => this.plan()?.steps.filter(s => s.debt.rateFrom === 'reference').map(s => s.debt) ?? []);
  readonly estimated = computed(() => this.plan()?.steps.filter(s => s.debt.paymentFrom === 'estimated').map(s => s.debt) ?? []);
  readonly referencedNames = computed(() => this.referenced().map(d => d.name).join(', '));
  readonly estimatedNames = computed(() => this.estimated().map(d => d.name).join(', '));
  readonly hundredThousand = 10_000_000;

  /** The debt that never ends on what it is paid today. */
  readonly endlessAlone = computed(() => this.plan()?.steps.find(s => s.endlessAlone)?.debt ?? null);

  readonly choices = computed(() => {
    const debts = this.debts();
    if (!debts) return [];
    const extras = extrasToOffer(this.leftOver());
    return extraChoices(debts, this.by(), extras);
  });

  // --- words ---------------------------------------------------------------

  money(minor: number): string {
    return `$ ${formatMoney(Math.round(minor / 100), 'COP', { withSymbol: false, minorUnits: 0 })}`;
  }

  rate(scaled: number): string {
    return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(scaled * 100 / EA_SCALE)} %`;
  }

  /** "julio de 2029" for the month `months` from now (1 = next month). */
  monthOf(months: number, short = false): string {
    const now = new Date();
    const at = new Date(now.getFullYear(), now.getMonth() + months, 1);
    const name = monthName(at, this.i18n.dateLocale());
    if (short) return `${name.slice(0, 3)} ${at.getFullYear()}`;
    return this.i18n.t('ui.plan.monthYear', { month: name, year: at.getFullYear() });
  }

  nextMonthName(): string {
    const now = new Date();
    return monthName(new Date(now.getFullYear(), now.getMonth() + 1, 1), this.i18n.dateLocale());
  }

  /** The bar of one debt, as a share of the longest. */
  barOf(step: PlanStep): number {
    const last = this.plan()?.months ?? 1;
    return Math.max(4, Math.round(step.months / last * 100));
  }

  /** The years marked under the bars. */
  readonly years = computed(() => {
    const last = this.plan()?.months ?? 0;
    const now = new Date();
    const out: { year: number; at: number }[] = [];
    for (let year = now.getFullYear() + 1; ; year++) {
      const months = (year - now.getFullYear()) * 12 - now.getMonth();
      if (months >= last) break;
      out.push({ year, at: Math.round(months / last * 100) });
    }
    return out.length > 4 ? out.filter((_, i) => i % Math.ceil(out.length / 4) === 0) : out;
  });

  /**
   * What one step of the order does, said whole: how much it is paid and
   * why it sits there (Jose, 2026-10-31: the three loose lines read badly).
   */
  why(step: PlanStep, i: number): string {
    const plan = this.plan()!;
    const pay = this.payLine(step.debt);
    if (i === 0) {
      if (plan.extraMinor <= 0) return `${pay} ${this.i18n.t('ui.plan.why.firstNoExtra')}`;
      const kind = plan.by === 'rate' ? 'ui.plan.why.firstRate' : 'ui.plan.why.firstBalance';
      // Paid off next month: it does not take the whole extra, and says where the rest goes.
      if (step.months <= 1) {
        const next = plan.steps[1]?.debt.name;
        const rest = next ? this.i18n.t('ui.plan.why.rest.next', { next }) : this.i18n.t('ui.plan.why.rest.free');
        return this.i18n.t(`${kind}.oneGo` as 'ui.plan.why.firstRate.oneGo', { rest });
      }
      return this.i18n.t(kind, {
        total: this.money(step.debt.paymentMinor + plan.extraMinor),
        pay: this.money(step.debt.paymentMinor),
        amount: this.money(plan.extraMinor),
      });
    }
    const prev = plan.steps[i - 1].debt.name;
    // It ends when its own payment alone would end it: no money of the others reaches it.
    if (!step.endlessAlone && step.monthsAlone <= step.months) return `${pay} ${this.i18n.t('ui.plan.why.alone')}`;
    // Paid off next month with what was left of the extra money.
    if (step.months <= 1 && plan.extraMinor > 0) {
      const next = plan.steps[i + 1]?.debt.name;
      const rest = next ? this.i18n.t('ui.plan.why.rest.next', { next }) : this.i18n.t('ui.plan.why.rest.free');
      return `${pay} ${this.i18n.t('ui.plan.why.leftover', { rest })}`;
    }
    return `${pay} ${this.i18n.t(i === plan.steps.length - 1 ? 'ui.plan.why.last' : 'ui.plan.why.next', { prev })}`;
  }

  payLine(debt: PlanDebt): string {
    if (debt.kind === 'loan') return this.i18n.t('ui.plan.pays.installment', { amount: this.money(debt.paymentMinor) });
    return this.i18n.t(debt.paymentFrom === 'usual' ? 'ui.plan.pays.usual' : 'ui.plan.pays.estimated', { amount: this.money(debt.paymentMinor) });
  }

  icon(debt: PlanDebt): string {
    return debt.kind === 'card' ? 'card-outline' : 'cash-outline';
  }

  // --- taps ----------------------------------------------------------------

  back(): void {
    this.location.back();
  }

  /** The extra this month goes to the first debt still owed, and only it. */
  extraOf(step: PlanStep): number {
    const plan = this.plan();
    return plan && plan.steps[0]?.debt.id === step.debt.id && plan.steps[0].debt.kind === step.debt.kind ? plan.extraMinor : 0;
  }

  async payStep(step: PlanStep): Promise<void> {
    this.stepOpen.set(null);
    const debt = step.debt;
    if (debt.kind === 'loan') {
      await this.router.navigate(['/debts', 'loan', String(debt.id)], this.extraOf(step) > 0 ? { queryParams: { tab: 'ahead' } } : {});
      return;
    }
    const payer = await usualPayer(this.database.driver, debt.id);
    const start = { amountMinor: debt.paymentMinor + this.extraOf(step), onDate: isoDay(new Date()), note: '' };
    this.compose.open('transfer', payer !== null
      ? { route: { from: payer, to: debt.id }, start }
      : { preferredAccountId: debt.id, preferredSide: 'to', start });
  }

  openDebt(debt: PlanDebt): void {
    this.stepOpen.set(null);
    void this.router.navigate(debt.kind === 'loan' ? ['/debts', 'loan', String(debt.id)] : ['/debts', String(debt.id)]);
  }

  useChoice(plan: Plan): void {
    this.setExtra(AmountBuffer.from(plan.extraMinor));
    this.choicesOpen.set(false);
  }

  addDebt(): void {
    void this.router.navigate(['/debts']);
  }
}
