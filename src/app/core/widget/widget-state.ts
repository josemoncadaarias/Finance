/**
 * What the home-screen widget is handed (Jose, 2026-11-25, mockup `59a`):
 * pure, so its words and figures are tested without a phone.
 *
 * The widget shows Inicio's "Puedes gastar hoy" with every account
 * (`spendRoom`). It gets what is LEFT for the month and the month's last day,
 * and spreads it over the days left itself (`SpendWidget.perDayOf`, the same
 * arithmetic as `perDayOf`), so a day that passes with the app closed is
 * still right. Every word comes in the app's language.
 */
import type { SpendRoom } from '../assistant/spend-room';

export interface WidgetWords {
  title: string;
  overTitle: string;
  /** "De {left} libres hasta el {end}". */
  line: (left: string, end: string) => string;
  /** The month's last day. */
  lineOne: (left: string) => string;
  overLine: string;
  /** No income in the last three months. */
  none: string;
  /** No account yet. */
  empty: string;
  /** The month the figure was worked out for is over. */
  stale: string;
  hiddenLine: string;
  expense: string;
  income: string;
  assistant: string;
  show: string;
  hide: string;
}

export interface WidgetState {
  mode: 'ok' | 'over' | 'none';
  leftMinor: number;
  monthEnd: string;
  /** Start hidden ("Ocultar montos al abrir"). */
  hidden: boolean;
  symbol: string;
  sep: string;
  title: string;
  overTitle: string;
  overFigure: string;
  line: string;
  overLine: string;
  none: string;
  stale: string;
  hiddenLine: string;
  expense: string;
  income: string;
  assistant: string;
  show: string;
  hide: string;
}

/** "$ 702.000": whole pesos, as the widget writes its own figure. */
export function wholePesos(minor: number): string {
  const digits = String(Math.floor(Math.abs(minor) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${minor < 0 ? '−' : ''}$ ${digits}`;
}

/**
 * `room` is null with no account at all; `endLabel` is the month's last day
 * in words ("30 de noviembre").
 */
export function widgetStateOf(room: SpendRoom | null, words: WidgetWords, endLabel: string, hidden: boolean): WidgetState {
  const mode: WidgetState['mode'] = !room || room.noIncome ? 'none' : room.leftMinor < 0 ? 'over' : 'ok';
  const left = room?.leftMinor ?? 0;
  return {
    mode,
    leftMinor: left,
    monthEnd: room?.monthEnd ?? '',
    hidden,
    symbol: '$',
    sep: '.',
    title: words.title,
    overTitle: words.overTitle,
    overFigure: wholePesos(left),
    line: room && room.daysLeft <= 1 ? words.lineOne(wholePesos(left)) : words.line(wholePesos(left), endLabel),
    overLine: words.overLine,
    none: room ? words.none : words.empty,
    stale: words.stale,
    hiddenLine: words.hiddenLine,
    expense: words.expense,
    income: words.income,
    assistant: words.assistant,
    show: words.show,
    hide: words.hide,
  };
}
