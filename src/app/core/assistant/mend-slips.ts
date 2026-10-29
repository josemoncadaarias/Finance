/**
 * Typing slips, mended (Jose, 2026-10-29: "Absir productos de rappi cuenta";
 * and then: "no es solo esa palabra, pueden ser demasiadas"). People do not
 * type perfectly, so the assistant's vocabulary is not a list somebody keeps:
 * it is every word its own patterns read a meaning from, worked out of the
 * patterns themselves - each alternative, each verb ending, each optional
 * letter - plus the stems a pattern takes any ending after ("rendimient...").
 * A new question added to the assistant brings its words with it.
 *
 * Pure: no Angular, tested by `run-tests.mjs`.
 */

export interface Vocabulary {
  /** Whole words, folded, four letters or more. */
  words: ReadonlySet<string>;
  /** Stems a pattern takes any ending after, four letters or more. */
  stems: readonly string[];
}

// ---------------------------------------------------------------------------
// Words out of a pattern
// ---------------------------------------------------------------------------

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'gap' }
  | { kind: 'any' }
  | { kind: 'group'; options: Node[][] }
  | { kind: 'maybe'; node: Node };

const CAP = 4000;
const MIN = 4;

/**
 * The words a set of patterns read. Only what a regular expression of this
 * module's shape uses is understood: literals, groups and alternatives,
 * classes of letters, `?`, `\w*` and gaps (`.*`, spaces, `\s`). Anything else
 * counts as a gap, which only ever loses a word, never invents one.
 */
export function vocabularyOf(patterns: readonly RegExp[], extra: readonly string[] = []): Vocabulary {
  const words = new Set<string>();
  const stems = new Set<string>();
  const keep = (piece: string) => {
    if (piece === '' || piece.startsWith('*')) return;
    const star = piece.indexOf('*');
    if (star >= 0) {
      const stem = piece.slice(0, star);
      if (stem.length >= MIN && /^[a-z\u00f1]+$/.test(stem)) stems.add(stem);
      return;
    }
    if (piece.length >= MIN && /^[a-z\u00f1]+$/.test(piece)) words.add(piece);
  };
  for (const pattern of patterns) {
    const [node] = parse(pattern.source, 0);
    const out = new Set<string>();
    for (const tail of expand(node, out)) for (const piece of tail.split(' ')) keep(piece);
    for (const piece of out) keep(piece);
  }
  for (const word of extra) keep(word);
  return { words, stems: [...stems].sort((a, b) => b.length - a.length) };
}

