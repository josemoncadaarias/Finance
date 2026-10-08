/**
 * What a bank's own notification says, as Android hands it over.
 *
 * The first step of rule 22, and only that: read what Jose's banks actually
 * post and show it raw for a few days, interpreting nothing. Half of them may
 * say "open the app to see", and that is worth knowing before a single parser
 * is written.
 *
 * **This is the one Android-only corner of the app.** iOS does not let an app
 * read another app's notifications at all, and no design changes that, so
 * everything here answers `supported: false` everywhere else and every screen
 * asks that first. Not supported is an ordinary state, never an error, and
 * nothing else in the app may depend on this existing.
 */

import { registerPlugin } from '@capacitor/core';

/** An app the phone has been seen posting notifications from. */
export interface SeenApp {
  /** Android's own id for it, e.g. com.nequi.MobileApp. */
  package: string;
  /** What a person would recognise it as. */
  label: string;
  /** How many notifications it has posted since this was switched on. */
  count: number;
  first: number;
  last: number;
  /** True while what it says is being kept, not only that it posted. */
  watched: boolean;
  /** Put away by the person: not counted, not listed, until shown again. */
  hidden: boolean;
  /**
   * It posts conversations (SMS, chats): what it says is chosen by sender,
   * never for the whole app, which would keep every personal message.
   */
  messaging?: boolean;
  /**
   * For a messaging app, how many of its messages arrived with no words the
   * app could read (the phone or the app hid them), with words but no money,
   * and with money. Counted since 2026-10-02; nothing they said is kept.
   */
  blank?: number;
  plain?: number;
  money?: number;
}

/**
 * A sender inside a messaging app - a bank's SMS short code or name - that
 * has sent something shaped like money. Learned from the phone itself, never
 * from a list of banks; nothing it said is kept until it is ticked.
 */
export interface SeenSender {
  package: string;
  /** The messaging app's name. */
  app: string;
  /** As the phone shows it: "Bancolombia", "891333". */
  sender: string;
  /** Messages shaped like money since it was first seen. */
  count: number;
  first: number;
  last: number;
  watched: boolean;
  hidden: boolean;
}

/** What the listener is handed, never a word of it (the diagnosis, 2026-10-05). */
export interface SeenNow {
  package: string;
  app: string;
  postedAt: number;
  category: string;
  conversation: boolean;
  messages: boolean;
  ongoing: boolean;
  summary: boolean;
  words: boolean;
  money: boolean;
  hidden: boolean;
  smsApp: boolean;
}

/** The source of senders read straight from the SMS inbox, not an app. */
export const SMS_INBOX = 'sms';

export interface Diagnosis {
  /** Whether Android has the listener bound right now. */
  bound: boolean;
  /** The phone's SMS app, as Android names it; empty when it does not say. */
  defaultSms: string;
  /** What sits in the status bar now. */
  active: SeenNow[];
  /** The last apps it was handed something from, oldest first. */
  recent: { package: string; app: string; at: number; conversation: boolean }[];
}

/** One notification, exactly as it was posted. Nothing is read into it. */
export interface CaughtNotification {
  package: string;
  app: string;
  title: string;
  text: string;
  /** When Android says it was posted, in milliseconds. */
  postedAt: number;
  /** Set for a message of a messaging app: who sent it. */
  sender?: string;
}

