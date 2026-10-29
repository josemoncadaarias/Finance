// Group 49 v2 - a calmer Inicio (Jose, 2026-10-29: "demasiada info junta que
// hace perder al usuario ... minimalista, fácil y super claro de leer").
// Proposed, not decided. v2 after his review: the chart stays exactly as it
// is today (the ring and its list are screenshots of the app, not drawings),
// every figure the balance card has today stays (Entró, Salió, Recibido,
// Enviado, "movido entre tus cuentas", a card's credit), and the quick buttons
// stay where they are. What changes:
// - Pendientes is ONE line, red only when something is late or passed; its
//   rows open in a sheet;
// - the balance card's figures are two quiet lines instead of boxed tiles:
//   what came in and went out, and in blue what only moved between one's own
//   accounts - each only when it has something;
// - a card says its credit in one line under the bar;
// - "Puedes gastar hoy" is one row;
// - under the chart's list, what is not spending gets a heading of its own:
//   Ingresos, Devoluciones (a card), Entre tus cuentas.
import { readFileSync } from 'node:fs';
import { ic, C, PALETTE, tint, ci, chev, down, tabs, status, periodBar, catIcon, accIcon } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const $ = v => `$&nbsp;${v}`;
const shot = name => `data:image/png;base64,${readFileSync(new URL(`./assets/${name}.png`, import.meta.url)).toString('base64')}`;
const img = name => `<img src="${shot(name)}" style="display:block;width:100%;margin-top:12px">`;

const header = (icon, name, sub) => `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${icon}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">${name}</b>${down()}</div>
 <div class="one sub" style="font-size:12.5px">${sub}</div></div>${ci('sparkles-outline', C.blu, 40)}</div>
 ${periodBar('Octubre 2026')}</div>`;

// Pendientes: one line. Red when something is late or passed, quiet otherwise.
const pending = (text, bad = true) => `<div class="row" style="background:${bad ? tint(C.red, .12) : 'var(--s1)'};border-radius:16px;padding:11px 14px;gap:10px">
 <span style="width:9px;height:9px;border-radius:50%;background:${bad ? C.red : C.yel};flex:none"></span>
 <div class="tx"><b class="one" style="font-size:14.5px;font-weight:500;color:${bad ? '#ffb3b3' : 'var(--tx)'}">${text}</b></div>${chev()}</div>`;

// The quick buttons, exactly as today: the eye, then where the account leads
// (a card's or loan's page, an earning account's products), then editing it.
const round = (svg, solid = true) => `<span style="width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:${solid ? 'var(--pr)' : 'rgba(255,255,255,.08)'};color:#fff;flex:none">${svg}</span>`;
const EDIT = `<svg viewBox='0 0 512 512' width='19' height='19'><g fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round' stroke-linejoin='round'><rect x='32' y='96' width='336' height='224' rx='36'/><path d='M32 164h336'/><path d='M88 256h72'/><path d='M433 289l46 46-144 144-57 11 11-57z'/></g></svg>`;
const PIG = `<svg viewBox='60 78 400 400' width='20' height='20'><g fill='none' stroke='currentColor' stroke-width='25' stroke-linecap='round' stroke-linejoin='round'><ellipse cx='288' cy='280' rx='144' ry='112'/><rect x='88' y='248' width='56' height='64' rx='24'/><path d='M232 180l28-64 56 44'/><path d='M216 388v52M360 388v52'/></g><circle cx='212' cy='252' r='16' fill='currentColor'/></svg>`;
const quick = (...which) => `<span style="display:flex;gap:7px">${round(ic('eye-outline', '', 'width:18px;height:18px'), false)}${which.map(w => round(w === 'pig' ? PIG : w === 'bill' ? ic('receipt-outline', '', 'width:18px;height:18px') : EDIT)).join('')}</span>`;

