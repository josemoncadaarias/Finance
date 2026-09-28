// Group 6 (v4, 2026-09-28): Por revisar, and reading a statement. What the
// review screen does today (features/review, rule 22): batches from a
// statement or a bank notice, each with its counts, what still needs
// something and the statement's own check; per row the account, amount,
// expense or income, date and category (learned, suggested), "maybe the same
// as...", "the other half of a transfer"; shops that repeat, filed once;
// save all, discard all (they do not come back), "No ver más"; search, sort,
// filters and the note when a filter hides rows; choosing several; squaring
// the account with the bank. Reading: the stages, the page, Cancel, the
// password, a file that cannot be read.
// Drawn with the rules of groups 1-5: movements in folding sections (first
// open), the two arrows, one row per thing, explanations as an (i), icons
// everywhere, long descriptions on one line and sliding.
import { ic, ci, sq, C, ACC, PALETTE, catIcon, accIcon, chev, down, tag, tick, top, tabs, tint, jump, mgroup, foldAll } from './lib.mjs';
import G1, { infoDot } from './screens-1.mjs';

const S = {};
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const banner = (c, i, t, fg) => `<div class="banner" style="background:${tint(c, .12)};color:${fg};margin-top:10px">${ic(i)}<span>${t}</span></div>`;
const green = t => banner(C.grn, 'checkmark-circle-outline', t, '#a7ecc9');
const amber = t => banner(C.yel, 'alert-circle-outline', t, '#f3d58a');
const grey = t => banner(C.gry, 'information-circle-outline', t, '#b9c3d8');

// Por revisar lives in the Más tab: its title, and the bar below stays.
const head = (right = '') => top('Por revisar', { right });
const page = (body, after = '') => `${head()}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Más')}${after}`;
const scrolled = (by, body, after = '') => `<div style="position:absolute;left:0;right:0;top:88px;bottom:0;overflow:hidden"><main style="margin-top:-${by}px">${body}<div style="height:110px"></div></main></div><div style="position:absolute;left:0;right:0;top:0">${head()}</div><div class="fade"></div>${tabs('Más')}${after}`;

// The tools over the list: search on its own row; then what to show, the
// order, fold all and Seleccionar, each one tap.
const tools = (only = 'Todos', choosing = false) => `<div class="search" style="margin-top:10px">${ic('search-outline')}<span class="one">Buscar: descripción, monto, fecha o categoría…</span></div>
 <div style="display:flex;gap:6px;margin-top:10px">${[['Todos', 18], ['Les falta algo', 3], ['Con aviso', 2]].map(([t, n]) => `<div class="chip ${t === only ? 'on' : ''}" style="padding:7px 10px;font-size:13px">${t} · ${n}</div>`).join('')}</div>
 <div style="display:flex;gap:8px;margin-top:8px;align-items:center"><div class="seg" style="flex:none;width:170px;padding:3px"><div class="on" style="font-size:12.5px;padding:6px 2px">Por fecha</div><div style="font-size:12.5px;padding:6px 2px">Por monto</div></div>
  <span style="flex:1"></span>${foldAll()}<span class="chip" style="padding:7px 11px;font-size:13px;${choosing ? 'color:var(--pr)' : ''}">${ic(choosing ? 'close' : 'checkmark-done-outline', '', 'width:16px;height:16px')}${choosing ? 'Salir' : 'Seleccionar'}</span></div>`;

// A batch: where it came from, how many, what still needs something, the
// statement's own check, and the two answers for all of it.
const batch = (open, body = '', check = '') => `<div class="card" style="margin-top:12px;padding:12px 14px">
 <div style="display:flex;gap:10px;align-items:center">${ci('document-text-outline', C.pur, 40)}<div style="flex:1;min-width:0"><b class="one" style="display:block;font-size:15px">Extracto de Banco Azul</b><small class="one mu" style="display:block;font-size:12.5px">extracto-banco-azul-septiembre-2026.pdf</small></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>
 <div style="display:flex;gap:14px;margin-top:9px;font-size:13px"><span>${ic('list-outline', '', 'width:15px;height:15px;vertical-align:-3px;margin-right:4px')}18 por confirmar</span><span style="color:#f3d58a">${ic('ellipse', '', 'width:9px;height:9px;vertical-align:0;margin-right:5px')}3 necesitan algo</span></div>
 ${check}
 <div style="display:flex;gap:8px;margin-top:11px"><div class="btn" style="flex:1;height:42px;font-size:14px">${ic('checkmark-done-outline', '', 'width:18px;height:18px')}Guardar los 15</div><span class="btn-r" style="width:42px;height:42px;background:var(--s2)">${ic('ellipsis-horizontal')}</span></div>
 ${body}</div>`;
