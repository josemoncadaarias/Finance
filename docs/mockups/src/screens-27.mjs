// Group 27 - saying up front that a loan already being paid can be entered
// (Jose, 2026-10-14). Today "Cuotas ya pagadas" only appears once the dates
// typed fall in the past. Proposed, nothing built. Figures invented.
import { ic, ci, C, tint, top, down } from './lib.mjs';

const S = {};
const P = C.blu;
const seg = on => `<div class="seg">${['Es nuevo', 'Ya lo vengo pagando'].map(t => `<div class="${on === t ? 'on blu' : ''}">${t}</div>`).join('')}</div>`;
const field = (k, v, sub = '') => `<div class="row" style="padding:11px 14px"><div class="tx"><span class="k">${k}</span><b>${v}</b>${sub ? `<small class="wrap">${sub}</small>` : ''}</div></div>`;
const hint = (t, c = P) => `<div class="card" style="margin:10px 0;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;background:${tint(c, .1)};border-color:${tint(c, .3)}">${ic('information-circle-outline', '', `width:20px;height:20px;flex:none;color:${c}`)}<span style="font-size:13px;line-height:1.4">${t}</span></div>`;
const save = `<div style="position:absolute;left:16px;right:16px;bottom:26px;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">Guardar préstamo</div>`;

S['27a-nuevo'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:10px">${seg('Es nuevo')}
 ${hint('Te lo acaban de desembolsar. ¿Ya llevas cuotas pagadas? Elige <b>Ya lo vengo pagando</b>.')}
 <div class="list">${field('Nombre', 'Carro')}${field('Monto prestado', '$ 60.000.000')}${field('Tasa', '16,50 % E.A.')}${field('Número de cuotas', '60 mensuales')}${field('Primera cuota', '15 de noviembre de 2026')}</div>
 </main>${save}`;

S['27b-ya-lo-pago'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:10px">${seg('Ya lo vengo pagando')}
 ${hint('Escribe los datos de cuando lo sacaste: están en tu contrato o en la app del banco. La app cuenta las cuotas que ya pagaste y no crea movimientos por ellas.')}
 <div class="list">${field('Nombre', 'Carro')}${field('Monto que te prestaron', '$ 60.000.000')}${field('Tasa', '16,50 % E.A.')}${field('Número total de cuotas', '60 mensuales')}${field('Primera cuota', '15 de septiembre de 2024')}</div>
 </main>${save}`;

S['27c-cuotas-ya-pagadas'] = `${top('Nuevo préstamo', { left: 'x' })}<main style="padding-top:10px">${seg('Ya lo vengo pagando')}
 <div style="font-size:13px;font-weight:700;margin:14px 4px 8px" class="mu">LO QUE YA PAGASTE</div>
 <div class="list">${field('Cuotas ya pagadas', '26 de 60', 'Contadas desde la primera cuota. Cámbialo si no coincide.')}
  ${field('Saldo según el plan', '$ 39.465.198')}
  <div class="row" style="padding:11px 14px"><div class="tx"><span class="k">Saldo que dice el banco hoy</span><b>$ 39.465.198</b><small class="wrap">Escríbelo si tu banco muestra otro: gana el del banco</small></div>${ci('create-outline', P, 32)}</div></div>
 ${hint('Las 26 cuotas quedan como pagadas, sin movimientos. Desde la cuota 27 registras cada pago en la app.', C.grn)}
 </main>${save}`;

export default S;
