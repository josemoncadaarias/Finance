/**
 * The shell: whatever page is open, the floating bar under it, and what the
 * "+" opens. See `app.component.html`.
 */

import { Component, effect, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { IonApp, IonRouterOutlet, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { DRAWN_ICONS } from './core/icons/drawn-icons';
import * as allIcons from 'ionicons/icons';
import { ThemeService } from './core/theme/theme.service';
import { AccentService } from './core/theme/accent.service';
import { DatabaseService } from './core/database/database.service';
import { GoogleAccountService } from './core/cloud/google-account.service';
import { CloudBackupService } from './core/cloud/cloud-backup.service';
import { ForeignConversionService } from './core/rates/foreign-conversion.service';
import { CustomIconsService } from './core/icons/custom-icons.service';
import { MarqueeService } from './core/ui/marquee.service';
import { TabBarComponent } from './shared/ui/tab-bar.component';
import { ComposeHostComponent } from './shared/ui/compose-host.component';
import { StatementFlowComponent } from './shared/ui/statement-flow.component';
import { ToastComponent } from './shared/ui/toast.component';
import { LimitAlertComponent } from './features/plans/limit-alert.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    IonApp, IonRouterOutlet,
    TabBarComponent, ComposeHostComponent, StatementFlowComponent, ToastComponent, LimitAlertComponent,
  ],
})
export class AppComponent {
  private readonly database = inject(DatabaseService);

  /**
   * The images accounts and categories wear, read as soon as there is a
   * database to read them from rather than when a screen first needs one. On
   * a phone that wait was visible, and what showed meanwhile was a generic
   * icon rather than the bank own logo.
   */
  private readonly customIcons = inject(CustomIconsService);

  /**
   * Injected for its side effect: the service paints the theme in an effect of
   * its own, and nothing else asks for it at startup. Without this the app
   * would open in whatever the stylesheet defaults to.
   */
  private readonly theme = inject(ThemeService);

  /** The colour of the app, painted before the first frame. */
  private readonly accent = inject(AccentService);

  private readonly google = inject(GoogleAccountService);
  /**
   * Injected here and nowhere used: starting it is the point.
   *
   * It watches the database and listens for the app being put away, and it
   * cannot do either until something asks for it. Left to the toolbar button
   * that injects it, it would start whenever the first screen happened to
   * draw - and stop existing on a screen that has no toolbar.
   */
  private readonly cloud = inject(CloudBackupService);

  /** Values foreign movements in pesos at their own day's rate. Same reason. */
  private readonly foreign = inject(ForeignConversionService);

  /** Text cut short with "…" slides to show the rest of itself, on every screen. */
  private readonly marquee = inject(MarqueeService);

  /**
   * A sheet never outlives the screen it was opened on (Jose, 2026-09-28:
   * "Ver monedas y tasas" went to the page and left the list of accounts
   * lying over it). Going to another screen closes whatever is open; staying
   * on the same one - a query string changing - leaves it alone.
   */
  private readonly modals = inject(ModalController);
  private readonly closeOnLeaving = inject(Router).events.subscribe(event => {
    if (!(event instanceof NavigationStart)) return;
    const from = location.pathname;
    if (event.url.split('?')[0] === from) return;
    void (async () => {
      for (let open = await this.modals.getTop(); open; open = await this.modals.getTop()) {
        if (!(await open.dismiss())) break;
      }
    })();
  });

  constructor() {
    this.marquee.start();
    // Every icon, once, for the whole app: see the note above the class.
    addIcons(allIcons as unknown as Record<string, string>);
    // The ones drawn here, because Ionicons has none like them.
    addIcons(DRAWN_ICONS);

    // Signed in last time? Then signed in now, without being asked again.
    // It fails quietly on purpose: signed out is the ordinary state of this
    // app, not something to report on startup.
    void this.google.restore();

    effect(() => {
      this.database.dataVersion();
      if (this.database.status() === 'ready') void this.customIcons.load();
    });
  }
}
