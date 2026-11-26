// Group 60 - how an iPhone connects its banks, redrawn (Jose, 2026-11-26,
// on the first simulator picture of the screen: "mucho espacio desperdiciado
// ... texto muy burdo ... alguna imagen o algo representativo para guiarlo").
// Proposed, not decided. iOS lets no app read other apps' notifications; the
// person makes an automation in Apple's Shortcuts app that hands Finance the
// bank's SMS or an Apple Pay payment. These screens say that in less text,
// one step at a time, each step with a drawing of what the person will see.
// The drawings are our own simple sketches of the Shortcuts screens - no
// Apple artwork or logo. Every bank name and figure invented.
import { ic, C, tint, top, ci, chev, tabs } from './lib.mjs';

const S = {};
const B = C.blu, G = C.grn, Y = C.yel;
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.45">${t}</div>`;

// The flow in three icons: the bank's SMS, Atajos, Finance.
const flowIcon = (icon, c, label) => `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:78px">${ci(icon, c, 44)}<span style="font-size:11.5px;color:var(--mu);text-align:center;line-height:1.2">${label}</span></div>`;
const arrow = ic('arrow-forward-outline', '', 'width:18px;height:18px;color:var(--mu);margin-top:13px');
const flow = `<div style="display:flex;justify-content:center;align-items:flex-start;gap:4px;margin:4px 0 2px">
 ${flowIcon('chatbubble-ellipses-outline', C.cya, 'SMS o pago con Apple Pay')}${arrow}
 ${flowIcon('layers-outline', C.pur, 'App Atajos de tu iPhone')}${arrow}
 ${flowIcon('wallet-outline', B, 'Movimientos por revisar')}</div>`;

// One way in: a card with its state and one button.
const door = (icon, c, title, state, stateColor, button, ghost = false) => `<div class="card" style="margin-top:12px;padding:14px 16px">
 <div style="display:flex;align-items:center;gap:12px">${ci(icon, c, 42)}<div style="flex:1;min-width:0"><b style="font-size:16px">${title}</b>
 <div style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:13px;color:${stateColor}"><span style="width:8px;height:8px;border-radius:50%;background:${stateColor};flex:none"></span>${state}</div></div></div>
 <div class="btn ${ghost ? 'ghost' : ''}" style="margin-top:12px;height:44px;font-size:14.5px">${button}</div></div>`;

// 60a - the screen: one short line of why, the flow drawn, two doors.
const main = (sms, pay) => `${top('Notificaciones del teléfono', { right: ci('sparkles-outline', B, 38) })}<main style="padding-top:10px">
 <div class="card" style="padding:14px 14px 12px">
  <b style="font-size:17px;display:block;text-align:center">En iPhone, tus bancos llegan con la app Atajos</b>
  <div class="sub" style="text-align:center;font-size:13px;line-height:1.4;margin:6px 6px 12px">iPhone no deja que una app lea las notificaciones de otras. La app Atajos sí puede pasarle a Finance lo que te llega.</div>${flow}</div>
 ${sms}${pay}
 <div class="list" style="margin-top:12px"><div class="row">${ci('file-tray-full-outline', Y, 38)}<div class="tx"><b>Movimientos por revisar</b><small>3 esperan tu respuesta</small></div>${chev()}</div></div>
 ${note(`${ic('shield-checkmark-outline', '', `width:14px;height:14px;vertical-align:-2px;color:${G}`)} Nada se guarda sin que tú lo apruebes.`)}
 <div style="height:100px"></div></main>${tabs('Más', true)}`;

S['60a-iphone-bancos'] = main(
  door('chatbubble-ellipses-outline', C.cya, 'SMS de tu banco', 'Sin configurar · un minuto por banco', 'var(--mu)', 'Configurar paso a paso'),
  door('card-outline', C.orq, 'Pagos con Apple Pay', 'Sin configurar · necesita iOS 17', 'var(--mu)', 'Configurar paso a paso', true));

