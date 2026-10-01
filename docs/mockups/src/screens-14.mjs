// Group 14 - part 3 of debts and plans, step 1: spending limits (2026-10-01,
// for Jose's word). Planes lives in Más -> Tus finanzas (decided), and Inicio
// says only when a limit is close or passed. Goals are step 2. Every name and
// figure is invented.
import { ic, ci, sq, C, tabs, status, tint, catIcon, chev, down, sw, periodBar, bigTitle } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const row = (icon, t, s, right = chev()) => `<div class="row">${icon}<div class="tx"><b style="white-space:normal;line-height:1.3">${t}</b>${s ? `<small style="white-space:normal">${s}</small>` : ''}</div>${right}</div>`;
const seg = (opts, on, mt = 10) => `<div class="seg" style="margin-top:${mt}px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;
const bar = (p, c, h = 8) => `<div class="pbar" style="height:${h}px;margin-top:8px"><i style="width:${Math.min(p, 100)}%;background:${c}"></i></div>`;
const page = (head, body, after = '') => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;
const amber = t => `<div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>${t}</span></div>`;

const planHead = (on = 'Límites') => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}<h1 style="flex:1">Planes</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nuevo límite</div></div>
 ${seg([['Límites', 'speedometer-outline'], ['Metas', 'flag-outline']], on)}${periodBar('Octubre 2026', 8)}</div>`;

