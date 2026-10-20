// Group 40 - the assistant answers about the whole picture (Jose, 2026-10-19):
// how the period is going, where the money went, what is owed, which debt to
// pay first and why, what is due, what one has. Every figure would come from
// the engines already there (the report's sections, the cards' statements,
// the loans' schedules, caps, goals); never a second computation. Figures
// and names invented.
import { ic, C, tint, top, ci, sq, catIcon } from './lib.mjs';

const S = {};
const keep = t => t.replace(/(\d) %/g, '$1\u00a0%').replace(/(\d) (E\.A|M\.V)/g, '$1\u00a0$2').replace(/\$ /g, '$ ').replace(/(\d) (mil|millones)/g, '$1 $2').replace(/(\d+) de (octubre|noviembre|enero|marzo|julio)/g, '$1 de $2');
const me = t => `<div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="max-width:78%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.35;text-wrap:pretty">${keep(t)}</div></div>`;
const app = t => `<div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">${ci('sparkles-outline', C.blu, 30)}<div style="max-width:82%;background:var(--s1);border:1px solid #1c2944;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.4;text-wrap:pretty">${keep(t)}</div></div>`;
const card = (inner, border = '#22314f') => `<div style="margin:8px 0 0 38px;text-wrap:pretty;background:var(--s1);border:1px solid ${border};border-radius:18px;padding:12px 14px">${keep(inner)}</div>`;
const chips = (...t) => `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0 38px">${t.map(x => `<span class="chip" style="color:var(--pr)">${x}</span>`).join('')}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13.8px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:600;white-space:nowrap">${v}</b></div>`;
const lab = (t, mt = 12) => `<div class="lab" style="margin:${mt}px 0 2px">${t}</div>`;
const note = t => `<div class="sub" style="margin-top:8px;font-size:12.5px;line-height:1.4">${t}</div>`;
const btns = (a, b) => `<div style="display:grid;grid-template-columns:${b ? '1fr 1fr' : '1fr'};gap:8px;margin-top:12px"><div class="btn ghost" style="height:42px">${a}</div>${b ? `<div class="btn" style="height:42px">${b}</div>` : ''}</div>`;
const band = (icon, cls, c, t) => `<div style="display:flex;align-items:center;gap:10px;background:${tint(c, .14)};margin:-12px -14px 8px;padding:12px 14px;border-radius:17px 17px 0 0">${ic(icon, cls)}<b class="${cls}">${t}</b></div>`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 16px 24px;background:#0b1324;border-top:1px solid #18243d;display:flex;gap:10px;align-items:center">
 <div class="search" style="flex:1;padding:12px 14px">Escribe o habla</div>
 <span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;color:#fff;flex:none">${ic('mic-outline', '', 'width:22px;height:22px')}</span></div>`;
const chat = body => `${top('Asistente', { sub: 'Registra o pregunta, por texto o por voz' })}<main style="padding-bottom:110px">${body}</main>${bar}`;
// A ranked row with its bar, as the report draws "En qué se fue".
const ranked = (k, name, amount, pct, change, cls) => `<div style="padding:8px 0;border-top:1px solid var(--line)">
 <div style="display:flex;align-items:center;gap:10px">${catIcon(k, 30)}<b style="flex:1;font-size:14px;font-weight:500">${name}</b><b style="white-space:nowrap;font-weight:600">${amount}</b></div>
 <div style="display:flex;align-items:center;gap:10px;margin:6px 0 0 40px"><div style="flex:1;height:6px;border-radius:3px;background:var(--s3)"><div style="width:${pct}%;height:6px;border-radius:3px;background:var(--pr)"></div></div><small class="${cls}" style="white-space:nowrap;font-size:12.5px">${change}</small></div></div>`;
// One debt, as the debts' answers list it.
const debt = (icon, c, name, owed, rows, shape = 'ci') => `<div style="padding:10px 0;border-top:1px solid var(--line)">
 <div style="display:flex;align-items:center;gap:10px">${(shape === 'ci' ? ci : sq)(icon, c, 34)}<b style="flex:1;font-size:14.5px">${name}</b><b style="white-space:nowrap">${owed}</b></div>
 ${rows.map(r => `<div class="sub" style="margin:4px 0 0 44px;font-size:13px;line-height:1.4">${r}</div>`).join('')}</div>`;
const step = (n, c, title, rows) => `<div style="display:flex;gap:10px;padding:10px 0;border-top:1px solid var(--line)">
 <span style="width:26px;height:26px;border-radius:50%;background:${tint(c, .2)};color:${c};display:grid;place-items:center;font-weight:700;font-size:13px;flex:none">${n}</span>
 <div style="flex:1"><b style="font-size:14.5px">${title}</b>${rows.map(r => `<div class="sub" style="margin-top:4px;font-size:13px;line-height:1.4">${r}</div>`).join('')}</div></div>`;

