// Group 59 - a widget on the phone's home screen (Jose, 2026-11-25, after
// Lukas's post on going native: the widget is what makes an app feel native,
// and it needs no migration). Proposed, nothing built. A widget is a small
// piece of Finance that lives among the phone's own icons: it says "Puedes
// gastar hoy" without opening the app, and its buttons open the one movement
// form directly. Nothing is ever saved from the widget itself (rule 22).
// Figures and names invented; the other apps are generic, no brand.
import { readFileSync } from 'node:fs';
import { ic, C, tint, ACCENT } from './lib.mjs';

const S = {};
const logo = `data:image/png;base64,${readFileSync(new URL('./assets/logo-wallet.png', import.meta.url)).toString('base64')}`;
const $ = v => `$&nbsp;${v}`;

// The phone's own home screen around the widget.
const wall = `position:absolute;inset:0;background:
 radial-gradient(circle at 18% 22%,rgba(120,90,220,.35),transparent 45%),
 radial-gradient(circle at 85% 70%,rgba(40,160,180,.28),transparent 50%),
 linear-gradient(170deg,#1b2340,#0c1224 60%,#0a1020)`;
const app = (icon, name, bg, img = '') => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:72px">
 <span style="width:54px;height:54px;border-radius:50%;background:${bg};display:grid;place-items:center;color:#fff;overflow:hidden">${img || ic(icon, '', 'width:26px;height:26px')}</span>
 <span style="font-size:12px;color:#eef2f9;text-shadow:0 1px 3px rgba(0,0,0,.6)">${name}</span></div>`;
const finance = app('', 'Finance', '#0d1527', `<img src="${logo}" style="width:44px">`);
const row = items => `<div style="display:flex;justify-content:space-between;padding:0 18px">${items.join('')}</div>`;
const apps1 = row([app('call-outline', 'Teléfono', '#2e9d5b'), app('chatbubble-outline', 'Mensajes', '#3b7be0'), app('camera-outline', 'Cámara', '#55606f'), app('images-outline', 'Galería', '#d9534f')]);
const apps2 = row([app('calendar-outline', 'Calendario', '#4a6ee0'), app('time-outline', 'Reloj', '#3a4458'), finance, app('settings-outline', 'Ajustes', '#5b6578')]);
const dock = `<div style="position:absolute;left:14px;right:14px;bottom:26px;height:84px;border-radius:30px;background:rgba(255,255,255,.08);display:flex;justify-content:space-around;align-items:center">
 ${['call-outline', 'chatbubble-outline', 'globe-outline', 'camera-outline'].map(i => `<span style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;color:#fff">${ic(i, '', 'width:25px;height:25px')}</span>`).join('')}</div>`;
const clock = `<div style="padding:40px 22px 0;color:#fff"><div style="font-size:64px;font-weight:300;letter-spacing:-1px;line-height:1">9:41</div>
 <div style="font-size:15px;margin-top:6px;opacity:.85">martes, 25 de noviembre · 24°</div></div>`;
const status = `<div style="display:flex;justify-content:space-between;padding:8px 22px;font-size:13px;color:#fff">${'<span>9:41</span><span>5G ▮▮▮ 87%</span>'}</div>`;
// What each drawing shows, in plain words, over the wallpaper.
const note = (t, bottom = 128) => `<div style="position:absolute;left:14px;right:14px;bottom:${bottom}px;background:rgba(7,13,26,.88);border:1px dashed ${tint(ACCENT, .6)};border-radius:16px;padding:10px 14px;font-size:13px;line-height:1.4;color:#d7deea">${t}</div>`;
const home = (widget, text, below = apps1 + '<div style="height:22px"></div>' + apps2) => `<div style="${wall}"></div><div style="position:relative">${status}${clock}<div style="padding:22px 14px 0">${widget}</div><div style="margin-top:26px">${below}</div></div>${note(text)}${dock}`;

// The widget's frame: the app's own card, a little more rounded, as Android draws them.
const frame = (body, style = '') => `<div style="background:linear-gradient(145deg,${tint(ACCENT, .38)},#111b2f 70%);border:1px solid ${tint(ACCENT, .35)};border-radius:26px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.45);color:#eef2f9;${style}">${body}</div>`;
const headRow = (eye = 'eye-outline') => `<div style="display:flex;align-items:center;gap:8px">
 <img src="${logo}" style="width:22px"><span style="font-size:12.5px;color:#cfd6e4;flex:1">Finance</span>
 <span style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.08);display:grid;place-items:center;color:#d7deea">${ic(eye, '', 'width:17px;height:17px')}</span></div>`;