// 1. Más: Planes joins Tus finanzas, saying how the month goes.
S['14a-mas-planes'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="card hero" style="display:flex;gap:12px;align-items:center;padding:14px">${ci('person', C.blu, 46)}<div class="tx" style="flex:1"><b>Jose</b><div class="sub">Copia en Drive · hoy 8:12</div></div>${chev()}</div>
 <div class="h">Tus finanzas</div><div class="list">
  ${row(sq('wallet-outline', C.blu, 40), 'Cuentas', 'Saldos y patrimonio')}
  ${row(sq('card-outline', C.yel, 40), 'Deudas y tarjetas', 'Debes 742.300')}
  ${row(sq('trending-up-outline', C.grn, 40), 'Productos y rendimientos', 'Rendimiento disponible 4,95 M')}
  ${row(sq('speedometer-outline', C.pur, 40), 'Planes', '<span class="r">1 límite pasado</span> · 2 van bien')}</div>
 <div class="h">Tus datos</div><div class="list">
  ${row(sq('checkmark-done-outline', C.blu, 40), 'Movimientos por revisar', '18 movimientos esperan tu respuesta')}
  ${row(sq('pricetags-outline', C.pur, 40), 'Categorías', '22 categorías')}</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 2. The first time: nothing yet, and the categories where the money goes
//    most, one tap from a limit.
S['14b-planes-vacio'] = page(planHead(), `
 <div class="card" style="text-align:center;padding:20px">${ci('speedometer-outline', C.pur, 52).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="display:block;font-size:17px">Ponle un tope a lo que gastas</b>
  <div class="sub" style="margin:6px 0 14px">Escoge una categoría y cuánto quieres gastar en ella al mes. La app te dice cómo vas.</div>
  <div class="btn" style="max-width:240px;margin:0 auto">Crear un límite</div></div>
 <div class="h">Donde más gastas · promedio de 3 meses</div>
 <div class="list">
  ${row(catIcon('mercado', 40), 'Mercado', '1.112.000 al mes', `<span class="chip" style="padding:6px 10px;color:var(--pr)">${ic('add', '', 'width:16px;height:16px')}Límite</span>`)}
  ${row(catIcon('rest', 40), 'Restaurantes', '372.000 al mes', `<span class="chip" style="padding:6px 10px;color:var(--pr)">${ic('add', '', 'width:16px;height:16px')}Límite</span>`)}
  ${row(catIcon('transp', 40), 'Transporte', '241.000 al mes', `<span class="chip" style="padding:6px 10px;color:var(--pr)">${ic('add', '', 'width:16px;height:16px')}Límite</span>`)}</div>`);

// 3. With limits: how the month goes, each limit in its colour.
const limit = (k, name, spent, of, p, line, c) => `<div class="card" style="margin-top:10px;padding:14px"><div style="display:flex;gap:10px;align-items:center">${catIcon(k, 40)}<div style="flex:1;min-width:0"><b class="one">${name}</b><div class="sub">${spent} de ${of}</div></div><b class="${c}" style="font-size:17px">${p} %</b>${chev()}</div>
 ${bar(p, c === 'r' ? C.red : c === 'y' ? C.yel : C.grn)}<div class="sub" style="margin-top:6px;white-space:normal">${line}</div></div>`;
S['14c-planes-limites'] = page(planHead(), `
 <div class="card hero"><div class="lab">En tus límites llevas</div><div class="big">1.620.000 <span class="mu" style="font-size:15px;font-weight:500">de 1.900.000</span></div>
  ${bar(85, C.yel, 9)}<div class="sub" style="margin-top:8px">Quedan 12 días: puedes gastar <b style="color:var(--tx)">23.300 al día</b> en estas categorías.</div></div>
 ${limit('mercado', 'Mercado', '1.212.000', '1.200.000', 101, 'Te pasaste por 12.000', 'r')}
 ${limit('rest', 'Restaurantes', '312.000', '400.000', 78, 'Quedan 88.000 · vas un poco más rápido que el mes', 'y')}
 ${limit('transp', 'Transporte', '96.000', '300.000', 32, 'Quedan 204.000 · vas bien', 'g')}`);

// 4. A new limit: the figure, the category (or several), every month, all
//    accounts or one, a notice at 80 %. The average of 3 months is offered.
S['14d-nuevo-limite'] = S['14c-planes-limites'] + `<div class="scrim"></div><div class="sheet" style="top:120px"><div class="grab"></div>
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Nuevo límite</h2><span style="width:62px"></span></div>
 <div style="text-align:center;font-size:36px;font-weight:700;margin:2px 0 4px">400.000</div>
 <div style="text-align:center;margin-bottom:10px"><span class="chip" style="padding:6px 12px">${ic('bulb-outline', 'p', 'width:16px;height:16px')}Usar tu promedio: 372.000</span></div>
 <div class="list">
  ${row(catIcon('rest', 38), '<span class="k" style="display:block;font-weight:400;font-size:12.5px;color:var(--mu)">Categoría</span>Restaurantes', '', ic('pencil', 'p'))}
  ${row(ci('calendar-outline', C.blu, 38), '<span class="k" style="display:block;font-weight:400;font-size:12.5px;color:var(--mu)">Cada</span>Mes · se renueva solo', '', down())}
  ${row(ci('layers-outline', C.blu, 38), '<span class="k" style="display:block;font-weight:400;font-size:12.5px;color:var(--mu)">Cuentas</span>Todas las cuentas', '', down())}
  ${row(ci('notifications-outline', C.yel, 38), 'Avisarme al 80 %', 'Un aviso del celular, sin internet', sw(true))}</div>
 <div class="btn" style="margin-top:12px">Guardar límite</div></div>`;

// 5. One limit: the pace, the months before against the limit, and the
//    movements that count.
const monthBar = (m, h, over) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="height:110px;width:100%;display:flex;align-items:flex-end;justify-content:center"><i style="display:block;width:70%;height:${h}%;border-radius:6px 6px 2px 2px;background:${over ? C.red : tint(C.blu, .55)}"></i></div><span class="sub" style="font-size:11.5px">${m}</span></div>`;
const mv = (icon, t, s, a) => `<div class="row">${icon}<div class="tx"><b class="one">${t}</b><small>${s}</small></div><div class="am r">${a}</div></div>`;
S['14e-limite-detalle'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${catIcon('rest', 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Restaurantes</b><div class="sub one">400.000 cada mes · todas las cuentas</div></div>${ic('pencil', 'p')}</div>${periodBar('Octubre 2026', 8)}</div><main>
 <div class="card hero"><div class="lab">Llevas</div><div class="big">312.000 <span class="mu" style="font-size:15px;font-weight:500">de 400.000</span></div>
  ${bar(78, C.yel, 9)}<div class="sub" style="margin-top:8px">Quedan 88.000 para 12 días: <b style="color:var(--tx)">7.300 al día</b>. El mes pasado a esta fecha llevabas 260.000.</div></div>
 <div class="h">Los últimos meses ${infoDot}</div>
 <div class="card" style="padding:14px"><div style="position:relative;display:flex;gap:6px">
  <div style="position:absolute;left:0;right:0;top:${110 - 110 * 400 / 520}px;border-top:2px dashed ${C.yel}"></div>
  ${monthBar('may', 62, false)}${monthBar('jun', 81, false)}${monthBar('jul', 100, true)}${monthBar('ago', 70, false)}${monthBar('sep', 74, false)}${monthBar('oct', 60, false)}</div>
  <div class="sub" style="margin-top:8px">La línea es tu límite. En julio te pasaste por 120.000.</div></div>
 <div class="h">Lo que cuenta este mes · 9 movimientos</div>
 <div class="list">
  ${mv(catIcon('rest', 38), 'Almuerzo oficina', 'Hoy · Tarjeta Coral', '-32.000')}
  ${mv(catIcon('rest', 38), 'Pizza viernes', '17 oct · Banco Azul', '-58.000')}
  ${mv(catIcon('rest', 38), 'Café', '15 oct · Efectivo', '-9.500')}</div>
 <div class="btn ghost" style="margin-top:14px;color:var(--red)">Borrar este límite</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 6. Inicio: only when a limit is close or passed, one row that opens it.
S['14f-inicio-aviso'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">Todas las cuentas</b>${down()}</div><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar('Octubre 2026')}</div><main>
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55</div></div>
 <div class="list" style="margin-top:10px">
  ${row(catIcon('mercado', 40), 'Mercado pasó su límite', '<span class="r">101 % de 1.200.000</span>')}
  ${row(catIcon('rest', 40), 'Restaurantes va en 78 %', 'Quedan 88.000 para 12 días')}</div>
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 <div class="card" style="height:150px;display:grid;place-items:center"><span class="mu">(el gráfico de siempre)</span></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// ------------------------------------------------------------ a limit passed
// Jose (2026-10-01): a red bar is not enough when a limit is passed; it
// should stand out the way an overdue card does. The options, drawn.
const redHero = inner => `<div class="card hero" style="background:linear-gradient(145deg,${tint(C.red, .35)} 0%,${tint(C.red, .12)} 55%,#111b2f 100%);border-color:${tint(C.red, .5)}">${inner}</div>`;
const pill = (icon, t) => `<span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic(icon)}${t}</span>`;
// The bar goes past its end: the limit is a mark, and what is over it shows past the mark.
const overBar = (p) => `<div style="position:relative;margin-top:10px"><div class="pbar" style="height:10px"><i style="width:${100 * 100 / p}%;background:${C.yel}"></i><i style="width:${100 - 100 * 100 / p}%;background:repeating-linear-gradient(45deg,${C.red} 0 6px,${tint(C.red, .55)} 6px 12px)"></i></div>
 <span style="position:absolute;left:${100 * 100 / p}%;top:-5px;width:2px;height:20px;background:#fff;border-radius:2px"></span></div>`;
const passedCard = `<div class="card" style="margin-top:10px;padding:14px;border-color:${tint(C.red, .55)};background:${tint(C.red, .08)}"><div style="display:flex;gap:10px;align-items:center">${catIcon('mercado', 40)}<div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center"><b class="one">Mercado</b><span class="tag" style="background:${tint(C.red, .2)};color:${C.red}">Pasado</span></div><div class="sub">1.362.000 de 1.200.000</div></div><b class="r" style="font-size:17px">113 %</b>${chev()}</div>
 ${overBar(113)}<div class="sub" style="margin-top:8px;white-space:normal"><b class="r">162.000 de más</b> · desde el 18 oct</div></div>`;

// A. Planes: the passed limit is a red card on top, like an overdue card,
//    with what to do; its own card says "Pasado" and its bar runs past the mark.
S['14g-limite-pasado-planes'] = page(planHead(), `
 ${redHero(`<div style="display:flex;gap:8px;align-items:center">${ic('alert-circle', 'r', 'width:22px;height:22px')}<div class="lab" style="color:#ffb4b4">Te pasaste en Mercado</div></div>
  <div class="big r">$ 162.000 <span style="font-size:15px;font-weight:500;color:#ffb4b4">de más</span></div>
  <div class="sub">Tu límite era 1.200.000 y quedan 12 días del mes. Todo lo que gastes en Mercado desde ahora suma a lo que te pasaste.</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${pill('list-outline', 'Ver en qué se fue')}${pill('create-outline', 'Cambiar el límite')}</div>`)}
 ${passedCard}
 ${limit('rest', 'Restaurantes', '312.000', '400.000', 78, 'Quedan 88.000 · vas un poco más rápido que el mes', 'y')}
 ${limit('transp', 'Transporte', '96.000', '300.000', 32, 'Quedan 204.000 · vas bien', 'g')}`);

// B. The moment it happens: the movement that crosses the limit is saved,
//    and the app says so right then, once. Nothing is blocked.
S['14h-limite-al-guardar'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Todas las cuentas</b><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar('Octubre 2026')}</div><main>
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.150.740,55</div></div>
 <div class="card" style="height:220px;margin-top:12px;display:grid;place-items:center"><span class="mu">(Inicio de siempre)</span></div></main><div class="fade"></div>${tabs('Inicio')}
 <div class="scrim"></div><div class="sheet" style="top:auto;bottom:0;padding-bottom:28px"><div class="grab"></div>
 <div style="text-align:center">${ci('alert-circle-outline', C.red, 60).replace('display:grid', 'display:grid;margin:4px auto 10px')}
  <b style="display:block;font-size:19px">Con este gasto pasaste tu límite de Mercado</b>
  <div class="sub" style="margin:8px 0 4px">Llevas <b style="color:var(--tx)">1.362.000</b> de 1.200.000 este mes.</div>
  <div class="r" style="font-weight:600;margin-bottom:6px">162.000 de más · quedan 12 días</div></div>
 ${overBar(113)}
 <div class="note" style="margin:12px 2px">El gasto ya quedó guardado. Esto solo te avisa.</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px"><div class="btn ghost">Entendido</div><div class="btn">Ver el límite</div></div></div>`;