const notice = batch.bind(null, false, '');
const check = green('El extracto cuadra consigo mismo: empezó en 1.094.400,00 y terminó en 1.206.900,00.');

// One proposal: its icon (the category, or "?" while it has none), what it
// said on one line, the category with where it came from, and any notice.
const cat = (k, how) => `${CAT_NAME[k]} ${tag(how, how === 'aprendida' ? C.grn : C.yel)}`;
const CAT_NAME = { mercado: 'Mercado', transp: 'Transporte', rest: 'Restaurantes', servicios: 'Servicios', ocio: 'Entretenimiento', salario: 'Salario' };
const prow = (icon, desc, sub, amt, cls = 'r', note = '', pick = null) => `<div class="row${pick ? ' picked' : ''}" style="align-items:flex-start;${pick ? `background:${tint(C.blu, .12)}` : ''}">${pick !== null ? `<span style="margin-top:9px">${tick(pick === 'on')}</span>` : ''}${icon}<div class="tx"><b class="one" style="font-size:14.5px">${desc}</b><small class="one">${sub}</small>${note}</div><div class="am ${cls}" style="margin-top:2px">${amt}</div></div>`;
const flag = (i, c, fg, t) => `<small style="display:flex;gap:6px;align-items:flex-start;color:${fg};white-space:normal;margin-top:4px;line-height:1.35">${ic(i, '', `width:15px;height:15px;flex:none;margin-top:1px;color:${c}`)}<span>${t}</span></small>`;
const missing = sq('help-outline', C.yel, 40);
const ROWS = {
  exito: pick => prow(catIcon('mercado', 40), 'COMPRA EXITO POB MEDELLIN', cat('mercado', 'aprendida'), '−112.500,00', 'r', '', pick),
  seguro: pick => prow(catIcon('transp', 40), 'PAGO SEGURO VEHICULO ANUAL COBERTURA TOTAL', cat('transp', 'sugerida'), '−380.000,00', 'r', '', pick),
  alkosto: pick => prow(missing, 'COMPRA ALKOSTO CALLE 30', '<span style="color:#f3d58a">Falta la categoría</span>', '−1.249.000,00', 'r', '', pick),
  cine: pick => prow(catIcon('ocio', 40), 'COMPRA CINE COLOMBIA', cat('ocio', 'aprendida'), '−64.000,00', 'r', flag('copy-outline', C.org, '#f6c89d', 'Puede ser el del 12 sept por 64.000,00 · Cine con amigos'), pick),
  transf: pick => prow(ci('swap-horizontal', C.blu, 40), 'TRANSF A AHORRO VERDE', 'Transferencia', '−3.000.000,00', 'p', flag('git-compare-outline', C.blu, '#c3cdfa', 'Parece la otra mitad de un traslado con Ahorro Verde'), pick),
  nomina: pick => prow(catIcon('salario', 40), 'PAGO NOMINA EMPRESA', cat('salario', 'aprendida'), '+4.225.000,00', 'g', '', pick),
};
const day = (t, n, total, cls, open, keys, pick) => mgroup(t, n, total, cls, open, open ? keys.map(k => ROWS[k](pick ? (pick[k] ?? 'off') : null)).join('') : '');

