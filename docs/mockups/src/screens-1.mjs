// Group 1 (v5, 2026-09-28; v4 the same day): Inicio, the "+" sheet, and the ONE movement form
// with every way it is used. Corrected after Jose's review of v3:
// - long names stay on one line (ellipsis, then the slide the app already has);
// - nothing that does not serve (no "idea nueva" labels);
// - space saved the way the app saves it today: the category is ONE button;
// - one form, one style, for spending, income, a transfer between accounts and
//   a move between products, each with its note;
// - writing a note lifts the note to the top and hides the rest, with the
//   suggestions under it and the phone's keyboard below.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, status, M, donut, tint, jump } from './lib.mjs';

const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const LONG = 'Tarjeta de crédito Rappi Visa Platinum';

// The header: the name takes the whole width, on one line; when it does not
// fit it ends in "…" and slides once to show itself (marquee.service.ts).
// v5: no eye (Jose: little use), so the name has the row to itself.
const header = ({ acc = null, sliding = false } = {}) => {
  const icon = acc ? accIcon(acc === 'long' ? 'coral' : acc, 40) : ci('layers-outline', C.blu, 40);
  const name = acc ? (acc === 'long' ? LONG : ACC[acc][2]) : 'Todas las cuentas';
  const sub = acc === 'long' || acc === 'coral' ? 'COP · tarjeta de crédito' : acc === 'verde' ? 'COP · 3 productos' : acc ? 'COP' : '7 cuentas, todas incluidas';
  return `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${icon}
  <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px;${sliding ? 'text-overflow:clip' : ''}">${sliding ? `<span style="display:inline-block;transform:translateX(-96px)">${name}</span>` : name}</b>${down()}</div>
   <div class="one sub" style="font-size:12.5px">${sub}</div></div></div>
 <div class="month">${ic('chevron-back-outline')}<span>Septiembre 2026</span>${ic('chevron-forward-outline')}</div></div>`;
};

// What came in and went out, and, apart and in blue, what only moved between
// the person's own accounts - as the app does today (Movido / Recibido): a
// transfer is neither earned nor spent, so it never joins income or spending,
// but it is always on show. Across all accounts it nets to nothing, and the
// line says how much moved rather than hiding it.
const fig = (lab, v, cls = '', icon = '') => `<div><span class="lab">${icon}${lab}</span><b class="${cls}">${v}</b></div>`;
const moved = (a, b) => `<div class="mini" style="margin-top:8px">${fig('Recibido', a, 'p', `${ic('swap-horizontal', '', 'width:13px;height:13px;vertical-align:-2px;margin-right:4px')}`)}${fig('Enviado', b, 'p', `${ic('swap-horizontal', '', 'width:13px;height:13px;vertical-align:-2px;margin-right:4px')}`)}</div>`;
const figures = `<div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55</div>
  <div class="mini" style="margin-top:12px">${fig('Entró', '8.450.000,00', 'g')}${fig('Salió', '5.236.418,00', 'r')}</div>
  <div class="sub" style="margin-top:9px;display:flex;align-items:center;gap:6px">${ic('swap-horizontal', 'p', 'width:17px;height:17px')}<span class="one">3.400.000,00 movido entre tus cuentas</span></div></div>`;

