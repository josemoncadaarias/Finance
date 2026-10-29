// Group 47 - an account's products and interest, made simple (Jose,
// 2026-10-29, four screenshots of Banco Índigo: "confusas o enredadas y con
// mucha info que hace perder al usuario"). Proposed, not decided:
// - two tabs instead of four: Productos | Intereses. Pagos and Días showed
//   the same rows; Intereses is one row per DAY with what every product paid
//   together, and the detail of each product opens on tap;
// - one figure on top, what reached the person: "Este mes te han pagado";
//   the withholding is said once, small;
// - Movimientos leaves the page: one row opens Inicio on this account;
// - "Dejar de calcular" and "Recalcular" go behind the "···";
// - no floating arrows over figures: one small "Arriba" once scrolled.
// Names and figures invented.
import { ic, C, PALETTE, tint, ci, sq, chev, down, tabs, status } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 10) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}</div>`;
const note = t => `<div class="sub" style="margin:10px 6px 0;font-size:12.8px;line-height:1.4">${t}</div>`;

const head = (name = 'Banco Índigo', color = PALETTE.violeta, icon = 'business-outline') => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}
 <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">${ci(icon, color, 34)}<b class="one" style="font-size:18px">${name}</b>${down()}</div>
 <div class="btn-r">${ic('ellipsis-horizontal')}</div></div></div>`;

// The figure on top: what reached the person this month, and what today earns.
const hero = (paid, line2, line3 = 'Ya sin la retención en la fuente (impuesto que el banco descuenta).', extra = '', lab = 'Este mes te han pagado') => `<div class="card hero">
 <div class="lab">${lab}</div><div class="big g">${paid}</div>
 <div style="font-size:14.5px;margin-top:6px">${line2}</div>
 ${line3 ? `<div class="sub" style="margin-top:6px">${line3}</div>` : ''}${extra}</div>`;
const twoTabs = on => `<div class="seg" style="margin:12px 0">${['Productos', 'Intereses'].map(t => `<div class="${t === on ? 'on' : ''}">${t}</div>`).join('')}</div>`;
const page = (h, top, on, body, opts = {}) => `${h}<main>${top}${twoTabs(on)}${body}<div style="height:120px"></div></main><div class="fade"></div>${opts.after ?? ''}${tabs('Cuentas')}`;

const P = { cuenta: ['wallet-outline', C.grn], renta: ['home-outline', C.grn], cdt: ['lock-closed-outline', C.gold ?? C.yel], viaje: ['airplane-outline', C.cya] };
const psq = (k, z = 42) => sq(P[k][0], P[k][1], z);

// A product: its name whole, its balance, and ONE line saying what it does.
const prod = (k, name, line, amt, line2 = '') => `<div class="row" style="align-items:flex-start">${psq(k)}<div class="tx"><b style="white-space:normal">${name}</b><small>${line}</small>${line2 ? `<small>${line2}</small>` : ''}</div><div class="am" style="margin-top:2px">${amt}</div>${chev()}</div>`;
const products = `<div class="list">
 ${prod('cuenta', 'Ahorros', '8,5 % al año · gana unos $&nbsp;2.500 al día', '12.064.078,32', 'Es tu producto habitual')}
 ${prod('cdt', 'CDT 12 meses', 'Paga al vencer, el 2 de marzo de 2027', '15.000.000,00')}
 ${prod('renta', 'Para el impuesto de renta', '9 % al año · gana unos $&nbsp;530 al día', '2.434.267,11', 'No cuenta en tu patrimonio')}
 <div class="row" style="background:var(--s2)"><div class="tx"><b>Entre todos</b><small>Lo que tienen hoy los 3 productos</small></div><div class="am" style="font-weight:700">29.498.345,43</div></div></div>
 <div class="list" style="margin-top:12px"><div class="row">${ci('add', C.blu, 38)}<div class="tx"><b class="p">Agregar un producto</b><small>Un bolsillo, una alcancía o un CDT</small></div></div>
 <div class="row">${ci('list-outline', C.blu, 38)}<div class="tx"><b>Ver los movimientos de esta cuenta</b><small>Se abren en Inicio</small></div>${chev()}</div></div>`;

