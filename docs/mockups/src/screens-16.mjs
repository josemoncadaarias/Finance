// Group 16 - the spending donut on Inicio, redrawn (2026-10-02, for Jose to
// choose). His complaint, from the phone: colours repeat between categories,
// and a category with a picture of its own (Didi's logo) has a slice of an
// unrelated colour. Every figure is from his screenshot: 358 mil spent,
// 48/21/10/9/7 % and "2 categorías más" 4 %; the amounts are worked out from
// those, the two hidden categories are invented.
//
// The chart colours are a palette of their own, validated for the dark
// surface (lightness band, colour-blind separation, contrast): blue, orange,
// aqua, yellow, magenta, and grey only for "the rest". Each category keeps
// the chart colour nearest its own (Restaurante orange, Salud blue); one
// whose colour is already taken in this chart, or that has none (Transporte,
// the default grey) or only a picture (Didi), gets the next one free. Inside
// the chart's card the icon wears its slice's colour, and a picture gets a
// ring of it, so a row and its slice cannot be told apart.
import { ic, sq, tint, tabs, status, periodBar } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const BLUE = '#3987e5', ORANGE = '#d95926', AQUA = '#199e70', YELLOW = '#c98500', MAGENTA = '#d55181';
// Restaurante, Salud, Transporte, Celulares, Didi - in the order above.
const SERIES = [ORANGE, BLUE, AQUA, YELLOW, MAGENTA];
const REST = '#5b6782';

// The categories, largest first.
const DIDI = (size, ring = '') => `<span class="sq" style="display:grid;place-items:center;width:${size}px;height:${size}px;background:#ff5a1f;color:#fff;font-weight:800;font-size:${size * .27}px;letter-spacing:-.3px;${ring ? `box-shadow:0 0 0 2px var(--s1),0 0 0 4.5px ${ring}` : ''}">DiDi</span>`;
const CATS = [
  { name: 'Restaurante', ic: 'restaurant-outline', own: '#ff9152', amt: '171.840', p: 48 },
  { name: 'Salud', ic: 'pulse-outline', own: '#4cb8f5', amt: '75.180', p: 21 },
  { name: 'Transporte particular', ic: 'car-outline', own: '#8c9bb5', amt: '35.800', p: 10 },
  { name: 'Celulares', ic: 'phone-portrait-outline', own: '#2ec4b6', amt: '32.220', p: 9 },
  { name: 'Didi', image: true, amt: '25.060', p: 7 },
];
const MORE = [
  { name: 'Mascotas', ic: 'paw-outline', own: '#d4a373', amt: '9.800', p: 3 },
  { name: 'Parqueadero', ic: 'car-sport-outline', own: '#9b7bff', amt: '4.520', p: 1 },
];
// The icon as the category has it (today), or in its slice's colour (the chart).
const own = (c, s) => c.image ? DIDI(s) : sq(c.ic, c.own, s);
const inChart = (c, color, s) => c.image ? DIDI(s, color) : sq(c.ic, color, s);
const restIcon = s => `<span class="sq" style="display:grid;place-items:center;width:${s}px;height:${s}px;background:var(--s3);color:var(--mu);font-size:${s * .32}px">+2</span>`;

