/**
 * Guided tours (mockups `22a`-`22i`, `23g`; Jose, 2026-10-11). The first time
 * the app opens with accounts in it, and the first time a person reaches a
 * part with something to learn, a short tour: the screen dims, one thing is
 * lit, a bubble says what it does, with "Siguiente", the step it is on and
 * "Omitir". Each tour is shown once; Más → Preferencias → Guías turns them off,
 * replays the first one and brings them all back.
 *
 * What a tour lights is found by `data-tour="..."` on the element, so a screen
 * only marks its parts and never knows a tour exists. Which tours were seen is
 * a preference of this device (localStorage), like the theme: it is not data,
 * and losing it only shows a tour again.
 */

import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

import type { TranslationKey } from '../i18n/translations';
import { parseSeenVersions, stepsToShow, versionOf } from './tour-versions';


export interface TourStep {
  /**
   * What is lit: the `data-tour` value of an element, or a CSS selector
   * (`sel`) when the screen carries no mark of its own. Neither is a card in
   * the middle of the screen, saying what the screen is for.
   */
  target?: string;
  sel?: string;
  title: TranslationKey;
  text: TranslationKey;
  /**
   * The version of the tour this step arrived with (Jose, 2026-10-14: every
   * update brings its guide). Someone who saw the tour before sees only the
   * steps newer than what they saw, once, marked "Nuevo"; a new person sees
   * them all. Leave it out on the steps a tour was born with.
   */
  since?: number;
}

interface Tour { welcome?: { title: TranslationKey; text: TranslationKey }; steps: TourStep[] }

