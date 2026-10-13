// Group 24 - "No es un movimiento" (2026-10-13, for Jose to decide; nothing
// built). An advert or any other message read as money that did not move:
// saying so once teaches the app, for that source only. Every name, shop and
// figure invented.
import { ic, ci, C, tint, top, tabs, sw, chev } from './lib.mjs';
import { typeSeg, amount, end, note, infoDot } from './screens-1.mjs';

const S = {};
const R = C.red, B = C.blu, Y = C.yel, G = C.grn;
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const toast = t => `<div style="position:absolute;left:16px;right:16px;bottom:104px;background:#26324f;border:1px solid #3a4a72;border-radius:16px;padding:12px 14px;font-size:13.5px;line-height:1.4;display:flex;gap:10px;align-items:center">${ic('school-outline', '', `width:20px;height:20px;flex:none;color:${G}`)}<span>${t}</span></div>`;

// 1. The phone's own notice: "Descartar" becomes "No es movimiento".
const notice = (actions) => `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#5d6b86,#2c3346 45%,#4a5a48)"></div>
 <div style="position:absolute;left:14px;right:14px;top:60px;background:#202226;border-radius:28px;padding:18px 20px">
  <div style="display:flex;align-items:center;gap:10px;color:#c9cdd6;font-size:14px"><span style="width:34px;height:34px;border-radius:50%;background:${B};display:grid;place-items:center">${ic('wallet-outline', '', 'width:18px;height:18px;color:#fff')}</span>Finance · ahora</div>
  <b style="display:block;font-size:19px;margin-top:12px">🔔 Movimiento detectado · $ 24.900</b>
  <div style="color:#c9cdd6;font-size:14.5px;line-height:1.45;margin-top:6px">Tienda Sol: Hamburguesa doble a $24.900, llévala hoy y recíbela en 20 minutos<br>¿Lo guardamos? Revísalo antes, no se guarda solo.</div>
  <div style="display:flex;justify-content:space-between;margin-top:16px;color:#a8c7fa;font-weight:600;font-size:15px">${actions}</div></div>
 <div style="position:absolute;left:14px;right:14px;top:300px;background:#202226;border-radius:28px;padding:18px 20px;color:#c9cdd6">
  <div style="font-size:14px">Tienda Sol · ahora</div><b style="display:block;font-size:17px;margin-top:8px;color:#fff">Antojo de hamburguesa</b>
  <div style="font-size:14px;margin-top:4px">Hamburguesa doble a $24.900, llévala hoy…</div></div>`;
S['24a-aviso-no-es-movimiento'] = notice('<span>Revisar y guardar</span><span>Más tarde</span><span style="color:#f2b8b5">No es movimiento</span>');

// 2. In Revisar movimiento the bin asks what it was.
const said = line => `<div style="display:flex;align-items:center;gap:8px;background:#0a1222;border:1px dashed #2a3a5c;border-radius:12px;padding:8px 11px;margin-top:10px">${ic('notifications-outline', '', `width:17px;height:17px;flex:none;color:${B}`)}<span class="one" style="font-size:12.5px;color:#b9c3d8">${line}</span>${infoDot}</div>`;
const form = `${top('Revisar movimiento', { left: 'x', right: `<span class="btn-r mu" style="margin-right:6px">${ic('eye-off-outline')}</span><span class="btn-r" style="color:var(--red)">${ic('trash-outline')}</span>` })}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${said('Tienda Sol: Hamburguesa doble a $24.900, llévala hoy y recíbela…')}
 ${amount('−', 'r', '24.900')}
 <div class="list">${end(ci('storefront-outline', Y, 38), 'Desde dónde', 'Elige la cuenta')}<div class="row">${ic('pricetag-outline', 'mu')}<div class="tx"><span class="k">Categoría</span><b class="mu">Elige una</b></div>${ic('chevron-down-outline', 'chev')}</div>${note('Tienda Sol', 'del aviso')}</div></main><div style="position:absolute;left:16px;right:16px;bottom:26px;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">Guardar</div>`;
const option = (icon, c, title, sub) => `<div class="row" style="padding:13px 14px">${ci(icon, c, 40)}<div class="tx"><b style="font-size:15px">${title}</b><small style="white-space:normal;line-height:1.35">${sub}</small></div></div>`;
S['24b-papelera-pregunta'] = form + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center"><b style="font-size:18px">¿Qué es este mensaje?</b></div>
 <div class="list" style="margin-top:12px">
  ${option('megaphone-outline', R, 'No es un movimiento', 'Publicidad, un aviso o un saldo. La app aprende y no te ofrece mensajes así de Tienda Sol.')}
  ${option('trash-outline', 'var(--mu)', 'Es un movimiento, pero no lo quiero', 'Solo se descarta. La app no aprende nada.')}</div>
 <div style="text-align:center;margin-top:12px" class="p">Cancelar</div></div>`;

// 3. What it says once taught.
S['24c-aprendido'] = `${top('Movimientos por revisar')}<main style="padding-top:20px;text-align:center">${centred(ci('checkmark-done-outline', G, 72), 14)}<b style="font-size:17px">Nada por revisar</b></main>${tabs('Más')}`
  + toast('Listo. De Tienda Sol ya no te ofreceré mensajes así.<br><span class="p" style="font-weight:600">Deshacer</span>');

// 4. The source's own page: what it learned, and how to undo it.
const msg = (when, text, what, c, undo) => `<div class="row" style="align-items:flex-start;padding:11px 14px"><div class="tx"><small style="font-size:12px">${when}</small><b style="font-size:14px;white-space:normal;line-height:1.35;font-weight:500">${text}</b>
 <div style="display:flex;gap:8px;align-items:center;margin-top:5px;font-size:12.5px"><span style="color:${c}">${what}</span>${undo ? `<span class="p" style="font-weight:600">${undo}</span>` : ''}</div></div></div>`;
S['24d-pagina-de-la-fuente'] = `${top('Tienda Sol', { sub: 'App · Billetera Sol' })}<main style="padding-top:10px">
 <div class="card" style="padding:14px">
  <div style="display:flex;gap:12px;align-items:center">${ci('school-outline', G, 40)}<div style="flex:1"><b style="font-size:15px">Solo lo que diga que la plata se movió</b>
   <div class="mu" style="font-size:13px;line-height:1.4;margin-top:3px">Aprendido de 2 mensajes que marcaste como "No es un movimiento". Te ofrezco solo los que digan "compraste", "recibiste", "pagaste"…</div></div>${sw(true)}</div></div>
 <div style="font-size:13px;font-weight:700;margin:16px 4px 8px" class="mu">ÚLTIMOS MENSAJES</div>
 <div class="list">
  ${msg('Hoy 6:40 p. m.', 'Hamburguesa doble a $24.900, llévala hoy…', 'No es un movimiento · lo marcaste', R, 'Sí era un movimiento')}
  ${msg('Hoy 1:12 p. m.', 'Pagaste $18.500 en Tienda Sol con tu Billetera Sol', 'Guardado', G, '')}
  ${msg('Ayer 7:05 p. m.', 'Combo familiar a $49.900, solo esta noche', 'No sonó · se parece a lo que marcaste', 'var(--mu)', 'Sí era un movimiento')}</div>
 </main>${tabs('Más')}`;

export default S;
