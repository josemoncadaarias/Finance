// Group 57 - banks found by themselves (Jose, 2026-11-11, proposal for his
// word; nothing built). His partner's bank app posted purchases and Finance
// never rang, because an app is read only once it is turned on by hand in
// Notificaciones del teléfono → Agregar un banco. Proposed: an app that posts
// a message saying money MOVED (the same rules the phone already uses for
// "Movimiento detectado": an amount, a word of money moving, not an advert)
// starts being read by itself, the person is told once, and one tap undoes
// it. Every name and figure invented.
import { ic, C, tint, top, ci, accIcon, chev, sw, tabs, tag } from './lib.mjs';

const S = {};
const B = C.blu, G = C.grn, Y = C.yel, R = C.red;
const centred = (html, gap = 10) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.4">${t}</div>`;
const sheet = inner => `<div class="scrim"></div><div class="sheet" style="max-height:88%;overflow:hidden"><div class="grab"></div>${inner}</div>`;

// The phone's lock screen with a notice of Finance's and the bank's own.
const phone = (title, body, actions, bank = true) => `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#5d6b86,#2c3346 45%,#4a5a48)"></div>
 <div style="position:absolute;left:0;right:0;top:20px;text-align:center;color:#fff;font-size:64px;font-weight:300">9:41</div>
 <div style="position:absolute;left:14px;right:14px;top:130px;background:#202226;border-radius:28px;padding:18px 20px">
  <div style="display:flex;align-items:center;gap:10px;color:#c9cdd6;font-size:14px"><span style="width:34px;height:34px;border-radius:50%;background:${B};display:grid;place-items:center">${ic('wallet-outline', '', 'width:18px;height:18px;color:#fff')}</span>Finance · ahora</div>
  <b style="display:block;font-size:19px;margin-top:12px;line-height:1.3">${title}</b>
  <div style="color:#c9cdd6;font-size:14.5px;line-height:1.45;margin-top:6px">${body}</div>
  <div style="display:flex;justify-content:space-between;margin-top:16px;color:#a8c7fa;font-weight:600;font-size:15px">${actions}</div></div>
 ${bank ? `<div style="position:absolute;left:14px;right:14px;top:430px;background:#202226;border-radius:28px;padding:18px 20px;color:#c9cdd6">
  <div style="font-size:14px">Billetera Verde · ahora</div><b style="display:block;font-size:17px;margin-top:8px;color:#fff">Compra aprobada</b>
  <div style="font-size:14px;margin-top:4px">Compraste $45.000 en Panadería Trigo con tu tarjeta débito.</div></div>` : ''}`;

// 57a - the first movement of an app nobody turned on: it rings, and says
// once that the app is read from now on.
S['57a-aviso-banco-nuevo'] = phone('💸 Gasto detectado · −$ 45.000',
  'Panadería Trigo · Billetera Verde<br><span style="color:#fff">Es la primera vez que Billetera Verde te avisa de dinero. Desde ahora leemos sus avisos de compras y pagos.</span>',
  '<span>Revisar y guardar</span><span>Más tarde</span><span style="color:#f2b8b5">No es mi banco</span>');

// 57b - the same, for whoever chose "Preguntarme antes" (57f): nothing is
// read until the person says so.
S['57b-aviso-preguntar'] = phone('🏦 ¿Billetera Verde es tu banco?',
  'Te avisó de un gasto de $ 45.000. Si lo lees, el gasto queda listo para revisar y los próximos también.',
  '<span>Sí, leerlo</span><span style="color:#f2b8b5">No, ignorarlo</span>');

