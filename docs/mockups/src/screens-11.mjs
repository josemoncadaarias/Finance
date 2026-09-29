// Group 11 (PROPOSALS, 2026-09-29, not approved): debts - loans, credit cards
// with their cut-off and payment days, what is owed in interest, paying
// capital ahead - and plans: spending limits per category and savings goals,
// the way Lukas has them. Asked for by Jose as analysis and proposals only;
// nothing here is built. Every name and figure is invented, and the loan's
// figures are worked out (60,000,000 at 16.5% E.A., 60 monthly payments, 23
// paid). See CLAUDE.md, "Debts and plans".
import { ic, ci, sq, C, tag, sw, top, tabs, status, tint, catIcon, accIcon, chev, down, periodBar } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const page = (head, body, tab = 'Cuentas', after = '') => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs(tab)}${after}`;
const amber = t => `<div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>${t}</span></div>`;
const blue = t => `<div class="banner" style="background:${tint(C.blu, .12)};margin-top:10px">${ic('bulb-outline', 'p')}<span>${t}</span></div>`;
const bar = (parts, h = 8) => `<div class="pbar" style="height:${h}px;margin-top:8px">${parts.map(([p, c]) => `<i style="width:${p}%;background:${c}"></i>`).join('')}</div>`;
const fig = (lab, v, cls = '') => `<div><span class="lab">${lab}</span><b class="${cls}" style="display:block;font-size:16.5px;margin-top:3px">${v}</b></div>`;
const two = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${a}${b}</div>`;
const field = (lab, v, extra = '') => `<div class="field" style="margin-top:10px"><div class="lab">${lab}</div><div class="v" style="display:flex;align-items:center;justify-content:space-between;gap:8px">${v}${extra}</div></div>`;
const seg = (opts, on, mt = 12) => `<div class="seg" style="margin-top:${mt}px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;

// ------------------------------------------------------------ where debts live
// Cuentas gets a third face. Saldos is what one has, Rendimientos what it
// earns, Deudas what one owes and what that costs. A loan is an account of
// its own (a liability, like a card - rule 4), so it also shows in Saldos and
// in net worth; this face adds its terms and its schedule.
const faces = on => seg([['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']], on, 10);
const cuentasHead = on => `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva deuda</div></div>${faces(on)}</div>`;

const debt = (icon, name, sub, amt, line, cls = '') => `<div class="row" style="align-items:flex-start">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small><small class="${cls}" style="white-space:normal">${line}</small></div><div class="am">${amt}</div>${chev()}</div>`;
S['11a-cuentas-deudas'] = page(cuentasHead('Deudas'), `
 <div class="card hero"><div class="lab">Debes hoy</div><div class="big">$ 51.902.832</div>
  ${two(fig('Este mes pagas', '5.597.466'), fig('De eso, intereses', '593.920', 'y'))}
  <div class="sub" style="margin-top:10px">Si sigues con las cuotas de hoy, terminas de pagar todo en <b style="color:var(--tx)">septiembre de 2029</b> y pagas <b class="y">11.570.000</b> más en intereses.</div></div>
 ${blue('Abonar 5.000.000 al crédito del carro te ahorra 2,78 M en intereses y 5 cuotas. <b>Ver cómo</b>')}
 <div class="h">Lo que debes ${infoDot}</div>
 <div class="list">
  ${debt(accIcon('coral'), 'Tarjeta Coral', 'Corte el 15 · pagas antes del 5 oct', '6.507.100', 'Paga 3.806.400 para no pagar intereses', 'y')}
  ${debt(ci('car-sport-outline', C.cya, 42), 'Crédito del carro', '16,50 % E.A. · cuota 1.439.066', '42.195.732', 'Cuota 24 de 60 el 10 oct · terminas en sept 2029')}
  ${debt(ci('cash-outline', C.pur, 42), 'Libre inversión Banco Azul', '22,00 % E.A. · cuota 310.000', '3.200.000', 'Cuota 7 de 18 el 20 oct')}</div>
 <div class="h">Te deben</div>
 <div class="list">${debt(ci('person-outline', C.grn, 42), 'Préstamo a Andrés', 'Sin intereses · 3 pagos de 500.000', '1.500.000', 'Próximo pago acordado: 30 oct', 'g')}</div>`);

// ------------------------------------------------------------ a new debt
S['11b-nueva-deuda'] = S['11a-cuentas-deudas'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh" style="flex-direction:column;align-items:stretch;gap:4px"><h2 style="text-align:center">¿Qué quieres agregar?</h2></div>
 <div class="list">${[
   ['cash-outline', C.pur, 'Un crédito que pago', 'Libre inversión, vehículo, estudio, nómina: cuota fija, tasa y plazo'],
   ['home-outline', C.org, 'Un crédito de vivienda', 'Hipotecario o leasing, en pesos o en UVR, con sus seguros'],
   ['card-outline', C.yel, 'Una tarjeta de crédito', 'Cupo, fechas de corte y de pago, compras a cuotas'],
   ['person-outline', C.grn, 'Plata que presté', 'Lo que te deben, con o sin intereses y cuándo te pagan'],
 ].map(([i, c, t, s]) => `<div class="row" style="align-items:flex-start">${ci(i, c, 42)}<div class="tx"><b>${t}</b><small style="white-space:normal">${s}</small></div>${chev()}</div>`).join('')}</div></div>`;

