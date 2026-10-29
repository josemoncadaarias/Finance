// Group 46 - "Movimientos por revisar", made simple (Jose, 2026-10-29: "es
// tanta información que el usuario se pierde... FÁCIL Y SENCILLO"). Two
// levels: first where things came from (a statement, a bank's messages),
// one card each; then one of them, with only what is needed to save it.
// "Movimientos que se repiten" leaves the screen: choosing a category for a
// shop offers it to that shop's other rows. Names and figures invented.
import { ic, C, tint, top, ci, sq, accIcon, catIcon, chev, tabs } from './lib.mjs';

const S = {};
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.4">${t}</div>`;
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}</div>`;
const search = `<span class="btn-r">${ic('search-outline')}</span>`;

// 46a - the list of origins: one card each, saying in words what it needs.
const origin = (icon, color, name, line, need) => `<div class="row">${ci(icon, color, 42)}<div class="tx"><b>${name}</b><small>${line}</small>${need ? `<small class="y">${need}</small>` : ''}</div>${chev()}</div>`;
S['46a-por-revisar-origenes'] = `${top('Movimientos por revisar', { right: search })}<main>
 <div class="list">
  ${origin('document-text-outline', C.pur, 'Extracto de Banco Verde', 'Septiembre · 18 movimientos', '3 necesitan que elijas la categoría')}
  ${origin('chatbubble-ellipses-outline', C.cya, 'Mensajes de Banco Azul', '4 movimientos de esta semana', '')}
  ${origin('notifications-outline', C.blu, 'Avisos de Cajita Naranja', '2 movimientos de hoy', '')}</div>
 ${note('Toca uno para revisar sus movimientos. Nada se guarda hasta que tú lo digas.')}
 <div class="btn ghost" style="margin-top:14px">${ic('document-text-outline')}Importar otro extracto</div></main>${tabs('Más', true)}`;

// One movement row: what it is, the day, the figure; amber when it needs something.
const mov = (cat, title, day, amount, need = false) => `<div class="row">${cat ? catIcon(cat, 38) : sq('help', C.yel, 38)}
 <div class="tx"><b>${title}</b><small class="${need ? 'y' : ''}">${need ? 'Elige la categoría' : day}</small></div><div class="am r">${amount}</div></div>`;

// 46b - one statement: whether it adds up, in one plain line; the button; the
// rows needing something first; the rest by day; what you had already, last.
const statementHead = (okLine, okColor, okIcon) => `<div class="card" style="padding:14px">
 <div style="display:flex;gap:12px;align-items:center">${accIcon('verde', 42)}<div class="tx"><b>Banco Verde</b><small>Extracto de septiembre · 18 movimientos</small></div></div>
 <div style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13.5px;line-height:1.4;color:${okColor}">${ic(okIcon, '', 'width:18px;height:18px;flex:none;margin-top:1px')}<span>${okLine}</span></div>
 <div class="btn" style="margin-top:12px">Guardar los 15 listos</div></div>`;
const listBody = `<div class="h">Te falta elegir algo · 3</div><div class="list">
  ${mov('', 'Uber', '', '−18.400', true)}${mov('', 'Farmacia Central', '', '−32.900', true)}${mov('', 'Pago PSE 4471', '', '−120.000', true)}</div>
 <div class="h">Listos · 15</div><div class="list">
  ${mov('mercado', 'Supermercado La 80', '28 sep · Mercado', '−186.400')}${mov('rest', 'Almuerzo Don Pepe', '27 sep · Restaurantes', '−24.000')}${mov('salario', 'Nómina', '25 sep · Salario', '+3.200.000').replace('am r', 'am g')}
  <div class="row plain"><div class="tx"><b class="p" style="font-size:14px">Ver los otros 12</b></div>${chev()}</div></div>
 <div class="list" style="margin-top:14px"><div class="row plain"><div class="tx"><b style="font-size:14px">2 ya los tenías registrados</b><small>No se guardan otra vez</small></div>${chev()}</div></div>`;
S['46b-un-extracto'] = `${top('Extracto de Banco Verde', { right: search })}<main>
 ${statementHead('El extracto cuadra: el saldo inicial más los movimientos da el saldo final que dice el banco.', C.grn, 'checkmark-circle')}
 ${listBody}</main>`;

// 46c - choosing a category for one shop offers it to the shop's other rows.
S['46c-mismo-comercio'] = S['46b-un-extracto'] + sheet(`<div style="text-align:center">${catIcon('transp', 54).replace('display:grid', 'display:grid;margin:0 auto 10px')}
 <b style="font-size:18px">Uber aparece 5 veces en este extracto</b>
 <div class="mu" style="font-size:13.5px;line-height:1.45;margin-top:6px">¿Les pongo Transporte a todos?</div></div>
 <div class="btn" style="margin-top:16px">Sí, a los 5</div>
 <div class="btn ghost" style="margin-top:8px">Solo a este</div><div style="height:6px"></div>`);

// 46d - a statement that does not add up: said once, plainly, with what to do.
S['46d-no-cuadra'] = `${top('Extracto de Banco Verde', { right: search })}<main>
 ${statementHead('El extracto no cuadra por $ 45.900. Puede que la app haya leído mal una cifra: revisa los movimientos antes de guardarlos.', C.yel, 'alert-circle')}
 ${listBody}</main>`;

// 46e - all saved: what happened, and only then the opening balance, in words.
S['46e-guardado'] = `${top('Extracto de Banco Verde')}<main>
 <div class="card" style="text-align:center;padding:20px 16px">${ci('checkmark', C.grn, 56).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:18px">Guardaste los 18 movimientos</b>
  <div class="mu" style="font-size:13.5px;margin-top:6px">Ya están en Banco Verde.</div></div>
 <div class="card" style="margin-top:12px;padding:14px">
  <b style="font-size:15px">Tu cuenta dice $ 2.040.300 y el banco $ 4.120.300 al 30 de septiembre</b>
  <div class="mu" style="font-size:13.3px;line-height:1.4;margin-top:6px">Casi siempre es dinero de antes de que usaras la app. ¿Ajustamos el saldo inicial para que quede igual que el banco? No cambia ningún movimiento.</div>
  <div class="btn" style="margin-top:12px;height:44px">Ajustar el saldo inicial</div>
  <div class="p" style="text-align:center;margin-top:10px;font-size:14px">Dejarlo así</div></div>
 <div class="btn ghost" style="margin-top:14px">Volver a Movimientos por revisar</div></main>`;

export default S;