// 57c - Revisar movimiento on that first message: the account is asked
// INSIDE the form (never a step before it), with the likeliest first.
const said = `<div style="display:flex;align-items:center;gap:8px;background:#0a1222;border:1px dashed #2a3a5c;border-radius:12px;padding:8px 11px;margin-top:10px">${ic('notifications-outline', '', `width:17px;height:17px;flex:none;color:${B}`)}<span class="one" style="font-size:12.5px;color:#b9c3d8">Compraste $45.000 en Panadería Trigo con tu tarjeta…</span></div>`;
const accRow = (icon, name, line, on) => `<div class="row">${icon}<div class="tx"><b>${name}</b><small>${line}</small></div>${on ? ic('checkmark', 'p') : ''}</div>`;
S['57c-de-que-cuenta'] = `${top('Revisar movimiento', { left: 'x' })}<main style="padding-top:8px">
 <div class="seg"><div class="on">Gasto</div><div>Ingreso</div><div>Transferir</div></div>${said}
 <div class="amount" style="text-align:center;margin:18px 0 6px"><span class="r" style="font-size:38px;font-weight:700">−$ 45.000</span></div></main>
 ${sheet(`<div class="sh"><h2 style="white-space:normal;line-height:1.3">¿A qué cuenta llegan los avisos de Billetera Verde?</h2></div>
 <div class="mu" style="font-size:13px;line-height:1.4;margin:0 4px 10px">Lo preguntamos una sola vez. Los próximos avisos llegan a esa cuenta.</div>
 <div class="list">
  ${accRow(ci('leaf-outline', G, 38), 'Billetera Verde', 'Se llama igual que la app', true)}
  ${accRow(accIcon('azul', 38), 'Banco Azul', 'Débito')}
  ${accRow(accIcon('coral', 38), 'Tarjeta Coral', 'Tarjeta de crédito')}</div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('add', B, 38)}<div class="tx"><b>Crear la cuenta Billetera Verde</b><small>Si aún no la tienes en la app</small></div></div></div>`)}`;

// 57d - Notificaciones del teléfono: what was turned on by itself is said
// on top, once, with "No es mi banco" beside each.
const bank = (icon, name, how, extra = '') => `<div class="row">${icon}<div class="tx"><b>${name}</b><small style="white-space:normal">${how}</small></div>${extra}${chev()}</div>`;
S['57d-bancos-detectados'] = `${top('Notificaciones del teléfono', { sub: 'Tus compras llegan solas para revisarlas' })}<main>
 <div class="card" style="padding:14px;border-color:${tint(B, .5)};background:${tint(B, .1)}">
  <div style="display:flex;gap:12px;align-items:flex-start">${ci('sparkles-outline', B, 36)}<div class="tx"><b style="white-space:normal">Encontramos 2 bancos nuevos</b><small style="white-space:normal;line-height:1.4">Te avisaron de compras o pagos, así que ya leemos sus avisos. Si alguno no es tuyo, tócalo y elige «No es mi banco».</small></div></div>
  <div class="btn ghost" style="margin-top:12px;height:40px">Entendido</div></div>
 <div class="card" style="margin-top:10px;padding:12px 14px;display:flex;gap:12px;align-items:center">${ci('checkmark', G, 36)}<div class="tx"><b>Funcionando</b><small>Último aviso de un banco: hoy 9:41</small></div></div>
 <div class="h">Tus bancos</div><div class="list">
  ${bank(ci('leaf-outline', G, 38), 'Billetera Verde', 'Su app · encontrado hoy', tag('Nuevo', B))}
  ${bank(ci('chatbubble-ellipses-outline', C.cya, 38), 'SMS 899979', 'Sus SMS · encontrado ayer · falta elegir la cuenta', tag('Nuevo', B))}
  ${bank(accIcon('azul', 38), 'Banco Azul', 'Su app y sus SMS')}</div>
 <div class="btn ghost" style="margin-top:12px;height:46px">${ic('add')}Agregar un banco a mano</div>
 ${note('Una app que no es de bancos nunca se lee: solo un aviso que dice que se movió dinero hace que la app empiece a leerla.')}</main>${tabs('Más', true)}`;