// ------------------------------------------------------------ the loan's terms
// The installment is worked out AND can be typed as the bank states it (rule
// 7: both kept, the difference shown). The rate is typed the way the bank
// says it, E.A. or M.V., and the other is shown beside it; above the usury
// ceiling of its month the form says so.
S['11c-nuevo-credito'] = `${top('Nuevo crédito', { left: 'x' })}<main>
 <div style="display:flex;gap:12px;align-items:center;margin:4px 0 6px">${ci('car-sport-outline', C.cya, 52)}<div style="flex:1"><div class="lab">Nombre</div><b style="font-size:18px">Crédito del carro</b></div>${ic('pencil', 'p')}</div>
 ${field('Te prestaron', '60.000.000,00 <span class="mu" style="font-size:13px">COP</span>')}
 <div class="field" style="margin-top:10px"><div class="lab">Tasa</div><div style="display:flex;align-items:center;gap:10px;margin-top:4px"><b style="font-size:17px;flex:1">16,50 %</b>
  <div class="seg" style="padding:3px;flex:none"><div class="on" style="padding:6px 10px">E.A.</div><div style="padding:6px 10px">M.V.</div></div></div>
  <div class="sub" style="margin-top:6px">Equivale a 1,2808 % mes vencido · la usura de septiembre es 29,24 % E.A.</div></div>
 ${two(field('Plazo', '60 <span class="mu" style="font-size:13px">cuotas</span>'), field('Cada', 'mes ' + down()))}
 ${two(field('Desembolso', '10 oct 2024'), field('Primera cuota', '10 nov 2024'))}
 ${field('Seguros y cargos por cuota', '42.000,00', infoDot)}
 ${field('Pagas desde', `<span style="display:flex;gap:8px;align-items:center">${accIcon('azul', 26)}Banco Azul</span>`, down())}
 <div class="card" style="margin-top:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="sub">Cuota calculada</span><b>1.439.066</b></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px"><span class="sub">La que dice el banco</span><span class="chip" style="padding:5px 10px">1.481.066 ${ic('pencil', 'p', 'width:15px;height:15px')}</span></div>
  <div class="note" style="margin-top:8px">La diferencia, 42.000, son los seguros: coincide.</div></div>
 <div class="banner" style="background:${tint(C.blu, .1)};margin-top:12px">${ic('time-outline', 'p')}<span>Ya van 23 cuotas pagadas. ¿Las registro como pagadas sin crear movimientos? Tu saldo real lo dices tú.</span></div>
 </main><div class="save">Guardar crédito</div>`;