// The figures under the balance: two quiet lines, each figure only when it
// has something (Entró and Salió always on "Todas").
const fig = (icon, cls, lab, v) => `<span style="white-space:nowrap">${ic(icon, cls, 'width:14px;height:14px;vertical-align:-2px')} ${lab} <b class="${cls}">${v}</b></span>`;
const lineOf = (...figs) => `<div class="sub" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px 16px;font-size:13.5px">${figs.join('')}</div>`;
const money = (a, b) => lineOf(fig('arrow-down', 'g', 'Entró', a), fig('arrow-up', 'r', 'Salió', b));
const moved = (a, b) => lineOf(...[a && fig('swap-horizontal', 'p', 'Recibido', a), b && fig('swap-horizontal', 'p', 'Enviado', b)].filter(Boolean));
const between = v => lineOf(fig('swap-horizontal', 'p', '', `${v}</b> <span>movido entre tus cuentas</span><b>`));
// The label and the buttons share the top line; the figure has the whole width under them.
const top = (lab, buttons) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div class="lab">${lab}</div>${buttons}</div>`;
const hero = (lab, big, extra, buttons, color = '') => `<div class="card hero" style="margin-top:12px">${top(lab, buttons)}<div class="big" style="margin-top:4px;${color}">${big}</div>${extra}</div>`;

// A card: the bar and its credit in one line; the day to pay under it.
const bar = (pct, line, over = false) => `<div style="height:7px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:10px"><i style="display:block;width:${Math.min(100, pct)}%;height:100%;border-radius:4px;background:${over ? C.red : C.yel}"></i></div>
 <div class="sub" style="margin-top:6px;font-size:13.5px">${line}</div>`;
const payLine = (t, late = false) => `<div class="row" style="background:${late ? tint(C.red, .16) : 'rgba(255,255,255,.06)'};border-radius:12px;margin-top:10px;padding:9px 12px;gap:8px">${ic('calendar-outline', late ? 'r' : 'p', 'width:18px;height:18px')}<div class="tx"><span style="font-size:13.8px;${late ? 'color:#ffb3b3' : ''}">${t}</span></div>${chev()}</div>`;

const today = `<div class="row" style="background:var(--s1);border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px">${ci('sunny-outline', C.yel, 34)}
 <div class="tx"><b style="font-weight:500">Puedes gastar hoy</b></div><b class="g" style="font-size:16px">${$('54.200')}</b>${chev()}</div>`;
const seg = `<div class="seg" style="margin:14px 0 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos</div></div>`;

// Under the chart's list: what is not spending, under a heading of its own.
const h = (t, right) => `<div style="display:flex;align-items:baseline;justify-content:space-between;margin:18px 4px 8px"><b style="font-size:15px">${t}</b><span class="sub" style="font-size:13.5px">${right}</span></div>`;
const row = (icon, title, sub, amt, cls) => `<div class="row" style="gap:10px">${icon}<div class="tx"><b class="one" style="font-weight:500">${title}</b><small>${sub}</small></div><div class="am ${cls}">${amt}</div></div>`;
const sw = ci('swap-horizontal', C.blu, 42);
const section = (title, total, cls, rows) => `${h(title, `<span class="${cls}">${total}</span>`)}<div class="list">${rows}</div>`;

const page = body => `<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// 49a - one account that earns: all four figures, the three buttons.
S['49a-inicio-una-cuenta'] = header(accIcon('azul', 40), 'Banco Azul', 'COP · 2 productos') + page(`
 ${pending('2 pagos por hacer · 3 topes pasados')}
 ${hero('Saldo hoy', $('14.825.725,43'), money('2.400.000', '1.726.100') + moved('500.000', '2.637.440'), quick('pig', 'edit'))}
 ${today}${seg}${img('ring-coral')}`);

// 49b - further down on the same account: the chart as today, then what is not spending.
S['49b-inicio-mas-abajo'] = header(accIcon('azul', 40), 'Banco Azul', 'COP · 2 productos') + `<main>${img('bars-coral')}
 ${section('Ingresos', '+2.400.000,00', 'g', row(catIcon('salario'), 'Salario', '1 movimiento', '+2.400.000,00', 'g'))}
 ${section('Entre tus cuentas', '2 movimientos', 'sub', row(sw, 'A Tarjeta Coral', '2 movimientos', '2.637.440,00', 'p') + row(sw, 'De Ahorro Verde', '1 movimiento', '+500.000,00', 'p'))}
 <div class="sub" style="margin:8px 6px 0;font-size:12.8px">No son gastos, por eso no están en el gráfico.</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// 49b2 - a card, further down: refunds lower its spending and say so; its payments are between accounts.
