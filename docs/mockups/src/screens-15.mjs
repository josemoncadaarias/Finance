// Group 15 - part 3 of debts and plans, step 2: goals (2026-10-01, for
// Jose's word). Presupuestos (was Planes) holds Topes and Metas. A goal is a
// figure, an optional date and the place the money actually sits - an
// account or one of its products - and its progress IS that place's balance:
// nothing to register twice. Every name and figure is invented.
import { ic, ci, sq, C, tabs, status, tint, chev, down, sw, tick, periodBar, bigTitle, catIcon } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const row = (icon, t, s, right = chev()) => `<div class="row">${icon}<div class="tx"><b style="white-space:normal;line-height:1.3">${t}</b>${s ? `<small style="white-space:normal">${s}</small>` : ''}</div>${right}</div>`;
const seg = (opts, on, mt = 10) => `<div class="seg" style="margin-top:${mt}px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;
const bar = (p, c, h = 8) => `<div class="pbar" style="height:${h}px;margin-top:8px"><i style="width:${Math.min(p, 100)}%;background:${c}"></i></div>`;
const page = (head, body, after = '') => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;
const lab = t => `<span class="k" style="display:block;font-weight:400;font-size:12.5px;color:var(--mu)">${t}</span>`;

// The place a goal lives in: the account, and under it the product, hanging from it.
const place = (acc, accColor, accIc, prod, prodIc, size = 15) => `<span style="display:inline-flex;align-items:center;gap:5px;font-size:${size - 2}px;color:var(--mu)">${ci(accIc, accColor, 20)}${acc}${prod ? ` · ${sq(prodIc, accColor, 20)}${prod}` : ''}</span>`;

const goalsHead = (right = true) => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}<h1 style="flex:1">Presupuestos</h1>
 ${right ? `<div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva meta</div>` : ''}</div>
 ${seg([['Topes', 'speedometer-outline'], ['Metas', 'flag-outline']], 'Metas')}</div>`;

// The four goals of the invented person, figures worked out:
//   Viaje: 6.000.000 by June 2027, 2.350.000 saved -> 3.650.000 in 8 months = 456.250 a month; pace 500.000 -> May 2027.
//   Fondo: 6 months of 3.300.000 = 19.800.000, no date, 8.400.000 saved; pace 600.000 -> 19 months, May 2028.
//   Portátil: 4.500.000 by December 2026, 2.900.000 saved -> 800.000 a month; pace 350.000 -> March 2027, 3 months late.
//   Matrícula: 3.200.000, reached on 12 September.
const goalCard = (icon, color, name, where, saved, of, p, line, state) => {
  const c = state === 'late' ? C.yel : state === 'done' ? C.grn : C.blu;
  const badge = state === 'late' ? `<span class="tag" style="background:${tint(C.yel, .2)};color:${C.yel}">Atrasada</span>`
    : state === 'done' ? `<span class="tag" style="background:${tint(C.grn, .2)};color:${C.grn}">Lograda</span>`
      : `<span class="tag" style="background:${tint(C.grn, .16)};color:${C.grn}">A tiempo</span>`;
  return `<div class="card" style="margin-top:10px;padding:14px"><div style="display:flex;gap:10px;align-items:center">${sq(icon, color, 42)}<div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center"><b class="one">${name}</b>${badge}</div><div style="margin-top:3px">${where}</div></div>${chev()}</div>
   <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:14px"><span><b>${saved}</b> <span class="mu">de ${of}</span></span><b style="color:${c}">${p} %</b></div>
   ${bar(p, c)}<div class="sub" style="margin-top:7px;white-space:normal">${line}</div></div>`;
};
const viaje = goalCard('airplane-outline', C.cya, 'Viaje a Cartagena', `<span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--mu)">${sq('cube-outline', C.blu, 20)}Cajita Viaje · ${ci('globe-outline', C.tea, 20)}Global Viajes</span>`,
  '2.350.000', '6.000.000', 39, 'Faltan 3.650.000 para junio de 2027: <b style="color:var(--tx)">456.250 al mes</b>. A tu ritmo llegas en mayo.', 'ok');
