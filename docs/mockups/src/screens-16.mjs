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

export default S;