// ------------------------------------------------------------ one loan
const loanHead = on => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${ci('car-sport-outline', C.cya, 40)}
 <div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Crédito del carro</b><div class="sub one">16,50 % E.A. · cuota fija</div></div>${ic('pencil', 'p')}</div>
 ${seg([['Resumen'], ['Cuotas'], ['Abonar']], on, 10)}</div>`;
S['11d-credito-resumen'] = page(loanHead('Resumen'), `
 <div class="card hero"><div class="lab">Debes</div><div class="big">$ 42.195.732</div>
  <div class="sub">Pagaste 23 de 60 cuotas · terminas en septiembre de 2029</div>
  ${bar([[20.6, C.grn], [17.7, C.yel]], 10)}
  <div style="display:flex;gap:14px;margin-top:8px;font-size:12.5px;flex-wrap:wrap"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${C.grn}"></i> Capital pagado 17,80 M</span><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${C.yel}"></i> Intereses pagados 15,29 M</span></div></div>
 <div class="kpi" style="margin-top:12px"><div class="card"><span class="lab">Próxima cuota</span><b>1.481.066</b><span class="sub">10 oct · 540.450 son intereses</span></div>
  <div class="card"><span class="lab">Intereses que faltan</span><b class="y">11.049.708</b><span class="sub">en 37 cuotas</span></div>
  <div class="card"><span class="lab">Costo total del crédito</span><b>26.343.957</b><span class="sub">44 % de lo prestado</span></div>
  <div class="card"><span class="lab">Tu tasa</span><b>16,50 %</b><span class="sub">usura: 29,24 % · corriente: 19,49 %</span></div></div>
 <div class="h">Cómo se reparte cada cuota ${infoDot}</div>
 <div class="card"><div class="bars" style="height:96px">${[53, 51, 49, 47, 44, 41, 38, 35, 31, 27, 22, 17, 12, 6].map((p, k) => `<div style="height:100%;background:linear-gradient(180deg,${C.yel} ${p}%,${C.grn} ${p}%);opacity:${k < 4 ? .45 : 1}"></div>`).join('')}</div>
  <div class="note" style="margin-top:8px">Cada barra es un trimestre, las pálidas ya pagadas: arriba en amarillo los intereses, abajo en verde el capital. Al principio pesan más los intereses; al final, casi todo es capital. Por eso un abono temprano ahorra más.</div></div>
 ${blue('Un abono de 5.000.000 hoy te ahorra <b>2,78 M</b>. <b>Simular</b>')}`);

// The schedule: by year, folding, the paid ones ticked, the next one lit.
const cuota = (n, date, c, i, k, bal, state) => `<div class="row" style="padding:10px 14px;gap:10px${state === 'next' ? `;background:${tint(C.blu, .1)}` : ''}">
 <span style="width:30px;text-align:center;font-weight:600" class="${state === 'paid' ? 'mu' : ''}">${n}</span>
 <div class="tx"><b style="font-size:14.5px">${date}</b><small>capital ${k} · intereses <span class="y">${i}</span></small></div>
 <div class="am" style="font-size:14px">${c}<small class="mu">queda ${bal}</small></div>${state === 'paid' ? ic('checkmark-circle', 'g') : state === 'next' ? ic('ellipse-outline', 'p') : ic('ellipse-outline', 'mu')}</div>`;
S['11e-credito-cuotas'] = page(loanHead('Cuotas'), `
 <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span class="chip on">Todas</span><span class="chip">Faltan 37</span><span class="chip">Pagadas 23</span></div>
 <div class="list"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b>2026</b><small>12 cuotas · intereses 6,62 M</small></div>${ic('chevron-up-outline', 'mu')}</div>
  ${cuota(22, '10 ago', '1.481.066', '563.990', '875.076', '42.954.690', 'paid')}
  ${cuota(23, '10 sept', '1.481.066', '550.170', '888.896', '42.195.732', 'paid')}
  ${cuota(24, '10 oct', '1.481.066', '540.450', '898.616', '41.297.116', 'next')}
  ${cuota(25, '10 nov', '1.481.066', '528.940', '910.126', '40.386.990', '')}
  ${cuota(26, '10 dic', '1.481.066', '517.280', '921.786', '39.465.204', '')}</div>
 <div class="list" style="margin-top:8px"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b>2027</b><small>12 cuotas · intereses 5,12 M</small></div>${ic('chevron-down-outline', 'mu')}</div></div>
 <div class="list" style="margin-top:8px"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b>2028 – 2029</b><small>21 cuotas · intereses 3,64 M</small></div>${ic('chevron-down-outline', 'mu')}</div></div>
 <div class="note" style="margin:10px 4px">Cada cuota incluye 42.000 de seguros. Una cuota se marca pagada cuando registras el pago, no sola.</div>`);

// Paying capital ahead: the two answers the law lets the person choose (Ley
// 1555 de 2012), side by side, with what each saves. Nothing is written until
// "Registrar el abono".
const option = (on, icon, title, big, lines) => `<div class="card" style="padding:14px;${on ? `border-color:${C.grn};background:${tint(C.grn, .08)}` : ''}">
 <div style="display:flex;gap:8px;align-items:center">${ci(icon, on ? C.grn : C.blu, 32)}<b style="flex:1">${title}</b>${on ? tag('Ahorra más', C.grn) : ''}</div>
 <div style="font-size:22px;font-weight:700;margin:8px 0 2px" class="${on ? 'g' : ''}">${big}</div><div class="sub">${lines}</div></div>`;
S['11f-abono-a-capital'] = page(loanHead('Abonar'), `
 <div class="card" style="text-align:center;padding:14px"><div class="lab">Si abonas a capital</div><div style="font-size:34px;font-weight:700;margin:4px 0">5.000.000</div>
  <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">${['1 M', '2 M', '5 M', '10 M'].map(t => `<span class="chip ${t === '5 M' ? 'on' : ''}" style="padding:5px 12px">${t}</span>`).join('')}</div>
  ${seg([['Una vez'], ['Cada mes']], 'Una vez', 12)}</div>
 <div style="display:grid;gap:10px;margin-top:12px">
  ${option(true, 'hourglass-outline', 'Reducir el plazo', 'Ahorras 2.781.865', 'Terminas <b>5 cuotas antes</b> (mayo de 2029). La cuota sigue en 1.481.066.')}
  ${option(false, 'trending-down-outline', 'Reducir la cuota', 'Ahorras 1.309.340', 'La cuota baja a <b>1.310.543</b> (−170.523 al mes). Terminas igual, en sept 2029.')}</div>
 <div class="note" style="margin:10px 4px">Por ley (Ley 1555 de 2012) puedes abonar sin penalidad en créditos de hasta 880 salarios mínimos, y tú eliges cuál de las dos. Díselo al banco al pagar: si no, muchos reducen la cuota.</div>
 <div class="btn" style="margin-top:6px">${ic('checkmark')}Registrar el abono</div>`);

// Several debts: where an extra peso does the most. Avalanche (highest rate
// first) saves the most money; snowball (smallest balance first) closes one
// soonest. Both computed, the person chooses.
const step = (n, icon, c, name, why, when) => `<div class="row" style="align-items:flex-start"><span style="width:26px;height:26px;border-radius:50%;background:${tint(C.blu, .2)};color:var(--pr);display:grid;place-items:center;font-weight:700;font-size:13px;flex:none;margin-top:8px">${n}</span>${ci(icon, c, 40)}<div class="tx"><b class="one">${name}</b><small style="white-space:normal">${why}</small></div><div class="am" style="font-size:13px">${when}</div></div>`;
S['11g-estrategia-deudas'] = `${top('Salir de las deudas', { sub: 'Con 300.000 extra al mes' })}<main>
 <div class="field">${'<div class="lab">Puedo poner de más cada mes</div>'}<div class="v">300.000,00</div></div>
 ${seg([['Menos intereses', 'trending-down-outline'], ['Cerrar una rápido', 'flash-outline']], 'Menos intereses')}
 <div class="card hero" style="margin-top:12px">${two(fig('Ahorras en intereses', '3.214.000', 'g'), fig('Terminas', 'abr 2029'))}
  <div class="sub" style="margin-top:8px">Frente a pagar solo las cuotas: 5 meses antes. Con «Cerrar una rápido» ahorrarías 3.020.000 y la primera deuda se acaba en diciembre.</div></div>
 <div class="h">El orden ${infoDot}</div>
 <div class="list">${step(1, 'card-outline', C.yel, 'Tarjeta Coral', '26,80 % E.A.: la más cara. Paga el total de cada factura y abona aquí lo extra.', 'dic 2026')}
  ${step(2, 'cash-outline', C.pur, 'Libre inversión Banco Azul', '22,00 % E.A. · cuando la tarjeta esté en cero, su cuota y los 300.000 van aquí.', 'abr 2027')}
  ${step(3, 'car-sport-outline', C.cya, 'Crédito del carro', '16,50 % E.A. · al final, todo va aquí, reduciendo plazo.', 'abr 2029')}</div>
 <div class="note" style="margin:10px 4px">Es una recomendación hecha con tus cifras. Antes de abonar, revisa si alguna tiene seguro o penalidad (créditos de más de 880 SMMLV).</div>
 </main>`;

// ------------------------------------------------------------ credit cards
// The card's form gains an optional section: cut-off day, last day to pay,
// and its rate. Nothing else about the card changes (limit history, rule 11).
S['11h-tarjeta-fechas'] = `${top('Editar cuenta', { left: 'x' })}<main>
 <div style="display:flex;gap:12px;align-items:center;margin:4px 0 6px">${accIcon('coral', 52)}<div style="flex:1"><div class="lab">Nombre</div><b style="font-size:18px">Tarjeta Coral</b></div>${ic('pencil', 'p')}</div>
 ${field('Tipo', 'Tarjeta de crédito', down())}
 ${field('Cupo hoy', '8.000.000,00')}
 <div class="h">Fechas de la tarjeta · opcional ${infoDot}</div>
 ${two(field('Día de corte', '15 <span class="mu" style="font-size:13px">de cada mes</span>'), field('Pagar antes del', '5 <span class="mu" style="font-size:13px">del mes siguiente</span>'))}
 <div class="field" style="margin-top:10px"><div class="lab">Tasa de las compras a cuotas</div><div style="display:flex;align-items:center;gap:10px;margin-top:4px"><b style="font-size:17px;flex:1">26,80 %</b><div class="seg" style="padding:3px;flex:none"><div class="on" style="padding:6px 10px">E.A.</div><div style="padding:6px 10px">M.V.</div></div></div>
  <div class="sub" style="margin-top:6px">1,9966 % mes vencido · la cambias cuando el banco la cambie</div></div>
 ${field('Cuota de manejo', '32.900,00 <span class="mu" style="font-size:13px">al mes</span>')}
 ${field('La pagas desde', `<span style="display:flex;gap:8px;align-items:center">${accIcon('azul', 26)}Banco Azul</span>`, down())}
 <div class="row" style="padding:12px 4px"><div class="tx"><b>Recordarme 3 días antes de pagar</b><small>Un aviso del celular, sin internet</small></div>${sw(true)}</div>
 </main><div class="save">Guardar</div>`;

// What the dates buy: the statement as the app works it out from the
// movements - what closed at the last cut-off, what falls in the next one,
// paying in full against the minimum, and purchases in installments.
const inst = (icon, c, name, left, amt) => `<div class="row">${sq(icon, c, 38)}<div class="tx"><b class="one">${name}</b><small class="one">${left}</small></div><div class="am" style="font-size:14px">${amt}<small class="mu">este mes</small></div></div>`;
S['11i-tarjeta-factura'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}${accIcon('coral', 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Tarjeta Coral</b><div class="sub one">Corte el 15 · pagas el 5</div></div>${ic('pencil', 'p')}</div>
 ${seg([['Factura'], ['Movimientos'], ['A cuotas']], 'Factura', 10)}</div><main>
 <div class="card hero"><div class="lab">Factura del corte del 15 sept</div><div class="big">$ 3.806.400</div>
  <div class="sub">Págala completa antes del <b style="color:var(--tx)">domingo 5 de octubre</b> (faltan 6 días) y no pagas intereses.</div>
  <div style="display:flex;gap:8px;margin-top:12px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('swap-horizontal')}Pagar desde Banco Azul</span></div></div>
 ${amber('Si pagas solo el mínimo (612.300), el resto genera unos <b>63.800</b> de intereses este mes, y las compras nuevas también.')}
 <div class="kpi" style="margin-top:12px"><div class="card"><span class="lab">Deuda total</span><b>6.507.100</b><span class="sub">de 8.000.000 de cupo · 2.380.000 son cuotas futuras</span></div>
  <div class="card"><span class="lab">Desde el corte</span><b>320.700</b><span class="sub">van a la factura del 15 oct</span></div></div>
 <div class="h">Lo que cobra esta factura</div>
 <div class="list">${inst('laptop-outline', C.blu, 'Portátil · cuota 4 de 12', 'Quedan 1.600.000 de capital', '235.940')}
  ${inst('airplane-outline', C.cya, 'Tiquetes · cuota 2 de 6', 'Quedan 780.000 de capital', '214.470')}
  ${inst('card-outline', C.gry, 'Cuota de manejo', 'Cada mes', '32.900')}
  ${inst('basket-outline', C.grn, 'Compras a 1 cuota', '23 movimientos · sin intereses', '3.323.090')}</div><div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}`;