const TOUR_LIST = {
  home: {
    welcome: { title: 'tour.home.welcome.title', text: 'tour.home.welcome.text' },
    steps: [
      { target: 'plus', title: 'tour.home.plus.title', text: 'tour.home.plus.text' },
      { target: 'scope', title: 'tour.home.scope.title', text: 'tour.home.scope.text' },
      { target: 'hero', title: 'tour.home.hero.title', text: 'tour.home.hero.text' },
      // 2026-10-14: the eye that hides every amount.
      { sel: 'app-movements app-amounts-eye', title: 'tour.home.eye.title', text: 'tour.home.eye.text', since: 3 },
      { sel: 'app-movements .figures .used', title: 'tour.home.card.title', text: 'tour.home.card.text', since: 4 },
      { sel: 'app-movements app-spending-chart .box', title: 'tour.home.donut.title', text: 'tour.home.donut.text', since: 4 },
      // 2026-10-19: the assistant, on every screen (39p).
      { sel: 'app-movements app-ask-button button', title: 'tour.home.ask.title', text: 'tour.home.ask.text', since: 5 },
      { target: 'faces', title: 'tour.home.faces.title', text: 'tour.home.faces.text' },
      { target: 'tabs', title: 'tour.home.tabs.title', text: 'tour.home.tabs.text' },
      { target: 'more', title: 'tour.home.end.title', text: 'tour.home.end.text' },
    ],
  },
  attention: {
    steps: [{ target: 'attention', title: 'tour.attention.title', text: 'tour.attention.text' }],
  },
  yields: {
    steps: [
      { target: 'yields-figure', title: 'tour.yields.figure.title', text: 'tour.yields.figure.text' },
      { target: 'yields-tabs', title: 'tour.yields.tabs.title', text: 'tour.yields.tabs.text' },
      { target: 'yields-products', title: 'tour.yields.products.title', text: 'tour.yields.products.text' },
      // 2026-10-19: adding a product, first on the list and asked step by step (38b-38h).
      { target: 'yields-add-product', title: 'tour.yields.add.title', text: 'tour.yields.add.text', since: 2 },
    ],
  },
  // Every other screen, the first time it is opened (Jose, 2026-10-12:
  // "toooodas las posibles pantallas"). Opened by the route (ROUTE_TOURS),
  // the movement form by itself.
  more: {
    steps: [
      { title: 'tour.more.1.title', text: 'tour.more.1.text' },
      { target: 'more-finances', title: 'tour.more.2.title', text: 'tour.more.2.text' },
      { target: 'more-data', title: 'tour.more.3.title', text: 'tour.more.3.text' },
      { target: 'more-tools', title: 'tour.more.4.title', text: 'tour.more.4.text' },
      { target: 'more-prefs', title: 'tour.more.5.title', text: 'tour.more.5.text' },
      { target: 'more-prefs', title: 'tour.more.6.title', text: 'tour.more.6.text', since: 2 },
      // 2026-10-15: Finance Pro, what is free and what is paid (34f).
      { target: 'more-pro', title: 'tour.more.7.title', text: 'tour.more.7.text', since: 3 },
    ],
  },
  pro: {
    steps: [
      { target: 'pro-perks', title: 'tour.pro.1.title', text: 'tour.pro.1.text' },
      { target: 'pro-prices', title: 'tour.pro.2.title', text: 'tour.pro.2.text' },
      { target: 'pro-status', title: 'tour.pro.3.title', text: 'tour.pro.3.text', since: 2 },
    ],
  },
  view: {
    steps: [
      { title: 'tour.view.1.title', text: 'tour.view.1.text' },
      { target: 'view-screens', title: 'tour.view.2.title', text: 'tour.view.2.text' },
      // 2026-10-15: the bottom bar's buttons are chosen here too (33a).
      { target: 'view-bar', title: 'tour.view.3.title', text: 'tour.view.3.text', since: 2 },
    ],
  },
  bar: {
    steps: [
      { target: 'bar-preview', title: 'tour.bar.1.title', text: 'tour.bar.1.text' },
      { target: 'bar-buttons', title: 'tour.bar.2.title', text: 'tour.bar.2.text' },
    ],
  },
  accounts: {
    steps: [
      { sel: 'app-accounts app-accounts-faces', title: 'tour.accounts.1.title', text: 'tour.accounts.1.text' },
      { sel: 'app-accounts section.worth', title: 'tour.accounts.2.title', text: 'tour.accounts.2.text' },
      { sel: 'app-accounts .worth .sides', title: 'tour.accounts.6.title', text: 'tour.accounts.6.text', since: 5 },
      { sel: 'app-accounts .ui-list.accounts', title: 'tour.accounts.3.title', text: 'tour.accounts.3.text' },
      { sel: 'app-accounts .ui-bigtitle .ui-pill', title: 'tour.accounts.4.title', text: 'tour.accounts.4.text' },
      { title: 'tour.accounts.5.title', text: 'tour.accounts.5.text', since: 4 },
      { title: 'tour.accounts.7.title', text: 'tour.accounts.7.text', since: 6 },
    ],
  },
  currencies: {
    steps: [
      { sel: 'app-currencies section.trm', title: 'tour.currencies.1.title', text: 'tour.currencies.1.text' },
      { sel: 'app-currencies .refresh', title: 'tour.currencies.2.title', text: 'tour.currencies.2.text' },
      { sel: 'app-currencies .ui-titlebar .ui-pill', title: 'tour.currencies.3.title', text: 'tour.currencies.3.text' },
      { sel: 'app-currencies .ui-list.yours .ui-row:nth-child(2)', title: 'tour.currencies.4.title', text: 'tour.currencies.4.text', since: 2 },
      { target: 'main-currency', title: 'tour.currencies.5.title', text: 'tour.currencies.5.text', since: 3 },
      // 2026-10-19: a currency no account uses can be removed (37e-37g).
      { title: 'tour.currencies.6.title', text: 'tour.currencies.6.text', since: 4 },
    ],
  },
  report: {
    steps: [
      { sel: 'app-report .ui-seg.which', title: 'tour.report.1.title', text: 'tour.report.1.text' },
      { sel: 'app-report .account-row', title: 'tour.report.2.title', text: 'tour.report.2.text' },
      { sel: 'app-report .ui-period', title: 'tour.report.3.title', text: 'tour.report.3.text' },
      { sel: 'app-report section.block', title: 'tour.report.4.title', text: 'tour.report.4.text' },
      { sel: 'app-report .ui-bigtitle .ui-round', title: 'tour.report.5.title', text: 'tour.report.5.text' },
    ],
  },
  categories: {
    steps: [
      { sel: 'app-categories section.side', title: 'tour.categories.1.title', text: 'tour.categories.1.text' },
      { sel: 'app-categories .tools .ui-seg', title: 'tour.categories.2.title', text: 'tour.categories.2.text' },
      { sel: 'app-categories .ui-add', title: 'tour.categories.3.title', text: 'tour.categories.3.text' },
      // 2026-10-14: a category's side can be changed, with its movements.
      { title: 'tour.categories.4.title', text: 'tour.categories.4.text', since: 3 },
    ],
  },
  products: {
    steps: [
      { sel: 'app-products section.ui-hero.total', title: 'tour.products.1.title', text: 'tour.products.1.text' },
      { sel: 'app-products .ui-bigtitle .ui-round', title: 'tour.products.2.title', text: 'tour.products.2.text' },
      { title: 'tour.products.3.title', text: 'tour.products.3.text' },
    ],
  },
  debts: {
    steps: [
      { sel: 'app-debts section.owed', title: 'tour.debts.1.title', text: 'tour.debts.1.text' },
      { sel: 'app-debts .ui-main .ui-list', title: 'tour.debts.2.title', text: 'tour.debts.2.text' },
      { sel: 'app-debts .ui-bigtitle .ui-pill', title: 'tour.debts.3.title', text: 'tour.debts.3.text' },
      { title: 'tour.debts.4.title', text: 'tour.debts.4.text', since: 2 },
      { sel: 'app-debts .ui-h.with-total', title: 'tour.debts.5.title', text: 'tour.debts.5.text', since: 3 },
    ],
  },
  card: {
    steps: [
      { sel: 'app-card section.bill', title: 'tour.card.1.title', text: 'tour.card.1.text' },
      { sel: 'app-card .ui-seg.faces', title: 'tour.card.2.title', text: 'tour.card.2.text' },
      { title: 'tour.card.3.title', text: 'tour.card.3.text', since: 2 },
    ],
  },
  loan: {
    steps: [
      { sel: 'app-loan .ui-seg.tabs', title: 'tour.loan.1.title', text: 'tour.loan.1.text' },
      { sel: 'app-loan section.ui-hero', title: 'tour.loan.2.title', text: 'tour.loan.2.text' },
    ],
  },
  plans: {
    steps: [
      { sel: 'app-plans .ui-seg.faces', title: 'tour.plans.1.title', text: 'tour.plans.1.text' },
      { sel: 'app-plans .ui-add', title: 'tour.plans.2.title', text: 'tour.plans.2.text' },
      { sel: 'app-plans .ui-titlebar .bell', title: 'tour.plans.3.title', text: 'tour.plans.3.text' },
    ],
  },
  limit: {
    steps: [
      { sel: 'app-limit section.ui-hero', title: 'tour.limit.1.title', text: 'tour.limit.1.text' },
      { title: 'tour.limit.2.title', text: 'tour.limit.2.text' },
    ],
  },
  goal: {
    steps: [
      { sel: 'app-goal section.ui-hero', title: 'tour.goal.1.title', text: 'tour.goal.1.text' },
      { title: 'tour.goal.2.title', text: 'tour.goal.2.text' },
      // 2026-10-19: this month's suggested contribution, never an instalment (39o).
      { sel: 'app-goal .ui-card.month', title: 'tour.goal.3.title', text: 'tour.goal.3.text', since: 2 },
    ],
  },
  assistant: {
    steps: [
      { title: 'tour.assistant.1.title', text: 'tour.assistant.1.text' },
      { sel: 'app-assistant .compose-bar', title: 'tour.assistant.2.title', text: 'tour.assistant.2.text' },
      { title: 'tour.assistant.3.title', text: 'tour.assistant.3.text' },
      { title: 'tour.assistant.4.title', text: 'tour.assistant.4.text', since: 2 },
    ],
  },
  tax: {
    steps: [
      { title: 'tour.tax.1.title', text: 'tour.tax.1.text' },
      { sel: 'app-tax .year-row', title: 'tour.tax.2.title', text: 'tour.tax.2.text' },
      { sel: 'app-tax section.verdict', title: 'tour.tax.3.title', text: 'tour.tax.3.text' },
      { sel: 'app-tax section.card', title: 'tour.tax.4.title', text: 'tour.tax.4.text' },
      { sel: 'app-tax .ui-titlebar .ui-round', title: 'tour.tax.5.title', text: 'tour.tax.5.text' },
    ],
  },
  review: {
    steps: [
      { title: 'tour.review.1.title', text: 'tour.review.1.text' },
      { sel: 'app-review .origin-head', title: 'tour.review.2.title', text: 'tour.review.2.text' },
      { sel: 'app-review .ui-search', title: 'tour.review.3.title', text: 'tour.review.3.text' },
      // 2026-10-13/14: everything chosen is remembered; "No es un movimiento".
      { title: 'tour.review.4.title', text: 'tour.review.4.text', since: 2 },
      { title: 'tour.review.5.title', text: 'tour.review.5.text', since: 2 },
      // 2026-10-14: a group that repeats answered whole; "Editar" for several chosen.
      { sel: 'app-review .shops', title: 'tour.review.6.title', text: 'tour.review.6.text', since: 3 },
      { title: 'tour.review.7.title', text: 'tour.review.7.text', since: 3 },
      { title: 'tour.review.8.title', text: 'tour.review.8.text', since: 4 },
    ],
  },
  notifications: {
    steps: [
      { title: 'tour.notifications.1.title', text: 'tour.notifications.1.text' },
      { sel: 'app-notifications .ui-search', title: 'tour.notifications.2.title', text: 'tour.notifications.2.text' },
      // 2026-10-14: a source's page, "Ignorar publicidad", "Sí era un movimiento".
      { title: 'tour.notifications.3.title', text: 'tour.notifications.3.text', since: 2 },
      { title: 'tour.notifications.4.title', text: 'tour.notifications.4.text', since: 3 },
    ],
  },
  export: {
    steps: [
      { sel: 'app-export section.option', title: 'tour.export.1.title', text: 'tour.export.1.text' },
      { title: 'tour.export.2.title', text: 'tour.export.2.text' },
    ],
  },
  google: {
    steps: [
      { sel: 'app-account section.who', title: 'tour.google.1.title', text: 'tour.google.1.text' },
      { sel: 'app-account section.copy', title: 'tour.google.2.title', text: 'tour.google.2.text' },
    ],
  },
  erase: {
    steps: [
      { title: 'tour.erase.1.title', text: 'tour.erase.1.text' },
    ],
  },
  entry: {
    steps: [
      { sel: 'app-entry .ui-seg.kinds', title: 'tour.entry.1.title', text: 'tour.entry.1.text' },
      { sel: 'app-entry app-amount-field', title: 'tour.entry.2.title', text: 'tour.entry.2.text' },
      { sel: 'app-entry .ui-list.ends', title: 'tour.entry.3.title', text: 'tour.entry.3.text' },
      { sel: 'app-entry app-form-foot .again', title: 'tour.entry.4.title', text: 'tour.entry.4.text' },
    ],
  },
} satisfies Record<string, Tour>;

