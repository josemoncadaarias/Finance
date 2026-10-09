/**
 * Más: everything the drawer held that is not a tab (mockup `8a`).
 *
 * On top, whose Google account holds the copy and when it was last saved;
 * then rows under small headings, each saying its current value: Tus datos
 * (Movimientos por revisar, Categorías, Avisos del banco, Importar y
 * exportar), Herramientas (Simulador de renta) and Preferencias (Idioma,
 * Apariencia). Monedas y tasas lives under Cuentas only - one way in.
 *
 * Where Google sign-in cannot work (the browser) there is no Google card, and
 * where notifications cannot be read (the browser, an iPhone) there is no
 * Avisos del banco row: nothing to open rather than a screen that says no
 * (Jose, 2026-09-28).
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import type { Language } from '../../core/i18n/translations';
import { DatabaseService } from '../../core/database/database.service';
import { DemoService } from '../../core/demo/demo.service';
import { ProposalsRepository } from '../../core/database/repositories/proposals.repository';
import { GoogleAccountService } from '../../core/cloud/google-account.service';
import { CloudBackupService } from '../../core/cloud/cloud-backup.service';
import { AvatarComponent } from '../../core/cloud/avatar.component';
import { ThemeService, THEMES, type ThemeChoice } from '../../core/theme/theme.service';
import { AccentService, ACCENTS } from '../../core/theme/accent.service';
import { BankNotifications } from '../../core/notifications/bank-notifications';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { FlagComponent } from '../../shared/ui/flag.component';
import { loadCards, type CardSummary } from '../../core/cards/card-data';
import { isoDay } from '../../core/filters/period';
import { plain, shortDate } from '../debts/card-words';
import { LoansRepository } from '../../core/loans/loans.repository';
import { loanSchedule, type LoanSchedule } from '../../core/loans/schedule';
import { LimitsService } from '../../core/limits/limits.service';
import { GoalsService } from '../../core/goals/goals.service';

@Component({
  selector: 'app-more',
  templateUrl: './more.page.html',
  styleUrls: ['./more.page.scss'],
  imports: [TranslatePipe, AvatarComponent, BadgeComponent, FlagComponent, IonContent, IonIcon, IonModal],
})
export class MorePage {
  private readonly router = inject(Router);
  private readonly database = inject(DatabaseService);
  readonly i18n = inject(I18nService);
  readonly google = inject(GoogleAccountService);
  readonly cloud = inject(CloudBackupService);
  readonly theme = inject(ThemeService);
  readonly accent = inject(AccentService);
  private readonly limits = inject(LimitsService);
  private readonly goals = inject(GoalsService);
  readonly demo = inject(DemoService);

  /** Planes: how this month's limits go, or what a limit is for (14a). */
  readonly plansLate = computed(() => this.limits.current().passed.length > 0);
  readonly plansLine = computed(() => {
    const v = this.limits.current();
    const goals = this.goals.inCourse().length;
    if (v.limits.length === 0 && goals === 0) return this.i18n.t('more.plans.hint');
    const parts: string[] = [];
    if (v.passed.length) parts.push(this.i18n.t('more.plans.passed', { count: v.passed.length }));
    if (v.fine.length) parts.push(this.i18n.t('more.plans.fine', { count: v.fine.length }));
    if (goals) {
      const late = this.goals.late().length;
      parts.push(this.i18n.t('more.plans.goals', { count: goals }) + (late ? ', ' + this.i18n.t('more.plans.goalsLate', { count: late }) : ''));
    }
    return parts.join(' · ');
  });

  readonly themes = THEMES;
  readonly accents = ACCENTS;

  readonly waiting = signal(0);
  readonly categories = signal<{ active: number; archived: number }>({ active: 0, archived: 0 });
  readonly notificationsSupported = signal(false);
  readonly markedApps = signal(0);
  /** The currencies kept, as the line under "Monedas y TRM": "COP · USD · EUR". */
  readonly currencies = signal<string[]>([]);
  readonly cards = signal<CardSummary[]>([]);
  readonly loans = signal<LoanSchedule[]>([]);

  readonly languageSheet = signal(false);
  readonly appearanceSheet = signal(false);

  readonly year = new Date().getFullYear();

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      void untracked(() => this.load());
    });
    void BankNotifications.isSupported().then(async ({ supported }) => {
      this.notificationsSupported.set(supported);
      if (!supported) return;
      const { apps } = await BankNotifications.apps();
      this.markedApps.set(apps.filter(app => app.watched && !app.hidden).length);
    }).catch(() => this.notificationsSupported.set(false));
  }

  private async load(): Promise<void> {
    const db = this.database.driver;
    this.waiting.set(await new ProposalsRepository(db).pendingCount());
    const row = await db.queryOne<{ active: number; archived: number }>(
      `SELECT SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN archived = 1 THEN 1 ELSE 0 END) AS archived FROM categories`);
    this.categories.set({ active: row?.active ?? 0, archived: row?.archived ?? 0 });
    this.currencies.set((await db.query<{ code: string }>(
      `SELECT c.code FROM currencies c
       ORDER BY c.code = 'COP' DESC, (SELECT COUNT(*) FROM accounts a WHERE a.currency_code = c.code) DESC, c.code`))
      .map(one => one.code));
    this.cards.set(await loadCards(db, isoDay(new Date())));
    const today = isoDay(new Date());
    this.loans.set((await new LoansRepository(db).all()).filter(l => !l.account.archived)
      .map(l => loanSchedule(l.terms, l.payments, today)));
  }

  /** "Debes 742.300 · paga antes del 10 oct", from the cards' own statements. */
  readonly debtsLine = computed(() => {
    const cards = this.cards().filter(card => card.account.currency_code === 'COP');
    const owed = cards.reduce((total, card) => total + card.statement.debtMinor, 0)
      + this.loans().reduce((total, s) => total + s.balanceMinor, 0);
    if (owed === 0) return this.i18n.t('more.debts.none');
    const days = [
      ...cards.map(card => card.statement)
        .filter(s => s.state === 'due' || s.state === 'partial' || s.state === 'overdue').map(s => s.dueOn!),
      ...this.loans().map(s => s.next?.dueOn).filter((d): d is string => !!d),
    ].sort();
    return days.length > 0
      ? this.i18n.t('more.debts.due', { amount: plain(owed), date: shortDate(days[0], this.i18n) })
      : this.i18n.t('more.debts.owed', { amount: plain(owed) });
  });

  readonly debtsLate = computed(() => this.cards().some(card => card.statement.state === 'overdue')
    || this.loans().some(s => s.overdue.length > 0));

  readonly reviewLine = computed(() => {
    const n = this.waiting();
    if (n === 0) return this.i18n.t('more.review.none');
    return n === 1 ? this.i18n.t('more.review.waitingOne') : this.i18n.t('more.review.waiting', { count: n });
  });

  readonly categoriesLine = computed(() => {
    const { active, archived } = this.categories();
    return archived > 0
      ? this.i18n.t('more.categories.count', { count: active, archived })
      : this.i18n.t('more.categories.countNone', { count: active });
  });

  readonly notificationsLine = computed(() => {
    const n = this.markedApps();
    if (n === 0) return this.i18n.t('more.notifications.none');
    return n === 1 ? this.i18n.t('more.notifications.markedOne') : this.i18n.t('more.notifications.marked', { count: n });
  });

  readonly themeLabel = computed(() =>
    this.i18n.t(THEMES.find(t => t.value === this.theme.choice())?.label as 'theme.system'));

  readonly appearanceLine = computed(() => this.i18n.t('more.appearance.value', {
    theme: this.themeLabel(),
    accent: this.i18n.t(this.accent.accent().label as 'accent.zafiro'),
  }));

  /** When the copy in Drive was written, said the way a person says it. */
  readonly driveLine = computed(() => {
    const copy = this.cloud.copy();
    if (!copy) return this.i18n.t('more.drive.never');
    return this.i18n.t('more.drive.signedIn', { when: this.when(copy.modifiedTime) });
  });

  private when(iso: string): string {
    const at = new Date(iso);
    const now = new Date();
    const locale = this.i18n.dateLocale();
    const time = at.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const sameDay = at.toDateString() === now.toDateString();
    if (sameDay) return `${this.i18n.t('ui.today')} ${time}`;
    return `${at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} ${time}`;
  }

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  setLanguage(code: Language): void {
    this.i18n.set(code);
    this.languageSheet.set(false);
  }

  setTheme(choice: ThemeChoice): void {
    this.theme.set(choice);
  }
}
