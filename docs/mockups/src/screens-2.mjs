// Group 2 (v4, 2026-09-28): Cuentas, net worth and where it comes from,
// currencies and today's rates, creating an account (by hand or from a
// statement), editing one, its icon, colour and own image, archiving and
// deleting. Everything the accounts screen and its editor do today
// (docs/08-redesign-checklist.md, "Accounts" and "Currencies"), drawn with the
// rules of group 1: one line per name, minimal, the same row everywhere.
import { ic, ci, sq, C, ACC, PALETTE, accIcon, chev, down, tag, sw, top, tabs, status, tint } from './lib.mjs';

const S = {};
// A screen scrolled down: the content moves up under a fixed header.
const scrolled = (header, top, by, body, after = '') => `<div style="position:absolute;left:0;right:0;top:${top}px;bottom:0;overflow:hidden"><main style="margin-top:-${by}px">${body}</main></div><div style="position:absolute;left:0;right:0;top:0">${header}</div>${after}`;
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const LONG = 'Ahorro programado para el viaje de diciembre';
const pen = `<span class="mu" style="margin-left:2px">${ic('create-outline', '', 'width:19px;height:19px')}</span>`;
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);

// The screen's own title bar: the name, and the one action it has (a new
// account). The "+" in the bar below stays the way to a new MOVEMENT.
const head = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva cuenta</div></div>
 <div class="seg" style="margin-top:10px"><div class="on">Cuentas</div><div>Rendimientos</div></div></div>`;

// A row of the list: tapping it opens its movements in Inicio (as today); the
// pencil beside the amount edits it.
const acc = (icon, name, sub, amt, cls = '', extra = '') => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b>${sub ? `<small class="one">${sub}</small>` : ''}${extra}</div><div class="am ${cls}">${amt}</div>${pen}</div>`;
const cur = (code, amt, sub = '') => `<div class="row" style="padding-left:30px">${ci('ellipse', C.tea, 30).replace(ic('ellipse'), `<b style="font-size:10.5px">${code}</b>`)}<div class="tx"><b>${code}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="am">${amt}</div>${pen}</div>`;

const hero = missing => `<div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55 <span style="font-size:14px;font-weight:500" class="mu">COP</span></div>
  <div class="sub" style="margin-top:2px">Los brókers muestran lo que metiste, no lo que valen hoy.</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('information-circle-outline')}¿De dónde sale?</span></div>
  ${missing ? `<div style="display:flex;gap:8px;align-items:center;margin-top:10px;color:#f3d58a;font-size:13px">${ic('alert-circle-outline', '', 'width:18px;height:18px;flex:none')}<span>Falta la tasa de EUR: esa plata no está sumando</span></div>` : ''}</div>`;

const list = `<div class="seg" style="margin:12px 0 10px"><div class="on">Por monto</div><div>Por nombre</div></div>
 <div class="list">
  ${acc(accIcon('verde'), 'Ahorro Verde', '', '55.240.546,90')}
  ${acc(accIcon('azul'), 'Banco Azul', '', '12.480.300,00')}
  ${acc(ci('airplane-outline', PALETTE.ambar), LONG, '', '6.100.000,00')}
  <div class="row" style="padding-bottom:4px">${accIcon('global')}<div class="tx"><b>Global Viajes</b><small>3 monedas</small></div></div>
  ${cur('COP', '2.106.000,00')}${cur('USD', '120,00 <small class="mu" style="display:inline">USD</small>')}${cur('EUR', '50,00 <small class="mu" style="display:inline">EUR</small>', 'Sin tasa: no suma al patrimonio')}
  ${acc(accIcon('efectivo'), 'Efectivo', '', '180.000,00')}
  ${acc(accIcon('ambar'), 'Fiducia Ámbar', 'No cuenta para el patrimonio', '8.400.000,00', 'mu')}
  ${acc(accIcon('coral'), 'Tarjeta Coral', '3.872.900 disponible de 8.000.000', '−4.127.100,00', 'y', `<div class="pbar" style="margin-top:6px"><i style="width:52%;background:var(--yel)"></i></div>`)}
 </div>`;

