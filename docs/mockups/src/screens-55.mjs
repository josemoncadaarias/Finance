// Group 55 - follow-up questions in the assistant's chat (Jose, 2026-11-06):
// "¿y el mes pasado?", "¿y en mercado?", "¿y en Ahorro Verde?", "¿por qué?",
// "y 12 mil en la panadería" are read with the question before them. Every
// answer to a follow-up says, in one quiet line, the whole question it
// understood, so the person always knows what was answered and can change it.
// No AI: the missing pieces are taken from the last question. Figures invented.
import { ic, C, tint, top, ci, catIcon, accIcon } from './lib.mjs';

const S = {};
const keep = t => t.replace(/(\d) %/g, '$1\u00a0%').replace(/\$ /g, '$\u00a0').replace(/(\d) (mil|millones|meses)/g, '$1\u00a0$2');
const me = t => `<div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="max-width:78%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.35;text-wrap:pretty">${keep(t)}</div></div>`;
const app = t => `<div style="display:flex;gap:8px;margin-top:8px;align-items:flex-end">${ci('sparkles-outline', C.blu, 30)}<div style="max-width:82%;background:var(--s1);border:1px solid #1c2944;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.4;text-wrap:pretty">${keep(t)}</div></div>`;
// What the follow-up was understood as: one line, the whole question, and "Cambiar".
const got = (t, mark = true) => `<div style="margin:8px 0 0 38px;display:flex;gap:8px;align-items:flex-start;background:${tint(C.blu, .1)};border:1px solid ${tint(C.blu, .28)};border-radius:12px;padding:7px 10px;font-size:12.8px;line-height:1.4">
 ${ic('return-down-forward-outline', '', `width:15px;height:15px;color:var(--pr);margin-top:1px`)}<span style="flex:1;text-wrap:pretty"><span class="mu">Entendí:</span> ${keep(t)}</span>${mark ? '<b style="color:var(--pr);font-weight:600;white-space:nowrap">Cambiar</b>' : ''}</div>`;
const card = inner => `<div style="margin:8px 0 0 38px;text-wrap:pretty;background:var(--s1);border:1px solid #22314f;border-radius:18px;padding:12px 14px">${keep(inner)}</div>`;
const lab = (t, mt = 12) => `<div class="lab" style="margin:${mt}px 0 2px">${t}</div>`;
const note = t => `<div class="sub" style="margin-top:8px;font-size:12.5px;line-height:1.4">${keep(t)}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13.8px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:600;white-space:nowrap">${v}</b></div>`;
const follow = (...t) => `<div style="margin:12px 0 0 38px"><div class="lab" style="margin-bottom:6px">También puedes preguntar</div><div style="display:flex;gap:8px;flex-wrap:wrap">${t.map(x => `<span class="chip" style="color:var(--pr)">${x}</span>`).join('')}</div></div>`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 16px 24px;background:#0b1324;border-top:1px solid #18243d;display:flex;gap:10px;align-items:center">
 <div class="search" style="flex:1;padding:12px 14px">Escribe o habla</div>
 <span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;color:#fff;flex:none">${ic('mic-outline', '', 'width:22px;height:22px')}</span></div>`;
const chat = body => `${top('Asistente', { sub: 'Registra o pregunta, por texto o por voz' })}<main style="padding-bottom:110px">${body}</main>${bar}`;
const spent = (k, period, amount, before, change, cls) => card(`<div style="display:flex;align-items:center;gap:10px">${catIcon(k, 36)}<div style="flex:1"><b style="font-size:15px">${period}</b><div class="mu" style="font-size:12.5px">${before}</div></div><b style="font-size:17px">${amount}</b></div>${change ? `<div class="${cls}" style="margin-top:8px;font-size:13px">${change}</div>` : ''}`);

// 55a - the period changes: "¿y el mes pasado?" keeps the category.
S['55a-seguimiento-periodo'] = chat(`
 ${me('¿Cuánto llevo en restaurantes este mes?')}
 ${app('Llevas <b>$ 186.400</b> en Restaurantes del 1 al 6 de noviembre, en 5 gastos.')}
 ${spent('rest', 'Noviembre, del 1 al 6', '$ 186.400', '5 gastos', 'En los mismos días de octubre llevabas $ 121.000: 54 % más.', 'r')}
 ${me('¿y el mes pasado?')}
 ${got('¿Cuánto gasté en <b>Restaurantes</b> en <b>octubre</b>?')}
 ${app('En octubre gastaste <b>$ 512.300</b> en Restaurantes, en 14 gastos. Es tu tercera categoría del mes.')}
 ${spent('rest', 'Octubre completo', '$ 512.300', '14 gastos · promedio $ 36.600', '')}
 ${follow('¿Y en septiembre?', '¿Y en mercado?', '¿Por qué subió?')}`);

