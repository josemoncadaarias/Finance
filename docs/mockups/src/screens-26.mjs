// Group 26 - a loan already being paid, asked with as little as possible
// (Jose, 2026-10-14). Proposed, nothing built. Every figure invented and
// worked out: 60,000,000 lent at 16.5 % E.A., 60 monthly installments of
// 1,439,066 (plus 42,000 of insurance), 26 paid, 34 left.
import { ic, ci, sq, C, tint, top, down, chev, tabs } from './lib.mjs';

const S = {};
const P = C.blu;
const btn = (t, kind = 'pr') => kind === 'pr'
  ? `<div style="flex:1;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">${t}</div>`
  : `<div style="flex:1;height:50px;border-radius:15px;background:var(--s2);border:1px solid #2c3d63;display:grid;place-items:center;font-weight:600;color:var(--pr)">${t}</div>`;
const foot = (...b) => `<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 26px;background:linear-gradient(transparent,var(--bg) 30%);display:flex;gap:10px">${b.join('')}</div>`;
const field = (k, v, sub = '', tagHtml = '') => `<div class="row" style="padding:12px 14px"><div class="tx"><span class="k">${k}</span><b style="font-size:17px">${v}</b>${sub ? `<small class="wrap">${sub}</small>` : ''}</div>${tagHtml}</div>`;
const read = `<span class="chip" style="padding:3px 8px;font-size:11.5px;color:${C.grn};background:${tint(C.grn, .14)};border:0">${ic('document-text-outline', '', 'width:13px;height:13px')}Del extracto</span>`;
const worked = `<span class="chip" style="padding:3px 8px;font-size:11.5px;color:${P};background:${tint(P, .14)};border:0">${ic('calculator-outline', '', 'width:13px;height:13px')}Calculada</span>`;
const big = (icon, c, title, sub) => `<div class="row" style="padding:16px 14px;align-items:flex-start">${ci(icon, c, 46)}<div class="tx"><b style="font-size:16px">${title}</b><small class="wrap" style="line-height:1.4;margin-top:3px">${sub}</small></div>${chev()}</div>`;

