// Group 33 - "Barra de abajo" inside "Personaliza tu vista" (Jose, 2026-10-15:
// choose which buttons the floating bar carries, other screens in place of
// Inicio, Cuentas or Reporte, and their order). Proposed, nothing built.
// The "+" and Más stay: the "+" is the one way to a new movement, and Más is
// where every screen not on the bar is reached.
import { ic, ci, sq, C, chev, top, tint } from './lib.mjs';
import G31 from './screens-31.mjs';
import G8 from './screens-8.mjs';

const S = {};

// Every screen that can be a button, with its icon, colour and a short name
// that fits under the icon.
const ALL = {
  inicio: ['home-outline', C.blu, 'Inicio', 'Tu saldo y tus movimientos'],
  cuentas: ['wallet-outline', C.grn, 'Cuentas', 'Saldos, rendimientos y deudas'],
  reporte: ['stats-chart-outline', C.pur, 'Reporte', 'En qué se fue la plata'],
  deudas: ['receipt-outline', C.yel, 'Deudas', 'Tarjetas y préstamos'],
  presupuestos: ['pie-chart-outline', C.org, 'Presupuestos', 'Topes y metas'],
  rendimientos: ['trending-up-outline', C.tea, 'Rendimientos', 'Lo que te pagan tus cuentas'],
  revisar: ['checkmark-done-outline', C.blu, 'Por revisar', 'Extractos y mensajes por confirmar'],
  categorias: ['pricetags-outline', C.pur, 'Categorías', 'Tus categorías'],
  monedas: ['cash-outline', C.lim, 'Monedas', 'Monedas y TRM'],
  renta: ['calculator-outline', C.org, 'Renta', 'Simulador de renta'],
};

// The bar itself, drawn with any three buttons: the "+" in the middle and Más
// at the end never move.
const bar = (keys, on, { pos = 'fixed', style = '' } = {}) => {
  const btn = k => { const [i, , l] = ALL[k]; return `<div class="${k === on ? 'on' : ''}">${ic(i)}${l}</div>`; };
  const [a, b, c] = keys;
  const inner = `${btn(a)}${btn(b)}<div class="plus">${ic('add')}</div>${btn(c)}<div class="${on === 'mas' ? 'on' : ''}">${ic('grid-outline')}Más</div>`;
  return pos === 'fixed' ? `<nav>${inner}</nav>` : `<nav style="position:static;margin:0;${style}">${inner}</nav>`;
};

// 1. "Personaliza tu vista" gains a row for the bar, first, since it is on
//    every screen.
const barRow = `<div class="row">${sq('apps-outline', C.cya, 40)}<div class="tx"><b>Barra de abajo</b><small class="wrap">Inicio · Cuentas · Reporte</small></div>${chev()}</div>`;
S['33a-personaliza-con-barra'] = G31['31e-personaliza-pantallas'].replace(/<div class="list">/, `<div class="list">${barRow}</div><div class="list" style="margin-top:12px">`);

// 2. The bar's own screen: the bar as it will look, on top; then its three
//    places, each one tapped to change it and dragged by ☰ to reorder; the
//    "+" and Más said as fixed; and the reset.
const grip = `<span class="mu" style="flex:none;margin-left:6px">${ic('reorder-three-outline', '', 'width:22px;height:22px')}</span>`;
const place = (n, k) => { const [i, c, l, about] = ALL[k]; return `<div class="row">${sq(i, c, 40)}<div class="tx"><b>${l}</b><small>Botón ${n} · ${about}</small></div>${ic('swap-horizontal-outline', 'p', 'width:20px;height:20px;flex:none')}${grip}</div>`; };
const fixed = (i, c, l, why) => `<div class="row" style="opacity:.75">${sq(i, c, 40)}<div class="tx"><b>${l}</b><small class="wrap">${why}</small></div><span class="mu" style="font-size:12px;flex:none">Siempre</span></div>`;
const preview = keys => `<div class="h" style="margin-top:4px">Así se verá</div>
 <div style="background:var(--s1);border:1px solid #1f2c47;border-radius:20px;padding:14px 8px 6px">${bar(keys, keys[0], { pos: 'static' })}
 <div class="sub" style="text-align:center;margin-top:8px;font-size:12.5px">La app abre en ${ALL[keys[0]][2]}</div></div>`;
