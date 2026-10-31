// Group 52 - "¿Me alcanza?" for a big purchase (Jose, 2026-10-31: with 230
// million free and a 500 million goal open, the app must never say "yes, buy
// an apartment of 230 million"; "no te puedes quedar sin patrimonio libre").
// Proposed, not decided. Two sources, chosen by the amount:
//   - a purchase that fits in what is left this month is answered from the
//     month (what "Puedes gastar hoy" uses, mockups 51);
//   - a bigger one is weighed against the money held, and only part of it:
//       what the accounts hold
//       - what the goals already keep
//       - this month's payments
//       - a cushion of 6 months of normal spending (none when the emergency
//         fund already covers it)
//       - half of what is left, for the goals still in progress (never more
//         than what they lack)
//       = what can go to a big purchase.
// Figures invented.
import { ic, C, tint, top, ci } from './lib.mjs';

const S = {};
const keep = t => t.replace(/\$ /g, '$ ').replace(/(\d) (mil|millones|meses)/g, '$1 $2');
const me = t => `<div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="max-width:78%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;padding:10px 14px;border-radius:18px 18px 6px 18px;font-size:14.5px;line-height:1.35;text-wrap:pretty">${keep(t)}</div></div>`;
const app = t => `<div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">${ci('sparkles-outline', C.blu, 30)}<div style="max-width:82%;background:var(--s1);border:1px solid #1c2944;padding:10px 14px;border-radius:18px 18px 18px 6px;font-size:14.5px;line-height:1.4;text-wrap:pretty">${keep(t)}</div></div>`;
const card = (inner, border = '#22314f') => `<div style="margin:8px 0 0 38px;text-wrap:pretty;background:var(--s1);border:1px solid ${border};border-radius:18px;padding:12px 14px">${keep(inner)}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:13.8px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:600;white-space:nowrap">${v}</b></div>`;
const verdict = (icon, color, title, sub) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">${ci(icon, color, 36)}<div><b style="font-size:16px">${title}</b><div class="sub" style="font-size:12.8px;margin-top:2px">${sub}</div></div></div>`;
const btns = (...t) => `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">${t.map((x, i) => `<div class="btn" style="height:42px;${i ? 'background:var(--s2);color:var(--pr)' : ''}">${x}</div>`).join('')}</div>`;
const note = t => `<div class="sub" style="margin-top:10px;font-size:12.5px;line-height:1.45">${t}</div>`;
const head = top('Asistente', { sub: 'Registra o pregunta, por texto o por voz' });
const chat = body => `${head}<main style="padding-bottom:40px">${body}</main>`;

// 52a - a small purchase: it fits in the month, so the month answers it.
S['52a-compra-del-mes'] = chat(`
 ${me('¿Me alcanza para unos tenis de 300 mil?')}
 ${app('Sí. Te alcanza con lo que te queda de este mes.')}
 ${card(`${verdict('checkmark', C.grn, 'Te alcanza este mes', 'Sale de lo que recibes cada mes, no de tus ahorros')}
  ${line('Te queda para el resto del mes', '$ 1.660.000')}
  ${line('Los tenis', '−$ 300.000', 'r')}
  ${line('Te quedaría para el resto del mes', '$ 1.360.000', 'g')}
  ${line('Para gastar cada día, durante 13 días', '$ 104.600')}`)}`);

// 52b - a big purchase that fits: weighed against what can go to big purchases.
S['52b-compra-grande-si'] = chat(`
 ${me('¿Me alcanza para un viaje de 8 millones?')}
 ${app('Es más de lo que te queda este mes, así que lo miro con tus ahorros. Sí te alcanza, sin tocar tus metas ni tu colchón.')}
 ${card(`${verdict('checkmark', C.grn, 'Te alcanza con tus ahorros', 'Tus metas y tu colchón para imprevistos no se tocan')}
  ${line('Puedes usar para una compra grande', '$ 106.500.000')}
  ${line('El viaje', '−$ 8.000.000', 'r')}
  ${line('Te quedaría para otra compra grande', '$ 98.500.000', 'g')}
  ${btns('Ver cómo se calcula')}`)}`);

