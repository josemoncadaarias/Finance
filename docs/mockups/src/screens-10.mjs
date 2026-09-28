// Group 10 (PROPOSALS, 2026-09-28, not approved): reading bank movements the
// way Lukas does with its iPhone "atajos", and what Android lets this app do
// better. Asked for by Jose from a screenshot of Lukas's list of banks, each
// one "Instalar atajo". Every name and figure is invented; nothing here is
// built. See CLAUDE.md, rule 22, "Ideas from Lukas's atajos".
import { ic, ci, sq, C, tag, tick, sw, top, tabs, tint, jump, mgroup } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const page = (title, body, after = '', right = '') => `${top(title, { right })}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;
const chan = (t, c) => tag(t, c);
const APP = chan('App', C.blu), SMS = chan('SMS', C.tea), MAIL = chan('Correo', C.orq);

// 1. "Tus bancos": what the phone has been SEEN to receive, one card per bank
//    the person turned on, with where it reads from and what it did lately.
//    No built-in list: every name comes from the phone itself.
const bank = (name, i, c, chans, line, on = true) => `<div class="row" style="align-items:flex-start;padding:13px 14px">${ci(i, c, 42)}<div class="tx"><b class="one">${name}</b>
 <div style="display:flex;gap:5px;margin:4px 0 3px;flex-wrap:wrap">${chans}</div><small style="white-space:normal">${line}</small></div>${sw(on)}</div>`;
const found = (name, i, c, chans, line) => `<div class="row" style="align-items:flex-start">${ci(i, c, 40)}<div class="tx"><b class="one">${name}</b><div style="display:flex;gap:5px;margin:4px 0 3px">${chans}</div><small style="white-space:normal">${line}</small></div><span class="chip" style="padding:7px 12px;font-size:13px;color:var(--pr);align-self:center">Activar</span></div>`;
S['10a-tus-bancos'] = page('Avisos del banco', `
 <div class="card hero" style="display:flex;gap:12px;align-items:center;padding:14px">${ci('sparkles-outline', C.grn, 44)}<div style="flex:1"><b style="display:block;font-size:16px">3 bancos leyéndose</b><span class="sub">8 movimientos te esperan en Por revisar</span></div>${ic('chevron-forward-outline', 'chev')}</div>
 <div class="h">Tus bancos ${infoDot}</div>
 <div class="list">${bank('Banco Azul', 'business-outline', C.blu, APP + SMS, 'Último: compra de 45.900 en EXITO POBLADO, hace 12 min · 14 este mes')}
 ${bank('Tarjeta Coral', 'card-outline', C.yel, APP, 'Dice solo «tienes un movimiento»: te pediré el monto · 6 este mes')}
 ${bank('Billetera Verde', 'wallet-outline', C.grn, SMS + MAIL, 'Último: recibiste 2.000.000, ayer · 3 este mes')}</div>
 <div class="h">Encontrados en tu celular</div>
 <div class="list">${found('Remitente 85954', 'chatbubble-ellipses-outline', C.tea, SMS, '«Compra por $120.000 en …» · parece de un banco, 9 mensajes')}
 ${found('Cajita Naranja', 'cube-outline', C.org, APP, '«Moviste $50.000 a tu cajita» · 4 avisos')}</div>`);

// 2. Turning on an SMS sender: the senders the phone has seen, never a list
//    of bank numbers. Only what is ticked is kept.
const sender = (name, n, text, on) => `<div class="row" style="align-items:flex-start">${tick(on)}${ci('chatbubble-outline', on ? C.tea : C.gry, 38)}<div class="tx"><b class="one">${name}</b><small class="one">${n} mensajes · «${text}»</small></div></div>`;
S['10b-elegir-remitentes'] = S['10a-tus-bancos'] + `<div class="scrim"></div><div class="sheet" style="top:120px"><div class="grab"></div>
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">¿De quién leer SMS?</h2><span class="p" style="font-size:15px;font-weight:600">Listo</span></div>
 <div class="sub" style="margin:0 4px 10px">Solo se guarda lo que manden los remitentes que marques. Tus demás mensajes no se leen ni se guardan.</div>
 <div class="list">${sender('85954', 9, 'Compra por $120.000 en TIENDA CENTRO…', true)}${sender('890176', 12, 'Transferiste $300.000 a la cuenta…', true)}${sender('BCOAZUL', 4, 'Tu clave dinámica es…', false)}${sender('Promos Cine', 21, '2x1 este martes en…', false)}</div></div>`;

// 3. Teaching the app one bank's message: the first time, the person checks
//    what was read; the slots become the mold, and the next one is read alone.
const slot = (t, c) => `<span style="background:${tint(c, .22)};color:${c};border-radius:6px;padding:1px 5px;font-weight:600">${t}</span>`;
const read = (lab, i, c, v, note) => `<div class="row">${sq(i, c, 38)}<div class="tx"><span class="k">${lab}</span><b class="one">${v}</b></div>${note}</div>`;
S['10c-ensenale-a-leer'] = `${top('Revisar movimiento', { left: 'x' })}<main>
 <div class="card" style="padding:14px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">${ci('business-outline', C.blu, 28)}<b style="font-size:14px">Banco Azul</b><span class="mu" style="font-size:12.5px">· aviso de hoy 9:12 a. m.</span></div>
  <div style="font-size:14.5px;line-height:1.6;color:#d6dcea">Compraste ${slot('$45.900', C.red)} en ${slot('EXITO POBLADO', C.org)} con tu tarjeta débito ${slot('*1234', C.cya)}. Si no fuiste tú, llámanos.</div></div>
 <div class="list" style="margin-top:12px">${read('Monto', 'cash-outline', C.red, '−45.900,00', tag('leído', C.grn))}
 ${read('Comercio', 'storefront-outline', C.org, 'EXITO POBLADO', tag('leído', C.grn))}
 ${read('Cuenta', 'card-outline', C.cya, 'Banco Azul · débito *1234', tag('aprendida', C.blu))}
 ${read('Categoría', 'basket-outline', C.grn, 'Mercado', tag('aprendida', C.blu))}</div>
 <div class="banner" style="background:${tint(C.blu, .12)};margin-top:12px">${ic('school-outline', 'p')}<span>Al guardarlo, la app recuerda cómo escribe Banco Azul: el próximo aviso así se lee solo, sin preguntarte nada.</span></div>
 </main><div class="save">Guardar y recordar</div>`;

// 4. The one-tap answer, without opening the app: a notification of this
//    app's own, over the bank's, with Guardar right there. The bigger idea,
//    since it needs the reading to happen in the background.
const shade = (app, icon, c, when, title, text, actions = '') => `<div style="background:#1b2336;border-radius:22px;padding:13px 14px;margin-top:10px">
 <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#9aa5bd">${ci(icon, c, 22)}${app} · ${when}</div>
 <b style="display:block;margin-top:7px;font-size:15px">${title}</b><div style="font-size:13.5px;color:#c3cbdb;margin-top:2px;line-height:1.4">${text}</div>
 ${actions ? `<div style="display:flex;gap:18px;margin-top:10px;font-size:14px;font-weight:600;color:var(--pr)">${actions}</div>` : ''}</div>`;
S['10d-guardar-desde-el-aviso'] = `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#2a3148,#11172a)"></div>
 <div style="position:relative;padding:40px 14px 0"><div style="font-size:54px;font-weight:300;text-align:center;letter-spacing:-1px">9:12</div><div style="text-align:center;color:#c3cbdb;font-size:14px;margin-bottom:16px">domingo, 27 de septiembre</div>
 ${shade('Banco Azul', 'business-outline', C.blu, 'ahora', 'Compra aprobada', 'Compraste $45.900 en EXITO POBLADO con tu tarjeta débito *1234.')}
 ${shade('Finance', 'wallet-outline', C.blu, 'ahora', 'Gasto de 45.900 en EXITO POBLADO', 'Banco Azul · Mercado · hoy', '<span>Guardar</span><span>Revisar</span><span style="color:#9aa5bd">Descartar</span>')}
 <div class="note" style="margin:14px 8px 0;color:#aab4c8">Idea más grande: leer el aviso en segundo plano. Nada se guarda sin tocar «Guardar».</div></div>`;

// 5. Por revisar, where both sources end up: each proposal says where it was
//    seen, one purchase seen twice is one proposal, and one tap saves them.
const prop = (i, c, t, v, cls, seen, cat) => `<div class="row">${sq(i, c, 40)}<div class="tx"><b class="one">${t}</b><small class="one">${cat} · ${seen}</small></div><span class="am ${cls}">${v}</span></div>`;
S['10e-por-revisar-avisos'] = `${top('Movimientos por revisar')}<main>
 <div class="card" style="padding:14px"><div style="display:flex;gap:12px;align-items:center">${ci('notifications-outline', C.blu, 42)}<div style="flex:1"><b style="display:block">Avisos de hoy</b><span class="sub">4 movimientos · 3 listos para guardar</span></div></div>
  <div class="btn" style="margin-top:12px">${ic('checkmark-done')}Guardar 3 movimientos listos</div></div>
 ${mgroup('Hoy · domingo 27', 4, '−2.165.900', 'r', true,
   prop('basket-outline', C.grn, 'EXITO POBLADO', '−45.900', 'r', 'visto por aviso y SMS', 'Mercado')
   + prop('bus-outline', C.cya, 'PEAJE AUTOPISTA', '−12.500', 'r', 'visto por SMS', 'Transporte')
   + prop('home-outline', C.org, 'ARRIENDO', '−2.100.000', 'r', 'visto por aviso', 'Vivienda')
   + `<div class="row">${sq('help', C.yel, 40)}<div class="tx"><b class="one">Tarjeta Coral</b><small class="y" style="white-space:normal">Dijo «tienes un movimiento»: falta el monto</small></div><span class="am mu">—</span></div>`)}
 ${mgroup('Sábado 26', 3, '−96.000', 'r', false)}</main><div class="fade"></div>${tabs('Más', true)}`;

// 6. iPhone only, on the day there is an iPhone version: what "Instalar
//    atajo" does. Apple lets no app read another's notifications, so the
//    person installs an automation in Apple's Shortcuts app: "when a message
//    arrives from this sender, hand its text to Finance".
const step = (n, t, s) => `<div class="row" style="align-items:flex-start"><span style="width:28px;height:28px;border-radius:50%;background:${tint(C.blu, .22)};color:var(--pr);display:grid;place-items:center;font-weight:700;flex:none">${n}</span><div class="tx"><b style="white-space:normal">${t}</b><small style="white-space:normal">${s}</small></div></div>`;
S['10f-iphone-atajo'] = page('Avisos del banco', `
 <div class="banner" style="background:${tint(C.gry, .16)};color:#c3cbdb">${ic('logo-apple')}<span>Así se vería en iPhone, el día que exista la versión para iPhone. En Android no hace falta: la app lee los avisos directamente.</span></div>
 <div class="list" style="margin-top:12px"><div class="row" style="align-items:flex-start;padding:13px 14px">${ci('business-outline', C.blu, 42)}<div class="tx"><b>Banco Azul por SMS</b><small style="white-space:normal">Remitente 85954 · compras y transferencias</small></div></div>
  <div style="padding:0 14px 14px"><div class="btn">${ic('flash-outline')}Instalar atajo</div></div></div>
 <div class="h">Qué pasa al tocarlo</div>
 <div class="list">${step(1, 'Se abre la app Atajos de Apple', 'Con la automatización ya escrita: «Cuando llegue un mensaje de 85954».')}
 ${step(2, 'Tocas «Agregar» y «Ejecutar de inmediato»', 'Apple lo pide una vez y desde ahí corre sin preguntar. Lukas avisa que por ahora necesita el celular desbloqueado.')}
 ${step(3, 'Cada SMS del banco llega a Finance', 'El atajo le pasa el texto a la app y queda como propuesta en Por revisar.')}</div>`);

export default S;
