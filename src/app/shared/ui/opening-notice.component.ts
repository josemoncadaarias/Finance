import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';

import { NoticeInboxService } from '../../core/notices/notice-inbox.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from './toast.service';

const STEPS = ['data', 'read', 'review'] as const;

/**
 * "Abriendo el movimiento detectado…" (Jose, 2026-10-17, mockup 36 option A):
 * shown from the moment a tapped "Movimiento detectado" opens the app until
 * Por revisar opens its movement, with the step it is on, so the wait never
 * looks like a frozen screen.
 */
@Component({
  selector: 'app-opening-notice',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (notices.opening(); as step) {
      <div class="dim" role="status" aria-live="polite">
        <div class="box">
          <div class="spin" aria-hidden="true"></div>
          <div class="title">{{ 'ui.opening.title' | t }}</div>
          <div class="lead">{{ 'ui.opening.lead' | t }}</div>
          <ol class="steps">
            @for (one of steps; track one) {
              <li [class.done]="index(one) < index(step)" [class.now]="one === step">
                <span class="mark">{{ index(one) < index(step) ? '✓' : one === step ? '●' : '○' }}</span>
                {{ words[one] | t }}
              </li>
            }
          </ol>
        </div>
      </div>
    }
  `,
  styles: [`
    .dim { position: fixed; inset: 0; z-index: 45000; background: rgba(3, 6, 14, .72);
      display: flex; align-items: center; justify-content: center; padding: 16px; }
    .box { width: 100%; max-width: 340px; background: var(--app-s2); border: 1px solid var(--app-line);
      border-radius: 20px; padding: 26px 22px; text-align: center; color: var(--app-tx); }
    .spin { width: 38px; height: 38px; margin: 0 auto 16px; border-radius: 50%;
      border: 4px solid var(--app-line); border-top-color: var(--app-pr); animation: spin .9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.5s; } }
    .title { font-weight: 700; font-size: 17px; margin-bottom: 8px; }
    .lead { color: var(--app-mu); font-size: 14px; line-height: 1.45; }
    .steps { list-style: none; margin: 16px 0 0; padding: 0; text-align: left; font-size: 14px; color: var(--app-mu); line-height: 1.9; }
    .steps .mark { display: inline-block; width: 1.3em; }
    .steps .done { color: var(--app-grn); }
    .steps .now { color: var(--app-tx); font-weight: 600; }
  `],
})
export class OpeningNoticeComponent {
  readonly notices = inject(NoticeInboxService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly steps = STEPS;
  readonly words = {
    data: 'ui.opening.step.data', read: 'ui.opening.step.read', review: 'ui.opening.step.review',
  } as const;

  private readonly router = inject(Router);

  constructor() {
    // Not in Por revisar: say so, and lead to the message's source, whose
    // page says what became of each message (Jose, 2026-10-17: the notice
    // said "Lo encuentras en Movimientos por revisar" over an empty list).
    effect(() => {
      const failed = this.notices.openingFailed();
      if (!failed) return;
      this.toast.say(this.i18n.t('ui.opening.failed'), 9000, {
        icon: 'information-circle',
        action: {
          label: this.i18n.t('ui.opening.why'),
          run: () => void this.router.navigate(['/notifications'],
            failed.source ? { queryParams: { source: failed.source } } : {}),
        },
      });
    });
  }

  index(step: string): number {
    return STEPS.indexOf(step as typeof STEPS[number]);
  }
}
