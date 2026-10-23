// Group 41 - the assistant finds things in the notes, every movement in an
// answer opens, "¿Te referías a...?" after each answer, a welcome made of the
// person's own data, and two new questions: the biggest spending and how to
// save more (Jose, 2026-10-23, after Lukas's chat). No AI: the notes are
// searched by their words, as Inicio's search does. Figures and names invented.
import { ic, C, tint, top, ci, sq, catIcon } from './lib.mjs';

const S = {};
const keep = t => t.replace(/(\d) %/g, '$1 %').replace(/\$ /g, '$ ').replace(/(\d) (mil|millones|km|meses)/g, '$1 $2');
const me = t => `<div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="max-width:78%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.35;text-wrap:pretty">${keep(t)}</div></div>`;
const app = t => `<div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">${ci('sparkles-outline', C.blu, 30)}<div style="max-width:82%;background:var(--s1);border:1px solid #1c2944;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.4;text-wrap:pretty">${keep(t)}</div></div>`;
const card = inner => `<div style="margin:8px 0 0 38px;text-wrap:pretty;background:var(--s1);border:1px solid #22314f;border-radius:18px;padding:12px 14px">${keep(inner)}</div>`;
const lab = (t, mt = 12) => `<div class="lab" style="margin:${mt}px 0 2px">${t}</div>`;
const note = t => `<div class="sub" style="margin-top:8px;font-size:12.5px;line-height:1.4">${t}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13.8px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:600;white-space:nowrap">${v}</b></div>`;
const btn = t => `<div class="btn ghost" style="height:42px;margin-top:12px">${t}</div>`;
// "¿Te referías a...?" - the follow-up questions under an answer.
const follow = (...t) => `<div style="margin:12px 0 0 38px"><div class="lab" style="margin-bottom:6px">También puedes preguntar</div><div style="display:flex;gap:8px;flex-wrap:wrap">${t.map(x => `<span class="chip" style="color:var(--pr)">${x}</span>`).join('')}</div></div>`;
// A movement inside an answer: the whole row opens it (the chevron says so).
const mov = (k, title, sub, amount, cls = 'r', noteText = '', hl = '') => `<div style="padding:9px 0;border-top:1px solid var(--line)">
 <div style="display:flex;align-items:center;gap:10px">${catIcon(k, 34)}<div style="flex:1;min-width:0"><b class="one" style="display:block;font-size:14.5px">${title}</b><small class="mu" style="font-size:12.5px">${sub}</small></div><b class="${cls}" style="white-space:nowrap">${amount}</b>${ic('chevron-forward-outline', 'mu', 'width:16px;height:16px')}</div>
 ${noteText ? `<div style="margin:8px 0 0 44px;background:var(--s2);border-radius:12px;padding:9px 11px;font-size:13px;line-height:1.45;white-space:pre-line">${ic('document-text-outline', 'mu', 'width:14px;height:14px;vertical-align:-2px;margin-right:4px')}${noteText.replace(hl, `<mark style="background:${tint(C.yel, .3)};color:inherit;border-radius:3px;padding:0 2px">${hl}</mark>`)}</div>` : ''}</div>`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 16px 24px;background:#0b1324;border-top:1px solid #18243d;display:flex;gap:10px;align-items:center">
 <div class="search" style="flex:1;padding:12px 14px">Escribe o habla</div>
 <span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;color:#fff;flex:none">${ic('mic-outline', '', 'width:22px;height:22px')}</span></div>`;
