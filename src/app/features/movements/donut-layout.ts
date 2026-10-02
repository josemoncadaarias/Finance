/**
 * The spending donut's geometry and colours (mockups `16i`-`16m`, chosen by
 * Jose on 2026-10-02).
 *
 * Pure: shares in, slices, the place of each icon round the ring and the
 * right-angled line from each slice to its icon out. Nothing here draws.
 *
 * **Colours.** The chart has a palette of its own - eight colours checked
 * against the dark and the light card for lightness, colour-blind separation
 * and contrast - and never more: a ninth would be a guess, so beyond eight
 * the smallest categories fold into one grey "N categorías más". Each
 * category takes the chart colour nearest its own, the largest choosing
 * first; one whose colour is already taken in this chart, or that has none
 * (the schema's default grey, or only a picture), takes the first one free.
 * So no two slices ever share a colour, and a category tends to keep its
 * colour from one month to the next.
 *
 * **Places.** Twelve round the ring - four above, two on each side, four
 * below - so the icons use all the room round it (Jose). Each takes a place
 * of its own in the ring's order, as near its own slice as the others allow.
 *
 * **Lines.** Right angles only (Jose). A line leaves the ring moving away
 * from the centre - such a move never crosses the ring - runs along a lane of
 * its own between the ring and the icons, and enters the icon from the side
 * that faces the ring: under the percent for the row above, over the icon for
 * the row below, the inner side for the two columns. The lines that travel
 * least get the lanes nearest the ring, which keeps them from crossing.
 */

/** The chart's colours, dark card and light card, in the order handed out. */
export const CHART_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const CHART_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
/** "The rest", never a colour of its own. */
export const REST_DARK = '#5b6782';
export const REST_LIGHT = '#a7b0c2';
/** How many categories get a colour; the rest are one grey slice. */
export const MAX_NAMED = CHART_DARK.length;

/** The box everything is laid out in; the screen scales it to its width. */
export const BOX_W = 356;
export const BOX_H = 360;
const CX = BOX_W / 2;
const CY = BOX_H / 2;
export const R_IN = 62;
export const R_OUT = 92;

/** What a category brings to the choice of its colour. */
export interface ColourWish {
  /** Its own colour (`#rrggbb`), or null when it has none worth matching. */
  own: string | null;
}

/**
 * The chart colour of each category, as an index into the palette.
 * `wishes` come largest first; the largest choose first.
 */
export function chartColours(wishes: readonly ColourWish[]): number[] {
  const taken = new Set<number>();
  const out: number[] = new Array(wishes.length).fill(-1);
  // Those with a colour of their own pick the nearest one free.
  wishes.forEach((wish, i) => {
    if (!wish.own) return;
    const lab = oklab(wish.own);
    if (!lab) return;
    let best = -1, bestDistance = Infinity;
    CHART_DARK.forEach((hex, k) => {
      if (taken.has(k)) return;
      const d = distance(lab, oklab(hex)!);
      if (d < bestDistance) { bestDistance = d; best = k; }
    });
    if (best >= 0) { out[i] = best; taken.add(best); }
  });
  // The rest take the first free, in the palette's order.
  out.forEach((value, i) => {
    if (value >= 0) return;
    const free = CHART_DARK.findIndex((_, k) => !taken.has(k));
    out[i] = free >= 0 ? free : i % CHART_DARK.length;
    taken.add(out[i]);
  });
  return out;
}

/** One slice of the ring, in degrees clockwise from the top. */
export interface ArcPart { a0: number; a1: number; mid: number; }

/** A place round the ring. */
export interface Spot { x: number; y: number; angle: number; }

export interface DonutLayout {
  arcs: ArcPart[];
  /** Where each slice's icon sits (its centre). */
  spots: Spot[];
  /** Each slice's line, as an SVG path, and the dot where it leaves the ring. */
  lines: string[];
  dots: [number, number][];
}

const SLOTS: Spot[] = [[54, 30], [140, 30], [216, 30], [302, 30], [326, 132], [326, 228],
  [302, 330], [216, 330], [140, 330], [54, 330], [30, 228], [30, 132]]
  .map(([x, y]) => ({ x, y, angle: (Math.atan2(x - CX, -(y - CY)) * 180 / Math.PI + 360) % 360 }))
  .sort((a, b) => a.angle - b.angle);

export const SPOT_COUNT = SLOTS.length;

export function pointAt(radius: number, degrees: number): [number, number] {
  const r = degrees * Math.PI / 180;
  return [CX + radius * Math.sin(r), CY - radius * Math.cos(r)];
}