// More of the screen, below the accounts: the currencies and the archived.
const more = `<div class="list" style="margin-top:12px">
  <div class="row">${sq('cash-outline', C.lim, 40)}<div class="tx"><b>Monedas y tasas</b><small class="one">COP, USD, EUR · TRM del 27 sept</small></div>${chev()}</div>
  <div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>Ver 1 cuenta archivada</b></div>${down()}</div></div>`;

S['2a-cuentas'] = `${head}<main>${hero(true)}${list}${more}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// "¿De dónde sale?": each account that counts and what it adds, the rate used
// for what is in another currency, what is left out and why.
S['2b-de-donde-sale'] = S['2a-cuentas'] + `<div class="scrim"></div><div class="sheet" style="top:96px"><div class="grab"></div>
 <div class="sh" style="flex-direction:column;align-items:stretch;gap:4px"><h2 style="text-align:center">Cómo se arma el patrimonio</h2><div class="sub" style="text-align:center">Cada cuenta que cuenta, con lo que aporta al total.</div></div>
 <div class="list">${[['verde', '55.240.546,90', ''], ['azul', '12.480.300,00', ''], [null, '6.100.000,00', ''], ['global', '2.575.480,00', 'COP 2.106.000 + 120 USD × 3.912,40'], ['dolar', '341.708,00', '87,34 USD × 3.912,40'], ['efectivo', '180.000,00', ''], ['coral', '−4.127.100,00', 'Deuda']]
  .map(([k, a, s]) => `<div class="row">${k ? accIcon(k, 36) : ci('airplane-outline', PALETTE.ambar, 36)}<div class="tx"><b class="one">${k ? ACC[k][2] : LONG}</b>${s ? `<small class="one">${s}</small>` : ''}</div><div class="am ${a.startsWith('−') ? 'y' : ''}">${a}</div></div>`).join('')}
  <div class="row">${ci('globe-outline', C.tea, 36)}<div class="tx"><b>Global Viajes · EUR</b><small>50,00 EUR · sin tasa, no se puede valorar</small></div><div class="am mu">—</div></div>
  <div class="row" style="background:var(--s2)"><div class="tx"><b>Patrimonio</b></div><div class="am" style="font-weight:700">48.312.740,55</div></div></div>
 <div class="hint" style="margin-top:10px">Lo que tienes en otra moneda vale la tasa de hoy, no la de cuando lo compraste. No entran: las archivadas ni las que marcaste como apartadas del patrimonio.</div>
 <div class="p" style="text-align:center;margin-top:12px;font-weight:500">Ver monedas y tasas</div></div>`;

// Currencies and today's rates, in one place: the TRM from the official
// source with its date and a refresh, each currency with the accounts it is in
// and the rate it is valued at today, typed or official.
const rateRow = (code, name, used, rate, how, cls = '') => `<div class="row"><span class="sq" style="display:grid;width:42px;height:42px;background:${tint(cls === 'y' ? C.yel : C.tea)};color:${cls === 'y' ? C.yel : C.tea};font-weight:700;font-size:12.5px">${code}</span>
  <div class="tx"><b class="one">${name}</b><small class="one">${used}</small></div><div class="am ${cls}">${rate}<small class="mu">${how}</small></div>${chev()}</div>`;
S['2c-monedas-y-tasas'] = `${top('Monedas y tasas', { right: `<div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Moneda</div>` })}<main>
 <div class="card hero"><div class="lab">Dólar hoy · TRM del 27 sept</div><div class="big">3.912,40</div>
  <div class="sub">Oficial · Superfinanciera</div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('refresh-outline')}Actualizar</span><span style="color:#8fe0b5;font-size:13px">Actualizada ahora</span></div></div>
 <div class="h">Tus monedas</div>
 <div class="list">
  ${rateRow('COP', 'Peso colombiano  $', 'En 9 cuentas', 'Principal', '')}
  ${rateRow('USD', 'Dólar estadounidense  US$', 'En 3 cuentas', '3.912,40', 'oficial')}
  ${rateRow('EUR', 'Euro  €', 'En 1 cuenta', 'Sin tasa', 'no se puede valorar', 'y')}</div>
 <div class="hint">Una moneda nueva queda disponible al crear una cuenta. Los decimales son siempre dos, como en pesos y dólares.</div>
 <div class="hint">Sin internet se queda la última tasa que había, y se dice.</div></main>`;

// Typing today's rate for a currency: saved with today's date.
S['2d-escribir-tasa'] = S['2c-monedas-y-tasas'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(`<span class="sq" style="display:grid;width:52px;height:52px;background:${tint(C.yel)};color:${C.yel};font-weight:700;font-size:14px;place-items:center">EUR</span>`)}
 <b style="font-size:18px">Tasa de hoy · EUR</b><div class="sub" style="margin:6px 0 14px">Cuánto vale un euro en pesos. Se guarda con la fecha de hoy; mañana puedes poner otra sin cambiar la de hoy.</div>
 <div class="field on" style="text-align:left"><div class="lab">EUR → COP</div><div class="v">4.580,00<span style="border-left:2px solid var(--pr);margin-left:1px"></span></div></div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Guardar</div></div></div>`;

