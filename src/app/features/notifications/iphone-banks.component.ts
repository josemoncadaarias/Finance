/**
 * Notificaciones del teléfono on an iPhone (mockups `60a`-`60g`, option A,
 * Jose 2026-11-26): iOS lets no app read other apps' notifications, so the
 * person makes an automation in Apple's Shortcuts app that hands Finance a
 * bank's SMS or an Apple Pay payment (`FinanceIntents.swift`).
 *
 * The screen says that in one line and three icons, then one card per door
 * with its state - "Funcionando" with the time of the last message once the
 * automation has handed one over (`MessageInbox`, read through
 * `BankNotifications.caught`) - and a guide that shows one step at a time,
 * each with a sketch of what the Shortcuts app shows. The sketches are our
 * own drawings, no Apple artwork.
 */

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';

import { DatabaseService } from '../../core/database/database.service';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { ProposalsRepository } from '../../core/database/repositories/proposals.repository';
import type { AccountRow } from '../../core/database/types';
import { SEVERAL_ACCOUNTS } from '../../core/notices/notice-proposals';
import { PACKAGE, sourcesOf, type Door, type IphoneSource } from '../../core/notices/iphone-sources';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BankNotifications } from '../../core/notifications/bank-notifications';
import { BadgeComponent } from '../../shared/ui/badge.component';


/**
 * The action as the Shortcuts app shows it: its title and its summary with
 * the blanks to fill, exactly as `FinanceIntents.swift` declares them. They
 * are the iPhone's words, Spanish on every phone (the intents' titles are
 * written in Spanish), so they are not the app's translated copy.
 */
const ACTION: Record<Door, { title: string; summary: { text: string; blank?: boolean }[] }> = {
  sms: {
    title: 'Registrar un mensaje del banco en Finance',
    summary: [{ text: 'Registrar ' }, { text: 'Mensaje', blank: true }, { text: ' de ' }, { text: 'Remitente', blank: true }, { text: ' en Finance' }],
  },
  pay: {
    title: 'Registrar un pago con Apple Pay en Finance',
    summary: [{ text: 'Registrar el pago de ' }, { text: 'Valor', blank: true }, { text: ' en ' }, { text: 'Comercio', blank: true },
      { text: ' con ' }, { text: 'Tarjeta', blank: true }, { text: ' en Finance' }],
  },
};

/** The steps of each guide; the last screen ("¡Listo!") comes after them. */
export const STEPS = 4;

@Component({
  selector: 'app-iphone-banks',
  standalone: true,
  imports: [IonIcon, IonModal, IonContent, TranslatePipe, BadgeComponent, AccountPickerComponent],
  templateUrl: './iphone-banks.component.html',
  styleUrls: ['./iphone-banks.component.scss'],
})
export class IphoneBanksComponent implements OnInit {
  private readonly database = inject(DatabaseService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** When each door last handed a message over; 0 when never. */
  readonly last = signal<Record<Door, number>>({ sms: 0, pay: 0 });
  readonly waiting = signal(0);

  /** The guide on show, and its step: 1-4, then 5 for "¡Listo!". */
  readonly guide = signal<Door | null>(null);
  readonly step = signal(1);
  readonly done = computed(() => this.step() > STEPS);
  readonly shown = computed(() => ACTION[this.guide() ?? 'sms']);
  readonly dots = Array.from({ length: STEPS }, (_, i) => i + 1);

  /** Every sender and card handed over, newest first ("Tus bancos"). */
  readonly sources = signal<IphoneSource[]>([]);
  readonly accounts = signal<AccountRow[]>([]);
  /** The source whose account is being chosen. */
  readonly picking = signal<IphoneSource | null>(null);
  readonly several = SEVERAL_ACCOUNTS;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    let caught: { package: string; sender?: string; postedAt: number }[] = [];
    try {
      caught = (await BankNotifications.caught()).caught;
    } catch {
      // Nothing handed over yet: both doors say "Sin configurar".
    }
    const last: Record<Door, number> = { sms: 0, pay: 0 };
    for (const door of ['sms', 'pay'] as Door[]) {
      for (const one of caught) if (one.package === PACKAGE[door]) last[door] = Math.max(last[door], one.postedAt);
    }
    this.last.set(last);
    if (this.database.status() !== 'ready') return;
    const db = this.database.driver;
    const proposals = new ProposalsRepository(db);
    const [waiting, said, answers, accounts] = await Promise.all([
      proposals.pendingCount(), proposals.sourceAccounts(), proposals.noticeAnswers(), new AccountsRepository(db).list()]);
    this.waiting.set(waiting);
    this.accounts.set(accounts);
    this.sources.set(sourcesOf(caught, said, answers, new Set(accounts.map(a => a.id))));
  }

  account(id: number | null): AccountRow | null {
    return id === null ? null : this.accounts().find(a => a.id === id) ?? null;
  }

  /** "3 mensajes · el último hoy 10:42". */
  seen(source: IphoneSource): string {
    return this.i18n.t(source.count === 1 ? 'ui.iphone.bank.seen.one' : 'ui.iphone.bank.seen',
      { count: source.count, when: this.when(source.last) });
  }

  /** "¿De qué cuenta es?" answered: remembered, and its waiting messages take it. */
  async assign(accountId: number): Promise<void> {
    const source = this.picking();
    this.picking.set(null);
    if (!source || this.database.status() !== 'ready') return;
    await new ProposalsRepository(this.database.driver).assignSource(source.key, accountId);
    this.database.dataChanged();
    await this.load();
  }

  /** "Funcionando · último mensaje hoy 10:42", or how long it takes to set up. */
  state(door: Door): string {
    const at = this.last()[door];
    if (at > 0) return this.i18n.t(`ui.iphone.${door}.working` as TranslationKey, { when: this.when(at) });
    return this.i18n.t(`ui.iphone.${door}.none` as TranslationKey);
  }

  working(door: Door): boolean {
    return this.last()[door] > 0;
  }

  /** "hoy 10:42", "ayer 18:05", "12 nov, 9:30". */
  private when(at: number): string {
    const lang = this.i18n.language() === 'en' ? 'en-US' : 'es-CO';
    const d = new Date(at);
    const time = d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
    const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (day(d) === day(today)) return this.i18n.t('ui.iphone.today', { time });
    if (day(d) === day(yesterday)) return this.i18n.t('ui.iphone.yesterday', { time });
    return `${d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })}, ${time}`;
  }

  open(door: Door): void {
    this.step.set(1);
    this.guide.set(door);
  }

  next(): void {
    this.step.update(n => n + 1);
  }

  back(): void {
    if (this.step() > 1 && !this.done()) this.step.update(n => n - 1);
  }

  again(): void {
    this.step.set(1);
  }

  close(): void {
    this.guide.set(null);
  }

  /** The words of the step on show: `ui.iphone.<door>.<step>.title` / `.text`. */
  words(part: 'title' | 'text'): string {
    const door = this.guide() ?? 'sms';
    return this.i18n.t(`ui.iphone.${door}.${this.step()}.${part}` as TranslationKey);
  }

  /** Apple's Shortcuts app, where the automations are made. */
  openShortcuts(): void {
    window.location.href = 'shortcuts://';
  }

  goReview(): void {
    void this.router.navigateByUrl('/review');
  }
}
