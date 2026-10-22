/**
 * The assistant (Jose, 2026-10-19, mockups `39a`-`39n`): register a movement
 * or ask about the money, by text or by voice, with no AI behind it.
 *
 * A sentence is read by `readPhrase`; what it cannot place is asked with a
 * row of answers to tap, and the answer is kept so the next time it is not
 * asked. A movement is a summary to confirm - "Guardar" writes it, never on its
 * own (rule 22), and "Revisar" opens the one movement form filled in. A
 * question is answered with the figures the rest of the app already works out
 * (`AssistantService`): the free money, the caps, the goals, the payments.
 *
 * Every figure said as free is said whole: what stays free for the rest of
 * the month, from today to its last day, and what that is a day.
 */

import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';
import { JumpComponent } from '../../shared/ui/jump.component';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import type { TranslationKey } from '../../core/i18n/translations';
import { DatabaseService } from '../../core/database/database.service';
import { amountsHidden, HIDDEN_AMOUNT } from '../../core/database/money';
import type { AccountRow, CategoryRow } from '../../core/database/types';
import type { YieldProduct } from '../../core/database/repositories/yields.repository';
import { AccountsRepository } from '../../core/database/repositories/accounts.repository';
import { CategoriesRepository } from '../../core/database/repositories/categories.repository';
import { ComposeService } from '../../core/ui/compose.service';
import { ToastService } from '../../shared/ui/toast.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CategorySheetComponent } from '../../shared/category-sheet/category-sheet.component';
import { AccountPickerComponent } from '../../shared/account-picker/account-picker.component';
import { ConfirmComponent } from '../../shared/confirm/confirm.component';
import { AssistantService, type Picture } from '../../core/assistant/assistant.service';
import { fold, readPhrase, type Reading } from '../../core/assistant/read-phrase';
import { nextDayOfMonth, readReminder } from '../../core/assistant/read-reminder';
import { RemindersService } from '../../core/reminders/reminders.service';
import * as A from './answers';
import type { RichButton, RichCard, Speech } from './answers';
import { FilterService } from '../../core/filters/filter.service';
import { afford, perDay, type GoalThisMonth } from '../../core/assistant/free-money';
import { canListen, listen } from '../../core/assistant/speech';
import { isoDay } from '../../core/filters/period';
import type { LimitView } from '../../core/limits/limits.service';
import { PaywallService } from '../../core/paywall/paywall.service';
import { PLAN } from '../../core/paywall/plan';

interface Part { text: string; bold: boolean }
interface Chip { label: string; act: () => void }

/** A spending or an income to confirm (39c, 39l). */
interface RegisterCard {
  kind: 'register';
  side: 'expense' | 'income';
  amountMinor: number;
  category: CategoryRow;
  account: AccountRow;
  product: YieldProduct | null;
  /** How many products the account has; said only when it has several. */
  productCount: number;
  /** The product was named in the sentence, not taken from the habit. */
  productNamed: boolean;
  onDate: string;
  note: string;
  /** Saved here, or only through the form (a habit other than an ordinary movement, another currency). */
  canSave: boolean;
  state: 'open' | 'saved' | 'opened';
  /** The sentence it came from, to learn where it was finally saved. */
  phraseKey?: string | null;
}

/** A transfer to confirm in the form. */
interface TransferCard {
  kind: 'transfer';
  amountMinor: number;
  from: AccountRow | null;
  to: AccountRow;
  /** The products named, when the money moves between products. */
  fromProduct: YieldProduct | null;
  toProduct: YieldProduct | null;
  onDate: string;
  note: string;
  state: 'open' | 'saved' | 'opened';
  phraseKey?: string | null;
}

/** "¿Me alcanza?", "¿cuánto puedo gastar?" (39d, 39e, 39i-39m). */
interface FreeCard {
  kind: 'free';
  tone: 'ok' | 'warn' | 'bad' | 'plain';
  headline: string;
  amountMinor: number | null;
  /** What the thing is called, for "Con los tenis". */
  thing: string | null;
  cap: LimitView | null;
  picture: Picture;
  /** What stays free after it (or now, with no amount). */
  restMinor: number;
  noCategory: boolean;
  /** Asked from one account (39j). */
  account: { row: AccountRow; holdsMinor: number; dues: { name: string; amountMinor: number; dueOn: string }[] } | null;
}

/** "¿Cuánto llevo en X?" (39g). */
interface SpentCard {
  kind: 'spent';
  category: CategoryRow;
  nowMinor: number;
  beforeMinor: number;
  cap: LimitView | null;
}

/** "¿Cómo calculas lo de mis metas?" (39n). */
interface GoalsCard {
  kind: 'goals';
  picture: Picture;
}

/** "Recuérdame pagar el arriendo el 5" (Jose, 2026-10-22): the reminder to confirm. */
interface RemindCard {
  kind: 'remind';
  title: string;
  amountMinor: number | null;
  accountId: number | null;
  categoryId: number | null;
  repeat: 'monthly' | 'once';
  dayOfMonth: number | null;
  onDate: string | null;
  hour: number;
  daysBefore: number;
  state: 'open' | 'saved';
}

type Card = RegisterCard | TransferCard | FreeCard | SpentCard | GoalsCard | RichCard | RemindCard;

interface Message {
  id: number;
  who: 'me' | 'app';
  parts: Part[];
  card?: Card;
  chips?: Chip[];
  /** When it was said, to forget it after a few days. */
  at: number;
}

/**
 * The conversation is kept on the device for this many days unless the
 * person chooses another (Jose, 2026-10-19: "por lo menos unos 3 días";
 * 2026-10-22: configurable, 60 at most).
 */
export const HISTORY_DAYS = 3;
export const HISTORY_DAY_CHOICES = [1, 3, 7, 15, 30, 60] as const;
const HISTORY_KEY = 'finance.assistant.history';
const HISTORY_DAYS_KEY = 'finance.assistant.historyDays';

function storedHistoryDays(): number {
  try {
    const n = Number(localStorage.getItem(HISTORY_DAYS_KEY));
    return Number.isInteger(n) && n >= 1 && n <= 60 ? n : HISTORY_DAYS;
  } catch {
    return HISTORY_DAYS;
  }
}

/** A question the next answer completes. */
type Waiting =
  | { kind: 'account'; reading: Reading; said: string; choices: number[] }
  | { kind: 'category'; reading: Reading; said: string }
  | { kind: 'shape'; reading: Reading; said: string }
  | { kind: 'transferTo'; reading: Reading; said: string }
  | { kind: 'cardRate'; cardId: number; then: 'payFirst' | 'debts' | 'payMore'; extraMinor: number }
  | { kind: 'remindDay'; draft: RemindCard };

/** Words that say what is asked about, never which one. */
const PLAN_WORDS = new Set(['meta', 'metas', 'tope', 'topes', 'presupuesto', 'presupuestos', 'goal', 'goals', 'budget', 'budgets']);

