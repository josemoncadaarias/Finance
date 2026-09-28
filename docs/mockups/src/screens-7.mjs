// Group 7 (v4, 2026-09-28): Avisos del banco. What the notifications screen
// does today (features/notifications, rule 22, step one): Android only; the
// permission, the three promises, opening Android's settings and "Ya lo di,
// volver a revisar"; the apps that post, with their counts, ticked to keep
// what they say or not; hiding an app and "Apps ocultas" with "Mostrar";
// what they said, exactly as it came; forgetting what was kept, or
// everything; search; choosing several to keep, stop keeping or hide.
// Drawn with the rules of groups 1-6: a selector to separate the two lists,
// counts that say what they count, explanations behind an (i), lists by day
// in folding sections with the first open, the two arrows, the bar below.
import { ic, ci, sq, C, tag, tick, sw, top, tabs, tint, jump, mgroup, foldAll } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const bubble = (top, arrowRight, text) => `<div style="position:absolute;left:24px;right:24px;top:${top}px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;right:${arrowRight}px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>${text}</div>`;
const dialog = (icon, title, body, no, yes, danger = false) => `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(icon)}<b style="font-size:18px">${title}</b>
 <div class="sub" style="margin-top:8px;line-height:1.45">${body}</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">${no}</div><div class="btn${danger ? ' danger' : ''}" style="flex:1">${yes}</div></div></div>`;

