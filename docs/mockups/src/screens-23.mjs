// Group 23 - what needs attention on Inicio (2026-10-11, for Jose to decide;
// nothing built). Today "Esta semana" (cards and loans due) and the caps and
// goals stack above the balance, and with several of them the chart and the
// movements fall below the screen. Three ways to keep them in view without
// taking it over, and the tour's step for them. Every name and figure invented.
import { ic, ci, C, tint } from './lib.mjs';
import G1 from './screens-1.mjs';

const S = {};
const base = G1['1a-inicio'];
const put = html => base.replace('<main>', `<main>${html}`);
const R = C.red, A = C.yel, B = C.blu;
const pill = (t, c) => `<span style="padding:4px 9px;border-radius:999px;background:${tint(c, .18)};color:${c};font-size:12.5px;font-weight:600;white-space:nowrap">${t}</span>`;
const kind = (t, c) => `<div style="font-size:11.5px;font-weight:700;color:${c};letter-spacing:.2px">${t}</div>`;
const item = (icon, c, k, title, sub, amt) => `<div class="row" style="padding:10px 14px">${ci(icon, c, 36)}<div class="tx">${kind(k, c)}<b class="one" style="font-size:14.5px">${title}</b><small class="one">${sub}</small></div><div class="am" style="font-size:14px">${amt}</div></div>`;
const ITEMS = [
  item('card-outline', R, 'PAGO DE TARJETA · VENCIDO', 'Tarjeta Coral', 'venció el 8 de oct, hace 3 días', '412.300,00'),
  item('car-outline', A, 'CUOTA DE PRÉSTAMO', 'Crédito del carro', 'vence el miércoles', '1.329.000,00'),
  item('restaurant-outline', R, 'TOPE DE GASTO PASADO', 'Restaurantes', '112 % · 48.000 por encima', '448.000 / 400.000'),
  item('airplane-outline', B, 'META DE AHORRO', 'Viaje a Cartagena', 'atrasada · faltan 2,1 M para dic.', '62 %'),
];

// 0. Today: four cards, each a full card, and the balance pushed down.
const old = (c, k, title, sub, amt, bar) => `<div class="card" style="margin-bottom:10px;border:1px solid ${tint(c, .45)};background:${tint(c, .10)}">${kind(k, c)}
 <div style="display:flex;align-items:center;gap:10px;margin-top:6px"><b class="one" style="flex:1;font-size:16px">${title}</b><b>${amt}</b></div>
 <div class="mu" style="font-size:13px;margin-top:3px">${sub}</div>${bar ? `<div style="height:7px;border-radius:4px;background:var(--s3);margin-top:9px"><div style="height:7px;width:${bar}%;border-radius:4px;background:${c}"></div></div>` : ''}</div>`;
S['23a-hoy-tapa-todo'] = put(`<div style="font-size:13px;font-weight:700;margin:2px 4px 8px" class="mu">ESTA SEMANA</div>
 ${old(R, 'PAGO DE TARJETA · VENCIDO', 'Tarjeta Coral', 'venció el 8 de oct, hace 3 días', '412.300,00')}
 ${old(A, 'CUOTA DE PRÉSTAMO', 'Crédito del carro', 'vence el miércoles', '1.329.000,00')}
 ${old(R, 'TOPE DE GASTO PASADO', 'Restaurantes', '112 % · 48.000 por encima', '448.000', 100)}
 ${old(B, 'META DE AHORRO', 'Viaje a Cartagena', 'atrasada · faltan 2,1 M para dic.', '62 %', 62)}`)
  + `<div style="position:absolute;left:16px;right:16px;top:118px;z-index:60;background:${R};color:#fff;border-radius:12px;padding:8px 12px;font-size:13px;font-weight:600;text-align:center">Hoy: el gráfico y los movimientos quedan debajo</div>`;