// 52c - how "what can go to a big purchase" is worked out.
const calcLine = (t, v, why = '', cls = '') => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${t}</b>${why ? `<small style="white-space:normal">${why}</small>` : ''}</div><b class="${cls}" style="white-space:nowrap">${v}</b></div>`;
const calcSheet = ({ kept, keptWhy, cushion, cushionWhy, half, result }) => `<div class="scrim"></div><div class="sheet" style="top:60px;bottom:0;overflow:hidden"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 0">Cerrar</div>
 <h2 style="text-align:center;margin:26px 0 12px;font-size:19px">Cómo se calcula lo que puedes usar para una compra grande</h2>
 <div class="list">
  ${calcLine('Tienes hoy en tus cuentas', '$ 300.000.000', 'Sin tus CDT ni lo que tienes fuera del patrimonio')}
  ${calcLine('Ya está guardado en tus metas', kept, keptWhy, 'p')}
  ${calcLine('Pagos que te faltan este mes', '−$ 2.000.000', '', 'r')}
  ${calcLine('Colchón para imprevistos', cushion, cushionWhy, 'p')}
  ${calcLine('La mitad de lo que queda, para tus metas en curso', '−' + half, 'Casa propia: le faltan $&nbsp;500.000.000', 'p')}
  <div class="row" style="gap:10px;background:var(--s2)"><div class="tx"><b style="white-space:normal">Puedes usar para una compra grande</b></div><b class="g" style="font-size:17px;white-space:nowrap">${result}</b></div></div>
 ${note('Nunca te propongo usar todo tu dinero libre: siempre queda un colchón para imprevistos y una parte para las metas que aún no completas.')}</div>`;
S['52c-como-se-calcula'] = S['52b-compra-grande-si'] + calcSheet({
  kept: '−$ 85.000.000', keptWhy: 'Tu fondo de emergencia',
  cushion: '$ 0', cushionWhy: 'Tu fondo de emergencia ya cubre 6 meses de tus gastos',
  half: '$ 106.500.000', result: '$ 106.500.000' });

// 52d - without an emergency fund: the cushion is set aside here instead.
S['52d-sin-fondo-de-emergencia'] = S['52b-compra-grande-si'] + calcSheet({
  kept: '$ 0', keptWhy: 'Ninguna meta guarda dinero todavía',
  cushion: '−$ 85.200.000', cushionWhy: '6 meses de tus gastos normales (unos $&nbsp;14.200.000 al mes)',
  half: '$ 106.400.000', result: '$ 106.400.000' });

// 52e - it fits, but it takes most of it.
S['52e-si-pero-casi-todo'] = chat(`
 ${me('¿Me alcanza para un carro de 90 millones?')}
 ${app('Sí te alcanza, pero se lleva casi todo lo que puedes usar para compras grandes.')}
 ${card(`${verdict('alert-circle-outline', C.yel, 'Te alcanza, pero se lleva el 85 %', 'Tus metas y tu colchón no se tocan, pero te queda poco para otras compras')}
  ${line('Puedes usar para una compra grande', '$ 106.500.000')}
  ${line('El carro', '−$ 90.000.000', 'r')}
  ${line('Te quedaría para otra compra grande', '$ 16.500.000', 'y')}
  ${btns('Ver cómo se calcula')}`, tint(C.yel, .5))}`);

// 52f - it does not fit: how much is missing, and a goal for it.
S['52f-no-alcanza'] = chat(`
 ${me('¿Me alcanza para un apartamento de 230 millones?')}
 ${app('Todavía no. Sin tocar tus metas ni tu colchón, puedes usar hasta $ 106.500.000.')}
 ${card(`${verdict('close', C.red, 'No te alcanza todavía', 'Te faltan $&nbsp;123.500.000')}
  ${line('Puedes usar para una compra grande', '$ 106.500.000')}
  ${line('El apartamento', '$ 230.000.000')}
  ${line('Te faltan', '$ 123.500.000', 'r')}
  ${note('Si lo quieres, crea una meta para el apartamento: la app te dice cuánto guardar cada mes para llegar.')}
  ${btns('Crear una meta de $ 230.000.000', 'Ver cómo se calcula')}`, tint(C.red, .5))}`);

// 52g - what changes, and what stays.
const li = (t, s) => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${t}</b><small style="white-space:normal">${s}</small></div></div>`;
S['52g-que-cambia'] = `${top('Qué cambia en «¿Me alcanza?»')}<main>
 <div class="list">
  ${li('Una compra que cabe en el mes', 'Se responde con lo que te queda este mes, lo mismo que «Puedes gastar hoy».')}
  ${li('Una compra más grande', 'Se mira con tus ahorros, pero nunca con todos: se deja un colchón de 6 meses de gastos y la mitad de lo que queda para tus metas en curso.')}
  ${li('Si te alcanza pero se lleva mucho', 'Te lo dice en amarillo, con cuánto te quedaría.')}
  ${li('Si no te alcanza', 'Te dice cuánto te falta y te ofrece crear una meta para eso.')}</div>
 <div class="h">Se queda igual</div><div class="list">
  ${li('Los topes de gasto', 'Si la compra tiene categoría con tope, te sigue diciendo si lo pasas.')}
  ${li('«Puedes gastar hoy» en Inicio', 'No cambia: sale de lo que recibes cada mes.')}</div>
 <div style="height:40px"></div></main>`;

export default S;