const EXAMPLES: TranslationKey[] = ['ai.example.spend', 'ai.example.income', 'ai.example.move', 'ai.example.afford', 'ai.example.spent', 'ai.example.perDay'];
/** The welcome's three groups (40a): registering, the month, the debts. */
const WELCOME: { title: TranslationKey; rows: { key: TranslationKey; icon: string; cls: string }[] }[] = [
  { title: 'ai.group.register', rows: [
    { key: 'ai.example.spend', icon: 'arrow-up', cls: 'ui-r' },
    { key: 'ai.example.move', icon: 'swap-horizontal', cls: 'ui-p' },
    { key: 'ai.example.remind', icon: 'notifications-outline', cls: 'ui-y' }] },
  { title: 'ai.group.month', rows: [
    { key: 'ai.example.howAmI', icon: 'pulse-outline', cls: 'ui-p' },
    { key: 'ai.example.top', icon: 'pie-chart-outline', cls: 'ui-p' },
    { key: 'ai.example.recurring', icon: 'repeat-outline', cls: 'ui-p' },
    { key: 'ai.example.yields', icon: 'trending-up-outline', cls: 'ui-g' },
    { key: 'ai.example.afford', icon: 'help-circle-outline', cls: 'ui-p' }] },
  { title: 'ai.group.debts', rows: [
    { key: 'ai.example.debts', icon: 'card-outline', cls: 'ui-p' },
    { key: 'ai.example.payFirst', icon: 'flag-outline', cls: 'ui-p' },
    { key: 'ai.example.due', icon: 'calendar-outline', cls: 'ui-p' }] },
];

@Component({
  selector: 'app-assistant',
  templateUrl: './assistant.page.html',
  styleUrls: ['./assistant.page.scss'],
  imports: [NgTemplateOutlet, TranslatePipe, IonContent, IonIcon, IonModal, BadgeComponent, CategorySheetComponent, AccountPickerComponent, ConfirmComponent, JumpComponent],
})
export class AssistantPage {
  private readonly router = inject(Router);
  private readonly database = inject(DatabaseService);
  private readonly assistant = inject(AssistantService);
  private readonly compose = inject(ComposeService);
  private readonly toast = inject(ToastService);
  private readonly filter = inject(FilterService);
  private readonly pro = inject(PaywallService);
  private readonly reminders = inject(RemindersService);
  readonly i18n = inject(I18nService);

  private readonly content = viewChild(IonContent);
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  readonly messages = signal<Message[]>([]);
  readonly typed = signal('');
  readonly busy = signal(false);
  readonly listening = signal(false);
  readonly voice = signal(true);
  readonly examples = EXAMPLES;
  readonly welcomeGroups = WELCOME;
  readonly historyDays = signal(storedHistoryDays());
  readonly dayChoices = HISTORY_DAY_CHOICES;
  readonly choosingDays = signal(false);
  readonly clearing = signal(false);

  /** The category sheet, open for "Otra categoría". */
  readonly categorySheet = signal<'expense' | 'income' | null>(null);
  /** The account list, open for "Otra". */
  readonly accountSheet = signal(false);
  readonly accountsForSheet = signal<AccountRow[]>([]);

  private waiting: Waiting | null = null;
  private nextId = 1;
  private accounts: AccountRow[] = [];
  private categories: CategoryRow[] = [];
  private products: YieldProduct[] = [];

  readonly empty = computed(() => this.messages().length === 0);

  /** The card whose movement is open in the form, and the saves counted before it opened. */
  private inForm: { card: RegisterCard | TransferCard; savesBefore: number } | null = null;