// The donut keeps its size whatever the month holds: the legend beside it is
// the five largest and "Otras N", names cut with "…", percentages in a column
// of their own. Every category, with its figure, is the list right below.
const chart = `<div class="card" style="display:flex;align-items:center;gap:16px">
  <div style="position:relative;flex:none">${donut([[27, C.org], [17, C.grn], [15, C.red], [10, C.cya], [8, C.yel], [23, C.gry]], 124)}
   <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="lab" style="font-size:10.5px">Gastaste</div><b style="font-size:14px">5,24 M</b></div></div></div>
  <div style="flex:1;min-width:0">${[['vivienda', 'Vivienda y arriendo del apartamento', '27'], ['mercado', 'Mercado', '17'], ['rest', 'Restaurantes', '15'], ['transp', 'Transporte', '10'], ['servicios', 'Servicios', '8']].map(([k, t, p]) => `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:13.5px">${catIcon(k, 24)}<span class="one" style="flex:1">${t}</span><span class="mu" style="width:34px;text-align:right;font-variant-numeric:tabular-nums">${p}%</span></div>`).join('')}
   <div style="display:flex;align-items:center;gap:8px;margin:3px 0;font-size:13.5px"><span style="width:24px;height:24px;border-radius:8px;background:var(--s3);display:grid;place-items:center;font-size:11px" class="mu">+7</span><span class="one mu" style="flex:1">Otras 7</span><span class="mu" style="width:34px;text-align:right">23%</span></div></div></div>`;

const line = (k, title, sub, amt, cls) => `<div class="row">${catIcon(k)}<div class="tx"><b>${title}</b><small class="one">${sub}</small></div><div class="am ${cls}">${amt}</div></div>`;
// A transfer in the list: the swap in blue, where it came from or went to, and
// the product on the side that has them.
const xfer = (title, sub, amt) => `<div class="row">${ci('swap-horizontal', C.blu, 42)}<div class="tx"><b class="one">${title}</b><small class="one">${sub}</small></div><div class="am p">${amt}</div></div>`;

const S = {};

S['1a-inicio'] = `${header()}<main>${figures}
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 ${chart}
 <div class="list" style="margin-top:12px">${line('salario', 'Salario', '1 movimiento', '+8.450.000,00', 'g')}${line('vivienda', 'Vivienda y arriendo del apartamento', '27 % · 2 movimientos', '1.400.000,00', '')}</div>
 </main><div class="fade"></div>${tabs('Inicio')}`;

// One account that earns: the two quick buttons beside its balance, as today -
// edit the account, and its products and yields (the piggy bank).
// The app's own two drawings (core/icons/account-edit.ts, piggy-bank.ts).
const EDIT = `<svg viewBox='0 0 512 512' width='21' height='21'><g fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round' stroke-linejoin='round'><rect x='32' y='96' width='336' height='224' rx='36'/><path d='M32 164h336'/><path d='M88 256h72'/><path d='M433 289l46 46-144 144-57 11 11-57z'/><path d='M405 318l45 45'/></g></svg>`;
const PIG = `<svg viewBox='60 78 400 400' width='22' height='22'><g fill='none' stroke='currentColor' stroke-width='25' stroke-linecap='round' stroke-linejoin='round'><ellipse cx='288' cy='280' rx='144' ry='112'/><rect x='88' y='248' width='56' height='64' rx='24'/><path d='M232 180l28-64 56 44'/><path d='M216 388v52M360 388v52'/><path d='M300 192h68'/></g><circle cx='212' cy='252' r='16' fill='currentColor'/></svg>`;
const roundBtn = svg => `<span style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--pr);color:#fff;flex:none">${svg}</span>`;
const quick = earns => `<div style="display:flex;gap:8px">${roundBtn(EDIT)}${earns ? roundBtn(PIG) : ''}</div>`;
S['1b-inicio-cuenta-con-productos'] = `${header({ acc: 'verde' })}<main>
 <div class="card hero"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1;min-width:0"><div class="lab">Saldo hoy</div><div class="big">55.240.546,90</div></div>${quick(true)}</div>
  <div class="mini" style="margin-top:12px">${fig('Entró', '412.380,15', 'g')}${fig('Salió', '1.164.200,00', 'r')}</div>${moved('2.000.000,00', '800.000,00')}</div>
 <div class="seg" style="margin:12px 0"><div>${ic('pie-chart-outline')}Gráfico</div><div class="on">${ic('list-outline')}Movimientos · 14</div></div>
 <div class="h">Hoy · domingo 27<span class="p" style="letter-spacing:0">800.000,00</span></div>
 <div class="list">${xfer('Pago tarjeta de crédito', 'Cuenta de ahorros → Tarjeta Coral', '−800.000,00')}</div>
 <div class="h">Viernes 25</div>
 <div class="list">${xfer('Retiro bolsillo viajes', 'Bolsillo Viajes → Cuenta de ahorros', '2.000.000,00')}${line('mercado', 'Mercado quincena', 'Mercado · Bolsillo Mercado', '−164.200,00', 'r')}${xfer('Nómina a ahorro', 'Banco Azul → Cuenta de ahorros', '+2.000.000,00')}</div>
 </main><div class="fade"></div>${tabs('Inicio')}`;

