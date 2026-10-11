// Group 21 - a new user's first screen, sample data to explore every feature,
// and erasing everything on the phone (2026-10-09, approved by Jose and
// built in PR #107). Every name and figure is invented.
import { ic, ci, sq, C, chev, tint, tabs, top, bigTitle, status, accIcon, catIcon } from './lib.mjs';

const S = {};
const row = (icon, t, s, right = chev()) => `<div class="row">${icon}<div class="tx"><b style="white-space:normal;line-height:1.3">${t}</b>${s ? `<small style="white-space:normal">${s}</small>` : ''}</div>${right}</div>`;
const centred = i => i.replace('display:grid', 'display:grid;margin:0 auto 10px');

// 1. Inicio on an empty phone: one welcome card, two ways in.
const empty = `${status}<main style="padding-top:18px">
 <div style="text-align:center;margin-top:30px">${centred(ci('sparkles-outline', C.blu, 72))}
  <h1 style="font-size:24px;margin:6px 0 6px">Bienvenido a Finance</h1>
  <div class="mu" style="font-size:14.5px;line-height:1.45;padding:0 18px">Tus cuentas, gastos y rendimientos, guardados solo en tu celular.</div></div>
 <div class="card" style="margin-top:28px;padding:16px">
  <div style="display:flex;gap:12px;align-items:center">${ci('wallet-outline', C.grn, 44)}<div style="flex:1"><b>Empieza con tus datos</b><small class="mu" style="display:block;font-size:12.8px;margin-top:2px">Crea tu primera cuenta y registra un movimiento.</small></div></div>
  <div class="btn" style="margin-top:12px">${ic('add')}Crear mi primera cuenta</div></div>
 <div class="card" style="margin-top:10px;padding:16px">
  <div style="display:flex;gap:12px;align-items:center">${ci('flask-outline', C.pur, 44)}<div style="flex:1"><b>¿Primero quieres verla funcionando?</b><small class="mu" style="display:block;font-size:12.8px;margin-top:2px;line-height:1.35">Carga datos de ejemplo: cuentas, tarjetas, rendimientos, préstamos, presupuestos y reportes. Los borras con un toque.</small></div></div>
  <div class="btn ghost" style="margin-top:12px">${ic('play-outline')}Explorar con datos de ejemplo</div></div>
 <div class="mu" style="text-align:center;font-size:12.8px;margin-top:16px">¿Tienes una copia? <span class="p">Restaurar una copia de seguridad</span></div>
 </main>${tabs('Inicio')}`;
S['21a-inicio-vacio'] = empty;

// 2. Loading: it is built on the phone, dated from today.
S['21b-cargando-ejemplo'] = empty + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('flask-outline', C.pur, 54))}
 <b style="font-size:18px">Preparando los datos de ejemplo</b>
 <div class="mu" style="font-size:13.5px;margin-top:6px">Calculando rendimientos · 62 %</div>
 <div style="height:8px;border-radius:6px;background:var(--s2);margin-top:14px;overflow:hidden"><div style="width:62%;height:100%;background:var(--pr)"></div></div>
 <div class="mu" style="font-size:12.5px;margin-top:12px;line-height:1.4">Personas y cifras inventadas, con fechas hasta hoy.</div>
 <div class="p" style="margin-top:14px">Cancelar</div></div>`;

// 3. Inicio with the sample loaded: a strip on top, always, while it lasts.
const strip = `<div style="margin:6px 16px 0;padding:10px 12px;border-radius:14px;background:${tint(C.pur, .16)};border:1px solid ${tint(C.pur, .4)};display:flex;gap:10px;align-items:center">
 ${ic('flask-outline', '', `width:20px;height:20px;color:${C.pur}`)}<div style="flex:1;font-size:13px;line-height:1.35"><b style="color:#d6c8ff">Estás viendo datos de ejemplo</b><div class="mu" style="font-size:12.3px">La copia en Drive y los avisos del banco esperan.</div></div>
 <span style="padding:7px 11px;border-radius:11px;background:${tint(C.pur, .3)};font-weight:600;font-size:12.8px;white-space:nowrap">Empezar con los míos</span></div>`;
S['21c-inicio-con-ejemplo'] = `${status}${strip}<main style="padding-top:10px">
 <div class="card hero" style="padding:16px"><small class="mu">Patrimonio</small><div style="font-size:28px;font-weight:700;margin-top:2px">$ 184.320.560</div>
  <div style="display:flex;gap:18px;margin-top:10px;font-size:13.5px"><span>Entró <b style="color:${C.grn}">8.450.000</b></span><span>Salió <b style="color:${C.red}">5.932.410</b></span></div></div>
 <div class="list" style="margin-top:10px">
  ${row(catIcon('mercado', 40), 'Supermercado', 'Hoy · Banco Azul', `<b style="color:${C.red}">−186.400</b>`)}
  ${row(catIcon('vivienda', 40), 'Arriendo', 'Ayer · Banco Azul', `<b style="color:${C.red}">−1.850.000</b>`)}
  ${row(catIcon('salario', 40), 'Salario', 'Hace 3 días · Banco Azul', `<b style="color:${C.grn}">+6.200.000</b>`)}</div>
 </main>${tabs('Inicio')}`;

// 4. "Empezar con los míos" from the strip: erases only the sample.
S['21d-borrar-ejemplo'] = S['21c-inicio-con-ejemplo'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('flask-outline', C.pur, 54))}
 <b style="font-size:18px">¿Borrar los datos de ejemplo?</b>
 <div class="mu" style="font-size:13.5px;margin-top:8px;line-height:1.45">La app queda vacía, lista para tus cuentas. Vuelven la copia en Drive y los avisos del banco.</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><div class="btn ghost">Cancelar</div><div class="btn">Sí, empezar</div></div></div>`;