// Paying an installment: the one transfer form, with the split said. The
// capital is a transfer (it lowers the debt); the interest and the insurance
// are spending, under their own category. One tap, two lines in the ledger.
S['11j-pagar-cuota'] = `${top('Pagar cuota 24 de 60', { left: 'x' })}<main>
 <div class="amount" style="padding:10px 0 4px;text-align:center"><span class="v" style="font-size:40px">1.481.066</span><span class="cur">COP</span></div>
 <div class="list" style="margin-top:6px">
  <div class="row">${accIcon('azul', 38)}<div class="tx"><span class="k">Desde</span><b>Banco Azul</b></div>${down()}</div>
  <div class="row">${ci('car-sport-outline', C.cya, 38)}<div class="tx"><span class="k">Hacia</span><b>Crédito del carro</b></div></div>
  <div class="row">${ci('calendar-outline', C.blu, 38)}<div class="tx"><span class="k">Fecha</span><b>10 oct 2026</b></div>${down()}</div></div>
 <div class="h">Se registra así ${infoDot}</div>
 <div class="list">
  <div class="row">${ci('swap-horizontal', C.blu, 36)}<div class="tx"><b>Abono a capital</b><small>Transferencia · baja la deuda</small></div><div class="am p">898.616</div></div>
  <div class="row">${sq('trending-up-outline', C.yel, 36)}<div class="tx"><b>Intereses</b><small>Gasto · categoría Intereses</small></div><div class="am">540.450</div></div>
  <div class="row">${sq('shield-checkmark-outline', C.pur, 36)}<div class="tx"><b>Seguros</b><small>Gasto · categoría Seguros</small></div><div class="am">42.000</div></div></div>
 <div class="note" style="margin:10px 4px">¿El banco cobró otra cifra? Cambia cualquiera de las tres: se guarda lo que pagaste, y la tabla se ajusta desde aquí.</div>
 </main><div class="save">Registrar el pago</div>`;

