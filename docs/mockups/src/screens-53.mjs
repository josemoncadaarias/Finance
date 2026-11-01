// Group 53 - the "Guardado" banner (Jose, 2026-11-01, after Lukas's: a banner
// on top of everything right after saving, a bar that runs out, a tap to fix
// what was saved). Proposed, not decided. Our own: the identifier is the app's
// own wallet (its icon), a little larger than the banner, its cards sticking
// out over the banner's top edge. What it does:
//   - shows for 5 seconds after saving a spending, an income or a transfer,
//     from any screen (the "+", the assistant, Por revisar, a habit...);
//   - the bar under it runs out in those 5 seconds, and stops while the finger
//     is on the banner;
//   - a tap opens that movement in the one form, to correct it;
//   - "Deshacer" deletes it (and what it carried: a cover from a pocket, a
//     loan payment's parts), with "Recuperar" for a few seconds;
//   - swiped up, or when the bar runs out, it goes: the movement stays saved.
// Figures and names invented.
import { readFileSync } from 'node:fs';
import { ic, C, tint, catIcon } from './lib.mjs';
import G1 from './screens-1.mjs';

const S = {};
const logo = `data:image/png;base64,${readFileSync(new URL('./assets/logo-wallet.png', import.meta.url)).toString('base64')}`;
const $ = v => `$&nbsp;${v}`;

// The banner. `left` is how much of the bar is still to run (0-1).
const banner = ({ kind = 'Gasto guardado', title, sub, amount, cls = 'r', left = .62, pressed = false, top = 34 }) => `
 <div style="position:absolute;left:12px;right:12px;top:${top + 18}px;z-index:50">
  <div style="position:relative;background:#16223b;border:1px solid #2a3b60;border-radius:20px;padding:12px 12px 16px 84px;box-shadow:0 14px 34px rgba(0,0,0,.6);overflow:visible${pressed ? ';transform:scale(.985)' : ''}">
   <img src="${logo}" style="position:absolute;left:8px;top:-22px;width:70px;height:auto;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))">
   <div style="display:flex;align-items:center;gap:8px">
    <div style="display:flex;align-items:center;gap:5px;color:${C.grn};font-size:12.5px;font-weight:600;white-space:nowrap;flex:1">${ic('checkmark-circle', '', 'width:15px;height:15px')}${kind}</div>
    <b class="${cls}" style="font-size:16px;white-space:nowrap">${amount}</b></div>
   <div style="display:flex;align-items:flex-end;gap:8px;margin-top:2px">
    <div style="flex:1;min-width:0">
     <b class="one" style="display:block;font-size:15.5px">${title}</b>
     <div class="sub" style="font-size:12.5px;margin-top:1px;line-height:1.35;text-wrap:pretty">${sub}</div></div>
    <div style="flex:none;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:14px;background:var(--s2);color:var(--pr);font-size:12.5px;font-weight:600">${ic('arrow-undo-outline', '', 'width:14px;height:14px')}Deshacer</div>
   </div>
   <div style="position:absolute;left:14px;right:14px;bottom:7px;height:4px;border-radius:2px;background:${tint(C.grn, .18)}">
    <div style="height:4px;border-radius:2px;background:${C.grn};width:${Math.round(left * 100)}%"></div></div>
  </div>
  ${pressed ? `<div style="text-align:center;margin-top:8px;font-size:12px;color:#cfd6e4">Mientras lo tocas, la barra se detiene</div>` : ''}
 </div>`;
const dim = `<div style="position:absolute;inset:0;background:rgba(4,8,18,.18);z-index:40"></div>`;

// 53a - a spending saved: over Inicio, on top of everything.
S['53a-gasto-guardado'] = G1['1a-inicio'] + dim + banner({
  title: 'Almuerzo', sub: 'Restaurantes · Cuenta de ahorros · hoy', amount: '−' + $('45.900') });