// Adding a currency: the one dialog used wherever it is offered, refusing a
// code that exists rather than renaming it.
S['2e-agregar-moneda'] = S['2c-monedas-y-tasas'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('cash-outline', C.lim, 52))}<b style="font-size:18px">Agregar una moneda</b>
 <div class="field on" style="text-align:left;margin-top:14px;border-color:var(--red)"><div class="lab">Código</div><div class="v">USD</div></div>
 <div class="hint r" style="text-align:left;color:var(--red)">USD ya existe</div>
 <div class="field" style="text-align:left;margin-top:10px"><div class="lab">Nombre</div><div class="v">Dólar</div></div>
 <div class="field" style="text-align:left;margin-top:10px"><div class="lab">Símbolo</div><div class="v">US$</div></div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1;opacity:.45">Guardar</div></div></div>`;

// The account form. The face and the name together; below, one list of
// rows, each a label over its value (the movement form's shape).
const face = (icon, name, empty = false) => `<div style="display:flex;align-items:center;gap:14px"><div style="position:relative;flex:none">${icon}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center;color:#fff">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field ${empty ? 'on' : ''}" style="flex:1;min-width:0"><div class="lab">Nombre</div><div class="v one ${empty ? 'mu' : ''}">${name}</div></div></div>`;
const typePick = on => `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">${[['wallet-outline', C.blu, 'Bancaria'], ['card-outline', C.yel, 'Tarjeta'], ['cash-outline', C.lim, 'Efectivo'], ['trending-up-outline', C.gold, 'Inversión']]
  .map(([i, c, t], n) => `<div style="background:${n === on ? tint(c, .16) : 'var(--s1)'};border:1px solid ${n === on ? c : '#1f2c47'};border-radius:16px;padding:10px 4px;text-align:center;font-size:12.5px;${n === on ? '' : 'color:var(--mu)'}">${centred(ci(i, c, 34), 6)}${t}</div>`).join('')}</div>`;
const val = (k, v, extra = '', sub = '') => `<div class="row"><div class="tx"><span class="k">${k}</span><b class="one">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>${extra}</div>`;
const saveBar = t => `<div class="bar-top" style="position:absolute;left:0;right:0;top:0">${st}<div class="tt">${ic('close', 'back')}<h1>${t}</h1><div class="chip" style="padding:7px 14px;background:linear-gradient(135deg,var(--pr),var(--pr2));border:0;color:#fff;font-weight:500">${ic('checkmark', '', 'width:18px;height:18px')}Guardar</div></div></div>`;
const statementRow = (hint, busy = false) => `<div class="row">${ci('document-text-outline', C.pur, 38)}<div class="tx"><b>Importar extracto (PDF)</b><small>${hint}</small></div>${busy ? '' : chev()}</div>`;

