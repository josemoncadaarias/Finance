// Group 32 - a credit card set up by what the bank's app shows (Jose,
// 2026-10-15: "no sé para qué preguntar por saldo inicial en una tarjeta de
// crédito... debería decir algo como cupo disponible en el momento"), and
// every way a card's Inicio can read. Proposed; the Inicio states (32d-32f)
// are already built. Every figure invented.
import G1 from './screens-1.mjs';
import { ic, ci, C, chev, down, sw, status, tint } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);

// ---------------------------------------------------------------------------
// The form, as the account form draws it (2f), for a card.
const face = name => `<div style="display:flex;align-items:center;gap:14px"><div style="position:relative;flex:none">${ci('card-outline', C.yel, 60)}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center;color:#fff">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field" style="flex:1;min-width:0"><div class="lab">Nombre</div><div class="v one">${name}</div></div></div>`;
const types = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">${[['wallet-outline', C.blu, 'Bancaria'], ['card-outline', C.yel, 'Tarjeta'], ['cash-outline', C.lim, 'Efectivo'], ['trending-up-outline', C.gold, 'Inversión']]
  .map(([i, c, t], n) => `<div style="background:${n === 1 ? tint(c, .16) : 'var(--s1)'};border:1px solid ${n === 1 ? c : '#1f2c47'};border-radius:16px;padding:10px 4px;text-align:center;font-size:12.5px;${n === 1 ? '' : 'color:var(--mu)'}">${centred(ci(i, c, 34), 6)}${t}</div>`).join('')}</div>`;
const val = (k, v, extra = '', sub = '', on = false) => `<div class="row" ${on ? 'style="outline:2px solid var(--pr);outline-offset:-2px;border-radius:14px"' : ''}><div class="tx"><span class="k">${k}</span><b class="one">${v}</b>${sub ? `<small style="white-space:normal">${sub}</small>` : ''}</div>${extra}</div>`;
const cop = '<span class="mu" style="font-size:13px">COP</span>';
const saveBar = t => `<div class="bar-top" style="position:absolute;left:0;right:0;top:0">${st}<div class="tt">${ic('close', 'back')}<h1>${t}</h1><div class="chip" style="padding:7px 14px;background:linear-gradient(135deg,var(--pr),var(--pr2));border:0;color:#fff;font-weight:500">${ic('checkmark', '', 'width:18px;height:18px')}Guardar</div></div></div>`;
const seg = on => `<div class="seg" style="margin:0 0 10px"><div class="${on === 0 ? 'on' : ''}">Sé mi cupo disponible</div><div class="${on === 1 ? 'on' : ''}">Sé lo que debo</div></div>`;
// What the app works out from what was typed, said under the two figures.
const result = (lab, amount, sub, cls = 'y') => `<div style="display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:16px;background:var(--s1);border:1px solid #1f2c47">
  ${ic('calculator-outline', '', 'width:22px;height:22px;color:var(--pr);flex:none')}
  <div style="flex:1;min-width:0"><div class="mu" style="font-size:12.5px">${lab}</div><b class="${cls}" style="font-size:19px">${amount}</b><div class="mu" style="font-size:12px;margin-top:2px;line-height:1.35">${sub}</div></div></div>`;
const rest = `<div class="list" style="margin-top:12px">${val('Abierta el', 'Hoy · jueves 15 oct', down())}</div>
 <div class="h">Fechas de la tarjeta</div><div class="list" style="display:grid;grid-template-columns:1fr 1fr;gap:1px">${val('Corte', '20', '<span class="mu" style="font-size:12px">de cada mes</span>')}${val('Pago', '1', '<span class="mu" style="font-size:12px">del mes siguiente</span>')}</div>`;
const form = (body, title = 'Nueva cuenta') => `${saveBar(title)}<main style="padding-top:92px">
 ${face('Tarjeta Coral')}${types}
 <div class="list" style="margin-top:12px">${val('Moneda', 'COP · Peso colombiano', down())}</div>
 <div class="h">Cómo está hoy</div>${body}${rest}<div style="height:40px"></div></main>`;

// A. Recommended: the two figures the bank's app shows, and the debt worked out.
S['32a-tarjeta-nueva-cupo-disponible'] = form(`${seg(0)}<div class="list">
  ${val('Cupo total', '7.500.000,00', cop)}
  ${val('Cupo disponible hoy', '5.200.000,00', cop, 'Lo que te deja gastar la app del banco ahora mismo', true)}</div>
  ${result('Debes hoy', '2.300.000,00', 'Cupo total menos el disponible. Las compras que registres desde hoy se suman a esto.')}`);

// B. Without the limit at hand: what is owed, typed as the bank says it (no minus).
S['32b-tarjeta-nueva-lo-que-debo'] = form(`${seg(1)}<div class="list">
  ${val('Lo que debes hoy', '2.300.000,00', cop, 'Como lo dice el banco, sin signo menos', true)}
  ${val('Cupo total', 'Opcional', cop, 'Ponlo para ver cuánto te queda disponible')}</div>`);

// C. Nothing owed, or money in favour: said back, so a typo is seen before saving.
S['32c-tarjeta-nueva-saldo-a-favor'] = form(`${seg(0)}<div class="list">
  ${val('Cupo total', '7.500.000,00', cop)}
  ${val('Cupo disponible hoy', '7.560.000,00', cop, 'Lo que te deja gastar la app del banco ahora mismo', true)}</div>
  ${result('Saldo a favor', '60.000,00', 'El disponible pasa tu cupo: pagaste de más o te devolvieron plata. No debes nada.', 'g')}`);

// D. Editing a card already in use: the same two figures, as of today; saving
//    moves only the figure it started with, never a movement.
S['32d-editar-tarjeta'] = form(`<div class="list">
  ${val('Cupo total', '7.500.000,00', cop)}
  ${val('Cupo disponible hoy', '3.872.900,00', cop, 'Si el banco dice otra cifra, escríbela: ajusto con qué empezó la tarjeta, sin tocar tus movimientos', true)}</div>
  ${result('Debes hoy', '3.627.100,00', 'Con tus 14 movimientos desde que la abriste.')}`, 'Editar cuenta');

// ---------------------------------------------------------------------------
// Inicio on a card, every state (built).
const card1 = G1['1c-inicio-una-cuenta-nombre-largo'];
const oldHero = card1.match(/<div class="card hero">[\s\S]*?<div class="mini"/)[0];
const quickBtns = oldHero.match(/<div style="display:flex;gap:8px">[\s\S]*?<\/div><\/div>/)[0];
const half = (lab, v, right = false, cls = '') => `<div style="text-align:${right ? 'right' : 'left'}"><div class="mu" style="font-size:12px">${lab}</div><b class="${cls}" style="font-size:15px">${v}</b></div>`;
const hero = ({ lab, big, bigCls = '', pct, pctCls = '', bar, left, leftV, leftCls }) => `<div class="card hero"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1"><div class="lab">${lab}</div></div>${quickBtns}
  <div class="big ${bigCls}">${big}</div>
  <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px"><span>Cupo usado</span><b class="${pctCls}">${pct} %</b></div>
  <div class="pbar" style="margin-top:6px;height:9px"><i style="width:${bar}%;background:${pctCls === 'r' ? 'var(--red)' : 'var(--yel)'}"></i></div>
  <div style="display:flex;justify-content:space-between;margin-top:8px">${half(left, leftV, false, leftCls)}${half('Cupo total', '7.500.000,00', true)}</div>
  <div class="mini"`;
S['32e-inicio-tarjeta-no-debes'] = card1.replace(oldHero, hero({ lab: 'No debes nada', big: '0,00', pct: 0, bar: 0, left: 'Cupo disponible', leftV: '7.500.000,00', leftCls: 'g' }));
S['32f-inicio-tarjeta-saldo-a-favor'] = card1.replace(oldHero, hero({ lab: 'Saldo a favor', big: '60.000,00', bigCls: 'g', pct: 0, bar: 0, left: 'Cupo disponible', leftV: '7.560.000,00', leftCls: 'g' }));
S['32g-inicio-tarjeta-pasada-del-cupo'] = card1.replace(oldHero, hero({ lab: 'Debes hoy', big: '7.860.000,00', bigCls: 'y', pct: 105, pctCls: 'r', bar: 100, left: 'Te pasaste del cupo por', leftV: '360.000,00', leftCls: 'r' }));

export default S;