export type TourId = keyof typeof TOUR_LIST;
export const TOURS: Record<TourId, Tour> = TOUR_LIST;

/** Which screen's tour a route offers; the first match wins, most specific first. */
const ROUTE_TOURS: [RegExp, TourId][] = [
  [/^\/more/, 'more'], [/^\/pro/, 'pro'], [/^\/view\/bar/, 'bar'], [/^\/view/, 'view'], [/^\/accounts/, 'accounts'], [/^\/currencies/, 'currencies'], [/^\/report/, 'report'],
  [/^\/categories/, 'categories'], [/^\/products/, 'products'], [/^\/debts\/loan\//, 'loan'], [/^\/debts\/\d/, 'card'],
  [/^\/debts/, 'debts'], [/^\/plans\/goal\//, 'goal'], [/^\/plans\/\d/, 'limit'], [/^\/plans/, 'plans'],
  [/^\/tax/, 'tax'], [/^\/review/, 'review'], [/^\/notifications/, 'notifications'], [/^\/export/, 'export'],
  [/^\/account(\?|$)/, 'google'], [/^\/erase/, 'erase'], [/^\/assistant/, 'assistant'],
];

const ON_KEY = 'finance.tours.on';
const SEEN_KEY = 'finance.tours.seen';

export interface ActiveTour {
  id: TourId;
  /** -1 is the welcome card, before the first step. */
  step: number;
  /** The steps on show: all of them, or only what is new since last seen. */
  steps: TourStep[];
  /** Only what changed since the person last saw this tour. */
  news: boolean;
}

@Injectable({ providedIn: 'root' })
export class TourService {
  readonly enabled = signal(read(ON_KEY) !== '0');
  readonly active = signal<ActiveTour | null>(null);
  /** The version of each tour this device has seen. */
  private seen = parseSeenVersions<TourId>(read(SEEN_KEY), TOUR_LIST);
  /** Asked while another tour was on screen: started when that one ends. */
  private waiting: TourId[] = [];
  private readonly router = inject(Router);

  constructor() {
    // A screen's own tour the first time it is reached: offered a moment
    // after it opens, so what it lights has been drawn, and only if the
    // person is still there.
    this.router.events.subscribe(event => {
      if (!(event instanceof NavigationEnd)) return;
      const url = event.urlAfterRedirects;
      const found = ROUTE_TOURS.find(([pattern]) => pattern.test(url));
      if (!found) return;
      setTimeout(() => { if (this.router.url === url) this.offer(found[1]); }, 1100);
    });
  }

  /** Starts a tour the first time it is asked for, if tours are on. */
  offer(id: TourId): void {
    if (!this.enabled() || !stepsToShow(TOURS[id], this.seen.get(id) ?? 0)) return;
    if (this.active()) {
      if (this.active()!.id !== id && !this.waiting.includes(id)) this.waiting.push(id);
      return;
    }
    // Inicio's own tour comes before any other, so the person meets the app first.
    if (id !== 'home' && !this.seen.has('home')) {
      if (!this.waiting.includes(id)) this.waiting.push(id);
      return;
    }
    this.start(id);
  }

  /** Starts a tour whether it was seen or not (Más → Guías). */
  replay(id: TourId): void {
    this.waiting = [];
    this.start(id, true);
  }

  next(): void {
    const now = this.active();
    if (!now) return;
    if (now.step + 1 < now.steps.length) this.active.set({ ...now, step: now.step + 1 });
    else this.end();
  }

  /** "Omitir", "Ahora no" or "Listo": the tour is seen either way. */
  end(): void {
    const now = this.active();
    if (!now) return;
    this.seen.set(now.id, versionOf(TOURS[now.id]));
    write(SEEN_KEY, [...this.seen].map(([id, v]) => `${id}@${v}`).join(','));
    this.active.set(null);
    const following = this.waiting.shift();
    if (following && this.enabled() && stepsToShow(TOURS[following], this.seen.get(following) ?? 0)) {
      setTimeout(() => this.start(following), 400);
    }
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    write(ON_KEY, on ? '1' : '0');
    if (!on) { this.waiting = []; this.active.set(null); }
  }

  /** Every tour shows again the next time its part is reached. */
  resetAll(): void {
    this.seen.clear();
    write(SEEN_KEY, '');
  }

  private start(id: TourId, whole = false): void {
    const shown = whole ? { steps: TOURS[id].steps, news: false } : stepsToShow(TOURS[id], this.seen.get(id) ?? 0);
    if (!shown) return;
    // What is new comes without the welcome card: it was already said.
    this.active.set({ id, step: TOURS[id].welcome && !shown.news ? -1 : 0, ...shown });
  }
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage may refuse */ }
}
