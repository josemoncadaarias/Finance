// Group 13 - part 2 of debts, loans (2026-10-01, for Jose's word). Jose has
// no loan, so everything here is invented test data, and every figure is
// worked out, not guessed: "Crédito del carro", 60,000,000 lent on 10 Oct
// 2024 at 16.5% E.A. (1.2808% a month), 60 monthly installments from 10 Nov
// 2024, 42,000 of insurance on each; 23 paid by 1 Oct 2026. Fixed installment
// (French system), 1,439,065.96 plus insurance. v2 (Jose, 2026-10-01): capital
// and interest on lines of their own in Cuotas, and paying capital ahead
// drawn here too (13l-13r), every scenario worked out by the same French
// schedule: once, every month, every June and December, the whole loan.
import { ic, ci, sq, C, tag, top, tabs, status, tint, chev, down, accIcon, bigTitle } from './lib.mjs';
import { infoDot, typeSeg, amount, end, route, dayRow, note } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const seg = (opts, on, mt = 10) => `<div class="seg" style="margin-top:${mt}px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;
const field = (lab, v, extra = '') => `<div class="field" style="margin-top:10px"><div class="lab">${lab}</div><div class="v" style="display:flex;align-items:center;justify-content:space-between;gap:8px">${v}${extra}</div></div>`;
const two = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${a}${b}</div>`;
const mu = t => `<span class="mu" style="font-size:13px">${t}</span>`;
const car = (s = 42) => ci('car-sport-outline', C.cya, s);
const page = (head, body, tab = 'Cuentas') => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs(tab)}`;

// 1. Cuentas → Deudas with the card of part 1 and one loan.
const cuentasHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva deuda</div></div>
 ${seg([['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']], 'Deudas')}</div>`;
const debt = (icon, name, sub, line, cls = '') => `<div class="row" style="align-items:flex-start">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small><small class="${cls}" style="white-space:normal">${line}</small></div>${chev()}</div>`;
S['13a-deudas-con-credito'] = page(cuentasHead, `
 <div class="card hero"><div class="lab">Debes hoy</div><div class="big">$ 42.938.033</div>
  <div class="kpi" style="margin-top:10px"><div class="card" style="background:rgba(7,13,26,.35)"><span class="lab">Este mes pagas</span><b>2.079.466</b></div>
   <div class="card" style="background:rgba(7,13,26,.35)"><span class="lab">De eso, intereses</span><b class="y">540.447</b></div></div></div>
 <div class="h">Tarjetas</div>
 <div class="list">${debt(accIcon('coral', 42), 'Tarjeta Coral', 'Usas 742.300 de 1.100.000', 'Paga 598.400 antes del 10 oct', 'y')}</div>
 <div class="h">Préstamos</div>
 <div class="list">${debt(car(), 'Crédito del carro', 'Debes 42.195.733 · 16,50 % E.A.', 'Cuota 24 de 60: 1.481.066 el 10 oct', 'y')}</div>`);