// It lives in the Más tab: its title, the "···" with the two ways to forget,
// and the bar below.
const head = () => top('Avisos del banco', { right: `<span class="btn-r">${ic('ellipsis-vertical')}</span>` });
const page = (body, after = '') => `${head()}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;

// The two lists are two faces of one selector, each saying what it holds.
const faces = on => `<div class="seg" style="margin-top:10px">${[['apps-outline', '5 apps'], ['chatbubble-ellipses-outline', '24 avisos guardados']].map(([i, t], n) => `<div class="${n === on ? 'on' : ''}">${ic(i)}${t}</div>`).join('')}</div>`;
const search = t => `<div class="search" style="margin-top:10px">${ic('search-outline')}<span class="one">${t}</span></div>`;

// An app that posts: its icon, its name, how many notices, its package, and
// the switch that keeps what it says. "se guarda" when it is on.
const APPS = [
  ['Banco Azul', 'com.bancoazul.app', 18, C.blu, 'business-outline', true],
  ['Tarjeta Coral', 'com.coral.card', 6, C.yel, 'card-outline', true],
  ['Billetera Verde', 'com.verde.wallet', 3, C.grn, 'wallet-outline', false],
  ['Mensajería', 'com.mensajes.chat', 212, C.gry, 'chatbubbles-outline', false],
  ['Correo', 'com.correo.mail', 41, C.gry, 'mail-outline', false],
];
const appRow = ([name, pkg, n, c, i, on], pick = null) => `<div class="row" style="${pick === 'on' ? `background:${tint(C.blu, .12)}` : ''}">${pick !== null ? tick(pick === 'on') : ''}${sq(i, c, 40)}<div class="tx"><b class="one">${name} ${on ? tag('se guarda', C.grn) : ''}</b><small class="one">${n} ${n === 1 ? 'aviso' : 'avisos'} · ${pkg}</small></div>${pick === null ? sw(on) : ''}</div>`;
const hiddenRow = open => `<div class="list" style="margin-top:10px"><div class="row">${sq('eye-off-outline', C.gry, 40)}<div class="tx"><b>Apps ocultas</b><small>2 apps</small></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>
 ${open ? [['Juegos', 'com.juegos.play', 57, 'game-controller-outline'], ['Tienda', 'com.tienda.shop', 12, 'bag-handle-outline']].map(([n, p, k, i]) => `<div class="row">${sq(i, C.gry, 36)}<div class="tx"><b class="one" style="color:#b9c3d8">${n}</b><small>${k} avisos · ${p}</small></div><span class="chip" style="padding:6px 11px;font-size:13px;color:var(--pr)">${ic('eye-outline', '', 'width:15px;height:15px')}Mostrar</span></div>`).join('') : ''}</div>`;
const appsTools = (choosing = false) => `<div style="display:flex;align-items:center;gap:8px;margin-top:12px"><span class="h" style="margin:0 4px;flex:1;display:flex;align-items:center;gap:8px;justify-content:flex-start">Marca las de tus bancos ${infoDot}</span><span class="chip" style="padding:7px 11px;font-size:13px;${choosing ? 'color:var(--pr)' : ''}">${ic(choosing ? 'close' : 'checkmark-done-outline', '', 'width:16px;height:16px')}${choosing ? 'Salir' : 'Seleccionar'}</span></div>`;

// 1. The apps: which ones post, and which are ticked to keep what they say.
S['7a-avisos-apps'] = page(`${faces(0)}${search('Buscar una app o lo que dijo…')}${appsTools()}
 <div class="list" style="margin-top:8px">${APPS.map(a => appRow(a)).join('')}</div>${hiddenRow(false)}`);

// 2. The (i) beside "Marca las de tus bancos", tapped.
S['7b-marca-tus-bancos'] = S['7a-avisos-apps'] + bubble(262, 202, 'Solo de las apps que marques se guarda lo que dicen. De las demás, la app solo anota que mandaron un aviso, nunca qué decía.');

// 3. What they said, exactly as it came - by day, the most recent open, each
//    with its app, its hour and the whole text. The app chip first offers
//    "Todas las apps".
const said = (app, c, i, when, text) => `<div class="row" style="align-items:flex-start">${sq(i, c, 36)}<div class="tx"><b style="font-size:14px">${app} <span class="mu" style="font-weight:400;font-size:12.5px">· ${when}</span></b><small style="white-space:normal;color:#c3cbdb;line-height:1.4;margin-top:3px">${text}</small></div></div>`;
const count = n => `${n} ${n === 1 ? 'aviso' : 'avisos'}`;
const chipApps = name => `<div class="chip" style="display:flex;width:fit-content;max-width:100%;margin:10px auto 0;padding:6px 12px">${sq('apps-outline', C.blu, 24)}<span class="one">${name}</span>${ic('chevron-down-outline', '', 'width:15px;height:15px')}</div>`;
const saidTools = `<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><span class="sub" style="flex:1;display:flex;gap:6px;align-items:center;margin-left:4px">Tal cual llegó ${infoDot}</span>${foldAll()}</div>`;
S['7c-lo-que-dijeron'] = page(`${faces(1)}${chipApps('Todas las apps')}${search('Buscar una app o lo que dijo…')}${saidTools}
 ${mgroup('Hoy · domingo 27', count(3), '', '', true,
   said('Banco Azul', C.blu, 'business-outline', '9:12 a. m.', 'Compraste $45.900 en EXITO POBLADO con tu tarjeta débito *1234. Si no fuiste tú, llámanos.')
   + said('Tarjeta Coral', C.yel, 'card-outline', '8:40 a. m.', 'Tienes un nuevo movimiento. Abre la app para verlo.')
   + said('Banco Azul', C.blu, 'business-outline', '7:05 a. m.', 'Recibiste una transferencia por $2.000.000 de JOSE M. en tu cuenta *1234.'))}
 ${mgroup('Sábado 26', count(5), '', '', false)}
 ${mgroup('Viernes 25', count(4), '', '', false)}
 ${mgroup('Jueves 24', count(6), '', '', false)}`) + jump(112, 'down');

// 4. Choosing several apps: the whole row takes the tap; keep, stop keeping,
//    or hide them all at once.
const bar = (n, actions) => `<div style="position:absolute;left:12px;right:12px;bottom:26px;background:#15213a;border:1px solid #2a3b60;border-radius:22px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.6)">
  <div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:50%;background:var(--s3);display:grid;place-items:center">${ic('close')}</span><div style="flex:1;min-width:0"><b style="display:block">${n}</b><small class="mu" style="font-size:12px">de 5 apps a la vista</small></div><span class="p" style="font-size:13.5px">Todas</span><span class="mu" style="font-size:13.5px">·</span><span class="p" style="font-size:13.5px">Ninguna</span></div>
  <div style="display:flex;gap:8px;margin-top:10px">${actions}</div></div>`;
const act = (i, t, style = '') => `<span class="chip" style="flex:1;justify-content:center;padding:9px 6px;font-size:13px;${style}">${ic(i, '', 'width:16px;height:16px')}${t}</span>`;
const picks = ['off', 'off', 'off', 'on', 'on'];
S['7d-elegir-apps'] = `${head()}<main>${faces(0)}${search('Buscar una app o lo que dijo…')}${appsTools(true)}
 <div class="list" style="margin-top:8px">${APPS.map((a, n) => appRow(a, picks[n])).join('')}</div>${hiddenRow(false)}<div style="height:170px"></div></main><div class="fade"></div>
 ${bar('2 apps elegidas', act('bookmark', 'Guardar') + act('bookmark-outline', 'No guardar') + act('eye-off-outline', 'Ocultar', 'color:var(--red)'))}`;

// 5. Hiding: asked first, since what was kept goes with it.
S['7e-ocultar'] = S['7d-elegir-apps'] + dialog(ci('eye-off-outline', C.gry, 54), '¿Ocultar 2 apps?',
  'Se borra lo que se guardó de sus avisos y la app deja de fijarse en ellas. Puedes volver a mostrarlas desde «Apps ocultas».', 'Cancelar', 'Ocultar', true);

// 6. The hidden apps, open, each with "Mostrar".
S['7f-apps-ocultas'] = page(`${faces(0)}${search('Buscar una app o lo que dijo…')}${appsTools()}
 <div class="list" style="margin-top:8px">${APPS.slice(0, 3).map(a => appRow(a)).join('')}</div>${hiddenRow(true)}`);

// 7. The "···": the two ways to forget, each asked first.
S['7g-mas-opciones'] = S['7a-avisos-apps'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <b style="display:block;text-align:center;font-size:17px;margin-bottom:12px">Avisos del banco</b>
 <div class="list"><div class="row">${ci('document-text-outline', C.org, 40)}<div class="tx"><b>Borrar lo guardado</b><small>Se borra el texto de los avisos; la lista de apps se queda</small></div></div>
  <div class="row">${ci('refresh-outline', C.red, 40)}<div class="tx"><b class="r">Olvidar todo</b><small>Avisos, apps marcadas y ocultas: empieza de cero</small></div></div></div></div>`;