const indigoHero = hero('$&nbsp;87.955,38', 'Hoy estás ganando unos <b>$&nbsp;3.040</b> al día');

// 47a - Productos.
S['47a-productos'] = page(head(), indigoHero, 'Productos', products);

// 47b - the "···": what is rarely needed, in plain words.
const menuRow = (icon, color, t, s, cls = '') => `<div class="row">${ci(icon, color, 38)}<div class="tx"><b class="${cls}">${t}</b>${s ? `<small style="white-space:normal">${s}</small>` : ''}</div></div>`;
S['47b-menu'] = S['47a-productos'] + sheet(`<h2 style="text-align:center;font-size:18px;margin-bottom:12px">Banco Índigo</h2><div class="list">
 ${menuRow('stats-chart-outline', C.blu, 'Resumen de intereses', 'Cuánto te pagaron por mes y contra la inflación')}
 ${menuRow('create-outline', C.blu, 'Editar la cuenta', '')}
 ${menuRow('refresh-outline', C.blu, 'Volver a calcular los intereses', 'Si cambiaste un movimiento de días pasados')}
 ${menuRow('pause-circle-outline', C.red, 'Dejar de calcular esta cuenta', 'Lo ya calculado se conserva', 'r')}</div><div style="height:6px"></div>`);

// Intereses: a month on top, then one row per day with all its products together.
const monthCard = (m, paid, ret, open = true) => `<div class="row" style="background:var(--s2)"><div class="tx"><b>${m}</b><small>${ret}</small></div><div class="am g" style="font-weight:700">${paid}</div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>`;
const day = (d, n, amt, icon = ci('calendar-clear-outline', C.grn, 38)) => `<div class="row">${icon}<div class="tx"><b>${d}</b><small>${n}</small></div><div class="am g">${amt}</div>${chev()}</div>`;
const indigoDays = `<div class="list">${monthCard('Octubre 2026', '+87.955,38', 'Te pagaron · ya sin $&nbsp;6.620,31 de retención')}
 ${day('Jueves 29', 'Entre tus 2 productos', '+3.041,86')}
 ${day('Miércoles 28', 'Entre tus 2 productos', '+3.041,22')}
 ${day('Martes 27', 'Entre tus 2 productos', '+3.040,59')}
 ${day('Lunes 26', 'Entre tus 2 productos', '+3.039,95')}
 ${day('Domingo 25', 'Entre tus 2 productos', '+3.039,31')}</div>
 <div class="list" style="margin-top:10px">${monthCard('Septiembre 2026', '+84.210,07', 'Te pagaron · ya sin $&nbsp;6.338,12 de retención', false)}</div>`;
const upBtn = `<div style="position:absolute;left:50%;transform:translateX(-50%);bottom:118px;z-index:6;display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:18px;background:var(--s3);color:var(--tx);font-size:13.5px;box-shadow:0 4px 14px rgba(0,0,0,.4)">${ic('arrow-up', '', 'width:16px;height:16px')}Arriba</div>`;

// 47c - Intereses.
S['47c-intereses'] = page(head(), indigoHero, 'Intereses', indigoDays + note('Toca un día para ver cuánto pagó cada producto y la retención.'));

// 47d - one day opened: each product, what it earned, the withholding, what arrived.
const line = (k, v, cls = '') => `<div class="row plain"><div class="tx"><span class="mu" style="font-size:14px">${k}</span></div><b class="${cls}" style="font-weight:500">${v}</b></div>`;
const prodBlock = (k, name, rate, base, gross, ret, net) => `<div class="list" style="margin-top:10px">
 <div class="row">${psq(k, 34)}<div class="tx"><b>${name}</b><small>${rate} sobre $ ${base}</small></div></div>
 ${line('Ganó', gross)}${line('Retención en la fuente', ret, 'r')}${line('Te llegó', net, 'g')}</div>`;