S['49b2-tarjeta-mas-abajo'] = header(accIcon('coral', 40), 'Tarjeta Coral', 'COP · tarjeta de crédito') + `<main>${img('bars-coral')}
 ${section('Devoluciones', '−48.900,00', 'g', row(catIcon('rest'), 'Restaurante', 'Te devolvieron 1 · ya está restado del gasto', '−48.900,00', 'g'))}
 ${section('Entre tus cuentas', '2 movimientos', 'sub', row(sw, 'De Banco Azul', '2 pagos a la tarjeta', '+2.637.440,00', 'p'))}
 <div class="sub" style="margin:8px 6px 0;font-size:12.8px">Pagar la tarjeta no es un gasto: el gasto fue cada compra.</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

// 49c - a card: what is owed, its credit in one line, when to pay; the receipt and the pencil.
S['49c-inicio-una-tarjeta'] = header(accIcon('coral', 40), 'Tarjeta Coral', 'COP · tarjeta de crédito') + page(`
 ${pending('1 pago por hacer', false)}
 ${hero('Debes hoy', $('1.035.660,00'), bar(14, `Usas el 14 % · te quedan <b class="g">${$('6.464.340')}</b> de ${$('7.500.000')}`) + payLine(`Paga ${$('1.035.660')} antes del 10 de nov`) + lineOf(fig('arrow-up', 'r', 'Salió', '1.726.100'), fig('swap-horizontal', 'p', 'Recibido', '2.637.440')), quick('bill', 'edit'), 'color:#f6c75a')}
 ${img('ring-coral')}`);

// 49d - the card states, each in the same short shape.
const mini = (lab, big, extra, color = '') => `<div class="card hero" style="margin-top:10px;padding:14px 16px">${top(lab, quick('bill', 'edit'))}<div class="big" style="font-size:28px;margin-top:2px;${color}">${big}</div>${extra}</div>`;
S['49d-tarjetas-en-cada-caso'] = `<div class="bar-top">${st}<div class="tt"><h1 style="font-size:21px">Una tarjeta, en cada caso</h1></div></div><main>
 ${mini('Debes hoy', $('567.200,00'), bar(23, `Usas el 23 % · te quedan <b class="g">${$('1.932.800')}</b> de ${$('2.500.000')}`) + payLine(`Venció el 28 de oct: faltan ${$('567.200')}`, true), 'color:#f6c75a')}
 ${mini('Debes hoy', $('1.070.000,00'), bar(107, `<span class="r">Te pasaste del cupo por ${$('70.000')}</span> · cupo ${$('1.000.000')}`, true), 'color:#f6c75a')}
 ${mini('Saldo a favor', $('260.000,00'), bar(0, `No usas nada · te quedan <b class="g">${$('3.260.000')}</b>`), 'color:var(--grn)')}
 ${mini('No debes nada', $('0,00'), bar(0, `Te quedan <b class="g">${$('2.000.000')}</b> de cupo`))}
 ${mini('Debes hoy', $('132.400,00'), `<div class="sub" style="margin-top:8px;font-size:13.5px">Sin cupo registrado · agrégalo con el lápiz</div>`, 'color:#f6c75a')}
 <div style="height:30px"></div></main>`;

// 49e - every account: net worth, what came in and went out, what moved between them.
S['49e-inicio-todas'] = header(ci('layers-outline', C.blu, 40), 'Todas las cuentas', '21 cuentas, todas incluidas') + page(`
 ${pending('4 pagos por hacer · 3 topes pasados')}
 ${hero('Patrimonio hoy', $('78.498.326,47'), money('2.400.000', '1.893.300') + between('2.637.440'), quick())}
 ${today}${seg}${img('ring-todas')}`);

// 49f - Pendientes opened: every row, as today, in a sheet.
const prow = (icon, title, sub, amt, cls = '') => `<div class="row" style="gap:10px">${icon}<div class="tx"><b class="one" style="font-weight:500">${title}</b><small style="white-space:normal">${sub}</small></div>${amt ? `<div class="am ${cls}">${amt}</div>` : ''}${chev()}</div>`;
S['49f-pendientes-abiertos'] = S['49a-inicio-una-cuenta'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 4px">Cancelar</div><h2 style="text-align:center;margin:0 0 10px;font-size:19px">Pendientes</h2>
 <div class="lab" style="margin:8px 4px">Pagos por hacer</div><div class="list">
 ${prow(ci('card-outline', PALETTE.coral, 36), 'Tarjeta Índigo', '<span class="r">Venció el 28 de oct</span>', '567.200', 'r')}
 ${prow(ci('car-sport-outline', C.cya, 36), 'Crédito vehículo', 'Vence el 5 de nov', '1.180.000')}</div>
 <div class="lab" style="margin:14px 4px 8px">Topes pasados</div><div class="list">
 ${prow(catIcon('rest', 36), 'Restaurantes', '<span class="r">Te pasaste por 106.200</span>', '')}
 ${prow(catIcon('mercado', 36), 'Mercado', '<span class="r">Te pasaste por 76.300</span>', '')}</div>
 <div class="lab" style="margin:14px 4px 8px">Metas y recordatorios</div><div class="list">
 ${prow(ci('flag-outline', C.blu, 36), 'Viaje a la costa', 'Vas atrasado: te faltan 400.000 este mes', '')}
 ${prow(ci('alarm-outline', '#f2709c', 36), 'Pagar el arriendo', 'Mañana a las 8:00', '')}</div></div>`;