// The sketch of the iPhone's own screens: light, like iOS, inside a frame.
const sketch = inner => `<div style="margin:6px auto 0;width:250px;height:330px;border-radius:30px;background:#f2f2f7;border:6px solid #2a3550;overflow:hidden;position:relative;color:#111;font-size:13px">${inner}</div>`;
const iosTitle = t => `<div style="padding:22px 16px 8px;font-size:22px;font-weight:700">${t}</div>`;
const iosRow = (t, icon, on = false, sub = '') => `<div style="display:flex;align-items:center;gap:10px;background:#fff;padding:10px 12px;border-bottom:1px solid #e5e5ea;${on ? `box-shadow:inset 0 0 0 2px ${B};border-radius:10px;position:relative;z-index:1` : ''}">
 <span style="width:28px;height:28px;border-radius:7px;background:${on ? B : '#8e8e93'};display:grid;place-items:center">${ic(icon, '', 'width:16px;height:16px;color:#fff')}</span><div style="flex:1"><div style="font-weight:${on ? 700 : 400}">${t}</div>${sub ? `<div style="font-size:11px;color:#6e6e73">${sub}</div>` : ''}</div>${on ? ic('hand-left-outline', '', `width:20px;height:20px;color:${B};transform:rotate(-20deg)`) : ''}</div>`;
const iosTabs = on => `<div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-around;background:#f9f9fb;border-top:1px solid #d8d8de;padding:8px 0 12px">
 ${[['albums-outline', 'Atajos'], ['time-outline', 'Automatización'], ['grid-outline', 'Galería']].map(([i, t]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:${t === on ? B : '#8e8e93'};${t === on ? `background:${tint(B, .14)};border-radius:10px;padding:3px 8px;box-shadow:0 0 0 2px ${B}` : 'padding:3px 8px'}">${ic(i, '', 'width:20px;height:20px')}${t}</div>`).join('')}</div>`;
const token = t => `<span style="background:${tint(B, .16)};color:${B};border-radius:6px;padding:1px 6px;font-weight:600">${t}</span>`;

// A guided step: progress, the sketch, one sentence, the buttons.
const step = (n, total, title, sketchHtml, words, buttons) => `${top('SMS de tu banco', { left: 'x' })}<main style="padding-top:6px">
 <div style="display:flex;gap:6px;justify-content:center;margin:4px 0 10px">${Array.from({ length: total }, (_, i) => `<span style="height:6px;width:${i + 1 === n ? 22 : 6}px;border-radius:3px;background:${i < n ? B : '#2a3550'}"></span>`).join('')}</div>
 <div class="mu" style="text-align:center;font-size:12.5px">Paso ${n} de ${total}</div>
 <b style="display:block;text-align:center;font-size:19px;margin:4px 10px 8px;line-height:1.3">${title}</b>
 ${sketchHtml}
 <div class="sub" style="text-align:center;font-size:13.5px;line-height:1.45;margin:12px 10px 0">${words}</div>
 <div style="position:absolute;left:16px;right:16px;bottom:24px;display:flex;flex-direction:column;gap:8px">${buttons}</div></main>`;
const next = (t = 'Siguiente') => `<div class="btn">${t}</div>`;
const openApp = `<div class="btn ghost">${ic('open-outline', '', 'width:18px;height:18px')}Abrir la app Atajos</div>`;

// 60b - step 1: the Automation tab.
S['60b-paso-1-automatizacion'] = step(1, 4, 'Abre Atajos y toca Automatización',
  sketch(`${iosTitle('Automatización')}<div style="text-align:center;color:#6e6e73;margin-top:50px;padding:0 20px">Haz que tu iPhone haga cosas solo, cuando pasa algo.</div>
   <div style="margin:18px auto 0;width:170px;height:36px;border-radius:10px;background:${B};color:#fff;display:grid;place-items:center;font-weight:600">Nueva automatización</div>${iosTabs('Automatización')}`),
  'Atajos viene instalada en tu iPhone. Si la borraste, la encuentras gratis en el App Store.',
  `${openApp}${next()}`);

// 60c - step 2: choose Mensaje.
S['60c-paso-2-mensaje'] = step(2, 4, 'Toca Nueva automatización y elige Mensaje',
  sketch(`${iosTitle('Cuándo')}<div style="margin:0 10px;border-radius:12px;overflow:hidden">
   ${iosRow('Hora del día', 'time-outline')}${iosRow('Alarma', 'alarm-outline')}${iosRow('Correo', 'mail-outline')}${iosRow('Mensaje', 'chatbubble-outline', true)}${iosRow('Transacción', 'card-outline')}${iosRow('Wi-Fi', 'wifi-outline')}</div>`),
  'Es la lista de cosas que pueden poner en marcha una automatización.',
  next());

// 60d - step 3: who sends it, and run it at once.
S['60d-paso-3-remitente'] = step(3, 4, 'Elige el número de tu banco y «Ejecutar inmediatamente»',
  sketch(`${iosTitle('Mensaje')}<div style="margin:0 10px;background:#fff;border-radius:12px;overflow:hidden">
   <div style="padding:10px 12px;border-bottom:1px solid #e5e5ea;box-shadow:inset 0 0 0 2px ${B};border-radius:12px 12px 0 0"><div style="font-size:11px;color:#6e6e73">El remitente es</div><b>899999</b></div>
   <div style="padding:10px 12px;color:#6e6e73">El mensaje contiene…</div></div>
   <div style="margin:14px 10px 0;background:#fff;border-radius:12px;overflow:hidden">
   <div style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;box-shadow:inset 0 0 0 2px ${B};border-radius:12px"><span>Ejecutar inmediatamente</span><span style="width:40px;height:24px;border-radius:12px;background:#34c759;position:relative"><span style="position:absolute;right:2px;top:2px;width:20px;height:20px;border-radius:50%;background:#fff"></span></span></div></div>`),
  'Es el número corto o el nombre con que te escribe tu banco. Míralo en un SMS que ya te haya llegado.',
  next());