const fondo = goalCard('shield-checkmark-outline', C.grn, 'Fondo de emergencia', `<span style="display:inline-flex;align-items:center;gap:5px;font-size:13px;color:var(--mu)">${ci('leaf-outline', C.grn, 20)}Ahorro Verde · ${ci('logo-usd', C.cya, 20)}Cuenta Dólar</span>`,
  '8.400.000', '19.800.000', 42, '6 meses de tus gastos · sin fecha. A tu ritmo (600.000 al mes) llegas en mayo de 2028.', 'ok');
const portatil = goalCard('laptop-outline', C.pur, 'Portátil nuevo', place('Cajita Naranja', C.org, 'cube-outline', 'Bolsillo Portátil', 'cube-outline'),
  '2.900.000', '4.500.000', 64, 'Para diciembre necesitas <b style="color:var(--tx)">800.000 al mes</b>; vas a 350.000. A ese ritmo llegas en marzo de 2027.', 'late');
const matricula = goalCard('school-outline', C.blu, 'Matrícula', place('Banco Azul', C.blu, 'wallet-outline', 'Cajita Matrícula', 'cube-outline'),
  '3.200.000', '3.200.000', 100, 'La lograste el 12 de septiembre.', 'done');

// 1. Más: the row is Presupuestos now, saying how topes and metas go.
S['15a-mas-presupuestos'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="card hero" style="display:flex;gap:12px;align-items:center;padding:14px">${ci('person', C.blu, 46)}<div class="tx" style="flex:1"><b>Jose</b><div class="sub">Copia en Drive · hoy 8:12</div></div>${chev()}</div>
 <div class="h">Tus finanzas</div><div class="list">
  ${row(sq('wallet-outline', C.blu, 40), 'Cuentas', 'Saldos y patrimonio')}
  ${row(sq('card-outline', C.yel, 40), 'Deudas y tarjetas', 'Debes 742.300')}
  ${row(sq('trending-up-outline', C.grn, 40), 'Productos y rendimientos', 'Rendimiento disponible 4,95 M')}
  ${row(sq('speedometer-outline', C.pur, 40), 'Presupuestos', '<span class="r">1 tope pasado</span> · 3 metas, 1 atrasada')}</div>
 <div class="h">Tus datos</div><div class="list">
  ${row(sq('checkmark-done-outline', C.blu, 40), 'Movimientos por revisar', '18 movimientos esperan tu respuesta')}
  ${row(sq('pricetags-outline', C.pur, 40), 'Categorías', '22 categorías')}</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más', true)}`;

// 2. The first time: what a goal is, in one sentence, and two ways to start.
S['15b-metas-vacio'] = page(goalsHead(false), `
 <div class="card" style="text-align:center;padding:20px">${ci('flag-outline', C.grn, 52).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="display:block;font-size:17px">Ponle un nombre a lo que ahorras</b>
  <div class="sub" style="margin:6px 0 14px;white-space:normal">Escoge cuánto quieres juntar y en qué cuenta o bolsillo lo guardas. La app mira ese saldo y te dice si llegas a tiempo.</div>
  <div class="btn" style="max-width:240px;margin:0 auto">Crear una meta</div></div>
 <div class="h">Para empezar</div>
 <div class="list">
  ${row(sq('shield-checkmark-outline', C.grn, 40), 'Fondo de emergencia', '6 meses de tus gastos serían 19.800.000', `<span class="chip" style="padding:6px 10px;color:var(--pr)">${ic('add', '', 'width:16px;height:16px')}Meta</span>`)}
  ${row(sq('flag-outline', C.blu, 40), 'Otra meta', 'Un viaje, un portátil, una cuota inicial…', `<span class="chip" style="padding:6px 10px;color:var(--pr)">${ic('add', '', 'width:16px;height:16px')}Meta</span>`)}</div>`);

// 3. The goals: the total on top, then each one with its state.
S['15c-metas'] = page(goalsHead(), `
 <div class="card hero"><div class="lab">En tus metas llevas</div><div class="big">13.650.000 <span class="mu" style="font-size:15px;font-weight:500">de 30.300.000</span></div>
  ${bar(45, '#fff', 9)}<div class="sub" style="margin-top:8px">3 metas en curso · 1 atrasada</div></div>
 <div class="h">En curso · 3 metas</div>
 ${portatil}${viaje}${fondo}
 <div class="h">Logradas · 1 meta</div>
 ${matricula}`);

// 4. A new goal: the figure, the name and face, the date (optional), and
//    where the money is. What it would take a month is said as you type.
const formSheet = (inner, top = 70) => `<div class="scrim"></div><div class="sheet" style="top:${top}px"><div class="grab"></div>${inner}</div>`;
S['15d-nueva-meta'] = S['15c-metas'] + formSheet(`
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Nueva meta</h2><span style="width:62px"></span></div>
 <div style="display:flex;gap:12px;align-items:center;margin:4px 0 10px">${sq('airplane-outline', C.cya, 52)}<div style="flex:1">${lab('Nombre')}<b style="font-size:18px">Viaje a Cartagena</b></div>${ic('pencil', 'p')}</div>
 <div style="text-align:center;font-size:36px;font-weight:700;margin:2px 0 2px">6.000.000</div>
 <div class="list" style="margin-top:10px">
  ${row(ci('calendar-outline', C.blu, 38), `${lab('Para cuándo')}Junio de 2027`, 'Opcional: sin fecha, te dice cuándo llegas a tu ritmo', down())}
</div>
 <div class="h" style="margin-top:14px">Dónde está la plata · 2 lugares</div>
 <div class="list">
  ${row(sq('cube-outline', C.blu, 38), `${lab('Banco Azul')}Cajita Viaje`, 'Cuenta todo lo que tiene · 1.750.000', down())}
  ${row(ci('globe-outline', C.tea, 38), `${lab('Cuenta en dólares')}Global Viajes`, 'Cuenta todo lo que tiene · USD 150 = 600.000 hoy', down())}
  ${row(ci('add', C.blu, 38), '<span class="p">Agregar otra cuenta o bolsillo</span>', '', '')}</div>
 <div class="sub" style="text-align:right;margin:8px 4px 0">Juntas tienen hoy <b style="color:var(--tx)">2.350.000</b></div>
 <div class="banner" style="background:${tint(C.blu, .12)};color:#c9d3ff;margin-top:12px">${ic('bulb-outline')}<span>Te faltan 3.650.000: <b>456.250 al mes</b> durante 8 meses.</span></div>
 <div class="btn" style="margin-top:12px">Guardar meta</div>`);

// 5. Where the money is: the one account list, products hanging from their
//    account, each with today's balance. A place already holding a goal says so.
const accRow = (k, color, icon, name, bal, extra = '') => `<div class="row">${ci(icon, color, 38)}<div class="tx"><b class="one">${name}</b><small>${bal}</small></div>${extra}</div>`;
const prodRow = (color, icon, name, bal, extra = '', on = false) => `<div class="row" style="padding-left:34px;${on ? `background:${tint(C.blu, .1)}` : ''}"><span style="width:14px;height:22px;border-left:2px solid #2a3756;border-bottom:2px solid #2a3756;border-bottom-left-radius:8px;margin-top:-14px;flex:none"></span>${sq(icon, color, 32)}<div class="tx"><b class="one" style="font-size:14.5px">${name}</b><small>${bal}</small></div>${extra}${on ? tick(true) : ''}</div>`;
S['15e-donde-esta'] = S['15c-metas'] + formSheet(`
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Dónde está la plata</h2><span style="width:62px"></span></div>
 <div class="seg" style="margin:6px 0 10px"><div class="on">Más usadas</div><div>A-Z</div></div>
 <div class="chip" style="width:100%;margin-bottom:10px;color:var(--mu)">${ic('search-outline')}Buscar cuenta o bolsillo…</div>
 <div class="list">
  ${accRow('azul', C.blu, 'wallet-outline', 'Banco Azul', '4.812.300 en total')}
  ${prodRow(C.blu, 'cube-outline', 'Cajita Viaje', '1.750.000', '', true)}
  ${prodRow(C.blu, 'cube-outline', 'Cajita Matrícula', '3.200.000', `<span class="tag" style="background:${tint(C.grn, .18)};color:${C.grn}">Meta: Matrícula</span>`)}
  ${accRow('verde', C.grn, 'leaf-outline', 'Ahorro Verde', '8.400.000', `<span class="tag" style="background:${tint(C.grn, .18)};color:${C.grn}">Meta: Fondo</span>`)}
  ${accRow('naranja', C.org, 'cube-outline', 'Cajita Naranja', '3.640.000 en total')}
  ${prodRow(C.org, 'cube-outline', 'Bolsillo Portátil', '2.900.000', `<span class="tag" style="background:${tint(C.yel, .18)};color:${C.yel}">Meta: Portátil</span>`)}
  <div class="row" style="background:${tint(C.blu, .1)}">${ci('globe-outline', C.tea, 38)}<div class="tx"><b class="one">Global Viajes</b><small>USD 150 · 600.000 hoy</small></div>${tick(true)}</div>
  ${accRow('efectivo', C.lim, 'cash-outline', 'Efectivo', '182.000', tick(false))}</div>
 <div class="note" style="margin:10px 2px 0">Escoge todas las que quieras: la meta suma lo que tengan. Cada una es de una sola meta, para que ningún peso cuente dos veces. Las tarjetas y los préstamos no aparecen.</div>
 <div class="btn" style="margin-top:12px">Listo · 2 elegidas · 2.350.000</div>`, 90);

// 6. "Qué cuenta": the whole balance, or only what comes in from today -
//    for a place that already holds money meant for something else.
S['15f-que-cuenta'] = S['15d-nueva-meta'] + `<div class="scrim" style="z-index:30"></div><div class="sheet" style="top:auto;bottom:0;padding-bottom:28px;z-index:31"><div class="grab"></div>
 <span class="p" style="font-size:15px">Cancelar</span>
 <b style="display:block;font-size:18px;text-align:center;margin:4px 0 12px">¿Qué cuenta de la Cajita Viaje?</b>
 <div class="list">
  <div class="row" style="background:${tint(C.blu, .1)}">${ci('albums-outline', C.blu, 38)}<div class="tx"><b>Todo lo que tiene</b><small style="white-space:normal">Los 1.750.000 de hoy ya cuentan. Para un bolsillo que es solo de esta meta.</small></div>${tick(true)}</div>
  <div class="row">${ci('arrow-down-circle-outline', C.grn, 38)}<div class="tx"><b>Solo lo que entre desde hoy</b><small style="white-space:normal">Empieza en 0. Para una cuenta que ya tiene plata para otras cosas.</small></div>${tick(false)}</div></div>
 <div class="note" style="margin:12px 2px 0">Si sacas plata de ahí, la meta baja: es lo que de verdad tienes guardado.</div></div>`;

// 7. An emergency fund: so many months of what you really spend.
S['15g-fondo-emergencia'] = S['15c-metas'] + formSheet(`
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Fondo de emergencia</h2><span style="width:62px"></span></div>
 <div class="sub" style="text-align:center;white-space:normal;margin:2px 0 12px">Cuántos meses podrías vivir sin ingresos, con lo que de verdad gastas.</div>
 <div style="display:flex;gap:8px;justify-content:center">${['3', '6', '9', '12'].map(m => `<div class="chip ${m === '6' ? 'on' : ''}" style="padding:9px 11px;font-size:14px">${m} meses</div>`).join('')}</div>
 <div class="card" style="margin-top:14px;padding:14px">
  <div style="display:flex;justify-content:space-between"><span class="mu">Gastas al mes ${infoDot}</span><b>3.300.000</b></div>
  <div style="display:flex;justify-content:space-between;margin-top:8px"><span class="mu">× 6 meses</span><b></b></div>
  <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #26324f;font-size:18px"><b>Tu meta</b><b style="color:var(--pr)">19.800.000</b></div></div>
 <div class="list" style="margin-top:10px">
  ${row(ci('calendar-outline', C.blu, 38), `${lab('Para cuándo')}Sin fecha`, 'Te dice cuándo llegas a tu ritmo', down())}</div>
 <div class="h" style="margin-top:14px">Dónde está la plata · 2 lugares</div>
 <div class="list">
  ${row(ci('leaf-outline', C.grn, 38), `${lab('Cuenta de ahorros')}Ahorro Verde`, 'Cuenta todo lo que tiene · 6.000.000', down())}
  ${row(ci('logo-usd', C.cya, 38), `${lab('Cuenta en dólares')}Cuenta Dólar`, 'Cuenta todo lo que tiene · USD 600 = 2.400.000 hoy', down())}
  ${row(ci('add', C.blu, 38), '<span class="p">Agregar otra cuenta o bolsillo</span>', '', '')}</div>
 <div class="sub" style="text-align:right;margin:8px 4px 0">Juntas tienen hoy <b style="color:var(--tx)">8.400.000</b></div>
 <div class="note" style="margin:10px 2px 0">El promedio de tus gastos de los últimos 6 meses, como en el Reporte: sin transferencias ni pagos de tarjeta. Si tus gastos cambian, la meta te ofrece ponerse al día.</div>
 <div class="btn" style="margin-top:12px">Guardar meta</div>`, 80);

// 8. One goal, on time: how far, what it takes, the pace, the balance
//    month by month against the target, and what went in.
const goalTop = (icon, color, name, sub) => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${sq(icon, color, 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">${name}</b><div class="sub one">${sub}</div></div>${ic('pencil', 'p')}</div></div>`;
const mBar = (m, h, c) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="height:110px;width:100%;display:flex;align-items:flex-end;justify-content:center"><i style="display:block;width:70%;height:${h}%;border-radius:6px 6px 2px 2px;background:${c}"></i></div><span class="sub" style="font-size:11.5px">${m}</span></div>`;
const mv = (icon, t, s, a, cls = 'g') => `<div class="row">${icon}<div class="tx"><b class="one">${t}</b><small>${s}</small></div><div class="am ${cls}">${a}</div></div>`;
const transferIc = ci('swap-horizontal', '#4cb8f5', 38);
const twoBtns = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div class="btn ghost">${a}</div><div class="btn">${b}</div></div>`;
S['15h-meta-a-tiempo'] = `${goalTop('airplane-outline', C.cya, 'Viaje a Cartagena', 'Cajita Viaje y Global Viajes')}<main>
 <div class="card hero"><div style="display:flex;justify-content:space-between;align-items:center"><div class="lab">Llevas</div><span class="tag" style="background:rgba(7,13,26,.35);color:#bff0d6">A tiempo</span></div>
  <div class="big">2.350.000 <span class="mu" style="font-size:15px;font-weight:500">de 6.000.000</span></div>
  ${bar(39, '#fff', 10)}<div class="sub" style="margin-top:8px;white-space:normal">Faltan 3.650.000 para junio de 2027: <b style="color:var(--tx)">456.250 al mes</b> durante 8 meses.</div></div>
 <div class="list" style="margin-top:10px">${row(ci('speedometer-outline', C.grn, 40), 'A tu ritmo llegas en mayo de 2027', 'Entraron 500.000 al mes en los últimos 3 meses', '')}</div>
 <div class="h">Dónde está · 2 lugares</div>
 <div class="list">
  <div class="row">${sq('cube-outline', C.blu, 38)}<div class="tx"><b class="one">Cajita Viaje</b><small>Banco Azul · todo lo que tiene</small></div><div style="text-align:right"><b>1.750.000</b><div class="sub">74 %</div></div></div>
  <div class="row">${ci('globe-outline', C.tea, 38)}<div class="tx"><b class="one">Global Viajes</b><small>USD 150 a la TRM de hoy · todo</small></div><div style="text-align:right"><b>600.000</b><div class="sub">26 %</div></div></div></div>
 <div class="h">Cómo ha crecido ${infoDot}</div>
 <div class="card" style="padding:14px"><div style="position:relative;display:flex;gap:6px">
  <div style="position:absolute;left:0;right:0;top:0;border-top:2px dashed ${C.grn}"></div>
  ${mBar('may', 6, tint(C.cya, .55))}${mBar('jun', 12, tint(C.cya, .55))}${mBar('jul', 18, tint(C.cya, .55))}${mBar('ago', 26, tint(C.cya, .55))}${mBar('sep', 32, tint(C.cya, .55))}${mBar('oct', 39, C.cya)}</div>
  <div class="sub" style="margin-top:8px">Lo que tenían juntas al cierre de cada mes. La línea es tu meta.</div></div>
 <div class="h">Lo que entró · últimos 3</div>
 <div class="list">
  ${mv(transferIc, 'Ahorro viaje', '1 oct · desde Banco Azul', '+500.000')}
  ${mv(transferIc, 'Dólares viaje', '15 sep · Global Viajes', '+USD 50')}
  ${mv(sq('sparkles-outline', C.gold, 38), 'Rendimientos', 'septiembre · la cajita rinde', '+12.400')}</div>
 ${twoBtns(`${ic('create-outline')}Cambiar`, `${ic('add')}Aportar`)}
 <div class="btn ghost" style="margin-top:10px;color:var(--red)">Borrar esta meta</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 9. One goal, late: said plainly, with the two honest ways out.
S['15i-meta-atrasada'] = `${goalTop('laptop-outline', C.pur, 'Portátil nuevo', 'Cajita Naranja · Bolsillo Portátil')}<main>
 <div class="card hero" style="background:linear-gradient(145deg,${tint(C.yel, .3)} 0%,${tint(C.yel, .1)} 55%,#111b2f 100%);border-color:${tint(C.yel, .45)}">
  <div style="display:flex;justify-content:space-between;align-items:center"><div class="lab" style="color:#f3d58a">Llevas</div><span class="tag" style="background:rgba(7,13,26,.35);color:#f3d58a">Atrasada</span></div>
  <div class="big">2.900.000 <span class="mu" style="font-size:15px;font-weight:500">de 4.500.000</span></div>
  ${bar(64, C.yel, 10)}<div class="sub" style="margin-top:8px;white-space:normal">Para diciembre necesitas <b style="color:var(--tx)">800.000 al mes</b>; en los últimos 3 meses entraron 350.000 al mes. A ese ritmo llegas en <b style="color:var(--tx)">marzo de 2027</b>, 3 meses tarde.</div></div>
 <div class="h">Para llegar</div>
 <div class="list">
  ${row(ci('add-circle-outline', C.blu, 40), 'Aportar 800.000 este mes', 'Abre la transferencia hacia el Bolsillo Portátil', chev())}
  ${row(ci('calendar-outline', C.yel, 40), 'Mover la fecha a marzo de 2027', 'Con lo que ya aportas, llegas', `<span class="chip" style="padding:6px 10px;color:var(--pr)">Mover</span>`)}</div>
 <div class="h">Cómo ha crecido</div>
 <div class="card" style="padding:14px"><div style="position:relative;display:flex;gap:6px">
  <div style="position:absolute;left:0;right:0;top:0;border-top:2px dashed ${C.grn}"></div>
  ${mBar('may', 30, tint(C.pur, .55))}${mBar('jun', 38, tint(C.pur, .55))}${mBar('jul', 46, tint(C.pur, .55))}${mBar('ago', 52, tint(C.pur, .55))}${mBar('sep', 58, tint(C.pur, .55))}${mBar('oct', 64, C.pur)}</div></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 10. Reached: said once, and the money stays where it is - the app never
//     moves it. Archiving keeps it in "Logradas".
S['15j-meta-lograda'] = `${goalTop('school-outline', C.blu, 'Matrícula', 'Banco Azul · Cajita Matrícula')}<main>
 <div class="card hero" style="background:linear-gradient(145deg,${tint(C.grn, .35)} 0%,${tint(C.grn, .12)} 55%,#111b2f 100%);border-color:${tint(C.grn, .5)};text-align:center">
  ${ci('trophy-outline', C.grn, 60).replace('display:grid', 'display:grid;margin:4px auto 10px')}
  <b style="display:block;font-size:20px">¡Lograste tu meta!</b>
  <div class="big g" style="margin-top:4px">3.200.000</div>
  <div class="sub" style="white-space:normal">La juntaste el 12 de septiembre, en 7 meses.</div></div>
 <div class="list" style="margin-top:10px">
  ${row(ci('wallet-outline', C.blu, 40), 'La plata sigue en la Cajita Matrícula', 'La app no la mueve: tú decides cuándo usarla', '')}</div>
 <div class="note" style="margin:10px 4px">Si la usas, la meta sigue como lograda: queda guardado el día en que llegaste.</div>
 ${twoBtns(`${ic('archive-outline')}Archivar`, `${ic('add')}Nueva meta`)}
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}`;

// 11. Aportar: the one transfer form, already going to the goal's place,
//     with what is missing this month. Nothing is saved without "Guardar".
const end = (side, accIc, accC, acc, prodIc, prod, bal) => `<div style="display:flex;gap:10px;padding:10px 0"><span class="mu" style="width:46px;font-size:13px;padding-top:9px">${side}</span><div style="flex:1">
 <div style="display:flex;gap:10px;align-items:center">${ci(accIc, accC, 36)}<div style="flex:1"><b>${acc}</b>${bal && !prod ? `<div class="sub">${bal}</div>` : ''}</div>${down()}</div>
 ${prod ? `<div style="display:flex;gap:10px;align-items:center;margin:6px 0 0 16px"><span style="width:12px;height:18px;border-left:2px solid #2a3756;border-bottom:2px solid #2a3756;border-bottom-left-radius:7px;margin-top:-12px"></span>${sq(prodIc, accC, 30)}<div style="flex:1"><b style="font-size:14.5px">${prod}</b><div class="sub">${bal}</div></div>${down()}</div>` : ''}</div></div>`;
S['15k-aportar'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('close', 'back')}<h1 style="flex:1;text-align:center">Transferir</h1><span style="width:26px"></span></div>
 ${seg([['Gasto', ''], ['Ingreso', ''], ['Transferir', '']], 'Transferir')}</div><main>
 <div style="text-align:center;font-size:40px;font-weight:700;margin:14px 0 2px">456.250</div>
 <div style="text-align:center"><span class="chip" style="padding:6px 12px">${ic('flag-outline', 'p', 'width:16px;height:16px')}Lo que te toca este mes para Viaje a Cartagena</span></div>
 <div class="card" style="margin-top:14px;padding:4px 14px">
  ${end('Desde', 'wallet-outline', C.blu, 'Banco Azul', 'cube-outline', 'Cuenta de ahorros', 'Tiene 2.462.300')}
  <div style="border-top:1px solid #26324f"></div>
  ${end('Hacia', 'wallet-outline', C.blu, 'Banco Azul', 'cube-outline', 'Cajita Viaje', 'Tiene 2.350.000')}</div>
 <div class="list" style="margin-top:10px">
  ${row(ci('calendar-outline', C.blu, 38), `${lab('Fecha')}Hoy`, '', down())}
  ${row(ci('create-outline', C.blu, 38), `${lab('Nota')}Ahorro viaje`, '', '')}</div>
 <div class="btn" style="margin-top:14px">Guardar</div>
 <div style="height:40px"></div></main>`;

// 12. Inicio says nothing about goals unless one is reached or falls
//     behind - the same rule as topes: only what needs attention.
S['15l-inicio-meta'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">Todas las cuentas</b>${down()}</div><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar('Octubre 2026')}</div><main>
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55</div></div>
 <div class="list" style="margin-top:10px">
  ${row(sq('laptop-outline', C.pur, 40), 'Portátil nuevo va atrasada', '<span style="color:' + C.yel + '">Para diciembre necesitas 800.000 al mes</span>')}
  ${row(catIcon('rest', 40), 'Restaurantes va en 78 %', 'Quedan 88.000 para 12 días')}</div>
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 <div class="card" style="height:150px;display:grid;place-items:center"><span class="mu">(el gráfico de siempre)</span></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

export default S;