// ------------------------------------------------------------ plans
// Limits and goals, Lukas's "Planes". Proposed home: the Reporte tab gets a
// second face, "Análisis | Planes" - plans are read beside the analysis of
// the same month - and Inicio shows only what needs attention.
const planHead = on => `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Planes</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nuevo</div></div>
 ${seg([['Límites', 'speedometer-outline'], ['Metas', 'flag-outline']], on, 10)}${periodBar('Septiembre 2026', 8)}</div>`;
const limit = (k, name, spent, of, p, left, c) => `<div class="card" style="margin-top:10px;padding:14px"><div style="display:flex;gap:10px;align-items:center">${catIcon(k, 38)}<div style="flex:1;min-width:0"><b class="one">${name}</b><div class="sub">${spent} de ${of}</div></div><b class="${c}" style="font-size:17px">${p} %</b></div>
 ${bar([[Math.min(p, 100), c === 'r' ? C.red : c === 'y' ? C.yel : C.grn]])}<div class="sub" style="margin-top:6px">${left}</div></div>`;
S['11k-planes-limites'] = page(planHead('Límites'), `
 <div class="card hero"><div class="lab">Llevas del total de tus límites</div><div class="big">1.620.000 <span class="mu" style="font-size:15px;font-weight:500">de 1.900.000</span></div>
  ${bar([[85, C.yel]], 9)}<div class="sub" style="margin-top:8px">Quedan 12 días del mes: puedes gastar <b style="color:var(--tx)">23.300 al día</b> en estas categorías.</div></div>
 ${amber('Mercado pasó su límite por 12.000.')}
 ${limit('mercado', 'Mercado', '1.212.000', '1.200.000', 101, 'Te pasaste por 12.000 · el mes pasado a esta fecha llevabas 980.000', 'r')}
 ${limit('rest', 'Restaurantes', '312.000', '400.000', 78, 'Quedan 88.000 · vas un poco más rápido que el mes', 'y')}
 ${limit('transp', 'Transporte', '96.000', '300.000', 32, 'Quedan 204.000', 'g')}`, 'Reporte');

