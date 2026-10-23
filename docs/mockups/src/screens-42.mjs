// Group 42 - the assistant's bulb opens on what the person registers most
// (Jose, 2026-10-23): one tap and the one movement form is ready - accounts,
// products, category and usual note - and only the amount is typed. It reads
// the same habits as "Lo que más registras" in the "+" (core/compose/
// frequent.ts), never a second count. Names and figures invented.
import { ic, C, tint, top, ci, sq, catIcon, accIcon, chev } from './lib.mjs';

const S = {};
const keep = t => t.replace(/\$ /g, '$ ').replace(/(\d) (mil|veces|días)/g, '$1 $2');
const sheet = inner => `<div class="scrim"></div><div class="sheet" style="max-height:86%;overflow:hidden"><div class="grab"></div>${inner}</div>`;
const note = t => `<div class="sub" style="margin:8px 4px 0;font-size:12.5px;line-height:1.4">${keep(t)}</div>`;
const tagS = (t, c) => `<span style="font-size:11px;font-weight:500;padding:2px 7px;border-radius:7px;background:${tint(c, .18)};color:${c};white-space:nowrap">${t}</span>`;
const bar = `<div style="position:absolute;left:0;right:0;bottom:0;padding:10px 16px 24px;background:#0b1324;border-top:1px solid #18243d;display:flex;gap:10px;align-items:center">
 <div class="search" style="flex:1;padding:12px 14px">Escribe o habla</div>
 <span style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;color:#fff;flex:none">${ic('mic-outline', '', 'width:22px;height:22px')}</span></div>`;
const bulb = `<span class="btn-r on">${ic('bulb-outline')}</span>`;
const head = top('Asistente', { sub: 'Registra o pregunta, por texto o por voz', right: bulb });
const chat = body => `${head}<main style="padding-bottom:110px">${body}</main>${bar}`;

// One habit: the icon of what it is, the route on one line, the note under it,
// and on the right the amount when it is always about the same, or "Tú pones
// el valor".
const kindIcon = k => k === 'transfer' ? ci('swap-horizontal', C.blu, 40) : k === 'income' ? ci('arrow-down', C.grn, 40) : ci('arrow-up', C.red, 40);
const habit = ({ k, title, route, noteText, uses, amount = '', star = false, notes = '' }) => `<div class="row">${kindIcon(k)}
 <div class="tx"><b>${title}</b><small class="one" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${route}</small>
 <small style="display:block">${noteText ? `«${noteText}»` : notes} · ${uses}</small></div>
 <div class="am">${amount ? `<span class="${k === 'income' ? 'g' : k === 'transfer' ? 'p' : 'r'}">${amount}</span><small class="mu">casi siempre</small>` : `<small class="mu" style="font-size:12px">Tú pones<br>el valor</small>`}</div>
 ${star ? ic('star', 'y', 'width:16px;height:16px') : ''}${chev()}</div>`;

const H = {
  bolsillo: { k: 'transfer', title: 'Bolsillo Viajes → Cuenta principal', route: 'Cajita Naranja · entre sus productos', noteText: 'Retiro bolsillo viajes', uses: '18 veces en 3 meses' },
  ahorro: { k: 'transfer', title: 'Banco Azul → Ahorro Verde', route: 'De tu cuenta a tu ahorro', noteText: 'Ahorro quincena', uses: '6 veces', amount: '$ 300.000' },
  tarjeta: { k: 'transfer', title: 'Pago Tarjeta Coral', route: 'Desde Banco Azul', noteText: 'Pago tarjeta', uses: '3 veces' },
  mercado: { k: 'expense', title: 'Mercado · Tarjeta Coral', route: 'Gasto en Mercado', noteText: '', notes: 'Notas distintas', uses: '14 veces' },
  almuerzo: { k: 'expense', title: 'Restaurantes · Efectivo', route: 'Gasto en Restaurantes', noteText: 'Almuerzo', uses: '22 veces' },
  bus: { k: 'expense', title: 'Transporte · Banco Azul', route: 'Gasto en Transporte', noteText: 'Pasaje bus', uses: '31 veces', amount: '$ 3.200' },
  honor: { k: 'income', title: 'Honorarios → Banco Azul', route: 'Ingreso en Honorarios', noteText: 'Pago cliente', uses: '4 veces' },
};

// The questions that the bulb already holds, folded under the habits.
const groups = `<div class="h" style="margin-top:14px">Pregúntame</div><div class="list">
 ${['Registrar', 'Tu mes', 'Busca en tus movimientos', 'Tus deudas', 'Tus topes, metas y recordatorios'].map(t => `<div class="row plain"><div class="tx"><b>${t}</b></div>${ic('chevron-down-outline', 'chev')}</div>`).join('')}</div>`;