// 55b - the category changes: "¿y en mercado?" keeps the period.
S['55b-seguimiento-categoria'] = chat(`
 ${me('¿Cuánto gasté en restaurantes en octubre?')}
 ${app('En octubre gastaste <b>$ 512.300</b> en Restaurantes, en 14 gastos.')}
 ${me('¿y en mercado?')}
 ${got('¿Cuánto gasté en <b>Mercado</b> en <b>octubre</b>?')}
 ${app('En octubre gastaste <b>$ 748.900</b> en Mercado, en 9 gastos.')}
 ${spent('mercado', 'Octubre completo', '$ 748.900', '9 gastos', '')}
 ${me('¿y los dos juntos?')}
 ${got('¿Cuánto gasté en <b>Restaurantes y Mercado</b> en <b>octubre</b>?')}
 ${app('Entre los dos, <b>$ 1.261.200</b>: el 31 % de lo que gastaste en octubre.')}
 ${card(`${line('Mercado', '$ 748.900')}${line('Restaurantes', '$ 512.300')}${line('Juntos', '$ 1.261.200')}`)}`);

// 55c - the account changes: "¿y en Ahorro Verde?", then "¿y en total?".
S['55c-seguimiento-cuenta'] = chat(`
 ${me('¿Cuánto tengo en Banco Azul?')}
 ${app('En Banco Azul tienes <b>$ 2.418.300</b> hoy.')}
 ${me('¿y en Ahorro Verde?')}
 ${got('¿Cuánto tengo en <b>Ahorro Verde</b>?')}
 ${app('En Ahorro Verde tienes <b>$ 6.120.000</b>, y este mes te ha pagado $ 18.240 de intereses.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px">${accIcon('verde', 36)}<div style="flex:1"><b>Ahorro Verde</b><div class="mu" style="font-size:12.5px">Saldo de hoy</div></div><b style="font-size:17px">$ 6.120.000</b></div>`)}
 ${me('¿y en total?')}
 ${got('¿Cuánto tengo en <b>todas mis cuentas</b>?')}
 ${app('En todas tus cuentas tienes <b>$ 9.874.300</b>, y debes $ 1.209.480 en la Tarjeta Coral.')}
 ${card(`${line('Lo que tienes', '$ 9.874.300', 'g')}${line('Lo que debes', '−$ 1.209.480', 'r')}${line('Tu patrimonio hoy', '$ 8.664.820')}`)}`);

// 55d - "¿por qué?" after a summary: the question before says what to explain.
S['55d-seguimiento-por-que'] = chat(`
 ${me('¿Cómo voy este mes?')}
 ${app('Del 1 al 6 de noviembre te entraron <b>$ 3.850.000</b> y gastaste <b>$ 1.342.000</b>. Llevas gastado 18 % más que en los mismos días de octubre.')}
 ${me('¿por qué?')}
 ${got('¿Por qué <b>gasté más</b> del 1 al 6 de noviembre que en los mismos días de octubre?')}
 ${app('Gastaste <b>$ 204.700 más</b>. Casi todo viene de dos categorías:')}
 ${card(`${lab('Subieron', 0)}${line('Restaurantes', '+$ 65.400', 'r')}${line('Ropa', '+$ 189.900', 'r')}
  ${lab('Bajaron')}${line('Transporte', '−$ 50.600', 'g')}
  ${note('Ropa es un solo gasto: unos tenis el 4 de noviembre.')}`)}
 ${follow('¿Y en todo octubre?', 'Ver los gastos de Ropa')}`);

// 55e - registering in a row: the second spending takes the first one's
// account and day unless it says otherwise; "con la Coral" changes the last card.
S['55e-seguimiento-registro'] = chat(`
 ${me('Gasté 45 mil en el mercado')}
 ${card(`<div style="display:flex;align-items:center;gap:10px">${catIcon('mercado', 36)}<div style="flex:1"><b>Mercado</b><div class="mu" style="font-size:12.5px">Banco Azul · hoy</div></div><b class="r">−$ 45.000</b></div>
  <div class="mu" style="margin-top:8px;font-size:12.5px;display:flex;align-items:center;gap:6px">${ic('checkmark-circle', '', 'width:16px;height:16px;color:var(--grn)')}Guardado</div>`)}
 ${me('y 12 mil en la panadería')}
 ${got('Otro gasto de <b>$ 12.000</b> en <b>la panadería</b>, desde <b>Banco Azul</b>, <b>hoy</b>, como el anterior.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px">${catIcon('mercado', 36)}<div style="flex:1"><b>Panadería</b><div class="mu" style="font-size:12.5px">Mercado · Banco Azul · hoy</div></div><b class="r">−$ 12.000</b></div>
  <div style="display:flex;gap:8px;margin-top:12px"><div class="btn" style="flex:1;height:40px">Guardar</div><div class="btn ghost" style="flex:1;height:40px">Revisar y guardar</div></div>`)}
 ${me('con la Coral')}
 ${got('Cambiar la cuenta de <b>este último gasto</b> a <b>Tarjeta Coral</b>.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px">${catIcon('mercado', 36)}<div style="flex:1"><b>Panadería</b><div class="mu" style="font-size:12.5px">Mercado · Tarjeta Coral · hoy</div></div><b class="r">−$ 12.000</b></div>
  <div style="display:flex;gap:8px;margin-top:12px"><div class="btn" style="flex:1;height:40px">Guardar</div><div class="btn ghost" style="flex:1;height:40px">Revisar y guardar</div></div>
  ${note('Solo cambia el que aún no guardas. El de $ 45.000 ya está guardado: para cambiarlo, tócalo en Inicio.')}`)}`);

// 55f - "Cambiar" on the line: the pieces taken from before, each one tappable.
S['55f-cambiar-lo-entendido'] = `${chat(`
 ${me('¿Cuánto llevo en restaurantes este mes?')}
 ${app('Llevas <b>$ 186.400</b> en Restaurantes del 1 al 6 de noviembre.')}
 ${me('¿y el mes pasado?')}
 ${got('¿Cuánto gasté en <b>Restaurantes</b> en <b>octubre</b>?')}`)}
 <div style="position:absolute;inset:0;background:rgba(3,7,15,.55)"></div>
 <div style="position:absolute;left:0;right:0;bottom:0;background:var(--s1);border-radius:24px 24px 0 0;padding:10px 16px 28px">
  <div style="width:40px;height:4px;border-radius:3px;background:#2a3a5c;margin:0 auto 10px"></div>
  <div style="display:flex;justify-content:space-between;align-items:center"><span style="color:var(--pr);font-weight:600">Cancelar</span><span style="color:var(--pr);font-weight:600">Preguntar</span></div>
  <h2 style="text-align:center;font-size:17px;margin:14px 0 4px">Lo que entendí</h2>
  <div class="sub" style="text-align:center;font-size:13px;margin-bottom:12px">Lo que no dijiste lo tomé de tu pregunta anterior. Toca lo que quieras cambiar.</div>
  <div class="list">
   <div class="row">${ci('help-circle-outline', C.blu, 38)}<div class="tx"><small>Pregunta</small><b>Cuánto gasté</b></div>${ic('chevron-forward-outline', 'chev')}</div>
   <div class="row">${catIcon('rest', 38)}<div class="tx"><small>Categoría · de tu pregunta anterior</small><b>Restaurantes</b></div>${ic('chevron-forward-outline', 'chev')}</div>
   <div class="row">${ci('calendar-outline', C.cya, 38)}<div class="tx"><small>Periodo · lo dijiste ahora</small><b>Octubre de 2026</b></div>${ic('chevron-forward-outline', 'chev')}</div>
   <div class="row">${ci('wallet-outline', C.gry, 38)}<div class="tx"><small>Cuentas · de tu pregunta anterior</small><b>Todas las cuentas</b></div>${ic('chevron-forward-outline', 'chev')}</div></div>
  <div style="margin-top:12px;text-align:center;color:var(--pr);font-weight:600;font-size:14px">No era una continuación: preguntar de cero</div></div>`;

// 55g - a follow-up that cannot be placed: it asks which question it goes with.
S['55g-seguimiento-dudoso'] = chat(`
 ${me('¿Cuánto llevo en restaurantes este mes?')}
 ${app('Llevas <b>$ 186.400</b> en Restaurantes del 1 al 6 de noviembre.')}
 ${me('¿Qué pagos tengo esta semana?')}
 ${app('Tienes <b>2 pagos</b> esta semana: la Tarjeta Coral el 9 de noviembre por $ 1.209.480 y el arriendo el 10 por $ 1.400.000.')}
 ${me('¿y el otro?')}
 ${app('No sé a qué te refieres con «el otro». ¿Sigues con alguna de estas preguntas?')}
 ${card(`<div class="list" style="margin:0;background:none">
  <div class="row plain">${ic('calendar-outline', 'p')}<div class="tx"><b style="white-space:normal">El arriendo del 10 de noviembre</b><small>De tu pregunta por los pagos de esta semana</small></div></div>
  <div class="row plain">${ic('pie-chart-outline', 'p')}<div class="tx"><b style="white-space:normal">Otra categoría de este mes</b><small>De tu pregunta por Restaurantes</small></div></div>
  <div class="row plain">${ic('chatbubble-ellipses-outline', 'p')}<div class="tx"><b style="white-space:normal">Ninguna: escribiré la pregunta completa</b></div></div></div>`)}
 ${note('<span style="margin-left:38px;display:block">Lo que elijas lo recuerdo para la próxima vez que lo digas así.</span>')}`);

export default S;
