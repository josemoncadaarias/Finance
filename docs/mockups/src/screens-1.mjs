// Group 1 (v4, 2026-09-28): Inicio, the "+" sheet, and the ONE movement form
// with every way it is used. Corrected after Jose's review of v3:
// - long names stay on one line (ellipsis, then the slide the app already has);
// - nothing that does not serve (no "idea nueva" labels);
// - space saved the way the app saves it today: the category is ONE button;
// - one form, one style, for spending, income, a transfer between accounts and
//   a move between products, each with its note;
// - writing a note lifts the note to the top and hides the rest, with the
//   suggestions under it and the phone's keyboard below.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, status, M, donut, tint } from './lib.mjs';

const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const LONG = 'Tarjeta de crédito Rappi Visa Platinum';

// The header: the name takes the whole width it can, on one line; when it does
// not fit it ends in "…" and slides once to show itself (marquee.service.ts).
const header = ({ hidden = false, acc = null, sliding = false } = {}) => {
  const icon = acc ? accIcon(acc === 'long' ? 'coral' : acc, 40) : ci('layers-outline', C.blu, 40);
  const name = acc ? (acc === 'long' ? LONG : ACC[acc][2]) : 'Todas las cuentas';
  const sub = acc === 'long' || acc === 'coral' ? 'COP · tarjeta de crédito' : acc ? 'COP' : '7 cuentas, todas incluidas';
  return `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${acc === 'long' ? accIcon('coral', 40) : icon}
  <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px;${sliding ? 'text-overflow:clip' : ''}">${sliding ? `<span style="display:inline-block;transform:translateX(-96px)">${name}</span>` : name}</b>${down()}</div>
   <div class="one sub" style="font-size:12.5px">${sub}</div></div>
  <div class="btn-r ${hidden ? 'on' : ''}" style="width:38px;height:38px">${ic(hidden ? 'eye-off-outline' : 'eye-outline')}</div></div>
 <div class="month">${ic('chevron-back-outline')}<span>Septiembre 2026</span>${ic('chevron-forward-outline')}</div></div>`;
};

const figures = hidden => `<div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ ${M('48.312.740,55', hidden)}</div>
  <div class="mini" style="margin-top:12px"><div><span class="lab">Entró</span><b class="g">${M('8.450.000,00', hidden)}</b></div>
   <div><span class="lab">Salió</span><b class="r">${M('5.236.418,00', hidden)}</b></div></div></div>`;

const chart = hidden => `<div class="card" style="display:flex;align-items:center;gap:16px">${donut([[31, C.org], [20, C.grn], [19, C.red], [11, C.cya], [8, C.yel], [11, C.gry]], 118)}
  <div style="flex:1;min-width:0">${[['vivienda', 31], ['mercado', 20], ['rest', 19], ['transp', 11], ['servicios', 8]].map(([k, p]) => `<div style="display:flex;align-items:center;gap:9px;margin:4px 0;font-size:13.5px">${catIcon(k, 25)}<span class="one" style="flex:1">${CAT[k][2]}</span><span class="mu">${p}%</span></div>`).join('')}</div></div>`;

const line = (k, title, sub, amt, cls) => `<div class="row">${catIcon(k)}<div class="tx"><b>${title}</b><small class="one">${sub}</small></div><div class="am ${cls}">${amt}</div></div>`;

const S = {};

S['1a-inicio'] = `${header()}<main>${figures(false)}
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 ${chart(false)}
 <div class="list" style="margin-top:12px">${line('salario', 'Salario', '1 movimiento', '+8.450.000,00', 'g')}${line('vivienda', 'Vivienda', '31 % · 2 movimientos', '1.600.000,00', '')}</div>
 </main><div class="fade"></div><div class="fab">${ic('add')}</div>${tabs('Inicio')}`;

S['1b-inicio-montos-ocultos'] = `${header({ hidden: true })}<main>${figures(true)}
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 ${chart(true)}
 <div class="list" style="margin-top:12px">${line('salario', 'Salario', '1 movimiento', '+••••••', 'g')}${line('vivienda', 'Vivienda', '31 % · 2 movimientos', '••••••', '')}</div>
 </main><div class="fade"></div><div class="fab">${ic('add')}</div>${tabs('Inicio')}`;

