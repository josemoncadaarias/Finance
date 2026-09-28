// Group 6 (v5, 2026-09-28): Por revisar, and reading a statement. What the
// review screen does today (features/review, rule 22): batches from a
// statement or a bank notice, each with its counts, what still needs
// something and the statement's own check; per row the account, amount,
// expense or income, date and category (learned, suggested), "maybe the same
// as...", "the other half of a transfer"; shops that repeat, filed once;
// save all, discard all (they do not come back), "No ver más"; search, sort,
// filters and the note when a filter hides rows; choosing several; squaring
// the account with the bank. Reading: the stages, the page, Cancel, the
// password, a file that cannot be read.
// v5, from Jose's review of v4: a count always says what it counts; the
// account on top with "Todas las cuentas" first; the filter and the order
// as chips with their icon, opening a sheet; a movement is checked in the
// one movement form (its keypad, its note with suggestions); choosing
// several by day or by shop, not only row by row; and the green notices
// gone - a small check beside the file, a toast that goes by itself.
import { ic, ci, sq, C, ACC, catIcon, accIcon, chev, down, tag, tick, top, tabs, tint, jump, mgroup, foldAll } from './lib.mjs';
import G1, { typeSeg, amount, keys, end, note, infoDot } from './screens-1.mjs';

const S = {};
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const bubble = (top, arrowRight, text) => `<div style="position:absolute;left:24px;right:24px;top:${top}px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;right:${arrowRight}px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>${text}</div>`;

