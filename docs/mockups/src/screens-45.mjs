// Group 45 - "Notificaciones del teléfono", made simple (Jose, 2026-10-29:
// "TIENE QUE SER SUPER SUPER SENCILLO Y CLARO DE ENTENDER"). One status line,
// the person's banks, one button to add one. Everything else - every app the
// phone has, hidden apps, the switches for how it listens - lives one tap
// away. Names and figures invented.
import { ic, C, tint, top, ci, accIcon, chev, sw, tabs } from './lib.mjs';

const S = {};
const head = top('Notificaciones del teléfono', { sub: 'Tus compras llegan solas para revisarlas' });
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.4">${t}</div>`;
const sheet = inner => `<div class="scrim"></div><div class="sheet" style="max-height:86%;overflow:hidden"><div class="grab"></div>${inner}</div>`;

// The one status line: working, or the single thing to fix, with its button.
const ok = `<div class="card" style="padding:12px 14px;display:flex;gap:12px;align-items:center">
 ${ci('checkmark', C.grn, 36)}<div class="tx"><b style="white-space:normal">Funcionando</b><small>Último aviso de un banco: hoy 11:40</small></div></div>`;
const bad = `<div class="card" style="padding:14px;border-color:${tint(C.yel, .5)};background:${tint(C.yel, .1)}">
 <div style="display:flex;gap:12px;align-items:center">${ci('alert', C.yel, 36)}<div class="tx"><b style="white-space:normal">Finance no está recibiendo los avisos</b><small>Android le quitó el permiso.</small></div></div>
 <div class="btn" style="margin-top:12px;height:44px">Dar el permiso otra vez</div></div>`;

const review = `<div class="list" style="margin-top:10px"><div class="row">${ci('file-tray-full-outline', C.blu, 36)}<div class="tx"><b>Movimientos por revisar</b><small>3 esperan que los revises</small></div><span class="pill">3</span>${chev()}</div></div>`;

const bank = (acc, name, how) => `<div class="row">${accIcon(acc, 38)}<div class="tx"><b>${name}</b><small>${how}</small></div>${chev()}</div>`;
const banks = `<div class="h">Tus bancos</div><div class="list">
 ${bank('azul', 'Banco Azul', 'Su app y sus SMS')}
 ${bank('naranja', 'Cajita Naranja', 'Su app')}
 ${bank('coral', 'Tarjeta Coral', 'Sus SMS')}</div>`;
const add = `<div class="btn ghost" style="margin-top:12px;height:46px">${ic('add')}Agregar un banco</div>`;
const settings = `<div class="list" style="margin-top:16px"><div class="row">${ci('settings-outline', C.gry, 36)}<div class="tx"><b>Ajustes de los avisos</b><small>Permisos, avisar al instante, apps ocultas</small></div>${chev()}</div></div>`;

// 45a - everything working: the whole screen.
S['45a-notificaciones-simple'] = `${head}<main>${ok}${review}${banks}${add}${settings}
 ${note('Tocas un banco para ver sus últimos mensajes y qué pasó con cada uno.')}</main>${tabs('Más')}`;

// 45b - one problem: said once, on top, with the one button that fixes it.
S['45b-un-problema'] = `${head}<main>${bad}${review}${banks}${add}${settings}</main>${tabs('Más')}`;

// 45c - the first time: nothing to read yet.
S['45c-primera-vez'] = `${head}<main>${ok.replace('Último aviso de un banco: hoy 11:40', 'Todavía no lee ningún banco')}
 <div class="card" style="margin-top:12px;text-align:center;padding:20px 16px">
  ${ci('notifications-outline', C.pur, 56).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:17px">Elige tus bancos</b>
  <div class="mu" style="font-size:13.5px;line-height:1.45;margin-top:6px">Cuando tu banco te avise de una compra, la app la deja lista en Movimientos por revisar. Nada se guarda solo.</div>
  <div class="btn" style="margin-top:14px">${ic('add')}Agregar un banco</div></div>
 ${settings}</main>${tabs('Más')}`;

// 45d - "Agregar un banco": first what has sent money-looking messages, then
// a search over every app; nothing else.
const cand = (icon, color, name, line) => `<div class="row">${ci(icon, color, 38)}<div class="tx"><b>${name}</b><small>${line}</small></div><span class="chip" style="color:var(--pr);padding:6px 12px">Activar</span></div>`;
S['45d-agregar-banco'] = S['45a-notificaciones-simple'] + sheet(`<div class="sh"><h2>Agregar un banco</h2>${ic('close', 'mu')}</div>
 <div class="search">${ic('search-outline')}Buscar una app o un remitente de SMS</div>
 <div class="h">Te enviaron mensajes con dinero</div>
 <div class="list">${cand('chatbubble-ellipses-outline', C.cya, '899979', 'SMS · 4 mensajes esta semana')}${cand('phone-portrait-outline', C.grn, 'Billetera Verde', 'App · 2 avisos esta semana')}</div>
 <div class="h">Todas las apps del celular</div>
 <div class="list"><div class="row plain"><div class="tx"><b>Ver las 31 apps</b><small>Por si tu banco no aparece arriba</small></div>${chev()}</div></div>
 ${note('Al activar uno te preguntamos de qué cuenta es. De las apps que no actives no se guarda nada.')}`);

// 45e - the settings, apart: each switch says what it does in one line.
S['45e-ajustes'] = S['45a-notificaciones-simple'] + sheet(`<div class="sh"><h2>Ajustes de los avisos</h2>${ic('close', 'mu')}</div>
 <div class="list">
  <div class="row">${ci('flash-outline', C.yel, 36)}<div class="tx"><b>Avisarme siempre al instante</b><small style="white-space:normal">El aviso llega en el momento. Gasta un poco más de batería.</small></div>${sw(false)}</div>
  <div class="row">${ci('chatbubble-ellipses-outline', C.cya, 36)}<div class="tx"><b>Leer los SMS de tus bancos</b><small>Permitido</small></div>${ic('checkmark', 'g')}</div>
  <div class="row">${ci('notifications-outline', C.pur, 36)}<div class="tx"><b>Avisos de Finance</b><small>Permitidos</small></div>${ic('checkmark', 'g')}</div>
  <div class="row">${ci('eye-off-outline', C.gry, 36)}<div class="tx"><b>Apps ocultas</b><small>22 apps que no son de bancos</small></div>${chev()}</div></div>`);

export default S;
