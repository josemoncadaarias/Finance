// Group 49 - a calmer Inicio (Jose, 2026-10-29: "demasiada info junta que
// hace perder al usuario ... minimalista, fácil y super claro de leer").
// Proposed, not decided. What changes, and nothing is lost - each thing only
// moves one tap away:
// - Pendientes is ONE line ("4 pagos y 3 topes pasados"), red only when
//   something is late or passed; its rows open in a sheet;
// - the balance card says one figure and one line under it (Entró · Salió);
//   a card says what is owed, a thin bar of its credit and when to pay -
//   "Cupo disponible" and "Cupo total" live on the card's page;
// - "Puedes gastar hoy" is one row;
// - under the chart only SPENDING by category; what came in and what moved
//   between one's own accounts are their own section, under a heading,
//   folded to one row each.
import { ic, C, PALETTE, tint, ci, sq, chev, down, tabs, status, periodBar, catIcon, donut, accIcon, ACC } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const $ = v => `$&nbsp;${v}`;

const header = (icon, name, sub) => `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${icon}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">${name}</b>${down()}</div>
 <div class="one sub" style="font-size:12.5px">${sub}</div></div>${ci('sparkles-outline', C.blu, 40)}</div>
 ${periodBar('Octubre 2026')}</div>`;

// Pendientes: one line. Red when something is late or passed, quiet otherwise.
const pending = (text, bad = true) => `<div class="row" style="background:${bad ? tint(C.red, .12) : 'var(--s1)'};border-radius:16px;padding:11px 14px;gap:10px">
 <span style="width:9px;height:9px;border-radius:50%;background:${bad ? C.red : C.yel};flex:none"></span>
 <div class="tx"><b class="one" style="font-size:14.5px;font-weight:500;color:${bad ? '#ffb3b3' : 'var(--tx)'}">${text}</b></div>${chev()}</div>`;

// The balance: one figure, one line.
const inOut = (a, b) => `<div class="sub" style="margin-top:8px;display:flex;gap:14px;font-size:13.5px">
 <span>${ic('arrow-down', 'g', 'width:14px;height:14px;vertical-align:-2px')} Entró <b class="g">${a}</b></span>
 <span>${ic('arrow-up', 'r', 'width:14px;height:14px;vertical-align:-2px')} Salió <b class="r">${b}</b></span></div>`;
const eye = `<span style="position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.08);display:grid;place-items:center">${ic('eye-outline', '', 'width:18px;height:18px')}</span>`;
const hero = (lab, big, extra, cls = '') => `<div class="card hero" style="position:relative;margin-top:12px">${eye}<div class="lab">${lab}</div><div class="big ${cls}">${big}</div>${extra}</div>`;

const today = `<div class="row" style="background:var(--s1);border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px">${ci('sunny-outline', C.yel, 34)}
 <div class="tx"><b style="font-weight:500">Puedes gastar hoy</b></div><b class="g" style="font-size:16px">${$('54.200')}</b>${chev()}</div>`;

const seg = `<div class="seg" style="margin:14px 0 10px"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos</div></div>`;
const chart = `<div class="card" style="display:flex;flex-direction:column;align-items:center;padding:16px 14px">
 <div style="position:relative">${donut([[51, C.grn], [35, C.red], [8, C.tea], [6, C.cya]], 168)}
 <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="lab" style="font-size:11px">Gastaste</div><b style="font-size:17px">${$('1.726.100')}</b></div></div></div></div>`;

const h = (t, right = '') => `<div style="display:flex;align-items:baseline;justify-content:space-between;margin:18px 4px 8px"><b style="font-size:15.5px">${t}</b>${right ? `<span class="sub" style="font-size:13px">${right}</span>` : ''}</div>`;
const cat = (k, name, pct, amt) => `<div class="row" style="gap:10px">${catIcon(k, 36)}<div class="tx"><b class="one" style="font-weight:500">${name}</b><small>${pct} %</small></div><div class="am">${amt}</div></div>`;
const spending = `${h('En qué gastaste', '4 categorías')}<div class="list">
 ${cat('mercado', 'Mercado', 51, '876.300')}${cat('rest', 'Restaurantes', 35, '606.200')}${cat('ocio', 'Entretenimiento', 8, '135.000')}${cat('transp', 'Transporte', 6, '108.600')}</div>`;