S['47d-un-dia'] = S['47c-intereses'] + sheet(`<h2 style="text-align:center;font-size:19px">Jueves 29 de octubre</h2>
 <div class="sub" style="text-align:center;margin-top:4px">Te llegaron <b class="g">$&nbsp;3.041,86</b> entre los dos productos</div>
 ${prodBlock('cuenta', 'Ahorros', '8,5 % al año', '12.061.570,91', '2.696,14', '−188,73', '2.507,41')}
 ${prodBlock('renta', 'Para el impuesto de renta', '9 % al año', '2.433.732,00', '574,68', '−40,23', '534,45')}
 <div class="btn ghost" style="margin-top:12px">El banco pagó otra cifra</div><div style="height:4px"></div>`);

// 47e - a monthly payment and a spending bonus: what is still on its way, said apart.
const naranja = head('Cajita Naranja', PALETTE.mandarina, 'cube-outline');
const pending = (icon, color, t, s, amt, cls = 'mu') => `<div class="row" style="align-items:flex-start">${ci(icon, color, 38)}<div class="tx"><b style="white-space:normal">${t}</b><small style="white-space:normal">${s}</small></div><div class="am ${cls}" style="margin-top:2px">${amt}</div></div>`;
S['47e-pago-mensual'] = page(naranja, hero('≈ $&nbsp;50.320', 'Este banco paga una vez al mes: te llega el <b>1 de noviembre</b>', 'Más la bonificación, si gastas lo que pide.', '', 'Llevas ganado en octubre'), 'Intereses', `
 <div class="h">Llega el 1 de noviembre</div><div class="list">
 ${pending('hourglass-outline', C.yel, 'Lo que va de octubre', '29 días · unos $&nbsp;1.735 al día', '≈ 50.320,00')}
 ${pending('gift-outline', C.yel, 'Bonificación de octubre', 'La ganas si gastas $&nbsp;400.000 este mes con esta cuenta. Llevas $&nbsp;250.000: te faltan $&nbsp;150.000.', 'si la ganas<br>≈ 55.300,00')}</div>
 <div class="list" style="margin-top:14px">${monthCard('Septiembre 2026', '+104.880,40', 'Te pagaron el 1 de octubre · con bonificación', false)}</div>
 ${note('Es un cálculo de la app: la cifra final la dice el banco el día que paga.')}`);

// 47f - a bonus not reached, said plainly, and a month already paid opened.
S['47f-bonificacion-no-ganada'] = page(naranja, hero('$&nbsp;49.880,12', 'Te pagaron el 1 de octubre lo de septiembre', ''), 'Intereses', `
 <div class="list">${monthCard('Septiembre 2026', '+49.880,12', 'Te pagaron el 1 de octubre')}
 ${pending('checkmark-circle-outline', C.grn, 'Intereses de septiembre', '5 % al año, todos los días', '+49.880,12', 'g')}
 ${pending('close-circle-outline', C.gry ?? '#8e9ab2', 'Bonificación de septiembre: no la ganaste', 'Gastaste $&nbsp;310.000 y pedía $&nbsp;400.000.', '0,00')}</div>`);

// 47g - a CDT: nothing day by day; its payment is one row, on its day.
const cdtHead = head('Banco del Parque', PALETTE.violeta, 'business-outline');
S['47g-cdt'] = page(cdtHead, hero('≈ $&nbsp;412.000', 'Tu CDT paga una sola vez: te llega el <b>2 de marzo de 2027</b>', 'Ese día te lo pagan ya sin la retención.', '', 'Tu CDT lleva ganado'), 'Intereses', `
 <div class="h">Llega el 2 de marzo de 2027</div><div class="list">
 ${pending('lock-closed-outline', C.yel, 'Pago del CDT 12 meses', 'Lo que pagará en total · 9,8 % al año sobre $&nbsp;15.000.000', '≈ 1.367.700,00')}</div>
 ${note('Un CDT no paga cada día. Cuando llegue la fecha, el pago aparece aquí y en tu saldo.')}`);