// 40a - the welcome lists the new questions too.
S['40a-asistente-preguntas'] = chat(`
 <div style="text-align:center;margin:18px 0 6px">${ci('sparkles-outline', C.blu, 60).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:19px">¿Qué quieres hacer?</b>
  <div class="sub" style="margin-top:6px">Todo se calcula con tus datos, en tu celular. Nada sale de él.</div></div>
 <div class="h">Registrar</div>
 <div class="list">
  <div class="row plain">${ic('arrow-up', 'r')}<div class="tx"><b>«Gasté 45 mil en el mercado»</b></div></div>
  <div class="row plain">${ic('swap-horizontal', 'p')}<div class="tx"><b>«Pasé 200 mil a Ahorros»</b></div></div></div>
 <div class="h">Tu mes</div>
 <div class="list">
  <div class="row plain">${ic('pulse-outline', 'p')}<div class="tx"><b>«¿Cómo voy este mes?»</b></div></div>
  <div class="row plain">${ic('pie-chart-outline', 'p')}<div class="tx"><b>«¿En qué gasté más?»</b></div></div>
  <div class="row plain">${ic('help-circle-outline', 'p')}<div class="tx"><b>«¿Me alcanza para unos tenis de 300 mil?»</b></div></div></div>
 <div class="h">Tus deudas</div>
 <div class="list">
  <div class="row plain">${ic('card-outline', 'p')}<div class="tx"><b>«¿Cuánto debo?»</b></div></div>
  <div class="row plain">${ic('flag-outline', 'p')}<div class="tx"><b>«¿Qué deuda pago primero?»</b></div></div>
  <div class="row plain">${ic('calendar-outline', 'p')}<div class="tx"><b>«¿Qué pagos tengo este mes?»</b></div></div></div>`);

// 40b - "¿Cómo voy?": the report's headline and comparison for the period
// said ("este mes" by default; "en septiembre", "este año", "esta semana").
S['40b-como-voy'] = chat(`
 ${me('¿Cómo voy este mes?')}
 ${app('Vas bien: llevas <b>$ 1.260.000 ahorrados</b> en octubre, $ 340.000 más que a esta altura de septiembre.')}
 ${card(`<div class="lab" style="margin-bottom:2px">Octubre, del 1 al 19</div>
  ${line('Entró', '+$ 5.400.000', 'g')}
  ${line('Salió', '−$ 4.140.000', 'r')}
  ${line('Ahorrado', '$ 1.260.000 · 23 %', 'g')}
  ${lab('Contra septiembre, mismos días')}
  ${line('Gastaste', '6 % menos', 'g')}
  ${line('Lo que más subió', 'Restaurantes · +$ 58.000', 'y')}
  ${line('Lo que más bajó', 'Transporte · −$ 120.000', 'g')}
  ${lab('Tus topes')}
  ${line('Restaurantes', '82 % usado', 'y')}
  ${line('Los demás', 'Bajo control', 'g')}
  ${lab('Lo que te queda')}
  ${line('Libre para el resto del mes', '$ 950.000')}
  ${line('Para gastar cada día', '$ 73.100')}
  ${btns('Ver el reporte')}`)}
 ${chips('¿En qué gasté más?', '¿Y el mes pasado?', '¿Cómo voy este año?')}`);

// 40c - "¿En qué gasté más?": the report's ranking, with the change against
// the same days of the period before.
S['40c-en-que-gaste'] = chat(`
 ${me('¿En qué gasté más este mes?')}
 ${app('Tu mayor gasto fue <b>Vivienda</b>, $ 1.400.000. Lo que más creció frente a septiembre fue Restaurantes.')}
 ${card(`<div class="lab" style="margin-bottom:2px">Octubre, del 1 al 19 · $ 4.140.000</div>
  ${ranked('vivienda', 'Vivienda', '$ 1.400.000', 100, 'igual', 'mu')}
  ${ranked('mercado', 'Mercado', '$ 820.000', 59, '−4 %', 'g')}
  ${ranked('rest', 'Restaurantes', '$ 412.000', 29, '+16 %', 'r')}
  ${ranked('transp', 'Transporte', '$ 310.000', 22, '−28 %', 'g')}
  ${ranked('servicios', 'Servicios', '$ 286.000', 20, '+2 %', 'mu')}
  ${note('Y 6 categorías más por $ 912.000. El cambio es contra los mismos 19 días de septiembre.')}
  ${btns('Ver todas las categorías')}`)}
 ${chips('¿Cuánto llevo en restaurantes?', '¿Cómo voy este mes?')}`);