// What came in and what moved: their own section, one row each, folded.
const fold = (icon, title, sub, amt, cls) => `<div class="row" style="gap:10px">${icon}<div class="tx"><b class="one" style="font-weight:500">${title}</b><small>${sub}</small></div><div class="am ${cls}">${amt}</div>${down()}</div>`;
const others = rows => `${h('Lo que entró y lo que moviste', '')}<div class="list">${rows}</div>
 <div class="sub" style="margin:8px 6px 0;font-size:12.8px">No son gastos, por eso no están en el gráfico.</div>`;

const page = body => `<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// 49a - one account.
S['49a-inicio-una-cuenta'] = header(accIcon('azul', 40), 'Banco Azul', 'COP · cuenta de ahorros') + page(`
 ${pending('4 pagos por hacer · 3 topes pasados')}
 ${hero('Saldo hoy', $('6.418.240,00'), inOut('2.637.440', '1.726.100'))}
 ${today}${seg}${chart}${spending}
 ${others(`${fold(ci('arrow-down', C.grn, 36), 'Ingresos', '1 movimiento · Salario', '+2.400.000', 'g')}
 ${fold(ci('swap-horizontal', C.blu, 36), 'Entre tus cuentas', '3 movimientos · a Tarjeta Coral y Nequi', '−820.000', 'p')}`)}`);

// 49a2 - the same, further down: spending alone, then its own section.
S['49a2-inicio-mas-abajo'] = header(accIcon('azul', 40), 'Banco Azul', 'COP · cuenta de ahorros') + page(`
 ${spending.replace('<div style="display:flex;align-items:baseline;justify-content:space-between;margin:18px 4px 8px">', '<div style="display:flex;align-items:baseline;justify-content:space-between;margin:4px 4px 8px">')}
 ${others(`${fold(ci('arrow-down', C.grn, 36), 'Ingresos', '1 movimiento · Salario', '+2.400.000', 'g')}
 ${fold(ci('swap-horizontal', C.blu, 36), 'Entre tus cuentas', '3 movimientos · a Tarjeta Coral y Nequi', '−820.000', 'p')}`)}`);

// 49b - a credit card: what is owed, how much of the credit, when to pay.
const bar = pct => `<div style="display:flex;align-items:center;gap:10px;margin-top:10px"><div style="flex:1;height:7px;border-radius:4px;background:rgba(255,255,255,.1)"><i style="display:block;width:${pct}%;height:100%;border-radius:4px;background:${C.yel}"></i></div><span class="sub" style="font-size:13px">${pct} % del cupo</span></div>`;
const payLine = `<div class="row" style="background:rgba(255,255,255,.06);border-radius:12px;margin-top:12px;padding:9px 12px;gap:8px">${ic('calendar-outline', 'p', 'width:18px;height:18px')}<div class="tx"><span style="font-size:13.8px">Paga ${$('1.035.660')} antes del 10 de nov</span></div>${chev()}</div>`;
S['49b-inicio-una-tarjeta'] = header(accIcon('coral', 40), 'Tarjeta Coral', 'COP · tarjeta de crédito') + page(`
 ${pending('1 pago por hacer', false)}
 ${hero('Debes hoy', $('1.035.660,00'), `${bar(14)}${payLine}`, 'yel')}
 ${seg}${chart}${spending}
 ${others(`${fold(ci('swap-horizontal', C.blu, 36), 'Pagos a la tarjeta', '2 movimientos · desde Banco Azul', '+2.637.440', 'p')}`)}`);

// 49c - Pendientes opened: every row, as today, in a sheet.
const prow = (icon, title, sub, amt, cls = '') => `<div class="row" style="gap:10px">${icon}<div class="tx"><b class="one" style="font-weight:500">${title}</b><small style="white-space:normal">${sub}</small></div>${amt ? `<div class="am ${cls}">${amt}</div>` : ''}${chev()}</div>`;
S['49c-pendientes-abiertos'] = S['49a-inicio-una-cuenta'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 4px">Cancelar</div><h2 style="text-align:center;margin:0 0 10px;font-size:19px">Pendientes</h2>
 <div class="lab" style="margin:8px 4px">Pagos por hacer</div><div class="list">
 ${prow(ci('card-outline', PALETTE.coral, 36), 'Tarjeta Coral', '<span class="r">Vencido hace 2 días</span>', '1.035.660', 'r')}
 ${prow(ci('car-sport-outline', C.cya, 36), 'Crédito del carro', 'Vence el 5 de nov', '1.180.000')}</div>
 <div class="lab" style="margin:14px 4px 8px">Topes pasados</div><div class="list">
 ${prow(catIcon('rest', 36), 'Restaurantes', '<span class="r">Te pasaste por 106.200</span>', '')}
 ${prow(catIcon('mercado', 36), 'Mercado', '<span class="r">Te pasaste por 76.300</span>', '')}</div>
 <div class="lab" style="margin:14px 4px 8px">Recordatorios</div><div class="list">
 ${prow(ci('alarm-outline', '#f2709c', 36), 'Pagar el arriendo', 'Mañana a las 8:00', '')}</div></div>`;

