// Group 39 - the assistant: register and ask by text or voice, with no AI
// behind it (Jose, 2026-10-19, after Lukas's "¿Puedo gastar...?"). Every
// answer comes from the app's own figures; what it does not understand it
// asks, and remembers the answer. Figures invented.
import { ic, C, tint, top, tag, chev, ci, sq, tabs, catIcon, accIcon } from './lib.mjs';

const S = {};
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}<div style="height:14px"></div></div>`;
const me = t => `<div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="max-width:78%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.35">${t}</div></div>`;
const app = t => `<div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">${ci('sparkles-outline', C.blu, 30)}<div style="max-width:82%;background:var(--s1);border:1px solid #1c2944;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.4">${t.replace(/\$ /g, '$\u00a0')}</div></div>`;
const card = (inner, border = '#22314f') => `<div style="margin:8px 0 0 38px;background:var(--s1);border:1px solid ${border};border-radius:18px;padding:12px 14px">${inner}</div>`;
const chips = (...t) => `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0 38px">${t.map(x => `<span class="chip" style="color:var(--pr)">${x}</span>`).join('')}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line);font-size:13.8px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:600;white-space:nowrap">${v}</b></div>`;
// What stays free is always said as what is left for the rest of the month
// and what that means a day, never a bare "X · Y al día" (Jose, 2026-10-19).
const rest = (total, day, what = 'Te quedaría libre') => `<div style="margin-top:10px;background:${tint(C.blu, .1)};border-radius:14px;padding:10px 12px">
  <div class="lab" style="margin-bottom:4px">Para el resto del mes · del 19 al 31 de octubre (13 días)</div>
  <div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13.8px"><span>${what}</span><b style="font-weight:600;white-space:nowrap">${total}</b></div>
  <div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13.8px"><span>Eso es, para gastar cada día</span><b style="font-weight:600;white-space:nowrap">${day}</b></div>
  <div class="sub" style="margin-top:4px;font-size:12.5px">Ya descontados tus pagos que vienen y lo que falta para tus metas.</div></div>`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 16px 24px;background:#0b1324;border-top:1px solid #18243d;display:flex;gap:10px;align-items:center">
 <div class="search" style="flex:1;padding:12px 14px">Escribe o habla: «gasté 45 mil en almuerzo»</div>
 <span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;color:#fff;flex:none">${ic('mic-outline', '', 'width:22px;height:22px')}</span></div>`;
const head = top('Asistente', { sub: 'Registra o pregunta, por texto o por voz' });
const chat = body => `${head}<main style="padding-bottom:110px">${body}</main>${bar}`;

// 39a - the "+" opens it too.
const home = `${top('Inicio', { left: '' })}<main><div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.215.300</div></div></main>${tabs('Inicio')}`;
const kind = (i, c, t) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">${ci(i, c, 54)}<b style="font-weight:500">${t}</b></div>`;
S['39a-mas-asistente'] = home + sheet(`<div style="display:flex;padding:6px 0 16px">${kind('arrow-up', C.red, 'Gasto')}${kind('arrow-down', C.grn, 'Ingreso')}${kind('swap-horizontal', C.blu, 'Transferir')}</div>
 <div class="list">
  <div class="row">${ci('sparkles-outline', C.blu, 38)}<div class="tx"><b>Asistente</b><small>«Gasté 45 mil en almuerzo» o «¿me alcanza para unos tenis?»</small></div>${ic('mic-outline', 'p', 'width:20px;height:20px')}${chev()}</div>
  <div class="row">${ci('document-text-outline', C.pur, 38)}<div class="tx"><b>Importar extracto PDF</b></div>${chev()}</div>
  <div class="row">${ci('wallet-outline', C.blu, 38)}<div class="tx"><b>Nueva cuenta</b><small>Banco, efectivo, tarjeta o inversión</small></div>${chev()}</div></div>`);