const goal = (icon, c, name, where, have, of, p, line) => `<div class="card" style="margin-top:10px;padding:14px"><div style="display:flex;gap:10px;align-items:center">${ci(icon, c, 40)}<div style="flex:1;min-width:0"><b class="one">${name}</b><div class="sub one">${where}</div></div><b style="font-size:17px">${p} %</b></div>
 ${bar([[p, c]])}<div style="display:flex;justify-content:space-between;margin-top:6px" class="sub"><span>${have} de ${of}</span><span>${line}</span></div></div>`;
S['11l-planes-metas'] = page(planHead('Metas'), `
 <div class="card hero"><div class="lab">Tus metas</div><div class="big">8.830.000 <span class="mu" style="font-size:15px;font-weight:500">de 16.000.000</span></div>
  ${bar([[55, C.grn]], 9)}<div class="sub" style="margin-top:8px">Lo que tienen hoy las cuentas y productos de cada meta: no hay que registrar aportes aparte.</div></div>
 ${goal('airplane-outline', C.cya, 'Viaje a Cartagena', 'Ahorro Verde · Bolsillo Viaje', '1.380.000', '4.000.000', 35, 'marzo 2027 · 437.000 al mes')}
 ${goal('shield-outline', C.grn, 'Fondo de emergencia', 'Ahorro Verde · Cuenta de ahorros', '7.450.000', '12.000.000', 62, '6 meses de tus gastos')}
 ${blue('A este ritmo el viaje llega en mayo, dos meses tarde. Poner 437.000 cada mes lo deja a tiempo.')}`, 'Reporte');