// 5. Más → Tus datos: the way to erase everything, at the end, in red.
S['21e-mas-borrar-todo'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="h">Tus datos</div><div class="list">
  ${row(sq('checkmark-done-outline', C.blu, 40), 'Movimientos por revisar', '3 movimientos esperan tu respuesta')}
  ${row(sq('pricetags-outline', C.pur, 40), 'Categorías', '22 categorías')}
  ${row(sq('swap-vertical-outline', C.tea, 40), 'Importar y exportar', 'Copia de seguridad y CSV')}
  ${row(sq('flask-outline', C.pur, 40), 'Datos de ejemplo', 'Solo cuando la app está vacía')}
  ${row(sq('trash-outline', C.red, 40), `<span style="color:${C.red}">Borrar todos los datos</span>`, 'Deja la app como recién instalada')}</div>
 <div style="height:110px"></div></main>${tabs('Más')}`;

// 6. Erasing: what goes, a copy first, and the word typed to confirm.
S['21f-borrar-todo'] = `${top('Borrar todos los datos', { left: 'x' })}<main>
 <div style="text-align:center;margin-top:6px">${centred(ci('trash-outline', C.red, 60))}<div class="mu" style="font-size:14px;line-height:1.45">Se borra de este celular, sin vuelta atrás:</div></div>
 <div class="list" style="margin-top:12px">
  ${row(accIcon('azul', 36), '13 cuentas', '2 tarjetas · 1 préstamo', '')}
  ${row(sq('list-outline', C.blu, 36), '12.890 movimientos', 'Desde marzo de 2019', '')}
  ${row(sq('trending-up-outline', C.grn, 36), '254 días de rendimientos', '8 productos', '')}
  ${row(sq('pie-chart-outline', C.yel, 36), '4 topes y 2 metas', '', '')}</div>
 <div class="banner" style="margin-top:12px;background:${tint(C.grn, .12)};color:#bfe8cf">${ic('cloud-done-outline')}<span>Tu copia en Google Drive <b>no se borra</b>. Puedes traerla de vuelta después.</span></div>
 <div class="btn ghost" style="margin-top:12px">${ic('download-outline')}Guardar una copia antes</div>
 <div class="mu" style="font-size:13px;margin:18px 0 6px">Para confirmar, escribe <b style="color:var(--tx)">BORRAR</b></div>
 <div class="field" style="height:48px;border-radius:14px;background:var(--s1);border:1px solid ${C.red};display:flex;align-items:center;padding:0 14px;font-size:16px;letter-spacing:.06em">BORRAR</div>
 <div class="btn danger" style="margin-top:12px">${ic('trash-outline')}Borrar todo</div>
 </main>`;

export default S;