const screen = (keys, extra = '') => `${top('Barra de abajo')}<main>
 <div class="sub" style="margin:2px 4px 10px">Elige qué botones tiene la barra y en qué orden. Lo que no esté en la barra sigue en Más.</div>
 ${preview(keys)}
 <div class="h">Tus botones</div><div class="list">${keys.map((k, n) => place(n + 1, k)).join('')}</div>
 <div class="hint" style="margin:6px 4px 0">Toca uno para cambiarlo por otra pantalla. Arrástralo con ☰ para moverlo.</div>
 <div class="h">Fijos</div><div class="list">
  ${fixed('add', C.blu, 'El botón +', 'En el centro: es como se registra un movimiento')}
  ${fixed('grid-outline', C.gry ?? '#8a94a6', 'Más', 'Al final: ahí está todo lo demás')}</div>
 <div class="sub" style="text-align:center;margin-top:16px;color:var(--pr);font-weight:600">${ic('refresh-outline', '', 'width:16px;height:16px;vertical-align:-3px')} Volver a Inicio · Cuentas · Reporte</div>
 <div style="height:40px"></div></main>${extra}`;
S['33b-barra-como-viene'] = screen(['inicio', 'cuentas', 'reporte']);

// 3. Tapping "Botón 3" (Reporte): which screen goes there. Those already on
//    the bar are marked and cannot be chosen twice.
const option = (k, state) => { const [i, c, l, about] = ALL[k]; return `<div class="row" ${state === 'used' ? 'style="opacity:.45"' : ''}>${sq(i, c, 38)}<div class="tx"><b>${l}</b><small>${state === 'used' ? 'Ya está en la barra' : about}</small></div>${state === 'on' ? ic('checkmark', 'p', 'width:20px;height:20px') : ''}</div>`; };
S['33c-cambiar-boton'] = S['33b-barra-como-viene'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <b style="display:block;text-align:center;font-size:17px">¿Qué va en el botón 3?</b>
 <div class="sub" style="text-align:center;margin:2px 0 12px">Hoy: Reporte</div>
 <div class="list">${option('reporte', 'on')}${option('deudas')}${option('presupuestos')}${option('rendimientos')}${option('revisar')}${option('categorias')}${option('monedas')}${option('renta')}${option('inicio', 'used')}${option('cuentas', 'used')}</div></div>`;

// 4. Chosen and reordered: Deudas first, Inicio second, Presupuestos third.
S['33d-barra-cambiada'] = screen(['deudas', 'inicio', 'presupuestos']);

// 5. The app with that bar: it opens on Deudas, the first button.
const debtsPage = G31['31a-deudas-hoy-sin-prestamos'].replace(/<nav>[\s\S]*?<\/nav>/, bar(['deudas', 'inicio', 'presupuestos'], 'deudas'));
S['33e-app-con-barra-nueva'] = debtsPage;

// 6. Más carries what left the bar: Cuentas and Reporte appear on top, under
//    "No están en tu barra", so nothing is ever out of reach.
const row = (i, c, t, s) => `<div class="row">${sq(i, c, 40)}<div class="tx"><b>${t}</b><small>${s}</small></div>${chev()}</div>`;
const off = `<div class="h">No están en tu barra</div><div class="list">${row('wallet-outline', C.grn, 'Cuentas', 'Saldos, rendimientos y deudas')}${row('stats-chart-outline', C.pur, 'Reporte', 'En qué se fue la plata')}</div>`;
S['33f-mas-con-lo-que-salio'] = G8['8a-mas'].replace(/<div class="h">Tus datos<\/div>/, `${off}<div class="h">Tus datos</div>`)
  .replace(/<nav>[\s\S]*?<\/nav>/, bar(['deudas', 'inicio', 'presupuestos'], 'mas'));

export default S;
