// Group 34 - paying for the app (rule 21, the list decided by Jose on
// 2026-10-15). Proposed, nothing built: the screen that sells it, how a lock
// looks where it stops something, the monthly allowance of bank messages and
// where the person sees what they have. Every figure invented.
import { ic, sq, ci, C, chev, top, tint, tabs } from './lib.mjs';
import G8 from './screens-8.mjs';

const S = {};
const lock = (size = 14) => ic('lock-closed', '', `width:${size}px;height:${size}px`);
const pro = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:9px;background:${tint(C.yel, .18)};color:${C.yel};font-size:11.5px;font-weight:700;flex:none">${lock(11)}PRO</span>`;
const btn = (t, style = '') => `<div style="height:52px;border-radius:16px;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;font-weight:700;font-size:16px;${style}">${t}</div>`;
const link = t => `<div style="text-align:center;color:var(--pr);font-weight:600;font-size:15px;margin-top:14px">${t}</div>`;

// 1. The screen that sells it: what it opens, two prices, the trial.
const perk = (i, c, t, s) => `<div class="row" style="padding:10px 14px">${sq(i, c, 38)}<div class="tx"><b>${t}</b><small class="wrap">${s}</small></div></div>`;
const price = (on, t, big, sub, tag) => `<div style="flex:1;position:relative;border-radius:18px;padding:14px 12px;background:${on ? tint(C.blu, .14) : 'var(--s1)'};border:2px solid ${on ? 'var(--pr)' : '#1f2c47'}">
 ${tag ? `<span style="position:absolute;top:-11px;right:10px;background:${C.grn};color:#06210f;font-size:11.5px;font-weight:800;padding:3px 9px;border-radius:9px">${tag}</span>` : ''}
 <div class="mu" style="font-size:13px">${t}</div><b style="display:block;font-size:21px;margin-top:4px">${big}</b><div class="mu" style="font-size:12px;margin-top:2px">${sub}</div></div>`;
const paywall = (title = 'Finance Pro', lead = 'Todo lo que la app sabe hacer, sin límites.') => `${top('', { left: 'x' })}<main style="padding-top:4px">
 <div style="text-align:center">${ci('diamond-outline', C.yel, 64).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:24px">${title}</b><div class="sub" style="margin-top:4px">${lead}</div></div>
 <div class="list" style="margin-top:16px">
  ${perk('notifications-outline', C.yel, 'Tus bancos, sin límite', 'Todos los mensajes y SMS, todos los movimientos del mes')}
  ${perk('trending-up-outline', C.tea, 'Rendimientos', 'Todas tus cuentas que pagan, al centavo')}
  ${perk('document-text-outline', C.pur, 'Extractos en PDF', 'Los que quieras, de cualquier banco')}
  ${perk('globe-outline', C.lim, 'Dólares, euros y más', 'Con la TRM de cada día')}
  ${perk('receipt-outline', C.org, 'Préstamos, topes y metas', 'Sin límite, con abonos a capital')}
  ${perk('stats-chart-outline', C.blu, 'Reporte completo y en Excel', 'Más el simulador de renta')}</div>
 <div style="display:flex;gap:10px;margin-top:18px">${price(true, 'Anual', '$ 69.900', 'Solo $ 5.825 al mes', 'AHORRAS 51 %')}${price(false, 'Mensual', '$ 11.900', 'Cada mes')}</div>
 ${btn('Probar 7 días gratis', 'margin-top:16px')}
 <div class="sub" style="text-align:center;margin-top:8px;font-size:12.5px">Luego $ 69.900 al año. Cancela cuando quieras en Google Play.</div>
 ${link('Restaurar mi compra')}
 <div class="sub" style="text-align:center;margin-top:14px;font-size:12px">${ic('shield-checkmark-outline', '', 'width:14px;height:14px;vertical-align:-2px')} Sin anuncios. Tus datos siguen solo en tu celular.</div>
 <div style="height:30px"></div></main>`;
S['34a-finance-pro'] = paywall();