// Shops that repeat: file each one once, for all its rows here.
const repeated = open => mgroup('Comercios que se repiten', 2, '', '', open, open ? [['D1 LAURELES', 4], ['RAPPI RESTAURANTES', 3]].map(([t, n]) =>
  `<div class="row">${sq('storefront-outline', C.tea, 38)}<div class="tx"><b class="one">${t}</b><small>${n} movimientos</small></div><span class="chip" style="padding:6px 10px;font-size:13px">${ic('pricetag-outline', '', 'width:15px;height:15px')}Elegir categoría</span></div>`).join('') : '', sq('repeat-outline', C.tea, 30))
  .replace('<span class="" style="font-weight:600;font-size:14px;white-space:nowrap"></span>', `${infoDot}`);

const list = (pick) => `${repeated(false)}
 ${day('Viernes 26 de septiembre', 3, '−1.426.500,00', 'r', true, ['exito', 'seguro', 'alkosto'], pick)}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', false, [], pick)}
 ${day('Lunes 15 de septiembre', 4, '+4.020.600,00', 'g', false, [], pick)}
 ${day('Miércoles 10 de septiembre', 5, '−418.200,00', 'r', false, [], pick)}`;

// 1. As it opens: the batch, its check, the list by day, only the first open.
S['6a-por-revisar'] = page(`${tools()}${batch(true, '', check)}${list()}`) + jump(112, 'down');

// 2. A day further down, holding the two notices a row can carry.
S['6b-avisos-en-las-filas'] = scrolled(250, `${tools()}${batch(true, '', check)}${repeated(false)}
 ${day('Viernes 26 de septiembre', 3, '−1.426.500,00', 'r', false, [])}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', true, ['cine', 'transf'])}
 ${day('Lunes 15 de septiembre', 4, '+4.020.600,00', 'g', false, [])}`) + jump(112, 'both');

// 3. Shops that repeat, open: one category for all of each shop's rows.
S['6c-comercios-que-se-repiten'] = page(`${tools()}${batch(true, '', check)}${repeated(true)}
 ${day('Viernes 26 de septiembre', 3, '−1.426.500,00', 'r', false, [])}
 ${day('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', false, [])}`) + jump(112, 'down');

// 4. One proposal opened: what the statement said, and every part of it
//    changeable before it is saved. Nothing is written without that tap.
const field = (k, v, extra = '') => `<div class="row" style="padding:11px 14px"><span class="mu" style="width:78px;flex:none;font-size:13.5px">${k}</span><div style="flex:1;min-width:0;display:flex;align-items:center;gap:9px">${v}</div>${extra || down()}</div>`;
const said = t => `<div style="background:#0a1222;border:1px dashed #2a3a5c;border-radius:12px;padding:9px 11px;margin-top:10px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#b9c3d8;line-height:1.45"><span class="mu" style="font-family:Roboto,Arial;font-size:11px;letter-spacing:.8px;display:block;margin-bottom:3px">LO QUE DICE EL EXTRACTO</span>${t}</div>`;
const detail = ({ title, line, kind = 'Gasto', amt, catRow, notices = '' }) => `<div class="scrim"></div><div class="sheet" style="padding-bottom:22px"><div class="grab"></div>
 <b class="one" style="display:block;font-size:17px;text-align:center">${title}</b>${said(line)}${notices}
 <div class="seg" style="margin-top:12px"><div class="${kind === 'Gasto' ? 'on red' : ''}">${ic('arrow-up')}Gasto</div><div class="${kind === 'Ingreso' ? 'on grn' : ''}">${ic('arrow-down')}Ingreso</div></div>
 <div style="text-align:center;font-size:30px;font-weight:700;margin-top:12px" class="${kind === 'Gasto' ? 'r' : 'g'}">${amt}</div>
 <div class="list" style="margin-top:12px">${field('Fecha', `${ic('calendar-outline', '', 'width:18px;height:18px')}<span>Viernes 26 sept 2026</span>`)}
  ${field('Cuenta', `${accIcon('azul', 28)}<b class="one" style="font-weight:500">Banco Azul</b>`)}
  ${catRow}
  ${field('Nota', `<span class="one">Compra Éxito Poblado</span>`, ic('close-circle', 'mu', 'width:18px;height:18px'))}</div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="width:120px">Descartar</div><div class="btn" style="flex:1">Guardar este movimiento</div></div></div>`;