// 1. The first question decides the form.
S['26a-nueva-o-vigente'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:14px">
 <div style="text-align:center;margin:6px 0 14px"><b style="font-size:19px">¿Cómo está este préstamo?</b></div>
 <div class="list">
  ${big('sparkles-outline', C.grn, 'Es nuevo', 'Te lo desembolsan ahora o hace poco. Necesitas el monto, la tasa y el plazo.')}
  ${big('time-outline', P, 'Ya lo vengo pagando', 'Solo lo que muestra hoy la app o el extracto del banco: cuánto debes, tu cuota y cuántas faltan.')}
 </div>
 <div class="hint" style="margin-top:12px">Si tienes el extracto en PDF, la app lo lee y llena casi todo.</div></main>`;

// 2. Already being paid: three figures the bank always shows.
S['26b-vigente-tres-datos'] = `${top('Préstamo que ya pagas', { left: 'x' })}<main style="padding-top:8px">
 <div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:center;margin-bottom:10px">${ci('document-text-outline', C.pur, 38)}<div style="flex:1"><b style="font-size:14.5px">Leer el extracto del préstamo</b><div class="mu" style="font-size:12.5px">PDF del banco · opcional</div></div>${chev()}</div>
 <div class="list">${field('Nombre', 'Carro')}
  ${field('Cuánto debes hoy', '$ 39.465.198', 'El saldo de capital que muestra el banco')}
  ${field('Tu cuota', '$ 1.481.066', 'Lo que pagas cada mes, con seguro si lo trae')}
  ${field('Cuántas cuotas faltan', '34', 'Próxima: 15 de noviembre')}</div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('wallet-outline', C.blu, 38)}<div class="tx"><span class="k">Se paga desde</span><b>Banco Azul</b></div>${down()}</div></div>
 <div class="hint" style="margin-top:10px">Con estos tres datos la app calcula la tasa y el resto del plan.</div>
 </main>${foot(btn('Continuar'))}`;

// 3. What the app works out, to confirm or correct.
S['26c-lo-que-calcula'] = `${top('Préstamo que ya pagas', { left: 'back' })}<main style="padding-top:8px">
 <div class="card" style="padding:14px;background:${tint(P, .1)};border-color:${tint(P, .35)}">
  <div class="lab">Con tu cuota sin el seguro, tu tasa sale en</div><div style="font-size:26px;font-weight:700;margin-top:2px">16,50 % E.A.</div>
  <div class="mu" style="font-size:13px;margin-top:2px">1,28 % mensual · por debajo de la usura (29,24 %)</div></div>
 <div class="list" style="margin-top:10px">
  ${field('Tasa', '16,50 % E.A.', '¿Tu extracto dice otra? Escríbela y ganará la tuya', worked)}
  ${field('Seguro dentro de la cuota', '$ 42.000', 'Escríbelo si tu cuota lo trae: sin él la tasa sale más alta de lo que es')}
  ${field('Termina', 'Agosto de 2029', '34 cuotas desde noviembre')}
  ${field('Intereses que faltan por pagar', '$ 9.463.045', 'Si pagas cuota a cuota, sin abonos')}</div>
 </main>${foot(btn('Atrás', 'sec'), btn('Guardar préstamo'))}`;

// 4. Optional: what was paid before the app, only if the person wants it.
S['26d-lo-ya-pagado'] = `${top('Préstamo que ya pagas', { left: 'back' })}<main style="padding-top:8px">
 <div style="margin:4px 4px 8px"><b>¿Quieres ver lo que ya pagaste?</b><div class="mu" style="font-size:13px;margin-top:2px;line-height:1.4">Opcional. Con uno de estos dos datos la app estima lo pagado antes de usarla.</div></div>
 <div class="list">
  ${field('Cuánto te prestaron', '$ 60.000.000', 'El monto del desembolso')}
  ${field('O cuándo te lo desembolsaron', 'Septiembre de 2024', '26 cuotas pagadas hasta hoy')}</div>
 <div class="card" style="margin-top:10px;padding:14px">
  <div class="lab">Antes de la app, aproximado</div>
  <div style="display:flex;gap:10px;margin-top:8px"><div style="flex:1"><div class="mu" style="font-size:12.5px">Pagado</div><b style="font-size:17px">$ 38.507.716</b></div><div style="flex:1"><div class="mu" style="font-size:12.5px">De eso, intereses</div><b style="font-size:17px;color:var(--red)">$ 16.880.913</b></div></div>
  <div class="mu" style="font-size:12.5px;margin-top:8px;line-height:1.4">Calculado con tu tasa y tu cuota. No crea movimientos: es solo para que veas el préstamo completo.</div></div>
 <div class="hint" style="margin-top:10px">Puedes saltarte esto y agregarlo después desde el préstamo.</div>
 </main>${foot(btn('Saltar', 'sec'), btn('Guardar préstamo'))}`;

// 5. From a statement: the same fields, filled and marked.
S['26e-desde-el-extracto'] = `${top('Préstamo que ya pagas', { left: 'x' })}<main style="padding-top:8px">
 <div class="card" style="padding:12px 14px;display:flex;gap:10px;align-items:center;margin-bottom:10px;background:${tint(C.grn, .1)};border-color:${tint(C.grn, .35)}">${ci('checkmark-done-outline', C.grn, 38)}<div style="flex:1"><b style="font-size:14.5px">Leí el extracto</b><div class="mu" style="font-size:12.5px">extracto-credito-oct-2026.pdf · revisa antes de guardar</div></div></div>
 <div class="list">${field('Cuánto debes hoy', '$ 39.465.198', '', read)}
  ${field('Tu cuota', '$ 1.481.066', 'Capital e intereses $ 1.439.066 · seguro $ 42.000', read)}
  ${field('Cuántas cuotas faltan', '34', 'Próxima: 15 de noviembre', read)}
  ${field('Tasa', '16,50 % E.A.', 'El extracto dice 1,28 % M.V.', read)}
  ${field('Cuánto te prestaron', '$ 60.000.000', '', read)}</div>
 <div class="hint" style="margin-top:10px">Lo que el extracto no traiga, lo calcula la app o te lo pregunta.</div>
 </main>${foot(btn('Guardar préstamo'))}`;

// 6. The loan's page afterwards: before the app estimated, from now exact.
S['26f-resumen'] = `${top('Carro', { sub: 'Préstamo · Banco Azul' })}<main style="padding-top:6px">
 <div class="card hero" style="padding:16px"><div class="lab">Debes hoy</div><div class="big">$ 39.465.198</div><div class="mu" style="font-size:13px">34 cuotas de $ 1.481.066 · termina agosto 2029</div></div>
 <div class="list" style="margin-top:10px">
  <div class="row"><div class="tx"><span class="k">Pagado antes de la app · aproximado</span><b>$ 38.507.716</b><small>De eso, intereses $ 16.880.913</small></div>${ci('time-outline', '#8c9bb5', 34)}</div>
  <div class="row"><div class="tx"><span class="k">Pagado desde la app</span><b>$ 0</b><small>Cada cuota que registres suma aquí, exacta</small></div>${ci('checkmark-circle-outline', C.grn, 34)}</div>
  <div class="row"><div class="tx"><span class="k">Intereses que faltan</span><b style="color:var(--red)">$ 9.463.045</b><small>Abonando a capital bajan: mira "Abonar"</small></div>${ci('trending-down-outline', C.red, 34)}</div></div>
 </main>${tabs('Cuentas')}`;

export default S;
