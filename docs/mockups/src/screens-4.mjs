// Group 4 (v4, 2026-09-28): products and yields. Everything the products
// screen does today (features/products), drawn with the rules of groups 1-3:
// - reached from the Cuentas tab ("Cuentas | Rendimientos") and from the
//   piggy bank beside one account in Inicio;
// - an account's page is ONE scroll, as today: the figure, its products,
//   its movements, what the bank pays, how each day was worked out, and
//   stopping it - no tabs, and no Gasto / Ingreso / Transferir of its own:
//   the "+" of the bar opens the one movement form on this account;
// - rates live inside their product; a rate of the whole account shows in
//   each product that uses it, marked as the account's;
// - the orphan withdrawal is said quietly, inside its row.
import { ic, ci, sq, C, CAT, ACC, PALETTE, catIcon, accIcon, chev, down, tag, sw, top, tabs, status, tint } from './lib.mjs';
import { typeSeg, amount, keys, prod, end, dayRow, note } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const scrolled = (header, topPx, by, body, after = '') => `<div style="position:absolute;left:0;right:0;top:${topPx}px;bottom:0;overflow:hidden"><main style="margin-top:-${by}px">${body}</main></div><div style="position:absolute;left:0;right:0;top:0">${header}</div>${after}`;
const amber = t => `<div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>${t}</span></div>`;
const PIG = `<svg viewBox='60 78 400 400' width='22' height='22'><g fill='none' stroke='currentColor' stroke-width='25' stroke-linecap='round' stroke-linejoin='round'><ellipse cx='288' cy='280' rx='144' ry='112'/><rect x='88' y='248' width='56' height='64' rx='24'/><path d='M232 180l28-64 56 44'/><path d='M216 388v52M360 388v52'/><path d='M300 192h68'/></g><circle cx='212' cy='252' r='16' fill='currentColor'/></svg>`;

// ---------------------------------------------------------------- the list
// Cuentas has two faces: the balances (group 2) and what the accounts earn.
const faces = on => `<div class="seg" style="margin-top:2px">${['Cuentas', 'Rendimientos'].map(t => `<div class="${t === on ? 'on' : ''}">${t}</div>`).join('')}</div>`;
const listHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="btn-r">${ic('refresh-outline')}</div></div><div style="margin-top:10px">${faces('Rendimientos')}</div></div>`;

const line = (icon, name, sub, amt, today) => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small></div><div class="am">${amt}<small class="${today.startsWith('+') ? 'g' : 'mu'}">${today}</small></div>${chev()}</div>`;

S['4a-rendimientos'] = `${listHead}<main>
 <div class="card hero"><div class="lab">Rendimiento acumulado</div><div class="big g">1.284.310,55 <span style="font-size:14px;font-weight:500" class="mu">COP</span></div>
  <div class="sub">Rendimientos y cashback que todavía no son parte de tu patrimonio.</div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:10px"><span class="sub">Rindió el 27 sept:</span><b class="g">+14.188,72</b></div>
  <div style="margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('stats-chart-outline')}Resumen de rendimientos</span></div></div>
 ${amber('3 días sin retefuente calculada: faltan parámetros por confirmar.')}
 <div class="h">En pesos</div>
 <div class="list">
  ${line(accIcon('verde'), 'Ahorro Verde', '3 productos', '924.118,20', '+12.453,40')}
  ${line(accIcon('naranja'), 'Cajita Naranja', '2 productos · con condición mensual', '301.440,10', '+1.735,32')}
  ${line(ci('business-outline', PALETTE.violeta), 'Banco del Parque: CDT de la prima de diciembre', '1 producto · CDT', '52.700,00', 'vence el 12 dic')}
  ${line(accIcon('azul'), 'Banco Azul', '1 producto · pausada', '0,00', '—')}</div>
 <div class="h">En otras monedas</div>
 <div class="list">${line(accIcon('dolar'), 'Cuenta Dólar', 'USD · sin retefuente', '6,05 USD', '+0,01')}</div>
 <div class="list" style="margin-top:12px"><div class="row">${ci('add', C.blu, 40)}<div class="tx"><b class="p">Agregar una cuenta</b><small>Solo las cuentas que agregues aquí generan rendimientos. Las que se mueven con el mercado no deberían estar.</small></div></div></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

S['4b-agregar-cuenta'] = S['4a-rendimientos'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh" style="flex-direction:column;align-items:stretch;gap:4px"><h2 style="text-align:center">Agregar una cuenta</h2><div class="sub" style="text-align:center">Se calcula desde que la agregues, con su saldo y su tasa.</div></div>
 <div class="list">${['efectivo', 'global', 'ambar'].map(k => `<div class="row">${accIcon(k)}<div class="tx"><b>${ACC[k][2]}</b></div>${chev()}</div>`).join('')}</div></div>`;

