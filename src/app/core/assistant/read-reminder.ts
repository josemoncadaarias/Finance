/**
 * What a sentence asking for a reminder says (Jose, 2026-10-22): "recuérdame
 * pagar el arriendo el 5 de cada mes", "avísame mañana a las 9 que pague la
 * luz", "no me dejes olvidar el seguro el 15 de noviembre". By its shape, in
 * any wording - never a list of anyone's bills. The amount, the account and
 * the category are `readPhrase`'s; this reads the when and the what.
 *
 * Pure, tested in `read-reminder.test.mjs`.
 */

export interface ReminderSaid {
  /** What to be reminded of, as said: "Pagar el arriendo". */
  title: string;
  /** 'monthly', 'once', or null when the sentence did not say (asked). */
  repeat: 'monthly' | 'once' | null;
  dayOfMonth: number | null;
  onDate: string | null;
  hour: number | null;
  /** "a las 7:30": its minute; 0 when only the hour was said. */
  minute: number;
  daysBefore: number | null;
}

/** A sentence asking to be reminded of something. */
export const REMIND = /\b(recuerd\w*|recordar\w*|recordarme|avis\w*|alert\w*|hazme acordar|haz que me acuerde|que no se me olvide|no me dejes olvidar|no se me (puede|debe) olvidar|remind\w*|don'?t let me forget)\b/;
/** A question about the reminders there are. */
export const REMINDERS_LIST = /\b(que|cuales|cuantos|mis|ver)\b.*\brecordatorios?\b|\brecordatorios?\b.*\b(tengo|hay|activos)\b|\b(my|what|which)\b.*\breminders\b/;

const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAYS_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SMALL: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, siete: 7, one: 1, two: 2, three: 3 };

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function parse(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function plus(day: string, n: number): string {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** The next date with this day of the month, today included. */
export function nextDayOfMonth(today: string, day: number): string {
  const t = parse(today);
  let y = t.getUTCFullYear();
  let m = t.getUTCMonth();
  if (day < t.getUTCDate()) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return iso(new Date(Date.UTC(y, m, Math.min(day, lastDay(y, m)))));
}

export function readReminder(text: string, today: string): ReminderSaid {
  let s = ` ${fold(text).replace(/[\u00bf?\u00a1!.,;]/g, ' ').replace(/\s+/g, ' ')} `;
  const cut = (re: RegExp) => { s = s.replace(re, ' '); };
  let repeat: ReminderSaid['repeat'] = null;
  let dayOfMonth: number | null = null;
  let onDate: string | null = null;
  let hour: number | null = null;
  let minute = 0;
  let daysBefore: number | null = null;
  let m: RegExpExecArray | null;

  // The hour: "a las 9", "a las 7 de la noche", "a las 3 pm", "at 9am".
  if ((m = /\b(?:a las|a la|tipo|como a las|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a ?m|p ?m|de la manana|de la tarde|de la noche|en la manana|en la tarde|en la noche)?\b/.exec(s))) {
    let h = Number(m[1]);
    const part = m[3] ?? '';
    if (/p ?m|tarde|noche/.test(part) && h < 12) h += 12;
    if (/a ?m|manana/.test(part) && h === 12) h = 0;
    if (h >= 0 && h <= 23) hour = h;
    if (m[2] && Number(m[2]) < 60) minute = Number(m[2]);
    cut(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } else if ((m = /\b(en|por) la (manana|tarde|noche)\b|\b(in the) (morning|afternoon|evening)\b/.exec(s))) {
    const part = m[2] ?? m[4];
    hour = /manana|morning/.test(part) ? 8 : /tarde|afternoon/.test(part) ? 15 : 19;
    cut(/\b(en|por) la (manana|tarde|noche)\b|\bin the (morning|afternoon|evening)\b/);
  }

  // Days before: "un día antes", "2 días antes", "the day before".
  if ((m = /\b(\d|un|uno|una|dos|tres|cuatro|cinco|siete|one|two|three)\s+(dias?|days?)\s+(antes|before)\b/.exec(s))) {
    daysBefore = /^\d$/.test(m[1]) ? Number(m[1]) : SMALL[m[1]] ?? 1;
    cut(new RegExp(m[0]));
  } else if (/\b(el dia antes|la vispera|the day before)\b/.test(s)) {
    daysBefore = 1;
    cut(/\b(el dia antes|la vispera|the day before)\b/);
  }

  // Monthly: "cada mes", "todos los meses", "mensual", "el 5 de cada mes", "todos los 5", "cada 5".
  const monthly = /\b(cada mes|todos los meses|mes a mes|mensual\w*|every month|monthly|each month|de cada mes|of every month|of each month)\b/;
  if (monthly.test(s)) { repeat = 'monthly'; cut(monthly); }
  if ((m = /\b(?:todos los|cada)\s+(\d{1,2})\b/.exec(s))) {
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) { repeat = 'monthly'; dayOfMonth = d; cut(new RegExp(m[0])); }
  }

  // A date: "el 15 de noviembre", "15 de noviembre", "november 15", "el 3/12".
  const months = `${MONTHS.join('|')}|${MONTHS_EN.join('|')}`;
  if (!dayOfMonth && (m = new RegExp(`\\b(?:el\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+(${months})(?:\\s+de\\s+(\\d{4}))?\\b|\\b(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(s))) {
    const d = Number(m[1] ?? m[5]);
    const name = m[2] ?? m[4];
    const mi = MONTHS.indexOf(name) >= 0 ? MONTHS.indexOf(name) : MONTHS_EN.indexOf(name);
    const t = parse(today);
    let y = m[3] ? Number(m[3]) : t.getUTCFullYear();
    let candidate = iso(new Date(Date.UTC(y, mi, Math.min(d, lastDay(y, mi)))));
    if (!m[3] && candidate < today) { y += 1; candidate = iso(new Date(Date.UTC(y, mi, Math.min(d, lastDay(y, mi))))); }
    if (repeat === 'monthly') dayOfMonth = d;
    else { onDate = candidate; repeat = 'once'; }
    cut(new RegExp(m[0]));
  }

  // Relative days: "hoy", "mañana", "pasado mañana", "en 3 días", "el viernes".
  if (!onDate && !dayOfMonth) {
    if (/\bpasado manana\b/.test(s)) { onDate = plus(today, 2); cut(/\bpasado manana\b/); }
    else if (/\b(manana|tomorrow)\b/.test(s)) { onDate = plus(today, 1); cut(/\b(manana|tomorrow)\b/); }
    else if (/\b(hoy|today)\b/.test(s)) { onDate = today; cut(/\b(hoy|today)\b/); }
    else if ((m = /\b(?:en|dentro de|in)\s+(\d{1,2}|un|una|dos|tres|cuatro|cinco|siete)\s+(dias?|days?|semanas?|weeks?)\b/.exec(s))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : SMALL[m[1]] ?? 1;
      onDate = plus(today, /seman|week/.test(m[2]) ? n * 7 : n);
      cut(new RegExp(m[0]));
    } else if ((m = new RegExp(`\\b(?:el|este|el proximo|el otro|on|next)?\\s*(${DAYS.join('|')}|${DAYS_EN.join('|')})\\b`).exec(s))) {
      const target = DAYS.indexOf(m[1]) >= 0 ? DAYS.indexOf(m[1]) : DAYS_EN.indexOf(m[1]);
      const now = parse(today).getUTCDay();
      onDate = plus(today, ((target - now + 7) % 7) || 7);
      cut(new RegExp(m[0]));
    }
    if (onDate && repeat === null) repeat = 'once';
  }

  // A day of the month alone: "el 5", "el día 5", "el 30", "on the 5th".
  if (!onDate && !dayOfMonth && (m = /\b(?:el|los|del|on the|the)\s+(?:dia\s+)?(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(mil|millon|lucas?|k|pesos|%))/.exec(s))) {
    const d = Number(m[1]);
    if (d >= 1 && d <= 31) { dayOfMonth = d; cut(new RegExp(m[0])); }
  }
  if (dayOfMonth && repeat === 'once') { onDate = nextDayOfMonth(today, dayOfMonth); }

  // What is left is what to be reminded of.
  cut(REMIND);
  cut(/\b(me|que|a mi|de que|para que|porfa|por favor|please|me to|to|that i|i have to|tengo que|debo|hay que)\b/g);
  // An amount said is the reading's, not the title's.
  cut(/\$?\s*\d[\d.,]*\s*(mil|millones?|millon|lucas?|palos?|k|pesos)?\b/g);
  cut(/\b(de|por|valor de|for)\s*$/);
  let title = s.replace(/\s+/g, ' ').trim()
    .replace(/^(de|del|el|la|los|las|a|al|que|pagar de)\s+(?=\w)/, m0 => (m0.startsWith('de') || m0.startsWith('que') || m0 === 'a ' || m0 === 'al ') ? '' : m0)
    .replace(/\s+(de|del|el|la|por|para|a|al|en)$/, '');
  // Its words as the person wrote them: the original text, cut the same way.
  title = sameCase(text, title);
  return { title: title ? title.charAt(0).toUpperCase() + title.slice(1) : '', repeat, dayOfMonth, onDate, hour, minute, daysBefore };
}

/** The title's words in the case and accents the person typed them. */
function sameCase(original: string, folded: string): string {
  const words = original.split(/\s+/).map(w => w.replace(/[\u00bf?\u00a1!.,;]/g, ''));
  return folded.split(' ').map(fw => words.find(w => fold(w) === fw) ?? fw).join(' ');
}