S['11m-nuevo-limite'] = S['11k-planes-limites'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Nuevo límite</h2><span style="width:62px"></span></div>
 <div style="text-align:center;font-size:34px;font-weight:700;margin:4px 0 8px">400.000</div>
 <div class="list"><div class="row">${catIcon('rest', 38)}<div class="tx"><span class="k">Categoría</span><b>Restaurantes</b></div>${ic('pencil', 'p')}</div>
  <div class="row">${ci('calendar-outline', C.blu, 38)}<div class="tx"><span class="k">Cada</span><b>Mes · se renueva solo</b></div>${down()}</div>
  <div class="row">${ci('wallet-outline', C.blu, 38)}<div class="tx"><span class="k">Cuenta</span><b>Todas las cuentas</b></div>${down()}</div>
  <div class="row">${ci('notifications-outline', C.yel, 38)}<div class="tx"><b>Avisarme al 80 %</b><small>Un aviso del celular, sin internet</small></div>${sw(true)}</div></div>
 <div class="note" style="margin:10px 4px">Los últimos 3 meses gastaste en promedio 372.000 aquí.</div>
 <div class="btn" style="margin-top:8px">Guardar límite</div></div>`;

S['11n-nueva-meta'] = S['11l-planes-metas'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2 style="text-align:center">Nueva meta</h2><span style="width:62px"></span></div>
 <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">${ci('airplane-outline', C.cya, 46)}<div style="flex:1"><div class="lab">Nombre</div><b style="font-size:17px">Viaje a Cartagena</b></div>${ic('pencil', 'p')}</div>
 <div class="list"><div class="row">${ci('flag-outline', C.grn, 38)}<div class="tx"><span class="k">Quiero juntar</span><b>4.000.000</b></div></div>
  <div class="row">${ci('calendar-outline', C.blu, 38)}<div class="tx"><span class="k">Para</span><b>31 de marzo de 2027</b></div>${down()}</div>
  <div class="row" style="align-items:flex-start">${accIcon('verde', 38)}<div class="tx"><span class="k">La plata está en</span><b class="one">Ahorro Verde</b><small class="one">Bolsillo Viaje · tiene 1.380.000</small></div>${down()}</div></div>
 <div class="banner" style="background:${tint(C.grn, .1)};margin-top:10px">${ic('calculator-outline', 'g')}<span>Faltan 2.620.000 en 6 meses: <b>437.000 al mes</b>.</span></div>
 <div class="btn" style="margin-top:12px">Guardar meta</div></div>`;

// Inicio only says what needs attention: payments due within a week and a
// limit that is close or past. Tapping goes to the card, the loan or Planes.
S['11o-inicio-avisos'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:4px"><b class="one" style="font-size:18px">Todas las cuentas</b>${down()}</div><div class="one sub" style="font-size:12.5px">7 cuentas, todas incluidas</div></div></div>${periodBar()}</div><main>
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55</div></div>
 <div class="h">Esta semana</div>
 <div class="list">
  <div class="row">${accIcon('coral', 40)}<div class="tx"><b class="one">Pagar Tarjeta Coral</b><small class="y">Domingo 5 oct · en 6 días</small></div><div class="am">3.806.400</div>${chev()}</div>
  <div class="row">${sq('basket-outline', C.red, 40)}<div class="tx"><b class="one">Mercado pasó su límite</b><small>101 % de 1.200.000</small></div>${chev()}</div>
  <div class="row">${ci('car-sport-outline', C.cya, 40)}<div class="tx"><b class="one">Cuota del carro</b><small>Viernes 10 oct</small></div><div class="am">1.481.066</div>${chev()}</div></div>
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 <div class="card" style="height:150px;display:grid;place-items:center"><span class="mu">(el gráfico de siempre)</span></div>`;
S['11o-inicio-avisos'] += `<div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

export default S;