// Por revisar lives in the Más tab: its title, and the bar below stays.
const head = () => top('Por revisar');
const page = (body, after = '') => `${head()}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;
const scrolled = (by, body, after = '') => `<div style="position:absolute;left:0;right:0;top:88px;bottom:0;overflow:hidden"><main style="margin-top:-${by}px">${body}<div style="height:110px"></div></main></div><div style="position:absolute;left:0;right:0;top:0">${head()}</div><div class="fade"></div>${tabs('Más')}${after}`;

// The account first, centred, as on the report: "Todas las cuentas" is the
// general choice and heads its list.
const accChip = (name = 'Todas las cuentas', icon = ci('layers-outline', C.blu, 24)) => `<div class="chip" style="display:flex;width:fit-content;max-width:100%;margin:8px auto 0;padding:6px 12px">${icon}<span class="one">${name}</span>${down()}</div>`;

// The tools over the list: search on its own row; then what to show and the
// order in one chip with its icon, opening one sheet; open-all; Seleccionar.
const chipI = (i, t, on = false) => `<span class="chip" style="padding:7px 10px;font-size:13px;${on ? `border-color:var(--pr);color:var(--pr);background:${tint(C.blu, .12)}` : ''}">${ic(i, '', 'width:16px;height:16px')}${t}${ic('chevron-down-outline', '', 'width:14px;height:14px')}</span>`;
const tools = (show = 'Todos', choosing = false) => `${accChip()}
 <div class="search" style="margin-top:10px">${ic('search-outline')}<span class="one">Buscar: descripción, monto, fecha o categoría…</span></div>
 <div style="display:flex;gap:6px;margin-top:10px;align-items:center">${chipI('funnel-outline', `${show} · por fecha`, show !== 'Todos')}
  <span style="flex:1"></span>${foldAll()}<span class="chip" style="padding:7px 11px;font-size:13px;${choosing ? 'color:var(--pr)' : ''}">${ic(choosing ? 'close' : 'checkmark-done-outline', '', 'width:16px;height:16px')}${choosing ? 'Salir' : 'Seleccionar'}</span></div>`;

// A batch: where it came from and whether it squares (a small mark beside
// the file; its (i)-bubble says what that means), how many, what still needs
// something, and the two answers for all of it.
const okMark = `<span style="width:26px;height:26px;border-radius:50%;background:${tint(C.grn, .18)};display:grid;place-items:center;flex:none">${ic('checkmark', '', `width:16px;height:16px;color:${C.grn}`)}</span>`;
const offMark = `<span style="width:26px;height:26px;border-radius:50%;background:${tint(C.yel, .2)};display:grid;place-items:center;flex:none">${ic('alert', '', `width:16px;height:16px;color:${C.yel}`)}</span>`;
const batch = ({ mark = okMark, body = '', extra = '' } = {}) => `<div class="card" style="margin-top:12px;padding:12px 14px">
 <div style="display:flex;gap:10px;align-items:center">${ci('document-text-outline', C.pur, 40)}<div style="flex:1;min-width:0"><b class="one" style="display:block;font-size:15px">Extracto de Banco Azul</b><small class="one mu" style="display:block;font-size:12.5px">extracto-banco-azul-septiembre-2026.pdf</small></div>${mark}</div>
 ${extra}
 <div style="display:flex;gap:14px;margin-top:9px;font-size:13px;flex-wrap:wrap"><span>18 movimientos por confirmar</span><span style="color:#f3d58a">${ic('ellipse', '', 'width:8px;height:8px;vertical-align:1px;margin-right:5px')}3 necesitan algo</span></div>
 <div style="display:flex;gap:8px;margin-top:11px"><div class="btn" style="flex:1;height:42px;font-size:14px">${ic('checkmark-done-outline', '', 'width:18px;height:18px')}Guardar los 15 listos</div><span class="btn-r" style="width:42px;height:42px;background:var(--s2)">${ic('ellipsis-horizontal')}</span></div>
 ${body}</div>`;

// One proposal: its icon (the category, or "?" while it has none), what it
// said on one line (sliding), the category with where it came from, any
// notice, and the amount.
const CAT_NAME = { mercado: 'Mercado', transp: 'Transporte', ocio: 'Entretenimiento', salario: 'Salario' };
const cat = (k, how) => `${CAT_NAME[k]} ${tag(how, how === 'aprendida' ? C.grn : C.yel)}`;
const prow = (icon, desc, sub, amt, cls = 'r', note = '', pick = null) => `<div class="row" style="align-items:flex-start;${pick === 'on' ? `background:${tint(C.blu, .12)}` : ''}">${pick !== null ? `<span style="margin-top:9px">${tick(pick === 'on')}</span>` : ''}${icon}<div class="tx"><b class="one" style="font-size:14.5px">${desc}</b><small class="one">${sub}</small>${note}</div><div class="am ${cls}" style="margin-top:2px">${amt}</div></div>`;
const flag = (i, c, fg, t) => `<small style="display:flex;gap:6px;align-items:flex-start;color:${fg};white-space:normal;margin-top:4px;line-height:1.35">${ic(i, '', `width:15px;height:15px;flex:none;margin-top:1px;color:${c}`)}<span>${t}</span></small>`;
const ROWS = {
  exito: p => prow(catIcon('mercado', 40), 'COMPRA EXITO POB MEDELLIN', cat('mercado', 'aprendida'), '−112.500,00', 'r', '', p),
  seguro: p => prow(catIcon('transp', 40), 'PAGO SEGURO VEHICULO ANUAL COBERTURA TOTAL', cat('transp', 'sugerida'), '−380.000,00', 'r', '', p),
  alkosto: p => prow(sq('help-outline', C.yel, 40), 'COMPRA ALKOSTO CALLE 30', '<span style="color:#f3d58a">Falta la categoría</span>', '−1.249.000,00', 'r', '', p),
  cine: p => prow(catIcon('ocio', 40), 'COMPRA CINE COLOMBIA', cat('ocio', 'aprendida'), '−64.000,00', 'r', flag('copy-outline', C.org, '#f6c89d', 'Puede ser el del 12 sept por 64.000,00 · Cine con amigos'), p),
  transf: p => prow(ci('swap-horizontal', C.blu, 40), 'TRANSF A AHORRO VERDE', 'Transferencia', '−3.000.000,00', 'p', flag('git-compare-outline', C.blu, '#c3cdfa', 'Parece la otra mitad de un traslado con Ahorro Verde'), p),
};

// While choosing, a heading carries its own tick: it takes every movement of
// that day (or shop), open or closed. Half-ticked when only some are.
const half = `<span class="tick on" style="background:var(--pr)">${ic('remove', '', 'width:15px;height:15px')}</span>`;
const headTick = st => st === 'on' ? tick(true) : st === 'half' ? half : tick(false);
const day = (t, n, total, cls, open, keys = [], pick = null, st = null) => mgroup(t, pick && st !== null ? (st === 'on' ? `${n} de ${n} elegidos` : st === 'half' ? `${keys.filter(k => pick[k] === 'on').length} de ${n} elegidos` : n) : n, total, cls, open,
  open ? keys.map(k => ROWS[k](pick ? (pick[k] ?? 'off') : null)).join('') : '', '', st !== null ? headTick(st) : '');

// Shops that repeat: file each one once, for all its movements here. While
// choosing, a shop takes all of its movements.
const shop = (name, n, choose) => `<div class="row" style="${choose === 'on' ? `background:${tint(C.blu, .12)}` : ''}">${choose ? tick(choose === 'on') : ''}${sq('storefront-outline', C.tea, 38)}<div class="tx"><b class="one">${name}</b><small>${n} movimientos${choose === 'on' ? ' · todos elegidos' : ''}</small></div>${choose ? '' : `<span class="chip" style="padding:6px 10px;font-size:13px">${ic('pricetag-outline', '', 'width:15px;height:15px')}Elegir categoría</span>`}</div>`;
const repeated = (open, choose = null) => mgroup('Comercios que se repiten', '2 comercios · 7 movimientos', '', '', open,
  open ? shop('D1 LAURELES', 4, choose?.[0]) + shop('RAPPI RESTAURANTES', 3, choose?.[1]) : '', sq('repeat-outline', C.tea, 30), choose ? headTick(choose[0] === 'on' && choose[1] === 'on' ? 'on' : choose.includes('on') ? 'half' : 'off') : '')
  .replace('<span class="" style="font-weight:600;font-size:14px;white-space:nowrap"></span>', infoDot);

const list = () => `${repeated(false)}
 ${day('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', true, ['exito', 'seguro', 'alkosto'])}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', false)}
 ${day('Lunes 15 de septiembre', 4, '+4.020.600,00', 'g', false)}
 ${day('Miércoles 10 de septiembre', 5, '−418.200,00', 'r', false)}`;

// 1. As it opens: the account, the tools, the batch, the list by day, only
//    the first day open.
S['6a-por-revisar'] = page(`${tools()}${batch()}${list()}`) + jump(112, 'down');

// 2. A day further down, holding the two notices a row can carry.
S['6b-avisos-en-las-filas'] = scrolled(300, `${tools()}${batch()}${repeated(false)}
 ${day('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', false)}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', true, ['cine', 'transf'])}
 ${day('Lunes 15 de septiembre', 4, '+4.020.600,00', 'g', false)}`) + jump(112, 'both');

// 3. Shops that repeat, open: one category for all of each shop's movements.
S['6c-comercios-que-se-repiten'] = scrolled(170, `${tools()}${batch()}${repeated(true)}
 ${day('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', false)}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', false)}`) + jump(112, 'both');