/** The ring as a filled path from `a0` to `a1` degrees, `gap` taken off each end. */
export function arcPath(a0: number, a1: number, outer = R_OUT, gap = 0.8): string {
  const from = a0 + gap, to = Math.max(a1 - gap, from + 0.2);
  const [x0, y0] = pointAt(outer, from), [x1, y1] = pointAt(outer, to);
  const [x2, y2] = pointAt(R_IN, to), [x3, y3] = pointAt(R_IN, from);
  const big = to - from > 180 ? 1 : 0;
  if (to - from >= 359.5) {
    // One category is all of it: two half rings, since an arc cannot close on itself.
    return `${arcPath(0, 180, outer, 0)} ${arcPath(180, 360, outer, 0)}`;
  }
  return `M${f(x0)} ${f(y0)} A${outer} ${outer} 0 ${big} 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${R_IN} ${R_IN} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`;
}

/** Everything about the ring, from each slice's share (they need not add to 1). */
export function layoutDonut(shares: readonly number[]): DonutLayout {
  const total = shares.reduce((sum, share) => sum + Math.max(share, 0), 0) || 1;
  let acc = 0;
  const arcs = shares.map(share => {
    const a0 = acc / total * 360;
    acc += Math.max(share, 0);
    const a1 = acc / total * 360;
    return { a0, a1, mid: (a0 + a1) / 2 };
  });
  const spots = placeIcons(arcs.map(arc => arc.mid));
  const mids = arcs.map(arc => arc.mid);
  const lanes = laneOf(mids, spots);
  const lines = mids.map((mid, i) => pathOf(routePoints(mid, spots[i], lanes[i])));
  const dots = arcs.map(arc => pointAt(R_OUT + 6, arc.mid));
  return { arcs, spots, lines, dots };
}

/**
 * Where each icon goes: spread evenly round all twelve places in the ring's
 * order, turned to sit nearest their slices (Jose: use all the room). Where
 * every even spread makes two lines cross - a few small slices bunched on one
 * side of a big one - each icon takes instead the place nearest its slice that
 * keeps the order (`nearestPlaces`).
 */
export function placeIcons(mids: readonly number[]): Spot[] {
  const n = mids.length, m = SLOTS.length;
  if (n === 0) return [];
  if (n > m) throw new Error(`At most ${m} icons round the ring`);
  const even: { spots: Spot[]; cost: number }[] = [];
  for (let k = 0; k < m; k++) {
    const spots = mids.map((_, i) => SLOTS[(k + Math.round(i * m / n)) % m]);
    even.push({ spots, cost: mids.reduce((sum, mid, i) => sum + angularGap(mid, spots[i].angle), 0) });
  }
  even.sort((p, q) => p.cost - q.cost);
  const candidates = [...even.map(e => e.spots), nearestPlaces(mids)];
  let best = candidates[0], fewest = Infinity;
  for (const spots of candidates) {
    const crossings = crossingsOf(mids, spots);
    if (crossings < fewest) { fewest = crossings; best = spots; }
    if (crossings === 0) break;
  }
  return best;
}

/**
 * Each icon on a place of its own, in the ring's order, with the least sum of
 * squared angular gaps over every order-keeping assignment (twelve places at
 * most, so it is instant). Squared, so one icon far from its slice costs more
 * than several a little off.
 */
export function nearestPlaces(mids: readonly number[]): Spot[] {
  const n = mids.length, m = SLOTS.length;
  let best: Spot[] = [], bestCost = Infinity;
  for (let k = 0; k < m; k++) {
    // cost[i][j]: items 0..i placed, item i on place k + j.
    const cost: number[][] = [], from: number[][] = [];
    for (let i = 0; i < n; i++) {
      cost.push(new Array(m).fill(Infinity));
      from.push(new Array(m).fill(-1));
      for (let j = i; j <= m - n + i; j++) {
        const own = angularGap(mids[i], SLOTS[(k + j) % m].angle) ** 2;
        if (i === 0) { cost[i][j] = own; continue; }
        for (let p = i - 1; p < j; p++) {
          const c = cost[i - 1][p] + own;
          if (c < cost[i][j]) { cost[i][j] = c; from[i][j] = p; }
        }
      }
    }
    let j = cost[n - 1].indexOf(Math.min(...cost[n - 1]));
    if (cost[n - 1][j] >= bestCost) continue;
    bestCost = cost[n - 1][j];
    const chosen: Spot[] = new Array(n);
    for (let i = n - 1; i >= 0; i--) { chosen[i] = SLOTS[(k + j) % m]; j = from[i][j]; }
    best = chosen;
  }
  return best;
}