// ---------------------------------------------------------- one account
// A page inside Cuentas, so the bar and its "+" stay: the "+" opens the one
// movement form on this account. The title switches account (whole row).
const pageHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}
 <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">${accIcon('verde', 34)}<b class="one" style="font-size:18px">Ahorro Verde</b>${down()}</div></div></div>`;

const figure = `<div class="card hero"><div class="lab">Rendimiento disponible</div><div class="big g">924.118,20</div>
  <div class="mini" style="margin-top:10px"><div><span class="lab">Rendido</span><b>1.101.906,03</b></div><div><span class="lab">Pasado al patrimonio</span><b>−177.787,83</b></div></div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px"><span class="sub">Rinde sobre</span><b>55.240.546,90</b></div>
  <div class="sub" style="margin-top:4px">Lo que el banco pagó hoy es sobre 55.226.495,33, el saldo con que cerró ayer. Lo de hoy se paga mañana.</div>
  <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('stats-chart-outline')}Resumen de rendimientos</span><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('list-outline')}Ver sus movimientos en Inicio</span></div></div>`;

const prodRow = (i, c, name, sub, amt, extra = '') => `<div class="row">${sq(i, c)}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small>${extra}</div><div class="am">${amt}</div>${chev()}</div>`;
const products = `<div class="h">Productos<span class="p">+ Agregar un producto</span></div>
 <div class="list">
  ${prodRow('wallet-outline', C.grn, 'Cuenta de ahorros', 'El habitual · 9,25 % E.A.', '52.000.000,00')}
  ${prodRow('basket-outline', C.lim, 'Bolsillo Mercado', '9,25 % E.A. de la cuenta', '1.240.546,90')}
  ${prodRow('airplane-outline', C.cya, 'Bolsillo Viajes', '11,00 % E.A. · sin retefuente', '2.000.000,00')}
  ${prodRow('lock-closed-outline', C.gold, 'CDT 90 días', 'CDT · vence el 12 dic · Fuera del patrimonio', '10.000.000,00')}
  <div class="row" style="background:var(--s2)"><div class="tx"><b>Entre todos los productos</b><small>De este saldo, 924.118,20 son rendimientos que pagó el banco</small></div><div class="am" style="font-weight:700">65.240.546,90</div></div></div>
 <div class="hint">El banco paga cada producto aparte y lo muestra aparte.</div>`;

