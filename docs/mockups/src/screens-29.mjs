// Group 29 - Cuentas: what you have and what you owe under net worth, and a
// card's "Cupo disponible" said as such (Jose, 2026-10-15, from a suggestion
// his partner got from another AI). Proposed, nothing built. Every figure
// invented; the two tiles always add up to net worth (same lines, split by sign).
import G1 from './screens-1.mjs';
import { ic, ci, sq, C, PALETTE, accIcon, chev, down, top, tabs, status, tint } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const pen = `<span class="mu" style="margin-left:2px">${ic('create-outline', '', 'width:19px;height:19px')}</span>`;
const head = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva cuenta</div></div>
 <div class="seg" style="margin-top:10px"><div class="on">${ic('wallet-outline')}Saldos</div><div>${ic('trending-up-outline')}Rendimientos</div><div>${ic('card-outline')}Deudas</div></div></div>`;

// The two tiles: each a figure, never "Ver detalle". The debts tile opens Deudas.
const tile = (icon, color, label, amount, under, link) => `<div style="flex:1;min-width:0;background:rgba(7,13,26,.35);border-radius:16px;padding:11px 12px">
  <div style="display:flex;align-items:center;gap:6px;color:${color};font-size:12.5px;font-weight:600">${ic(icon, '', 'width:16px;height:16px')}${label}${link ? `<span style="flex:1"></span>${ic('chevron-forward-outline', '', 'width:15px;height:15px')}` : ''}</div>
  <div style="font-size:17.5px;font-weight:700;margin-top:4px;white-space:nowrap">${amount}</div>
  <div class="mu" style="font-size:11.5px;margin-top:2px;line-height:1.3">${under}</div></div>`;

const hero = ({ worth, neg, have, haveN, owe, oweN }) => `<div class="card hero"><div class="lab">Patrimonio hoy</div>
  <div class="big" ${neg ? 'style="color:#f3d58a"' : ''}>$ ${worth} <span style="font-size:14px;font-weight:500" class="mu">COP</span></div>
  <div class="sub" style="margin-top:2px">Lo que tienes menos lo que debes</div>
  <div style="display:flex;gap:8px;margin-top:12px">
   ${tile('wallet-outline', '#8fe0b5', 'Lo que tienes', have, haveN)}
   ${tile('card-outline', '#f3d58a', 'Lo que debes', owe, oweN, true)}</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('information-circle-outline')}¿De dónde sale?</span></div></div>`;

const acc = (icon, name, sub, amt, cls = '', extra = '') => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b>${sub ? `<small class="one">${sub}</small>` : ''}${extra}</div><div class="am ${cls}">${amt}</div>${pen}</div>`;
// A card: its debt on the right, and the room left said as "Cupo disponible".
const card = (icon, name, avail, limit, debt, pct) => acc(icon, name, '', debt, 'y',
  `<small class="one">Disponible ${avail}</small>` +
  `<div class="pbar" style="margin-top:6px"><i style="width:${pct}%;background:var(--yel)"></i></div>`);

const sort = `<div class="seg" style="margin:12px 0 10px"><div class="on">Por monto</div><div>Por nombre</div></div>`;
const more = `<div class="list" style="margin-top:12px">
  <div class="row">${sq('cash-outline', C.lim, 40)}<div class="tx"><b>Monedas y TRM</b><small class="one">COP · USD · EUR · todas al día</small></div>${chev()}</div>
  <div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>Ver 1 cuenta archivada</b></div>${down()}</div></div>`;

// 1. Many accounts, net worth above zero.
S['29a-cuentas-tienes-y-debes'] = `${head}<main>${hero({ worth: '46.055.454,90', have: '60.192.554,90', haveN: 'En 6 cuentas', owe: '14.137.100,00', oweN: '1 tarjeta · 1 préstamo' })}
 ${sort}<div class="list">
  ${acc(accIcon('verde'), 'Ahorro Verde', '', '55.240.546,90')}
  ${acc(accIcon('azul'), 'Banco Azul', '', '4.430.300,00')}
  ${acc(accIcon('dolar'), 'Cuenta Dólar', '', '87,34 <small class="mu" style="display:inline">USD</small>')}
  ${acc(accIcon('efectivo'), 'Efectivo', '', '180.000,00')}
  ${card(accIcon('coral'), 'Tarjeta Coral', '3.872.900', '8.000.000', '−4.127.100,00', 52)}
  ${acc(ci('car-outline', PALETTE.mandarina), 'Préstamo del carro', 'Préstamo', '−10.010.000,00', 'y')}
  ${acc(accIcon('ambar'), 'Fiducia Ámbar', 'No cuenta para el patrimonio', '8.400.000,00', 'mu')}
 </div>${more}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// 2. Few accounts, owing more than there is: the figure in amber, and the two
//    tiles say at once why it is negative.
S['29b-cuentas-patrimonio-negativo'] = `${head}<main>${hero({ worth: '−2.319.125,87', neg: true, have: '1.480.874,13', haveN: 'En 1 cuenta', owe: '3.800.000,00', oweN: '1 tarjeta' })}
 ${sort}<div class="list">
  ${acc(accIcon('azul'), 'Banco Azul', '', '1.480.874,13')}
  ${card(accIcon('coral'), 'Tarjeta Coral', '1.200.000', '5.000.000', '−3.800.000,00', 76)}
 </div>${more}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// 3. "¿De dónde sale?" split the same way: what you have, what you owe, the total.