// 57e - a bank's page: why it is read, and the way out.
const msg = (when, text, what, c) => `<div class="row" style="align-items:flex-start"><div class="tx"><small>${when}</small><b style="white-space:normal;font-weight:500;font-size:14px;line-height:1.35">${text}</b><small style="color:${c}">${what}</small></div></div>`;
S['57e-pagina-del-banco'] = `${top('Billetera Verde')}<main>
 <div class="card" style="padding:14px">
  <div style="display:flex;gap:12px;align-items:center">${ci('leaf-outline', G, 44)}<div class="tx"><b>Billetera Verde</b><small>Su app · llega a la cuenta Billetera Verde</small></div></div>
  <div style="margin-top:12px;font-size:13.5px;line-height:1.45;color:#c4cce0">${ic('sparkles-outline', '', `width:16px;height:16px;vertical-align:-3px;color:${B}`)} La leemos desde hoy 9:41, cuando te avisó de un gasto de $ 45.000.</div></div>
 <div class="h">Sus últimos mensajes</div><div class="list">
  ${msg('Hoy 9:41', 'Compraste $45.000 en Panadería Trigo con tu tarjeta débito.', 'Por revisar', Y)}
  ${msg('Ayer 18:02', '¡Aprovecha! Recarga y gana 2% de cashback hasta el domingo.', 'Publicidad: no se tomó como movimiento', 'var(--mu)')}</div>
 <div class="list" style="margin-top:14px">
  <div class="row">${ci('swap-horizontal-outline', B, 36)}<div class="tx"><b>Cambiar la cuenta</b><small>Billetera Verde</small></div>${chev()}</div>
  <div class="row">${ci('close-circle-outline', R, 36)}<div class="tx"><b style="color:${R}">No es mi banco</b><small style="white-space:normal">Deja de leerla y no la vuelve a encontrar sola</small></div></div></div>
</main>${tabs('Más')}`;

// 57f - the one choice, in "Ajustes de los avisos": find banks by itself
// (the default) or ask first.
const opt = (title, sub, on) => `<div class="row" style="padding:13px 14px"><div class="tx"><b>${title}</b><small style="white-space:normal;line-height:1.35">${sub}</small></div>${on ? ic('checkmark', 'p') : ''}</div>`;
S['57f-ajuste-encontrar'] = S['57d-bancos-detectados'] + sheet(`<div class="sh"><h2>Ajustes de los avisos</h2>${ic('close', 'mu')}</div>
 <div class="h" style="margin-top:4px">Cuando una app nueva te avise de dinero</div>
 <div class="list">
  ${opt('Empezar a leerla de una vez', 'Recomendado. Te avisamos y el movimiento queda para revisar. Puedes decir «No es mi banco».', true)}
  ${opt('Preguntarme antes', 'Te preguntamos si es tu banco. Hasta que digas que sí, no se lee nada de esa app.', false)}
  ${opt('No buscar bancos', 'Solo se leen los bancos que agregas a mano.', false)}</div>
 <div class="list" style="margin-top:12px">
  <div class="row">${ci('flash-outline', Y, 36)}<div class="tx"><b>Avisarme siempre al instante</b><small style="white-space:normal">El aviso llega en el momento. Gasta un poco más de batería.</small></div>${sw(false)}</div>
  <div class="row">${ci('eye-off-outline', C.gry, 36)}<div class="tx"><b>Apps que no son tus bancos</b><small>3 apps que dijiste que no</small></div>${chev()}</div></div>`);

// 57g - the way in for someone who never opened Notificaciones del teléfono:
// right after the first account is saved, one card on Inicio.
S['57g-inicio-invitacion'] = `${top('Inicio', { left: '' })}<main>
 <div class="card" style="padding:16px;text-align:center">
  ${centred(ci('notifications-outline', B, 54))}
  <b style="font-size:17px;display:block">¿Quieres que tus compras lleguen solas?</b>
  <div class="mu" style="font-size:13.5px;line-height:1.45;margin-top:6px">Cuando tu banco te avise de una compra o un pago, Finance la deja lista para que la revises. No guarda nada sin que tú lo confirmes.</div>
  <div class="btn" style="margin-top:14px">Permitir leer los avisos</div>
  <div class="p" style="margin-top:12px;font-size:14px">Ahora no</div></div>
 <div class="card" style="margin-top:12px;padding:14px 16px;opacity:.55"><div class="mu" style="font-size:13px">Banco Azul</div><b style="font-size:28px">$ 1.250.000</b></div>
 ${note('Después de permitirlo, la app encuentra sola las apps de tus bancos: no tienes que buscarlas.')}</main>${tabs('Inicio')}`;

export default S;