// 2. "Nueva deuda": what kind. A card is the account form of part 1.
S['13b-nueva-deuda'] = S['13a-deudas-con-credito'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh" style="flex-direction:column;align-items:stretch;gap:4px"><h2 style="text-align:center">¿Qué quieres agregar?</h2></div>
 <div class="list">${[
   ['cash-outline', C.pur, 'Un préstamo', 'Libre inversión, vehículo, vivienda, estudio: tasa, cuotas y plazo'],
   ['card-outline', C.yel, 'Una tarjeta de crédito', 'Cupo y fechas de corte y de pago'],
 ].map(([i, c, t, s]) => `<div class="row" style="align-items:flex-start">${ci(i, c, 42)}<div class="tx"><b>${t}</b><small style="white-space:normal">${s}</small></div>${chev()}</div>`).join('')}</div>
 <div style="text-align:center;margin-top:12px" class="mu">Cancelar</div></div>`;

// 3. A new loan. The rate is typed as the bank says it, E.A. or M.V.; the
//    installment is worked out AND can be typed as the bank states it (rule 7).
const loanForm = (extra, scrolled = false) => `${top('Nuevo préstamo', { left: 'x' })}<main>${scrolled ? '' : `
 <div style="display:flex;gap:12px;align-items:center;margin:4px 0 6px">${car(52)}<div style="flex:1"><div class="lab">Nombre</div><b style="font-size:18px">Crédito del carro</b></div>${ic('pencil', 'p')}</div>
 ${field('Te prestaron', '60.000.000,00 ' + mu('COP'))}
 <div class="field" style="margin-top:10px"><div class="lab">Tasa de interés</div><div style="display:flex;align-items:center;gap:10px;margin-top:4px"><b style="font-size:17px;flex:1">16,50 %</b>
  <div class="seg" style="padding:3px;flex:none;margin:0"><div class="on" style="padding:6px 10px">E.A.</div><div style="padding:6px 10px">M.V.</div></div></div>
  <div class="sub" style="margin-top:6px">Es 1,2808 % cada mes. Usura de septiembre: 29,24 % E.A.</div>
  <div class="seg" style="margin-top:10px"><div class="on">Fija</div><div>Variable</div></div></div>
 ${field('Sistema', 'Cuota fija en pesos', down())}`}
 ${two(field('Cuotas', '60'), field('Cada', 'mes', down()))}
 ${two(field('Te desembolsaron', '10 oct 2024', down()), field('Primera cuota', '10 nov 2024', down()))}
 <div class="field" style="margin-top:10px"><div class="lab">Seguros y cargos · opcional ${infoDot}</div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:4px"><b style="font-size:17px;flex:1">42.000,00</b><div class="seg" style="padding:3px;flex:none;margin:0"><div class="on" style="padding:6px 10px">Fijo</div><div style="padding:6px 10px">% del saldo</div></div></div></div>
 ${field('Pagas desde', `<span style="display:flex;gap:8px;align-items:center">${accIcon('azul', 26)}Banco Azul</span>`, down())}
 <div class="card" style="margin-top:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="sub">Cuota calculada</span><b>1.481.066</b></div>
  <div class="sub" style="margin-top:4px">1.439.066 de capital e intereses + 42.000 de seguros</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="sub">La que dice el banco · opcional</span><span class="chip" style="padding:5px 10px">1.481.066 ${ic('pencil', 'p', 'width:15px;height:15px')}</span></div>
  <div class="note" style="margin-top:8px;color:var(--grn)">Coincide con la calculada.</div></div>
 ${extra}</main><div class="save">Guardar préstamo</div>`;
S['13c-nuevo-prestamo'] = loanForm('');

// 4. A loan that began before the app: the installments already paid are a
//    record, not movements (the lesson of rule 15). The balance today is
//    worked out, and the person corrects it with what the bank says.
S['13d-prestamo-ya-empezado'] = loanForm(`
 <div class="h">Ya habías empezado a pagarlo</div>
 <div class="card" style="padding:14px"><div class="sub" style="white-space:normal">Por las fechas, ya pagaste <b style="color:var(--tx)">23 cuotas</b>. No se crean movimientos por ellas: solo se marca desde dónde sigues.</div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="sub">Debes hoy, calculado</span><b>42.195.733</b></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span class="sub">Lo que dice el banco · opcional</span><span class="chip" style="padding:5px 10px">Escribirlo ${ic('pencil', 'p', 'width:15px;height:15px')}</span></div></div>
 <div style="height:90px"></div>`, true);

// 5. One loan: Resumen | Cuotas.
const loanHead = on => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${car(40)}
 <div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Crédito del carro</b><div class="sub one">16,50 % E.A. · cuota fija · desde Banco Azul</div></div>${ic('pencil', 'p')}</div>
 ${seg([['Resumen'], ['Cuotas'], ['Abonar']], on)}</div>`;
const pbar = (a, b) => `<div class="pbar" style="height:10px;margin-top:10px"><i style="width:${a}%;background:${C.grn}"></i><i style="width:${b}%;background:${C.yel}"></i></div>`;
const legend = (a, b) => `<div style="display:flex;gap:14px;margin-top:8px;font-size:12.5px;flex-wrap:wrap"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${C.grn}"></i> Capital pagado ${a}</span><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${C.yel}"></i> Intereses pagados ${b}</span></div>`;
const kpis = `<div class="kpi" style="margin-top:12px">
  <div class="card"><span class="lab">Intereses que faltan</span><b class="y">11.049.708</b><span class="sub">en 37 cuotas</span></div>
  <div class="card"><span class="lab">Terminas</span><b>oct 2029</b><span class="sub">cuota 60</span></div>
  <div class="card"><span class="lab">Intereses en total</span><b>26.343.958</b><span class="sub">44 % de lo prestado</span></div>
  <div class="card"><span class="lab">Seguros en total</span><b>2.520.000</b><span class="sub">42.000 por cuota</span></div></div>`;
const payChip = t => `<div style="margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('swap-horizontal')}${t}</span></div>`;
S['13e-prestamo-resumen'] = page(loanHead('Resumen'), `
 <div class="card hero"><div class="lab">Debes</div><div class="big">$ 42.195.733</div>
  <div class="sub">Pagaste 23 de 60 cuotas.</div>${pbar(29.7, 25.5)}${legend('17.804.267', '15.294.250')}</div>
 <div class="card" style="margin-top:12px;padding:14px"><div class="lab">Próxima cuota · 24 de 60</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:4px"><b style="font-size:22px">1.481.066</b><span class="sub">sábado 10 oct · faltan 9 días</span></div>
  <div class="sub" style="margin-top:6px">Capital 898.619 · intereses <span class="y">540.447</span> · seguros 42.000</div>
  <div style="margin-top:12px"><span class="chip" style="color:var(--pr)">${ic('swap-horizontal')}Pagar la cuota</span></div></div>
 ${kpis}
 <div class="banner" style="background:${tint(C.blu, .12)};margin-top:12px">${ic('bulb-outline', 'p')}<span>Si abonas 5.000.000 con la próxima cuota, terminas en mayo de 2029 (5 cuotas antes) y ahorras 2.896.849. <b>Ver cómo</b></span></div>`);

// 6. Its installments, by year, folding; the paid ones ticked, the next lit.
const cuota = (n, date, c, i, k, bal, state) => `<div class="row" style="padding:10px 14px;gap:10px;align-items:flex-start${state === 'next' ? `;background:${tint(C.blu, .1)}` : ''}">
 <span style="width:28px;text-align:center;font-weight:600;margin-top:2px" class="${state === 'paid' ? 'mu' : ''}">${n}</span>
 <div class="tx"><b style="font-size:14.5px">${date} · ${c}</b>
  <small style="display:flex;justify-content:space-between"><span>Capital</span><span>${k}</span></small>
  <small style="display:flex;justify-content:space-between"><span>Intereses</span><span class="y">${i}</span></small>
  <small style="display:flex;justify-content:space-between"><span>Seguros</span><span>42.000</span></small>
  <small style="display:flex;justify-content:space-between"><span>Queda debiendo</span><span>${bal}</span></small></div>
 <span style="margin-top:2px">${state === 'paid' ? ic('checkmark-circle', 'g') : state === 'next' ? ic('ellipse-outline', 'p') : ic('ellipse-outline', 'mu')}</span></div>`;
const year = (y, sub, open, rows = '') => `<div class="list" style="margin-top:8px"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b>${y}</b><small>${sub}</small></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu')}</div>${open ? rows : ''}</div>`;
S['13f-prestamo-cuotas'] = page(loanHead('Cuotas'), `
 <div style="display:flex;gap:8px;align-items:center;margin-top:2px"><span class="chip on">Todas · 60</span><span class="chip">Faltan 37</span><span class="chip">Pagadas 23</span></div>
 ${year('2026', '12 cuotas · 10 pagadas · intereses 6.945.196', true,
   cuota(23, '10 sept', '1.481.066', '551.811', '887.255', '42.195.733', 'paid')
 + cuota(24, '10 oct', '1.481.066', '540.447', '898.619', '41.297.113', 'next')
 + cuota(25, '10 nov', '1.481.066', '528.937', '910.129', '40.386.984', '')
 )}
 ${year('2027', '12 cuotas · intereses 5.241.802', false)}
 ${year('2028 – 2029', '22 cuotas · intereses 4.221.242', false)}
 ${year('2024 – 2025', '14 cuotas pagadas · antes de la app', false)}
 <div class="note" style="margin:10px 4px">Cada cuota incluye 42.000 de seguros. Una cuota queda pagada cuando registras el pago, nunca sola.</div>`);

// 7. Paying an installment: the one transfer form, from the account it is
//    paid from to the loan, with how the payment splits. Capital lowers the
//    debt (a transfer); interest and insurance are spending, each under its
//    category. Each figure can be changed to what the bank charged.
const split = (i, k, s, note2 = '') => `<div class="h">Cuota 24 de 60 · se registra así ${infoDot}</div>
 <div class="list">
  <div class="row">${ci('swap-horizontal', C.blu, 36)}<div class="tx"><b>Capital</b><small>Baja la deuda</small></div><div class="am p">${k}</div>${ic('pencil', 'mu', 'width:16px;height:16px')}</div>
  <div class="row">${sq('trending-up-outline', C.yel, 36)}<div class="tx"><b>Intereses</b><small>Gasto · Intereses</small></div><div class="am">${i}</div>${ic('pencil', 'mu', 'width:16px;height:16px')}</div>
  <div class="row">${sq('shield-checkmark-outline', C.pur, 36)}<div class="tx"><b>Seguros</b><small>Gasto · Seguros</small></div><div class="am">${s}</div>${ic('pencil', 'mu', 'width:16px;height:16px')}</div></div>${note2}`;
const payForm = (total, sp, title = 'Transferir') => `${top(title, { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', total)}
 ${route(end(accIcon('azul', 38), 'Desde', 'Banco Azul'), end(car(38), 'Hacia', 'Crédito del carro'))}
 ${sp}
 <div class="list" style="margin-top:10px">${dayRow.replace('Hoy · domingo 27 sept', 'Sábado 10 oct')}${note('Cuota crédito del carro')}</div>
 </main><div class="save">Guardar</div>`;
S['13g-pagar-cuota'] = payForm('1.481.066', split('540.447', '898.619', '42.000'));

// 8. The bank charged other figures: what was paid is what is saved, and the
//    schedule is worked out again from the new balance.
S['13h-pagar-cuota-otra-cifra'] = payForm('1.485.000', split('544.380', '898.620', '42.000',
 `<div class="note" style="margin:8px 4px">Cambiaste los intereses: 540.447 → <b style="color:var(--tx)">544.380</b>. Se guarda lo que pagaste y las cuotas que faltan se calculan con la deuda que queda.</div>`));

// 9. The day passed and the installment was not registered as paid.
S['13i-cuota-vencida'] = page(loanHead('Resumen'), `
 <div class="card hero" style="background:linear-gradient(145deg,${tint(C.red, .35)} 0%,${tint(C.red, .12)} 55%,#111b2f 100%);border-color:${tint(C.red, .5)}"><div class="lab">Cuota 24 de 60</div><div class="big r">$ 1.481.066</div>
  <div class="sub">Venció el sábado 10 de octubre (hace 2 días). Si ya la pagaste, regístrala; si no, el banco puede cobrar intereses de mora.</div>
  ${payChip('Pagar la cuota')}</div>
 <div class="card" style="margin-top:12px;padding:14px"><div class="lab">Debes</div><b style="font-size:20px">42.195.733</b><div class="sub">Pagaste 23 de 60 cuotas.</div>${pbar(29.7, 25.5)}</div>
 ${kpis}`);

// 10. Paid off: kept as history until it is archived.
S['13j-prestamo-pagado'] = page(loanHead('Resumen'), `
 <div class="card" style="text-align:center;padding:18px;border-color:${tint(C.grn, .5)}">${ci('checkmark', C.grn, 50).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block;font-size:17px">Préstamo pagado</b>
  <div class="sub" style="margin-top:4px">La última cuota fue el 10 de octubre de 2029. Pagaste 60.000.000 de capital, 26.343.958 de intereses y 2.520.000 de seguros.</div>
  <div style="margin-top:12px"><span class="chip">${ic('archive-outline')}Archivar</span></div></div>`);

// 11. Saldos: a loan is an account, a debt, so it subtracts from net worth.
const acc = (icon, name, line, amt, cls = '') => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b>${line ? `<small class="one">${line}</small>` : ''}</div><div class="am ${cls}">${amt}</div>${ic('create-outline', 'mu')}</div>`;
S['13k-saldos-con-prestamo'] = page(`<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva cuenta</div></div>
 ${seg([['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']], 'Saldos')}</div>`, `
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 31.284.120 <span class="mu" style="font-size:14px">COP</span></div><div class="sub">Lo que tienes menos lo que debes.</div></div>
 <div class="list" style="margin-top:12px">
  ${acc(accIcon('azul', 42), 'Banco Azul', '', '28.410.000')}
  ${acc(accIcon('verde', 42), 'Ahorro Verde', '', '45.812.153')}
  ${acc(accIcon('coral', 42), 'Tarjeta Coral', 'Disponible 357.700 de 1.100.000', '−742.300', 'y')}
  ${acc(car(), 'Crédito del carro', 'Préstamo · cuota 24 de 60', '−42.195.733', 'y')}</div>`);

// ------------------------------------------------------------ paying capital ahead
// Ley 1555 de 2012 (any credit in pesos, up to 880 SMMLV) and Ley 546 de 1999
// (housing): pay ahead, all or part, with no penalty, and the DEBTOR chooses
// whether a partial payment shortens the term or lowers the installment. The
// Superfinanciera: the bank must apply it as the debtor asks and not to future
// installments. Every figure below is the same French schedule worked again.
const opt = (on, icon, title, tagText, lines) => `<div class="card" style="padding:14px;${on ? `border-color:${C.grn};background:${tint(C.grn, .08)}` : ''}">
 <div style="display:flex;gap:8px;align-items:center">${ci(icon, on ? C.grn : C.blu, 32)}<b style="flex:1">${title}</b>${tagText ? tag(tagText, C.grn) : ''}</div>
 <div style="display:grid;grid-template-columns:1fr auto;gap:4px 10px;margin-top:10px;font-size:14px">${lines.map(([a, b, cls = '']) => `<span class="mu">${a}</span><b class="${cls}" style="text-align:right">${b}</b>`).join('')}</div></div>`;
const chips = (list, on) => `<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:8px">${list.map(t => `<span class="chip ${t === on ? 'on' : ''}" style="padding:5px 12px">${t}</span>`).join('')}</div>`;
const abonoHead = (amount, when, freq) => `<div class="card" style="text-align:center;padding:14px"><div class="lab">Abonar a capital</div><div style="font-size:34px;font-weight:700;margin:4px 0">${amount}</div>
  ${chips(['1 M', '2 M', '5 M', '10 M'], amount.startsWith('5') ? '5 M' : '')}
  ${seg([['Una vez'], ['Cada mes'], ['En primas']], freq, 12)}
  <div class="sub" style="margin-top:8px">${when}</div></div>`;
const verdict = t => `<div class="banner" style="background:${tint(C.grn, .12)};margin-top:12px">${ic('checkmark-circle', 'g')}<span style="white-space:normal">${t}</span></div>`;

S['13l-abonar-una-vez'] = page(loanHead('Abonar'), `
 ${abonoHead('5.000.000', 'Con la cuota 24, el sábado 10 de octubre', 'Una vez')}
 ${verdict('Si abonas <b>5.000.000</b> para reducir el plazo, terminas en <b>mayo de 2029</b>, 5 cuotas antes, pagas <b>8.362.859</b> de intereses en vez de 11.049.708 y ahorras <b>2.896.849</b> con los seguros.')}
 <div style="display:grid;gap:10px;margin-top:12px">
  ${opt(true, 'hourglass-outline', 'Reducir el plazo', 'Ahorra más', [['Terminas', 'mayo 2029'], ['Cuotas que faltan', '32, la última menor'], ['Intereses que pagarás', '8.362.859', 'y'], ['Total que pagarás', '51.902.592'], ['Ahorras', '2.896.849', 'g']])}
  ${opt(false, 'trending-down-outline', 'Reducir la cuota', '', [['Terminas', 'oct 2029, igual'], ['Cuota nueva', '1.306.833 (−174.233)'], ['Intereses que pagarás', '9.777.312', 'y'], ['Total que pagarás', '53.527.044'], ['Ahorras', '1.272.397', 'g']])}
  ${opt(false, 'remove-outline', 'Sin abonar', '', [['Terminas', 'oct 2029'], ['Intereses que pagarás', '11.049.708', 'y'], ['Total que pagarás', '54.799.441']])}</div>
 <div class="note" style="margin:10px 4px">Total que pagarás: desde hoy, con el abono, las cuotas y los seguros. Cifras aproximadas: el banco puede redondear distinto.</div>`);

// The same question for several amounts at once.
const row2 = (a, b, c, d) => `<div class="row" style="padding:10px 14px"><b style="width:86px">${a}</b><div class="tx"><b>${b}</b><small>${c}</small></div><div class="am g">${d}</div></div>`;
S['13m-abonar-cuanto'] = page(loanHead('Abonar'), `
 ${opt(false, 'remove-outline', 'Sin abonar', '', [['Terminas', 'oct 2029'], ['Intereses que pagarás', '11.049.708', 'y'], ['Total que pagarás', '54.799.441']])}
 <div class="h">Cuánto ahorras según lo que abones ${infoDot}</div>
 <div class="list">
  ${row2('1.000.000', 'Terminas sept 2029', '1 cuota antes', '621.370')}
  ${row2('2.000.000', 'Terminas ago 2029', '2 cuotas antes', '1.221.223')}
  ${row2('5.000.000', 'Terminas may 2029', '5 cuotas antes', '2.896.849')}
  ${row2('10.000.000', 'Terminas dic 2028', '10 cuotas antes', '5.306.039')}</div>
 <div class="note" style="margin:10px 4px">Reduciendo el plazo. Toca una fila para verla arriba. Cuanto antes abones, más ahorras.</div>
 <div class="btn" style="margin-top:6px">${ic('swap-horizontal')}Registrar el abono de 5.000.000</div>
 <div style="text-align:center;margin-top:12px"><span class="chip" style="color:var(--pr)">${ic('flag-outline')}Pagar todo el préstamo</span></div>`).replace('<main>', '<main style="padding-top:4px">');

// Every month, or every June and December (the primas).
S['13n-abonar-en-primas'] = page(loanHead('Abonar'), `
 ${abonoHead('1.000.000', 'Cada junio y cada diciembre, con la cuota', 'En primas')}
 ${verdict('Abonando <b>1.000.000</b> en cada prima, terminas en <b>junio de 2029</b>, 4 cuotas antes, y ahorras <b>1.671.644</b>. En total abonarías 5.000.000.')}
 <div class="h">Otras formas de abonar lo mismo</div>
 <div class="list">
  ${row2('200.000', 'Cada mes · terminas may 2029', 'Abonas 6.200.000 en total', '1.927.977')}
  ${row2('5.000.000', 'Una vez, el 10 oct · may 2029', 'Abonas 5.000.000', '2.896.849')}</div>
 <div class="note" style="margin:10px 4px">Un abono que se repite no se registra solo: cada vez la app te lo recuerda con la cuota y tú lo guardas.</div>`);

// Registering the payment ahead: the one transfer form, marked as a payment
// to capital and saying which of the two the person asked the bank for.
S['13o-registrar-abono'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', '5.000.000')}
 ${route(end(accIcon('azul', 38), 'Desde', 'Banco Azul'), end(car(38), 'Hacia', 'Crédito del carro'))}
 <div class="h">Es un abono a capital ${infoDot}</div>
 <div class="list"><div class="row">${ci('hourglass-outline', C.grn, 36)}<div class="tx"><span class="k">Para</span><b>Reducir el plazo</b><small>Terminas en mayo de 2029</small></div>${down()}</div></div>
 <div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span style="white-space:normal">Dile al banco, por escrito, que es para reducir el plazo. Si no lo dices, puede abonarlo a cuotas futuras.</span></div>
 <div class="list" style="margin-top:10px">${dayRow.replace('Hoy · domingo 27 sept', 'Sábado 10 oct')}${note('Abono a capital crédito del carro', '')}</div>
 </main><div class="save">Guardar</div>`;

// After it, the schedule shows the payment ahead in its place, and the end.
S['13p-cuotas-con-abono'] = page(loanHead('Cuotas'), `
 <div style="display:flex;gap:8px;align-items:center;margin-top:2px"><span class="chip on">Todas · 55</span><span class="chip">Faltan 31</span><span class="chip">Pagadas 24</span></div>
 ${year('2026', '12 cuotas · 1 abono', true,
   cuota(24, '10 oct', '1.481.066', '540.447', '898.619', '41.297.113', 'paid')
 + `<div class="row" style="padding:10px 14px;gap:10px;background:${tint(C.grn, .08)}"><span style="width:28px;display:grid;place-items:center">${ic('arrow-down-circle', 'g')}</span><div class="tx"><b style="font-size:14.5px">10 oct · abono a capital · <span class="g">5.000.000</span></b><small>Para reducir el plazo</small><small style="display:flex;justify-content:space-between"><span>Queda debiendo</span><span>36.297.113</span></small></div><span style="width:24px"></span></div>`
 + cuota(25, '10 nov', '1.481.066', '464.897', '974.169', '35.322.944', 'next'))}
 ${year('2027', '12 cuotas · intereses 4.395.534', false)}
 ${year('2028 – 2029', '17 cuotas · terminas en mayo de 2029', false)}
 <div class="note" style="margin:10px 4px">Desde el abono, más de cada cuota va a capital: la cuota 25 paga 974.169 de capital, y sin abono serían 910.129.</div>`);

// Paying it all today: balance plus the interest of the days since the last
// installment. The bank's figure is the one that counts.
S['13q-pagar-todo'] = page(loanHead('Abonar'), `
 <div class="card hero"><div class="lab">Para pagarlo todo hoy, 1 de octubre</div><div class="big">$ 42.573.322</div>
  <div class="sub">Debes 42.195.733 de capital, más 377.590 de intereses de los 21 días desde la cuota del 10 de septiembre.</div>
  ${payChip('Pagar todo')}</div>
 ${verdict('Pagándolo hoy te ahorras 10.672.118 de intereses y 1.554.000 de seguros.')}
 <div class="note" style="margin:10px 4px">Es aproximado: pídele al banco la cifra exacta y el paz y salvo. Al guardarlo, el préstamo queda pagado.</div>`);

// An installment paid late: the bank adds default interest (never above the
// usury rate). The app does not invent it: it is typed if charged.
S['13r-pagar-cuota-con-mora'] = payForm('1.482.330', split('540.447', '898.619', '42.000',
 `<div class="list" style="margin-top:8px"><div class="row">${sq('time-outline', C.red, 36)}<div class="tx"><b>Intereses de mora</b><small>Gasto · Intereses · lo que cobró el banco</small></div><div class="am r">1.264</div>${ic('pencil', 'mu', 'width:16px;height:16px')}</div></div>
 <div class="note" style="margin:8px 4px">La cuota venció hace 2 días. Si el banco cobró mora, escríbela: se cobra sobre el capital vencido y nunca por encima de la usura (29,24 % E.A. en septiembre).</div>`)).replace('Sábado 10 oct', 'Lunes 12 oct');

export default S;
