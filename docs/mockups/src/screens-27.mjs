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

S['27-un-solo-formulario'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:10px">
 ${hint('Sirve para un préstamo nuevo <b>o uno que ya vienes pagando</b>: escribe abajo cuántas cuotas llevas.')}
 <div class="list">${field('Nombre', 'Carro')}${field('Monto que te prestaron', '$ 60.000.000')}${field('Tasa', '16,50 % E.A.')}${field('Número de cuotas', '60 mensuales')}${field('Primera cuota', '15 de septiembre de 2024')}
  ${field('Cuotas que ya pagaste', '26', 'Déjalo en 0 si es nuevo')}</div>
 </main>${save}`;

export default S;
