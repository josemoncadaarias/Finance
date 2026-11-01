// Group 54 - "Puedes gastar hoy" for the ONE account chosen on top (Jose,
// 2026-11-01: on one account it showed the figure of all accounts). Proposed,
// not decided. All accounts stays as in 51. One account:
//   - an account money comes into (salary, a wallet fed by transfers): what
//     usually comes into IT a month (income and transfers it receives,
//     average of the 3 whole months before), less the savings share of its
//     income only, less what already left it this month (spending and
//     transfers to other accounts), less the fixed payments and installments
//     usually paid from it; over the days left - never more than it holds
//     today;
//   - an account nothing comes into every month (a savings pocket): no
//     figure per day, it says what it holds and why;
//   - a card: what is usually spent with it a month, less what was spent
//     this month, over the days left - never past its available credit,
//     which is the bank's money, not the person's.
// Figures invented; today is 1 November, 30 days left.
import { ic, C, tint, ci, chev, tabs, status, accIcon, ACC } from './lib.mjs';

const S = {};
const $ = v => `$&nbsp;${v}`;
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');

const header = (k, sub) => `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${accIcon(k, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">${ACC[k][2]}</b>${ic('chevron-down-outline', 'chev')}</div>
 <div class="one sub" style="font-size:12.5px">${sub}</div></div>${ci('sparkles-outline', C.blu, 40)}</div></div>`;
const hero = (lab, v) => `<div class="card hero" style="margin-top:12px"><div class="lab">${lab}</div><div class="big" style="margin-top:4px">${$(v)}</div></div>`;
const todayRow = (v, line, tone = 'g') => `<div class="row" style="background:${tone === 'r' ? tint(C.red, .12) : 'var(--s1)'};border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px;align-items:flex-start">${ci('sunny-outline', tone === 'r' ? C.red : C.yel, 34)}
 <div class="tx"><b style="font-weight:500">Puedes gastar hoy</b><small style="white-space:normal">${line}</small></div>${v ? `<b class="${tone}" style="font-size:16px;white-space:nowrap">${v}</b>` : ''}${chev()}</div>`;
const inicio = (k, sub, heroLab, heroV, row) => `${header(k, sub)}<main>${hero(heroLab, heroV)}${row}
 <div class="seg" style="margin:14px 0 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos</div></div>
 <div style="height:110px"></div></main>${tabs('Inicio')}`;
const line = (t, v, why = '', cls = '') => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${t}</b>${why ? `<small style="white-space:normal">${why}</small>` : ''}</div><b class="${cls}" style="white-space:nowrap">${v}</b></div>`;
const total = (t, v, cls = 'g') => `<div class="row" style="gap:10px;background:var(--s2)"><div class="tx"><b style="white-space:normal">${t}</b></div><b class="${cls}" style="font-size:17px;white-space:nowrap">${v}</b></div>`;
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.45">${t}</div>`;
const sheet = (title, body) => `<div class="scrim"></div><div class="sheet" style="top:60px;bottom:0;overflow:hidden"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 0">Cancelar</div><h2 style="text-align:center;margin:26px 0 12px;font-size:19px">${title}</h2>${body}</div>`;
const allNote = note(`${ic('layers-outline', '', 'width:14px;height:14px;vertical-align:-2px')} Elige <b>Todas las cuentas</b> arriba para ver lo que puedes gastar con todo tu dinero.`);

// 54a - a salary account: what comes in, what left, what is still to pay.
S['54a-cuenta-de-nomina'] = inicio('azul', 'Cuenta de ahorros', 'Saldo hoy', '6.140.000,00',
  todayRow($('118.000'), 'Desde Banco Azul, para cada día hasta el 30 de noviembre'));
S['54b-nomina-como-se-calcula'] = S['54a-cuenta-de-nomina'] + sheet('Cómo se calcula lo que puedes gastar desde Banco Azul', `<div class="list">
 ${line('Lo que le entra a Banco Azul en un mes normal', $('9.000.000'), 'Tu salario y lo que recibes en esta cuenta. Promedio de agosto, septiembre y octubre')}
 ${line('Para ahorrar: 20 % de tus ingresos', `−${$('1.800.000')}`, 'Solo de los ingresos que llegan a esta cuenta', 'p')}
 ${line('Ya salió de Banco Azul en noviembre', `−${$('2.950.000')}`, 'Gastos y transferencias a tus otras cuentas', 'r')}
 ${line('Pagos que sueles hacer desde Banco Azul', `−${$('710.000')}`, 'Arriendo, internet y la cuota del crédito', 'r')}
 ${total('Te queda para el resto del mes', $('3.540.000'))}
 ${line('Para gastar cada día, durante 30 días', $('118.000'), '', 'g')}</div>
 ${note('Banco Azul tiene hoy $&nbsp;6.140.000, así que alcanza para esto.')}${allNote}`);

