// Group 27 - saying up front that a loan already being paid can be entered
// (Jose, 2026-10-14). Today "Cuotas ya pagadas" only appears once the dates
// typed fall in the past. Proposed, nothing built. Figures invented.
import { ic, ci, C, tint, top, down } from './lib.mjs';

const S = {};
const P = C.blu;
// eslint-disable-next-line
const seg = on => `<div class="seg">${['Es nuevo', 'Ya lo vengo pagando'].map(t => `<div class="${on === t ? 'on blu' : ''}">${t}</div>`).join('')}</div>`;
const field = (k, v, sub = '') => `<div class="row" style="padding:11px 14px"><div class="tx"><span class="k">${k}</span><b>${v}</b>${sub ? `<small class="wrap">${sub}</small>` : ''}</div></div>`;
const hint = (t, c = P) => `<div class="card" style="margin:10px 0;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;background:${tint(c, .1)};border-color:${tint(c, .3)}">${ic('information-circle-outline', '', `width:20px;height:20px;flex:none;color:${c}`)}<span style="font-size:13px;line-height:1.4">${t}</span></div>`;
const save = `<div style="position:absolute;left:16px;right:16px;bottom:26px;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">Guardar préstamo</div>`;

// The real form (loan-editor), compact, with the one change: the paid
// installments asked at the top in a card of its own colour.
const A = C.yel;
const f = (k, v, extra = '') => `<div class="row" style="padding:8px 14px"><div class="tx"><span class="k" style="font-size:12px">${k}</span><b style="font-size:15px">${v}</b>${extra}</div></div>`;
const mini = (a, b, on) => `<span style="display:inline-flex;border:1px solid #26324f;border-radius:9px;overflow:hidden;font-size:12px;margin-left:8px">${[a, b].map(t => `<span style="padding:3px 9px;${t === on ? 'background:var(--pr);color:#fff;font-weight:700' : ''}">${t}</span>`).join('')}</span>`;
const segF = (opts, on) => `<div style="display:flex;border:1px solid #26324f;border-radius:10px;overflow:hidden;font-size:13px;margin-top:4px">${opts.map(t => `<span style="flex:1;text-align:center;padding:5px 0;${t === on ? 'background:var(--pr);color:#fff;font-weight:700' : ''}">${t}</span>`).join('')}</div>`;
const paidCard = `<div class="card" style="margin:10px 0;padding:12px 14px;background:${tint(A, .12)};border:1.5px solid ${tint(A, .55)}">
 <div style="display:flex;gap:11px;align-items:center">${ci('checkmark-done-outline', A, 40)}
  <div style="flex:1"><b style="font-size:15.5px">¿Ya lo vienes pagando?</b><div style="font-size:12.5px;line-height:1.35;color:#c9d1e0;margin-top:2px">Escribe cuántas cuotas llevas. Si es nuevo, déjalo en 0.</div></div></div>
 <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:8px 12px;border-radius:11px;background:var(--s2)"><span style="font-size:14px">Cuotas ya pagadas</span><b style="font-size:18px;color:${A}">26 <span style="font-size:13px;color:#aab4c8;font-weight:500">de 60</span></b></div></div>`;
S['27-cuotas-pagadas-arriba'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:6px">
 <div class="list">${f('Nombre', 'Carro')}</div>
 ${paidCard}
 <div class="list">${f('Te prestaron', '$ 60.000.000 <span class="mu" style="font-weight:500;font-size:12px">COP</span>')}
  ${f('Tasa de interés', `16,50 %${mini('E.A.', 'M.V.', 'E.A.')}`, segF(['Fija', 'Variable'], 'Fija'))}
  ${f('Sistema', '', segF(['Cuota fija', 'Abono constante a capital'], 'Cuota fija'))}
  <div style="display:flex">${f('Cuotas', '60')}${f('Cada', 'Mes')}</div>
  ${f('Te desembolsaron', '15 de agosto de 2024')}${f('Primera cuota', '15 de septiembre de 2024')}</div>
 <div style="text-align:center;font-size:12px;margin-top:8px" class="mu">${ic('chevron-down-outline', '', 'width:14px;height:14px;vertical-align:-2px')} Sigue igual que hoy: seguros, pagas desde, cuota calculada y lo que debes hoy</div>
 </main>`;

export default S;
