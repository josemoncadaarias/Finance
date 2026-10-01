// Group 12 - part 1 of debts (2026-10-01, for Jose's word): where debts and
// plans are reached, and a credit card's cut-off and payment days with the
// statement they allow. Jose's only debt today is one card, so the card is
// drawn first and in every state it can be in. Names and figures invented.
import { ic, ci, sq, C, tag, top, tabs, status, tint, chev, down, accIcon, bigTitle } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const row = (icon, t, s, right = chev()) => `<div class="row">${icon}<div class="tx"><b style="white-space:normal;line-height:1.3">${t}</b>${s ? `<small>${s}</small>` : ''}</div>${right}</div>`;
const seg = (opts, on) => `<div class="seg" style="margin-top:10px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;
const field = (lab, v, extra = '') => `<div class="field" style="margin-top:10px"><div class="lab">${lab}</div><div class="v" style="display:flex;align-items:center;justify-content:space-between;gap:8px">${v}${extra}</div></div>`;
const two = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${a}${b}</div>`;
const bar = p => `<div class="pbar" style="height:8px;margin-top:10px"><i style="width:${p}%;background:${C.yel}"></i></div>`;

// 1. Más: a new group, "Tus finanzas", with the three ways in.
S['12a-mas-tus-finanzas'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="h">Tus finanzas</div><div class="list">
  ${row(sq('card-outline', C.yel, 40), 'Deudas y tarjetas', 'Debes 742.300 · pagas antes del 10 oct')}
  ${row(sq('trending-up-outline', C.grn, 40), 'Productos y rendimientos', 'Rendimiento disponible 4,95 M')}
  ${row(sq('flag-outline', C.pur, 40), 'Planes', 'Límites de gasto y metas de ahorro')}</div>
 <div class="h">Tus datos</div><div class="list">
  ${row(sq('checkmark-done-outline', C.blu, 40), 'Movimientos por revisar', '18 movimientos esperan tu respuesta')}
  ${row(sq('pricetags-outline', C.pur, 40), 'Categorías', '22 categorías')}
  ${row(sq('swap-vertical-outline', C.tea, 40), 'Importar y exportar', 'Copia de seguridad y CSV')}</div>
 <div class="h">Herramientas</div><div class="list">${row(sq('calculator-outline', C.org, 40), 'Simulador de renta', 'Formulario 210 · año 2026')}</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 2. Cuentas gets a third face. With one card and no loans, that is all it shows.
const cuentasHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva deuda</div></div>
 ${seg([['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']], 'Deudas')}</div>`;
S['12b-cuentas-deudas'] = `${cuentasHead}<main>
 <div class="card hero"><div class="lab">Debes hoy</div><div class="big">$ 742.300</div>
  <div class="sub">Todo en tarjetas. No tienes préstamos.</div></div>
 <div class="h">Tarjetas</div>
 <div class="list"><div class="row" style="align-items:flex-start">${accIcon('coral', 42)}<div class="tx"><b class="one">Tarjeta Coral</b><small class="one">Usas 742.300 de 1.100.000</small><small class="y" style="white-space:normal">Paga 598.400 antes del viernes 10 oct</small></div>${chev()}</div></div>
 <div class="h">Préstamos</div>
 <div class="card" style="text-align:center;padding:18px">${ci('cash-outline', C.pur, 46).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block">No tienes préstamos</b>
  <div class="sub" style="margin:4px 0 12px">Si tienes uno, agrégalo para ver cuánto debes y cuánto pagas en intereses.</div>
  <span class="chip" style="color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Agregar un préstamo</span></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// 3. The card's own form gains two optional days. Nothing else changes.
S['12c-tarjeta-fechas'] = `${top('Editar cuenta', { left: 'x' })}<main>
 <div style="display:flex;gap:12px;align-items:center;margin:4px 0 6px">${accIcon('coral', 52)}<div style="flex:1"><div class="lab">Nombre</div><b style="font-size:18px">Tarjeta Coral</b></div>${ic('pencil', 'p')}</div>
 ${field('Tipo', 'Tarjeta de crédito', down())}
 ${field('Cupo hoy', '1.100.000,00')}
 <div class="h">Fechas de la tarjeta · opcional ${infoDot}</div>
 ${two(field('Día de corte', '25 <span class="mu" style="font-size:13px">de cada mes</span>'), field('Pagar antes del', '10 <span class="mu" style="font-size:13px">del mes siguiente</span>'))}
 <div class="note" style="margin:10px 4px">Con estas dos fechas la app te dice cuánto pagar y hasta cuándo, con tus propios movimientos.</div>
 </main><div class="save">Guardar</div>`;

// 4. The card's page. The statement is worked out from the movements: what
//    was owed at the close of the cut-off day, less what was paid since.
const cardHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${accIcon('coral', 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Tarjeta Coral</b><div class="sub one">Corte el 25 · pagas el 10</div></div>${ic('pencil', 'p')}</div>
 ${seg([['Factura'], ['Movimientos']], 'Factura')}</div>`;
const facts = (debt, after) => `<div class="kpi" style="margin-top:12px"><div class="card"><span class="lab">Debes en total</span><b>${debt}</b><span class="sub">de 1.100.000 de cupo</span></div>
  <div class="card"><span class="lab">Desde el corte</span><b>${after}</b><span class="sub">van a la próxima factura</span></div></div>`;
const page = (body) => `${cardHead}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

S['12d-factura'] = page(`
 <div class="card hero"><div class="lab">Factura del corte del 25 sept</div><div class="big">$ 598.400</div>
  <div class="sub">Págala completa antes del <b style="color:var(--tx)">viernes 10 de octubre</b> (faltan 9 días) y no pagas intereses.</div>
  <div style="margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('swap-horizontal')}Pagar la factura</span></div></div>
 ${facts('742.300', '143.900')}`);

// 4b. Paid in part: what is left, and the bar of what is paid.
S['12e-factura-parcial'] = page(`
 <div class="card hero"><div class="lab">Factura del corte del 25 sept</div><div class="big">$ 198.400 <span class="mu" style="font-size:15px;font-weight:500">de 598.400</span></div>
  ${bar(67)}<div class="sub" style="margin-top:8px">Pagaste 400.000 el 2 oct. Te faltan 198.400 antes del <b style="color:var(--tx)">viernes 10</b>.</div>
  <div style="margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('swap-horizontal')}Pagar lo que falta</span></div></div>
 ${facts('342.300', '143.900')}`);

// 4c. Paid in full.
S['12f-factura-pagada'] = page(`
 <div class="card" style="text-align:center;padding:18px;border-color:${tint(C.grn, .5)}">${ci('checkmark', C.grn, 50).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block;font-size:17px">Factura pagada</b>
  <div class="sub" style="margin-top:4px">Pagaste los 598.400 el 6 oct. La próxima factura se cierra el 25 oct.</div></div>
 ${facts('143.900', '143.900')}`);

// 4d. The day passed with something still owed.
S['12g-factura-vencida'] = page(`
 <div class="card hero" style="background:linear-gradient(145deg,${tint(C.red, .35)} 0%,${tint(C.red, .12)} 55%,#111b2f 100%);border-color:${tint(C.red, .5)}"><div class="lab">Factura del corte del 25 sept</div><div class="big r">$ 198.400</div>
  <div class="sub">Venció el viernes 10 de octubre (hace 2 días). Lo que falta ya genera intereses: págalo cuanto antes.</div>
  <div style="margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('swap-horizontal')}Pagar lo que falta</span></div></div>
 ${facts('342.300', '143.900')}`);

// 4e. No dates yet: the page says what they would give, one tap away.
S['12h-sin-fechas'] = page(`
 <div class="card" style="text-align:center;padding:18px">${ci('calendar-outline', C.blu, 50).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block;font-size:17px">Agrega las fechas de tu tarjeta</b>
  <div class="sub" style="margin:4px 0 12px">Con el día de corte y el de pago te digo cuánto pagar y hasta cuándo.</div>
  <span class="chip" style="color:var(--pr)">${ic('calendar-outline', '', 'width:18px;height:18px')}Poner las fechas</span></div>
 <div class="kpi" style="margin-top:12px"><div class="card"><span class="lab">Debes en total</span><b>742.300</b><span class="sub">de 1.100.000 de cupo</span></div>
  <div class="card"><span class="lab">Cupo disponible</span><b>357.700</b><span class="sub">para comprar</span></div></div>`).replace('Corte el 25 · pagas el 10', 'Tarjeta de crédito');

// 4f. Nothing owed.
S['12i-sin-deuda'] = page(`
 <div class="card" style="text-align:center;padding:18px;border-color:${tint(C.grn, .5)}">${ci('happy-outline', C.grn, 50).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block;font-size:17px">No debes nada</b>
  <div class="sub" style="margin-top:4px">Tienes todo el cupo libre: 1.100.000.</div></div>`);

export default S;