S['7h-olvidar-todo'] = S['7a-avisos-apps'] + dialog(ci('refresh-outline', C.red, 54), '¿Olvidar todo?',
  'Se borran los avisos guardados y también la lista de apps, incluidas las que marcaste y las que ocultaste. Empieza de cero.', 'Cancelar', 'Borrar', true);

// 8. Without permission: what the app does and does not do, the one button,
//    and "Ya lo di". Android's own wording is behind the (i).
const promise = (i, t) => `<div class="row">${ci(i, C.grn, 36)}<div class="tx"><small style="color:var(--tx);font-size:14px;margin:0;white-space:normal;line-height:1.4">${t}</small></div></div>`;
S['7i-sin-permiso'] = `${top('Avisos del banco')}<main style="padding-top:18px">
 <div style="text-align:center">${centred(ci('notifications-outline', C.yel, 72), 12)}<b style="font-size:19px">Falta darle permiso</b>
  <div class="sub" style="margin:6px 18px 0;line-height:1.45">Primero vemos qué mandan tus bancos, sin interpretar nada.</div></div>
 <div class="list" style="margin-top:16px">${promise('eye-outline', 'Anota QUÉ apps mandan avisos, sin guardar lo que dicen.')}${promise('checkbox-outline', 'Lo que dice un aviso solo se guarda para las apps que tú marques.')}${promise('phone-portrait-outline', 'Todo se queda en el celular. No se manda a ningún lado.')}</div>
 </main><div style="position:absolute;left:16px;right:16px;bottom:112px"><div class="btn">Abrir los ajustes de Android</div>
  <div class="sub" style="display:flex;gap:6px;justify-content:center;align-items:center;margin-top:8px;font-size:12.5px">Android pedirá leer todos los avisos ${infoDot}</div>
  <div class="btn ghost" style="margin-top:10px">Ya lo di, volver a revisar</div></div>${tabs('Más')}`;
S['7j-sin-permiso-ayuda'] = S['7i-sin-permiso'] + `<div style="position:absolute;left:24px;right:24px;bottom:236px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;bottom:-7px;right:110px;width:12px;height:12px;background:#26324f;border-right:1px solid #3a4a72;border-bottom:1px solid #3a4a72;transform:rotate(45deg)"></span>Android no sabe pedir menos: va a decir que la app puede leer TODOS los avisos del celular. Lo que la app hace con ellos es lo de arriba.</div>`;

// 9. Nothing yet.
const empty = (i, c, t, s) => `${top('Avisos del banco')}<main style="padding-top:90px;text-align:center">${centred(ci(i, c, 84), 16)}
 <b style="font-size:19px">${t}</b><div class="sub" style="margin:8px 24px 0;line-height:1.45">${s}</div></main>${tabs('Más')}`;
S['7k-todavia-nada'] = empty('hourglass-outline', C.blu, 'Todavía no ha llegado ningún aviso', 'Deja el celular un rato y vuelve: aquí aparecen las apps a medida que manden avisos.');
// (No "only on Android" screen: where the phone cannot read notifications,
// Más simply does not offer this entry - see CLAUDE.md, group 7.)

// 10. A search that finds nothing says so.
S['7m-busqueda-sin-nada'] = page(`${faces(1)}${chipApps('Todas las apps')}<div class="search" style="margin-top:10px;border-color:var(--pr)">${ic('search-outline')}<span>nequi</span>${ic('close-circle', 'mu', 'margin-left:auto;width:18px;height:18px')}</div>
 <div style="text-align:center;margin-top:60px">${centred(ci('search-outline', C.gry, 60), 10)}<div class="sub">Nada coincide con la búsqueda.</div></div>`);

export default S;