S['4c-cuenta'] = `${pageHead}<main>${figure}${products}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// Scrolled: its movements, with the same three views, period and search as
// Inicio, and the orphan withdrawal said quietly in its row.
const move = (icon, t, s, a, cls = '') => `<div class="row">${icon}<div class="tx"><b class="one">${t}</b><small class="one">${s}</small></div><div class="am ${cls}">${a}</div></div>`;
const movements = `<div class="h">Movimientos</div>
 <div style="display:flex;gap:8px;align-items:center"><div class="chip on">Por fecha</div><div class="chip">Por categoría</div><div class="chip">Más grandes</div></div>
 <div style="display:flex;gap:8px;align-items:center;margin-top:10px"><span class="chip">${ic('calendar-outline', '', 'width:17px;height:17px')}Septiembre ${down()}</span><div class="search" style="flex:1;margin:0">${ic('search-outline')}<span class="one">Buscar en septiembre…</span></div></div>
 <div class="h">Hoy · domingo 27</div>
 <div class="list">${move(ci('swap-horizontal', C.blu, 42), 'Retiro bolsillo viajes', 'Bolsillo Viajes → Cuenta de ahorros', '500.000,00', 'p')}
  ${move(catIcon('cashback'), 'Cashback de septiembre', 'Cashback · Cuenta de ahorros · solo el producto', '+18.400,00', 'g')}</div>
 <div class="h">Martes 15</div>
 <div class="list">${move(catIcon('mercado'), 'Mercado quincena', 'Mercado · Bolsillo Mercado', '−164.200,00', 'r')}
  <div class="row">${sq('remove-outline', C.gry)}<div class="tx"><b class="one">Retiro de 50.000,00</b><small>Quedó sin el movimiento de la cuenta que lo acompañaba, y sigue restándole al producto.</small><span class="p" style="font-size:13.5px;display:block;margin-top:4px">Borrar retiro</span></div><div class="am mu">−50.000,00</div></div></div>`;

S['4d-cuenta-movimientos'] = scrolled(pageHead, 88, 590, `<div style="height:12px"></div>${figure}${products}${movements}<div style="height:110px"></div>`, `<div class="fade"></div>${tabs('Cuentas')}`);

// Further down: what the bank pays, month by month (to compare with the
// bank's app), how each day was worked out, and stopping the account.
const month = (t, n, a, open) => `<div class="row" style="background:var(--s2)"><div class="tx"><b>${t}</b><small>${n}</small></div><div class="am g">${a}</div>${ic(open ? 'chevron-down-outline' : 'chevron-forward-outline', 'mu', 'width:18px;height:18px')}</div>`;
const day = (d, base, net, extra = '') => `<div class="row"><div class="tx"><b>${d}</b><small class="one">Sobre ${base} · 9,25 % E.A.${extra}</small></div><div class="am g">${net}</div>${chev()}</div>`;
const paysAndDays = `<div class="h">Lo que paga el banco</div>
 <div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><span class="chip">${ic('funnel-outline', '', 'width:17px;height:17px')}Todos los productos ${down()}</span><span class="chip">${ic('chevron-expand-outline', '', 'width:17px;height:17px')}Abrir todos</span></div>
 <div class="list" style="margin-top:10px">${month('Septiembre 2026', '27 pagos', '+342.118,44', false)}${month('Agosto 2026', '31 pagos', '+381.004,10', false)}</div>
 <div class="hint">Lo que el banco realmente abona: la lista para comparar contra la app del banco.</div>
 <div class="h">Cómo se calculó, día a día</div>
 <div class="list">${month('Septiembre 2026', '27 días', '+342.118,44', true)}
  ${day('Domingo 27', '55.226.495,33', '+12.453,40')}
  ${day('Sábado 26', '55.214.042,00', '+12.450,58', ' · corregido a mano')}
  ${day('Viernes 25', '55.201.591,40', '+12.447,77')}</div>
 <div class="hint">El detalle de dónde sale cada pago. Toca un día para verlo y corregirlo.</div>
 <div class="list" style="margin-top:14px"><div class="row">${ic('pause-circle-outline', 'r')}<div class="tx"><b class="r">Dejar de calcular esta cuenta</b></div></div></div>`;

S['4e-cuenta-pagos-y-dias'] = scrolled(pageHead, 88, 1350, `<div style="height:12px"></div>${figure}${products}${movements}${paysAndDays}<div style="height:110px"></div>`, `<div class="fade"></div>${tabs('Cuentas')}`);

// One day, and correcting it.
const dayLine = (k, v, cls = '') => `<div class="row"><div class="tx"><span class="mu" style="font-size:14px">${k}</span></div><b class="${cls}">${v}</b></div>`;
S['4f-un-dia'] = S['4e-cuenta-pagos-y-dias'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <h2 style="text-align:center;font-size:19px">Sábado 26 sept · Cuenta de ahorros</h2><div class="sub" style="text-align:center;margin:4px 0 12px">Así se llegó a la cifra de ese día. Si el banco pagó otra cosa, escríbela abajo.</div>
 <div class="list">${dayLine('Base del día', '52.000.000,00')}${dayLine('Tasa aplicada', '9,25 % E.A.')}${dayLine('Rendimiento bruto', '12.605,40')}${dayLine('Retefuente (7 %)', '−882,38', 'r')}${dayLine('Neto', '11.723,02', 'g')}</div>
 <div class="field on" style="margin-top:12px"><div class="lab">Lo que realmente pagó el banco</div><div class="v">11.725,80</div></div>
 <div class="hint">Este día está corregido a mano: el cálculo automático ya no lo toca.</div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Volver al cálculo</div><div class="btn danger" style="flex:1">Borrar esta ganancia</div></div></div>`;