// 49d - every account: net worth, and the money moved between accounts is in
// its own section, never mixed with spending.
S['49d-inicio-todas'] = header(ci('layers-outline', C.blu, 40), 'Todas las cuentas', '7 cuentas, todas incluidas') + page(`
 ${pending('4 pagos por hacer · 3 topes pasados')}
 ${hero('Patrimonio hoy', $('48.312.740,55'), inOut('8.450.000', '5.236.418'))}
 ${today}${seg}${chart}${spending}
 ${others(`${fold(ci('arrow-down', C.grn, 36), 'Ingresos', '3 movimientos · Salario, Intereses', '+8.450.000', 'g')}
 ${fold(ci('swap-horizontal', C.blu, 36), 'Entre tus cuentas', '6 movimientos', '3.400.000', 'p')}`)}`);

// 49e - what moves where, so nothing is lost.
const li = (from, to) => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${from}</b><small style="white-space:normal">${to}</small></div></div>`;
S['49e-que-cambia'] = `<div class="bar-top">${st}<div class="tt"><h1 style="font-size:21px">Qué cambia en Inicio</h1></div></div><main>
 <div class="sub" style="margin:4px 4px 12px;line-height:1.45">Nada se borra: cada cosa queda a un toque. Inicio muestra lo que importa hoy.</div>
 <div class="list">
 ${li('Pendientes con sus etiquetas (pagos, topes, metas)', 'Una sola línea. Roja solo si algo está vencido o pasado. Al tocarla, todo lo de hoy.')}
 ${li('Cupo disponible y Cupo total de una tarjeta', 'En la página de la tarjeta. En Inicio: lo que debes, una barra del cupo y cuándo pagar.')}
 ${li('Salió y Recibido en dos cuadros', 'Una línea bajo el saldo: Entró · Salió.')}
 ${li('Ingresos y transferencias mezclados con las categorías', 'Su propia sección, "Lo que entró y lo que moviste", una fila cada uno que se abre.')}
 ${li('Los tres botones del saldo', 'Solo el ojo. Editar la cuenta y su tarjeta o productos se abren desde el nombre de arriba.')}
 ${li('"Puedes gastar hoy" como bloque', 'Una fila; al tocarla, cómo se calcula.')}</div>
 <div class="sub" style="margin:12px 6px 0;font-size:12.8px">Y en "Personaliza tu vista" se sigue eligiendo qué bloques ver y en qué orden.</div>
 <div style="height:40px"></div></main>`;

export default S;