// 2. Tapping something locked: a small sheet, never a dead end. It says what
//    the thing does, and what is free stays free.
const sheet = (i, c, t, s, extra = '') => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center">${ci(i, c, 56).replace('display:grid', 'display:grid;margin:0 auto 10px')}<b style="font-size:18px">${t}</b>
 <div class="sub" style="margin:6px 8px 0;line-height:1.4">${s}</div></div>${extra}
 ${btn('Ver Finance Pro', 'margin-top:18px')}${link('Ahora no')}<div style="height:10px"></div></div>`;
const masLocked = G8['8a-mas'].replace('Formulario 210 · año 2026', `Formulario 210 · año 2026 ${pro}`);
S['34b-algo-bloqueado'] = masLocked + sheet('calculator-outline', C.org, 'Simulador de renta', 'Calcula todo el año cuánto vas a pagar de renta, como el Formulario 210, y expórtalo a Excel.', `<div class="sub" style="text-align:center;margin-top:10px;font-size:12.5px">Es parte de Finance Pro · prueba 7 días gratis</div>`);

// 3. A free allowance used up: the second loan. The first one stays, whole.
S['34c-segundo-prestamo'] = masLocked + sheet('receipt-outline', C.org, 'Ya tienes tu préstamo gratis', 'Con Finance Pro registras todos tus préstamos y ves cuánto ahorras abonando a capital. Tu préstamo de hoy sigue igual.');

// 4. Bank messages: 15 a month free. Past them the app keeps catching and
//    they wait, locked; typing them by hand stays free.
const msg = (shop, amt, day) => `<div class="row">${sq('cart-outline', C.gry ?? '#8a94a6', 38)}<div class="tx"><b class="one">${shop}</b><small>${day} · Mensaje de Bancolombia</small></div><b style="filter:blur(5px)">${amt}</b></div>`;
S['34d-mensajes-del-mes'] = `${top('Movimientos por revisar')}<main>
 <div class="card" style="padding:14px 16px">
  <div style="display:flex;justify-content:space-between;font-size:13.5px"><span>Guardados desde mensajes este mes</span><b>15 de 15</b></div>
  <div class="pbar" style="margin-top:8px;height:8px"><i style="width:100%;background:var(--yel)"></i></div>
  <div class="mu" style="font-size:12.5px;margin-top:8px">Se renueva el 1 de noviembre.</div></div>
 <div class="card" style="margin-top:12px;padding:16px;border:1px solid ${tint(C.yel, .5)};background:${tint(C.yel, .08)}">
  <div style="display:flex;gap:12px;align-items:center">${ci('lock-closed-outline', C.yel, 44)}<div style="flex:1"><b style="font-size:16px">Tienes 8 movimientos detectados</b>
  <div class="sub" style="margin-top:2px">Desbloquea para guardarlos con un toque.</div></div></div>
  ${btn('Ver Finance Pro', 'margin-top:12px;height:46px;font-size:15px')}
  <div class="sub" style="text-align:center;margin-top:8px;font-size:12.5px">No se pierde ninguno. También puedes escribirlos tú.</div></div>
 <div class="h">Esperando</div><div class="list" style="opacity:.75">
  ${msg('EXITO POBLADO', '$ 45.900', 'Hoy')}${msg('DIDI', '$ 12.400', 'Hoy')}${msg('FARMATODO', '$ 31.200', 'Ayer')}</div>
 <div style="height:110px"></div></main>${tabs('Más')}`;

// 5. The report: free sections as always; a paid one shows its title and
//    what it would tell you, never its figures.
const sec = (i, c, t, s, locked) => `<div class="list" style="margin-top:8px"><div class="row">${sq(i, c, 38)}<div class="tx"><b>${t}</b><small class="${locked ? '' : ''}">${s}</small></div>${locked ? pro : chev()}</div></div>`;
S['34e-reporte-con-candados'] = `${top('Reporte')}<main>
 ${sec('speedometer-outline', C.blu, 'Tus cifras', 'Ahorrado 38 %', false)}
 ${sec('git-compare-outline', C.pur, 'Contra el periodo anterior', 'Gastos −6 %', false)}
 ${sec('pie-chart-outline', C.org, 'En qué se fue', 'Vivienda 27 %', false)}
 ${sec('trending-up-outline', C.red, 'Lo que se disparó', 'Qué categorías subieron más este mes', true)}
 ${sec('repeat-outline', C.tea, 'Lo que vuelve cada mes', 'Tus cobros fijos y cuánto suman', true)}
 ${sec('bar-chart-outline', C.lim, 'Mes a mes', 'Ingresos y gastos de todo el año', true)}
 ${sec('analytics-outline', C.cya, 'Tu saldo a futuro', 'Cómo vas a estar en 90 días', true)}
 ${sec('list-outline', C.yel, 'Los más grandes', '10 movimientos', false)}
 <div class="sub" style="text-align:center;margin-top:14px">${lock()} Exportar a Excel es de Finance Pro</div>
 <div style="height:110px"></div></main>${tabs('Reporte')}`;

// 6. Más: what you have, on top. Free, in the trial, or Pro.
const card = (inner) => `<div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid ${tint(C.yel, .45)}">${ci('diamond-outline', C.yel, 44)}<div style="flex:1;min-width:0">${inner}</div>${chev()}</div>`;
const withCard = c => G8['8a-mas'].replace('<div class="h">Tus datos</div>', `${c}<div class="h">Tus datos</div>`);
S['34f-mas-gratis'] = withCard(card(`<b style="font-size:16px">Prueba Finance Pro gratis</b><div class="sub">7 días con todo abierto · Mensajes: 12 de 15 este mes</div>`));
S['34g-mas-en-prueba'] = withCard(card(`<b style="font-size:16px">Finance Pro · prueba</b><div class="sub">Te quedan 5 días · luego $ 69.900 al año</div>`));
S['34h-mas-pro'] = withCard(card(`<b style="font-size:16px">Finance Pro</b><div class="sub">Anual · se renueva el 15 oct 2027</div>`));

export default S;
