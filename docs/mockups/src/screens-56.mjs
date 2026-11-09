// Group 56 - Inicio's top in ONE block that folds (Jose, 2026-11-09: the
// reminders, payments, caps passed, "Puedes gastar hoy", the balance and its
// figures still take half the screen before the chart). Proposed, not decided.
// Nothing is lost: every figure stays one tap away. Three ways drawn:
// - A: one card, folded by default: the big figure and ONE line of what needs
//   attention; a tap opens everything inside the same card;
// - B: the figure moves into the header and a row of small chips takes the rest;
// - C: today's blocks, folding into one line when the list scrolls.
import { readFileSync } from 'node:fs';
import { ic, C, PALETTE, tint, ci, chev, down, tabs, status, periodBar, accIcon } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const $ = v => `$&nbsp;${v}`;
const shot = name => `data:image/png;base64,${readFileSync(new URL(`./assets/${name}.png`, import.meta.url)).toString('base64')}`;
const img = name => `<img src="${shot(name)}" style="display:block;width:100%;margin-top:12px">`;

const header = (icon, name, sub, extra = '') => `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${icon}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">${name}</b>${down()}</div>
 <div class="one sub" style="font-size:12.5px">${sub}</div></div>${ci('sparkles-outline', C.blu, 40)}</div>
 ${extra}${periodBar('Noviembre 2026')}</div>`;
const card = (sub = 'COP · tarjeta de crédito', extra = '') => header(accIcon('coral', 40), 'Tarjeta Coral', sub, extra);
const all = (sub = '21 cuentas, todas incluidas', extra = '') => header(ci('layers-outline', C.blu, 40), 'Todas las cuentas', sub, extra);

const round = (svg, solid = true, size = 36) => `<span style="width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;background:${solid ? 'var(--pr)' : 'rgba(255,255,255,.08)'};color:#fff;flex:none">${svg}</span>`;
const eye = (size = 36) => round(ic('eye-outline', '', 'width:18px;height:18px'), false, size);
const dots = (size = 36) => round(ic('ellipsis-horizontal', '', 'width:20px;height:20px'), true, size);
const fig = (icon, cls, lab, v) => `<span style="white-space:nowrap">${ic(icon, cls, 'width:14px;height:14px;vertical-align:-2px')} ${lab} <b class="${cls}">${v}</b></span>`;
const lineOf = (...figs) => `<div class="sub" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13.5px">${figs.join('')}</div>`;
const bar = (pct, line) => `<div style="height:7px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:10px"><i style="display:block;width:${Math.max(2, pct)}%;height:100%;border-radius:4px;background:${C.yel}"></i></div>
 <div class="sub" style="margin-top:6px;font-size:13.5px">${line}</div>`;
const seg = `<div class="seg" style="margin:12px 0 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 24</div></div>`;
const page = body => `<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// A small coloured dot and its words: one thing that needs attention.
const dot = (c, t) => `<span style="display:inline-flex;align-items:center;gap:6px;white-space:nowrap"><i style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block"></i>${t}</span>`;

// 56a - today, as in Jose's screenshot, for comparison.
const pendingRow = `<div class="row" style="background:var(--s1);border-radius:16px;padding:11px 14px;gap:10px"><span style="width:9px;height:9px;border-radius:50%;background:${C.yel};flex:none"></span><div class="tx"><b style="font-size:14.5px;font-weight:500">1 recordatorio</b></div>${chev()}</div>`;
const heroToday = `<div class="card hero" style="margin-top:12px"><div style="display:flex;align-items:center;justify-content:space-between"><div><div class="lab">Debes hoy</div><div class="big" style="color:#f6c75a">186.840,00</div></div><span style="display:flex;gap:7px">${eye()}${dots()}</span></div>
 ${bar(1, `Usas el 1 % · te quedan <b class="g">16.176.896,00</b> de 16.363.736,00`)}${lineOf(fig('arrow-up', 'r', 'Salió', '1.548.821,00'), fig('swap-horizontal', 'p', 'Recibido', '2.035.907,00'))}</div>`;
const todayRow = `<div class="row" style="background:var(--s1);border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px">${ci('sunny-outline', C.yel, 34)}<div class="tx"><b style="font-weight:500">Puedes gastar hoy</b><small style="white-space:normal">Con Tarjeta Coral, para cada día hasta el 30 de noviembre</small></div><b class="g" style="font-size:16px">${$('126.200')}</b>${chev()}</div>`;
const mark = (top, label) => `<div style="position:absolute;left:0;right:0;top:${top}px;border-top:2px dashed ${C.red};pointer-events:none"><span style="position:absolute;right:8px;top:-22px;background:${C.red};color:#fff;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:8px">${label}</span></div>`;
S['56a-hoy'] = card() + page(`${pendingRow}${heroToday}${todayRow}${seg}${img('ring-coral')}`);

