/**
 * The reading screen, the password and the unreadable file (mockups `6u`,
 * `6v`, `6y`), drawn once in the shell for StatementFlowService.
 */

import { Component, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { StatementFlowService } from '../../core/statements/statement-flow.service';
import { BadgeComponent } from './badge.component';
import { AccentService } from '../../core/theme/accent.service';

@Component({
  selector: 'app-statement-flow',
  standalone: true,
  imports: [IonIcon, TranslatePipe, BadgeComponent],
  template: `
    @if (flow.active()) {
      <div class="screen" role="status" aria-live="polite">
        <div class="top">
          <button type="button" class="x" (click)="flow.cancel()" [attr.aria-label]="'statement.stage.stop' | t">
            <ion-icon name="close"></ion-icon>
          </button>
          <h1>{{ 'ui.import.title' | t }}</h1>
        </div>
        <main>
          <app-badge class="c" [size]="84" shape="ci" builtin="document-text-outline" fixed="#9b7bff"></app-badge>
          <b class="title">{{ 'ui.import.reading' | t }}</b>
          <div class="ui-sub ui-one file">{{ flow.fileName() }}</div>

          <div class="ui-card progress">
            <div class="line"><b>{{ flow.pageLabel() }}</b><span class="ui-p pct">{{ flow.percent() }} %</span></div>
            <div class="ui-pbar"><i [style.width.%]="flow.percent()"></i></div>
            <div class="stages">
              @for (key of stages; track key; let n = $index) {
                <div class="stage" [class.waiting]="n > flow.stageIndex()">
                  @if (n < flow.stageIndex()) {
                    <app-badge shape="ci" [size]="26" builtin="checkmark" fixed="#34c98b"></app-badge>
                  } @else if (n === flow.stageIndex()) {
                    <app-badge shape="ci" [size]="26" builtin="ellipsis-horizontal" [fixed]="accent.accent().color"></app-badge>
                  } @else {
                    <app-badge shape="ci" [size]="26" builtin="ellipse-outline" fixed="#8c9bb5"></app-badge>
                  }
                  <span>{{ $any('statement.stage.' + key) | t }}</span>
                </div>
              }
            </div>
          </div>
          <div class="ui-sub safe"><ion-icon name="shield-checkmark-outline"></ion-icon>{{ 'ui.import.nothingSaved' | t }}</div>
        </main>
        <div class="foot">
          <button type="button" class="ui-btn ghost" (click)="flow.cancel()">{{ 'statement.stage.stop' | t }}</button>
        </div>
      </div>
    }

    @if (flow.askingPassword()) {
      <div class="scrim"></div>
      <div class="ui-dialog-body fixed">
        <app-badge class="c" shape="ci" [size]="54" builtin="lock-closed-outline" fixed="#f6b93b"></app-badge>
        <h2>{{ 'statement.password' | t }}</h2>
        <p>{{ 'statement.password.hint' | t }}</p>
        <label class="pass">
          <ion-icon name="key-outline"></ion-icon>
          <input [type]="show() ? 'text' : 'password'" [placeholder]="'ui.import.password.placeholder' | t"
                 #typed (keyup.enter)="flow.givePassword(typed.value)" autocomplete="off">
          <button type="button" (click)="show.set(!show())"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></button>
        </label>
        <div class="answers">
          <button type="button" class="ui-btn ghost" (click)="flow.givePassword(null)">{{ 'ui.cancel' | t }}</button>
          <button type="button" class="ui-btn" (click)="flow.givePassword(typed.value)">{{ 'ui.import.password.open' | t }}</button>
        </div>
      </div>
    }

    @if (flow.unreadable() !== null) {
      <div class="scrim"></div>
      <div class="ui-dialog-body fixed">
        <app-badge class="c" shape="ci" [size]="54" builtin="document-outline" fixed="#ff6b6b"></app-badge>
        <h2>{{ 'ui.import.unreadable.title' | t }}</h2>
        <p>{{ 'ui.import.unreadable.body' | t }}</p>
        @if (flow.unreadable()) { <p class="reason">{{ flow.unreadable() }}</p> }
        <div class="answers">
          <button type="button" class="ui-btn ghost" (click)="flow.closeUnreadable(false)">{{ 'ui.close' | t }}</button>
          <button type="button" class="ui-btn" (click)="flow.closeUnreadable(true)">{{ 'ui.import.unreadable.other' | t }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .screen {
      position: fixed; inset: 0; z-index: 20000; background: var(--app-bg); color: var(--app-tx);
      display: flex; flex-direction: column;
    }
    .top {
      background: var(--app-top); padding: calc(10px + var(--ion-safe-area-top, 0px)) 16px 12px;
      display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--app-line);
    }
    .top h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .x { border: 0; background: none; color: var(--app-tx); display: grid; padding: 4px; cursor: pointer; }
    .x ion-icon { font-size: 22px; }
    main { flex: 1; overflow-y: auto; padding: 34px 16px 16px; text-align: center; }
    .c { margin: 0 auto 16px; }
    .title { font-size: 19px; display: block; }
    .file { margin-top: 4px; }
    .progress { margin-top: 20px; text-align: left; }
    .line { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .pct { font-weight: 600; }
    .ui-pbar { height: 8px; }
    .stages { margin-top: 12px; }
    .stage { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 14px; }
    .stage.waiting { color: var(--app-mu); }
    .safe { margin-top: 12px; display: flex; gap: 6px; justify-content: center; align-items: center; }
    .safe ion-icon { font-size: 16px; color: var(--app-grn); }
    .foot { padding: 12px 16px calc(24px + var(--ion-safe-area-bottom, 0px)); }
    .scrim { position: fixed; inset: 0; z-index: 20001; background: var(--app-scrim); }
    .fixed {
      position: fixed; left: 22px; right: 22px; top: 50%; transform: translateY(-50%); z-index: 20002;
      max-width: 24rem; margin: 0 auto;
    }
    .pass {
      background: var(--app-s2); border: 1px solid var(--app-line); border-radius: 14px; height: 48px;
      display: flex; align-items: center; padding: 0 14px; gap: 10px; margin-top: 14px; color: var(--app-mu);
    }
    .pass input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--app-tx); font-size: 15px; }
    .pass button { border: 0; background: none; color: var(--app-mu); display: grid; padding: 0; cursor: pointer; }
    .pass ion-icon { font-size: 19px; }
    .reason { font-size: 12px !important; opacity: 0.8; }
  `],
})
export class StatementFlowComponent {
  readonly flow = inject(StatementFlowService);
  readonly stages = ['opening', 'pages', 'reading', 'writing'];
  readonly show = signal(false);
  readonly accent = inject(AccentService);
}
