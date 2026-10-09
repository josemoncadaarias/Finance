/**
 * What Inicio says about the sample data (mockups 21a-21d).
 *
 * On an empty app: the welcome, with "Crear mi primera cuenta" and
 * "Explorar con datos de ejemplo" (21a), and the sample being built (21b).
 * With the sample loaded: a strip on top, always, with "Empezar con los
 * míos" (21c), which asks first (21d) and leaves the app empty again.
 */

import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';

import { DemoService } from '../../core/demo/demo.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { BusyOverlayComponent } from '../busy-overlay.component';
import { ConfirmComponent } from '../confirm/confirm.component';

class Cancelled extends Error {}

@Component({
  selector: 'app-demo-home',
  imports: [IonIcon, TranslatePipe, BusyOverlayComponent, ConfirmComponent],
  template: `
    @if (part() === 'welcome') {
      <section class="welcome">
        <span class="spark"><ion-icon name="sparkles-outline"></ion-icon></span>
        <h1>{{ 'demo.welcome.title' | t }}</h1>
        <p class="lead">{{ 'demo.welcome.lead' | t }}</p>

        <div class="ui-card choice">
          <div class="what">
            <span class="ci green"><ion-icon name="wallet-outline"></ion-icon></span>
            <div><b>{{ 'demo.welcome.own' | t }}</b><small>{{ 'demo.welcome.ownHint' | t }}</small></div>
          </div>
          <button type="button" class="ui-btn" (click)="firstAccount()">
            <ion-icon name="add"></ion-icon>{{ 'demo.welcome.create' | t }}
          </button>
        </div>

        <div class="ui-card choice">
          <div class="what">
            <span class="ci violet"><ion-icon name="flask-outline"></ion-icon></span>
            <div><b>{{ 'demo.welcome.sample' | t }}</b><small>{{ 'demo.welcome.sampleHint' | t }}</small></div>
          </div>
          <button type="button" class="ui-btn ghost" (click)="load()">
            <ion-icon name="play-outline"></ion-icon>{{ 'demo.welcome.explore' | t }}
          </button>
        </div>

        @if (error()) { <div class="ui-banner bad"><ion-icon name="alert-circle-outline"></ion-icon><span>{{ error() }}</span></div> }

        <p class="restore">{{ 'demo.welcome.haveCopy' | t }} <button type="button" (click)="restore()">{{ 'demo.welcome.restore' | t }}</button></p>
      </section>
    }

    @if (part() === 'strip') {
      <div class="strip">
        <ion-icon name="flask-outline"></ion-icon>
        <div class="words"><b>{{ 'demo.strip.title' | t }}</b><small>{{ 'demo.strip.hint' | t }}</small></div>
        <button type="button" (click)="asking.set(true)">{{ 'demo.strip.start' | t }}</button>
      </div>
      <app-confirm [open]="asking()" icon="flask-outline" tone="primary"
                   [title]="'demo.erase.title' | t" [body]="'demo.erase.body' | t"
                   [confirmLabel]="'demo.erase.yes' | t" [busy]="erasing()" [error]="error()"
                   (confirmed)="eraseSample()" (cancelled)="asking.set(false)"></app-confirm>
    }

    @if (progress() !== null) {
      <app-busy-overlay icon="flask-outline" [label]="'demo.loading.title' | t"
                        [detail]="'demo.loading.detail' | t" [percent]="progress()"
                        [cancelLabel]="'entry.cancel' | t" (cancelled)="cancel()"></app-busy-overlay>
    }
  `,
  styles: [`
    :host { display: block; }
    .welcome { text-align: center; padding-top: 18px; }
    .spark { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; margin: 0 auto 10px;
      background: rgba(var(--app-pr-rgb), .16); color: var(--app-pr); font-size: 36px; }
    h1 { font-size: 24px; margin: 6px 0; }
    .lead { color: var(--app-mu); font-size: 14.5px; line-height: 1.45; margin: 0 12px 22px; }
    .choice { padding: 16px; margin-top: 10px; text-align: left; }
    .what { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .what small { display: block; color: var(--app-mu); font-size: 12.8px; margin-top: 2px; line-height: 1.35; }
    .ci { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; flex: none; font-size: 22px; }
    .ci.green { background: rgba(var(--app-grn-rgb), .16); color: var(--app-grn); }
    .ci.violet { background: rgba(155, 123, 255, .16); color: #9b7bff; }
    .restore { color: var(--app-mu); font-size: 12.8px; margin-top: 16px; }
    .restore button { background: none; border: 0; padding: 0; color: var(--app-pr); font: inherit; cursor: pointer; }
    .ui-banner { margin-top: 10px; text-align: left; }
    .strip { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; padding: 10px 12px; border-radius: 14px;
      background: rgba(155, 123, 255, .16); border: 1px solid rgba(155, 123, 255, .4); }
    .strip > ion-icon { font-size: 20px; color: #9b7bff; flex: none; }
    .words { flex: 1; min-width: 0; font-size: 13px; line-height: 1.35; }
    .words b { color: #c9b8ff; }
    .words small { display: block; color: var(--app-mu); font-size: 12.3px; }
    .strip button { padding: 7px 11px; border-radius: 11px; border: 0; background: rgba(155, 123, 255, .3); color: var(--app-tx);
      font: inherit; font-weight: 600; font-size: 12.8px; cursor: pointer; flex: none; }
  `],
})
export class DemoHomeComponent {
  /** Which part this place in Inicio shows: the welcome or the strip. */
  readonly part = input.required<'welcome' | 'strip'>();

  private readonly demo = inject(DemoService);
  private readonly router = inject(Router);

  readonly progress = signal<number | null>(null);
  readonly asking = signal(false);
  readonly erasing = signal(false);
  readonly error = signal('');
  private stop = false;

  firstAccount(): void {
    void this.router.navigate(['/accounts'], { queryParams: { new: 'account' } });
  }

  restore(): void {
    void this.router.navigate(['/export']);
  }

  async load(): Promise<void> {
    this.error.set('');
    this.stop = false;
    this.progress.set(0);
    try {
      await this.demo.load(fraction => {
        // Thrown inside the transaction: everything written so far goes.
        if (this.stop) throw new Cancelled();
        this.progress.set(Math.round(fraction * 100));
      });
    } catch (error) {
      if (!(error instanceof Cancelled)) this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.progress.set(null);
    }
  }

  cancel(): void {
    this.stop = true;
  }

  async eraseSample(): Promise<void> {
    this.erasing.set(true);
    this.error.set('');
    try {
      await this.demo.eraseAll({ messages: false });
      this.asking.set(false);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.erasing.set(false);
    }
  }
}