S['2f-nueva-cuenta'] = `${saveBar('Nueva cuenta')}<main style="padding-top:92px">
 <div class="list">${statementRow('Saco de ahí el nombre del banco, el saldo con que empieza y la fecha. Los movimientos te los muestro para confirmar cuando guardes la cuenta.')}</div>
 <div class="h" style="justify-content:center">o escríbela tú</div>
 ${face(ci('wallet-outline', C.blu, 60), 'Nombre de la cuenta', true)}
 ${typePick(0)}
 <div class="list" style="margin-top:12px">
  ${val('Moneda', 'COP · Peso colombiano', down())}
  <div class="row plain" style="padding-top:2px">${ic('add', 'p', 'width:19px;height:19px')}<div class="tx"><b class="p" style="font-size:14px">Agregar una moneda</b></div></div>
  ${val('Saldo inicial', '0,00', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Abierta el', 'Hoy · domingo 27 sept', down())}</div>
 <div class="list" style="margin-top:12px"><div class="row"><div class="tx"><b>Cuenta para el patrimonio</b><small>Apágalo para brókers o plata apartada que no quieres sumar</small></div>${sw(true)}</div></div>
 </main>`;

// Reading a statement: tens of seconds on a phone, so it says the stage, the
// page and how far it is, and can be stopped (nothing is written until the end).
S['2g-leyendo-extracto'] = S['2f-nueva-cuenta'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('document-text-outline', C.pur, 56))}<b style="font-size:18px">Leyendo las páginas</b>
 <div class="sub" style="margin-top:4px">Página 3 de 5</div>
 <div class="pbar" style="margin-top:14px;height:8px"><i style="width:58%;background:var(--pr)"></i></div><div class="sub" style="margin-top:6px">58 %</div>
 <div class="btn ghost" style="margin-top:14px">Cancelar</div></div>`;

// ...and the form filled in from it.
S['2h-nueva-cuenta-desde-extracto'] = `${saveBar('Nueva cuenta')}<main style="padding-top:92px">
 <div class="card" style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;background:${tint(C.pur, .1)};border-color:${tint(C.pur, .45)}">${ic('sparkles-outline', '', `color:${C.pur};flex:none`)}<span class="sub" style="color:#ddd2ff">Llené lo que pude desde <b>extracto-agosto.pdf</b>. Al guardar la cuenta te muestro sus 47 movimientos para confirmarlos.</span></div>
 <div style="height:12px"></div>
 ${face(ci('wallet-outline', C.blu, 60), 'Banco Azul')}
 ${typePick(0)}
 <div class="list" style="margin-top:12px">
  ${val('Moneda', 'COP · Peso colombiano', down())}
  ${val('Saldo inicial', '9.214.806,12', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Abierta el', 'Jueves 31 jul 2026', down())}</div>
 <div class="list" style="margin-top:12px"><div class="row"><div class="tx"><b>Cuenta para el patrimonio</b></div>${sw(true)}</div></div>
 </main>`;

// Editing a card: the currency cannot change once it has movements; the limit
// is history (typed with the day it applies from), never a movement.
const cardBody = `<div style="height:12px"></div>
 ${face(accIcon('coral', 60), 'Tarjeta de crédito Rappi Visa Platinum')}
 ${typePick(1)}
 <div class="list" style="margin-top:12px">
  ${val('Moneda', 'COP · Peso colombiano', ic('lock-closed-outline', 'mu', 'width:18px;height:18px'), 'No se puede cambiar: todos los montos guardados están en esta moneda')}
  ${val('Saldo inicial', '0,00', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Abierta el', '12 mar 2024', down())}</div>
 <div class="h">Cupo</div>
 <div class="list">
  ${val('Cupo total', '8.000.000,00', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Vigente desde', 'Viernes 1 ago 2026', down())}</div>
 <div class="hint">Cambiar el cupo no mueve plata: tu deuda queda igual y solo cambia cuánto te queda disponible.</div>
 <div class="h">Historial de cupos</div>
 <div class="list">${[['8.000.000,00', '1 ago 2026'], ['6.500.000,00', '15 ene 2025'], ['800.000,00', '12 mar 2024', 'del backup']]
  .map(([a, d, t]) => `<div class="row"><div class="tx"><b>${a}</b><small>Desde ${d}</small></div>${t ? `<span class="mu" style="font-size:12.5px">${t}</span>` : ''}</div>`).join('')}</div>
 <div class="list" style="margin-top:12px">
  <div class="row"><div class="tx"><b>Cuenta para el patrimonio</b></div>${sw(true)}</div>
  <div class="row"><div class="tx"><b>Archivar</b><small>Se esconde de las listas, pero su historial se conserva</small></div>${sw(false)}</div>
  ${statementRow('La app lee el PDF y te muestra lo que encontró para que lo confirmes. Nada se guarda solo.')}</div>
 <div class="list" style="margin-top:12px"><div class="row">${ic('trash-outline', 'r')}<div class="tx"><b class="r">Eliminar esta cuenta</b><small>Se borran también sus 32 movimientos, y no se pueden recuperar.</small></div></div></div>
 <div style="height:30px"></div>`;
S['2i-editar-tarjeta'] = `${saveBar('Editar cuenta')}<main style="padding-top:80px">${cardBody}</main>`;
// The same form scrolled to its end, where the limit history and deleting live.
S['2j-editar-tarjeta-abajo'] = scrolled(saveBar('Editar cuenta'), 90, 520, cardBody);

S['2k-eliminar-cuenta'] = S['2j-editar-tarjeta-abajo'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('trash-outline', C.red, 54))}<b style="font-size:18px;display:block" class="one">¿Eliminar Tarjeta de crédito Rappi Visa Platinum?</b>
 <div class="sub" style="margin-top:6px">Se borran también sus 32 movimientos, y no se pueden recuperar.</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Eliminar</div></div></div>`;

// The face: Ícono first, then Color, then Imagen propia (the order Jose set
// for categories, kept for accounts). On top, the row as it will look.
const preview = (icon, sub = 'Disponible 3.872.900') => `<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${icon}
  <div style="flex:1;min-width:0"><div class="lab">Así se verá</div><b style="font-size:17px" class="one">Tarjeta Coral</b><div class="sub">${sub}</div></div><span class="y" style="font-weight:500">−4.127.100</span></div>`;
const faceTabs = on => `<div class="tabs" style="margin-top:8px">${['Ícono', 'Color', 'Imagen propia'].map(t => `<div class="${t === on ? 'on' : ''}">${t}</div>`).join('')}</div>`;

S['2l-cara-icono'] = `${top('Ícono y color', { left: 'x', right: `<span class="p" style="font-weight:500">Listo</span>` })}<main style="padding-top:10px">
 ${preview(ci('card-outline', PALETTE.ambar, 58))}${faceTabs('Ícono')}
 <div class="search" style="margin-top:12px">${ic('search-outline')}Buscar ícono</div>
 ${[['Bancos y tarjetas', ['wallet-outline', 'card-outline', 'cash-outline', 'business-outline', 'briefcase-outline', 'diamond-outline']], ['Ahorro e inversión', ['trending-up-outline', 'bar-chart-outline', 'leaf-outline', 'cube-outline', 'shield-checkmark-outline', 'logo-bitcoin']], ['Otros', ['globe-outline', 'airplane-outline', 'home-outline', 'school-outline', 'gift-outline', 'phone-portrait-outline']]]
  .map(([t, is]) => `<div class="lab" style="margin:14px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${is.map(i => { const on = i === 'card-outline';
   return `<div style="aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:${on ? tint(PALETTE.ambar, .22) : 'var(--s1)'};color:${on ? PALETTE.ambar : '#c9d2e3'};border:1px solid ${on ? PALETTE.ambar : '#1c2843'}">${ic(i, '', 'width:46%;height:46%')}</div>`; }).join('')}</div>`).join('')}
 </main>`;

const fams = [['Cálidos', ['coral', 'cereza', 'mandarina', 'ambar', 'oro', 'arena']], ['Verdes y azules', ['lima', 'esmeralda', 'menta', 'turquesa', 'cielo', 'zafiro']], ['Violetas y neutros', ['violeta', 'orquidea', 'rosa', 'pizarra']]];
S['2m-cara-color'] = `${top('Ícono y color', { left: 'x', right: `<span class="p" style="font-weight:500">Listo</span>` })}<main style="padding-top:10px">
 ${preview(ci('card-outline', PALETTE.ambar, 58))}${faceTabs('Color')}
 ${fams.map(([t, cs]) => `<div class="lab" style="margin:14px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${cs.map(n => { const c = PALETTE[n]; const on = n === 'ambar';
   return `<div style="aspect-ratio:1;border-radius:50%;background:${tint(c, .2)};color:${c};display:grid;place-items:center;position:relative;${on ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${ic('card-outline', '', 'width:45%;height:45%')}${on ? `<span style="position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:${c};color:#0b1222;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>` : ''}</div>`; }).join('')}</div>`).join('')}
 </main>`;

// Images the person uploaded: invented logos (no real brand), drawn so they
// read as pictures and never as colours. The first has a transparent
// background, so the account's colour shows behind it.
const LOGOS = [
  (z, bg = 'transparent') => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:${bg};flex:none"><path d="M9 25c5-9 11-9 22-3" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="28" cy="14" r="4" fill="#fff"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:#fff;flex:none"><text x="20" y="26" text-anchor="middle" font-family="Arial" font-weight="900" font-size="15" fill="#0b4fd1">BA</text><rect x="9" y="29" width="22" height="3" rx="1.5" fill="#f5b400"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:#1d1d1f;flex:none"><path d="M20 8l3.5 8 8.5.8-6.4 5.6 1.9 8.4L20 26.4l-7.5 4.4 1.9-8.4L8 16.8l8.5-.8z" fill="#ffcc33"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:#12a150;flex:none"><path d="M12 27c0-9 7-15 17-15-1 10-7 16-17 15z" fill="#fff"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:linear-gradient(135deg,#7b2ff7,#f107a3);flex:none"><text x="20" y="27" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#fff">n</text></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:50%;background:#e30613;flex:none"><circle cx="20" cy="20" r="9" fill="none" stroke="#fff" stroke-width="4"/><circle cx="20" cy="20" r="3" fill="#fff"/></svg>`,
];
const logoOn = (z, color) => LOGOS[0](z, color);

S['2n-cara-imagen-propia'] = `${top('Ícono y color', { left: 'x', right: `<span class="p" style="font-weight:500">Listo</span>` })}<main style="padding-top:10px">
 ${preview(logoOn(58, PALETTE.coral))}${faceTabs('Imagen propia')}
 <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:12px;border-style:dashed;border-color:#34466b">${ci('cloud-upload-outline', C.blu, 46)}<div class="tx"><b>Subir una imagen</b><small>PNG, JPG, WEBP o SVG, hasta 100 kB. Sirve para el logo de tu banco.</small></div></div>
 <div class="lab" style="margin:16px 2px 10px">Tus imágenes</div>
 <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;justify-items:center">${LOGOS.map((l, n) => `<div style="position:relative;border-radius:50%;${n === 0 ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--pr)` : ''}">${n === 0 ? logoOn(52, PALETTE.coral) : l(52)}${n === 0 ? `<span style="position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:var(--pr);color:#fff;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>` : ''}</div>`).join('')}</div>
 <div class="p" style="margin-top:12px;font-size:13.5px">Ver 4 imágenes más</div>
 <div class="hint" style="margin-top:12px">Se guardan dentro de tu copia de seguridad, y cualquier cuenta o categoría puede usarlas.</div>
 </main>`;

// An account whose face is its own image: the same pencil opens the same
// editor, so the image can be changed for another, for an icon, or given
// another colour.
S['2q-editar-cuenta-con-imagen'] = `${saveBar('Editar cuenta')}<main style="padding-top:80px"><div style="height:12px"></div>
 ${face(logoOn(60, PALETTE.coral), 'Tarjeta Coral')}
 ${typePick(1)}
 <div class="list" style="margin-top:12px">
  ${val('Moneda', 'COP · Peso colombiano', ic('lock-closed-outline', 'mu', 'width:18px;height:18px'))}
  ${val('Saldo inicial', '0,00', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Abierta el', '12 mar 2024', down())}</div>
 <div class="h">Cupo</div>
 <div class="list">${val('Cupo total', '8.000.000,00', '<span class="mu" style="font-size:13px">COP</span>')}${val('Vigente desde', 'Viernes 1 ago 2026', down())}</div>
 </main>`;

// The colour with an own image: it fills behind the image (a logo with a
// transparent background takes it) and stays the account's colour
// everywhere else. Each swatch is the image on that colour.
S['2r-cara-color-con-imagen'] = `${top('Ícono y color', { left: 'x', right: `<span class="p" style="font-weight:500">Listo</span>` })}<main style="padding-top:10px">
 ${preview(logoOn(58, PALETTE.cielo))}${faceTabs('Color')}
 ${fams.map(([t, cs]) => `<div class="lab" style="margin:14px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px;justify-items:center">${cs.map(n => { const c = PALETTE[n]; const on = n === 'cielo';
   return `<div style="position:relative;border-radius:50%;${on ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${logoOn(50, c)}${on ? `<span style="position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:${c};color:#0b1222;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>` : ''}</div>`; }).join('')}</div>`).join('')}
 <div class="hint" style="margin-top:12px">Con imagen propia, el color va detrás de la imagen y sigue siendo el color de la cuenta en el resto de la app.</div>
 </main>`;

// Archived accounts, opened below the list: history only.
S['2o-archivadas'] = scrolled(head, 146, 560, `<div style="height:12px"></div>${hero(false)}${list}
 <div class="list" style="margin-top:12px">
  <div class="row">${sq('cash-outline', C.lim, 40)}<div class="tx"><b>Monedas y tasas</b><small class="one">COP, USD, EUR · TRM del 27 sept</small></div>${chev()}</div>
  <div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>Ocultar 1 cuenta archivada</b></div>${ic('chevron-up-outline', 'mu', 'width:18px;height:18px')}</div></div>
 <div class="h">Archivadas</div>
 <div class="hint" style="margin:0 4px 8px">Historial nada más: esta plata ya no existe y no cuenta para el patrimonio.</div>
 <div class="list" style="opacity:.75">${acc(ci('school-outline', C.gry), 'Cuenta de la universidad', '', '0,00', 'mu')}</div>
 <div style="height:110px"></div>`, `<div class="fade"></div>${tabs('Cuentas')}`);

// A fresh install: an icon, one sentence, one action.
S['2p-cuentas-vacia'] = `${head}<main style="display:grid;place-items:center;height:640px;text-align:center;padding:0 32px">
 <div>${centred(ci('wallet-outline', C.blu, 72), 16)}<b style="font-size:19px">Todavía no hay cuentas</b>
 <div class="sub" style="margin:8px 0 18px">Crea tu primera cuenta. Si ya tienes datos guardados, tráelos desde "Importar y exportar" o desde tu cuenta de Google.</div>
 <div class="btn" style="padding:0 22px">${ic('add')}Nueva cuenta</div></div></main>${tabs('Cuentas')}`;

export default S;