S['4g-dia-en-cero'] = S['4e-cuenta-pagos-y-dias'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('remove-circle-outline', C.red, 54))}<b style="font-size:18px">¿El banco no pagó nada ese día?</b>
 <div class="sub" style="margin-top:6px">El día queda en cero y no se vuelve a calcular. Puedes deshacerlo después.</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Sí, dejarlo en cero</div></div></div>`;

S['4h-dejar-de-calcular'] = S['4e-cuenta-pagos-y-dias'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('pause-circle-outline', C.red, 54))}<b style="font-size:18px">Dejar de calcular esta cuenta</b>
 <div class="sub" style="margin-top:6px">¿Seguro? La cuenta deja de calcular rendimientos. Lo ya calculado se conserva y puedes volver a activarla cuando quieras.</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Sí, dejar de calcular</div></div></div>`;

// ------------------------------------------------------------- a product
// The product form: who it is, its balance as the bank states it, and -
// further down - its rates, which live here and nowhere else.
const saveBar = t => `<div class="bar-top">${st}<div class="tt">${ic('chevron-back-outline', 'back')}<h1 class="one" style="flex:1;min-width:0">${t}</h1><div class="chip" style="padding:7px 14px;background:linear-gradient(135deg,var(--pr),var(--pr2));border:0;color:#fff;font-weight:500">${ic('checkmark', '', 'width:18px;height:18px')}Guardar</div></div></div>`;
const val = (k, v, extra = '', sub = '') => `<div class="row"><div class="tx"><span class="k">${k}</span><b class="one">${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>${extra}</div>`;
const toggle = (t, h, on) => `<div class="row"><div class="tx"><b>${t}</b>${h ? `<small>${h}</small>` : ''}</div>${sw(on)}</div>`;
const kindPick = cdt => `<div class="seg" style="margin-top:12px"><div class="${cdt ? '' : 'on'}">Alto rendimiento</div><div class="${cdt ? 'on' : ''}">CDT</div></div>`;
const faceP = (icon, name) => `<div style="display:flex;align-items:center;gap:14px"><div style="position:relative;flex:none">${icon}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center;color:#fff">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field" style="flex:1;min-width:0"><div class="lab">Nombre</div><div class="v one">${name}</div></div></div>`;