const btn = (icon, label, color) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:42px;border-radius:21px;background:${tint(color, .2)};color:${color};font-weight:600;font-size:14px">${ic(icon, '', 'width:18px;height:18px')}${label}</div>`;
const round = icon => `<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.1);display:grid;place-items:center;color:#d7deea;flex:none">${ic(icon, '', 'width:20px;height:20px')}</div>`;
const buttons = `<div style="display:flex;gap:8px;margin-top:12px">${btn('remove-circle-outline', 'Gasto', C.red)}${btn('add-circle-outline', 'Ingreso', C.grn)}${round('sparkles-outline')}</div>`;

const medium = ({ label = 'Hoy puedes gastar', figure = $('54.000'), cls = '', line = `De ${$('702.000')} libres hasta el 30 de noviembre`, eye } = {}) => frame(`${headRow(eye)}
 <div style="font-size:13px;color:#cfd6e4;margin-top:8px">${label}</div>
 <div style="font-size:34px;font-weight:700;margin-top:2px;${cls}">${figure}</div>
 <div style="font-size:12.5px;color:#aab4c8;margin-top:2px">${line}</div>${buttons}`);

// 59a - Option A (recommended): medium, 4 x 2. The figure and the buttons.
S['59a-widget-mediano'] = home(medium(), '<b>Opción A (recomendada).</b> Mediano: lo que puedes gastar hoy y tres botones. «Gasto» e «Ingreso» abren el formulario de siempre ya listo para escribir el valor; la estrella abre el asistente. El ojo oculta la cifra.');

// 59b - Option B: small, 2 x 2, beside the apps.
const small = frame(`<div style="display:flex;align-items:center;gap:6px"><img src="${logo}" style="width:20px"><span style="font-size:12px;color:#cfd6e4">Hoy puedes gastar</span></div>
 <div style="font-size:26px;font-weight:700;margin-top:6px">${$('54.000')}</div>
 <div style="font-size:11.5px;color:#aab4c8">para hoy</div>
 <div style="display:flex;justify-content:center;align-items:center;gap:6px;height:38px;margin-top:10px;border-radius:19px;background:var(--pr);color:#fff;font-weight:600;font-size:14px">${ic('add', '', 'width:19px;height:19px')}Gasto</div>`, 'width:180px;padding:14px');
S['59b-widget-pequeno'] = home(`<div style="display:flex;gap:14px;align-items:flex-start">${small}<div style="display:grid;grid-template-columns:72px 72px;gap:16px 14px;padding-top:4px">${app('calendar-outline', 'Calendario', '#4a6ee0')}${app('time-outline', 'Reloj', '#3a4458')}${finance}${app('settings-outline', 'Ajustes', '#5b6578')}</div></div>`,
  '<b>Opción B.</b> Pequeño, del tamaño de cuatro íconos: solo la cifra y un botón para registrar un gasto. Ocupa poco, pero no deja registrar ingresos.', apps1);

// 59c - Option C: large, 4 x 3. The figure, what is due next, the last movements.
const mov = (icon, color, t, s, v, cls) => `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
 <span style="width:32px;height:32px;border-radius:30%;background:${tint(color)};color:${color};display:grid;place-items:center">${ic(icon, '', 'width:16px;height:16px')}</span>
 <div style="flex:1;min-width:0"><div style="font-size:13.5px">${t}</div><div style="font-size:11.5px;color:#aab4c8">${s}</div></div><b style="font-size:13.5px;color:${cls}">${v}</b></div>`;