const chat = body => `${top('Asistente', { sub: 'Registra o pregunta, por texto o por voz' })}<main style="padding-bottom:110px">${body}</main>${bar}`;
const ex = (icon, t, sub = '') => `<div class="row plain">${ic(icon, 'p')}<div class="tx"><b style="white-space:normal">«${keep(t)}»</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;

// 41a - the welcome is made of the person's own data: their biggest category,
// a figure near their "Puedes gastar hoy", a word from their notes.
S['41a-bienvenida-tus-datos'] = chat(`
 <div style="text-align:center;margin:18px 0 6px">${ci('sparkles-outline', C.blu, 60).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:19px">¿Qué quieres saber?</b>
  <div class="sub" style="margin-top:6px">Te respondo con tus propios datos, en tu celular. Nada sale de él.</div></div>
 <div class="h">Para ti, hoy</div>
 <div class="list">
  ${ex('pie-chart-outline', '¿Cuánto llevo en Restaurantes este mes?', 'Es tu categoría que más subió')}
  ${ex('help-circle-outline', '¿Me alcanza para gastar $ 200.000 hoy?', 'Hoy puedes gastar $ 73.100')}
  ${ex('search-outline', '¿Cuándo fue la última vez que pagué el SOAT?', 'Lo busco en tus notas')}
  ${ex('calendar-outline', '¿Qué pagos tengo esta semana?', 'Tienes 2 por pagar')}</div>
 <div class="h">Registrar</div>
 <div class="list">
  ${ex('arrow-up', 'Gasté 45 mil en el mercado')}
  ${ex('swap-horizontal', 'Pasé 200 mil a Ahorro Verde')}</div>
 ${note('Las preguntas de "Para ti, hoy" cambian con lo que registras.')}`);

// 41b - a question answered from a note: the movement found by its words, the
// note shown whole with the words that matched, the row opens the movement.
S['41b-cuando-fue-el-ultimo'] = chat(`
 ${me('¿Cuándo fue el último mantenimiento de la moto?')}
 ${app('Fue el <b>22 de abril de 2026</b>, hace 6 meses: $ 131.939 en Transporte. Según tu nota, el próximo es en 3000 km o 6 meses, así que <b>ya te toca</b>.')}
 ${card(`${lab('Lo encontré en tus notas', 0)}
  ${mov('transp', 'Mantenimiento moto', 'Banco Azul · 22 abr 2026', '−$ 131.939', 'r', 'Km: 6638\nCambio de aceite y filtro. Kit de arrastre. Próximo mantenimiento 3000 km o 6 meses.', 'Próximo mantenimiento 3000 km o 6 meses')}
  ${lab('Las veces anteriores')}
  ${mov('transp', 'Mantenimiento moto', 'Banco Azul · 18 oct 2025', '−$ 118.500')}
  ${mov('transp', 'Mantenimiento moto', 'Efectivo · 9 abr 2025', '−$ 104.000')}
  ${note('3 veces en el último año y medio, más o menos cada 6 meses · $ 354.439 en total.')}`)}
 ${follow('Recordarme el próximo', '¿Cuánto gasté en Transporte este año?', '¿Cuánto me cuesta la moto?')}`);

// 41c - the row tapped: the movement opens in the one movement form, as from
// Inicio. Shown as the sheet it is.
S['41c-abrir-el-movimiento'] = `${top('Editar gasto', { right: ic('trash-outline', '', 'width:22px;height:22px;color:var(--red)') })}<main>
 <div class="lab" style="margin-top:6px">Monto</div>
 <div style="font-size:34px;font-weight:700;margin:4px 0 12px" class="r">$ 131.939</div>
 <div class="list">
  <div class="row">${ci('wallet-outline', C.blu, 38)}<div class="tx"><small>Desde</small><b>Banco Azul</b></div>${ic('chevron-forward-outline', 'chev')}</div>
  <div class="row">${catIcon('transp', 38)}<div class="tx"><small>Categoría</small><b>Transporte</b></div>${ic('chevron-forward-outline', 'chev')}</div>
  <div class="row">${ci('calendar-outline', C.cya, 38)}<div class="tx"><small>Fecha</small><b>Miércoles 22 de abril de 2026</b></div>${ic('chevron-forward-outline', 'chev')}</div></div>
 <div class="lab" style="margin-top:14px">Nota</div>
 <div style="background:var(--s1);border:1px solid var(--line);border-radius:16px;padding:12px 14px;font-size:14px;line-height:1.5;white-space:pre-line">Mantenimiento moto
Km: 6638
Cambio de aceite y filtro. Kit de arrastre. Próximo mantenimiento 3000 km o 6 meses.</div>
 ${note('Es el mismo formulario de siempre: lo que cambies aquí cambia el movimiento. Al cerrar vuelves a la conversación.')}
 <div class="btn" style="height:48px;margin-top:16px">Guardar</div></main>`;

// 41d - several matches: the newest first, and how often it happens.
S['41d-varias-veces'] = chat(`
 ${me('¿Cuándo pagué el SOAT?')}
 ${app('Lo pagaste <b>3 veces</b>, una vez al año. La última fue el <b>14 de marzo de 2026</b> por $ 642.000. Si sigue igual, el próximo es por marzo de 2027.')}
 ${card(`${lab('Lo encontré en tus notas', 0)}
  ${mov('transp', 'SOAT moto', 'Tarjeta Coral · 14 mar 2026', '−$ 642.000')}
  ${mov('transp', 'SOAT moto', 'Tarjeta Coral · 11 mar 2025', '−$ 598.000')}
  ${mov('transp', 'Pago SOAT', 'Banco Azul · 16 mar 2024', '−$ 554.000')}
  ${note('Subió 8 % del año pasado a este.')}`)}
 ${follow('Recordarme en marzo', '¿Cuánto me cuesta la moto al año?')}`);

// 41e - nothing found: says what it looked for, and offers what is close.
S['41e-no-lo-encontre'] = chat(`
 ${me('¿Cuándo fue la última vez que fui al odontólogo?')}
 ${app('No encontré «odontólogo» en tus notas ni en tus categorías.')}
 ${card(`${lab('¿Te referías a esto?', 0)}
  ${mov('salud', 'Dentista limpieza', 'Banco Azul · 3 sep 2026', '−$ 95.000')}
  ${mov('salud', 'Consulta odontologia', 'Efectivo · 12 feb 2026', '−$ 80.000')}
  ${note('Busco por las palabras que escribiste en la nota y en la categoría del movimiento. Si no aparece, prueba con otra palabra.')}`)}
 ${follow('¿Cuánto llevo en Salud este año?', 'Buscar «dentista»')}`);

// 41f - when a question is not understood, nearby questions instead of "no sé".
S['41f-te-referias'] = chat(`
 ${me('cuanto la moto')}
 ${app('No estoy seguro de qué quieres saber. ¿Te referías a alguna de estas?')}
 ${card(`<div class="list" style="margin:0;background:none">
  ${ex('pie-chart-outline', '¿Cuánto gasté en la moto este año?', 'Sumo los movimientos con «moto» en la nota')}
  ${ex('search-outline', '¿Cuándo fue el último gasto de la moto?', 'Lo busco en tus notas')}
  ${ex('arrow-up', 'Registrar un gasto de la moto', 'Abro el formulario con «moto» en la nota')}</div>`)}
 ${note('<span style="margin-left:38px;display:block">Si eliges una, la recuerdo para la próxima vez que lo digas así.</span>')}`);

// 41g - the biggest spending of a period, each row opens.
S['41g-gasto-mas-grande'] = chat(`
 ${me('¿Cuál fue mi gasto más grande este mes?')}
 ${app('Fue el <b>arriendo</b>: $ 1.400.000 el 5 de octubre. Después de ese, el más grande fue el mercado del 12.')}
 ${card(`${lab('Tus 5 gastos más grandes de octubre', 0)}
  ${mov('vivienda', 'Arriendo', 'Banco Azul · 5 oct', '−$ 1.400.000')}
  ${mov('mercado', 'Mercado del mes', 'Tarjeta Coral · 12 oct', '−$ 386.000')}
  ${mov('servicios', 'Energía y agua', 'Banco Azul · 9 oct', '−$ 214.300')}
  ${mov('ropa', 'Tenis', 'Tarjeta Coral · 17 oct', '−$ 189.900')}
  ${mov('rest', 'Cumpleaños de Ana', 'Efectivo · 18 oct', '−$ 152.000')}
  ${note('Entre los 5 suman $ 2.342.200, el 57 % de lo que gastaste este mes.')}
  ${btn('Ver todos por monto en Inicio')}`)}
 ${follow('¿Y el mes pasado?', '¿En qué gasté más?')}`);

// 41h - "¿Cómo ahorro más?": only the person's own figures, never invented
// advice - what went up, the fixed payments, small repeated spending.
S['41h-como-ahorro-mas'] = chat(`
 ${me('¿Qué puedo hacer para ahorrar más?')}
 ${app('Con tus números, esto es lo que más pesa. Si bajaras estas tres cosas a lo que gastabas antes, <b>ahorrarías unos $ 310.000 al mes</b>.')}
 ${card(`${lab('1 · Lo que más subió', 0)}
  ${line('Restaurantes', '+$ 140.000 al mes', 'r')}
  ${note('Este mes llevas $ 412.000; tu promedio de los 3 meses anteriores es $ 272.000.')}
  ${lab('2 · Gastos pequeños que se repiten')}
  ${line('Café y panadería · 22 veces', '$ 118.000 al mes', 'y')}
  ${note('Uno a uno son de $ 5.400 en promedio. Juntos, casi lo de un servicio.')}
  ${lab('3 · Tus pagos fijos')}
  ${line('Suscripciones · 4', '$ 92.000 al mes', 'y')}
  ${note('Netflix, Spotify, nube y gimnasio. Revisa si los usas todos: uno solo que quites son $ 52.000 al mes.')}
  ${lab('Si lo guardas')}
  ${line('$ 310.000 al mes, en un año', '$ 3.720.000', 'g')}
  ${note('Son tus cifras, no un consejo de un experto. Tú decides qué vale la pena cambiar.')}
  ${btn('Crear un tope para Restaurantes')}`)}
 ${follow('¿Qué pago cada mes?', '¿En qué gasté más?', 'Crear una meta de ahorro')}`);

export default S;
