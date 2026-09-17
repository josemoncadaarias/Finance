/**
 * Signing in to a Google account, and nothing else.
 *
 * The app does not need an account and never will: the database lives on the
 * phone and works with no network at all, which is rule 1 of this project. An
 * account buys one thing - somewhere off the phone to keep a copy - and that
 * is why this service knows about signing in and about tokens, and knows
 * nothing about backups. `DriveBackup` knows about backups and nothing about
 * signing in.
 *
 * The token this hands out is a Google OAuth access token with the
 * `drive.appdata` scope. That scope reaches exactly one folder: a hidden one
 * belonging to this app inside the user's own Drive. It cannot read the rest
 * of their Drive, and no other app can read ours. There is no server of ours
 * anywhere in this: the data go from the phone to the user's own Drive.
 */

import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

import { environment } from '../../../environments/environment';

/** Who is signed in, as much of it as the screen shows. */
export interface GoogleUser {
  email: string;
  name: string;
  photoUrl: string | null;
}

/** The one scope this app asks for: its own folder, and nothing else. */
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

@Injectable({ providedIn: 'root' })
export class GoogleAccountService {
  /** Null while nobody is signed in, which is the ordinary state. */
  readonly user = signal<GoogleUser | null>(null);

  /** True while a sign-in is in flight, so the button can say so. */
  readonly working = signal(false);

  /** What went wrong, in the user's language, or '' when nothing did. */
  readonly error = signal('');

  private token: string | null = null;
  private started = false;

  /**
   * True when signing in is offered here.
   *
   * Deliberately not offered in the browser, and not because it could not be
   * made to work - the plugin does support it. Because the browser holds a
   * DIFFERENT database: `ionic serve` keeps its own copy in IndexedDB, which
   * is where things get tried out. Signing in there and letting it save would
   * put that copy over the one made from the phone, and the phone's is the
   * real one. The screen says which of the two reasons applies rather than
   * blaming a missing client id for both.
   */
  readonly available = Capacitor.isNativePlatform()
    && (environment.googleWebClientId ?? '') !== '';

  /** Why it is not offered, for a screen that would rather explain than hide. */
  readonly unavailableBecause: 'browser' | 'unconfigured' | null =
    !Capacitor.isNativePlatform() ? 'browser'
      : (environment.googleWebClientId ?? '') === '' ? 'unconfigured'
        : null;

  /** Tells the plugin which Google project this app belongs to. Once. */
  private async start(): Promise<void> {
    if (this.started) return;
    await SocialLogin.initialize({
      google: { webClientId: environment.googleWebClientId, mode: 'online' },
    });
    this.started = true;
  }

  /**
   * Signs back in without asking, when the phone still remembers.
   *
   * Called on startup. It must fail quietly: not being signed in is the normal
   * state of this app, not an error to report.
   */
  async restore(): Promise<void> {
    if (!this.available) return;
    try {
      await this.start();
      const { isLoggedIn } = await SocialLogin.isLoggedIn({ provider: 'google' });
      if (!isLoggedIn) return;
      await this.signIn({ silent: true });
    } catch {
      this.user.set(null);
    }
  }

  async signIn(options: { silent?: boolean } = {}): Promise<boolean> {
    if (!this.available) return false;
    this.working.set(true);
    this.error.set('');
    try {
      await this.start();
      const result = await SocialLogin.login({
        provider: 'google',
        options: { scopes: [SCOPE], forceRefreshToken: true },
      });

      const profile = (result.result ?? {}) as {
        profile?: { email?: string; name?: string; imageUrl?: string | null };
        accessToken?: { token?: string } | null;
      };

      this.token = profile.accessToken?.token ?? null;
      this.user.set({
        email: profile.profile?.email ?? '',
        name: profile.profile?.name ?? '',
        photoUrl: profile.profile?.imageUrl ?? null,
      });
      return true;
    } catch (failure) {
      this.user.set(null);
      this.token = null;
      // A cancelled sign-in is a decision, not a failure to report.
      if (!options.silent && !cancelled(failure)) {
        this.error.set(messageOf(failure));
      }
      return false;
    } finally {
      this.working.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      await SocialLogin.logout({ provider: 'google' });
    } finally {
      this.user.set(null);
      this.token = null;
    }
  }

  /**
   * A token for the Drive calls.
   *
   * Access tokens expire, so an expired one is not an error: the session is
   * asked for again without showing the chooser, and only a real failure to
   * do that is reported.
   */
  async accessToken(): Promise<string | null> {
    if (this.token) return this.token;
    if (!this.user()) return null;
    await this.signIn({ silent: true });
    return this.token;
  }

  /** Called when Drive says the token is no longer good. */
  forgetToken(): void {
    this.token = null;
  }
}

function cancelled(failure: unknown): boolean {
  const text = messageOf(failure).toLowerCase();
  return text.includes('cancel') || text.includes('12501');
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
