/**
 * The keypad does arithmetic, the way a good expense app's does.
 *
 * "Split this bill three ways" and "the groceries plus the taxi" are the two
 * things anyone does standing at a counter, and doing them in another app and
 * typing the result back is how amounts get mistyped.
 *
 * Two rules, both about not losing cents:
 *
 *   - Everything is minor units. `+` and `-` are exact integer arithmetic,
 *     which is the whole reason money is stored this way.
 *   - `×` and `÷` take their right-hand side as a *count*, not as money:
 *     `50.000 × 3` is three times fifty thousand, not fifty thousand times
 *     three thousand pesos. The result is rounded to the nearest cent, and
 *     rounding is stated rather than hidden — a third of 100 is 33,33 and the
 *     two lost cents are real.
 */

export type Operator = '+' | '-' | '×' | '÷';

export interface Pending {
  /** The left-hand side, in minor units. */
  leftMinor: number;
  operator: Operator;
}

/**
 * Applies one operation.
 *
 * `rightMinor` is the buffer's own value in minor units; for `×` and `÷` it is
 * read as the number the user typed (2,5 means two and a half), which is what
 * "times two and a half" means.
 */
export function apply(leftMinor: number, operator: Operator, rightMinor: number): number {
  switch (operator) {
    case '+':
      return leftMinor + rightMinor;

    case '-':
      return leftMinor - rightMinor;

    case '×':
      return Math.round(leftMinor * (rightMinor / 100));

    case '÷': {
      // Dividing by nothing is a slip, not an intention: keep what was there
      // rather than producing Infinity or wiping the amount.
      if (rightMinor === 0) return leftMinor;
      return Math.round(leftMinor / (rightMinor / 100));
    }
  }
}

/** True for the four keys the calculator understands. */
export function isOperator(key: string): key is Operator {
  return key === '+' || key === '-' || key === '×' || key === '÷';
}

/**
 * The keys as the physical keyboard sends them: `*` and `x` both mean times,
 * `/` means divide.
 */
export function operatorFromKey(key: string): Operator | null {
  if (key === '+') return '+';
  if (key === '-') return '-';
  if (key === '*' || key === 'x' || key === 'X' || key === '×') return '×';
  if (key === '/' || key === '÷') return '÷';
  return null;
}