  constructor() {
    void canListen().then(can => this.voice.set(can));
    this.restore();
    // Opened with a question (the "+"'s "Ver todos tus pagos fijos"): asked at once.
    const ask = inject(ActivatedRoute).snapshot.queryParamMap.get('ask');
    if (ask) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      setTimeout(() => void this.send(ask), 300);
    }
    // The form closed: saved there, the card says so; closed without saving,
    // the card offers it again (Jose, 2026-10-19: it could not be reopened).
    effect(() => {
      const open = this.compose.entry() !== null;
      const saves = this.compose.saved();
      untracked(() => {
        if (open || !this.inForm) return;
        const saved = saves > this.inForm.savesBefore;
        this.inForm.card.state = saved ? 'saved' : 'open';
        // Whatever was changed in the form is what this sentence means from now on.
        const route = this.compose.lastSaved();
        if (saved && route && this.inForm.card.phraseKey) void this.assistant.learnPhrase(this.inForm.card.phraseKey, route);
        this.inForm = null;
        this.messages.update(list => [...list]);
      });
    });
    // Every change is kept, without the answers to tap: they belonged to a question of that moment.
    effect(() => {
      const list = this.messages();
      untracked(() => this.keep(list));
    });
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const since = Date.now() - this.historyDays() * 86_400_000;
      const kept = (JSON.parse(raw) as Message[]).filter(m => typeof m.at === 'number' && m.at >= since);
      for (const m of kept) if (m.card && 'state' in m.card && m.card.state === 'opened') m.card.state = 'open';
      this.messages.set(kept);
      this.nextId = kept.reduce((top, m) => Math.max(top, m.id), 0) + 1;
      if (kept.length > 0) this.scroll();
    } catch { /* a history that cannot be read starts afresh */ }
  }

  private keep(list: Message[]): void {
    try {
      const since = Date.now() - this.historyDays() * 86_400_000;
      const plain = list.filter(m => m.at >= since).map(({ chips: _chips, ...rest }) => rest);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(plain));
    } catch { /* the device keeps nothing: the chat still works */ }
  }

  /** How long the conversation stays on the device; older messages go now. */
  keepFor(days: number): void {
    this.historyDays.set(days);
    try { localStorage.setItem(HISTORY_DAYS_KEY, String(days)); } catch { /* the default stays */ }
    this.choosingDays.set(false);
    const since = Date.now() - days * 86_400_000;
    this.messages.update(list => list.filter(m => m.at >= since));
  }

  /** Clears the conversation on screen and on the device, once the person says yes. */
  clear(): void {
    this.clearing.set(false);
    this.waiting = null;
    this.rateAsked = false;
    this.messages.set([]);
  }

  back(): void {
    if (window.history.length > 1) window.history.back();
    else void this.router.navigateByUrl('/');
  }

  // ---------------------------------------------------------------------------
  // Words on screen
  // ---------------------------------------------------------------------------

  /** Whole pesos, "$ 45.000"; hidden with the eye. */
  pesos(minor: number): string {
    if (amountsHidden()) return HIDDEN_AMOUNT;
    const whole = Math.round(Math.abs(minor) / 100);
    return `${minor < 0 ? '−' : ''}$ ${whole.toLocaleString('es-CO')}`;
  }

  /** A day in words: "hoy", "ayer", "16 oct". */
  dayText(iso: string): string {
    const today = isoDay(new Date());
    if (iso === today) return this.i18n.t('ai.day.today');
    const [y, m, d] = iso.split('-').map(Number);
    const yesterday = new Date(y, m - 1, d + 1);
    if (isoDay(yesterday) === today) return this.i18n.t('ai.day.yesterday');
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.language() === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short' });
  }

  /** The month's last day, said: "31 de octubre". */
  monthEndText(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.language() === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long' });
  }

  private parts(text: string): Part[] {
    // "**" marks what is said in bold; a figure never leaves its "$".
    return text.replace(/\$ /g, '$ ').split('**').map((piece, i) => ({ text: piece, bold: i % 2 === 1 })).filter(p => p.text);
  }

  private say(key: TranslationKey, values: Record<string, string | number> = {}, extra: Partial<Message> = {}): void {
    this.messages.update(list => [...list, { id: this.nextId++, who: 'app', at: Date.now(), parts: this.parts(this.i18n.t(key, values)), ...extra }]);
    this.scroll();
  }

  private heard(text: string): void {
    // The last answer's chips go: they belonged to that question.
    this.messages.update(list => [...list.map(m => m.chips ? { ...m, chips: undefined } : m),
      { id: this.nextId++, who: 'me', at: Date.now(), parts: [{ text, bold: false }] }]);
    this.scroll();
  }

  private scroll(): void {
    setTimeout(() => void this.content()?.scrollToBottom(250), 30);
  }

  /** A thing as the person said it, with a capital to start a line. */
  cap1(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  tone(card: FreeCard): string {
    return card.tone;
  }

  // ---------------------------------------------------------------------------
  // Typing and speaking
  // ---------------------------------------------------------------------------

  onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  example(key: TranslationKey): void {
    void this.send(this.i18n.t(key).replace(/[«»“”]/g, ''));
  }

  async send(given?: string): Promise<void> {
    const text = (given ?? this.typed()).trim();
    if (!text || this.busy()) return;
    this.typed.set('');
    this.heard(text);
    this.busy.set(true);
    try {
      await this.answer(text);
    } catch (error) {
      this.say('ai.error', { why: error instanceof Error ? error.message : String(error) });
    } finally {
      this.busy.set(false);
    }
  }

  async speak(): Promise<void> {
    if (!this.voice()) {
      this.toast.say(this.i18n.t('ai.voice.none'), 3500);
      return;
    }
    this.listening.set(true);
    try {
      const said = await listen(this.i18n.language() === 'en' ? 'en-US' : 'es-CO', this.i18n.t('ai.voice.prompt'));
      if (said.trim()) await this.send(said);
    } catch {
      this.toast.say(this.i18n.t('ai.voice.none'), 3500);
    } finally {
      this.listening.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Answering
  // ---------------------------------------------------------------------------

  private async load(): Promise<ReturnType<AssistantService['context']>> {
    const ctx = await this.assistant.context();
    this.accounts = ctx.accountRows;
    this.categories = ctx.categoryRows;
    this.products = ctx.productRows;
    return ctx;
  }

  private async answer(text: string): Promise<void> {
    const ctx = await this.load();
    // The card's rate asked for (40g): "2,1 % mensual" answers it.
    const w = this.waiting;
    if (w?.kind === 'cardRate') {
      const r = A.rateSaid(text);
      if (r) {
        this.waiting = null;
        await this.assistant.setCardRate(w.cardId, r.eaScaled, r.quoted);
        const name = this.accounts.find(a => a.id === w.cardId)?.name ?? '';
        this.say(r.quoted === 'mv' ? 'ai.rate.savedMonthly' : 'ai.rate.saved', { rate: A.rateText(r.eaScaled), card: name });
        return this.debtsAnswer(w.then, w.extraMinor, true);
      }
    }
    // The day a reminder was asked for: "mañana", "el 5 de cada mes".
    if (w?.kind === 'remindDay') {
      const said = readReminder(text, isoDay(new Date()));
      if (said.dayOfMonth || said.onDate) {
        this.waiting = null;
        return this.remindWhen({ ...w.draft, hour: said.hour ?? w.draft.hour, daysBefore: said.daysBefore ?? w.draft.daysBefore }, said);
      }
    }
    const reading = readPhrase(text, ctx);
    this.waiting = null;
    // Registering is free; a question counts against the month's free ones.
    const question = !['register', 'unsure', 'unknown', 'remind', 'reminders'].includes(reading.intent);
    if (question && !(await this.pro.askQuestion())) {
      return this.say('ai.pro.out', { free: PLAN.assistant.free });
    }
    switch (reading.intent) {
      case 'register': return this.register(reading, text);
      case 'afford': return this.affordIt(reading, text);
      case 'perDay': return this.howMuchADay();
      case 'spentIn': return this.spent(reading, text);
      case 'howGoals': return this.howGoals();
      case 'howAmI': return this.howAmI(reading);
      case 'topSpending': return this.topSpending(reading);
      case 'debts': return this.debtsAnswer('debts', 0);
      case 'payFirst': return this.debtsAnswer('payFirst', 0);
      case 'payMore': return this.debtsAnswer('payMore', reading.amountMinor ?? 0);
      case 'due': return this.dueAnswer();
      case 'have': return this.haveAnswer(reading);
      case 'plans': return void await this.plansAnswer(text);
      case 'remind': return this.remind(reading, text);
      case 'reminders': return this.remindersList();
      case 'recurring': return this.give(A.recurring(this.speech(), await this.assistant.recurring()));
      case 'yields': return this.give(A.yieldsAnswer(this.speech(), await this.assistant.yieldsPicture(reading.period, reading.accountId)));
      case 'whyMore': return this.give(A.whyMore(this.speech(), await this.assistant.periodPicture(reading.period)));
      case 'unsure': return this.askShape(reading, text);
      default:
        // "¿Cuánto me falta para el fondo de emergencia?": a goal or a cap by its name alone.
        if (await this.plansAnswer(text, true)) return;
        this.say('ai.unknown', {}, { chips: this.examples.slice(0, 4).map(key => ({ label: this.i18n.t(key).replace(/[«»“”]/g, ''), act: () => this.example(key) })) });
    }
  }

  // "200 mil en mercado": registering, or asking? (39f)
  private askShape(reading: Reading, said: string): void {
    this.waiting = { kind: 'shape', reading, said };
    const income = reading.side === 'income';
    this.say(income ? 'ai.shape.askIncome' : 'ai.shape.ask', {}, {
      chips: [
        { label: this.i18n.t(income ? 'ai.shape.registerIncome' : 'ai.shape.register'), act: () => void this.shapeIs('register') },
        { label: this.i18n.t('ai.shape.afford'), act: () => void this.shapeIs('afford') },
      ],
    });
  }

  private async shapeIs(meant: 'register' | 'afford'): Promise<void> {
    const w = this.waiting;
    if (w?.kind !== 'shape') return;
    this.heard(this.i18n.t(meant === 'register' ? (w.reading.side === 'income' ? 'ai.shape.registerIncome' : 'ai.shape.register') : 'ai.shape.afford'));
    if (w.reading.shape) await this.assistant.learnShape(w.reading.shape, meant);
    this.say(meant === 'register' ? 'ai.shape.learnedRegister' : 'ai.shape.learnedAfford');
    const reading: Reading = { ...w.reading, intent: meant, side: meant === 'afford' ? 'expense' : (w.reading.side ?? 'expense') };
    this.waiting = null;
    if (meant === 'register') await this.register(reading, w.said);
    else await this.affordIt(reading, w.said);
  }

  // ---- Registering ----------------------------------------------------------

  private async register(reading: Reading, said: string): Promise<void> {
    if (reading.amountMinor === null) return this.say('ai.register.noAmount');
    if (reading.side === 'transfer') return this.transfer(reading, said);

    const side = reading.side === 'income' ? 'income' : 'expense';
    if (reading.categoryId === null) return this.askCategory({ ...reading, side }, said);
    if (reading.accountId === null) return this.askAccount({ ...reading, side }, said, reading.accountChoices);

    const account = this.accounts.find(a => a.id === reading.accountId)!;
    const category = this.categories.find(c => c.id === reading.categoryId)!;
    const usual = await this.assistant.usual(account.id, side, category.id);
    const product = reading.productId !== null && usual.products.some(p => p.id === reading.productId)
      ? usual.products.find(p => p.id === reading.productId)!
      : usual.products.find(p => p.id === usual.productId) ?? null;
    const card: RegisterCard = {
      kind: 'register', side, amountMinor: reading.amountMinor, category, account, product,
      productCount: usual.products.length, productNamed: reading.productId !== null && product?.id === reading.productId, onDate: reading.onDate, note: reading.thing ?? '',
      canSave: account.currency_code === 'COP' && usual.ordinary, state: 'open', phraseKey: reading.phraseKey,
    };
    // "en mercado" named the category; it is no note of its own.
    if (reading.categoryFrom === 'name') card.note = '';
    else card.note = card.note.charAt(0).toUpperCase() + card.note.slice(1);
    if (reading.amountGuessed) this.say('ai.amount.guessed', { said: reading.amountText ?? '', amount: this.pesos(reading.amountMinor) });
    if (reading.fromMemory) this.say('ai.remembered');
    else if (reading.productId !== null && product) {
      this.say('ai.register.fromProduct', { product: product.name, account: account.name });
    }
    this.say(side === 'income' ? 'ai.register.understoodIncome' : 'ai.register.understood', {}, { card });
  }

  private transfer(reading: Reading, said = ''): void {
    const to = reading.toAccountId !== null ? this.accounts.find(a => a.id === reading.toAccountId) ?? null : null;
    if (!to) return void this.askTransferTo(reading, said);
    const from = reading.accountId !== null ? this.accounts.find(a => a.id === reading.accountId) ?? null : null;
    if (reading.fromMemory) this.say('ai.remembered');
    const product = (id: number | null) => id === null ? null : this.products.find(p => p.id === id) ?? null;
    let fromProduct = product(reading.fromProductId);
    let toProduct = product(reading.toProductId);
    // Between products of one account with one end said: the other is the
    // account's usual product, or else another of its products.
    if (from && from.id === to.id && (fromProduct === null) !== (toProduct === null)) {
      const named = (fromProduct ?? toProduct)!;
      const others = this.products.filter(p => p.account_id === to.id && p.id !== named.id);
      const other = others.find(p => p.source === 'ledger') ?? others[0] ?? null;
      if (fromProduct === null) fromProduct = other; else toProduct = other;
    }
    this.say(from && from.id === to.id ? 'ai.transfer.understoodProducts' : 'ai.transfer.understood', { account: to.name }, {
      card: {
        kind: 'transfer', amountMinor: reading.amountMinor!, from, to, fromProduct, toProduct,
        onDate: reading.onDate, note: reading.thing ?? '', state: 'open', phraseKey: reading.phraseKey,
      },
    });
  }

  /**
   * Where the money went was not understood: never a dead end. The accounts
   * it most likely went to, any other, or "it was a spending" (money given to
   * somebody is no transfer between one's own accounts).
   */
  private async askTransferTo(reading: Reading, said: string): Promise<void> {
    this.waiting = { kind: 'transferTo', reading, said };
    const used = await new AccountsRepository(this.database.driver).timesUsed();
    const offer = [...this.accounts].filter(a => a.id !== reading.accountId && a.type !== 'investment')
      .sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0)).slice(0, 3);
    const chips: Chip[] = offer.map(a => ({ label: a.name, act: () => void this.transferToIs(a) }));
    chips.push({ label: this.i18n.t('ai.account.other'), act: () => { this.accountsForSheet.set(this.accounts); this.accountSheet.set(true); } });
    chips.push({ label: this.i18n.t('ai.transfer.wasSpending'), act: () => void this.wasSpending() });
    this.say('ai.transfer.askTo', {}, { chips });
  }

  private async transferToIs(account: AccountRow): Promise<void> {
    const w = this.waiting;
    if (w?.kind !== 'transferTo') return;
    this.waiting = null;
    this.heard(account.name);
    this.transfer({ ...w.reading, toAccountId: account.id }, w.said);
  }

  private async wasSpending(): Promise<void> {
    const w = this.waiting;
    if (w?.kind !== 'transferTo') return;
    this.waiting = null;
    this.heard(this.i18n.t('ai.transfer.wasSpending'));
    await this.register({ ...w.reading, side: 'expense', toAccountId: null, fromProductId: null, toProductId: null,
      productId: w.reading.fromProductId }, w.said);
  }

  /** Where a transfer's money leaves and lands, product first: "Bolsillo Principal → Cuenta de ahorros". */
  transferEnds(card: TransferCard): string {
    const from = card.fromProduct?.name ?? card.from?.name ?? this.i18n.t('ai.transfer.fromUsual');
    const to = card.toProduct?.name ?? card.to.name;
    const same = card.from !== null && card.from.id === card.to.id;
    const fromWord = same && !card.fromProduct ? this.i18n.t('ai.transfer.fromUsualProduct') : from;
    return `${fromWord} → ${to}`;
  }

  /** The account both ends are in, said apart, for a move between products. */
  transferAccount(card: TransferCard): string | null {
    return card.from !== null && card.from.id === card.to.id ? card.to.name : null;
  }

  private async topCategories(kind: 'expense' | 'income', count: number): Promise<CategoryRow[]> {
    const used = await new CategoriesRepository(this.database.driver).listByUse({ kind, since: `${new Date().getFullYear() - 1}-01-01` });
    return used.slice(0, count);
  }

  private async askCategory(reading: Reading, said: string): Promise<void> {
    this.waiting = { kind: 'category', reading, said };
    const kind = reading.side === 'income' ? 'income' : 'expense';
    const top = await this.topCategories(kind, 3);
    const chips: Chip[] = top.map(c => ({ label: c.name, act: () => void this.categoryIs(c) }));
    chips.push({ label: this.i18n.t('ai.category.other'), act: () => this.categorySheet.set(kind) });
    if (reading.thing) this.say('ai.category.askWord', { word: reading.thing }, { chips });
    else this.say('ai.category.ask', {}, { chips });
  }

  pickedCategory(id: number): void {
    this.categorySheet.set(null);
    const category = this.categories.find(c => c.id === id);
    if (category) void this.categoryIs(category);
  }

  private async categoryIs(category: CategoryRow): Promise<void> {
    const w = this.waiting;
    if (w?.kind !== 'category') return;
    this.waiting = null;
    this.heard(category.name);
    if (w.reading.thing) {
      await this.assistant.learnWord(w.reading.thing, category.id);
      this.say('ai.category.learned', { word: w.reading.thing, category: category.name });
    }
    const reading = { ...w.reading, categoryId: category.id };
    if (reading.intent === 'afford') await this.affordIt(reading, w.said);
    else if (reading.intent === 'spentIn') await this.spent(reading, w.said);
    else await this.register(reading, w.said);
  }

  private async askAccount(reading: Reading, said: string, choices: number[]): Promise<void> {
    this.waiting = { kind: 'account', reading, said, choices };
    let offer: AccountRow[];
    if (choices.length > 0) {
      offer = this.accounts.filter(a => choices.includes(a.id));
    } else {
      const used = await new AccountsRepository(this.database.driver).timesUsed();
      offer = [...this.accounts].filter(a => a.type !== 'investment')
        .sort((a, b) => (used.get(b.id) ?? 0) - (used.get(a.id) ?? 0)).slice(0, 3);
    }
    const chips: Chip[] = offer.map(a => ({ label: a.name, act: () => void this.accountIs(a) }));
    chips.push({ label: this.i18n.t('ai.account.other'), act: () => { this.accountsForSheet.set(this.accounts); this.accountSheet.set(true); } });
    this.say(reading.side === 'income' ? 'ai.account.askIncome' : 'ai.account.ask', {}, { chips });
  }

  pickedAccount(account: AccountRow): void {
    this.accountSheet.set(false);
    if (this.waiting?.kind === 'transferTo') void this.transferToIs(account);
    else void this.accountIs(account);
  }

  private async accountIs(account: AccountRow): Promise<void> {
    const w = this.waiting;
    if (w?.kind !== 'account') return;
    this.waiting = null;
    this.heard(account.name);
    // "con la rappi" between two Rappi accounts: the word means this one from now on.
    if (w.choices.length > 1) {
      const word = this.sharedWord(w.said, w.choices);
      if (word) {
        await this.assistant.learnAccountWord(word, account.id);
        this.say('ai.account.learned', { word, account: account.name });
      }
    }
    await this.register({ ...w.reading, accountId: account.id, accountChoices: [] }, w.said);
  }

  /** The word of the sentence the accounts asked about all carry. */
  private sharedWord(said: string, ids: number[]): string | null {
    const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const names = this.accounts.filter(a => ids.includes(a.id)).map(a => fold(a.name).split(/[^a-z0-9ñ]+/));
    const word = fold(said).split(/[^a-z0-9ñ]+/).find(w => w.length >= 3 && names.every(n => n.includes(w)));
    return word ?? null;
  }

  async save(card: RegisterCard): Promise<void> {
    if (card.state !== 'open' || this.busy()) return;
    this.busy.set(true);
    try {
      await this.assistant.register({
        side: card.side, accountId: card.account.id, productId: card.product?.id ?? null,
        categoryId: card.category.id, amountMinor: card.amountMinor, onDate: card.onDate, note: card.note,
      });
      card.state = 'saved';
      if (card.phraseKey) {
        await this.assistant.learnPhrase(card.phraseKey, {
          side: card.side, accountId: card.account.id, productId: card.product?.id ?? null,
          toAccountId: null, toProductId: null, categoryId: card.category.id,
        });
      }
      this.messages.update(list => [...list]);
      this.compose.saved.update(n => n + 1);
      this.toast.say(this.i18n.t('ai.register.saved'), 2500);
    } catch (error) {
      this.say('ai.error', { why: error instanceof Error ? error.message : String(error) });
    } finally {
      this.busy.set(false);
    }
  }

  /** The one movement form, filled in with what was understood. */
  review(card: RegisterCard | TransferCard): void {
    if (card.kind === 'register') {
      this.compose.open(card.side, {
        preferredAccountId: card.account.id,
        start: { amountMinor: card.amountMinor, onDate: card.onDate, note: card.note, categoryId: card.category.id, productId: card.product?.id ?? null },
      });
    } else {
      this.compose.open('transfer', {
        ...(card.from
          ? { route: { from: card.from.id, to: card.to.id, fromProductId: card.fromProduct?.id ?? null, toProductId: card.toProduct?.id ?? null } }
          : { preferredAccountId: card.to.id, preferredSide: 'to' as const }),
        start: { amountMinor: card.amountMinor, onDate: card.onDate, note: card.note },
      });
    }
    this.inForm = { card, savesBefore: this.compose.saved() };
    card.state = 'opened';
    this.messages.update(list => [...list]);
  }

  // ---- "¿Me alcanza?" -------------------------------------------------------

  private async affordIt(reading: Reading, said: string): Promise<void> {
    if (reading.amountMinor === null) return this.howMuchADay();
    // A word nobody taught yet is asked once (39e); with no word, the whole picture (39i).
    if (reading.categoryId === null && reading.thing && reading.accountId === null) {
      return this.askCategory({ ...reading, intent: 'afford' }, said);
    }
    if (reading.amountGuessed) this.say('ai.amount.guessed', { said: reading.amountText ?? '', amount: this.pesos(reading.amountMinor) });
    const picture = await this.assistant.picture();
    const free = picture.free.freeMinor;
    const amount = reading.amountMinor;

    // From one account (39j): what it holds and what is due from it.
    if (reading.accountId !== null) {
      const row = this.accounts.find(a => a.id === reading.accountId)!;
      const holds = picture.accounts.find(a => a.account.id === row.id)?.holdsMinor ?? 0;
      const dues = picture.free.payments.filter(p => p.fromAccountId === row.id)
        .map(p => ({ name: p.name, amountMinor: p.amountMinor, dueOn: p.dueOn }));
      const after = holds - amount;
      const dueMinor = dues.reduce((s, d) => s + d.amountMinor, 0);
      const tone: FreeCard['tone'] = after < 0 ? 'bad' : after < dueMinor ? 'warn' : 'ok';
      const key: TranslationKey = after < 0 ? 'ai.account.no' : after < dueMinor ? 'ai.account.yesBut' : 'ai.account.yes';
      this.say(key, { account: row.name, holds: this.pesos(holds), after: this.pesos(after), due: dues[0]?.name ?? '', dueOn: dues[0] ? this.monthEndText(dues[0].dueOn) : '' }, {
        card: { kind: 'free', tone, headline: '', amountMinor: amount, thing: reading.thing, cap: null, picture, restMinor: free - amount, noCategory: false,
          account: { row, holdsMinor: holds, dues } },
      });
      return;
    }

    const cap = this.assistant.capOf(reading.categoryId);
    const verdict = afford(free, amount, cap ? { remainingMinor: cap.status.remainingMinor } : null);
    const days = picture.free.daysLeft;
    const rest = verdict.afterMinor;
    const values = {
      amount: this.pesos(amount), rest: this.pesos(rest), day: this.pesos(perDay(rest, days)),
      over: this.pesos(verdict.capOverMinor), short: this.pesos(verdict.shortMinor),
      cap: cap?.name ?? '', capLeft: cap ? this.pesos(cap.status.remainingMinor) : '',
      interest: this.pesos(picture.interest.reduce((s, i) => s + i.minor, 0)),
    };
    const card: FreeCard = {
      kind: 'free', amountMinor: amount, thing: reading.thing, cap, picture, restMinor: rest,
      noCategory: reading.categoryId === null, account: null,
      tone: verdict.verdict === 'yes' ? 'ok' : verdict.verdict === 'yesButCap' ? 'warn' : 'bad',
      headline: verdict.verdict === 'yes' ? this.i18n.t('ai.verdict.yes')
        : verdict.verdict === 'yesButCap' ? this.i18n.t('ai.verdict.yesButCap')
        : this.i18n.t('ai.verdict.no', { short: values.short }),
    };
    let key: TranslationKey;
    if (verdict.verdict === 'no') key = picture.interest.length > 0 ? 'ai.afford.noInterest' : 'ai.afford.no';
    else if (verdict.verdict === 'yesButCap') key = 'ai.afford.yesButCap';
    else key = reading.categoryId === null ? 'ai.afford.yesNoCategory' : 'ai.afford.yes';
    let chips: Chip[] | undefined;
    if (reading.categoryId === null && verdict.verdict !== 'no') {
      const top = await this.topCategories('expense', 2);
      this.waiting = { kind: 'category', reading: { ...reading, intent: 'afford' }, said };
      chips = [...top.map(c => ({ label: this.i18n.t('ai.category.isIt', { category: c.name }), act: () => void this.categoryIs(c) })),
        { label: this.i18n.t('ai.category.other'), act: () => this.categorySheet.set('expense') }];
    }
    this.say(key, values, { card, chips });
  }

  private async howMuchADay(): Promise<void> {
    const picture = await this.assistant.picture();
    const f = picture.free;
    const day = perDay(f.freeMinor, f.daysLeft);
    this.say(f.freeMinor > 0 ? 'ai.perDay.answer' : 'ai.perDay.none', {
      end: this.monthEndText(f.monthEnd), rest: this.pesos(f.freeMinor), day: this.pesos(day), count: f.daysLeft,
    }, {
      card: { kind: 'free', tone: f.freeMinor > 0 ? 'plain' : 'bad', headline: '', amountMinor: null, thing: null, cap: null,
        picture, restMinor: f.freeMinor, noCategory: false, account: null },
    });
  }

  // ---- "¿Cuánto llevo?" -----------------------------------------------------

  private async spent(reading: Reading, said: string): Promise<void> {
    if (reading.categoryId === null) {
      this.waiting = { kind: 'category', reading: { ...reading, intent: 'spentIn' }, said };
      const top = await this.topCategories('expense', 3);
      return this.say('ai.spent.ask', {}, {
        chips: [...top.map(c => ({ label: c.name, act: () => void this.categoryIs(c) })),
          { label: this.i18n.t('ai.category.other'), act: () => this.categorySheet.set('expense') }],
      });
    }
    const category = this.categories.find(c => c.id === reading.categoryId)!;
    const s = await this.assistant.spentIn(category);
    const diff = s.nowMinor - s.beforeMinor;
    const key: TranslationKey = diff > 0 ? 'ai.spent.more' : diff < 0 ? 'ai.spent.less' : 'ai.spent.same';
    this.say(key, { amount: this.pesos(s.nowMinor), category: category.name, diff: this.pesos(Math.abs(diff)) }, {
      card: { kind: 'spent', category, nowMinor: s.nowMinor, beforeMinor: s.beforeMinor, cap: s.cap },
      chips: [{ label: this.i18n.t('ai.spent.seeMovements'), act: () => void this.router.navigate(['/movements']) }],
    });
  }

  // ---- The goals ------------------------------------------------------------

  private async howGoals(): Promise<void> {
    const picture = await this.assistant.picture();
    if (picture.free.goals.length === 0) return this.say('ai.goals.none');
    this.say('ai.goals.answer', {}, {
      card: { kind: 'goals', picture },
      chips: [{ label: this.i18n.t('ai.goals.see'), act: () => void this.router.navigate(['/plans'], { queryParams: { face: 'goals' } }) }],
    });
  }

  explainGoals(): void {
    this.heard(this.i18n.t('ai.goals.how'));
    void this.howGoals();
  }

  /** What a goal's line says about its figure (39n). */
  goalHow(g: GoalThisMonth): string {
    switch (g.how) {
      case 'dated':
        return this.i18n.t('ai.goals.dated', { lacks: this.pesos(g.lacksMinor), count: g.monthsLeft, aim: this.pesos(g.aimMinor) });
      case 'average':
        return this.i18n.t('ai.goals.average', { aim: this.pesos(g.aimMinor) });
      case 'noHistory':
        return this.i18n.t('ai.goals.noHistory');
      default:
        return this.i18n.t('ai.goals.reached');
    }
  }

  goalAlready(g: GoalThisMonth): string {
    if (g.how === 'reached' || g.how === 'noHistory') return '';
    return g.alreadyMinor > 0 ? this.i18n.t('ai.goals.already', { amount: this.pesos(g.alreadyMinor) }) : this.i18n.t('ai.goals.notYet');
  }

  perDayOf(card: FreeCard): number {
    return perDay(card.restMinor, card.picture.free.daysLeft);
  }

  interestTotal(card: FreeCard): number {
    return card.picture.interest.reduce((s, i) => s + i.minor, 0);
  }

  cashInterest(card: FreeCard): void {
    const top = card.picture.interest[0];
    if (top) void this.router.navigate(['/products'], { queryParams: { account: top.account.id } });
  }

  // ---- The whole picture (40b-40j) -------------------------------------------

  private speech(): Speech {
    const locale = this.i18n.language() === 'en' ? 'en-US' : 'es-CO';
    return {
      t: (key, values) => this.i18n.t(key, values),
      pesos: minor => this.pesos(minor),
      date: iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'long' }); },
      month: ym => { const [y, m] = ym.split('-').map(Number); return y ? new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : ''; },
      today: isoDay(new Date()),
    };
  }

  private give(answer: A.Answer): void {
    const chips = answer.next.map(key => {
      const label = this.i18n.t(key);
      return { label, act: () => void this.send(label) };
    });
    const extra = { ...(answer.card ? { card: answer.card } : {}), chips };
    if (answer.said.text) {
      this.messages.update(list => [...list, { id: this.nextId++, who: 'app', at: Date.now(), parts: this.parts(answer.said.text!), ...extra }]);
      this.scroll();
    } else {
      this.say(answer.said.key, answer.said.values, extra);
    }
  }

  private async howAmI(reading: Reading): Promise<void> {
    const pic = await this.assistant.periodPicture(reading.period);
    const picture = pic.partial ? await this.assistant.picture() : null;
    this.give(A.howAmI(this.speech(), pic, picture, this.assistant.plans().limits));
  }

  private async topSpending(reading: Reading): Promise<void> {
    this.give(A.topSpending(this.speech(), await this.assistant.periodPicture(reading.period)));
  }

  /** The debts' three answers; a card with no rate of its own is asked for it once first (40g). */
  private async debtsAnswer(then: 'debts' | 'payFirst' | 'payMore', extraMinor: number, asked = false): Promise<void> {
    const { debts } = await this.assistant.debts();
    if (then !== 'debts' && !asked) {
      // Asked once a conversation: the card owing most of those without a rate.
      const unknown = this.rateAsked ? undefined : debts.filter(d => d.kind === 'card' && d.rateFrom === 'reference')
        .sort((a, b) => b.balanceMinor - a.balanceMinor)[0];
      if (unknown) {
        this.rateAsked = true;
        this.waiting = { kind: 'cardRate', cardId: unknown.id, then, extraMinor };
        this.say('ai.rate.ask', { card: unknown.name, owed: this.pesos(unknown.balanceMinor) }, {
          chips: [
            { label: this.i18n.t('ai.rate.useReference'), act: () => { this.heard(this.i18n.t('ai.rate.useReference')); this.waiting = null; void this.debtsAnswer(then, extraMinor, true); } },
            { label: this.i18n.t('ai.rate.write'), act: () => { this.heard(this.i18n.t('ai.rate.write')); this.say('ai.rate.howToWrite'); } },
          ],
        });
        return;
      }
    }
    const s = this.speech();
    if (then === 'debts') return this.give(A.debts(s, debts));
    const leftOver = await this.assistant.leftOverPerMonth();
    if (then === 'payFirst') {
      const picture = await this.assistant.picture();
      return this.give(A.payFirst(s, debts, picture.free.freeMinor, leftOver));
    }
    this.give(A.payMoreAnswer(s, debts, extraMinor, leftOver));
  }

  /** A card's rate is asked once a conversation; after that the reference is used. */
  private rateAsked = false;

  private async dueIn(): Promise<{ list: A.DueIn[]; monthEnd: string }> {
    const picture = await this.assistant.picture();
    const list = picture.free.payments.map(p => {
      const account = this.accounts.find(a => a.id === p.id) ?? null;
      return { name: p.name, kind: p.kind, id: p.id, amountMinor: p.amountMinor, dueOn: p.dueOn,
        from: p.fromAccountId !== null ? this.accounts.find(a => a.id === p.fromAccountId) ?? null : null,
        icon: account?.builtin_icon ?? null, color: account?.color ?? null };
    });
    return { list, monthEnd: picture.free.monthEnd };
  }

  private async dueAnswer(): Promise<void> {
    const { list, monthEnd } = await this.dueIn();
    const h = await this.assistant.holdings();
    this.give(A.due(this.speech(), list, new Map(h.balances.map(b => [b.account.id, b.minor])), monthEnd));
  }

  private async haveAnswer(reading: Reading): Promise<void> {
    const h = await this.assistant.holdings();
    if (reading.accountId !== null) {
      const at = h.balances.find(b => b.account.id === reading.accountId);
      if (at) {
        const { list } = await this.dueIn();
        return this.give(A.accountHas(this.speech(), at.account, at.minor, list));
      }
    }
    this.give(A.have(this.speech(), h));
  }

  /** With `onlyNamed`, answers only when one goal or cap is named, and says whether it did. */
  private async plansAnswer(text = '', onlyNamed = false): Promise<boolean> {
    await this.assistant.loadGoals();
    const p = this.assistant.plans();
    // One cap or one goal named: "¿cómo va la meta del viaje?", "el tope de Mercado".
    const said = fold(text);
    // Named by any word of its own (4 letters or more): "la meta de inversión"
    // is "Inversión en bolsa de valores". The one carrying most of the words wins.
    const saidWords = new Set(said.split(/[^a-z0-9ñ]+/));
    const named = <T>(list: readonly T[], nameOf: (x: T) => string) => {
      const scored = list.map(x => ({ x, n: fold(nameOf(x)).split(/[^a-z0-9ñ]+/)
        .filter(w => w.length >= 4 && !PLAN_WORDS.has(w) && saidWords.has(w)).length }))
        .filter(o => o.n > 0).sort((a, b) => b.n - a.n);
      return scored.length === 0 ? [] : scored.filter(o => o.n === scored[0].n).map(o => o.x);
    };
    const goals = named(p.goals, g => g.terms.name);
    const caps = named(p.limits, l => l.name);
    const goalAsked = /\bmetas?\b|\bgoals?\b/.test(said);
    const capAsked = /\btopes?\b|\bpresupuestos?\b|\bcaps?\b|\bbudgets?\b/.test(said);
    if (goals.length === 1 && (goalAsked || caps.length === 0)) { this.give(A.oneGoal(this.speech(), goals[0])); return true; }
    if (caps.length === 1 && (capAsked || goals.length === 0)) { this.give(A.oneCap(this.speech(), caps[0])); return true; }
    if (onlyNamed) return false;
    // Asked only about goals, or only about caps: only those.
    if (goalAsked && !capAsked && p.goals.length > 0) this.give(A.plans(this.speech(), [], p.goals));
    else if (capAsked && !goalAsked && p.limits.length > 0) this.give(A.plans(this.speech(), p.limits, []));
    else this.give(A.plans(this.speech(), p.limits, p.goals));
    return true;
  }

  // ---- Reminders (Jose, 2026-10-22) ----------------------------------------------

  /** "Recuérdame pagar el arriendo el 5": what, when, and what fills the form. */
  private remind(reading: Reading, text: string): void {
    const said = readReminder(text, isoDay(new Date()));
    const draft: RemindCard = {
      kind: 'remind', title: said.title || reading.thing || this.i18n.t('ai.remind.untitled'),
      // A bare number is the day or the hour, never an amount: only one said as money counts.
      amountMinor: reading.amountMinor !== null && !reading.amountGuessed ? reading.amountMinor : null,
      accountId: reading.accountId, categoryId: reading.categoryId,
      repeat: said.repeat ?? 'monthly', dayOfMonth: said.dayOfMonth, onDate: said.onDate,
      hour: said.hour ?? 8, daysBefore: said.daysBefore ?? 0, state: 'open',
    };
    if (!said.dayOfMonth && !said.onDate) {
      this.waiting = { kind: 'remindDay', draft };
      this.say('ai.remind.askDay', { title: draft.title }, { chips: [
        { label: this.i18n.t('ai.remind.chip.tomorrow'), act: () => void this.send(this.i18n.t('ai.remind.chip.tomorrow')) },
        { label: this.i18n.t('ai.remind.chip.first'), act: () => void this.send(this.i18n.t('ai.remind.chip.first')) },
        { label: this.i18n.t('ai.remind.chip.fifteenth'), act: () => void this.send(this.i18n.t('ai.remind.chip.fifteenth')) },
      ] });
      return;
    }
    this.remindWhen(draft, said);
  }

  /** The day is known; "el 5" alone asks whether it is every month or this once. */
  private remindWhen(draft: RemindCard, said: { repeat: 'monthly' | 'once' | null; dayOfMonth: number | null; onDate: string | null }): void {
    const today = isoDay(new Date());
    if (said.repeat === null && said.dayOfMonth) {
      const day = said.dayOfMonth;
      const once = nextDayOfMonth(today, day);
      this.say('ai.remind.askRepeat', { day }, { chips: [
        { label: this.i18n.t('ai.remind.chip.monthly', { day }), act: () => { this.heard(this.i18n.t('ai.remind.chip.monthly', { day })); this.showRemind({ ...draft, repeat: 'monthly', dayOfMonth: day, onDate: null }); } },
        { label: this.i18n.t('ai.remind.chip.once', { date: this.longDate(once) }), act: () => { this.heard(this.i18n.t('ai.remind.chip.once', { date: this.longDate(once) })); this.showRemind({ ...draft, repeat: 'once', dayOfMonth: null, onDate: once }); } },
      ] });
      return;
    }
    const repeat = said.repeat ?? (said.onDate ? 'once' : 'monthly');
    this.showRemind({ ...draft, repeat, dayOfMonth: repeat === 'monthly' ? said.dayOfMonth ?? Number((said.onDate ?? today).slice(8, 10)) : null,
      onDate: repeat === 'once' ? said.onDate ?? nextDayOfMonth(today, said.dayOfMonth ?? 1) : null });
  }

  private showRemind(card: RemindCard): void {
    this.say('ai.remind.understood', {}, { card });
  }

  async saveRemind(card: RemindCard): Promise<void> {
    if (card.state !== 'open' || this.busy()) return;
    this.busy.set(true);
    try {
      await this.reminders.create({
        title: card.title, amountMinor: card.amountMinor, accountId: card.accountId, categoryId: card.categoryId, note: card.title,
        repeat: card.repeat, dayOfMonth: card.dayOfMonth, onDate: card.onDate, hour: card.hour, daysBefore: card.daysBefore, shop: null,
      });
      card.state = 'saved';
      this.messages.update(list => [...list]);
    } catch (error) {
      this.say('ai.error', { why: error instanceof Error ? error.message : String(error) });
    } finally {
      this.busy.set(false);
    }
  }

  /** "El 5 de cada mes" or "El 25 de octubre", and when the phone tells. */
  remindWhenText(card: RemindCard): string {
    const when = card.repeat === 'monthly'
      ? this.i18n.t('reminders.monthly', { day: card.dayOfMonth ?? 1 })
      : this.i18n.t('reminders.once', { date: this.longDate(card.onDate ?? isoDay(new Date())) });
    const hour = new Date(2026, 0, 1, card.hour).toLocaleTimeString(this.i18n.dateLocale(), { hour: 'numeric', minute: '2-digit' });
    const ring = card.daysBefore === 0 ? this.i18n.t('reminders.rings.same', { hour })
      : this.i18n.t(card.daysBefore === 1 ? 'reminders.rings.before.one' : 'reminders.rings.before', { count: card.daysBefore, hour });
    return `${when}. ${ring}${ring.endsWith(".") ? "" : "."}`;
  }

  goReminders(): void {
    void this.router.navigate(['/reminders']);
  }

  private longDate(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.i18n.dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /** "¿Qué recordatorios tengo?" */
  private remindersList(): void {
    const list = [...this.reminders.occurrences()].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    if (list.length === 0) {
      this.say('ai.reminders.none', {}, { chips: [{ label: this.i18n.t('ai.remind.example'), act: () => void this.send(this.i18n.t('ai.remind.example')) }] });
      return;
    }
    const late = list.filter(o => o.late).length;
    const blocks: A.RichBlock[] = list.slice(0, 12).map(o => ({ row: {
      icon: 'notifications-outline', color: o.late ? '#ff6b6b' : '#f5b544', round: true, title: o.reminder.title,
      value: o.reminder.amountMinor ? this.pesos(o.reminder.amountMinor) : '',
      lines: [o.reminder.repeat === 'monthly' ? this.i18n.t('reminders.monthly', { day: o.reminder.dayOfMonth ?? 1 })
        : this.i18n.t('reminders.once', { date: this.longDate(o.dueOn) }),
        this.i18n.t(o.late ? 'ai.reminders.late' : 'ai.reminders.next', { date: this.longDate(o.dueOn) })] } }));
    this.say(late > 0 ? 'ai.reminders.answerLate' : 'ai.reminders.answer', { count: list.length, late }, {
      card: { kind: 'rich', tone: late > 0 ? 'warn' : 'plain', band: null, blocks,
        buttons: [{ label: this.i18n.t('ai.reminders.see'), ghost: true, route: ['/reminders'] }] },
    });
  }

  /** Opens or closes a section of an answer; kept with the conversation. */
  toggleFold(fold: { open?: boolean }): void {
    fold.open = !fold.open;
    this.messages.update(list => [...list]);
  }

  /** A button of an answer's card. */
  go(button: RichButton): void {
    if (button.transferTo) {
      this.compose.open('transfer', { preferredAccountId: button.transferTo.accountId, preferredSide: 'to',
        start: { amountMinor: button.transferTo.amountMinor, onDate: isoDay(new Date()), note: '' } });
      return;
    }
    if (button.report) {
      this.filter.selectAccount(null);
      this.filter.period.set(button.report);
      void this.router.navigate(['/report']);
      return;
    }
    if (button.route) void this.router.navigate(button.route, button.query ? { queryParams: button.query } : {});
  }

  /** What is said in bold, inside a card's line. */
  bits(text: string): Part[] {
    return this.parts(text);
  }

  seeCap(cap: LimitView): void {
    void this.router.navigate(['/plans', cap.terms.id]);
  }

  /** The account's usual product, said quietly (39l). */
  productLine(card: RegisterCard): string[] {
    if (!card.product || card.productCount < 2) return [];
    const count = this.i18n.t('ai.register.productCount', { account: card.account.name, count: card.productCount });
    return card.productNamed ? [count] : [this.i18n.t('ai.register.usualProduct'), count];
  }

  changeProduct(card: RegisterCard): void {
    this.review(card);
  }
}
