// Group 22 - guided tours (2026-10-10, for Jose to decide; nothing built).
// The first time the app opens, and the first time a person reaches a screen
// with something to learn, a short tour: the screen dims, one thing is lit,
// a bubble says what it does in one or two lines, with "Siguiente", the step
// it is on, and "Omitir" to drop the tour. Más → Preferencias → Guías brings
// them back. Every name and figure invented.
import { ic, ci, C, tint } from './lib.mjs';
import G1 from './screens-1.mjs';
import G4 from './screens-4.mjs';
import G8 from './screens-8.mjs';

const S = {};
const dots = (n, at) => `<span style="display:inline-flex;gap:5px">${Array.from({ length: n }, (_, i) =>
  `<span style="width:${i === at ? 16 : 6}px;height:6px;border-radius:3px;background:${i === at ? 'var(--pr)' : '#3a4b73'}"></span>`).join('')}</span>`;
const hole = (x, y, w, h, r = 18) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${r}px;box-shadow:0 0 0 2000px rgba(3,6,14,.74);border:2px solid var(--pr);z-index:50"></div>`;
// The bubble: above or below what is lit, with an arrow towards it.
const bubble = ({ top, bottom, arrowX = 200, up = true, title, text, step, of, last = false }) => `
 <div style="position:absolute;left:16px;right:16px;${top !== undefined ? `top:${top}px` : `bottom:${bottom}px`};z-index:51;background:#16223b;border:1px solid #2c3d63;border-radius:20px;padding:16px;box-shadow:0 12px 30px rgba(0,0,0,.45)">
  <span style="position:absolute;left:${arrowX - 24}px;${up ? 'top:-8px' : 'bottom:-8px'};width:14px;height:14px;background:#16223b;border-${up ? 'left' : 'right'}:1px solid #2c3d63;border-${up ? 'top' : 'bottom'}:1px solid #2c3d63;transform:rotate(45deg)"></span>
  <b style="font-size:16.5px;display:block">${title}</b>
  <div class="mu" style="font-size:14px;line-height:1.45;margin-top:5px">${text}</div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
   ${dots(of, step)}<span class="mu" style="font-size:12.5px">${step + 1} de ${of}</span><span style="flex:1"></span>
   ${last ? '' : '<span class="mu" style="font-size:14px;padding:8px 6px">Omitir</span>'}
   <span style="padding:9px 18px;border-radius:13px;background:linear-gradient(135deg,var(--pr),#4a5ef0);font-weight:700;font-size:14px">${last ? 'Listo' : 'Siguiente'}</span>
  </div></div>`;
const base = G1['1a-inicio'];

// 0. The welcome: the first time the app opens, before anything is lit.
S['22a-guia-bienvenida'] = base + `<div style="position:absolute;inset:0;background:rgba(3,6,14,.78);z-index:50"></div>
 <div style="position:absolute;left:22px;right:22px;top:250px;z-index:51;background:#16223b;border:1px solid #2c3d63;border-radius:24px;padding:22px;text-align:center">
  ${ci('compass-outline', C.blu, 60).replace('display:grid', 'display:grid;margin:0 auto 12px')}
  <b style="font-size:20px">Te mostramos la app</b>
  <div class="mu" style="font-size:14.5px;line-height:1.45;margin-top:8px">Seis pasos cortos para saber dónde está cada cosa. Toma menos de un minuto.</div>
  <div class="btn" style="margin-top:18px">Empezar</div>
  <div class="mu" style="margin-top:12px;font-size:14px">Ahora no</div>
 </div>`;

// 1. The "+": the one way to a new movement.
S['22b-guia-boton-mas'] = base + hole(176, 830, 60, 60, 30) + bubble({
  bottom: 110, arrowX: 206, up: false, step: 0, of: 6,
  title: 'Registra un movimiento', text: 'Con el + anotas un gasto, un ingreso o una transferencia entre tus cuentas.',
});
// 2. Which account and which month.
S['22c-guia-cuenta-y-mes'] = base + hole(12, 30, 388, 108, 20) + bubble({
  top: 152, arrowX: 120, step: 1, of: 6,
  title: 'Qué cuenta y qué mes', text: 'Toca arriba para ver una sola cuenta o todas. Cambia de mes con las flechas o deslizando la pantalla.',
});
// 3. The figure on top.
S['22d-guia-patrimonio'] = base + hole(16, 158, 380, 188, 22) + bubble({
  top: 362, arrowX: 120, step: 2, of: 6,
  title: 'Tu patrimonio hoy', text: 'Lo que tienes en todas tus cuentas, y lo que entró y salió en el mes. Las tarjetas y préstamos restan.',
});
// 4. The chart and the list.
S['22e-guia-grafico'] = base + hole(16, 356, 380, 256, 22) + bubble({
  top: 628, arrowX: 120, step: 3, of: 6,
  title: 'En qué se te va la plata', text: 'El gráfico por categoría. Toca una para ver sus movimientos, o cambia a la lista.',
});
// 5. The tabs.
S['22f-guia-pestanas'] = base + hole(100, 826, 290, 66, 33) + bubble({
  bottom: 110, arrowX: 260, up: false, step: 4, of: 6,
  title: 'Cuentas, Reporte y Más', text: 'Cuentas: saldos, rendimientos y deudas. Reporte: qué cambió frente al mes anterior. Más: presupuestos, copia en Drive y ajustes.',
});
// 6. The end, and where to see it again.
S['22g-guia-final'] = base + hole(318, 830, 62, 60, 30) + bubble({
  bottom: 110, arrowX: 350, up: false, step: 5, of: 6, last: true,
  title: '¡Listo!', text: 'Cuando entres por primera vez a otras partes, te mostraremos una guía corta. Puedes verlas de nuevo en Más → Guías.',
});

// A screen's own tour, the first time it is opened: an account that earns.
S['22h-guia-rendimientos'] = G4['4c-cuenta-productos'] + hole(12, 388, 388, 240, 18) + bubble({
  top: 644, arrowX: 120, step: 0, of: 3,
  title: 'Tus productos', text: 'Cada bolsillo, alcancía o CDT de la cuenta, con lo que tiene y lo que te ha pagado. Tócalo para ver su tasa.',
});

// Más → Preferencias: the tours, to see again or turn off.
const sheet = `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center">${ci('compass-outline', C.blu, 46).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="font-size:18px">Guías</b></div>
 <div class="list" style="margin-top:14px">
  <div class="row"><div class="tx"><b>Mostrar guías la primera vez</b><small>En cada parte de la app que aún no conoces</small></div><div class="sw on"></div></div>
  <div class="row"><div class="tx"><b>Ver la guía de inicio otra vez</b></div>${ic('play-outline', 'p', 'width:20px;height:20px')}</div>
  <div class="row"><div class="tx"><b>Volver a mostrar todas</b><small>Las que ya viste o saltaste</small></div>${ic('refresh-outline', 'p', 'width:20px;height:20px')}</div>
 </div>
 <div style="text-align:center;margin-top:12px" class="p">Cancelar</div></div>`;
S['22i-mas-guias'] = G8['8a-mas'] + sheet;

export default S;