// 4. The check beside the file, tapped: what it means, in a bubble.
S['6d-cuadra-ayuda'] = S['6a-por-revisar'] + bubble(310, 22, 'El extracto cuadra consigo mismo: empezó en 1.094.400,00, terminó en 1.206.900,00, y lo que leí suma exactamente esa diferencia.');

// 5. One movement opened: the one movement form, as on Inicio - its keypad
//    for the amount, the account, the category, the day and the note - with
//    what the statement said on top. Discard is in the title bar.
const said = line => `<div style="display:flex;align-items:center;gap:8px;background:#0a1222;border:1px dashed #2a3a5c;border-radius:12px;padding:8px 11px;margin-top:10px">${ic('document-text-outline', '', `width:17px;height:17px;flex:none;color:${C.pur}`)}<span class="one" style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#b9c3d8">${line}</span>${infoDot}</div>`;
const formTop = top('Revisar movimiento', { left: 'x', right: `<span class="btn-r" style="color:var(--red)">${ic('trash-outline')}</span>` });
const catRow = (icon, name, how) => `<div class="row">${icon}<div class="tx"><span class="k">Categoría</span><b>${name} ${how ? tag(how, how === 'aprendida' ? C.grn : C.yel) : ''}</b></div><span class="mu">${ic('create-outline', '', 'width:19px;height:19px')}</span>${down()}</div>`;
const dayRev = d => `<div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>${d}</b></div>${down()}</div>`;
const form = ({ line, sign = '−', cls = 'r', amt, cat: c, d = 'Viernes 26 sept 2026', n = 'Compra Éxito Poblado', extra = '', ok = 'Guardar' }) => `${formTop}<main style="padding-top:8px">${typeSeg(sign === '−' ? 'Gasto' : 'Ingreso')}${said(line)}${extra}
 ${amount(sign, cls, amt)}
 <div class="list">${end(accIcon('azul', 38), sign === '−' ? 'Desde dónde' : 'Hacia dónde', 'Banco Azul')}${c}${dayRev(d)}${note(n, 'del extracto')}</div>
 </main>${keys(ok)}`;
