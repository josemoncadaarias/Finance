// Group 13 - part 2 of debts, loans (2026-10-01, for Jose's word). Jose has
// no loan, so everything here is invented test data, and every figure is
// worked out, not guessed: "Crédito del carro", 60,000,000 lent on 10 Oct
// 2024 at 16.5% E.A. (1.2808% a month), 60 monthly installments from 10 Nov
// 2024, 42,000 of insurance on each; 23 paid by 1 Oct 2026. Fixed installment
// (French system), 1,439,065.96 plus insurance. Paying capital ahead is part 3.
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
  <div class="sub" style="margin-top:6px">Es 1,2808 % cada mes.</div></div>`}
 ${two(field('Cuotas', '60'), field('Cada', 'mes', down()))}
 ${two(field('Te desembolsaron', '10 oct 2024', down()), field('Primera cuota', '10 nov 2024', down()))}
 ${field('Seguros y cargos por cuota · opcional', '42.000,00', infoDot)}
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
 ${seg([['Resumen'], ['Cuotas']], on)}</div>`;
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
 ${kpis}`);

// 6. Its installments, by year, folding; the paid ones ticked, the next lit.
const cuota = (n, date, c, i, k, bal, state) => `<div class="row" style="padding:10px 14px;gap:10px${state === 'next' ? `;background:${tint(C.blu, .1)}` : ''}">
 <span style="width:28px;text-align:center;font-weight:600" class="${state === 'paid' ? 'mu' : ''}">${n}</span>
 <div class="tx"><b style="font-size:14.5px">${date}</b><small>capital ${k} · intereses <span class="y">${i}</span></small></div>
 <div class="am" style="font-size:14px">${c}<small class="mu">queda ${bal}</small></div>${state === 'paid' ? ic('checkmark-circle', 'g') : state === 'next' ? ic('ellipse-outline', 'p') : ic('ellipse-outline', 'mu')}</div>`;
const year = (y, sub, open, rows = '') => `<div class="list" style="margin-top:8px"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b>${y}</b><small>${sub}</small></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu')}</div>${open ? rows : ''}</div>`;
S['13f-prestamo-cuotas'] = page(loanHead('Cuotas'), `
 <div style="display:flex;gap:8px;align-items:center;margin-top:2px"><span class="chip on">Todas · 60</span><span class="chip">Faltan 37</span><span class="chip">Pagadas 23</span></div>
 ${year('2026', '12 cuotas · 10 pagadas · intereses 6.945.196', true,
   cuota(22, '10 ago', '1.481.066', '563.031', '876.035', '43.082.988', 'paid')
 + cuota(23, '10 sept', '1.481.066', '551.811', '887.255', '42.195.733', 'paid')
 + cuota(24, '10 oct', '1.481.066', '540.447', '898.619', '41.297.113', 'next')
 + cuota(25, '10 nov', '1.481.066', '528.937', '910.129', '40.386.984', '')
 + cuota(26, '10 dic', '1.481.066', '517.280', '921.786', '39.465.198', ''))}
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

export default S;