export interface BankNotificationsPlugin {
  /** False everywhere but Android, and then nothing else here is called. */
  isSupported(): Promise<{ supported: boolean }>;
  /**
   * Whether the person has given this app notification access - and, since
   * allowed is not listening, when Android last handed one over and when it
   * last connected or dropped the listener (milliseconds, 0 for never).
   * Asking also asks Android to reconnect a listener it dropped.
   */
  isEnabled(): Promise<{ enabled: boolean; heardAt?: number; connectedAt?: number; disconnectedAt?: number }>;
  /** Opens the Android screen where that access is given. */
  openSettings(): Promise<void>;
  /** Opens this app's own notification settings (posting "Movimiento detectado"). */
  openAlertSettings(): Promise<void>;
  /**
   * Whether the app may read the SMS inbox. Only the words of senders the
   * person ticks are ever read; the list of senders comes from addresses
   * alone (`SmsInbox.java`). Its senders and messages come back through
   * `senders` and `caught` under the package `sms`.
   */
  smsAccess(): Promise<{ granted: boolean }>;
  /** Android's own dialog for it. */
  askSms(): Promise<{ granted: boolean }>;
  /** Which apps have posted, with no word of what they said. */
  apps(): Promise<{ apps: SeenApp[] }>;
  /** Starts or stops keeping what one app says. */
  watch(options: { package: string; on: boolean }): Promise<void>;
  /** Hides an app for good (and drops what was kept from it), or shows it again. */
  hide(options: { package: string; on: boolean }): Promise<void>;
  /** Senders of messaging apps that sent something shaped like money. */
  senders(): Promise<{ senders: SeenSender[] }>;
  /** Starts or stops keeping what one sender says. */
  watchSender(options: { package: string; sender: string; on: boolean }): Promise<void>;
  /** Hides a sender (and drops what was kept from it), or shows it again. */
  hideSender(options: { package: string; sender: string; on: boolean }): Promise<void>;
  /** Everything kept so far. */
  caught(): Promise<{ caught: CaughtNotification[] }>;
  forgetCaught(): Promise<void>;
  forgetEverything(): Promise<void>;
  /** What the listener is being handed right now, and lately. */
  diagnose(): Promise<Diagnosis>;
  /**
   * What "Movimiento detectado" asked to open, once: a message as JSON
   * (`source`, `text`, `at`), "review" for several, or '' when the app was
   * opened any other way.
   */
  takeOpen(): Promise<{ open: string }>;
  /** The app has read what was waiting: the phone's notice goes away. */
  clearAlerts(): Promise<void>;
  /** Messages thrown away from the notice, never to be proposed (the last two hundred). */
  dismissed(): Promise<{ dismissed: { source: string; text: string; at: number }[] }>;
  /**
   * What became of each message handed to "Movimiento detectado" - shown, or
   * why not - with no words of it, and whether Android lets it show at all
   * (the app's notices and their channel).
   */
  alertLog(): Promise<{ log: AlertNote[]; allowed: boolean; unrestricted?: boolean }>;
  /** Opens this app's page in Android's settings (battery, autostart). */
  openAppSettings(): Promise<void>;
}

/** What became of one message at the phone's notice. */
export interface AlertNote {
  source: string;
  at: number;
  /** shown, same (rang already for another source), off, empty, notMovement, noMoney, noAmount, error. */
  reason: string;
  detail?: string;
  /** When the app was handed the message; long after `at` means it was frozen. */
  heard?: number;
}

/**
 * The web stands in for itself rather than pretending.
 *
 * A browser has no such thing, so every question answers "no" and none of the
 * others is ever reached. It exists so that `ionic serve` runs the same code
 * the phone runs instead of a screen nobody can open.
 */
const nothing: BankNotificationsPlugin = {
  isSupported: async () => ({ supported: false }),
  isEnabled: async () => ({ enabled: false }),
  openSettings: async () => {},
  openAlertSettings: async () => {},
  openAppSettings: async () => {},
  smsAccess: async () => ({ granted: false }),
  askSms: async () => ({ granted: false }),
  apps: async () => ({ apps: [] }),
  watch: async () => {},
  hide: async () => {},
  senders: async () => ({ senders: [] }),
  watchSender: async () => {},
  hideSender: async () => {},
  caught: async () => ({ caught: [] }),
  forgetCaught: async () => {},
  forgetEverything: async () => {},
  diagnose: async () => ({ bound: false, defaultSms: '', active: [], recent: [] }),
  takeOpen: async () => ({ open: '' }),
  clearAlerts: async () => {},
  dismissed: async () => ({ dismissed: [] }),
  alertLog: async () => ({ log: [], allowed: true }),
};

export const BankNotifications = registerPlugin<BankNotificationsPlugin>(
  'BankNotifications', { web: nothing, ios: nothing },
);