// ---- Option A: one card, folded by default ---------------------------------
// Closed: the label and the figure, the eye and the "···", and ONE line under
// them with what needs attention (each thing a coloured dot); the chevron at
// the end opens it. Red when something is late or passed.
const aClosed = (lab, big, color, things, red = false) => `<div class="card hero" style="padding:12px 14px">
 <div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div class="lab">${lab}</div><div class="big" style="font-size:25px;margin:2px 0 0;${color}">${big}</div></div>${eye(34)}${dots(34)}</div>
 <div style="display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.09)">
  <div class="sub" style="flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:3px 14px;font-size:13.4px;${red ? 'color:#ffb3b3' : 'color:#d4dbe8'}">${things}</div>
  ${ic('chevron-down-outline', '', 'width:20px;height:20px;color:var(--pr)')}</div></div>`;
const cardThings = dot(C.yel, '1 recordatorio') + dot(C.grn, `Hoy puedes gastar ${$('126.200')}`);
S['56b-a-cerrado'] = card() + page(`${aClosed('Debes hoy', '186.840,00', 'color:#f6c75a', cardThings)}${seg}${img('ring-coral')}`);

// Open: everything that is there today, inside the same card, in sections;
// "Ver menos" folds it again. The choice is kept on the phone.
const inner = (icon, color, title, sub, right = '') => `<div class="row" style="padding:9px 0;gap:10px">${ci(icon, color, 32)}<div class="tx"><b style="font-weight:500;font-size:14.2px">${title}</b>${sub ? `<small style="white-space:normal">${sub}</small>` : ''}</div>${right}${chev()}</div>`;
const sep = '<div style="height:1px;background:rgba(255,255,255,.09);margin:4px 0"></div>';
S['56c-a-abierto'] = card() + page(`<div class="card hero" style="padding:12px 14px">
 <div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div class="lab">Debes hoy</div><div class="big" style="font-size:25px;margin:2px 0 0;color:#f6c75a">186.840,00</div></div>${eye(34)}${dots(34)}</div>
 ${bar(1, `Usas el 1 % · te quedan <b class="g">16.176.896,00</b> de 16.363.736,00`)}${lineOf(fig('arrow-up', 'r', 'Salió', '1.548.821,00'), fig('swap-horizontal', 'p', 'Recibido', '2.035.907,00'))}
 <div style="margin-top:10px">${sep}
 ${inner('alarm-outline', '#f2709c', 'Pagar el arriendo', 'Recordatorio · mañana a las 8:00')}${sep}
 ${inner('sunny-outline', C.yel, 'Puedes gastar hoy', 'Con Tarjeta Coral, cada día hasta el 30 de noviembre', `<b class="g" style="font-size:15px">${$('126.200')}</b>`)}</div>
 <div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:8px;color:var(--pr);font-size:14px;font-weight:500">Ver menos${ic('chevron-up-outline', '', 'width:18px;height:18px')}</div></div>
 ${seg}${img('ring-coral')}`);

// Closed, with something late: the line turns red and says it first.
const lateThings = dot(C.red, '1 pago vencido') + dot(C.red, '2 topes pasados') + dot(C.yel, '1 recordatorio');
S['56d-a-cerrado-vencido'] = all() + page(`${aClosed('Patrimonio hoy', $('78.498.326,47'), '', lateThings, true)}${seg}${img('ring-todas')}`);

// Closed, nothing pending: only the figure and what can be spent today.
S['56e-a-cerrado-sin-pendientes'] = header(accIcon('azul', 40), 'Banco Azul', 'COP · 2 productos') + page(`${aClosed('Saldo hoy', $('14.825.725,43'), '', dot(C.grn, 'Nada pendiente') + `<span>Entró <b class="g">2.400.000</b> · Salió <b class="r">1.726.100</b></span>`)}${seg}${img('ring-coral')}`);