S['6e-revisar-un-movimiento'] = form({ line: '26/09 COMPRA EXITO POB MEDELLIN −112.500,00 1.206.900,00', amt: '112.500', cat: catRow(catIcon('mercado', 38), 'Mercado', 'aprendida') });

// 6. Its note, being written: the same note as every other screen - it rises,
//    the rest steps aside, and under it the notes written before, plus what
//    the statement said, so it can be kept as it came.
S['6f-nota-con-sugerencias'] = `${formTop}<main style="padding-top:10px">
 <div class="card" style="padding:12px 14px;border-color:var(--pr)"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lab">Nota</span><span class="p b" style="font-size:14px">Listo</span></div>
  <div style="font-size:17px;margin-top:6px">Mercado<span style="border-left:2px solid var(--pr);margin-left:1px"></span></div></div>
 <div class="list" style="margin-top:8px">${[['time-outline', '<u>Mercado</u> quincena', 'la de siempre en Mercado'], ['time-outline', '<u>Mercado</u> del mes', ''], ['document-text-outline', 'COMPRA EXITO POB MEDELLIN', 'tal como vino en el extracto']].map(([i, t, s]) => `<div class="row plain">${ic(i, 'mu', 'width:18px;height:18px')}<div class="tx"><b style="font-size:14.5px">${t}</b>${s ? `<small>${s}</small>` : ''}</div>${ic('arrow-up-outline', 'mu', 'transform:rotate(-45deg);width:18px;height:18px')}</div>`).join('')}</div></main>
 <div style="position:absolute;left:0;right:0;bottom:0;height:300px;background:#1b1f27;padding:8px 4px 20px">
  ${['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'].map((r, n) => `<div style="display:flex;justify-content:center;gap:5px;margin-top:9px;padding:0 ${n === 2 ? 34 : 0}px">${[...r].map(k => `<span style="width:34px;height:46px;border-radius:7px;background:#2e333d;display:grid;place-items:center;font-size:19px;color:#e6e8ee">${k}</span>`).join('')}</div>`).join('')}
  <div style="display:flex;gap:5px;margin-top:9px;padding:0 6px"><span style="width:60px;height:46px;border-radius:7px;background:#3a404c"></span><span style="flex:1;height:46px;border-radius:7px;background:#2e333d"></span><span style="width:60px;height:46px;border-radius:7px;background:#3a404c"></span></div></div>`;

// 7. One that still needs something: the category row is what is marked, in
//    amber, and Guardar waits - no red sentence of its own.
S['6g-le-falta-la-categoria'] = form({ line: '26/09 COMPRA ALKOSTO CALLE 30 −1.249.000,00 1.094.400,00', amt: '1.249.000', n: 'Compra Alkosto',
  cat: `<div class="row" style="background:${tint(C.yel, .1)}">${sq('help-outline', C.yel, 38)}<div class="tx"><span class="k" style="color:#f3d58a">Categoría</span><b style="color:#f3d58a">Elegir categoría</b></div>${ic('chevron-forward-outline', '', 'width:18px;height:18px;color:#f3d58a')}</div>` })
  .replace('<div style="grid-column:span 4" class="ok">Guardar</div>', '<div style="grid-column:span 4;opacity:.45" class="ok">Guardar</div>');