// 60e - step 4: the action of Finance, with its two blanks.
S['60e-paso-4-accion'] = step(4, 4, 'Agrega la acción de Finance',
  sketch(`${iosTitle('Acción')}<div style="margin:0 10px;background:#fff;border-radius:12px;padding:10px 12px;box-shadow:inset 0 0 0 2px ${B}">
   <div style="display:flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:7px;background:${B};display:grid;place-items:center">${ic('wallet-outline', '', 'width:15px;height:15px;color:#fff')}</span><b style="font-size:12.5px;line-height:1.3">Registrar un mensaje del banco en Finance</b></div>
   <div style="margin-top:10px;line-height:1.9">Registrar ${token('Mensaje')} de ${token('Remitente')} en Finance</div></div>
   <div style="text-align:center;color:#6e6e73;margin-top:16px;padding:0 16px;font-size:12px">Toca cada espacio azul y elige lo que dice: el contenido del mensaje y quién lo envió.</div>`),
  'Toca Nueva acción y escribe «Finance» en el buscador. Después toca Listo.',
  next('Listo'));

// 60f - done: what to expect, and to repeat per bank.
S['60f-listo'] = `${top('SMS de tu banco', { left: 'x' })}<main style="padding-top:40px;text-align:center">
 ${ci('checkmark-circle-outline', G, 72).replace('display:grid', 'display:grid;margin:0 auto 14px')}
 <b style="display:block;font-size:21px">¡Listo!</b>
 <div class="sub" style="font-size:14px;line-height:1.5;margin:8px 18px 0">Cuando te llegue un SMS de ese banco, verás <b style="color:var(--tx)">«Movimiento detectado»</b> y el movimiento te espera en Movimientos por revisar.</div>
 <div class="card" style="margin:22px 4px 0;padding:14px;text-align:left;display:flex;gap:12px;align-items:center">${ci('repeat-outline', Y, 38)}<div class="sub" style="font-size:13px;line-height:1.4">¿Te escriben varios bancos? Haz una automatización por cada uno.</div></div>
 <div style="position:absolute;left:16px;right:16px;bottom:24px;display:flex;flex-direction:column;gap:8px"><div class="btn ghost">Configurar otro banco</div><div class="btn">Volver</div></div></main>`;

