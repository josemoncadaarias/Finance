/**
 * Recovers the dollar amounts Jose typed into descriptions.
 *
 * Monefy could not hold foreign currency, so he wrote the real figure into the
 * note: `Transferencia a dolarapp 500 usd`. The peso amount on those rows was
 * eyeballed and is not trustworthy, but the dollars are exact — where they are
 * present at all.
 *
 * Two things stop this from being a simple regex.
 *
 * **The number is not always this row's amount.** One real row reads
 * `Bono por nueva cuenta y fondeo de 600 usd` against 400,000 COP: the 600
 * dollars is what had to be deposited to earn the bonus, not the bonus. Taken
 * at face value it would imply a rate of 667 pesos to the dollar.
 *
 * **The mention is often on the wrong side.** A transfer writes the same note
 * on both halves, so `Rappi cuenta −2,107,000 … 500 usd` carries a dollar
 * figure on a peso account. It belongs to the other leg.
 *
 * So every candidate is checked against the rate it implies. Rates derivable
 * from Jose's own file cluster between 4,214 and 4,375, and a candidate whose
 * implied rate falls outside a generous band around that is reported as
 * suspicious rather than used. Nothing here decides anything on its own: the
 * importer records both the finding and the doubt.
 */

import { parseAmountToMinor, deriveRateScaled, RATE_SCALE } from '../money';

/**
 * The band an implied rate has to fall in to be believable, as scaled
 * integers. Deliberately wide: every rate the file itself yields sits between
 * 4,214 and 4,375, so 3,000–6,000 accepts anything plausible while still
 * catching the 667 that the bonus row would produce.
 */
export const PLAUSIBLE_RATE_MIN = 3_000 * RATE_SCALE;
export const PLAUSIBLE_RATE_MAX = 6_000 * RATE_SCALE;

/**
 * A number followed by a word meaning dollars.
 *
 * Anchored on a word boundary at the front so the `50` in `XTB50` is not read
 * as an amount, and it accepts the parenthesised form `(19.03 usd)` without a
 * second pattern.
 */
const USD_PATTERN = /(?<![\w.,])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(usd|u\$s?|d[oó]lares?|d[oó]lar|dls)\b/gi;

export interface UsdMention {
  /** The dollar figure, in cents. */
  usdMinor: number;
  /** The exact text that matched, for showing in a review. */
  text: string;
}

/**
 * Every dollar figure mentioned in a description, in the order written.
 *
 * More than one is not an error; it is a reason to doubt. The caller decides.
 */
export function findUsdMentions(description: string): UsdMention[] {
  const mentions: UsdMention[] = [];

  for (const match of description.matchAll(USD_PATTERN)) {
    const [text, number] = match;
    try {
      mentions.push({ usdMinor: parseAmountToMinor(number.replace(/,/g, '')), text: text.trim() });
    } catch {
      // A number the money parser refuses - too many decimals, say - is not a
      // dollar amount worth reconstructing.
    }
  }

  return mentions;
}

export type UsdVerdict =
  /** A single mention, implying a believable rate. Use it. */
  | 'accepted'
  /** Nothing mentioned. */
  | 'absent'
  /** Several figures mentioned; which one applies is not decidable here. */
  | 'ambiguous'
  /** The implied rate is not credible, so the number means something else. */
  | 'implausible_rate'
  /** A zero or negative peso amount leaves no rate to check against. */
  | 'no_rate';

export interface UsdCandidate {
  verdict: UsdVerdict;
  /** Set when the verdict is `accepted` or `implausible_rate`. */
  usdMinor: number | null;
  /** The rate the pairing implies, scaled. Set whenever it could be worked out. */
  impliedRateScaled: number | null;
  mentions: UsdMention[];
  /** Plain-language explanation, written straight into the review queue. */
  reason: string;
}

/**
 * Judges a dollar figure found in a description against the peso amount on the
 * same row.
 *
 * `amountMinor` is the row's peso figure. Its sign is irrelevant here — only
 * the ratio matters.
 */
export function assessUsdMention(description: string, amountMinor: number): UsdCandidate {
  const mentions = findUsdMentions(description);

  if (mentions.length === 0) {
    return { verdict: 'absent', usdMinor: null, impliedRateScaled: null, mentions, reason: 'No dollar amount in the description' };
  }

  if (mentions.length > 1) {
    return {
      verdict: 'ambiguous',
      usdMinor: null,
      impliedRateScaled: null,
      mentions,
      reason: `The description mentions ${mentions.length} dollar figures (${mentions.map(m => m.text).join(', ')}); which one applies cannot be read off the text`,
    };
  }

  const [mention] = mentions;

  if (mention.usdMinor === 0 || amountMinor === 0) {
    return {
      verdict: 'no_rate',
      usdMinor: mention.usdMinor,
      impliedRateScaled: null,
      mentions,
      reason: 'One side of the pair is zero, so no rate can be checked',
    };
  }

  const impliedRateScaled = deriveRateScaled(amountMinor, mention.usdMinor);

  if (impliedRateScaled < PLAUSIBLE_RATE_MIN || impliedRateScaled > PLAUSIBLE_RATE_MAX) {
    return {
      verdict: 'implausible_rate',
      usdMinor: mention.usdMinor,
      impliedRateScaled,
      mentions,
      reason:
        `"${mention.text}" against ${(Math.abs(amountMinor) / 100).toLocaleString('en-US')} COP implies ` +
        `${(impliedRateScaled / RATE_SCALE).toLocaleString('en-US', { maximumFractionDigits: 2 })} per dollar, ` +
        'which is not a credible rate. The figure probably refers to something other than this amount',
    };
  }

  return {
    verdict: 'accepted',
    usdMinor: mention.usdMinor,
    impliedRateScaled,
    mentions,
    reason: `Read "${mention.text}" at ${(impliedRateScaled / RATE_SCALE).toLocaleString('en-US', { maximumFractionDigits: 2 })} per dollar`,
  };
}
