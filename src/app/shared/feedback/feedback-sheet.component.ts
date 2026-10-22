/**
 * "Reportar un fallo o sugerir una mejora" (Jose, 2026-10-22): a fault, an
 * idea or a question, written here and sent from the person's own mail app
 * to Jadex Labs. What goes under their words is shown and chosen: the
 * phone's details, and what the reader made of the last photo. Mounted once
 * in the shell; `FeedbackService.open` opens it, over any form.
 */
import { Component, computed, effect, inject, signal } from '@angular/core';
import { IonIcon, IonModal } from '@ionic/angular';

import { FEEDBACK_TO, feedbackMail, type FeedbackKind } from '../../core/feedback/feedback-mail';
import { FeedbackService, copyText } from '../../core/feedback/feedback.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AutoGrowDirective } from '../ui/auto-grow.directive';
import { BadgeComponent } from '../ui/badge.component';
import { ToastService } from '../ui/toast.service';

@Component({
  selector: 'app-feedback-sheet',
  imports: [IonModal, IonIcon, TranslatePipe, BadgeComponent, AutoGrowDirective],
  template: `
    <ion-modal [initialBreakpoint]="1" [breakpoints]="[0, 1]" [handle]="false" class="ui-sheet" [isOpen]="feedback.asking() !== null"
               (didDismiss)="feedback.asking.set(null)">
      <ng-template>
        <div class="ui-sheet-body ion-content-scroll-host feedback">
          <button type="button" class="sheet-cancel" (click)="feedback.asking.set(null)">{{ 'entry.cancel' | t }}</button>
          <div class="grab"></div>
          <h2 class="center">{{ 'feedback.title' | t }}</h2>
          <p class="ui-sub center">{{ 'feedback.sub' | t:{ to } }}</p>

          <div class="ui-seg kinds">
            @for (k of kinds; track k) {
              <button type="button" [class.on]="kind() === k" (click)="kind.set(k)">{{ $any('feedback.kind.' + k) | t }}</button>
            }
          </div>

          <label class="box">
            <span class="lab">{{ $any('feedback.text.' + kind()) | t }}</span>
            <textarea rows="3" [value]="text()" [appAutoGrow]="text()" [placeholder]="$any('feedback.placeholder.' + kind()) | t"
                      (input)="text.set($any($event.target).value)"></textarea>
          </label>

          <div class="ui-list">
            <div class="ui-row">
              <app-badge [size]="38" builtin="phone-portrait-outline" fixed="#4cb8f5"></app-badge>
              <span class="ui-tx"><b class="wrap">{{ 'feedback.device' | t }}</b><small class="wrap">{{ 'feedback.device.hint' | t }}</small></span>
              <button type="button" class="ui-switch" [class.on]="withDevice()" role="switch" [attr.aria-checked]="withDevice()"
                      [attr.aria-label]="'feedback.device' | t" (click)="withDevice.set(!withDevice())"></button>
            </div>
            @if (hasReading()) {
              <div class="ui-row">
                <app-badge [size]="38" builtin="image-outline" fixed="#ff9152"></app-badge>
                <span class="ui-tx"><b class="wrap">{{ 'feedback.reading' | t }}</b><small class="wrap">{{ 'feedback.reading.hint' | t }}</small></span>
                <button type="button" class="ui-switch" [class.on]="withReading()" role="switch" [attr.aria-checked]="withReading()"
                        [attr.aria-label]="'feedback.reading' | t" (click)="withReading.set(!withReading())"></button>
              </div>
            }
          </div>
          <p class="never">{{ 'feedback.never' | t }}</p>

          <button type="button" class="see" (click)="preview.set(!preview())">
            <ion-icon [name]="preview() ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
            {{ (preview() ? 'feedback.preview.hide' : 'feedback.preview.show') | t }}
          </button>
          @if (preview()) {
            <div class="preview"><b>{{ mail().subject }}</b><pre>{{ mail().body || ('feedback.preview.empty' | t) }}</pre></div>
          }

          <button type="button" class="ui-btn send" [disabled]="!ready()" (click)="send()">{{ 'feedback.send' | t }}</button>
          @if (!ready()) { <p class="hint center">{{ $any('feedback.missing.' + kind()) | t }}</p> }
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .feedback { padding-bottom: calc(18px + var(--ion-safe-area-bottom, 0px)); }
    .center { text-align: center; }
    .ui-sub { margin: 4px 8px 14px; line-height: 1.4; text-wrap: pretty; }
    .kinds { margin-bottom: 12px; }
    .box { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .lab { font-size: 12.5px; color: var(--app-mu); padding-left: 4px; }
    textarea { width: 100%; min-height: 84px; resize: none; border: 1px solid var(--app-border); border-radius: 16px;
      background: var(--app-bg); color: var(--app-tx); font: inherit; font-size: 15.5px; line-height: 1.4; padding: 12px 14px; outline: none; }
    textarea::placeholder { color: var(--app-mu); }
    .never { color: var(--app-mu); font-size: 12.5px; line-height: 1.4; margin: 10px 4px 0; text-wrap: pretty; }
    .see { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; padding: 8px 4px; border: 0; background: none;
      color: var(--app-pr); font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
    .preview { border: 1px solid var(--app-border); border-radius: 14px; padding: 10px 12px; margin-top: 4px; background: var(--app-bg); }
    .preview b { display: block; font-size: 13.5px; margin-bottom: 6px; overflow-wrap: anywhere; }
    .preview pre { margin: 0; max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere;
      font: inherit; font-size: 12.5px; color: var(--app-mu); }
    .send { width: 100%; margin-top: 16px; }
    .hint { color: var(--app-mu); font-size: 12.5px; margin: 8px 0 0; }
  `],
})
export class FeedbackSheetComponent {
  readonly feedback = inject(FeedbackService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly to = FEEDBACK_TO;
  readonly kinds: FeedbackKind[] = ['bug', 'idea', 'question'];
  readonly kind = signal<FeedbackKind>('bug');
  readonly text = signal('');
  readonly withDevice = signal(true);
  readonly withReading = signal(false);
  readonly hasReading = signal(false);
  readonly preview = signal(false);

  readonly ready = computed(() => this.text().trim().length > 0);

  readonly mail = computed(() => {
    const t = (key: string, values?: Record<string, string | number>) => this.i18n.t(key as never, values);
    const version = this.feedback.installed();
    const device = this.withDevice() ? [
      t('feedback.line.version', { version: version ?? t('feedback.line.browser') }),
      t('feedback.line.phone', { phone: navigator.userAgent }),
      t('feedback.line.language', { language: this.i18n.language() }),
      t('feedback.line.screen', { width: Math.round(window.screen.width), height: Math.round(window.screen.height) }),
    ] : [];
    return feedbackMail({
      kind: this.kind(),
      text: this.text(),
      version,
      device,
      reading: this.withReading() && this.hasReading() ? this.feedback.reading() : null,
    }, {
      kind: { bug: t('feedback.subject.bug'), idea: t('feedback.subject.idea'), question: t('feedback.subject.question') },
      device: t('feedback.device'),
      reading: t('feedback.reading'),
    });
  });

  constructor() {
    // Each opening starts on what it was asked for, keeping what was typed
    // until it is sent.
    effect(() => {
      const ask = this.feedback.asking();
      if (!ask) return;
      this.kind.set(ask.kind);
      this.hasReading.set(this.feedback.hasReading());
      this.withReading.set(ask.withReading);
      this.preview.set(false);
    });
  }

  async send(): Promise<void> {
    if (!this.ready()) return;
    const mail = this.mail();
    // Copied first: if no mail app opens, the message is not lost.
    await copyText(`${mail.to}\n${mail.subject}\n\n${mail.body}`);
    this.feedback.asking.set(null);
    this.text.set('');
    this.toast.say(this.i18n.t('feedback.opened', { to: mail.to }), 10_000, { icon: 'mail-outline' });
    // Capacitor hands a link outside the app to the phone, which opens the mail app.
    window.location.href = mail.href;
  }
}