// 49g - what changes, and what stays.
const li = (from, to) => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${from}</b><small style="white-space:normal">${to}</small></div></div>`;
S['49g-que-cambia'] = `<div class="bar-top">${st}<div class="tt"><h1 style="font-size:21px">Qué cambia en Inicio</h1></div></div><main>
 <div class="h" style="margin-top:4px">Cambia</div><div class="list">
 ${li('Pendientes con sus etiquetas', 'Una sola línea. Roja solo si algo está vencido o pasado. Al tocarla, todo lo pendiente.')}
 ${li('Entró, Salió, Recibido y Enviado en cuatro cuadros', 'Las mismas cifras en dos líneas: lo que entró y salió, y en azul lo que solo se movió entre tus cuentas. Cada una aparece solo si tiene algo.')}
 ${li('Cupo disponible y Cupo total en dos columnas', 'Una línea bajo la barra: "Usas el 14 % · te quedan X de Y". Pasado el cupo, en rojo.')}
 ${li('Ingresos y transferencias seguidos de las categorías', 'Cada uno con su título: Ingresos, Devoluciones (en una tarjeta) y Entre tus cuentas, con su total.')}
 ${li('"Puedes gastar hoy" como bloque', 'Una fila; al tocarla, cómo se calcula.')}</div>
 <div class="h">Se queda igual</div><div class="list">
 ${li('El gráfico y su lista de categorías', 'Tal cual están hoy.')}
 ${li('Los botones rápidos', 'El ojo, la tarjeta o el préstamo, los productos y rendimientos, y editar la cuenta, en el mismo lugar.')}
 ${li('Personaliza tu vista', 'Se sigue eligiendo qué bloques ver y en qué orden.')}</div>
 <div style="height:40px"></div></main>`;

export default S;