S['6d-un-movimiento'] = S['6a-por-revisar'] + detail({ title: 'COMPRA EXITO POB MEDELLIN', line: '26/09  COMPRA EXITO POB MEDELLIN   −112.500,00   1.206.900,00', amt: '112.500,00',
  catRow: field('Categoría', `${catIcon('mercado', 28)}<b style="font-weight:500">Mercado</b>${tag('aprendida', C.grn)}${infoDot}`, ic('create-outline', 'p', 'width:19px;height:19px')) });

// 5. One that still needs something: the category row is what is marked,
//    in amber, and Guardar waits for it - no red sentence of its own.
S['6e-le-falta-la-categoria'] = S['6a-por-revisar'] + detail({ title: 'COMPRA ALKOSTO CALLE 30', line: '26/09  COMPRA ALKOSTO CALLE 30   −1.249.000,00   1.094.400,00', amt: '1.249.000,00',
  catRow: `<div class="row" style="padding:11px 14px;background:${tint(C.yel, .1)}"><span style="width:78px;flex:none;font-size:13.5px;color:#f3d58a">Categoría</span><div style="flex:1;display:flex;align-items:center;gap:9px">${sq('help-outline', C.yel, 28)}<b style="font-weight:500;color:#f3d58a">Elegir categoría</b></div>${ic('chevron-forward-outline', '', 'width:18px;height:18px;color:#f3d58a')}</div>` })
  .replace('<div class="btn" style="flex:1">Guardar este movimiento</div>', '<div class="btn" style="flex:1;opacity:.45">Guardar este movimiento</div>');

// 6. Maybe the same as one already on record: said inside the sheet, with
//    the movement it may be; the person decides.
S['6f-puede-ser-el-mismo'] = S['6b-avisos-en-las-filas'] + detail({ title: 'COMPRA CINE COLOMBIA', line: '23/09  COMPRA CINE COLOMBIA   −64.000,00   2.030.400,00', amt: '64.000,00',
  notices: `<div class="list" style="margin-top:10px;background:${tint(C.org, .1)};border-color:${tint(C.org, .3)}"><div class="row" style="padding:10px 12px">${catIcon('ocio', 34)}<div class="tx"><small style="margin:0;color:#f6c89d">Puede ser este, que ya está guardado</small><b class="one" style="font-size:14px">Cine con amigos · 12 sept</b></div><div class="am r">−64.000,00</div></div></div>`,
  catRow: field('Categoría', `${catIcon('ocio', 28)}<b style="font-weight:500">Entretenimiento</b>${tag('aprendida', C.grn)}`, ic('create-outline', 'p', 'width:19px;height:19px')) })
  .replace('Compra Éxito Poblado', 'Cine Colombia');

// 7. Choosing several: the whole row takes the tap; the bar says how many
//    and what can be done to them.
const pick = { exito: 'on', seguro: 'on', alkosto: 'on' };
S['6g-seleccionar-varios'] = `${head()}<main>${tools('Todos', true)}${batch(true, '', check)}${list(pick).replace(/<div class="row" style="align-items:flex-start;"/g, '<div class="row" style="align-items:flex-start;"')}<div style="height:150px"></div></main><div class="fade"></div>
 <div style="position:absolute;left:12px;right:12px;bottom:26px;background:#15213a;border:1px solid #2a3b60;border-radius:22px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.6)">
  <div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:50%;background:var(--s3);display:grid;place-items:center">${ic('close')}</span><b style="flex:1">3 seleccionados</b><span class="p" style="font-size:13.5px">Todos</span><span class="mu" style="font-size:13.5px">·</span><span class="p" style="font-size:13.5px">Ninguno</span></div>
  <div style="display:flex;gap:8px;margin-top:10px"><span class="chip" style="flex:1;justify-content:center;padding:9px 6px">${ic('pricetag-outline', '', 'width:16px;height:16px')}Categoría</span><span class="chip" style="padding:9px 12px;color:var(--red)">${ic('trash-outline', '', 'width:16px;height:16px')}</span><span class="chip" style="flex:1;justify-content:center;padding:9px 6px;background:var(--pr);border-color:var(--pr);color:#fff;font-weight:600">Guardar 2</span></div></div>`;