// 8. Maybe the same as one already on record: the movement it may be, with
//    its icon, under what the statement said; the person decides.
S['6h-puede-ser-el-mismo'] = form({ line: '23/09 COMPRA CINE COLOMBIA −64.000,00 2.030.400,00', amt: '64.000', d: 'Martes 23 sept 2026', n: 'Cine Colombia', cat: catRow(catIcon('ocio', 38), 'Entretenimiento', 'aprendida'),
  extra: `<div class="list" style="margin-top:8px;background:${tint(C.org, .1)};border-color:${tint(C.org, .3)}"><div class="row" style="padding:8px 12px">${catIcon('ocio', 32)}<div class="tx"><small style="margin:0;color:#f6c89d">Puede ser este, que ya está guardado</small><b class="one" style="font-size:14px">Cine con amigos · 12 sept</b></div><div class="am r">−64.000,00</div></div></div>` });

// 9. Choosing several. A row, a day or a shop each takes one tap: a day's
//    tick takes all its movements, closed or open; "Todos" takes everything
//    the account, the filter and the search leave on view. The bar says how
//    many out of how many, and what can be done to them.
const bar = (n, of, save) => `<div style="position:absolute;left:12px;right:12px;bottom:26px;background:#15213a;border:1px solid #2a3b60;border-radius:22px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.6)">
  <div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:50%;background:var(--s3);display:grid;place-items:center">${ic('close')}</span><div style="flex:1;min-width:0"><b style="display:block">${n} movimientos elegidos</b><small class="mu" style="font-size:12px">de ${of} a la vista</small></div><span class="p" style="font-size:13.5px">Todos</span><span class="mu" style="font-size:13.5px">·</span><span class="p" style="font-size:13.5px">Ninguno</span></div>
  <div style="display:flex;gap:8px;margin-top:10px"><span class="chip" style="flex:1;justify-content:center;padding:9px 6px">${ic('pricetag-outline', '', 'width:16px;height:16px')}Categoría</span><span class="chip" style="padding:9px 12px;color:var(--red)">${ic('trash-outline', '', 'width:16px;height:16px')}</span><span class="chip" style="flex:1;justify-content:center;padding:9px 6px;background:var(--pr);border-color:var(--pr);color:#fff;font-weight:600">Guardar ${save}</span></div></div>`;
const pickA = { exito: 'on', seguro: 'on', alkosto: 'on' };
S['6i-seleccionar-por-dia'] = `${head()}<main>${tools('Todos', true)}${batch()}${repeated(false, ['off', 'off'])}
 ${day('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', true, ['exito', 'seguro', 'alkosto'], pickA, 'on')}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', true, ['cine', 'transf'], { cine: 'on' }, 'half')}
 ${day('Lunes 15 de septiembre', 4, '+4.020.600,00', 'g', false, [], {}, 'on')}
 ${day('Miércoles 10 de septiembre', 5, '−418.200,00', 'r', false, [], {}, 'off')}<div style="height:170px"></div></main><div class="fade"></div>${bar(8, 18, 7)}`;

// 10. Choosing by shop: a shop's tick takes all its movements, wherever they
//     sit in the list - the days that hold them show it.
S['6j-seleccionar-por-comercio'] = `${head()}<main>${tools('Todos', true)}${batch()}${repeated(true, ['on', 'off'])}
 ${day('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', false, [], {}, 'off')}
 ${day('Miércoles 10 de septiembre', 5, '−418.200,00', 'r', false, ['exito'], { exito: 'on' }, 'half').replace('1 de 5 elegidos', '2 de 5 elegidos')}<div style="height:170px"></div></main><div class="fade"></div>${bar(4, 18, 4)}`;

// 11. Saving the chosen ones: the count is what will be written, and the
//     dialog says how many stay behind and why.
const dialog = (icon, title, body, no, yes, danger = false) => `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(icon)}<b style="font-size:18px">${title}</b>
 <div class="sub" style="margin-top:8px;line-height:1.45">${body}</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">${no}</div><div class="btn${danger ? ' danger' : ''}" style="flex:1">${yes}</div></div></div>`;
