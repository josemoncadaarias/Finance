// Group 30 (2026-10-15, for Jose to choose). Two questions from his partner:
// the donut's "1,40 M" is not read by everybody as 1.4 million, and someone
// with several cards and loans wants each kind's total on Deudas. Proposed,
// nothing built. The donut's figures are those of Jose's screenshot (1.396.098
// spent in 7 movements, 84/11/5 %); the debts are invented.
import { ic, ci, C, accIcon, chev, tabs, status, tint } from './lib.mjs';
import { framed, screen, label } from './screens-16.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');

// ---------------------------------------------------------------------------
// The donut.
const items = amounts => [
  { c: { name: 'Mercado', ic: 'basket-outline' }, p: 84, color: '#3987e5', amt: amounts && '1.172.722' },
  { c: { name: 'Servicios', ic: 'receipt-outline' }, p: 11, color: '#d95926', amt: amounts && '153.571' },
  { c: { name: 'Ropa', ic: 'shirt-outline' }, p: 5, color: '#199e70', amt: amounts && '69.805' },
];
const hint = `<div class="sub" style="text-align:center;margin-top:22px">${ic('hand-left-outline', '', 'width:15px;height:15px;vertical-align:-3px')} Toca una porción para ver su valor</div>`;
const donut = (opts, amounts = false) => framed(items(amounts), { count: '7 movimientos', ...opts }).replace(/<\/div><\/div>$/, `</div>${hint}</div>`);

S['30a-dona-hoy'] = screen(label('Hoy'), donut({ total: '1,40 M' }));
// 1. The whole figure in the centre: nothing to decode.
S['30b-dona-cifra-completa'] = screen(label('Opción 1 · la cifra completa en el centro', true), donut({ total: '$ 1.396.098' }));
// 2. Each category's amount under its percent, around the ring.
S['30c-dona-valor-por-categoria'] = screen(label('Opción 2 · el valor bajo cada porcentaje'), donut({ total: '1,40 M' }, true));
// 1 + 2 together (recommended): nothing on the chart needs a tap to be read.
S['30d-dona-ambas'] = screen(label('Opción 1 + 2 · recomendada', true), donut({ total: '$ 1.396.098' }, true));
// Tapping a slice, as today, says its whole figure in the centre.
S['30e-dona-tocada'] = screen(label('Al tocar una porción'), framed(items(true), { on: 1, top: 'Servicios', total: '$ 153.571', sub: '11 % · 2 mov.' }));

// ---------------------------------------------------------------------------
// Deudas with several cards and loans.
const seg = `<div class="seg" style="margin-top:10px">${[['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']]
  .map(([t, i]) => `<div class="${t === 'Deudas' ? 'on' : ''}">${ic(i)}${t}</div>`).join('')}</div>`;
const head = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva deuda</div></div>${seg}</div>`;
const eye = `<span style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:#fff;flex:none">${ic('eye-outline', '', 'width:21px;height:21px')}</span>`;
const row = (icon, name, a, b, cls = '') => `<div class="row" style="align-items:flex-start">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${a}</small><small class="${cls}" style="white-space:normal">${b}</small></div>${chev()}</div>`;
const cards = `
  ${row(ci('wallet-outline', C.org, 42), 'Producto emitido por Davivienda', 'Usas 7.780.959,00 de 7.950.000,00', 'Sin fechas de corte y pago')}
  ${row(accIcon('coral', 42), 'Tarjeta Coral', 'Usas 742.300,00 de 1.100.000,00', 'Paga 598.400 antes del 10 nov', 'y')}`;
const loans = `
  ${row(ci('school-outline', C.grn, 42), 'Universidad', 'Debes 5.320.620,83', 'Cuota 41 de 72: 194.744,81 el 14 de nov')}
  ${row(ci('car-outline', C.org, 42), 'Crédito del carro', 'Debes 12.400.000,00', 'Cuota 18 de 48: 486.200,00 el 5 de nov')}`;
const page = body => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;
const heroTop = `<div style="display:flex;align-items:center;justify-content:space-between;min-height:40px;margin-top:-4px"><div class="lab">Debes hoy</div>${eye}</div>
  <div class="big">$ 26.243.880,83</div>`;
const h = (t, n, total) => `<div class="h" style="display:flex;align-items:baseline;gap:8px"><span style="flex:1">${t} · ${n}</span><span style="text-transform:none;letter-spacing:0;font-size:14px;font-weight:700;color:var(--tx)">${total}</span></div>`;

// Today, with several of each: the total of each kind has to be added by eye.
S['30f-deudas-hoy'] = page(`<div class="card hero">${heroTop}<div class="sub">Este mes no te falta nada por pagar.</div></div>
 <div class="h">Tarjetas</div><div class="list">${cards}</div>
 <div class="h">Préstamos</div><div class="list">${loans}</div>`);

// A. Each section's heading carries its total. The hero stays as it is.
S['30g-deudas-total-en-cada-seccion'] = page(`<div class="card hero">${heroTop}<div class="sub">Este mes no te falta nada por pagar.</div></div>
 ${h('Tarjetas', 2, '8.523.259,00')}<div class="list">${cards}</div>
 ${h('Préstamos', 2, '17.720.620,83')}<div class="list">${loans}</div>`);

// B. The hero splits the total in two tiles, as Cuentas does (29a); each
//    jumps to its section. One card says it all, no second summary card.
const tile = (icon, color, lab, v, n) => `<div style="flex:1;min-width:0;background:rgba(7,13,26,.35);border-radius:16px;padding:10px 12px">
  <div style="display:flex;align-items:center;gap:6px;color:${color};font-size:12.5px;font-weight:600">${ic(icon, '', 'width:16px;height:16px')}${lab}</div>
  <div style="font-size:17px;font-weight:700;margin-top:3px;white-space:nowrap">${v}</div><div class="mu" style="font-size:11.5px">${n}</div></div>`;
const split = `<div style="display:flex;gap:8px;margin-top:12px">${tile('card-outline', C.yel, 'Tarjetas', '8.523.259,00', '2 tarjetas')}${tile('cash-outline', C.pur, 'Préstamos', '17.720.620,83', '2 préstamos')}</div>`;
S['30h-deudas-total-arriba'] = page(`<div class="card hero">${heroTop}<div class="sub">Este mes no te falta nada por pagar.</div>${split}</div>
 <div class="h">Tarjetas</div><div class="list">${cards}</div>
 <div class="h">Préstamos</div><div class="list">${loans}</div>`);

// A + B (recommended): the tiles on top and each heading's total, so the
// figure is there both at a glance and beside its list when scrolled.
S['30i-deudas-ambas'] = page(`<div class="card hero">${heroTop}<div class="sub">Este mes no te falta nada por pagar.</div>${split}</div>
 ${h('Tarjetas', 2, '8.523.259,00')}<div class="list">${cards}</div>
 ${h('Préstamos', 2, '17.720.620,83')}<div class="list">${loans}</div>`);

export default S;