// A. One line, folded by default: how many and of what kind. Tap to open.
const barA = open => `<div class="card" style="padding:11px 14px;margin-bottom:10px">
 <div style="display:flex;align-items:center;gap:10px">${ci('notifications-outline', R, 34)}
  <div style="flex:1;min-width:0"><b style="font-size:15px">4 pendientes</b>
   <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:nowrap">${pill('2 pagos', R)}${pill('1 tope', R)}${pill('1 meta', B)}</div></div>
  ${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:20px;height:20px')}</div>
 ${open ? `<div class="list" style="margin:10px -14px -11px;border-radius:0 0 18px 18px">${ITEMS.join('')}</div>` : ''}</div>`;
S['23b-opcion-a-cerrado'] = put(barA(false));
S['23c-opcion-a-abierto'] = put(barA(true));

// B. Small cards in one row that slides sideways; the most urgent first.
const mini = (icon, c, k, title, amt) => `<div style="flex:0 0 150px;border-radius:16px;padding:11px;background:${tint(c, .12)};border:1px solid ${tint(c, .4)}">
 <div style="display:flex;align-items:center;gap:6px">${ic(icon, '', `width:17px;height:17px;color:${c}`)}<span style="font-size:11px;font-weight:700;color:${c}" class="one">${k}</span></div>
 <b class="one" style="display:block;font-size:14px;margin-top:6px">${title}</b><div style="font-size:13.5px;margin-top:2px">${amt}</div></div>`;
S['23d-opcion-b-tarjetas'] = put(`<div style="display:flex;gap:8px;overflow:hidden;margin:0 -16px 10px;padding:0 16px">
 ${mini('card-outline', R, 'VENCIDO', 'Tarjeta Coral', '412.300,00')}
 ${mini('car-outline', A, 'MIÉRCOLES', 'Crédito del carro', '1.329.000,00')}
 ${mini('restaurant-outline', R, 'TOPE PASADO', 'Restaurantes', '112 %')}</div>`);

// C. Only a bell in the header, with its count; everything in a sheet.
const bell = base.replace('<div class="tt" style="gap:10px">', `<div class="tt" style="gap:10px"><span style="position:absolute;right:16px;top:40px;width:40px;height:40px;border-radius:50%;background:${tint(R, .16)};color:${R};display:grid;place-items:center">${ic('notifications-outline', '', 'width:21px;height:21px')}<span style="position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;border-radius:10px;background:${R};color:#fff;font-size:11.5px;font-weight:700;display:grid;place-items:center">4</span></span>`);
S['23e-opcion-c-campana'] = bell;
S['23f-opcion-c-hoja'] = bell + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center"><b style="font-size:18px">Pendientes</b></div>
 <div class="list" style="margin-top:12px">${ITEMS.join('')}</div>
 <div style="text-align:center;margin-top:12px" class="p">Cancelar</div></div>`;

// The tour's step, the first time something is pending (with option A).
const hole = (x, y, w, h, r = 18) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;box-shadow:0 0 0 2000px rgba(3,6,14,.74);border:2px solid var(--pr);z-index:50"></div>`;
S['23g-guia-pendientes'] = S['23b-opcion-a-cerrado'] + hole(12, 150, 388, 80, 20) + `
 <div style="position:absolute;left:16px;right:16px;top:248px;z-index:51;background:#16223b;border:1px solid #2c3d63;border-radius:20px;padding:16px">
  <b style="font-size:16.5px;display:block">Lo que necesita tu atención</b>
  <div class="mu" style="font-size:14px;line-height:1.45;margin-top:5px">Pagos de tarjetas y cuotas que vencen, topes pasados y metas atrasadas. Tócalo para verlos; cuando no hay nada, no aparece.</div>
  <div style="display:flex;justify-content:flex-end;margin-top:14px"><span style="padding:9px 18px;border-radius:13px;background:linear-gradient(135deg,var(--pr),#4a5ef0);font-weight:700;font-size:14px">Entendido</span></div></div>`;

export default S;
