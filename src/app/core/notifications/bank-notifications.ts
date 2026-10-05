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
  apps: async () => ({ apps: [] }),
  watch: async () => {},
  hide: async () => {},
  senders: async () => ({ senders: [] }),
  watchSender: async () => {},
  hideSender: async () => {},
  caught: async () => ({ caught: [] }),
  forgetCaught: async () => {},
  forgetEverything: async () => {},
};

export const BankNotifications = registerPlugin<BankNotificationsPlugin>(
  'BankNotifications', { web: nothing, ios: nothing },
);