// 53b - an income.
S['53b-ingreso-guardado'] = G1['1a-inicio'] + dim + banner({
  kind: 'Ingreso guardado', title: 'Pago del arriendo', sub: 'Arriendos · Cuenta de ahorros · hoy', amount: '+' + $('1.200.000'), cls: 'g', left: .8 });

// 53c - a transfer, in the transfers' own blue.
S['53c-transferencia-guardada'] = G1['1a-inicio'] + dim + banner({
  kind: 'Transferencia guardada', title: 'Cuenta de ahorros → Tarjeta Coral', sub: 'Pago de la tarjeta · hoy', amount: $('850.000'), cls: 'p', left: .45 });

// 53d - the finger on it: the bar stops; lifting it opens the movement.
S['53d-tocandolo'] = G1['1a-inicio'] + dim + banner({
  title: 'Almuerzo', sub: 'Restaurantes · Cuenta de ahorros · hoy', amount: '−' + $('45.900'), left: .5, pressed: true });

// 53e - "Deshacer": the movement is deleted, with a way back for 5 seconds.
const undone = `<div style="position:absolute;left:12px;right:12px;top:52px;z-index:50">
 <div style="position:relative;background:#16223b;border:1px solid #2a3b60;border-radius:20px;padding:12px 12px 16px 84px;box-shadow:0 14px 34px rgba(0,0,0,.6)">
  <img src="${logo}" style="position:absolute;left:8px;top:-22px;width:70px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45)) grayscale(.35)">
  <div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0">
   <div style="display:flex;align-items:center;gap:5px;color:#aab4c8;font-size:12.5px;font-weight:600">${ic('trash-outline', '', 'width:14px;height:14px')}Gasto borrado</div>
   <b class="one" style="display:block;font-size:15.5px;margin-top:2px">Almuerzo · ${$('45.900')}</b>
   <div class="sub" style="font-size:12.5px;margin-top:1px">Ya no está en tus movimientos</div></div>
   <div style="flex:none;padding:7px 12px;border-radius:14px;background:var(--s2);color:var(--pr);font-size:13px;font-weight:600">Recuperar</div></div>
  <div style="position:absolute;left:14px;right:14px;bottom:7px;height:4px;border-radius:2px;background:rgba(170,180,200,.18)"><div style="height:4px;border-radius:2px;background:#8e9ab2;width:70%"></div></div>
 </div></div>`;
S['53e-deshacer'] = G1['1a-inicio'] + dim + undone;

// 53f - how it works, in one list.
const li = (icon, t, s) => `<div class="row" style="gap:12px;align-items:flex-start">${ic(icon, 'p', 'width:22px;height:22px;flex:none;margin-top:2px')}<div class="tx"><b style="white-space:normal;font-weight:500">${t}</b><small style="white-space:normal">${s}</small></div></div>`;
S['53f-como-funciona'] = `${G1['1a-inicio']}<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 0">Cerrar</div>
 <h2 style="text-align:center;margin:26px 0 12px;font-size:19px">El aviso de «Guardado»</h2>
 <div class="list">
  ${li('time-outline', 'Se ve 5 segundos', 'Sale cada vez que guardas un gasto, un ingreso o una transferencia, desde cualquier pantalla. Con «Registrar otro» sale encima del formulario, que sigue abierto. La barra verde muestra cuánto le queda.')}
  ${li('hand-left-outline', 'Tócalo para corregirlo', 'Se abre ese movimiento en el formulario de siempre. Mientras lo tocas, la barra se detiene.')}
  ${li('arrow-undo-outline', 'Deshacer lo borra', 'Si lo guardaste por error. Durante 5 segundos puedes recuperarlo.')}
  ${li('chevron-up-outline', 'Deslízalo hacia arriba para cerrarlo', 'El movimiento queda guardado. Si no haces nada, se cierra solo al acabarse la barra.')}</div>
 </div>`;

export default S;