// One account with a long name: one line, "…", and the slide (second frame).
const oneCard = sliding => `${header({ acc: 'long', sliding })}<main>
 <div class="card hero"><div style="display:flex;align-items:flex-start;gap:8px"><div style="flex:1"><div class="lab">Debes hoy</div><div class="big y">−4.127.100,00</div></div>
  <div class="btn-r" style="width:38px;height:38px">${ic('create-outline')}</div></div>
  <div class="sub">Disponible 3.872.900 de 8.000.000</div><div class="pbar" style="margin-top:8px"><i style="width:52%;background:var(--yel)"></i></div>
  <div class="mini" style="margin-top:12px"><div><span class="lab">Salió</span><b class="r">4.560.400,00</b></div><div><span class="lab">Recibido</span><b>4.318.500,00</b></div></div></div>
 <div class="seg" style="margin:12px 0"><div>${ic('pie-chart-outline')}Gráfico</div><div class="on">${ic('list-outline')}Movimientos · 32</div></div>
 <div class="search">${ic('search-outline')}<span class="one">Buscar en septiembre: nota, categoría o cuenta…</span></div>
 <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><div class="chip on">Por día</div><div class="chip">Por categoría</div><div class="chip">Más grandes</div></div>
 <div class="h">Hoy · domingo 27<span class="r" style="letter-spacing:0">−32.000,00</span></div>
 <div class="list">${line('rest', 'Almuerzo con el equipo de trabajo en el centro', 'Restaurantes', '−32.000,00', 'r')}</div>
 <div class="h">Viernes 25<span class="r" style="letter-spacing:0">−181.600,00</span></div>
 <div class="list">${line('mercado', 'Mercado quincena', 'Mercado', '−164.200,00', 'r')}${line('transp', 'Taxi', 'Transporte · corregido a mano', '−17.400,00', 'r')}</div>
 </main><div class="fade"></div><div class="fab">${ic('add')}</div>${tabs('Inicio')}`;
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
const note = (text, hint = 'la de siempre') => `<div class="row">${ic('create-outline', 'mu')}<div class="tx"><b class="one">${text}</b>${hint ? `<small>${hint}</small>` : ''}</div><span class="mu">${ic('close-circle', '', 'width:19px;height:19px')}</span></div>`;
const dayRow = `<div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Hoy · domingo 27 sept</b></div><div class="chip" style="padding:5px 11px">Ayer</div></div>`;

S['1f-gasto'] = `${top('Nuevo gasto', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${amount('−', 'r', '164.200')}
 <div class="list">
  ${pick(accIcon('verde', 38), 'Desde dónde', 'Ahorro Verde', productChip('basket-outline', C.lim, 'Bolsillo Mercado'))}
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
const route = (from, to, allLabel) => `<div class="list">
  <div class="row">${from}<div class="chip" style="padding:5px 10px;font-size:12.5px;white-space:nowrap">Pasar todo · ${allLabel}</div></div>
  <div class="row plain" style="justify-content:center;padding:4px"><div class="chip" style="padding:5px 12px;font-size:13px">${ic('swap-vertical-outline')}Invertir</div></div>
  <div class="row">${to}${down()}</div></div>`;

S['1h-transferencia'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', '800.000')}
 ${route(`${accIcon('azul', 38)}<div class="tx"><span class="k">Desde</span><b>Banco Azul</b></div>`, `${accIcon('coral', 38)}<div class="tx"><span class="k">Hacia dónde</span><b class="one">${LONG}</b></div>`, '12.480.300')}
 <div class="list" style="margin-top:10px">${dayRow}${note('Pago tarjeta de crédito')}</div>
 </main>${keys('Guardar')}`;

S['1i-transferencia-entre-productos'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', '2.000.000')}
 ${route(`${sq('airplane-outline', C.cya, 38)}<div class="tx"><span class="k">Desde · Ahorro Verde</span><b>Bolsillo Viajes</b></div>`, `${sq('wallet-outline', C.grn, 38)}<div class="tx"><span class="k">Hacia · Ahorro Verde</span><b>Cuenta de ahorros</b></div>`, '2.000.000')}
 <div class="list" style="margin-top:10px">${dayRow}${note('Retiro bolsillo viajes')}</div>
 </main>${keys('Guardar')}`;

S['1j-transferencia-dos-monedas'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 <div style="display:flex;gap:8px;align-items:center;margin:10px 0 8px">
  <div class="card" style="flex:1;text-align:center;padding:9px;border-color:var(--pr)"><div class="lab">Sale</div><div style="font-size:23px;font-weight:700;margin-top:2px">1.000.000</div><div class="mu" style="font-size:12px">COP</div></div>
  <span class="p">${ic('arrow-forward-outline')}</span>
  <div class="card" style="flex:1;text-align:center;padding:9px"><div class="lab">Llega</div><div style="font-size:23px;font-weight:700;margin-top:2px">254,12</div><div class="mu" style="font-size:12px">USD · tasa 3.935,15</div></div></div>
 ${route(`${accIcon('azul', 38)}<div class="tx"><span class="k">Desde</span><b>Banco Azul</b></div>`, `${accIcon('dolar', 38)}<div class="tx"><span class="k">Hacia dónde</span><b>Cuenta Dólar</b></div>`, '12.480.300')}
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

export default S;
