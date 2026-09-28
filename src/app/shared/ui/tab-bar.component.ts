/**
 * The floating bar: Inicio, Cuentas, the "+", Reporte, Más.
 *
 * It replaces the drawer (group 8 of the redesign, approved by Jose on
 * 2026-09-28). The drawer had been chosen because Android's own buttons own
 * the bottom edge; the bar answers that by FLOATING above them, with its own
 * margin and the safe-area inset under it, four big targets and the "+" in
 * the middle - never over the page, where it covered balances (mockup `1a`).
 *
 * A red dot on Más says something waits in "Movimientos por revisar", where
 * the drawer's count used to.
 */

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ComposeService } from '../../core/ui/compose.service';
import { DatabaseService } from '../../core/database/database.service';
import { ProposalsRepository } from '../../core/database/repositories/proposals.repository';

type Tab = 'home' | 'accounts' | 'report' | 'more';

const TAB_OF: [string, Tab][] = [
  ['/movements', 'home'],
  ['/accounts', 'accounts'], ['/products', 'accounts'], ['/currencies', 'accounts'],
  ['/report', 'report'],
  ['/more', 'more'], ['/review', 'more'], ['/categories', 'more'], ['/notifications', 'more'],
  ['/export', 'more'], ['/account', 'more'], ['/tax', 'more'],
];

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [IonIcon, TranslatePipe],
  template: `
    <nav>
      <button type="button" [class.on]="tab() === 'home'" (click)="go('/movements')">
        <ion-icon name="home-outline"></ion-icon><span>{{ 'ui.tab.home' | t }}</span>
      </button>
      <button type="button" [class.on]="tab() === 'accounts'" (click)="go('/accounts')">
        <ion-icon name="wallet-outline"></ion-icon><span>{{ 'ui.tab.accounts' | t }}</span>
      </button>
      <button type="button" class="plus" (click)="compose.sheet.set(true)"
              [attr.aria-label]="'ui.tab.new' | t" [title]="'ui.tab.new' | t">
        <ion-icon name="add"></ion-icon>
      </button>
      <button type="button" [class.on]="tab() === 'report'" (click)="go('/report')">
        <ion-icon name="stats-chart-outline"></ion-icon><span>{{ 'ui.tab.report' | t }}</span>
      </button>
      <button type="button" [class.on]="tab() === 'more'" (click)="go('/more')">
        <ion-icon name="grid-outline"></ion-icon><span>{{ 'ui.tab.more' | t }}</span>
        @if (waiting() > 0) { <i class="dot"></i> }
      </button>
    </nav>
  `,
  styles: [`
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 15;
      pointer-events: none;
      padding: 0 16px calc(22px + var(--ion-safe-area-bottom, 0px));
    }
    @media (min-width: 34rem) {
      :host { max-width: 30rem; margin-inline: auto; }
    }
    nav {
      pointer-events: auto;
      height: 66px;
      border-radius: 33px;
      background: var(--app-nav);
      border: 1px solid var(--app-nav-border);
      display: flex;
      align-items: center;
      padding: 0 6px;
      box-shadow: 0 10px 30px var(--app-shadow);
    }
    button {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      color: var(--app-nav-mu);
      font-size: 11px;
      font-family: inherit;
      padding: 7px 0;
      border: 0;
      border-radius: 26px;
      background: none;
      position: relative;
      cursor: pointer;
    }
    button ion-icon { font-size: 23px; }
    button span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    button.on { background: rgba(var(--app-pr-rgb), 0.2); color: var(--app-pr); font-weight: 500; }
    button.plus {
      flex: none;
      width: 52px;
      height: 52px;
      padding: 0;
      margin: 0 4px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--app-pr), var(--app-pr2));
      color: #fff;
      display: grid;
      place-items: center;
      box-shadow: 0 6px 18px rgba(var(--app-pr-rgb), 0.45);
    }
    button.plus ion-icon { font-size: 28px; }
    .dot {
      position: absolute;
      top: 5px;
      right: calc(50% - 20px);
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--app-red);
      border: 2px solid var(--app-s1);
    }
  `],
})
export class TabBarComponent {
  private readonly router = inject(Router);
  readonly compose = inject(ComposeService);
  private readonly database = inject(DatabaseService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly tab = computed<Tab | null>(() => {
    const path = this.url().split(/[?#]/)[0];
    for (const [prefix, tab] of TAB_OF) {
      if (path === prefix || path.startsWith(prefix + '/')) return tab;
    }
    return null;
  });

  /** Movements a statement proposed and nobody has answered yet. */
  readonly waiting = signal(0);

  constructor() {
    effect(() => {
      this.database.dataVersion();
      this.url();
      if (this.database.status() !== 'ready') return;
      void untracked(async () => {
        this.waiting.set(await new ProposalsRepository(this.database.driver).pendingCount());
      });
    });
  }

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