// 60g - the screen once a message has come in: the door says it works.
S['60g-funcionando'] = main(
  door('chatbubble-ellipses-outline', C.cya, 'SMS de tu banco', 'Funcionando · último mensaje hoy 10:42', G, 'Configurar otro banco', true),
  door('card-outline', C.orq, 'Pagos con Apple Pay', 'Sin configurar · necesita iOS 17', 'var(--mu)', 'Configurar paso a paso'));

// 60h - option B: every step on the screen at once, a numbered line with a
// small sketch beside each, SMS and Apple Pay as two tabs. No guided steps.
const mini = inner => `<div style="width:92px;height:118px;flex:none;border-radius:14px;background:#f2f2f7;border:3px solid #2a3550;overflow:hidden;color:#111;font-size:8px;padding:6px 5px">${inner}</div>`;
const miniRow = (t, on = false) => `<div style="background:#fff;border-radius:4px;padding:3px 4px;margin-top:3px;${on ? `box-shadow:0 0 0 1.5px ${B};font-weight:700` : ''}">${t}</div>`;
const line = (n, title, words, sk, last = false) => `<div style="display:flex;gap:12px;position:relative">
 <div style="display:flex;flex-direction:column;align-items:center;flex:none"><span style="width:28px;height:28px;border-radius:50%;background:${B};color:#fff;display:grid;place-items:center;font-weight:700;font-size:14px">${n}</span>${last ? '' : '<span style="flex:1;width:2px;background:#2a3550;margin:4px 0"></span>'}</div>
 <div style="flex:1;min-width:0;padding-bottom:16px"><b style="font-size:14.5px;line-height:1.3;display:block">${title}</b><div class="sub" style="font-size:12.5px;line-height:1.4;margin-top:3px">${words}</div></div>${sk}</div>`;
S['60h-opcion-b-todo-en-una'] = `${top('Notificaciones del teléfono', { right: ci('sparkles-outline', B, 38) })}<main style="padding-top:10px">
 <div class="card" style="padding:12px 14px">${flow}</div>
 <div class="seg" style="margin-top:12px"><div class="on">${ic('chatbubble-ellipses-outline')}SMS del banco</div><div>${ic('card-outline')}Apple Pay</div></div>
 <div class="card" style="margin-top:12px;padding:14px 14px 2px">
 ${line(1, 'Abre Atajos y toca Automatización', 'Viene instalada en tu iPhone.', mini(`<b style="font-size:10px">Automatización</b>${miniRow('Nueva automatización', true)}`))}
 ${line(2, 'Elige Mensaje', 'En la lista de lo que pone en marcha la automatización.', mini(`<b style="font-size:10px">Cuándo</b>${miniRow('Hora del día')}${miniRow('Correo')}${miniRow('Mensaje', true)}${miniRow('Transacción')}`))}
 ${line(3, 'El número de tu banco y «Ejecutar inmediatamente»', 'Míralo en un SMS que ya te llegó.', mini(`<b style="font-size:10px">Mensaje</b>${miniRow('Remitente: 899999', true)}${miniRow('Ejecutar inmediatamente ●', true)}`))}
 ${line(4, 'La acción de Finance', 'Busca «Finance» y elige el mensaje y el remitente.', mini(`<b style="font-size:10px">Acción</b>${miniRow('Registrar un mensaje del banco en Finance', true)}`), true)}</div>
 <div class="btn" style="margin-top:12px">${ic('open-outline', '', 'width:18px;height:18px')}Abrir la app Atajos</div>
 <div style="height:100px"></div></main>${tabs('Más', true)}`;

export default S;