const large = frame(`${headRow()}
 <div style="display:flex;align-items:baseline;gap:8px;margin-top:8px"><span style="font-size:13px;color:#cfd6e4">Hoy puedes gastar</span><b style="font-size:26px">${$('54.000')}</b></div>
 <div style="margin-top:8px;padding:8px 10px;border-radius:14px;background:${tint(C.yel, .16)};color:${C.yel};font-size:12.5px;display:flex;align-items:center;gap:6px">${ic('card-outline', '', 'width:16px;height:16px')}La Tarjeta Coral se paga en 3 días · ${$('850.000')}</div>
 <div style="margin-top:6px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px">
  ${mov('restaurant-outline', C.red, 'Almuerzo', 'Restaurantes · hoy', '−' + $('45.900'), C.red)}
  ${mov('basket-outline', C.grn, 'Mercado de la semana', 'Mercado · ayer', '−' + $('212.300'), C.red)}</div>${buttons}`);
S['59c-widget-grande'] = home(large, '<b>Opción C.</b> Grande: además de la cifra, el próximo pago y los dos últimos movimientos. Tocar un movimiento lo abre para corregirlo. Ocupa casi media pantalla.', '');

// 59d - Amounts hidden: with "Ocultar montos al abrir" on, or the eye tapped.
S['59d-montos-ocultos'] = home(medium({ figure: '••••••', line: 'Toca el ojo para ver la cifra', eye: 'eye-off-outline' }),
  '<b>Montos ocultos.</b> Si en Finance tienes «Ocultar montos al abrir», el widget también sale oculto, porque cualquiera ve la pantalla de inicio. El ojo la muestra unos segundos; los botones siguen funcionando.');

// 59e - A month gone over: the same widget in red.
S['59e-mes-pasado'] = home(medium({ label: 'Este mes ya gastaste de más', figure: '−' + $('120.000'), cls: `color:${C.red}`, line: 'Te faltan para tus pagos y metas del mes' }),
  '<b>Cuando no alcanza.</b> La cifra sale en rojo y dice cuánto falta. Es la misma cuenta que «Puedes gastar hoy» en Inicio: nunca una cifra distinta.');

// 59f - How the person puts it on the home screen: Android's own widget list.
const pick = (title, size, body) => `<div style="margin-top:14px"><div style="font-size:13px;color:#aab4c8;margin-bottom:6px">${title} · ${size}</div>${body}</div>`;
S['59f-agregar-widget'] = `<div style="${wall};filter:brightness(.5)"></div><div style="position:absolute;left:0;right:0;bottom:0;top:120px;background:#121a2c;border-radius:28px 28px 0 0;padding:18px 18px;overflow:hidden">
 <div style="width:40px;height:4px;border-radius:2px;background:#3a4560;margin:0 auto 14px"></div>
 <div style="display:flex;align-items:center;gap:10px"><img src="${logo}" style="width:34px"><b style="font-size:19px;flex:1">Finance</b><span style="color:#aab4c8;font-size:13px">Elige un tamaño</span></div>
 ${pick('Mediano', '4 × 2', `<div style="transform:scale(.86);transform-origin:left top;width:116%;margin-bottom:-26px">${medium()}</div>`)}
 ${pick('Pequeño', '2 × 2', `<div style="transform:scale(.86);transform-origin:left top;margin-bottom:-22px">${small}</div>`)}
 <div style="position:absolute;left:14px;right:14px;bottom:24px;background:rgba(7,13,26,.92);border:1px dashed ${tint(ACCENT, .6)};border-radius:16px;padding:10px 14px;font-size:13px;line-height:1.4;color:#d7deea"><b>Cómo se pone.</b> Mantienes presionada la pantalla de inicio, tocas «Widgets», buscas Finance y arrastras el que quieras. Se quita igual que cualquier otro.</div></div>`;

export default S;