S['6k-guardar-elegidos'] = S['6i-seleccionar-por-dia'] + dialog(ci('checkmark-done-outline', C.blu, 54), '¿Guardar 7 movimientos?',
  'Quedan como movimientos normales y después los puedes editar o borrar uno por uno.<br><span style="color:#f3d58a">1 de los elegidos se queda: le falta la categoría.</span>', 'Cancelar', 'Guardar');

// 12. What to show and in what order: one sheet, each option with its icon
//     and how many it holds.
const opt = (i, c, t, n, on) => `<div class="row">${ci(i, c, 38)}<div class="tx"><b>${t}</b>${n ? `<small>${n}</small>` : ''}</div>${on ? ic('checkmark', 'p', 'width:20px;height:20px') : ''}</div>`;
S['6l-filtro-y-orden'] = S['6a-por-revisar'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="h" style="margin-top:4px">Mostrar</div><div class="list">${opt('list-outline', C.blu, 'Todos', '18 movimientos', true)}${opt('help-circle-outline', C.yel, 'Les falta algo', '3 movimientos: categoría, cuenta o monto', false)}${opt('flag-outline', C.org, 'Con aviso', '2 movimientos: puede ser el mismo, o la otra mitad de un traslado', false)}</div>
 <div class="h">Ordenar</div><div class="list">${opt('calendar-outline', C.pur, 'Por fecha', 'el más reciente primero', true)}${opt('cash-outline', C.grn, 'Por monto', 'el más grande primero', false)}</div></div>`;

// 13. A filter on: its chip lit, and one quiet line saying what it hides.
S['6m-filtro-puesto'] = page(`${tools('Les falta algo')}
 <div class="sub" style="margin:10px 4px 0;display:flex;gap:6px;align-items:center">${ic('eye-off-outline', '', 'width:15px;height:15px')}<span style="flex:1">Ves 3 de 18 movimientos</span><span class="p">Ver todos</span></div>
 ${batch()}
 ${mgroup('Viernes 26 de septiembre', 1, '−1.249.000,00', 'r', true, ROWS.alkosto(null))}
 ${mgroup('Martes 23 de septiembre', 1, '', '', false)}
 ${mgroup('Miércoles 10 de septiembre', 1, '', '', false)}`);

// 14. The account: "Todas las cuentas" first, then each account with what it
//     has waiting.
const accRow = (k, sub, on = false) => `<div class="row">${accIcon(k, 40)}<div class="tx"><b class="one">${ACC[k][2]}</b><small>${sub}</small></div>${on ? ic('checkmark', 'p', 'width:20px;height:20px') : ''}</div>`;
S['6n-elegir-cuenta'] = S['6a-por-revisar'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><b style="flex:1;text-align:center;font-size:17px">Cuenta</b><span style="width:70px"></span></div>
 <div class="list" style="margin-top:12px"><div class="row">${ci('layers-outline', C.blu, 40)}<div class="tx"><b>Todas las cuentas</b><small>20 movimientos por revisar</small></div>${ic('checkmark', 'p', 'width:20px;height:20px')}</div></div>
 <div class="seg" style="margin-top:10px;padding:3px"><div class="on" style="font-size:13px;padding:6px">Más usadas</div><div style="font-size:13px;padding:6px">A-Z</div></div>
 <div class="list" style="margin-top:10px">${accRow('azul', '18 movimientos por revisar')}${accRow('coral', '2 movimientos por revisar')}${accRow('verde', 'Nada por revisar')}</div></div>`;

// 15. The batch's "···": the two ways to be done with all of it.
S['6o-mas-opciones'] = S['6a-por-revisar'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <b style="display:block;text-align:center;font-size:17px;margin-bottom:12px">Extracto de Banco Azul</b>
 <div class="list"><div class="row">${ci('trash-outline', C.red, 40)}<div class="tx"><b class="r">Descartar los 18 movimientos</b><small>No se guardan y no vuelven si importas el mismo extracto</small></div></div>
  <div class="row">${ci('eye-off-outline', C.gry, 40)}<div class="tx"><b>No ver más estos movimientos en pantalla</b><small>No se guardan ni se descartan: si importas el extracto otra vez, aparecen</small></div></div></div></div>`;
S['6p-descartar-todos'] = S['6a-por-revisar'] + dialog(ci('trash-outline', C.red, 54), '¿Descartar los 18 movimientos?',
  'No se guardan, y si vuelves a importar el mismo extracto no aparecen otra vez.', 'Cancelar', 'Descartar', true);

// 16. Squaring the account with the bank: what the app says, what the
//     statement says, the gap - and three answers. No movement is invented.
const squareCard = `<div class="card" style="margin-top:10px;padding:12px 14px;background:var(--s2)">
 <div style="display:flex;align-items:center;gap:10px">${accIcon('azul', 32)}<b style="flex:1;font-size:15px">Cuadrar Banco Azul con el banco</b>${infoDot}</div>
 <div style="margin-top:8px">${[['Saldo en la app, al 30 sept', '10.200.000,00', ''], ['Saldo en el extracto', '12.480.300,00', ''], ['Diferencia', '+2.280.300,00', 'p']].map(([k, v, c]) => `<div style="display:flex;justify-content:space-between;padding:5px 2px;font-size:14px"><span class="mu">${k}</span><b class="${c}">${v}</b></div>`).join('')}</div>
 <div class="btn" style="margin-top:8px;height:40px;font-size:14px">Igualar al extracto</div>
 <div style="display:flex;gap:8px;margin-top:8px"><div class="btn ghost" style="flex:1;height:38px;font-size:13.5px;background:var(--s3)">Escribir otro</div><div class="btn ghost" style="flex:1;height:38px;font-size:13.5px;background:var(--s3)">Dejar así</div></div></div>`;
S['6q-cuadrar-con-el-banco'] = scrolled(100, `${tools()}${batch({ body: squareCard })}${list()}`) + jump(112, 'both');
S['6r-cuadrar-ayuda'] = S['6q-cuadrar-con-el-banco'] + bubble(412, 50, 'Es lo que pasó antes de este extracto y nunca escribiste. Si lo igualas, se guarda como saldo inicial de la cuenta y no se inventa ningún movimiento.');
S['6s-cuadrar-confirmar'] = S['6q-cuadrar-con-el-banco'] + dialog(accIcon('azul', 54), '¿Cuadrar Banco Azul?',
  'El saldo inicial de la cuenta pasa de <b style="color:var(--tx)">0,00</b> a <b style="color:var(--tx)">2.280.300,00</b>, y al 30 sept queda en <b style="color:var(--tx)">12.480.300,00</b>. No se crea ningún movimiento.', 'Cancelar', 'Cuadrar');

// ------------------------------------------------------ reading a statement
// The "+" → Importar extracto: whose statement it is, then the file. Here
// there is no "Todas": a statement belongs to one account.
S['6t-de-que-cuenta-es'] = G1['1a-inicio'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><b style="flex:1;text-align:center;font-size:17px">¿De qué cuenta es?</b><span style="width:70px"></span></div>
 <div class="seg" style="margin-top:12px;padding:3px"><div class="on" style="font-size:13px;padding:6px">Más usadas</div><div style="font-size:13px;padding:6px">A-Z</div></div>
 <div class="list" style="margin-top:10px">${accRow('azul', 'Cuenta de ahorros · COP', true)}${accRow('coral', 'Tarjeta de crédito · COP')}${accRow('verde', 'Cuenta de ahorros · 3 productos')}${accRow('naranja', 'Cuenta de ahorros · 2 productos')}</div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('add', C.pur, 40)}<div class="tx"><b>Es de una cuenta nueva</b><small>La creo con lo que diga el extracto</small></div>${chev()}</div></div></div>`;

const input = (ph, val = '') => `<div style="background:var(--s2);border:1px solid #2c3b5e;border-radius:14px;height:48px;display:flex;align-items:center;padding:0 14px;gap:10px;margin-top:14px">${ic('key-outline', 'mu', 'width:18px;height:18px')}<span style="flex:1;${val ? '' : 'color:var(--mu)'};letter-spacing:${val ? '3px' : '0'}">${val || ph}</span>${ic('eye-outline', 'mu', 'width:19px;height:19px')}</div>`;
const reading = (pct, pageN, stage) => `${top('Importar extracto', { left: 'x' })}<main style="padding-top:34px;text-align:center">
 ${centred(ci('document-text-outline', C.pur, 84), 16)}<b style="font-size:19px">Leyendo el extracto</b>
 <div class="sub one" style="margin-top:4px">extracto-banco-azul-septiembre-2026.pdf</div>
 <div class="card" style="margin-top:20px;text-align:left"><div style="display:flex;justify-content:space-between"><b>${pageN}</b><span class="p" style="font-weight:600">${pct} %</span></div>
  <div class="pbar" style="margin-top:8px;height:8px"><i style="width:${pct}%;background:var(--pr)"></i></div>
  <div style="margin-top:12px">${['Abriendo el extracto', 'Leyendo las páginas', 'Entendiendo los movimientos', 'Preparando la revisión'].map((t, n) => {
    const s = n < stage ? 1 : n === stage ? 2 : 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0">${s === 1 ? ci('checkmark', C.grn, 26) : s === 2 ? ci('ellipsis-horizontal', C.blu, 26) : ci('ellipse-outline', C.gry, 26)}<span style="font-size:14px;${s ? '' : 'color:var(--mu)'}">${t}</span></div>`; }).join('')}</div></div>
 <div class="sub" style="margin-top:12px;display:flex;gap:6px;justify-content:center;align-items:center">${ic('shield-checkmark-outline', '', 'width:16px;height:16px;color:var(--grn)')}Nada se guarda hasta el final</div>
 </main><div style="position:absolute;left:16px;right:16px;bottom:24px"><div class="btn ghost">Cancelar</div></div>`;
S['6u-contrasena'] = reading(10, 'Abriendo', 0) + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('lock-closed-outline', C.yel, 54))}
 <div style="display:flex;justify-content:center;align-items:center;gap:8px"><b style="font-size:18px">Este extracto pide contraseña</b>${infoDot}</div>
 ${input('Contraseña del PDF', '••••••••')}
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Abrir</div></div></div>`;
S['6v-leyendo'] = reading(72, 'Página 3 de 4', 1);

