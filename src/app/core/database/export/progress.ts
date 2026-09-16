/**
 * How far along a long piece of work is.
 *
 * Reading a backup out of the database or writing one back in runs for seconds
 * on a phone, and a screen that says nothing for seconds reads as a screen that
 * has crashed. The work reports as it goes and the screen draws it.
 *
 * The callback may return a promise, and the work awaits it: that is how a
 * screen gets the thread back long enough to paint the bar it is drawing.
 */
export interface Progress {
  /** Units finished. Rows, or tables, depending on the work. */
  done: number;
  /** Units in total. Known before the work starts, or it would not be a bar. */
  total: number;
}

export type OnProgress = (progress: Progress) => void | Promise<void>;