// One account with a long name: one line, "…", and the slide (second frame).
// A card that earns nothing: only the edit button.
const oneCard = sliding => `${header({ acc: 'long', sliding })}<main>
 <div class="card hero"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1"><div class="lab">Debes hoy</div><div class="big y">−4.127.100,00</div></div>${quick(false)}</div>
  <div class="sub">Disponible 3.872.900 de 8.000.000</div><div class="pbar" style="margin-top:8px"><i style="width:52%;background:var(--yel)"></i></div>
  <div class="mini" style="margin-top:12px">${fig('Salió', '4.560.400,00', 'r')}${fig('Recibido', '4.318.500,00', 'p', `${ic('swap-horizontal', '', 'width:13px;height:13px;vertical-align:-2px;margin-right:4px')}`)}</div></div>
 <div class="seg" style="margin:12px 0"><div>${ic('pie-chart-outline')}Gráfico</div><div class="on">${ic('list-outline')}Movimientos · 32</div></div>
 <div class="search">${ic('search-outline')}<span class="one">Buscar en septiembre: nota, categoría o cuenta…</span></div>
 <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><div class="chip on">Por día</div><div class="chip">Por categoría</div><div class="chip">Más grandes</div></div>
 <div class="h">Hoy · domingo 27<span class="r" style="letter-spacing:0">−32.000,00</span></div>
 <div class="list">${line('rest', 'Almuerzo con el equipo de trabajo en el centro', 'Restaurantes', '−32.000,00', 'r')}${xfer('Pago tarjeta de crédito', 'Desde Ahorro Verde · Cuenta de ahorros', '+800.000,00')}</div>
 <div class="h">Viernes 25<span class="r" style="letter-spacing:0">−181.600,00</span></div>
 <div class="list">${line('mercado', 'Mercado quincena', 'Mercado', '−164.200,00', 'r')}${line('transp', 'Taxi', 'Transporte · corregido a mano', '−17.400,00', 'r')}</div>
 </main><div class="fade"></div>${tabs('Inicio')}`;
S['1c-inicio-una-cuenta-nombre-largo'] = oneCard(false);
S['1d-inicio-nombre-largo-deslizando'] = oneCard(true);