// Done: a short notice that goes by itself, over the list.
const toast = t => `<div style="position:absolute;left:24px;right:24px;bottom:104px;background:#1e2b47;border:1px solid #33456f;border-radius:16px;padding:11px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 26px rgba(0,0,0,.55);font-size:13.5px">${ic('checkmark-circle', '', `width:20px;height:20px;color:${C.grn};flex:none`)}<span>${t}</span></div>`;
S['6w-leido'] = S['6a-por-revisar'] + toast('Leí 18 movimientos. 2 ya estaban aquí o los habías descartado, y no se repiten.');

// It does not square: the mark beside the file turns amber and says by how
// much, one line; the (i) explains.
S['6x-no-cuadra'] = page(`${tools()}${batch({ mark: offMark, extra: `<div style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px;color:#f3d58a">${ic('alert-circle-outline', '', 'width:16px;height:16px')}<span style="flex:1">No cuadra por 45.900,00: revisa antes de guardar</span>${infoDot}</div>` })}${list()}`) + jump(112, 'down');
S['6y-no-se-pudo-leer'] = reading(40, 'Página 1 de 4', 1) + dialog(ci('document-outline', C.red, 54), 'No pude leer este extracto',
  'Puede ser una foto o un escaneo sin texto adentro. No se guardó nada.', 'Cerrar', 'Elegir otro');

// Nothing waiting: an icon, one sentence, one action.
S['6z-nada-por-revisar'] = `${head()}<main style="padding-top:70px;text-align:center">${centred(ci('checkmark-done-outline', C.grn, 84), 16)}
 <b style="font-size:19px">No hay nada por revisar</b>
 <div class="sub" style="margin:8px 20px 0;line-height:1.45">Lo que la app lea de un extracto aparece aquí, y nada se guarda sin que tú lo apruebes.</div>
 <div class="btn" style="margin:22px 40px 0">${ic('document-text-outline')}Importar extracto</div></main>${tabs('Más')}`;

export default S;
