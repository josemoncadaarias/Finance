// Group 44 - Inicio teaches a new user its first steps (idea 19). A card of
// steps on Inicio once the first account exists, each step one tap to where
// it is done, ticked by itself when it happens. Hidden for good with one tap.
// Names and figures invented.
import { ic, C, tint, status, ci, tabs, accIcon, catIcon } from './lib.mjs';

const S = {};
const step = (done, title, sub, cur = false) => `<div class="row plain" style="${cur ? `background:${tint(C.blu, .1)}` : ''}">
 ${done ? `<span class="tick on">${ic('checkmark')}</span>` : `<span class="tick" style="${cur ? 'border-color:var(--pr)' : ''}"></span>`}
 <div class="tx"><b style="white-space:normal;${done ? 'color:var(--mu);text-decoration:line-through' : ''}">${title}</b>${sub && !done ? `<small>${sub}</small>` : ''}</div>
 ${done ? '' : ic('chevron-forward-outline', 'chev')}</div>`;
const header = `${status}<div style="padding:4px 16px 0;display:flex;align-items:center;gap:10px">${accIcon('azul', 36)}<div style="flex:1"><b style="font-size:17px">Banco Azul</b><div class="mu" style="font-size:12.5px">Octubre 2026</div></div></div>`;
const balance = (v, entro = '0,00', salio = '0,00') => `<div class="card hero" style="padding:16px"><small class="mu">Saldo de hoy</small><div style="font-size:28px;font-weight:700;margin-top:2px">$ ${v}</div>
 <div style="display:flex;gap:18px;margin-top:10px;font-size:13.5px"><span>Entró <b style="color:${C.grn}">${entro}</b></span><span>Salió <b style="color:${C.red}">${salio}</b></span></div></div>`;
const card = (n, rows, extra = '') => `<div class="card" style="padding:0;overflow:hidden">
 <div style="padding:14px 14px 10px;display:flex;align-items:center;gap:10px">${ci('rocket-outline', C.blu, 38)}<div style="flex:1"><b style="font-size:15.5px">Primeros pasos</b><div class="mu" style="font-size:12.5px">${n} de 5 · unos minutos</div></div>${ic('close', 'mu')}</div>
 <div class="pbar" style="margin:0 14px 8px"><i style="width:${n * 20}%;background:var(--pr)"></i></div>
 ${rows}${extra}</div>`;

// 44a - right after the first account: the card, the next step lit.
S['44a-primeros-pasos'] = `${header}<main style="display:flex;flex-direction:column;gap:12px">
 ${balance('1.250.000')}
 ${card(1, step(true, 'Crear tu primera cuenta') +
  step(false, 'Registrar tu primer gasto', 'Con el "+" de abajo. Toma 10 segundos.', true) +
  step(false, 'Ponerle un tope a una categoría', 'Te avisamos antes de pasarte.') +
  step(false, 'Guardar tu copia en Google Drive', 'Si cambias de celular, no pierdes nada.') +
  step(false, 'Leer los avisos de tu banco', 'Tus compras llegan solas para que las revises.'))}
 </main>${tabs('Inicio')}`;

// 44b - a step tapped: one line of why, and the button that takes there.
S['44b-paso-abierto'] = S['44a-primeros-pasos'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center">${catIcon('mercado', 54).replace('display:grid', 'display:grid;margin:0 auto 10px')}
 <b style="font-size:18px">Registra tu primer gasto</b>
 <div class="mu" style="font-size:13.5px;line-height:1.45;margin-top:8px">Escribe cuánto fue y en qué. La app aprende de lo que registras: la próxima vez te propone la categoría y la nota.</div></div>
 <div class="btn" style="margin-top:16px">${ic('add')}Registrar un gasto</div>
 <div class="btn ghost" style="margin-top:8px">Ahora no</div></div>`;

// 44c - two steps done: they tick by themselves, the next one is lit.
S['44c-avanzando'] = `${header}<main style="display:flex;flex-direction:column;gap:12px">
 ${balance('1.163.600', '0,00', '86.400')}
 ${card(2, step(true, 'Crear tu primera cuenta') + step(true, 'Registrar tu primer gasto') +
  step(false, 'Ponerle un tope a una categoría', 'Te avisamos antes de pasarte.', true) +
  step(false, 'Guardar tu copia en Google Drive', 'Si cambias de celular, no pierdes nada.') +
  step(false, 'Leer los avisos de tu banco', 'Tus compras llegan solas para que las revises.'))}
 </main>${tabs('Inicio')}`;

// 44d - all done: one line of goodbye, and it hides itself.
S['44d-listo'] = `${header}<main style="display:flex;flex-direction:column;gap:12px">
 ${balance('980.200', '0,00', '269.800')}
 <div class="card" style="text-align:center;padding:18px">${ci('trophy-outline', C.gold, 50).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:16.5px">Ya sabes lo principal</b>
  <div class="mu" style="font-size:13px;line-height:1.4;margin-top:6px">Cada pantalla tiene su guía si la necesitas: Más → Preferencias → Guías.</div>
  <div class="btn ghost" style="margin-top:12px;height:42px">Ocultar</div></div>
 </main>${tabs('Inicio')}`;

// 44e - the X on the card: asked, and where to bring it back.
S['44e-ocultar'] = S['44a-primeros-pasos'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 <b style="font-size:18px">¿Ocultar los primeros pasos?</b>
 <div class="mu" style="font-size:13.5px;line-height:1.45;margin-top:8px">Los vuelves a ver en Más → Preferencias → Guías.</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><div class="btn ghost">Cancelar</div><div class="btn">Ocultar</div></div></div>`;

export default S;