// The "+" : the one way to create. Gasto, Ingreso, Transferir; the form itself
// switches between them. A move between products is a transfer whose two ends
// are products of the same account. Importing a statement lives here too.
S['1e-boton-mas'] = S['1a-inicio'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="display:flex;gap:10px">${[['arrow-up', C.red, 'Gasto'], ['arrow-down', C.grn, 'Ingreso'], ['swap-horizontal', C.blu, 'Transferir']]
  .map(([i, c, t]) => `<div style="flex:1;background:var(--s2);border-radius:20px;padding:16px 6px;text-align:center">${ci(i, c, 50).replace('display:grid', 'display:grid;margin:0 auto 9px')}<b style="font-size:15.5px">${t}</b></div>`).join('')}</div>
 <div class="list" style="margin-top:10px;background:var(--s2)"><div class="row">${ci('document-text-outline', C.pur, 38)}<div class="tx"><b>Importar extracto PDF</b></div>${chev()}</div></div></div>`;

// The form. Same frame for every kind: type, amount, the rows, the note, keys.
const typeSeg = on => `<div class="seg">${[['arrow-up', 'Gasto', 'red'], ['arrow-down', 'Ingreso', 'grn'], ['swap-horizontal', 'Transferir', 'blu']].map(([i, t, c]) => `<div class="${on === t ? 'on ' + c : ''}">${ic(i)}${t}</div>`).join('')}</div>`;
const amount = (sign, cls, v, cur = 'COP') => `<div class="amount" style="padding:10px 0 4px"><span class="${cls}" style="font-size:28px;vertical-align:8px">${sign}</span><span class="v" style="font-size:42px">${v}</span><span class="cur">${cur}</span>
  <span style="position:absolute;right:2px;top:24px;color:#7c89a6">${ic('backspace-outline')}</span></div>`;
const keys = label => `<div class="kp">${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', ',', '0', '=', '+'].map(k => `<div class="${'÷×−+='.includes(k) ? 'op' : ''}">${k}</div>`).join('')}
  <div style="grid-column:span 4" class="ok">${label}</div></div>`;
// A row that is one button: small label over the value, the whole row taps.
const pick = (icon, label, value, extra = '') => `<div class="row">${icon}<div class="tx"><span class="k">${label}</span><b>${value}</b></div>${extra}${down()}</div>`;
const productChip = (i, c, t) => `<div class="chip i" style="padding:4px 9px 4px 4px;font-size:12.8px;max-width:150px">${sq(i, c, 24)}<span class="one">${t}</span>${down()}</div>`;
const note = (text, hint = 'la de siempre') => `<div class="row">${ic('create-outline', 'mu')}<div class="tx"><span class="k">Nota</span><b class="one">${text}</b>${hint ? `<small>${hint}</small>` : ''}</div><span class="mu">${ic('close-circle', '', 'width:19px;height:19px')}</span></div>`;
const dayRow = `<div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Hoy · domingo 27 sept</b></div><div class="chip" style="padding:5px 11px">Ayer</div></div>`;

// Each end of a movement: its account and, when the account has products,
// the product under it, changeable right there (the same row everywhere).
// v6 (Jose): one end of a movement is its account on one line and, under
// it, its product on another - each with its own icon at the same size, the
// account in a circle and the product in a rounded square, so the two are
// never read as one. No box around the product, no label line of its own.
const infoDot = `<span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--s3);color:#aab6d3;flex:none">${ic('information', '', 'width:13px;height:13px')}</span>`;
// v7 (Jose: it read as two accounts): the product hangs from its account -
// a line comes down from the account's circle and turns into the product,
// which is indented, smaller and lighter. One account, and inside it, one
// product.
const prod = (i, c, t, info = false, bad = false) => `<div style="display:flex;align-items:center;gap:8px;margin-top:3px;padding-left:13px;padding-right:34px">
  <span style="width:13px;height:19px;border-left:2px solid #3a4b73;border-bottom:2px solid #3a4b73;border-bottom-left-radius:9px;margin-top:-15px;flex:none"></span>
  ${sq(i, bad ? '#ff6b6b' : c, 24)}<span class="one" style="font-size:14px;color:${bad ? 'var(--red)' : '#b9c3d8'}">${t}</span>${info ? infoDot : ''}</div>`;
const SHORT = { 'Desde dónde': 'Desde', 'Hacia dónde': 'Hacia' };
const small = icon => icon.replace(/width:\d+px;height:\d+px/, 'width:28px;height:28px');
const end = (icon, k, name, product = '', slide = '') => `<div class="row" style="gap:10px;padding:10px 14px"><span class="mu" style="width:42px;flex:none;font-size:12.5px">${SHORT[k] ?? k}</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:9px">${small(icon)}<b class="one" style="font-weight:500;font-size:15.3px;${slide ? 'text-overflow:clip' : ''}">${slide ? `<span style="display:inline-block;transform:translateX(${slide}px)">${name}</span>` : name}</b></div>${product}</div>${down()}</div>`;

S['1f-gasto'] = `${top('Nuevo gasto', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${amount('−', 'r', '164.200')}
 <div class="list">
  ${end(accIcon('verde', 38), 'Desde dónde', 'Ahorro Verde', prod('basket-outline', C.lim, 'Bolsillo Mercado'))}
  <div class="row">${catIcon('mercado', 38)}<div class="tx"><span class="k">Categoría</span><b>Mercado</b></div><span class="mu">${ic('create-outline', '', 'width:19px;height:19px')}</span>${down()}</div>
  ${dayRow}
  ${note('Mercado quincena')}</div>
 </main>${keys('Guardar')}`;

S['1g-escribiendo-nota'] = `${top('Nuevo gasto', { left: 'x' })}<main style="padding-top:10px">
 <div class="card" style="padding:12px 14px;border-color:var(--pr)"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lab">Nota</span><span class="p b" style="font-size:14px">Listo</span></div>
  <div style="font-size:17px;margin-top:6px">Mercado qu<span style="border-left:2px solid var(--pr);margin-left:1px"></span></div></div>
 <div class="list" style="margin-top:8px">${['Mercado quincena', 'Mercado quincena D1', 'Mercado quincena y aseo'].map(t => `<div class="row plain">${ic('time-outline', 'mu', 'width:18px;height:18px')}<div class="tx"><b style="font-size:14.5px">${t.replace('Mercado qu', '<u>Mercado qu</u>')}</b></div>${ic('arrow-up-outline', 'mu', 'transform:rotate(-45deg);width:18px;height:18px')}</div>`).join('')}</div>
 <div class="hint">El resto del formulario se esconde mientras escribes; vuelve con "Listo".</div></main>
 <div style="position:absolute;left:0;right:0;bottom:0;height:300px;background:#1b1f27;padding:8px 4px 20px">
  ${['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'].map((r, n) => `<div style="display:flex;justify-content:center;gap:5px;margin-top:9px;padding:0 ${n === 2 ? 34 : 0}px">${[...r].map(k => `<span style="width:34px;height:46px;border-radius:7px;background:#2e333d;display:grid;place-items:center;font-size:19px;color:#e6e8ee">${k}</span>`).join('')}</div>`).join('')}
  <div style="display:flex;gap:5px;margin-top:9px;padding:0 6px"><span style="width:60px;height:46px;border-radius:7px;background:#3a404c"></span><span style="flex:1;height:46px;border-radius:7px;background:#2e333d"></span><span style="width:60px;height:46px;border-radius:7px;background:#3a404c"></span></div></div>`;

// Transfer between accounts and move between products: the SAME frame.
// v5: "Invertir" is one round icon sitting on the line between the two ends -
// no label, no row of its own. "Pasar todo" with its figure sits under the
// amount it fills. Each end names its account and, when the account has
// products, the product under it, changeable right there.
const allBtn = v => `<div style="text-align:center;margin:-2px 0 10px"><span class="chip" style="padding:5px 12px;font-size:12.8px">Pasar todo · ${v}</span></div>`;
const route = (from, to) => `<div class="list" style="overflow:visible">${from}<div style="position:relative;height:1px;background:var(--line);margin-left:14px">
  <span style="position:absolute;right:48px;top:-19px;width:38px;height:38px;border-radius:50%;background:var(--s3);border:1px solid #2c3d63;color:var(--pr);display:grid;place-items:center;z-index:2">${ic('swap-vertical-outline', '', 'width:20px;height:20px')}</span></div>${to}</div>`;

S['1h-transferencia'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', '800.000')}${allBtn('52.000.000')}
 ${route(end(accIcon('verde', 38), 'Desde', 'Ahorro Verde', prod('wallet-outline', C.grn, 'Cuenta de ahorros')), end(accIcon('coral', 38), 'Hacia dónde', LONG))}
 <div class="list" style="margin-top:10px">${dayRow}${note('Pago tarjeta de crédito')}</div>
 </main>${keys('Guardar')}`;

S['1i-transferencia-entre-productos'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', '2.000.000')}${allBtn('2.000.000')}
 ${route(end(accIcon('verde', 38), 'Desde', 'Ahorro Verde', prod('airplane-outline', C.cya, 'Bolsillo Viajes')), end(accIcon('verde', 38), 'Hacia dónde', 'Ahorro Verde', prod('wallet-outline', C.grn, 'Cuenta de ahorros')))}
 <div class="list" style="margin-top:10px">${dayRow}${note('Retiro bolsillo viajes')}</div>
 </main>${keys('Guardar')}`;

S['1j-transferencia-dos-monedas'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 <div style="display:flex;gap:8px;align-items:center;margin:10px 0 8px">
  <div class="card" style="flex:1;text-align:center;padding:9px;border-color:var(--pr)"><div class="lab">Sale</div><div style="font-size:23px;font-weight:700;margin-top:2px">1.000.000</div><div class="mu" style="font-size:12px">COP</div></div>
  <span class="p">${ic('arrow-forward-outline')}</span>
  <div class="card" style="flex:1;text-align:center;padding:9px"><div class="lab">Llega</div><div style="font-size:23px;font-weight:700;margin-top:2px">254,12</div><div class="mu" style="font-size:12px">USD · tasa 3.935,15</div></div></div>
 ${allBtn('12.480.300')}
 ${route(end(accIcon('azul', 38), 'Desde', 'Banco Azul'), end(accIcon('dolar', 38), 'Hacia dónde', 'Cuenta Dólar'))}
 <div class="list" style="margin-top:10px">${dayRow}${note('Ahorro en dólares')}</div>
 </main>${keys('Guardar')}`;

// The pickers, as today: Cancelar, a heading said for the occasion, the two
// orders, one list, the current one ticked and the list opened on it.
S['1k-elegir-cuenta'] = S['1f-gasto'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div class="sh"><span class="p">Cancelar</span><h2 style="text-align:center">Desde dónde</h2><span style="width:62px"></span></div>
 <div class="seg" style="margin-bottom:10px"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="list">${[['verde', '55.240.546,90', true], ['long', 'Disponible 3.872.900'], ['azul', '12.480.300,00'], ['efectivo', '180.000,00'], ['naranja', '501.714,50'], ['dolar', '87,34 USD']]
   .map(([k, s, on]) => `<div class="row">${accIcon(k === 'long' ? 'coral' : k)}<div class="tx"><b>${k === 'long' ? LONG : ACC[k][2]}</b><small>${s}</small></div>${on ? tick(true) : ''}</div>`).join('')}</div></div>`;

S['1l-elegir-producto'] = S['1f-gasto'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>Productos de Ahorro Verde</h2></div>
 <div class="list">
  <div class="row">${sq('wallet-outline', C.grn)}<div class="tx"><b>Cuenta de ahorros</b><small>El habitual · 52.000.000,00</small></div></div>
  <div class="row">${sq('basket-outline', C.lim)}<div class="tx"><b>Bolsillo Mercado</b><small>1.240.546,90</small></div>${tick(true)}</div>
  <div class="row">${sq('airplane-outline', C.cya)}<div class="tx"><b>Bolsillo Viajes</b><small>2.000.000,00</small></div></div>
  <div class="row">${ci('swap-horizontal', C.blu, 42)}<div class="tx"><b class="p">Escoger otra cuenta</b></div>${chev()}</div></div></div>`;

S['1m-elegir-categoria'] = S['1f-gasto'] + `<div class="scrim"></div><div class="sheet" style="top:110px"><div class="grab"></div>
 <div class="sh"><span class="p">Cancelar</span><h2 style="text-align:center">Escoge una categoría</h2><span class="p">${ic('add')}</span></div>
 <div class="search">${ic('search-outline')}Buscar categoría</div>
 <div class="seg" style="margin:10px 0"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="list">${[['mercado', '96 veces', true], ['rest', '112 veces'], ['transp', '81 veces'], ['servicios', '36 veces'], ['vivienda', '12 veces'], ['salud', '9 veces'], ['ropa', 'sin usar']]
   .map(([k, t, on]) => `<div class="row">${catIcon(k)}<div class="tx"><b>${CAT[k][2]}</b><small>${t}</small></div>${on ? tick(true) : ''}</div>`).join('')}</div></div>`;

S['1n-editar-y-borrar'] = `${top('Editar movimiento', { left: 'x', right: `<div class="btn-r" style="color:var(--red)">${ic('trash-outline')}</div>` })}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${amount('−', 'r', '17.400')}
 <div class="list">${pick(accIcon('coral', 38), 'Desde dónde', 'Tarjeta Coral')}
  <div class="row">${catIcon('transp', 38)}<div class="tx"><span class="k">Categoría</span><b>Transporte</b></div>${down()}</div>
  <div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Viernes 25 sept</b></div></div>${note('Taxi', 'corregido a mano')}</div></main>
 <div class="scrim"></div><div class="dialog" style="text-align:center">${ci('trash-outline', C.red, 54).replace('display:grid', 'display:grid;margin:0 auto 12px')}<b style="font-size:18px">¿Borrar este movimiento?</b>
  <div class="sub" style="margin-top:6px">No se puede deshacer.</div>
  <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Sí, borrar</div></div></div>`;

// Long lists carry the two arrows.
S['1a-inicio'] += jump(112, 'down');
S['1b-inicio-cuenta-con-productos'] += jump(112, 'down');
S['1c-inicio-una-cuenta-nombre-largo'] += jump(112, 'down');
S['1d-inicio-nombre-largo-deslizando'] += jump(112, 'down');

export default S;
export { typeSeg, amount, keys, prod, end, dayRow, note, allBtn, route, infoDot };