// A ring of slices, each with a small gap. `on` dims every slice but one.
const ring = (parts, { size = 206, width = 30, on = -1, start = 0 } = {}) => {
  const r = 40, sw = width * 100 / size, C = 2 * Math.PI * r, gap = .9;
  let off = 0;
  const arcs = parts.map(([p, c], i) => {
    const len = Math.max(p / 100 * C - gap, .4);
    const s = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${c}" stroke-width="${i === on ? sw + 4 : sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" opacity="${on < 0 || i === on ? 1 : .22}"/>`;
    off += p / 100 * C;
    return s;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="transform:rotate(${start - 90}deg);flex:none;overflow:visible">${arcs}</svg>`;
};

const PARTS = [...CATS.map((c, i) => [c.p, SERIES[i]]), [4, REST]];
const head = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Todas las cuentas ${ic('chevron-down-outline', '', 'width:16px;height:16px;vertical-align:-2px;color:var(--mu)')}</h1></div></div>`;
const seg = `<div class="seg" style="margin:10px 0 12px"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 31</div></div>`;
const label = (t, rec = false) => `<div style="display:flex;justify-content:center;margin:4px 0 2px"><span class="tag" style="background:${tint(rec ? '#34c98b' : '#8c9bb5', .18)};color:${rec ? '#34c98b' : '#aab6d3'};font-size:12.5px;padding:5px 12px">${t}</span></div>`;
const screen = (tag, body) => `${head}<main>${tag}${periodBar('Octubre 2026', 6)}${seg}${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// One row of the list under a chart: the category's own icon (its colours,
// untouched), name, amount and percent, and under it a bar of its share in
// the colour of its slice - that bar is what ties the row to the chart.
const barRow = (c, color, { dim = false, sub = '' } = {}) => `<div class="row" style="padding:10px 14px;${dim ? 'opacity:.38' : ''}">${inChart(c, color, 38)}
 <div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:8px"><b class="one" style="flex:1;font-weight:500;font-size:15px">${c.name}</b><span style="font-weight:600;font-size:14.5px;font-variant-numeric:tabular-nums">${c.amt}</span><span class="mu" style="width:36px;text-align:right;font-size:13.5px;font-variant-numeric:tabular-nums">${c.p}%</span></div>
 ${sub}<div style="height:6px;border-radius:4px;background:var(--s2);margin-top:7px;overflow:hidden"><i style="display:block;height:100%;width:${Math.max(c.p / 48 * 100, 3)}%;background:${color};border-radius:4px"></i></div></div></div>`;

const restRow = (open) => `<div class="row" style="padding:10px 14px">${restIcon(38)}
 <div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;gap:8px"><b class="one" style="flex:1;font-weight:500;font-size:15px">2 categorías más</b><span style="font-weight:600;font-size:14.5px">14.320</span><span class="mu" style="width:36px;text-align:right;font-size:13.5px">4%</span></div>
 <div style="height:6px;border-radius:4px;background:var(--s2);margin-top:7px;overflow:hidden"><i style="display:block;height:100%;width:8%;background:${REST};border-radius:4px"></i></div></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px;flex:none')}</div>`;

const centre = (top, big, sub = '') => `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;pointer-events:none"><div>
 <div class="lab" style="font-size:11px">${top}</div><b style="display:block;font-size:30px;margin-top:2px;letter-spacing:-.5px">${big}</b>${sub ? `<div class="sub" style="margin-top:2px">${sub}</div>` : ''}</div></div>`;
const bigDonut = (on = -1, inside = centre('Gastaste', '358 mil', '31 movimientos')) =>
  `<div class="card" style="padding:14px 16px 10px"><div style="position:relative;width:206px;height:206px;margin:0 auto">${ring(PARTS, { on })}${inside}</div>
   <div class="sub" style="text-align:center;margin-top:12px">${ic('hand-left-outline', '', 'width:15px;height:15px;vertical-align:-3px')} Toca una porción para ver qué es</div></div>`;

// ---------------------------------------------------------------------------
// 16a - Today, with what goes wrong pointed out.
const callout = t => `<div style="flex:1;background:#3a1f26;border:1px solid #ff6b6b;color:#ffd5d5;font-size:12.5px;line-height:1.35;padding:8px 10px;border-radius:12px">${t}</div>`;
const today = `<div class="card" style="display:flex;align-items:center;gap:14px">
 <div style="position:relative;flex:none">${ring([[48, '#ff9152'], [21, '#4cb8f5'], [10, '#8c9bb5'], [9, '#2ec4b6'], [7, '#d07bf0'], [4, '#8c9bb5']], { size: 128, width: 20 })}
 ${centre('Gastaste', '358 mil').replace('font-size:30px', 'font-size:15px').replace('font-size:11px', 'font-size:9.5px')}</div>
 <div style="flex:1;min-width:0">${CATS.map(c => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13.5px">${own(c, 26)}<span class="one" style="flex:1">${c.name}</span><span class="mu" style="width:32px;text-align:right">${c.p}%</span></div>`).join('')}
 <div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13.5px">${restIcon(26)}<span class="one mu" style="flex:1">2 categorías más</span><span class="mu" style="width:32px;text-align:right">4%</span></div></div></div>`;
S['16a-dona-hoy'] = screen(label('Hoy, como está'), `${today}
 <div style="display:flex;gap:8px;margin-top:10px">${callout('<b>Didi</b>: su logo es naranja, pero su porción es lila. No hay cómo unirlos.')}${callout('<b>Transporte</b> y <b>“2 más”</b> son el mismo gris: no se sabe cuál porción es cuál.')}</div>
 <div class="sub" style="margin-top:12px;padding:0 6px">El color de cada porción sale del color de la categoría; si nadie le escogió uno, de una paleta por su número. Dos categorías pueden quedar iguales, y una imagen propia no tiene color de porción.</div>`);

// ---------------------------------------------------------------------------
// Option A - a big donut on top, the list with bars under it. Recommended.
const listA = (on = -1) => `<div class="list" style="margin-top:12px">${CATS.map((c, i) => barRow(c, SERIES[i], { dim: on >= 0 && i !== on })).join('')}${restRow(false).replace('class="row"', `class="row" style="${on >= 0 ? 'opacity:.38;' : ''}`)}</div>`;
S['16b-opcion-a-dona-grande'] = screen(label('Opción A · recomendada', true), `${bigDonut()}${listA()}`);
S['16c-opcion-a-porcion-tocada'] = screen(label('Opción A · tocaste Salud', true),
  `${bigDonut(1, centre('Salud', '75.180', '21 % · 4 movimientos'))}${listA(1)}`);
S['16d-opcion-a-mas-categorias'] = screen(label('Opción A · “2 categorías más” abierta', true),
  `<div class="list">${CATS.slice(3).map((c, i) => barRow(c, SERIES[i + 3])).join('')}${restRow(true)}
   ${MORE.map(c => barRow(c, REST).replace('class="row" style="padding:10px 14px;', 'class="row" style="padding:8px 14px 8px 30px;background:var(--s2);')).join('')}</div>
   <div class="sub" style="padding:10px 6px 0">Las pequeñas comparten el gris de “más” en la dona: son 4 % entre las dos. Tocar una abre sus movimientos.</div>`);

// The same chart in the light theme, its colours stepped for a white card.
const LIGHT = ['#eb6834', '#2a78d6', '#1baf7a', '#eda100', '#e87ba4'];
S['16h-opcion-a-tema-claro'] = screen(label('Opción A · tema claro', true),
  `<div class="card" style="padding:14px 16px 10px"><div style="position:relative;width:206px;height:206px;margin:0 auto">${ring([...CATS.map((c, i) => [c.p, LIGHT[i]]), [4, '#a7b0c2']])}${centre('Gastaste', '358 mil', '31 movimientos')}</div></div>
   <div class="list" style="margin-top:12px">${CATS.map((c, i) => barRow(c, LIGHT[i])).join('')}</div>`)
  .replace(/^/, `<style>:root{--bg:#f3f5fa;--top:#ffffff;--s1:#ffffff;--s2:#eef1f7;--s3:#e2e7f1;--line:#e3e8f2;--tx:#121a2b;--mu:#5d6880}
   body{background:var(--bg)}.card,.list,.seg,.month{border-color:#e3e8f2!important}.bar-top{background:#fff}</style>`);

// ---------------------------------------------------------------------------
// Option B - no donut: one stacked bar and the ranking.
const stacked = `<div style="display:flex;gap:2px;height:16px;border-radius:8px;overflow:hidden;margin-top:12px">${PARTS.map(([p, c]) => `<i style="flex:${p};background:${c}"></i>`).join('')}</div>`;
S['16e-opcion-b-barras'] = screen(label('Opción B · solo barras, sin dona'),
  `<div class="card"><div class="lab">Gastaste</div><b style="display:block;font-size:30px;margin-top:2px">358 mil</b><div class="sub">31 movimientos en octubre</div>${stacked}</div>
   <div class="list" style="margin-top:12px">${CATS.map((c, i) => barRow(c, SERIES[i])).join('')}${restRow(false)}</div>`);

// ---------------------------------------------------------------------------
// Option C - the donut with each category's icon around it.
const around = () => {
  const size = 206, R = 132; let acc = 0;
  return [...CATS.map((c, i) => [c, SERIES[i]]), [{ name: '+2', p: 4 }, REST]].map(([c, color]) => {
    const mid = (acc + c.p / 2) / 100 * 2 * Math.PI - Math.PI / 2; acc += c.p;
    const x = size / 2 + R * Math.cos(mid), y = size / 2 + R * Math.sin(mid);
    return `<div style="position:absolute;left:${x - 21}px;top:${y - 26}px;width:42px;text-align:center">${c.name === '+2' ? restIcon(30) : inChart(c, color, 30)}<div style="font-size:11.5px;font-weight:600;margin-top:2px;color:${color}">${c.p}%</div></div>`;
  }).join('');
};
S['16f-opcion-c-iconos-alrededor'] = screen(label('Opción C · íconos alrededor de la dona'),
  `<div class="card" style="padding:44px 16px 40px"><div style="position:relative;width:206px;height:206px;margin:0 auto">${ring(PARTS, { width: 26 })}${centre('Gastaste', '358 mil', '31 movimientos')}${around()}</div></div>
   <div class="sub" style="padding:10px 6px 0">Se ve bien con 5 o 6 categorías; las porciones pequeñas que quedan juntas (Didi, “+2”) se amontonan, y una imagen propia se ve pequeña.</div>`);

// ---------------------------------------------------------------------------
// Option D - half a donut, the figure under its arch, the list below.
const half = () => {
  const r = 40, C = Math.PI * r; let off = 0;
  const arcs = PARTS.map(([p, c]) => { const len = Math.max(p / 100 * C - .9, .4); const s = `<path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="${c}" stroke-width="11" stroke-dasharray="${len} ${C * 2}" stroke-dashoffset="${-off}"/>`; off += p / 100 * C; return s; }).join('');
  return `<svg width="290" height="150" viewBox="0 0 100 52" style="display:block;margin:0 auto">${arcs}</svg>`;
};
S['16g-opcion-d-media-dona'] = screen(label('Opción D · media dona'),
  `<div class="card" style="padding:18px 16px 14px"><div style="position:relative">${half()}<div style="position:absolute;left:0;right:0;bottom:2px;text-align:center"><div class="lab" style="font-size:11px">Gastaste</div><b style="font-size:30px;letter-spacing:-.5px">358 mil</b></div></div></div>
   <div class="list" style="margin-top:12px">${CATS.map((c, i) => barRow(c, SERIES[i])).join('')}${restRow(false)}</div>`);

// ---------------------------------------------------------------------------
// Option A+ (Jose, 2026-10-02, from a picture of another app he liked): the
// space around the donut is used - each category's icon and percent sits
// around it, a thin line from its slice to it - and the list stays under it.
// At most EIGHT categories get a colour of their own (the validated palette
// has eight; a ninth colour would be guessed, never checked) and the rest
// fold into one grey "N categorías más", opened at the foot of the list.
const P8 = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const P8L = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const W = 356, H = 360, CX = W / 2, CY = H / 2, RIN = 62, ROUT = 92;
// Twelve places around the donut, clockwise from the top: four above, two on
// each side, four below.
const SLOTS = [[54, 30], [140, 30], [216, 30], [302, 30], [326, 132], [326, 228], [302, 330], [216, 330], [140, 330], [54, 330], [30, 228], [30, 132]]
  .map(([x, y]) => ({ x, y, a: (Math.atan2(x - CX, -(y - CY)) * 180 / Math.PI + 360) % 360 }))
  .sort((a, b) => a.a - b.a);
// The icons are spread round ALL the places (Jose: the biggest slice alone on
// one side wastes the rest), evenly, in the ring's order, turned to sit as
// close as they can to their own slices.
const place = mids => {
  const n = mids.length, m = SLOTS.length; let best = null, bestCost = Infinity;
  for (let k = 0; k < m; k++) {
    const chosen = mids.map((_, i) => SLOTS[(k + Math.round(i * m / n)) % m]);
    const cost = mids.reduce((sum, mid, i) => { const d = Math.abs(mid - chosen[i].a); return sum + Math.min(d, 360 - d); }, 0);
    if (cost < bestCost) { bestCost = cost; best = chosen; }
  }
  return best;
};
// A line from a slice to its icon, in right angles only (Jose). It leaves
// the ring moving away from the centre - such a move never crosses the ring -
// runs along a lane of its own in the gap between the ring and the icons,
// and comes into the icon from the side that faces the ring: under the
// percent for the row above, over the icon for the row below, the inner
// side for the two columns. Lanes are handed out so that the lines nearest
// the ring are the ones that travel least, which keeps them from crossing.
const laneOf = new Map();
const lanes = (slices, spots) => {
  laneOf.clear();
  const groups = { top: [], bottom: [], left: [], right: [] };
  slices.forEach((sl, i) => {
    const sp = spots[i], g = sp.y < 80 ? 'top' : sp.y > 280 ? 'bottom' : sp.x < CX ? 'left' : 'right';
    const [sx, sy] = pt(ROUT + 6, sl.mid);
    groups[g].push({ i, travel: g === 'top' || g === 'bottom' ? Math.abs(sp.x - sx) : Math.abs(sp.y - 8 - sy), g });
  });
  for (const list of Object.values(groups)) list.sort((p, q) => p.travel - q.travel).forEach((it, k) => laneOf.set(it.i, { k, g: it.g }));
};
const route = (i, mid, sp) => {
  const [sx, sy] = pt(ROUT + 6, mid), { k, g } = laneOf.get(i);
  let pts;
  if (g === 'top') { const ay = sp.y + 38, lane = ay + 6 + k * 6; pts = [[sx, sy], [sx, lane], [sp.x, lane], [sp.x, ay]]; }
  else if (g === 'bottom') { const ay = sp.y - 28, lane = ay - 6 - k * 6; pts = [[sx, sy], [sx, lane], [sp.x, lane], [sp.x, ay]]; }
  else { const dir = g === 'right' ? 1 : -1, ax = sp.x - dir * 22, ay = sp.y - 8, lane = ax - dir * (6 + k * 6);
    pts = [[sx, sy], [lane, sy], [lane, ay], [ax, ay]]; }
  // Drop legs of no length, then round the corners so it reads as one line.
  pts = pts.filter((p, j) => j === 0 || Math.hypot(p[0] - pts[j - 1][0], p[1] - pts[j - 1][1]) > .5);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let j = 1; j < pts.length - 1; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], [x2, y2] = pts[j + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1), r = Math.min(6, l1 / 2, l2 / 2);
    d += ` L${x1 - (x1 - x0) / l1 * r} ${y1 - (y1 - y0) / l1 * r} Q${x1} ${y1} ${x1 + (x2 - x1) / l2 * r} ${y1 + (y2 - y1) / l2 * r}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
};
const pt = (r, deg) => [CX + r * Math.sin(deg * Math.PI / 180), CY - r * Math.cos(deg * Math.PI / 180)];
const arc = (a0, a1, r0, r1) => { const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0), big = a1 - a0 > 180 ? 1 : 0;
  return `M${x0} ${y0} A${r1} ${r1} 0 ${big} 1 ${x1} ${y1} L${x2} ${y2} A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`; };

/** items: [{c, p, color, rest?}] largest first; on: index tapped or -1. */
const framed = (items, { on = -1, total = '358 mil', count = '31 movimientos', top = 'Gastaste', sub } = {}) => {
  let acc = 0;
  const slices = items.map(it => { const a0 = acc / 100 * 360, a1 = (acc + it.p) / 100 * 360; acc += it.p; return { ...it, a0, a1, mid: (a0 + a1) / 2 }; });
  const spots = place(slices.map(s => s.mid));
  const dimmed = i => on >= 0 && i !== on;
  lanes(slices, spots);
  const svg = slices.map((s, i) => {
    const gap = .8, path = arc(s.a0 + gap, s.a1 - gap, RIN, i === on ? ROUT + 5 : ROUT);
    return `<path d="${path}" fill="${s.color}" opacity="${dimmed(i) ? .22 : 1}"/> <path d="${route(i, s.mid, spots[i])}" fill="none" stroke="${s.color}" stroke-width="1.5" stroke-linejoin="round" opacity="${dimmed(i) ? .2 : .9}"/><circle cx="${pt(ROUT + 6, s.mid)[0]}" cy="${pt(ROUT + 6, s.mid)[1]}" r="2.2" fill="${s.color}" opacity="${dimmed(i) ? .2 : 1}"/>`;
  }).join('');
  const icons = slices.map((s, i) => { const sp = spots[i];
    return `<div style="position:absolute;left:${sp.x - 28}px;top:${sp.y - 24}px;width:56px;text-align:center;opacity:${dimmed(i) ? .3 : 1}">${s.rest ? `<span class="sq" style="display:grid;place-items:center;width:32px;height:32px;margin:0 auto;background:var(--s3);color:var(--mu);font-size:11px">+${s.rest}</span>` : `<div style="width:32px;margin:0 auto">${inChart(s.c, s.color, 32)}</div>`}
      <div style="font-size:12.5px;font-weight:600;margin-top:8px;font-variant-numeric:tabular-nums;color:var(--tx)">${s.p}%</div></div>`; }).join('');
  return `<div class="card" style="padding:12px"><div style="position:relative;width:${W}px;height:${H}px">
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">${svg}</svg>${icons}
    <div style="position:absolute;left:${CX - 60}px;top:${CY - 40}px;width:120px;text-align:center"><div class="lab" style="font-size:10.5px">${top}</div><b style="display:block;font-size:${total.length > 8 ? 20 : 25}px;margin-top:2px;letter-spacing:-.4px">${total}</b><div class="sub" style="font-size:12px;margin-top:1px">${sub ?? count}</div></div></div></div>`;
};

const JOSE = [...CATS.map((c, i) => ({ c, p: c.p, color: SERIES[i] })), { p: 4, color: REST, rest: 2 }];
S['16i-opcion-a-iconos-alrededor'] = screen(label('Opción A con íconos alrededor', true), `${framed(JOSE)}${listA()}`);
S['16j-opcion-a-iconos-tocada'] = screen(label('Íconos alrededor · tocaste Salud', true),
  `${framed(JOSE, { on: 1, top: 'Salud', total: '75.180', sub: '21 % · 4 mov.' })}${listA(1)}`);

// Many categories, as in his picture: eight with a colour, the rest folded.
const many = [
  ['Vivienda', 'home-outline', 33, '10.238.000'], ['Restaurante', 'restaurant-outline', 20, '6.204.800'], ['Salud', 'thermometer-outline', 7, '2.171.700'],
  ['Mercado', 'basket-outline', 6, '1.861.400'], ['Celulares', 'phone-portrait-outline', 6, '1.861.400'], ['Taxi', 'car-outline', 6, '1.861.400'],
  ['Tecnología', 'laptop-outline', 6, '1.861.400'], ['Varios', 'ellipsis-horizontal', 5, '1.551.200'],
].map(([name, ic, p, amt]) => ({ name, ic, p, amt }));
const folded = [['Ropa', 'shirt-outline', 3, '930.700'], ['Peluquería', 'cut-outline', 2, '620.500'], ['Carro', 'car-sport-outline', 2, '620.500'],
  ['Deporte', 'football-outline', 2, '620.500'], ['Viajes', 'airplane-outline', 1, '310.200'], ['Vacaciones', 'umbrella-outline', 1, '310.200']]
  .map(([name, ic, p, amt]) => ({ name, ic, p, amt }));
const MANY = [...many.map((c, i) => ({ c, p: c.p, color: P8[i] })), { p: 11, color: REST, rest: 6 }];
const restRowN = (n, amt, p, open) => restRow(open).replace('+2', `+${n}`).replace('2 categorías más', `${n} categorías más`).replace('14.320', amt).replace('>4%<', `>${p}%<`).replace('width:8%', `width:${p / 33 * 100}%`);
S['16k-opcion-a-muchas-categorias'] = screen(label('Íconos alrededor · 14 categorías', true),
  `${framed(MANY, { total: '31,02 M', count: '412 movimientos' })}
   <div class="list" style="margin-top:12px">${many.slice(0, 3).map((c, i) => barRow({ ...c, p: c.p }, P8[i]).replace(`width:${Math.max(c.p / 48 * 100, 3)}%`, `width:${c.p / 33 * 100}%`)).join('')}</div>`).replace('Movimientos · 31', 'Movimientos · 412');
S['16l-opcion-a-otras-abiertas'] = screen(label('14 categorías · “6 categorías más” abierta', true),
  `<div class="list">${many.slice(5).map((c, i) => barRow(c, P8[i + 5]).replace(`width:${Math.max(c.p / 48 * 100, 3)}%`, `width:${c.p / 33 * 100}%`)).join('')}${restRowN(6, '3.412.600', 11, true)}
   ${folded.map(c => barRow(c, REST).replace(`width:${Math.max(c.p / 48 * 100, 3)}%`, `width:${c.p / 33 * 100}%`).replace('class="row" style="padding:10px 14px;', 'class="row" style="padding:8px 14px 8px 30px;background:var(--s2);')).join('')}</div>
   <div class="sub" style="padding:10px 6px 0">Hasta 8 categorías con color propio; las demás van juntas en gris en la dona y se abren aquí, cada una con su cifra.</div>`).replace('Movimientos · 31', 'Movimientos · 412');
S['16m-opcion-a-iconos-tema-claro'] = screen(label('Íconos alrededor · tema claro', true),
  `${framed(CATS.map((c, i) => ({ c, p: c.p, color: P8L[[1, 0, 2, 3, 4][i]] })).concat([{ p: 4, color: '#a7b0c2', rest: 2 }]))}
   <div class="list" style="margin-top:12px">${CATS.slice(0, 2).map((c, i) => barRow(c, P8L[[1, 0][i]])).join('')}</div>`)
  .replace(/^/, `<style>:root{--bg:#f3f5fa;--top:#ffffff;--s1:#ffffff;--s2:#eef1f7;--s3:#e2e7f1;--line:#e3e8f2;--tx:#121a2b;--mu:#5d6880}
   body{background:var(--bg)}.card,.list,.seg,.month{border-color:#e3e8f2!important}.bar-top{background:#fff}</style>`);

export default S;