// 42a - the bulb opens on "Lo que más registras", then the questions as today.
S['42a-bombillo-lo-de-siempre'] = chat('') + sheet(`<div class="sh"><h2>Ideas</h2>${ic('close', 'mu')}</div>
 <div class="h" style="margin-top:0">Lo que más registras <span class="p">Ver los 9</span></div>
 <div class="list">${habit(H.bolsillo)}${habit(H.almuerzo)}${habit(H.ahorro)}${habit(H.mercado)}${habit(H.bus)}</div>
 ${note('Un toque y queda todo listo: las cuentas, los productos, la categoría y la nota. Tú solo pones el valor y guardas. Nada se guarda solo.')}
 ${groups}`);

// 42b - the same habits greet the person on the empty chat, above "Para ti, hoy".
S['42b-bienvenida-lo-de-siempre'] = chat(`
 <div style="text-align:center;margin:14px 0 4px">${ci('sparkles-outline', C.blu, 52).replace('display:grid', 'display:grid;margin:0 auto 8px')}
  <b style="font-size:18px">¿Qué quieres hacer?</b></div>
 <div class="h">Lo que más registras <span class="p">Ver todo</span></div>
 <div style="display:flex;gap:10px;overflow:hidden">
  ${[[H.bolsillo, 'Bolsillo Viajes → Cuenta principal', 'Tú pones el valor'], [H.almuerzo, 'Almuerzo · Efectivo', 'Tú pones el valor'], [H.ahorro, 'Ahorro Verde', '$ 300.000']].map(([h, t, v]) => `<div style="flex:none;width:158px;background:var(--s1);border:1px solid #1f2c47;border-radius:18px;padding:12px">
   ${kindIcon(h.k)}<b style="display:block;margin-top:8px;font-size:14px;font-weight:500;line-height:1.3">${t}</b>
   <small class="mu" style="display:block;margin-top:4px;font-size:12px">«${h.noteText}»</small>
   <div style="margin-top:8px;font-size:13px" class="${v.startsWith('$') ? 'p' : 'mu'}">${keep(v)}</div></div>`).join('')}</div>
 <div class="h">Para ti, hoy</div>
 <div class="list">
  <div class="row plain">${ic('pie-chart-outline', 'p')}<div class="tx"><b>«¿Cuánto llevo en Restaurantes este mes?»</b><small>Es tu categoría que más subió</small></div></div>
  <div class="row plain">${ic('calendar-outline', 'p')}<div class="tx"><b>«¿Qué pagos tengo esta semana?»</b><small>Tienes 2 por pagar</small></div></div></div>
 ${note('Se desliza de lado para ver los demás.')}`);

// 42c - tapped: the one movement form, a move between two products of one
// account, everything filled but the amount, the cursor waiting there, and the
// last amounts used as chips.
const end = (side, acc, product) => `<div style="display:flex;gap:12px;padding:12px 14px;align-items:flex-start">
 <span class="mu" style="width:46px;font-size:12.5px;padding-top:9px">${side}</span>
 <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:10px">${accIcon(acc, 34)}<b style="font-weight:500">Cajita Naranja</b></div>
 <div style="display:flex;align-items:center;gap:10px;margin:6px 0 0 16px;border-left:2px solid #2a3857;padding-left:14px">${sq('wallet-outline', C.org, 28)}<span style="font-size:14px;color:#c8d0df">${product}</span></div></div>${chev()}</div>`;
S['42c-formulario-listo'] = `${top('Nueva transferencia', { left: 'x' })}<main>
 <div class="seg"><div>${ic('arrow-up')}Gasto</div><div>${ic('arrow-down')}Ingreso</div><div class="on blu">${ic('swap-horizontal')}Transferir</div></div>
 <div class="lab" style="margin-top:14px">Monto</div>
 <div style="display:flex;align-items:center;gap:6px;font-size:34px;font-weight:700;margin:4px 0 6px"><span class="mu">$</span><span style="width:3px;height:36px;background:var(--pr);border-radius:2px"></span><span class="mu" style="font-weight:400;font-size:30px">0</span></div>
 <div class="lab" style="margin:8px 0 6px">Los últimos que usaste</div>
 <div class="chips"><span class="chip">$ 50.000</span><span class="chip">$ 100.000</span><span class="chip">$ 30.000</span><span class="chip" style="color:var(--pr)">Pasar todo · $ 412.300</span></div>
 <div class="list" style="margin-top:14px">${end('Desde', 'naranja', 'Bolsillo Viajes')}<div style="border-top:1px solid var(--line)"></div>${end('Hacia', 'naranja', 'Cuenta principal')}</div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('document-text-outline', C.cya, 34)}<div class="tx"><small>Nota</small><b>Retiro bolsillo viajes</b></div></div>
  <div class="row">${ci('calendar-outline', C.cya, 34)}<div class="tx"><small>Fecha</small><b>Hoy, jueves 23 de octubre</b></div>${chev()}</div></div>
 ${note('Vino de «Lo que más registras»: todo está como lo sueles hacer. Puedes cambiar cualquier cosa antes de guardar.')}
 <div class="btn" style="height:48px;margin-top:14px;opacity:.5">Guardar</div></main>
 <div style="position:absolute;left:0;right:0;bottom:0;height:250px;background:#1b2436;border-top:1px solid #2a3654;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px">${['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map(k => `<div style="background:#2a344b;border-radius:10px;display:grid;place-items:center;font-size:22px">${k}</div>`).join('')}</div>`;

