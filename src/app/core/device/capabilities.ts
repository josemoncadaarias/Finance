/**
 * What this phone (or browser) can do, answered in ONE place.
 *
 * Every screen and service that offers something only some phones have asks
 * here, never `Capacitor.getPlatform()` itself (CLAUDE.md, "iOS": the same
 * "one place answers" rule as `PaywallService`). So the day the app runs on
 * an iPhone, what iOS cannot do is hidden or explained by changing this table,
 * not by hunting through forty screens.
 *
 * Pure, so `device.test.mjs` holds each platform's answers. `device.ts` reads
 * the platform once and hands out the answer for it.
 */

/** Where the app is running: Capacitor's own three answers. */
export type Platform = 'android' | 'ios' | 'web';

export interface Capabilities {
  readonly platform: Platform;
  /**
   * A phone at all, Android or iPhone: the keyboard's events, the app coming
   * back to the front, the file system and the share sheet, the app's version,
   * native HTTP with no CORS (the IPC, the SEC).
   */
  readonly native: boolean;
  /** Notices scheduled on the phone: reminders, a card's payment day, caps, the month's summary. */
  readonly localNotifications: boolean;
  /**
   * Reading other apps' notifications (bank notices). iOS lets no app read
   * another app's notifications; on an iPhone the way in will be a Shortcuts
   * automation handing the text to the app, still to build.
   */
  readonly readsNotifications: boolean;
  /** Reading the SMS inbox by sender (`READ_SMS`). iOS has no such access. */
  readonly readsSms: boolean;
  /** Reading the text of a photo or screenshot on the phone (receipts, statements, a position). */
  readonly readsImages: boolean;
  /** The phone's own dictation for the assistant (a browser asks its own API, see `speech.ts`). */
  readonly nativeVoice: boolean;
  /** Shortcuts on the app's icon (a long press). */
  readonly iconShortcuts: boolean;
  /** The "Hoy puedes gastar" widget on the home screen. */
  readonly homeWidget: boolean;
  /** Looking at the stock prices about every half hour with the app closed. */
  readonly backgroundStockWatch: boolean;
  /**
   * Google sign-in for the Drive copy and the prices' sheet. An iPhone needs
   * its own OAuth client in Google Cloud, which does not exist yet.
   */
  readonly googleSignIn: boolean;
  /** Buying Finance Pro from the store (RevenueCat holds only Google Play's key today). */
  readonly storePurchases: boolean;
}

/**
 * Each platform's answers. iOS says no to everything whose native half is
 * written only in Java today; each "false" there becomes true as its Swift
 * counterpart is written (the order is in CLAUDE.md, "iOS").
 */
const TABLE: Record<Platform, Omit<Capabilities, 'platform'>> = {
  android: {
    native: true,
    localNotifications: true,
    readsNotifications: true,
    readsSms: true,
    readsImages: true,
    nativeVoice: true,
    iconShortcuts: true,
    homeWidget: true,
    backgroundStockWatch: true,
    googleSignIn: true,
    storePurchases: true,
  },
  ios: {
    native: true,
    localNotifications: true,
    readsNotifications: false, // never: Apple allows no app to.
    readsSms: false, // never directly; a Shortcuts automation instead.
    readsImages: false, // Apple Vision, once its plugin is written.
    nativeVoice: false, // Apple's Speech framework, once its plugin is written.
    iconShortcuts: false, // Home-screen quick actions, once written.
    homeWidget: false, // A WidgetKit widget, once written.
    backgroundStockWatch: false, // iOS decides when an app wakes: not promised.
    googleSignIn: false, // Needs an iOS OAuth client in Google Cloud.
    storePurchases: false, // Needs the App Store's products in RevenueCat.
  },
  web: {
    native: false,
    localNotifications: false,
    readsNotifications: false,
    readsSms: false,
    readsImages: false,
    nativeVoice: false,
    iconShortcuts: false,
    homeWidget: false,
    backgroundStockWatch: false,
    googleSignIn: false,
    storePurchases: false,
  },
};

/** The answers for a platform; anything Capacitor does not name is a browser. */
export function capabilitiesOf(platform: string): Capabilities {
  const known: Platform = platform === 'android' || platform === 'ios' ? platform : 'web';
  return Object.freeze({ platform: known, ...TABLE[known] });
}
