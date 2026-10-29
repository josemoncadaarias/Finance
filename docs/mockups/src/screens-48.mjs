// Group 48 - "Salir de tus deudas": a plan for several debts (Jose,
// 2026-10-29). Proposed, not decided. Today only the assistant answers
// "¿qué deuda pago primero?"; this gives it a screen of its own in Deudas.
// - one question on top: how much more can you put in each month (the app
//   suggests what is usually left over);
// - two ways, said by what they get you: "Pagar menos intereses" (the highest
//   rate first, recommended) and "Cerrar una pronto" (the smallest first);
// - one answer: the month you are free of debts, what you save in interest and
//   how many months sooner than paying only the installments;
// - the order, each debt with the month it ends; the first marked as the one
//   that takes the extra; a tap says what to pay this month and opens it;
// - a card is paid by what the person usually pays it each month (read from
//   their transfers into it); its statement paid whole is said apart;
// - a debt too big to finish soon (a mortgage) keeps its installment, apart;
// - a debt with no rate is weighed at the month's legal maximum, and says so.
// Figures worked out by a month-by-month simulation (the engine of
// `debts-advice.ts`, `payMore`) on invented debts: Tarjeta Coral 4.200.000 at
// 28,5 % E.A. paying 220.000; Libre inversión 18.000.000 at 22 % (690.000);
// Crédito del carro 42.000.000 at 16,5 % (1.180.000); Crédito de estudio
// 2.500.000 at 12 % (150.000). From November 2026.
import { ic, C, PALETTE, tint, ci, sq, chev, down, tabs, status, tag } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 10) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}</div>`;
const note = t => `<div class="sub" style="margin:10px 6px 0;font-size:12.8px;line-height:1.4">${t}</div>`;
const amber = t => `<div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>${t}</span></div>`;
const blue = t => `<div class="banner" style="background:${tint(C.blu, .12)};margin-top:10px">${ic('bulb-outline', 'p')}<span>${t}</span></div>`;
const seg = (opts, on, mt = 12) => `<div class="seg" style="margin-top:${mt}px">${opts.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${i ? ic(i) : ''}${t}</div>`).join('')}</div>`;
const fig = (lab, v, cls = '') => `<div><span class="lab">${lab}</span><b class="${cls}" style="display:block;font-size:16.5px;margin-top:3px">${v}</b></div>`;
const two = (a, b) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${a}${b}</div>`;
const page = (head, body, after = '') => `${head}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Cuentas')}${after}`;
const head = (title = 'Salir de tus deudas') => `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}<h1 style="flex:1;font-size:21px">${title}</h1><div class="btn-r">${ic('information-circle-outline')}</div></div></div>`;
const $ = v => `$&nbsp;${v}`;

const D = {
  coral: [ci('card-outline', PALETTE.coral, 40), 'Tarjeta Coral', '28,5 % al año', '4.200.000'],
  libre: [ci('cash-outline', C.pur, 40), 'Libre inversión', '22 % al año', '18.000.000'],
  carro: [ci('car-sport-outline', C.cya, 40), 'Crédito del carro', '16,5 % al año', '42.000.000'],
  estudio: [ci('school-outline', C.grn, 40), 'Crédito de estudio', '12 % al año', '2.500.000'],
};

// How much more each month: the app suggests what is left over, the person decides.
const extraField = (v = '300.000', hint = `Te sobran unos ${$('640.000')} al mes, en promedio de los últimos 3 meses.`) => `<div class="field" style="margin-top:4px"><div class="lab">Puedo poner de más cada mes</div>
 <div class="v" style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:20px">${$(v)}</b>${ic('pencil', 'p')}</div></div>${hint ? note(hint) : ''}`;
const ways = on => seg([['Pagar menos intereses', 'trending-down-outline'], ['Cerrar una pronto', 'flash-outline']], on);

// The one answer.
const answer = (when, saved, sooner, extra = '') => `<div class="card hero" style="margin-top:12px"><div class="lab">Quedas sin deudas en</div><div class="big">${when}</div>
 ${two(fig('Te ahorras en intereses', saved, 'g'), fig('Terminas antes', sooner))}
 <div class="sub" style="margin-top:10px">Comparado con pagar solo las cuotas de siempre.</div>${extra}</div>`;

// When each debt ends: one bar per debt from now to its month.
const LAST = 33;
const span = (name, month, color, first = false) => `<div style="display:grid;grid-template-columns:96px 1fr;gap:8px;align-items:center;margin-top:7px">
 <span class="one" style="font-size:12.5px;color:var(--mu)">${name}</span><div style="height:12px;border-radius:6px;background:var(--s2);position:relative">
 <i style="position:absolute;left:0;top:0;bottom:0;width:${Math.round(month / LAST * 100)}%;border-radius:6px;background:${first ? color : tint(color, .55)}"></i></div></div>`;
const timeline = rows => `<div class="card" style="margin-top:12px;padding:12px 14px"><b style="font-size:14.5px">Cuándo se acaba cada una, desde hoy</b>${rows}
 <div style="position:relative;height:16px;font-size:11.5px;color:var(--mu);margin:6px 0 0 104px"><span style="position:absolute;left:${Math.round(2 / LAST * 100)}%">2027</span><span style="position:absolute;left:${Math.round(14 / LAST * 100)}%">2028</span><span style="position:absolute;left:${Math.round(26 / LAST * 100)}%">2029</span></div></div></div>`;

// One step of the order.
const step = (n, k, why, when, first = false) => {
  const [icon, name, rate, owed] = D[k];
  return `<div class="row" style="align-items:flex-start"><span style="width:26px;height:26px;border-radius:50%;background:${first ? C.blu : tint(C.blu, .2)};color:${first ? '#fff' : 'var(--pr)'};display:grid;place-items:center;font-weight:700;font-size:13px;flex:none;margin-top:8px">${n}</span>${icon}
 <div class="tx"><b style="white-space:normal">${name}</b><small>Debes ${$(owed)}</small><small>${rate}</small><small style="white-space:normal">${why}</small>${first ? `<div style="margin-top:6px">${tag('Aquí va lo de más', C.blu)}</div>` : ''}</div>
 <div class="am" style="font-size:13.5px;text-align:right">Se acaba<br><b>${when}</b></div></div>`;
};

const avalanche = `<div class="h">En este orden</div><div class="list">
 ${step(1, 'coral', 'La más cara. Le pagas lo de siempre y los 300.000 de más.', 'jul 2027', true)}
 ${step(2, 'libre', 'Cuando se acabe la tarjeta, su pago y lo de más van aquí.', 'ago 2028')}
 ${step(3, 'carro', 'Al final, todo lo que liberaste va al carro.', 'jul 2029')}
 ${step(4, 'estudio', 'La más barata: sigue con su cuota y se acaba sola.', 'may 2028')}</div>`;
const avalancheLine = timeline(`${span('Tarjeta Coral', 9, PALETTE.coral, true)}${span('Libre inversión', 22, C.pur)}${span('Estudio', 19, C.grn)}${span('Carro', 33, C.cya)}`);

// 48a - Deudas: one card leads to the plan.
const faces = `<div class="seg" style="margin-top:10px">${[['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']].map(([t, i]) => `<div class="${t === 'Deudas' ? 'on' : ''}">${ic(i)}${t}</div>`).join('')}</div>`;
const debtsHead = `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1><div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva deuda</div></div>${faces}</div>`;
const debtRow = (k, line) => { const [icon, name, rate, owed] = D[k]; return `<div class="row">${icon}<div class="tx"><b class="one">${name}</b><small style="white-space:normal">${rate} · ${line}</small></div><div class="am">${owed}</div>${chev()}</div>`; };
S['48a-deudas-con-plan'] = page(debtsHead, `<div class="card hero"><div class="lab">Debes hoy</div><div class="big">${$('66.700.000')}</div>
 <div class="sub" style="margin-top:6px">En 4 deudas: 1 tarjeta y 3 préstamos.</div></div>
 <div class="card" style="margin-top:12px;display:flex;gap:12px;align-items:center;border:1px solid ${tint(C.blu, .5)}">${ci('flag-outline', C.blu, 46)}
 <div style="flex:1"><b style="font-size:16px">Salir de tus deudas</b><div class="sub" style="margin-top:3px">Con ${$('300.000')} de más al mes quedas libre en <b style="color:var(--tx)">julio de 2029</b> y te ahorras ${$('3.615.750')} en intereses.</div></div>${chev()}</div>
 <div class="h">Tarjetas · 1</div><div class="list">${debtRow('coral', 'pagas unos 220.000 al mes')}</div>
 <div class="h">Préstamos · 3</div><div class="list">${debtRow('carro', 'cuota 1.180.000')}${debtRow('libre', 'cuota 690.000')}${debtRow('estudio', 'cuota 150.000')}</div>`);

// 48b - the plan, recommended way.
S['48b-plan-menos-intereses'] = page(head(), `${extraField()}${ways('Pagar menos intereses')}
 ${answer('julio de 2029', $('3.615.750'), '6 meses')}${avalancheLine}${avalanche}
 ${note('Es un cálculo con tus cifras de hoy, no un consejo financiero. Si una tasa cambia, el plan cambia.')}`);

// 48c - the other way: one debt closed soon, at a little more interest.
S['48c-plan-cerrar-una'] = page(head(), `${extraField()}${ways('Cerrar una pronto')}
 ${answer('julio de 2029', $('3.371.677'), '6 meses', `<div class="sub" style="margin-top:8px">Cierras la primera en <b style="color:var(--tx)">abril de 2027</b>. Pagas ${$('244.073')} más de intereses que con «Pagar menos intereses».</div>`)}
 ${timeline(`${span('Estudio', 6, C.grn, true)}${span('Tarjeta Coral', 12, PALETTE.coral)}${span('Libre inversión', 22, C.pur)}${span('Carro', 33, C.cya)}`)}
 <div class="h">En este orden</div><div class="list">
 ${step(1, 'estudio', 'La más pequeña. Le pagas su cuota y los 300.000 de más.', 'abr 2027', true)}
 ${step(2, 'coral', 'Después, la tarjeta recibe lo que pagabas al estudio.', 'oct 2027')}
 ${step(3, 'libre', 'Luego el libre inversión.', 'ago 2028')}
 ${step(4, 'carro', 'Al final, todo va al carro.', 'jul 2029')}</div>`);

// 48d - the (i): which way suits me.
const wayCard = (icon, t, s, rec = false) => `<div class="row" style="align-items:flex-start">${ci(icon, C.blu, 40)}<div class="tx"><b>${t}</b>${rec ? `<div style="margin:4px 0">${tag('Recomendado', C.grn)}</div>` : ''}<small style="white-space:normal">${s}</small></div></div>`;
S['48d-cual-me-conviene'] = S['48b-plan-menos-intereses'] + sheet(`<h2 style="text-align:center;font-size:19px;margin-bottom:12px">¿Cuál me conviene?</h2><div class="list">
 ${wayCard('trending-down-outline', 'Pagar menos intereses', 'Lo de más va primero a la deuda con la tasa más alta. Es la que menos intereses te hace pagar en total.', true)}
 ${wayCard('flash-outline', 'Cerrar una pronto', 'Lo de más va primero a la deuda más pequeña. Pagas un poco más de intereses, pero ves una deuda cerrada antes, y eso ayuda a seguir.')}</div>
 <div class="list" style="margin-top:12px">${wayCard('repeat-outline', 'En los dos casos', 'Cada deuda sigue con su cuota. Cuando una se acaba, lo que le pagabas pasa a la siguiente.')}</div>
 ${note('En Colombia puedes abonar a un crédito en pesos sin multa (Ley 1555 de 2012). Cuando abones, dile al banco que lo use para reducir el plazo.')}<div style="height:6px"></div>`);

// 48e - changing the amount: what each amount gets you, side by side.
const opt = (v, when, saved, on = false) => `<div class="row">${on ? ic('checkmark-circle', 'p') : ic('ellipse-outline', 'mu')}<div class="tx"><b>${$(v)} al mes</b><small>Sin deudas en ${when}</small></div><div class="am g">${saved}</div></div>`;
S['48e-cuanto-poner'] = S['48b-plan-menos-intereses'] + sheet(`<h2 style="text-align:center;font-size:19px">¿Cuánto puedes poner de más?</h2>
 <div class="sub" style="text-align:center;margin:4px 0 12px">Te sobran unos ${$('640.000')} al mes</div>
 <div class="field"><div class="lab">Otro valor</div><div class="v">300.000</div></div>
 <div class="h" style="display:flex;justify-content:space-between"><span>Con más, sales antes</span><span>Te ahorras</span></div><div class="list">
 ${opt('100.000', 'noviembre de 2029', '1.418.346')}${opt('300.000', 'julio de 2029', '3.615.750', true)}${opt('500.000', 'abril de 2029', '5.296.197')}${opt('1.000.000', 'noviembre de 2028', '8.233.770')}</div>
 <div class="btn" style="margin-top:14px">Usar ${$('300.000')}</div><div style="height:4px"></div>`);

// 48f - one debt tapped: what to pay it this month, and where to do it.
const line = (k, v, cls = '') => `<div class="row plain"><div class="tx"><span class="mu" style="font-size:14px">${k}</span></div><b class="${cls}" style="font-weight:500">${v}</b></div>`;
S['48f-este-mes'] = S['48b-plan-menos-intereses'] + sheet(`<div style="text-align:center">${centred(ci('card-outline', PALETTE.coral, 52))}<h2 style="font-size:19px">Tarjeta Coral</h2>
 <div class="sub" style="margin-top:4px">Es la primera: aquí va lo de más</div></div>
 <div class="h">En noviembre págale</div><div class="list">${line('Lo que le pagas siempre', $('220.000'))}${line('Lo de más', $('300.000'))}${line('En total', $('520.000'), 'p')}</div>
 ${note('Primero paga la factura completa antes del 5 de noviembre: así el banco no te cobra intereses sobre ella.')}
 <div class="btn" style="margin-top:14px">${ic('swap-horizontal')}Pagar ${$('520.000')} a la tarjeta</div>
 <div class="btn ghost" style="margin-top:8px">Ver la tarjeta</div><div style="height:4px"></div>`);

// 48g - a mortgage: too big to finish soon, it keeps its installment, said apart.
S['48g-hipoteca-aparte'] = page(head(), `${extraField()}${ways('Pagar menos intereses')}
 ${answer('julio de 2029', $('3.615.750'), '6 meses', `<div class="sub" style="margin-top:8px">Sin contar el crédito de vivienda, que sigue con su cuota.</div>`)}
 ${avalanche.replace(/<div class="h">En este orden<\/div>/, '<div class="h">En este orden</div>')}
 <div class="h">Aparte</div><div class="list"><div class="row" style="align-items:flex-start">${ci('home-outline', PALETTE.mandarina, 40)}<div class="tx"><b>Crédito de vivienda</b><small>Debes ${$('180.000.000')} · 12,9 % al año</small>
 <small style="white-space:normal">Es muy grande para terminarlo pronto: sigue con su cuota. Cuando salgas de las otras, puedes abonarle lo que liberaste.</small></div><div class="am" style="font-size:13.5px;text-align:right">Se acaba<br><b>mar 2041</b></div></div></div>`);

// 48h - a debt with no rate: weighed at the legal maximum, and asked.
S['48h-sin-tasa'] = page(head(), `${extraField()}${ways('Pagar menos intereses')}
 ${amber(`No sé la tasa de <b>Tarjeta Coral</b>. Uso la máxima legal de octubre (29,24 % al año) para ordenarla. <b>Poner su tasa</b>`)}
 ${answer('julio de 2029', $('3.646.327'), '6 meses')}${avalanche.replace('28,5 % al año', 'tasa no conocida')}`);

// 48i - nothing left over: said plainly; the plan still shows paying only the installments.
S['48i-no-te-sobra'] = page(head(), `${extraField('0', '')}
 ${amber(`En los últimos 3 meses gastaste más de lo que te entró, unos ${$('180.000')} al mes. Cuando puedas poner algo de más, aquí verás cuánto ganas.`)}
 <div class="card hero" style="margin-top:12px"><div class="lab">Solo con las cuotas, terminas en</div><div class="big">enero de 2030</div>
 <div class="sub" style="margin-top:8px">Y pagas ${$('20.224.700')} en intereses en total.</div></div>
 ${blue(`Con solo ${$('100.000')} de más al mes te ahorrarías ${$('1.418.346')}.`)}
 <div class="h">Cuándo se acaba cada una</div><div class="list">
 ${step(1, 'estudio', 'Con su cuota.', 'may 2028')}${step(2, 'coral', 'Con lo que le pagas siempre.', 'ago 2028')}${step(3, 'libre', 'Con su cuota.', 'abr 2029')}${step(4, 'carro', 'Con su cuota.', 'ene 2030')}</div>`);

// 48j - one debt alone: nothing to order, only what paying more does.
S['48j-una-deuda'] = page(head('Pagar antes tu deuda'), `${extraField()}
 <div class="card hero" style="margin-top:12px"><div class="lab">Terminas el crédito del carro en</div><div class="big">octubre de 2029</div>
 ${two(fig('Te ahorras en intereses', $('3.894.143'), 'g'), fig('Terminas antes', '12 meses'))}
 <div class="sub" style="margin-top:10px">Comparado con pagar solo la cuota de ${$('1.180.000')}.</div></div>
 <div class="list" style="margin-top:12px">${step(1, 'carro', 'Le pagas su cuota y los 300.000 de más, reduciendo el plazo.', 'oct 2029', true)}</div>
 ${note('Con una sola deuda no hay orden que elegir: todo lo de más va a ella.')}`);

// 48k - no debts: nothing to plan.
S['48k-sin-deudas'] = page(head(), `<div class="card" style="text-align:center;padding:28px 16px;margin-top:12px">${centred(ci('happy-outline', C.grn, 60))}<b style="font-size:17px">No tienes deudas</b>
 <div class="sub" style="margin-top:6px">Cuando agregues una tarjeta o un préstamo, aquí verás cómo salir de ellos antes.</div>
 <div class="btn" style="margin-top:14px">${ic('add')}Agregar una deuda</div></div>`);

// 48l - the assistant sends here: its answer ends with the button.
const bubble = (t, me = false) => `<div style="display:flex;justify-content:${me ? 'flex-end' : 'flex-start'};margin-top:10px"><div style="max-width:84%;padding:10px 13px;border-radius:16px;background:${me ? C.blu : 'var(--s1)'};color:${me ? '#fff' : 'var(--tx)'};font-size:14.5px;line-height:1.4">${t}</div></div>`;
S['48l-desde-el-asistente'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ic('chevron-back-outline', 'back')}<h1 style="flex:1;font-size:21px">Asistente</h1></div></div><main>
 ${bubble('¿Qué deuda pago primero?', true)}
 ${bubble(`Primero la <b>Tarjeta Coral</b>: es la más cara (28,5 % al año). Después el libre inversión y al final el carro.`)}
 <div class="card" style="margin-top:10px"><b>Con ${$('300.000')} de más al mes</b><div class="sub" style="margin-top:4px">Quedas sin deudas en julio de 2029 y te ahorras ${$('3.615.750')}.</div>
 <div class="btn" style="margin-top:12px">${ic('flag-outline')}Ver mi plan para salir de las deudas</div></div></main>`;

export default S;