const productTop = `<div style="height:12px"></div>${faceP(sq('airplane-outline', C.cya, 60), 'Bolsillo Viajes')}${kindPick(false)}
 <div class="list" style="margin-top:12px">
  ${toggle('Le aplica retefuente', 'En alta rentabilidad solo se retiene el 7 % el día que el interés llega a 0,055 UVT', false)}
  ${toggle('Cuenta para el patrimonio', '', true)}
  ${toggle('Que sea el habitual', 'A este entra y de este sale la plata mientras no digas otra cosa.', false)}</div>
 <div class="h">Su saldo</div>
 <div class="list">
  ${val('Saldo que muestra el banco', '2.000.000,00', '<span class="mu" style="font-size:13px">COP</span>', 'Tal como lo ves en la app del banco. Ese saldo ya trae adentro los rendimientos que te han pagado.')}
  ${val('Este saldo cuenta desde', 'Jueves 10 sept 2026', down())}
  ${val('Movido desde esa fecha', '0,00')}
  ${val('Rendimientos, ingresos y gastos desde entonces', '+9.841,20')}
  ${val('Tiene hoy', '2.009.841,20')}
  ${val('Rinde desde', 'Jueves 10 sept 2026', down(), 'Desde este día la app calcula lo que rinde este producto. Antes de él no calcula nada, aunque la tasa sea más antigua.')}</div>`;

const rate = (pct, when, state, cls, extra = '') => `<div class="row"><div class="tx"><b>${pct}</b><small>${when}</small>${extra}</div><span class="tag" style="background:${tint(cls, .16)};color:${cls}">${state}</span>${chev()}</div>`;
const productRates = `<div class="h">Tasa</div>
 <div class="list">
  ${val('¿Cada cuánto paga el banco?', 'Todos los días', down())}
  ${rate('11,00 % E.A.', 'Desde el 1 sept 2026', 'Vigente', C.grn)}
  ${rate('10,50 % E.A.', 'Del 10 jul al 31 ago 2026', 'Ya no aplica', C.gry)}
  <div class="row">${ic('add', 'p', 'width:19px;height:19px')}<div class="tx"><b class="p" style="font-size:14.5px">Cambiar la tasa desde una fecha</b></div></div></div>
 <div class="hint">Una tasa nueva no borra la anterior: manda la más reciente hasta su fecha.</div>
 <div class="h">Bonificación por gasto</div>
 <div class="list">${rate('+5,50 % E.A.', 'si gastas 400.000 en el mes · desde el 1 sept', 'Vigente', C.grn)}
  <div class="row">${ic('add', 'p', 'width:19px;height:19px')}<div class="tx"><b class="p" style="font-size:14.5px">Agregar bonificación por gasto</b></div></div></div>
 <div class="hint">Una tasa extra que el banco paga solo si gastas cierto monto con esta cuenta. Si no llegas al monto, no se paga.</div>
 <div class="list" style="margin-top:14px"><div class="row">${ic('trash-outline', 'r')}<div class="tx"><b class="r">Eliminar este producto</b></div></div></div>`;

S['4i-producto'] = `${saveBar('Bolsillo Viajes')}<main>${productTop}<div style="height:30px"></div></main>`;
S['4j-producto-tasas'] = scrolled(saveBar('Bolsillo Viajes'), 88, 640, `${productTop}${productRates}<div style="height:30px"></div>`);

// A product that uses the account's rate: the rate is shown here, marked as
// the account's, and changing it here gives THIS product its own.
S['4k-producto-tasa-de-la-cuenta'] = scrolled(saveBar('Bolsillo Mercado'), 88, 640, `${productTop.replace('airplane-outline', 'basket-outline').replace(C.cya, C.lim).replace('Bolsillo Viajes', 'Bolsillo Mercado')}
 <div class="h">Tasa</div>
 <div class="list">${val('¿Cada cuánto paga el banco?', 'Todos los días', down())}
  ${rate('9,25 % E.A.', 'Desde el 1 ago 2026 · de la cuenta: la usan los productos sin tasa propia', 'Vigente', C.grn)}
  <div class="row">${ic('add', 'p', 'width:19px;height:19px')}<div class="tx"><b class="p" style="font-size:14.5px">Darle una tasa propia desde una fecha</b></div></div></div>
 <div class="list" style="margin-top:14px"><div class="row">${ic('trash-outline', 'r')}<div class="tx"><b class="r">Eliminar este producto</b></div></div></div><div style="height:30px"></div>`);