// 54c - a wallet fed by transfers, holding less than the month would allow:
// the cap is what it holds.
S['54c-billetera-con-poco'] = inicio('naranja', 'Billetera', 'Saldo hoy', '380.000,00',
  todayRow($('12.600'), 'Desde Cajita Naranja: es lo que tiene hoy, repartido hasta el 30 de noviembre'));
S['54d-billetera-como-se-calcula'] = S['54c-billetera-con-poco'] + sheet('Cómo se calcula lo que puedes gastar desde Cajita Naranja', `<div class="list">
 ${line('Lo que le entra a Cajita Naranja en un mes normal', $('1.500.000'), 'Lo que le pasas desde tus otras cuentas. Promedio de agosto, septiembre y octubre')}
 ${line('Ya salió de Cajita Naranja en noviembre', `−${$('120.000')}`, '', 'r')}
 ${line('Pagos que sueles hacer desde Cajita Naranja', `−${$('64.000')}`, 'Música y películas', 'r')}
 ${line('Te quedaría para el resto del mes', $('1.316.000'), 'Pero Cajita Naranja tiene hoy solo $&nbsp;380.000')}
 ${total('Puedes usar lo que tiene hoy', $('380.000'))}
 ${line('Para gastar cada día, durante 30 días', $('12.600'), '', 'g')}</div>
 ${note('Si le pasas más dinero este mes, la app vuelve a calcular la cifra con lo que tenga.')}${allNote}`);

// 54e - a savings pocket nothing comes into every month: no figure per day.
S['54e-cuenta-de-ahorro'] = inicio('verde', 'Ahorro', 'Saldo hoy', '42.500.000,00',
  todayRow('', 'A Ahorro Verde no le entra dinero cada mes: la app la toma como una cuenta para guardar, no para gastar. Tiene $&nbsp;42.500.000.'));

// 54f - a card: what is usually spent with it, never its credit.
S['54f-tarjeta'] = inicio('coral', 'Tarjeta de crédito', 'Debes hoy', '812.120,00',
  todayRow($('29.300'), 'Con Tarjeta Coral, para cada día hasta el 30 de noviembre'));
S['54g-tarjeta-como-se-calcula'] = S['54f-tarjeta'] + sheet('Cómo se calcula lo que puedes gastar con Tarjeta Coral', `<div class="list">
 ${line('Lo que sueles gastar con Tarjeta Coral al mes', $('1.180.000'), 'Promedio de agosto, septiembre y octubre')}
 ${line('Ya gastaste con ella en noviembre', `−${$('301.000')}`, '', 'r')}
 ${total('Te queda para el resto del mes', $('879.000'))}
 ${line('Para gastar cada día, durante 30 días', $('29.300'), '', 'g')}</div>
 ${note('Sale de lo que sueles gastar con la tarjeta, no de tu cupo disponible ($&nbsp;5.687.880): el cupo es dinero del banco que después tienes que pagar.')}${allNote}`);

// 54h - what changes, by kind of account.
const li = (icon, c, t, s) => `<div class="row" style="gap:10px;align-items:flex-start">${ci(icon, c, 34)}<div class="tx"><b style="white-space:normal;font-weight:500">${t}</b><small style="white-space:normal">${s}</small></div></div>`;
S['54h-que-cambia'] = `${header('azul', 'Qué cambia en «Puedes gastar hoy»')}<main>
 <div class="list" style="margin-top:12px">
  ${li('layers-outline', C.blu, 'Todas las cuentas', 'Igual que ahora: lo que recibes en un mes normal, menos lo que separas para ahorrar, lo que ya gastaste y los pagos que faltan.')}
  ${li('wallet-outline', C.blu, 'Una cuenta a la que le entra dinero', 'Lo que le entra a esa cuenta cada mes, menos lo que ya salió de ella y los pagos que sueles hacer desde ella. Nunca más de lo que tiene hoy.')}
  ${li('leaf-outline', C.grn, 'Una cuenta de ahorro', 'Si no le entra dinero cada mes, no da una cifra por día: dice cuánto tiene y que es para guardar.')}
  ${li('card-outline', C.yel, 'Una tarjeta', 'Lo que sueles gastar con ella al mes, menos lo que ya gastaste. Nunca cuenta el cupo como dinero tuyo.')}</div>
 <div style="height:110px"></div></main>${tabs('Inicio')}`;

export default S;
