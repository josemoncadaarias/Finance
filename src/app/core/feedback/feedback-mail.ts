/**
 * The mail a report, an idea or a question becomes (Jose, 2026-10-22): the
 * person's own words, and only what they choose to add under them - the
 * phone's details and what the reader made of the last photo. The app has no
 * server, so nothing is sent from here: the person's own mail app opens with
 * it written, addressed to Jadex Labs, and they send it themselves.
 * Pure, tested in `feedback-mail.test.mjs`.
 */

export type FeedbackKind = 'bug' | 'idea' | 'question';

/** Where reports, ideas and questions go: Jadex Labs, who makes the app. */
export const FEEDBACK_TO = 'jadex.apps@gmail.com';

/** The words of the mail, in the app's language. */
export interface FeedbackWords {
  /** "Fallo", "Mejora", "Pregunta" by kind. */
  kind: Record<FeedbackKind, string>;
  /** Heading of the phone's details. */
  device: string;
  /** Heading of what was read from the last photo. */
  reading: string;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  text: string;
  /** "1.0.1133", or null in a browser. */
  version: string | null;
  /** Each line of the phone's details, when the person keeps them in. */
  device?: readonly string[];
  /** What the reader made of the last photo, as text, when kept in. */
  reading?: string | null;
}

export interface FeedbackMail {
  to: string;
  subject: string;
  body: string;
  /** The `mailto:` link that opens the person's mail app with all of it. */
  href: string;
}

export function feedbackMail(input: FeedbackInput, words: FeedbackWords): FeedbackMail {
  const subject = `[Finance] ${words.kind[input.kind]}${input.version ? ` · v${input.version}` : ''}`;
  const parts = [input.text.trim()];
  if (input.device && input.device.length > 0) parts.push(`— ${words.device} —\n${input.device.join('\n')}`);
  if (input.reading) parts.push(`— ${words.reading} —\n${input.reading}`);
  const body = parts.join('\n\n');
  const href = `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to: FEEDBACK_TO, subject, body, href };
}