// 47h - no interest yet: an icon, one sentence, what to expect.
S['47h-sin-intereses-aun'] = page(head('Bolsillo Nuevo', C.cya, 'wallet-outline'), `<div class="card hero"><b style="font-size:18px">Todavía no te han pagado intereses</b><div style="font-size:14.5px;margin-top:6px">El primero llega <b>mañana</b>.</div></div>`, 'Intereses', `
 <div class="card" style="text-align:center;padding:24px 16px">${centred(ci('sunny-outline', C.yel, 56))}<b style="font-size:16px">Todavía no hay intereses</b>
 <div class="sub" style="margin-top:6px">Los intereses de hoy se pagan mañana sobre lo que tengas al cerrar el día.</div></div>`);

// 47i - no withholding (each day earns less than the minimum): nothing about it is said.
S['47i-sin-retencion'] = page(head('Cuenta Pequeña', C.grn, 'wallet-outline'), hero('$&nbsp;9.420,55', 'Hoy estás ganando unos <b>$&nbsp;325</b> al día', 'Sin retención: lo que ganas cada día está por debajo del mínimo en que se cobra.'), 'Intereses', `
 <div class="list">${monthCard('Octubre 2026', '+9.420,55', 'Te pagaron · sin retención')}
 ${day('Jueves 29', 'Ahorros', '+325,12')}${day('Miércoles 28', 'Ahorros', '+325,05')}${day('Martes 27', 'Ahorros', '+324,98')}</div>`);

// 47j - a long list scrolled: the arrows that covered figures are gone; one small "Arriba".
S['47j-lista-larga'] = `<div style="position:absolute;left:0;right:0;top:90px;bottom:0;overflow:hidden"><main style="margin-top:-330px">${indigoHero}${twoTabs('Intereses')}${indigoDays}
 <div class="list" style="margin-top:10px">${monthCard('Agosto 2026', '+86.004,51', 'Te pagaron · ya sin $&nbsp;6.473,44 de retención', false)}</div><div style="height:120px"></div></main></div><div style="position:absolute;left:0;right:0;top:0">${head()}</div><div class="fade"></div>${upBtn}${tabs('Cuentas')}`;

// 47k - working out today's interest: said in the figure, never a blank.
S['47k-calculando'] = page(head(), `<div class="card hero"><div class="lab">Este mes te han pagado</div><div class="big g">$&nbsp;84.913,52</div>
 <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:14px">${ic('sync-outline', 'p', 'width:18px;height:18px')}Calculando los intereses de hoy…</div></div>`, 'Productos', products);

// 47l - the products of an account with only one: no total row, nothing to compare.
S['47l-un-producto'] = page(head('Cuenta Pequeña', C.grn, 'wallet-outline'), hero('$&nbsp;9.420,55', 'Hoy estás ganando unos <b>$&nbsp;325</b> al día', ''), 'Productos', `<div class="list">
 ${prod('cuenta', 'Ahorros', '9 % al año · gana unos $&nbsp;325 al día', '1.380.220,40', 'Es tu producto habitual')}</div>
 <div class="list" style="margin-top:12px"><div class="row">${ci('add', C.blu, 38)}<div class="tx"><b class="p">Agregar un producto</b><small>Un bolsillo, una alcancía o un CDT</small></div></div>
 <div class="row">${ci('list-outline', C.blu, 38)}<div class="tx"><b>Ver los movimientos de esta cuenta</b><small>Se abren en Inicio</small></div>${chev()}</div></div>`);

export default S;