// 40d - "¿Cuánto debo?": each debt with what it costs, from the cards'
// statements and the loans' schedules.
S['40d-cuanto-debo'] = chat(`
 ${me('¿Cuánto debo?')}
 ${app('Debes <b>$ 224.700.000</b> en 4 deudas. Este mes te cuestan unos <b>$ 2.360.000 en intereses</b>, casi todo de la hipoteca.')}
 ${card(`${line('Tarjetas · 1', '$ 2.400.000')}
  ${line('Préstamos · 3', '$ 222.300.000')}
  ${line('Intereses este mes', '$ 2.360.000', 'r')}
  ${debt('card-outline', C.yel, 'Tarjeta Visa', '$ 2.400.000', ['Factura de $ 1.150.000 · vence el 25 de octubre', 'Tasa 28,5 % E.A. · intereses del mes $ 50.600'])}
  ${debt('phone-portrait-outline', C.pur, 'Celular', '$ 1.800.000', ['Tasa 33,9 % E.A. · 9 cuotas de $ 210.000', 'Intereses que faltan $ 262.000'], 'sq')}
  ${debt('car-outline', C.org, 'Carro', '$ 38.500.000', ['Tasa 16,5 % E.A. · 31 cuotas de $ 1.480.000', 'Intereses que faltan $ 8.900.000'], 'sq')}
  ${debt('home-outline', C.cya, 'Hipoteca', '$ 182.000.000', ['Tasa 12,3 % E.A. · 211 cuotas de $ 1.950.000', 'Intereses que faltan $ 229.000.000'], 'sq')}
  ${btns('Ver mis deudas')}`)}
 ${chips('¿Qué deuda pago primero?', '¿Qué pagos tengo este mes?')}`);

// 40e - "¿Qué deuda pago primero?": what costs most per peso and can be
// closed comes first; a debt too big to close soon is said apart, with why.
// Each saving is the schedule's own figure: interest left now against paying
// it off today (cards: paying the whole statement means no interest).
S['40e-que-pago-primero'] = chat(`
 ${me('¿Qué deuda pago primero?')}
 ${app('Primero la <b>factura de la Visa</b>: pagándola completa no te cobran intereses. Después el <b>Celular</b>: es la tasa más alta y la puedes cerrar pronto.')}
 ${card(`${lab('En este orden', 0)}
  ${step(1, C.yel, 'Factura de la Visa · $ 1.150.000', ['Antes del 25 de octubre.', 'Si pagas solo el mínimo, el resto paga 28,5 % E.A.'])}
  ${step(2, C.pur, 'Celular · $ 1.800.000', ['La tasa más alta: 33,9 % E.A.', 'Con lo que te queda libre cada mes la cierras en unos 2 meses.', 'Si la pagas hoy te ahorras <b class="g">$ 262.000</b> de intereses.'])}
  ${step(3, C.org, 'Carro · $ 38.500.000', ['16,5 % E.A. Cuando cierres el celular, abona aquí la cuota que pagabas.', 'Cada abono acorta el plazo: tú le dices al banco que sea al plazo.'])}
  ${lab('No te la recomiendo de primera')}
  ${debt('home-outline', C.cya, 'Hipoteca · $ 182.000.000', '', ['Es la tasa más baja (12,3 % E.A.) y el saldo es muy grande para cerrarla pronto.', 'Sigue con su cuota. Abonar aquí rinde menos que en las otras.'], 'sq')}
  ${note('Es una sugerencia con tus cifras: no tiene en cuenta multas, seguros que cambien ni lo que te diga tu banco. Abonar a capital es tu derecho y no tiene penalidad (Ley 1555 de 2012).')}
  ${btns('Pagar la factura', 'Abonar al celular')}`)}
 ${chips('¿Y si abono 500 mil al mes?', '¿Cuánto debo?')}`);

// 40f - "¿Y si abono X al mes?": the extra goes to the first of the order and,
// once it is closed, to the next one (its installment too). The loans'
// schedule engine works it out; nothing is written.
S['40f-si-abono'] = chat(`
 ${me('¿Y si abono 500 mil al mes?')}
 ${app('Abonando <b>$ 500.000 al mes</b> en ese orden te ahorras unos <b>$ 3.640.000 en intereses</b> y sales del carro 19 meses antes.')}
 ${card(`${lab('Así irían cerrando', 0)}
  ${line('Celular', 'enero 2027 · antes julio 2027')}
  ${line('Carro', 'octubre 2028 · antes mayo 2030')}
  ${line('Hipoteca', 'sigue con su cuota')}
  ${lab('Lo que ahorras')}
  ${line('Intereses del celular', '$ 118.000', 'g')}
  ${line('Intereses del carro', '$ 3.522.000', 'g')}
  ${line('En total', '$ 3.640.000', 'g')}
  ${note('Cuando cierras una deuda, su cuota se suma al abono de la siguiente. ¿Te alcanzan los $ 500.000? Este mes te quedan $ 950.000 libres.')}
  ${btns('Ver el carro')}`)}
 ${chips('¿Y con 1 millón?', '¿Qué deuda pago primero?')}`);