// 42d - a spending repeated with other notes each time: still a habit. The
// note offered is the one written most, with the others under it to choose.
S['42d-notas-distintas'] = `${top('Nuevo gasto', { left: 'x' })}<main>
 <div class="seg"><div class="on red">${ic('arrow-up')}Gasto</div><div>${ic('arrow-down')}Ingreso</div><div>${ic('swap-horizontal')}Transferir</div></div>
 <div class="lab" style="margin-top:14px">Monto</div>
 <div style="display:flex;align-items:center;gap:6px;font-size:34px;font-weight:700;margin:4px 0 6px"><span class="mu">$</span><span style="width:3px;height:36px;background:var(--pr);border-radius:2px"></span><span class="mu" style="font-weight:400;font-size:30px">0</span></div>
 <div class="lab" style="margin:8px 0 6px">Los últimos que usaste</div>
 <div class="chips"><span class="chip">$ 86.400</span><span class="chip">$ 23.900</span><span class="chip">$ 142.000</span></div>
 <div class="list" style="margin-top:14px">
  <div class="row">${accIcon('coral', 36)}<div class="tx"><small>Desde</small><b>Tarjeta Coral</b></div>${chev()}</div>
  <div class="row">${catIcon('mercado', 36)}<div class="tx"><small>Categoría</small><b>Mercado</b></div>${chev()}</div>
  <div class="row">${ci('document-text-outline', C.cya, 36)}<div class="tx"><small>Nota</small><b>Mercado semana</b></div>${ic('close-circle', 'mu', 'width:20px;height:20px')}</div></div>
 <div class="lab" style="margin:10px 4px 6px">Otras notas que usas aquí</div>
 <div class="chips"><span class="chip">Fruver</span><span class="chip">Mercado del mes</span><span class="chip">Carnicería</span></div>
 ${note('Este gasto se repite 14 veces con la misma cuenta y categoría, aunque cada vez con otra nota. Te propongo la nota que más escribes; si no aplica, toca otra o bórrala.')}
 <div class="btn" style="height:48px;margin-top:14px;opacity:.5">Guardar</div></main>`;

// 42e - pinning: a long press on a habit offers "Fijar arriba", so it is always
// first even on a month it was used less. Its star shows it.
S['42e-fijar-favorito'] = chat('') + sheet(`<div class="sh"><h2>Ideas</h2>${ic('close', 'mu')}</div>
 <div class="h" style="margin-top:0">Fijados</div>
 <div class="list">${habit({ ...H.tarjeta, star: true })}${habit({ ...H.honor, star: true })}</div>
 <div class="h">Lo que más registras <span class="p">Ver los 9</span></div>
 <div class="list">${habit(H.bolsillo)}${habit(H.almuerzo)}${habit(H.ahorro)}</div>
 ${note('Deja presionado uno para fijarlo arriba o quitarlo. Los fijados salen siempre de primero, aunque ese mes los hayas usado menos.')}
 ${groups}`);

// 42f - the long press itself.
S['42f-dejar-presionado'] = chat('') + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="display:flex;gap:12px;align-items:center;padding:4px 0 14px">${kindIcon('transfer')}<div class="tx"><b style="white-space:normal">Pago Tarjeta Coral</b><small>Desde Banco Azul · «Pago tarjeta»</small></div></div>
 <div class="list">
  <div class="row">${ci('star-outline', C.yel, 36)}<div class="tx"><b>Fijar arriba</b><small>Sale siempre de primero</small></div></div>
  <div class="row">${ci('create-outline', C.blu, 36)}<div class="tx"><b>Abrir el formulario</b><small>Igual que tocarlo</small></div></div>
  <div class="row">${ci('eye-off-outline', C.red, 36)}<div class="tx"><b>No mostrarlo aquí</b><small>Tus movimientos no se borran</small></div></div></div>
 <div class="btn ghost" style="height:44px;margin-top:12px">Cancelar</div><div style="height:10px"></div></div>`;

export default S;
