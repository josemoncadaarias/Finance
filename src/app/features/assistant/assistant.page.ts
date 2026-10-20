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
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';

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
import { AssistantService, type Picture } from '../../core/assistant/assistant.service';
import { readPhrase, type Reading } from '../../core/assistant/read-phrase';
import { afford, perDay, type GoalThisMonth } from '../../core/assistant/free-money';
import { canListen, listen } from '../../core/assistant/speech';
import { isoDay } from '../../core/filters/period';
import type { LimitView } from '../../core/limits/limits.service';

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

type Card = RegisterCard | TransferCard | FreeCard | SpentCard | GoalsCard;

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
 * The conversation is kept on the device for this many days (Jose,
 * 2026-10-19: "por lo menos unos 3 días"; to be made a preference later).
 */
export const HISTORY_DAYS = 3;
const HISTORY_KEY = 'finance.assistant.history';

/** A question the next answer completes. */
type Waiting =
  | { kind: 'account'; reading: Reading; said: string; choices: number[] }
  | { kind: 'category'; reading: Reading; said: string }
  | { kind: 'shape'; reading: Reading; said: string };

const EXAMPLES: TranslationKey[] = ['ai.example.spend', 'ai.example.income', 'ai.example.move', 'ai.example.afford', 'ai.example.spent', 'ai.example.perDay'];

@Component({
  selector: 'app-assistant',
  templateUrl: './assistant.page.html',
  styleUrls: ['./assistant.page.scss'],
  imports: [TranslatePipe, IonContent, IonIcon, BadgeComponent, CategorySheetComponent, AccountPickerComponent],
})
export class AssistantPage {
  private readonly router = inject(Router);
  private readonly database = inject(DatabaseService);
  private readonly assistant = inject(AssistantService);
  private readonly compose = inject(ComposeService);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(I18nService);

  private readonly content = viewChild(IonContent);
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  readonly messages = signal<Message[]>([]);
  readonly typed = signal('');
  readonly busy = signal(false);
  readonly listening = signal(false);
  readonly voice = signal(true);
  readonly examples = EXAMPLES;
  readonly historyDays = HISTORY_DAYS;

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
    // The form closed: saved there, the card says so; closed without saving,
    // the card offers it again (Jose, 2026-10-19: it could not be reopened).
    effect(() => {
      const open = this.compose.entry() !== null;
      const saves = this.compose.saved();
      untracked(() => {
        if (open || !this.inForm) return;
        this.inForm.card.state = saves > this.inForm.savesBefore ? 'saved' : 'open';
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
      const since = Date.now() - HISTORY_DAYS * 86_400_000;
      const kept = (JSON.parse(raw) as Message[]).filter(m => typeof m.at === 'number' && m.at >= since);
      for (const m of kept) if (m.card && 'state' in m.card && m.card.state === 'opened') m.card.state = 'open';
      this.messages.set(kept);
      this.nextId = kept.reduce((top, m) => Math.max(top, m.id), 0) + 1;
      if (kept.length > 0) this.scroll();
    } catch { /* a history that cannot be read starts afresh */ }
  }

  private keep(list: Message[]): void {
    try {
      const since = Date.now() - HISTORY_DAYS * 86_400_000;
      const plain = list.filter(m => m.at >= since).map(({ chips: _chips, ...rest }) => rest);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(plain));
    } catch { /* the device keeps nothing: the chat still works */ }
  }

  /** Clears the conversation on screen and on the device. */
  clear(): void {
    this.waiting = null;
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
    const reading = readPhrase(text, ctx);
    this.waiting = null;
    switch (reading.intent) {
      case 'register': return this.register(reading, text);
      case 'afford': return this.affordIt(reading, text);
      case 'perDay': return this.howMuchADay();
      case 'spentIn': return this.spent(reading, text);
      case 'howGoals': return this.howGoals();
      case 'unsure': return this.askShape(reading, text);
      default:
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
    if (reading.side === 'transfer') return this.transfer(reading);

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
      canSave: account.currency_code === 'COP' && usual.ordinary, state: 'open',
    };
    // "en mercado" named the category; it is no note of its own.
    if (reading.categoryFrom === 'name') card.note = '';
    else card.note = card.note.charAt(0).toUpperCase() + card.note.slice(1);
    if (reading.amountGuessed) this.say('ai.amount.guessed', { said: reading.amountText ?? '', amount: this.pesos(reading.amountMinor) });
    if (reading.productId !== null && product) {
      this.say('ai.register.fromProduct', { product: product.name, account: account.name });
    }
    this.say(side === 'income' ? 'ai.register.understoodIncome' : 'ai.register.understood', {}, { card });
  }

  private transfer(reading: Reading): void {
    const to = reading.toAccountId !== null ? this.accounts.find(a => a.id === reading.toAccountId) ?? null : null;
    if (!to) return this.say('ai.transfer.noTo');
    const from = reading.accountId !== null ? this.accounts.find(a => a.id === reading.accountId) ?? null : null;
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
        onDate: reading.onDate, note: reading.thing ?? '', state: 'open',
      },
    });
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
    void this.accountIs(account);
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