// 8. Saving the chosen ones: the count is what will be written, and the
//    dialog says how many stay behind and why.
const dialog = (icon, title, body, no, yes, danger = false) => `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(icon)}<b style="font-size:18px">${title}</b>
 <div class="sub" style="margin-top:8px;line-height:1.45">${body}</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">${no}</div><div class="btn${danger ? ' danger' : ''}" style="flex:1">${yes}</div></div></div>`;
S['6h-guardar-seleccionados'] = S['6g-seleccionar-varios'] + dialog(ci('checkmark-done-outline', C.blu, 54), '¿Guardar los 2 movimientos?',
  'Se guardan como movimientos normales y después los puedes editar o borrar uno por uno.<br><span style="color:#f3d58a">1 de los seleccionados no se guarda todavía: le falta algo.</span>', 'Cancelar', 'Guardar');

// 9. The batch's "···": the two ways to be done with all of it.
S['6i-mas-opciones'] = S['6a-por-revisar'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <b style="display:block;text-align:center;font-size:17px;margin-bottom:12px">Extracto de Banco Azul</b>
 <div class="list"><div class="row">${ci('trash-outline', C.red, 40)}<div class="tx"><b class="r">Descartar estos movimientos</b><small>No se guardan y no vuelven si importas el mismo extracto</small></div></div>
  <div class="row">${ci('eye-off-outline', C.gry, 40)}<div class="tx"><b>No ver más estos movimientos en pantalla</b><small>No se guardan ni se descartan: si importas el extracto otra vez, aparecen</small></div></div></div></div>`;
S['6j-descartar-todos'] = S['6a-por-revisar'] + dialog(ci('trash-outline', C.red, 54), '¿Descartar los 18 movimientos?',
  'No se guardan, y si vuelves a importar el mismo extracto no aparecen otra vez.', 'Cancelar', 'Descartar', true);

// 10. A filter hiding rows says so, and how to see them all.
S['6k-filtro-esconde'] = page(`${tools('Les falta algo')}${batch(true, '', check)}
 ${grey('Estás viendo 3 de 18. El filtro «Les falta algo» esconde el resto. <b style="color:var(--pr)">Ver todos</b>')}
 ${mgroup('Viernes 26 de septiembre', 1, '−1.249.000,00', 'r', true, ROWS.alkosto(null))}
 ${mgroup('Martes 23 de septiembre', 1, '', '', false)}
 ${mgroup('Miércoles 10 de septiembre', 1, '', '', false)}`);

// 11. Squaring the account with the bank: what the app says, what the
//     statement says, the gap - and three answers. No movement is invented.
const squareCard = `<div class="card" style="margin-top:10px;padding:12px 14px;border-color:${tint(C.blu, .4)}">
 <div style="display:flex;align-items:center;gap:10px">${accIcon('azul', 34)}<b style="flex:1;font-size:15px">Cuadrar Banco Azul con el banco</b>${infoDot}</div>
 <div class="list" style="margin-top:10px;background:var(--s2)">${[['En la app, al 30 sept', '10.200.000,00', ''], ['Dice el extracto', '12.480.300,00', ''], ['Diferencia', '+2.280.300,00', 'p']].map(([k, v, c]) => `<div class="row plain" style="padding:8px 12px"><div class="tx"><small style="margin:0;font-size:13px">${k}</small></div><b class="${c}">${v}</b></div>`).join('')}</div>
 <div class="btn" style="margin-top:10px;height:42px;font-size:14px">Igualar al extracto</div>
 <div style="display:flex;gap:8px;margin-top:8px"><div class="btn ghost" style="flex:1;height:40px;font-size:13.5px">Escribir otro</div><div class="btn ghost" style="flex:1;height:40px;font-size:13.5px">Dejar así</div></div></div>`;
S['6l-cuadrar-con-el-banco'] = page(`${tools()}${batch(true, squareCard, check)}${list()}`) + jump(112, 'down');
S['6m-cuadrar-ayuda'] = S['6l-cuadrar-con-el-banco'] + `<div style="position:absolute;left:24px;right:24px;top:512px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;right:52px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>Es lo que pasó antes de este extracto y nunca escribiste. Si lo igualas, se guarda como saldo inicial de la cuenta y no se inventa ningún movimiento.</div>`;
S['6n-cuadrar-confirmar'] = S['6l-cuadrar-con-el-banco'] + dialog(accIcon('azul', 54), '¿Cuadrar Banco Azul?',
  'El saldo inicial de la cuenta pasa de <b style="color:var(--tx)">0,00</b> a <b style="color:var(--tx)">2.280.300,00</b>, y al 30 sept queda en <b style="color:var(--tx)">12.480.300,00</b>. No se crea ningún movimiento.', 'Cancelar', 'Cuadrar');

// ------------------------------------------------------ reading a statement
// The "+" → Importar extracto: whose statement it is, then the file.
const accRow = (k, sub, on = false) => `<div class="row">${accIcon(k, 40)}<div class="tx"><b class="one">${ACC[k][2]}</b><small>${sub}</small></div>${on ? ic('checkmark', 'p', 'width:20px;height:20px') : ''}</div>`;
S['6o-de-que-cuenta'] = G1['1a-inicio'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><b style="flex:1;text-align:center;font-size:17px">¿De qué cuenta es?</b><span style="width:70px"></span></div>
 <div class="seg" style="margin-top:12px;padding:3px"><div class="on" style="font-size:13px;padding:6px">Más usadas</div><div style="font-size:13px;padding:6px">A-Z</div></div>
 <div class="list" style="margin-top:10px">${accRow('azul', 'Cuenta de ahorros · COP', true)}${accRow('coral', 'Tarjeta de crédito · COP')}${accRow('verde', 'Cuenta de ahorros · 3 productos')}${accRow('naranja', 'Cuenta de ahorros · 2 productos')}</div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('add', C.pur, 40)}<div class="tx"><b>Es de una cuenta nueva</b><small>La creo con lo que diga el extracto</small></div>${chev()}</div></div></div>`;

// The file asks for a password.
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
S['6p-contrasena'] = reading(10, 'Abriendo', 0) + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('lock-closed-outline', C.yel, 54))}
 <div style="display:flex;justify-content:center;align-items:center;gap:8px"><b style="font-size:18px">Este extracto pide contraseña</b>${infoDot}</div>
 ${input('Contraseña del PDF', '••••••••')}
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Abrir</div></div></div>`;
S['6q-leyendo'] = reading(72, 'Página 3 de 4', 1);

// Done: what was read and whether it squares, on top of the batch.
S['6r-leido'] = page(`${green('Leí 18 movimientos de extracto-banco-azul-septiembre-2026.pdf')}
 ${grey('2 ya estaban en esta pantalla o ya los habías descartado, así que no se repiten.')}
 ${tools()}${batch(true, '', check)}${list()}`) + jump(112, 'down');
S['6s-no-cuadra'] = page(`${tools()}${batch(true, '', amber('Ojo: el extracto dice que empezó en 1.094.400,00 y terminó en 1.206.900,00, pero lo que leí suma 1.161.000,00. Se diferencian en 45.900,00: puede que no haya leído bien alguna línea.'))}${list()}`) + jump(112, 'down');
S['6t-no-se-pudo-leer'] = reading(40, 'Página 1 de 4', 1) + dialog(ci('document-outline', C.red, 54), 'No pude leer este extracto',
  'Puede ser una foto o un escaneo sin texto adentro. No se guardó nada.', 'Cerrar', 'Elegir otro');

// Nothing waiting: an icon, one sentence, one action.
S['6u-nada-por-revisar'] = `${head()}<main style="padding-top:70px;text-align:center">${centred(ci('checkmark-done-outline', C.grn, 84), 16)}
 <b style="font-size:19px">No hay nada por revisar</b>
 <div class="sub" style="margin:8px 20px 0;line-height:1.45">Lo que la app lea de un extracto aparece aquí, y nada se guarda sin que tú lo apruebes.</div>
 <div class="btn" style="margin:22px 40px 0">${ic('document-text-outline')}Importar extracto</div></main>${tabs('Más')}`;

export default S;