/** A sequence, up to `)` or the end; returns it as a group of its alternatives. */
function parse(source: string, at: number): [Node, number] {
  const options: Node[][] = [[]];
  let i = at;
  const push = (node: Node) => options[options.length - 1].push(node);
  while (i < source.length) {
    const c = source[i];
    if (c === ')') break;
    if (c === '|') { options.push([]); i++; continue; }
    let node: Node;
    if (c === '(') {
      i++;
      if (source[i] === '?') {
        // (?: ...) is a plain group; a look-around reads no word.
        const look = source[i + 1] !== ':';
        i += source[i + 1] === '<' ? 3 : 2;
        const [inner, end] = parse(source, i);
        i = end + 1;
        node = look ? { kind: 'gap' } : inner;
      } else {
        const [inner, end] = parse(source, i);
        i = end + 1;
        node = inner;
      }
    } else if (c === '\\') {
      const e = source[i + 1];
      i += 2;
      if (e === 'b' || e === 'B') continue;
      if (e === 'w') {
        // \w* or \w+: any ending.
        if (source[i] === '*' || source[i] === '+') i++;
        node = { kind: 'any' };
        push(node);
        continue;
      }
      node = { kind: 'gap' };
    } else if (c === '[') {
      const end = source.indexOf(']', i + 1);
      const inside = source.slice(i + 1, end < 0 ? source.length : end);
      i = end < 0 ? source.length : end + 1;
      node = /^[a-z\u00f1]+$/.test(inside) && inside.length <= 6
        ? { kind: 'group', options: [...inside].map(letter => [{ kind: 'text', text: letter } as Node]) }
        : { kind: 'gap' };
    } else if (c === '^' || c === '$') {
      i++;
      continue;
    } else if (c === '.') {
      i++;
      node = { kind: 'gap' };
    } else if (/[a-z\u00f1']/.test(c)) {
      i++;
      node = { kind: 'text', text: c === "'" ? '' : c };
    } else {
      i++;
      node = { kind: 'gap' };
    }
    // What follows the atom.
    const q = source[i];
    if (q === '?') { i++; node = { kind: 'maybe', node }; }
    else if (q === '*' || q === '+') { i++; node = node.kind === 'gap' ? node : { kind: 'maybe', node }; }
    else if (q === '{') { const end = source.indexOf('}', i); i = end < 0 ? source.length : end + 1; }
    push(node);
  }
  return [{ kind: 'group', options }, i];
}

/** Keeps the words a string has finished, and only its two open ends. */
function squeeze(text: string, out: Set<string>): string {
  const parts = text.split(' ');
  if (parts.length <= 2) return text;
  for (const middle of parts.slice(1, -1)) out.add(middle);
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Every string a node reads, gaps as spaces and any ending as `*`. */
function expand(node: Node, out: Set<string>): string[] {
  switch (node.kind) {
    case 'text': return [node.text];
    case 'gap': return [' '];
    case 'any': return ['*'];
    case 'maybe': return [...new Set(['', ...expand(node.node, out)])];
    case 'group': {
      const all = new Set<string>();
      for (const sequence of node.options) {
        let current = new Set<string>(['']);
        for (const part of sequence) {
          const next = new Set<string>();
          const tails = expand(part, out);
          for (const head of current) {
            for (const tail of tails) {
              next.add(squeeze(head + tail, out));
              if (next.size >= CAP) break;
            }
            if (next.size >= CAP) break;
          }
          current = next;
        }
        for (const one of current) { all.add(one); if (all.size >= CAP) break; }
      }
      return [...all];
    }
  }
}

// ---------------------------------------------------------------------------
// Slips
// ---------------------------------------------------------------------------

/**
 * How many slips apart two words are: a letter changed, added or left out,
 * or two side by side swapped (optimal string alignment).
 */
export function slipsBetween(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Slips allowed in a word of this length: none under 4, one to 8, two from 9. */
function allowedFor(length: number): number {
  return length < MIN ? 0 : length >= 9 ? 2 : 1;
}

/** Whether the vocabulary already reads this word. */
export function knows(word: string, vocabulary: Vocabulary): boolean {
  return vocabulary.words.has(word) || vocabulary.stems.some(stem => word.startsWith(stem));
}

/**
 * The words a slip of `word` may have meant, nearest first: a word of the
 * vocabulary, or a stem with the word's own ending after it. Never a word
 * with another first letter (that is another word, not a slip), and a word
 * of four letters only by a letter changed or swapped, never one added or
 * left out ("meta" is not "metas"'s slip, it is its own word).
 */
export function slipsOf(word: string, vocabulary: Vocabulary): { word: string; slips: number }[] {
  const allowed = allowedFor(word.length);
  if (allowed === 0 || knows(word, vocabulary)) return [];
  // Slips, plus half a slip for a stem's ending: a whole word the assistant
  // knows beats a stem with the typed ending kept, when both are as near.
  const found = new Map<string, number>();
  const offer = (meant: string, slips: number) => {
    if (slips > 0 && Math.floor(slips) <= allowed && (found.get(meant) ?? Infinity) > slips) found.set(meant, slips);
  };
  for (const known of vocabulary.words) {
    if (known[0] !== word[0] || Math.abs(known.length - word.length) > allowed) continue;
    if (word.length === MIN && known.length !== MIN) continue;
    offer(known, slipsBetween(word, known));
  }
  for (const stem of vocabulary.stems) {
    if (stem[0] !== word[0]) continue;
    // The stem's own slips, inside the word's first letters.
    const room = allowedFor(stem.length);
    for (let cut = stem.length - room; cut <= stem.length + room; cut++) {
      if (cut < 1 || cut > word.length) continue;
      const slips = slipsBetween(word.slice(0, cut), stem);
      if (slips <= room) offer(stem + word.slice(cut), slips + 0.5);
    }
  }
  return [...found.entries()].sort((one, other) => one[1] - other[1] || one[0].localeCompare(other[0]))
    .map(([meant, slips]) => ({ word: meant, slips }));
}