// 39b - empty: what it can do, as examples to tap.
S['39b-asistente-inicio'] = chat(`
 <div style="text-align:center;margin:18px 0 6px">${ci('sparkles-outline', C.blu, 60).replace('display:grid', 'display:grid;margin:0 auto 10px')}
  <b style="font-size:19px">¿Qué quieres hacer?</b>
  <div class="sub" style="margin-top:6px">Todo se calcula con tus datos, en tu celular. Nada sale de él.</div></div>
 <div class="h">Registrar</div>
 <div class="list">
  <div class="row plain">${ic('arrow-up', 'r')}<div class="tx"><b>«Gasté 45 mil en el mercado»</b></div></div>
  <div class="row plain">${ic('arrow-down', 'g')}<div class="tx"><b>«Me llegó el sueldo, 4 millones»</b></div></div>
  <div class="row plain">${ic('swap-horizontal', 'p')}<div class="tx"><b>«Pasé 200 mil a Ahorros»</b></div></div></div>
 <div class="h">Preguntar</div>
 <div class="list">
  <div class="row plain">${ic('help-circle-outline', 'p')}<div class="tx"><b>«¿Me alcanza para unos tenis de 300 mil?»</b></div></div>
  <div class="row plain">${ic('help-circle-outline', 'p')}<div class="tx"><b>«¿Cuánto llevo en restaurantes?»</b></div></div>
  <div class="row plain">${ic('help-circle-outline', 'p')}<div class="tx"><b>«¿Cuánto puedo gastar al día?»</b></div></div></div>`);

// 39c - registering: a summary to confirm, never saved alone.
S['39c-registrar-gasto'] = chat(`
 ${me('Gasté 45 mil en el Éxito con la Rappi')}
 ${app('Este es el gasto que entendí:')}
 ${card(`<div style="display:flex;align-items:center;gap:12px">${catIcon('mercado', 42)}<div class="tx"><b>Mercado</b><small>Éxito · Rappi Card · Hoy</small></div><b class="r" style="font-size:18px">−$ 45.000</b></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="btn ghost" style="height:42px">Revisar</div><div class="btn" style="height:42px">Guardar</div></div>`)}
 ${me('Ayer 12 mil de bus')}
 ${app('¿De qué cuenta salió?')}
 ${chips('Efectivo', 'Bancolombia', 'Rappi Card', 'Otra')}`);