// 40g - a card with no rate on record: asked once, with a reference until then.
S['40g-tarjeta-sin-tasa'] = chat(`
 ${me('¿Qué deuda pago primero?')}
 ${app('Para comparar tu <b>Tarjeta Visa</b> con los préstamos necesito su tasa, y no la tengo. ¿Cuál te cobra el banco?')}
 ${card(`${line('Tarjeta Visa', 'Debes $ 2.400.000')}
  ${line('Tasa', 'Sin escribir', 'y')}
  ${note('La encuentras en el extracto o en la app del banco, como «tasa de interés E.A.» o «M.V.». Mientras no la escribas, uso la tasa máxima legal del mes como referencia: las tarjetas suelen cobrar cerca de ella.')}
  ${btns('Usar la de referencia', 'Escribir la tasa')}`, tint(C.yel, .4))}
 ${me('2,1 % mensual')}
 ${app('Listo: 2,1 % M.V. son <b>28,3 % E.A.</b> Lo guardé en la Visa para la próxima.')}`);

// 40h - "¿Qué pagos tengo este mes?": cards' statements and loans' installments
// still to pay, with the day and where they usually leave from.
S['40h-pagos-del-mes'] = chat(`
 ${me('¿Qué pagos tengo este mes?')}
 ${app('Te quedan <b>3 pagos</b> hasta el 31 de octubre, por $ 3.640.000. Ninguno está atrasado.')}
 ${card(`${debt('card-outline', C.yel, 'Factura Visa', '$ 1.150.000', ['Vence el 25 de octubre · sale de Bancolombia'])}
  ${debt('car-outline', C.org, 'Cuota del carro', '$ 1.480.000', ['El 28 de octubre · sale de Bancolombia'], 'sq')}
  ${debt('phone-portrait-outline', C.pur, 'Cuota del celular', '$ 210.000', ['El 30 de octubre · sale de Nequi'], 'sq')}
  ${line('En total', '$ 3.640.000')}
  ${line('Bancolombia tiene', '$ 2.900.000')}
  ${line('Le faltan para sus pagos', '$ 270.000', 'r')}
  ${note('La hipoteca ya está pagada este mes.')}
  ${btns('Ver mis deudas')}`, tint(C.yel, .4))}
 ${chips('¿Qué deuda pago primero?', '¿Cuánto me queda libre?')}`);

// 40i - "¿Cuánto tengo?": net worth said as what one has and owes; one
// account named answers for that account.
S['40i-cuanto-tengo'] = chat(`
 ${me('¿Cuánto tengo?')}
 ${app('Tienes <b>$ 48.215.300</b> en tus cuentas y debes $ 224.700.000. Tu patrimonio hoy es <b class="r">−$ 176.484.700</b>, por la hipoteca.')}
 ${card(`${line('Lo que tienes · 6 cuentas', '$ 48.215.300', 'g')}
  ${line('Lo que debes · 4 deudas', '−$ 224.700.000', 'r')}
  ${line('Patrimonio', '−$ 176.484.700')}
  ${note('Sin contar lo que tienes fuera del patrimonio ni los intereses que aún no pasas a tu saldo.')}
  ${btns('Ver mis cuentas')}`)}
 ${me('¿Y en Nequi?')}
 ${app('Nequi tiene <b>$ 640.000</b>. El 30 de octubre sale de ahí la cuota del celular, $ 210.000.')}`);

// 40j - "¿Cómo van mis topes y metas?": the caps and goals screens, in words.
S['40j-topes-y-metas'] = chat(`
 ${me('¿Cómo van mis topes y mis metas?')}
 ${app('De tus 4 topes, <b>uno va justo</b>: Restaurantes, al 82 %. De tus 3 metas, el Viaje va atrasado.')}
 ${card(`${lab('Topes de octubre', 0)}
  ${line('Restaurantes', '$ 412.000 de $ 500.000', 'y')}
  ${line('Mercado', '$ 820.000 de $ 1.200.000', 'g')}
  ${line('Ropa', '$ 180.000 de $ 400.000', 'g')}
  ${line('Ocio', '$ 90.000 de $ 300.000', 'g')}
  ${lab('Metas')}
  ${line('Viaje a Cartagena', '$ 2.350.000 de $ 6.000.000', 'y')}
  ${note('Para llegar en junio te faltan $ 456.250 al mes; a tu ritmo llegarías en septiembre.')}
  ${line('Fondo de emergencia', 'Lograda', 'g')}
  ${line('Carro', '$ 1.900.000 de $ 30.000.000')}
  ${btns('Ver presupuestos')}`)}
 ${chips('¿Cómo calculas lo de mis metas?', '¿Cómo voy este mes?')}`);

export default S;