// C. Inicio: a passed limit is a red card at the top, not a quiet row.
S['14i-limite-pasado-inicio'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">Todas las cuentas</b>${down()}</div><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar('Octubre 2026')}</div><main>
 ${redHero(`<div style="display:flex;gap:12px;align-items:center">${catIcon('mercado', 44)}<div style="flex:1;min-width:0"><b style="display:block">Pasaste tu límite de Mercado</b><div class="sub"><b class="r">162.000 de más</b> · quedan 12 días</div></div>${chev()}</div>${overBar(113)}`)}
 <div class="card hero" style="margin-top:10px"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.150.740,55</div></div>
 <div class="list" style="margin-top:10px">${row(catIcon('rest', 40), 'Restaurantes va en 78 %', 'Quedan 88.000 para 12 días')}</div>
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// D. The phone's own notification, the moment it is passed - even with the
//    app closed. Local, no internet. (The 80 % one is the same, in amber.)
S['14j-limite-notificacion'] = `<div style="height:100%;background:linear-gradient(180deg,#1b2440,#0b1020);padding:14px 12px">
 <div style="display:flex;justify-content:space-between;color:#cfd6ea;font-size:13px;padding:2px 6px 18px"><span>9:41</span><span>5G ▮▮▮ 87%</span></div>
 <div style="text-align:center;color:#e8ecf7;font-size:56px;font-weight:300;margin:30px 0 4px">9:41</div>
 <div style="text-align:center;color:#aeb7cf;font-size:15px;margin-bottom:40px">martes, 18 de octubre</div>
 <div style="background:rgba(30,38,62,.92);border-radius:22px;padding:14px;display:flex;gap:12px;align-items:flex-start">
  ${sq('wallet', C.blu, 38)}<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;color:#8e9ab2;font-size:12.5px"><span>Finance</span><span>ahora</span></div>
  <b style="display:block;color:#fff;margin-top:2px">Pasaste tu límite de Mercado</b>
  <div style="color:#c9d0e2;font-size:14px;margin-top:2px">Llevas 1.362.000 de 1.200.000 · 162.000 de más</div></div></div>
 <div style="background:rgba(30,38,62,.75);border-radius:22px;padding:14px;display:flex;gap:12px;align-items:flex-start;margin-top:10px">
  ${sq('wallet', C.blu, 38)}<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;color:#8e9ab2;font-size:12.5px"><span>Finance</span><span>hace 3 días</span></div>
  <b style="display:block;color:#fff;margin-top:2px">Restaurantes va en 80 %</b>
  <div style="color:#c9d0e2;font-size:14px;margin-top:2px">Quedan 80.000 para 15 días</div></div></div></div>`;

// E. The limit's own page when passed: the same red card on top.
S['14k-limite-pasado-detalle'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${catIcon('mercado', 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Mercado</b><div class="sub one">1.200.000 cada mes · todas las cuentas</div></div>${ic('pencil', 'p')}</div>${periodBar('Octubre 2026', 8)}</div><main>
 ${redHero(`<div class="lab" style="color:#ffb4b4">Te pasaste por</div><div class="big r">$ 162.000</div>
  ${overBar(113)}<div class="sub" style="margin-top:8px">Llevas 1.362.000 de 1.200.000. Lo pasaste el 18 de octubre con "Mercado quincena" (240.000).</div>`)}
 <div class="h">Para el próximo mes</div>
 <div class="list">${row(ci('trending-up-outline', C.blu, 40), 'Tu promedio de 3 meses es 1.290.000', 'Un límite de 1.300.000 sería más realista', `<span class="chip" style="padding:6px 10px;color:var(--pr)">Usar</span>`)}</div>
 <div class="h">Lo que cuenta este mes · 14 movimientos</div>
 <div class="list">
  ${mv(catIcon('mercado', 38), 'Mercado quincena', '18 oct · Tarjeta Coral', '-240.000')}
  ${mv(catIcon('mercado', 38), 'Fruver', '16 oct · Efectivo', '-38.000')}</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// ------------------------------------------------------------ the total passed
// Jose (2026-10-01): passing the total of every limit should stand out even
// more than one limit. A solid red card, not a tinted one; Inicio's first
// thing; a full-height sheet at the moment it happens; the red dot on Más.
const solidRed = inner => `<div class="card" style="background:linear-gradient(145deg,#e0525c 0%,#b3343f 60%,#7a1f2b 100%);border:0;color:#fff;box-shadow:0 10px 30px ${tint(C.red, .35)}">${inner}</div>`;
const whiteBar = p => `<div style="position:relative;margin-top:12px"><div class="pbar" style="height:10px;background:rgba(255,255,255,.25)"><i style="width:${100 * 100 / p}%;background:#fff"></i><i style="width:${100 - 100 * 100 / p}%;background:repeating-linear-gradient(45deg,#ffd0d0 0 6px,rgba(255,255,255,.35) 6px 12px)"></i></div>
 <span style="position:absolute;left:${100 * 100 / p}%;top:-5px;width:3px;height:20px;background:#3a0b12;border-radius:2px"></span></div>`;
const whitePill = (icon, t) => `<span class="chip" style="background:rgba(255,255,255,.18);color:#fff;border-color:rgba(255,255,255,.35)">${ic(icon)}${t}</span>`;
const overRow = (k, name, by) => `<div class="row">${catIcon(k, 38)}<div class="tx"><b class="one">${name}</b><small class="r">${by} de más</small></div>${chev()}</div>`;

// A. Planes: the top card itself turns solid red, says by how much and which limits.
S['14l-total-pasado-planes'] = page(planHead(), `
 ${solidRed(`<div style="display:flex;gap:8px;align-items:center">${ic('warning', '', 'width:24px;height:24px;color:#fff')}<div class="lab" style="color:#ffe1e1">Pasaste el total de tus límites</div></div>
  <div class="big" style="color:#fff">$ 2.084.000 <span style="font-size:15px;font-weight:500;color:#ffe1e1">de 1.900.000</span></div>
  ${whiteBar(110)}
  <div style="margin-top:10px;font-size:14px;line-height:1.4;color:#fff">Vas <b>184.000 por encima</b> y quedan 12 días del mes. Lo que gastes en estas categorías desde hoy suma a lo que te pasaste.</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${whitePill('list-outline', 'Ver en qué se fue')}${whitePill('create-outline', 'Ajustar límites')}</div>`)}
 <div class="h">Se pasaron · 2 límites</div>
 <div class="list">${overRow('mercado', 'Mercado', '162.000')}${overRow('rest', 'Restaurantes', '58.000')}</div>
 <div class="h">Van bien</div>
 ${limit('transp', 'Transporte', '264.000', '300.000', 88, 'Quedan 36.000', 'y')}`, ).replace(tabs('Más'), tabs('Más', true));

// B. Inicio: the first thing on screen, before net worth, solid red.
S['14m-total-pasado-inicio'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">Todas las cuentas</b>${down()}</div><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar('Octubre 2026')}</div><main>
 ${solidRed(`<div style="display:flex;gap:12px;align-items:center">${ci('warning', '#ffffff', 44).replace(/background:[^;]+;/, 'background:rgba(255,255,255,.2);')}<div style="flex:1;min-width:0"><b style="display:block;font-size:16.5px">Pasaste el total de tus límites</b><div style="font-size:14px;color:#ffe1e1">184.000 de más · 2 límites pasados · quedan 12 días</div></div>${ic('chevron-forward-outline', '', 'color:#fff')}</div>${whiteBar(110)}`)}
 <div class="card hero" style="margin-top:10px"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.150.740,55</div></div>
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio', true)}`;

// C. The moment it happens: not a small sheet, the whole screen, once.
S['14n-total-al-guardar'] = `<div style="position:absolute;inset:0;background:linear-gradient(170deg,#e0525c 0%,#a72f3b 55%,#5c1520 100%);color:#fff;padding:60px 22px 30px;display:flex;flex-direction:column">
 <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
  <span style="width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.18);display:grid;place-items:center;box-shadow:0 0 0 14px rgba(255,255,255,.08)">${ic('warning', '', 'width:50px;height:50px;color:#fff')}</span>
  <b style="font-size:24px;margin-top:26px;line-height:1.25">Con este gasto pasaste el total de tus límites</b>
  <div style="font-size:15.5px;margin-top:10px;color:#ffe1e1">Llevas 2.084.000 de 1.900.000 este mes</div>
  <div style="font-size:30px;font-weight:700;margin-top:18px">184.000 de más</div>
  <div style="font-size:14px;color:#ffe1e1;margin-top:4px">y quedan 12 días</div>
  <div style="width:100%">${whiteBar(110)}</div>
  <div style="font-size:13.5px;color:#ffe1e1;margin-top:18px">El gasto ya quedó guardado. Esto solo te avisa.</div></div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="btn" style="background:rgba(255,255,255,.18);color:#fff">Entendido</div><div class="btn" style="background:#fff;color:#a72f3b">Ver mis límites</div></div></div>`;

// D. The phone's notification, the strongest of the three.
S['14o-total-notificacion'] = S['14j-limite-notificacion'].replace(
  '<div style="background:rgba(30,38,62,.92);border-radius:22px;padding:14px;display:flex;gap:12px;align-items:flex-start">',
  `<div style="background:rgba(30,38,62,.92);border-radius:22px;padding:14px;display:flex;gap:12px;align-items:flex-start;border:1px solid ${tint(C.red, .6)};margin-bottom:10px">
  ${sq('warning', C.red, 38)}<div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;color:#8e9ab2;font-size:12.5px"><span>Finance</span><span>ahora</span></div>
  <b style="display:block;color:#ff8a8a;margin-top:2px">Pasaste el total de tus límites</b>
  <div style="color:#c9d0e2;font-size:14px;margin-top:2px">184.000 de más este mes · quedan 12 días</div></div></div>
 <div style="background:rgba(30,38,62,.92);border-radius:22px;padding:14px;display:flex;gap:12px;align-items:flex-start">`);

export default S;