const line = (icon, name, amt, sub = '', cls = '') => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b>${sub ? `<small class="one">${sub}</small>` : ''}</div><div class="am ${cls}">${amt}</div></div>`;
S['29c-de-donde-sale'] = S['29a-cuentas-tienes-y-debes'] + `<div class="scrim"></div><div class="sheet" style="top:70px"><div class="grab"></div>
 <div class="sh" style="flex-direction:column;align-items:stretch;gap:4px"><h2 style="text-align:center">Cómo se arma el patrimonio</h2><div class="sub" style="text-align:center">Lo que tienes menos lo que debes, cuenta por cuenta.</div></div>
 <div class="h" style="color:#8fe0b5">Lo que tienes</div><div class="list">
  ${line(accIcon('verde', 36), 'Ahorro Verde', '55.240.546,90')}
  ${line(accIcon('azul', 36), 'Banco Azul', '4.430.300,00')}
  ${line(accIcon('dolar', 36), 'Cuenta Dólar', '341.708,00', '87,34 USD × 3.912,40')}
  ${line(accIcon('efectivo', 36), 'Efectivo', '180.000,00')}
  <div class="row" style="background:var(--s2)"><div class="tx"><b>Total</b></div><div class="am" style="font-weight:700">60.192.554,90</div></div></div>
 <div class="h" style="color:#f3d58a">Lo que debes</div><div class="list">
  ${line(accIcon('coral', 36), 'Tarjeta Coral', '−4.127.100,00', 'Cupo disponible 3.872.900', 'y')}
  ${line(ci('car-outline', PALETTE.mandarina, 36), 'Préstamo del carro', '−10.010.000,00', '', 'y')}
  <div class="row" style="background:var(--s2)"><div class="tx"><b>Total</b></div><div class="am y" style="font-weight:700">−14.137.100,00</div></div></div>
 <div class="list" style="margin-top:10px"><div class="row" style="background:var(--s2)"><div class="tx"><b>Patrimonio</b></div><div class="am" style="font-weight:700">46.055.454,90</div></div></div>
 <div class="hint" style="margin-top:10px">El cupo disponible de una tarjeta no suma: es plata del banco que puedes gastar, no plata tuya. No entran las archivadas ni las apartadas del patrimonio.</div></div>`;

// 4. Inicio on one card (Jose, 2026-10-15, from the same suggestion): today it
//    says "Debes hoy", one grey line and the bar. Proposed: the debt without
//    the minus (the label already says it is owed), "Cupo usado" with its
//    percent, the bar, Usado on the left and Disponible on the right, and the
//    total limit; the next payment when the card has its two days. No "Ver
//    movimientos": on Inicio the movements are right below.
const card1 = G1['1c-inicio-una-cuenta-nombre-largo'];
const oldHero = card1.match(/<div class="card hero">[\s\S]*?<div class="mini"/)[0];
const quickBtns = oldHero.match(/<div style="display:flex;gap:8px">[\s\S]*?<\/div><\/div>/)[0];
const half = (lab, v, right = false, cls = '') => `<div style="text-align:${right ? 'right' : 'left'}"><div class="mu" style="font-size:12px">${lab}</div><b class="${cls}" style="font-size:15px">${v}</b></div>`;
const cardHero = ({ due = true, limit = true } = {}) => `<div class="card hero"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1"><div class="lab">Debes hoy</div><div class="big y">4.127.100,00</div></div>${quickBtns}
  ${limit ? `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px"><span>Cupo usado</span><b>52 %</b></div>
  <div class="pbar" style="margin-top:6px;height:9px"><i style="width:52%;background:var(--yel)"></i></div>
  <div style="display:flex;justify-content:space-between;margin-top:8px">${half('Cupo disponible', '3.872.900,00', false, 'g')}${half('Cupo total', '8.000.000,00', true)}</div>`
  : `<div class="mu" style="font-size:12.5px;margin-top:6px">Sin cupo registrado · ponlo con el lápiz para ver cuánto te queda</div>`}
  ${due ? `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px 11px;border-radius:13px;background:rgba(7,13,26,.35);font-size:13px">${ic('calendar-outline', '', 'width:17px;height:17px;color:var(--yel);flex:none')}<span style="flex:1">Factura por pagar <b>491.125,00</b> · vence el 10 oct</span>${ic('chevron-forward-outline', '', 'width:15px;height:15px')}</div>` : ''}
  <div class="mini"`;
S['29d-inicio-tarjeta-hoy'] = card1;
S['29e-inicio-tarjeta-propuesta'] = card1.replace(oldHero, cardHero());
S['29f-inicio-tarjeta-sin-fechas'] = card1.replace(oldHero, cardHero({ due: false }));
S['29g-inicio-tarjeta-sin-cupo'] = card1.replace(oldHero, cardHero({ due: false, limit: false }));

export default S;
