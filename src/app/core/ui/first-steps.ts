/**
 * "Primeros pasos" on Inicio (idea 19, mockups 44a-44e): five things a new
 * person does to get the app working for them, each ticked by itself the
 * moment it happens, never by a tap on the tick.
 *
 * Pure: the component gathers the facts, this decides which steps there are,
 * which are done and whether the card shows at all.
 */

export type StepId = 'account' | 'expense' | 'cap' | 'drive' | 'notices';

export interface StepFacts {
  accounts: number;
  /** Movements under a spending category. */
  expenses: number;
  caps: number;
  /** Signed in to Google for the copy in Drive; null where the phone cannot (a browser). */
  drive: boolean | null;
  /** A bank's app or SMS sender being read; null where the phone cannot (a browser, an iPhone). */
  notices: boolean | null;
  /** When the first account was made (`created_at`, its day), and today. */
  firstAccountOn: string | null;
  today: string;
}

export interface Step {
  id: StepId;
  done: boolean;
}

/** An app older than this is not new: its person knows the way already. */
export const NEW_FOR_DAYS = 30;

export function stepsOf(facts: StepFacts): Step[] {
  const steps: Step[] = [
    { id: 'account', done: facts.accounts > 0 },
    { id: 'expense', done: facts.expenses > 0 },
    { id: 'cap', done: facts.caps > 0 },
  ];
  if (facts.drive !== null) steps.push({ id: 'drive', done: facts.drive });
  if (facts.notices !== null) steps.push({ id: 'notices', done: facts.notices });
  return steps;
}

/** The step lit as the next one: the first not done. */
export function nextStep(steps: Step[]): StepId | null {
  return steps.find(step => !step.done)?.id ?? null;
}

/**
 * Whether the card is on Inicio: an app with an account, made in the last
 * 30 days (a backup restored keeps its accounts' own dates, so somebody
 * coming back with their history is not taught the way in), and not hidden.
 */
export function firstStepsShown(facts: StepFacts, hidden: boolean): boolean {
  if (hidden || facts.accounts === 0 || facts.firstAccountOn === null) return false;
  return daysBetween(facts.firstAccountOn, facts.today) < NEW_FOR_DAYS;
}

function daysBetween(from: string, to: string): number {
  const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((day(to) - day(from)) / 86_400_000);
}