/** How many times the lines to these places cross one another. */
export function crossingsOf(mids: readonly number[], spots: readonly Spot[]): number {
  const lanes = laneOf(mids, spots);
  const paths = mids.map((mid, i) => routePoints(mid, spots[i], lanes[i]));
  let count = 0;
  // A line through the ring is worse than any crossing.
  for (const path of paths) {
    for (let a = 1; a < path.length; a++) if (nearCentre(path[a - 1], path[a]) < R_OUT + 3) count += 100;
  }
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      for (let a = 1; a < paths[i].length; a++) {
        for (let b = 1; b < paths[j].length; b++) {
          if (segmentsCross(paths[i][a - 1], paths[i][a], paths[j][b - 1], paths[j][b])) count++;
        }
      }
    }
  }
  return count;
}

function segmentsCross(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const side = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const d1 = side(q1, q2, p1), d2 = side(q1, q2, p2), d3 = side(p1, p2, q1), d4 = side(p1, p2, q2);
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  // Two lines running along each other are as bad as a crossing.
  if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
    const overlap = (a: number, b: number, c: number, d: number) =>
      Math.min(Math.max(a, b), Math.max(c, d)) - Math.max(Math.min(a, b), Math.min(c, d)) > 0.5;
    return overlap(p1[0], p2[0], q1[0], q2[0]) || overlap(p1[1], p2[1], q1[1], q2[1]);
  }
  return false;
}

type Pt = [number, number];

/** How near the centre a segment passes. */
function nearCentre(a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((CX - a[0]) * dx + (CY - a[1]) * dy) / len));
  return Math.hypot(a[0] + t * dx - CX, a[1] + t * dy - CY);
}

type Side = 'top' | 'bottom' | 'left' | 'right';

function sideOf(spot: Spot): Side {
  if (spot.y < 80) return 'top';
  if (spot.y > BOX_H - 80) return 'bottom';
  return spot.x < CX ? 'left' : 'right';
}

function laneOf(mids: readonly number[], spots: readonly Spot[]): { lane: number; side: Side }[] {
  const out: { lane: number; side: Side }[] = new Array(mids.length);
  const bySide = new Map<Side, { i: number; travel: number }[]>();
  mids.forEach((mid, i) => {
    const side = sideOf(spots[i]);
    const [sx, sy] = pointAt(R_OUT + 6, mid);
    const travel = side === 'top' || side === 'bottom' ? Math.abs(spots[i].x - sx) : Math.abs(spots[i].y - 8 - sy);
    bySide.set(side, [...(bySide.get(side) ?? []), { i, travel }]);
  });
  for (const [side, list] of bySide) {
    list.sort((p, q) => p.travel - q.travel).forEach((item, lane) => { out[item.i] = { lane, side }; });
  }
  return out;
}

/** A bend shorter than this is a kink, not a corner: the line goes straight, still inside the icon's width. */
const JOG = 12;

function routePoints(mid: number, spot: Spot, { lane, side }: { lane: number; side: Side }): Pt[] {
  const [sx, sy] = pointAt(R_OUT + 6, mid);
  let pts: Pt[];
  if (side === 'top') {
    const ay = spot.y + 38, y = ay + 6 + lane * 6;
    pts = Math.abs(spot.x - sx) < JOG ? [[sx, sy], [sx, ay]] : [[sx, sy], [sx, y], [spot.x, y], [spot.x, ay]];
  } else if (side === 'bottom') {
    const ay = spot.y - 28, y = ay - 6 - lane * 6;
    pts = Math.abs(spot.x - sx) < JOG ? [[sx, sy], [sx, ay]] : [[sx, sy], [sx, y], [spot.x, y], [spot.x, ay]];
  } else {
    const dir = side === 'right' ? 1 : -1, ax = spot.x - dir * 22, ay = spot.y - 8, x = ax - dir * (6 + lane * 6);
    pts = Math.abs(ay - sy) < JOG ? [[sx, sy], [ax, sy]] : [[sx, sy], [x, sy], [x, ay], [ax, ay]];
  }
  return pts.filter((p, j) => j === 0 || Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1]) > 0.5);
}

function pathOf(pts: readonly Pt[]): string {
  // Rounded corners, so it reads as one line and not three.
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let j = 1; j < pts.length - 1; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], [x2, y2] = pts[j + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1), r = Math.min(6, l1 / 2, l2 / 2);
    d += ` L${f(x1 - (x1 - x0) / l1 * r)} ${f(y1 - (y1 - y0) / l1 * r)} Q${f(x1)} ${f(y1)} ${f(x1 + (x2 - x1) / l2 * r)} ${f(y1 + (y2 - y1) / l2 * r)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${f(last[0])} ${f(last[1])}`;
}

function angularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function f(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// OKLab, to tell how near two colours look.
function oklab(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s];
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  // Hue and chroma matter more than lightness here: the chart's colours all
  // sit at one lightness, the category's may not.
  return Math.hypot((a[0] - b[0]) * 0.5, a[1] - b[1], a[2] - b[2]);
}