// 39d - "¿me alcanza?": a question, not a movement. The verdict, then the
// figures it comes from.
S['39d-me-alcanza'] = chat(`
 ${me('¿Me alcanza para unos tenis de 300 mil?')}
 ${app('Te alcanza, pero <b>pasas tu tope de Ropa por $ 80.000</b>. Sin los tenis te quedan $ 220.000 de ese tope para el resto del mes.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px;background:${tint(C.yel, .14)};margin:-12px -14px 8px;padding:12px 14px;border-radius:17px 17px 0 0">${ic('alert-circle-outline', 'y')}<b class="y">Te alcanza, pero pasas un tope</b></div>
  <div class="lab" style="margin:4px 0 2px">Tope de Ropa · octubre</div>
  ${line('Llevas', '$ 180.000 de $ 400.000')}
  ${line('Con los tenis', '$ 480.000', 'r')}
  <div class="lab" style="margin:12px 0 2px">Tu dinero este mes</div>
  ${line('En tus cuentas hoy', '$ 2.340.000')}
  ${line('Pagos que vienen (tarjeta, cuota)', '−$ 890.000')}
  ${line('Lo que falta para tus metas', '−$ 200.000')}
  ${line('Libre para gastar', '$ 1.250.000', 'g')}
  ${rest('$ 950.000', '$ 73.100', 'Si compras los tenis, te quedaría libre')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="btn ghost" style="height:42px">Ver el tope</div><div class="btn" style="height:42px">Registrar el gasto</div></div>`, tint(C.yel, .4))}`);

// 39e - a word it does not know: it asks once and remembers.
S['39e-palabra-nueva'] = chat(`
 ${me('¿Puedo comprarme unas guayos de 250?')}
 ${app('No sé todavía qué son <b>«guayos»</b>. ¿En qué categoría van?')}
 ${chips('Ropa', 'Deporte', 'Otra categoría')}
 ${me('Deporte')}
 ${app('Listo, la próxima vez «guayos» va a <b>Deporte</b>. Tomé 250 como $ 250.000.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px">${ic('checkmark-circle-outline', 'g')}<b class="g">Te alcanza</b></div>
  ${line('Deporte · sin tope', 'Llevas $ 60.000 este mes')}
  ${rest('$ 1.000.000', '$ 76.900', 'Si los compras, te quedaría libre')}`)}`);

// 39f - registering or asking? When unsure it asks, and the answer is learned
// for that shape of sentence.
S['39f-registrar-o-preguntar'] = chat(`
 ${me('200 mil en mercado')}
 ${app('¿Lo registro como gasto, o quieres saber si te alcanza?')}
 ${chips('Registrar el gasto', '¿Me alcanza?')}
 ${me('Registrar el gasto')}
 ${app('Entendido. Cuando escribas solo un valor y una categoría, lo tomo como gasto.')}
 ${card(`<div style="display:flex;align-items:center;gap:12px">${catIcon('mercado', 42)}<div class="tx"><b>Mercado</b><small>Bancolombia · Hoy</small></div><b class="r" style="font-size:18px">−$ 200.000</b></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="btn ghost" style="height:42px">Revisar</div><div class="btn" style="height:42px">Guardar</div></div>`)}`);

// 39g - a question with a figure: the same numbers as the report.
S['39g-cuanto-llevo'] = chat(`
 ${me('¿Cuánto llevo en restaurantes?')}
 ${app('Este mes llevas <b>$ 412.000</b> en Restaurantes, $ 58.000 más que a esta altura del mes pasado.')}
 ${card(`${line('Octubre, hasta hoy', '$ 412.000')}
  ${line('Septiembre, mismos días', '$ 354.000')}
  ${line('Tope de Restaurantes', '$ 412.000 de $ 500.000 · 82 %', 'y')}
  ${line('Para no pasarlo, cada día hasta el 31', '$ 6.700')}
  <div class="btn ghost" style="height:42px;margin-top:12px">Ver sus movimientos</div>`)}
 ${chips('¿Y el mes pasado?', '¿En qué más gasté?')}`);

// 39h - voice: the phone's own dictation, the words shown as they come.
S['39h-voz'] = `${head}<main style="padding-bottom:110px">${me('¿Cuánto puedo gastar al día?')}${app('Para el resto del mes, del 19 al 31 de octubre, te quedan <b>$ 773.500</b> libres: <b>$ 59.500 para gastar cada día</b>. Ya descontados tus pagos y lo que falta para tus metas.')}</main>
 <div class="scrim" style="background:rgba(2,6,14,.55)"></div>
 <div class="sheet" style="text-align:center;padding-top:18px">
  <div class="sub">Escuchando</div>
  <b style="display:block;font-size:20px;margin:12px 0 34px;line-height:1.35">«me llegó el sueldo de cuatro millones…»</b>
  <span style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:inline-grid;place-items:center;color:#fff;box-shadow:0 0 0 12px ${tint(C.blu, .18)},0 0 0 24px ${tint(C.blu, .08)}">${ic('mic-outline', '', 'width:34px;height:34px')}</span>
  <div class="sub" style="margin-top:22px">Toca para terminar · Cancelar</div></div>`;

// 39i - no category: the whole picture. What the accounts hold (CDTs and
// anything set aside from net worth left out), less the payments coming and
// what the goals still need this month (Jose, 2026-10-19).
S['39i-me-alcanza-sin-categoria'] = chat(`
 ${me('¿Me puedo gastar 2 millones en algo?')}
 ${app('Sí, te alcanza: te quedarían <b>$ 650.000 libres</b> para el resto del mes, unos $ 50.000 por día. No sé en qué categoría va, así que no reviso ningún tope.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px;background:${tint(C.grn, .14)};margin:-12px -14px 8px;padding:12px 14px;border-radius:17px 17px 0 0">${ic('checkmark-circle-outline', 'g')}<b class="g">Te alcanza</b></div>
  ${line('En tus cuentas hoy', '$ 4.120.000')}
  ${line('Pagos que vienen (tarjeta, cuota)', '−$ 890.000')}
  ${line('Lo que falta para tus metas', '−$ 580.000')}
  ${line('Libre para gastar', '$ 2.650.000', 'g')}
  ${rest('$ 650.000', '$ 50.000', 'Con este gasto, te quedaría libre')}
  <div class="sub" style="margin-top:8px">Sin contar tus CDT ni lo que tienes fuera del patrimonio.</div>`, tint(C.grn, .4))}
 ${chips('Es tecnología', 'Es ropa', 'Otra categoría')}`);

// 39j - from one account: only what that account can pay.
S['39j-me-alcanza-cuenta'] = chat(`
 ${me('¿Puedo pagar 800 mil desde Bancolombia?')}
 ${app('Desde Bancolombia sí: tiene <b>$ 1.340.000</b> y te quedarían $ 540.000. Pero ojo, el 1 de noviembre sale de ahí la cuota del carro.')}
 ${card(`${line('Bancolombia hoy', '$ 1.340.000')}
  ${line('Quedaría en Bancolombia', '$ 540.000')}
  ${line('Cuota del carro · 1 nov', '−$ 980.000', 'r')}
  ${line('Te faltarían para la cuota', '$ 440.000', 'r')}
  <div class="sub" style="margin-top:8px">En todas tus cuentas sí te alcanza: tienes $ 2.650.000 libres.</div>`, tint(C.yel, .4))}`);

// 39k - not enough, but interest not yet cashed out could cover it.
S['39k-no-alcanza-intereses'] = chat(`
 ${me('¿Me alcanza para un viaje de 3 millones?')}
 ${app('Hoy no te alcanza: te faltan <b>$ 350.000</b>. Pero tienes <b>$ 1.351.000 en intereses</b> que todavía no has pasado a tus cuentas.')}
 ${card(`<div style="display:flex;align-items:center;gap:10px;background:${tint(C.red, .14)};margin:-12px -14px 8px;padding:12px 14px;border-radius:17px 17px 0 0">${ic('alert-circle-outline', 'r')}<b class="r">No te alcanza por $ 350.000</b></div>
  ${line('Libre para gastar', '$ 2.650.000')}
  ${line('El viaje', '−$ 3.000.000')}
  <div class="lab" style="margin:12px 0 2px">Intereses sin pasar a tu saldo</div>
  ${line('Banco Índigo', '$ 1.120.000', 'g')}
  ${line('Bolsillo Plata', '$ 231.000', 'g')}
  <div class="sub" style="margin-top:8px">Si los pasas a tu saldo, este gasto sí te alcanza. Mientras no lo hagas, no los cuento.</div>
  <div class="btn ghost" style="height:42px;margin-top:12px">Pasar intereses a mi saldo</div>`, tint(C.red, .4))}`);

// 39l - an account with products: the usual product, said quietly, and
// changed with a tap or in the sentence ("del bolsillo viajes").
const acc = (n, sub) => `<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line)">${sq('wallet-outline', C.blu, 30)}<div class="tx"><b style="font-size:14px">${n}</b><small>${sub}</small></div><span class="p" style="font-size:13.5px">Cambiar</span></div>`;
S['39l-gasto-con-producto'] = chat(`
 ${me('Gasté 120 mil en almuerzo con Banco Índigo')}
 ${app('Este es el gasto que entendí:')}
 ${card(`<div style="display:flex;align-items:center;gap:12px">${catIcon('rest', 42)}<div class="tx"><b>Restaurantes</b><small>Banco Índigo · Hoy</small></div><b class="r" style="font-size:18px">−$ 120.000</b></div>
  ${acc('Sale de Ahorros', 'Tu producto habitual · la cuenta tiene 3')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div class="btn ghost" style="height:42px">Revisar</div><div class="btn" style="height:42px">Guardar</div></div>`)}
 ${me('Gasté 50 mil del bolsillo viajes')}
 ${app('Lo saco de <b>Bolsillo viajes</b>, en Banco Índigo.')}`);

export default S;