// Changing the rate from a date (or fixing a mistyped one).
S['4l-nueva-tasa'] = S['4j-producto-tasas'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <h2 style="text-align:center;font-size:19px;margin-bottom:12px">Cambiar la tasa desde una fecha</h2>
 <div class="field on"><div class="lab">Tasa efectiva anual, % E.A.</div><div class="v">11,75</div></div>
 <div style="display:flex;gap:10px;margin-top:10px"><div class="field" style="flex:1"><div class="lab">Válida desde</div><div class="v">1 oct 2026</div></div><div class="field" style="flex:1"><div class="lab">Hasta</div><div class="v mu">Sin fecha</div></div></div>
 <div class="hint">Si la tasa quedó mal escrita, ábrela y corrígela: se recalculan los días desde su fecha. Si CAMBIÓ, agrega una nueva desde el día en que cambió.</div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Guardar</div></div></div>`;

S['4m-bonificacion'] = S['4j-producto-tasas'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <h2 style="text-align:center;font-size:19px;margin-bottom:12px">Agregar bonificación por gasto</h2>
 <div class="field on"><div class="lab">Tasa extra, % E.A.</div><div class="v">5,50</div></div>
 <div class="field" style="margin-top:10px"><div class="lab">Gasto mínimo con esta cuenta</div><div class="v">400.000,00</div></div>
 <div style="display:flex;gap:10px;margin-top:10px"><div class="field" style="flex:1"><div class="lab">Cada cuántos meses</div><div class="v">1</div></div><div class="field" style="flex:1"><div class="lab">Válida desde</div><div class="v">1 oct 2026</div></div></div>
 <div class="hint">Se suman los gastos de esta cuenta en ese período. Si llegan al mínimo, la bonificación se paga el último día del período; si no, no se paga.</div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Guardar</div></div></div>`;

// A CDT: it does not earn day by day; it pays its whole term on maturity,
// with 7 % withheld, and closes itself into the product and category chosen.
S['4n-cdt'] = `${saveBar('CDT 90 días')}<main><div style="height:12px"></div>
 ${faceP(sq('lock-closed-outline', C.gold, 60), 'CDT 90 días')}${kindPick(true)}
 <div class="hint">Un CDT no rinde día a día: el día que vence paga todo su plazo de una vez, con el 7 % retenido, y se cierra solo.</div>
 <div class="list" style="margin-top:12px">
  ${val('Monto', '10.000.000,00', '<span class="mu" style="font-size:13px">COP</span>')}
  ${val('Abierto el', 'Domingo 13 sept 2026', down())}
  <div class="row"><div class="tx"><span class="k">Plazo</span><b>90 días</b></div><div class="tx" style="flex:none;text-align:right"><span class="k">Tasa</span><b>10,40 % E.A.</b></div></div>
  ${val('Vence el', 'Sábado 12 dic 2026')}</div>
 <div class="list" style="margin-top:12px">
  ${val('Rendimiento bruto', '245.312,11')}${val('Retenido', '−17.171,85')}${val('Neto', '+228.140,26')}
  <div class="row" style="background:var(--s2)"><div class="tx"><span class="k">Recibes al vencer</span><b style="font-size:17px">10.228.140,26</b></div></div></div>
 <div class="list" style="margin-top:12px">${val('Pasa a', 'Cuenta de ahorros', down())}${val('Con la categoría', 'Rendimientos', down())}</div>
 <div class="hint">Ese día el CDT se cierra solo: el monto y el rendimiento neto pasan a Cuenta de ahorros.</div>
 <div class="list" style="margin-top:12px">${toggle('Cuenta para el patrimonio', '', false)}</div>
 <div style="height:30px"></div></main>`;

// A new product: where its balance comes from.
S['4o-nuevo-producto'] = `${saveBar('Agregar un producto')}<main><div style="height:12px"></div>
 ${faceP(sq('cube-outline', C.org, 60), 'Bolsillo Carro').replace('class="field"', 'class="field on"')}${kindPick(false)}
 <div class="h">¿De dónde sale este saldo?</div>
 <div class="list">
  <div class="row" style="border:1px solid var(--pr);border-radius:18px 18px 0 0">${ci('swap-horizontal', C.blu, 36)}<div class="tx"><b>De otro producto</b><small>Se registra una transferencia desde ese producto: su saldo baja en lo mismo y queda en los movimientos.</small></div><span class="tick on">${ic('checkmark')}</span></div>
  <div class="row">${ci('create-outline', C.gry, 36)}<div class="tx"><b>Lo escribo a mano</b><small>El saldo queda tal cual lo escribes, sin sacar plata de otro producto. Úsalo para un ajuste.</small></div><span class="tick"></span></div></div>
 <div class="list" style="margin-top:12px">${val('Sale de', 'Cuenta de ahorros', down())}${val('Monto', '1.500.000,00', '<span class="chip" style="padding:4px 10px;font-size:12.5px">Pasar todo · 52.000.000</span>')}${val('Rinde desde', 'Mañana · lunes 28 sept', down())}</div>
 <div class="h">Tasa</div>
 <div class="list"><div class="row"><div class="tx"><b>9,25 % E.A. de la cuenta</b><small>La usa mientras no le des una propia</small></div></div></div>
 <div style="height:30px"></div></main>`;

// Deleting a product: its balance and history go to another one.
S['4p-eliminar-producto'] = S['4j-producto-tasas'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(sq('trash-outline', C.red, 54))}<b style="font-size:18px">¿Eliminar Bolsillo Viajes?</b>
 <div class="sub" style="margin-top:6px">Este producto tiene 2.009.841,20. ¿A qué producto pasa ese saldo?</div>
 <div class="list" style="margin-top:12px;text-align:left">${val('Pasar el saldo a', 'Cuenta de ahorros', down())}</div>
 <div class="sub" style="margin-top:8px;text-align:left">Su saldo pasa a Cuenta de ahorros como un movimiento, junto con sus movimientos y lo que ha ganado. El saldo inicial de Cuenta de ahorros no se toca.</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Eliminar</div></div></div>`;

// ------------------------------------------------- a product's own movement
// The ONE movement form (group 1): Ingreso on an account with products shows
// the product, and asks what it changes - the four answers the product's own
// form gives today.
const scope = on => `<div class="h">¿Qué cambia?</div><div class="list">${[['Solo el producto', 'Solo cambia los rendimientos del producto, no el saldo de la cuenta ni tu patrimonio.'], ['Producto y patrimonio', 'Queda como un movimiento normal de la cuenta, con su categoría y su producto.'], ['Hacer efectivo', 'Pasas a la cuenta plata que el producto ya tenía: sube el saldo y tu patrimonio, y baja lo acumulado del producto.']]
  .map(([t, h]) => `<div class="row" style="padding:9px 14px"><span class="tick ${t === on ? 'on' : ''}">${t === on ? ic('checkmark') : ''}</span><div class="tx"><b style="font-size:14.5px">${t}</b>${t === on ? `<small>${h}</small>` : ''}</div></div>`).join('')}</div>`;
S['4q-ingreso-del-producto'] = `${top('Nuevo ingreso', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Ingreso')}
 ${amount('+', 'g', '18.400')}
 <div class="list">${end(accIcon('verde', 38), 'Hacia dónde', 'Ahorro Verde', prod('wallet-outline', C.grn, 'Cuenta de ahorros'))}
  <div class="row">${catIcon('cashback', 38)}<div class="tx"><span class="k">Categoría</span><b>Cashback</b></div><span class="mu">${ic('create-outline', '', 'width:19px;height:19px')}</span>${down()}</div></div>
 ${scope('Solo el producto')}
 <div class="list" style="margin-top:10px">${dayRow}${note('Cashback de septiembre')}</div>
 </main><div class="save">Guardar</div>`;

export default S;