// ---- Option B: the figure in the header, the rest as chips ------------------
const chip = (icon, color, t, red = false) => `<span class="chip" style="padding:6px 11px;font-size:13px;${red ? `border-color:${tint(C.red, .5)};background:${tint(C.red, .14)};color:#ffb3b3` : ''}">${ic(icon, '', `width:15px;height:15px;color:${color}`)}${t}</span>`;
const chipsRow = (...c) => `<div style="display:flex;gap:7px;overflow:hidden;margin-top:10px;mask-image:linear-gradient(90deg,#000 85%,transparent)">${c.join('')}</div>`;
const headFigure = `<div style="display:flex;align-items:baseline;gap:8px;margin:2px 0 0 50px"><span class="lab">Debes hoy</span><b style="font-size:22px;color:#f6c75a">186.840,00</b><span style="flex:1"></span>${eye(30)}${dots(30)}</div>`;
S['56f-b-chips'] = card('COP · tarjeta de crédito', headFigure) + page(`
 ${chipsRow(chip('alarm-outline', '#f2709c', '1 recordatorio'), chip('sunny-outline', C.yel, `Gastar hoy ${$('126.200')}`), chip('arrow-up', C.red, 'Salió 1.548.821'), chip('card-outline', C.yel, 'Usas el 1 %'))}
 ${seg}${img('ring-coral')}`);
S['56g-b-chip-abierto'] = S['56f-b-chips'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 4px">Cancelar</div><h2 style="text-align:center;margin:0 0 12px;font-size:19px">Puedes gastar hoy</h2>
 <div class="card" style="text-align:center"><div class="big g">${$('126.200')}</div><div class="sub">cada día hasta el 30 de noviembre</div></div>
 <div class="sub" style="margin:12px 4px 0;font-size:13.5px">Cada chip abre lo mismo que abre hoy su bloque: el recordatorio, cómo se calcula lo que puedes gastar, el cupo de la tarjeta.</div></div>`;

// ---- Option C: today's blocks, folding as the list scrolls ------------------
const slim = `<div class="card hero" style="padding:9px 14px;display:flex;align-items:center;gap:10px;border-radius:16px">
 <div style="flex:1;min-width:0"><span class="lab">Debes hoy</span> <b style="font-size:17px;color:#f6c75a;margin-left:6px">186.840,00</b><div class="sub" style="font-size:12.5px;margin-top:2px">${dot(C.yel, '1 recordatorio')} · Hoy ${$('126.200')}</div></div>${ic('chevron-down-outline', '', 'width:20px;height:20px;color:var(--pr)')}</div>`;
S['56h-c-al-bajar'] = card() + `<main><div style="position:sticky;top:0">${slim}</div>${seg}${img('ring-coral')}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// ---- The three side by side: how much of the screen the chart gets ----------
const col = (t, sub, pct, rec = false) => `<div style="flex:1;background:var(--s1);border:1px solid ${rec ? 'var(--pr)' : '#1f2c47'};border-radius:16px;padding:12px">
 <b style="font-size:14.5px">${t}</b>${rec ? ` <span class="tag" style="background:${tint(C.blu, .2)};color:var(--pr)">Recomendada</span>` : ''}
 <div class="sub" style="font-size:12.6px;margin-top:4px;min-height:70px">${sub}</div>
 <div style="height:120px;border-radius:10px;background:#0b1424;margin-top:8px;position:relative;overflow:hidden"><i style="position:absolute;left:0;right:0;bottom:0;height:${pct}%;background:${tint(C.blu, .35)}"></i><span style="position:absolute;inset:0;display:grid;place-items:center;font-weight:700;font-size:18px">${pct} %</span></div>
 <div class="sub" style="font-size:11.6px;margin-top:4px;text-align:center">de la pantalla para el gráfico</div></div>`;
S['56i-comparar'] = `<div class="bar-top">${st}<div class="tt"><h1 style="font-size:21px">Tres formas de juntarlo</h1></div></div><main>
 <div style="display:flex;gap:8px">${col('Hoy', 'Pendientes, el saldo con su barra y cifras, y Puedes gastar hoy: tres bloques.', 46)}${col('A · Una tarjeta', 'El saldo y una línea con lo pendiente. Se abre con un toque.', 74, true)}</div>
 <div style="display:flex;gap:8px;margin-top:8px">${col('B · Chips', 'El saldo en el encabezado y una fila de chips que se desliza.', 79)}${col('C · Al bajar', 'Igual que hoy; se reduce a una línea al bajar por la lista. Al abrir Inicio sigue en 46 %.', 81)}</div>
 <div class="sub" style="margin:12px 4px 0;font-size:13px">Medido en el dibujo: el espacio entre la barra del periodo y la barra de abajo que queda para el gráfico o los movimientos.</div>
 <div style="height:30px"></div></main>`;

export default S;
