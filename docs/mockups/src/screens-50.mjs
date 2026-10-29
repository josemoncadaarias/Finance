// Group 50 - covering a product that would go below zero, in the same entry
// (Jose, 2026-10-29: a spending leaves the account's usual product - often
// at 0 - and he then moves the same money from a pocket by hand; he wants
// "en alguna parte chiquito, no tan grande ni tan invasivo" to do both at
// once). Proposed, not decided. Nothing new is stored: saving writes the
// movement and, beside it, an ordinary move between the account's products
// for what is missing - the same two rows he writes by hand today. Names and
// figures invented.
import { ic, C, tint, top, ci, sq, accIcon, catIcon, chev, sw, tabs } from './lib.mjs';

const S = {};
const note = t => `<div class="sub" style="margin:8px 4px 0;font-size:12.5px;line-height:1.4">${t}</div>`;
const amount = v => `<div class="lab" style="margin-top:14px">Monto</div>
 <div style="display:flex;align-items:center;gap:6px;font-size:34px;font-weight:700;margin:4px 0 6px"><span class="mu">$</span>${v}<span style="width:3px;height:36px;background:var(--pr);border-radius:2px"></span></div>`;
const seg = on => `<div class="seg">${[['arrow-up', 'Gasto', 'red'], ['arrow-down', 'Ingreso', 'grn'], ['swap-horizontal', 'Transferir', 'blu']].map(([i, t, c]) => `<div class="${t === on ? `on ${c}` : ''}">${ic(i)}${t}</div>`).join('')}</div>`;

// One end: the account, and its product hanging from it, as the form draws it.
const end = (side, acc, name, product, holds = '') => `<div style="display:flex;gap:12px;padding:12px 14px;align-items:flex-start">
 <span class="mu" style="width:46px;font-size:12.5px;padding-top:9px">${side}</span>
 <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:10px">${accIcon(acc, 34)}<b style="font-weight:500">${name}</b></div>
 ${product ? `<div style="display:flex;align-items:center;gap:10px;margin:6px 0 0 16px;border-left:2px solid #2a3857;padding-left:14px">${sq('wallet-outline', C.org, 28)}<span style="font-size:14px;color:#c8d0df">${product}</span>${holds ? `<span class="mu" style="font-size:12.5px;margin-left:auto">${holds}</span>` : ''}</div>` : ''}</div>${chev()}</div>`;

// THE proposal: one small line under the end, only when the product would go
// below zero. Off, it says what will happen and offers the cover; on, it says
// what will be moved.
const cover = (on, from, v, extra = '') => `<div style="display:flex;align-items:center;gap:10px;margin:8px 2px 0;padding:9px 12px;border-radius:14px;background:${on ? tint(C.blu, .12) : 'var(--s1)'}">
 ${ic(on ? 'swap-vertical' : 'alert-circle-outline', on ? 'p' : 'y', 'width:19px;height:19px;flex:none')}
 <div style="flex:1;min-width:0;font-size:13.5px;line-height:1.35">${on
    ? `Se cubre con <b>${from}</b><br><span class="mu">Pasan $&nbsp;${v} a Cuenta principal al guardar</span>`
    : `Cuenta principal queda en <b class="r">−$&nbsp;${v}</b><br><span class="p">Cubrir con ${from}</span>`}${extra}</div>
 ${sw(on)}</div>`;
const rest = (cat = 'mercado', catName = 'Mercado', noteText = 'Mercado semana') => `<div class="list" style="margin-top:12px">
 <div class="row">${catIcon(cat, 34)}<div class="tx"><small>Categoría</small><b>${catName}</b></div>${chev()}</div>
 <div class="row">${ci('document-text-outline', C.cya, 34)}<div class="tx"><small>Nota</small><b>${noteText}</b></div></div>
 <div class="row">${ci('calendar-outline', C.cya, 34)}<div class="tx"><small>Fecha</small><b>Hoy, miércoles 29 de octubre</b></div>${chev()}</div></div>`;
const save = `<div class="btn" style="height:48px;margin-top:14px">Guardar</div>`;
const form = (title, kind, body) => `${top(title, { left: 'x' })}<main>${seg(kind)}${body}</main>`;
const spend = (v, line, after = '') => form('Nuevo gasto', 'Gasto', `${amount(v)}
 <div class="list" style="margin-top:10px">${end('Desde', 'naranja', 'Cajita Naranja', 'Cuenta principal', '$ 0')}</div>
 ${line}${rest()}${after}${save}`);

// 50a - the amount passes what the product holds: one quiet line, off.
S['50a-gasto-queda-negativo'] = spend('20.000', cover(false, 'Bolsillo Viajes', '20.000'),
  note('Sale solo cuando el producto no alcanza. Si no lo tocas, se guarda como hoy.'));

// 50b - turned on: what moves, said once. Only what is missing is moved.
S['50b-cubrir-encendido'] = spend('20.000', cover(true, 'Bolsillo Viajes', '20.000'),
  note('Se guardan dos cosas, como las harías tú: el gasto y el paso de dinero de Bolsillo Viajes a Cuenta principal. Cuenta principal queda en $&nbsp;0.'));

// 50c - the product had some: only the rest is covered.
S['50c-cubre-solo-lo-que-falta'] = form('Nuevo gasto', 'Gasto', `${amount('20.000')}
 <div class="list" style="margin-top:10px">${end('Desde', 'naranja', 'Cajita Naranja', 'Cuenta principal', '$ 6.500')}</div>
 ${cover(true, 'Bolsillo Viajes', '13.500')}${rest()}${note('Cuenta principal tenía $&nbsp;6.500: solo se pasa lo que falta.')}${save}`);

// 50d - tapping the name of the pocket: which product covers it. Only those
// that hold enough; the one money usually comes from first.
S['50d-elegir-de-donde'] = spend('20.000', cover(true, 'Bolsillo Viajes', '20.000')) + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><span class="p" style="font-size:15px">Cancelar</span><h2>¿Con qué lo cubro?</h2><span style="width:60px"></span></div>
 <div class="list">
  <div class="row">${sq('airplane-outline', C.org, 36)}<div class="tx"><b>Bolsillo Viajes</b><small>Tiene $&nbsp;412.300 · de aquí sueles pasar</small></div><span class="tick on">${ic('checkmark')}</span></div>
  <div class="row">${sq('home-outline', C.pur, 36)}<div class="tx"><b>Bolsillo Casa</b><small>Tiene $&nbsp;85.000</small></div><span class="tick"></span></div>
  <div class="row" style="opacity:.45">${sq('gift-outline', C.grn, 36)}<div class="tx"><b>Bolsillo Regalos</b><small>Tiene $&nbsp;12.000 · no alcanza</small></div></div></div>
 <div class="list" style="margin-top:12px"><div class="row"><div class="tx"><b style="white-space:normal">Cubrir siempre en Cajita Naranja</b><small style="white-space:normal">La próxima vez sale ya encendido</small></div>${sw(false)}</div></div>
 <div style="height:12px"></div></div>`;

// 50e - the habit: whoever always covers from the same pocket finds it on.
S['50e-ya-encendido-por-costumbre'] = spend('45.900', cover(true, 'Bolsillo Viajes', '45.900', '<br><span class="mu" style="font-size:12px">Encendido porque así lo haces siempre</span>'));

// 50f - no product holds enough: it only says so, nothing to switch on.
S['50f-ningun-bolsillo-alcanza'] = form('Nuevo gasto', 'Gasto', `${amount('900.000')}
 <div class="list" style="margin-top:10px">${end('Desde', 'naranja', 'Cajita Naranja', 'Cuenta principal', '$ 0')}</div>
 <div style="display:flex;align-items:center;gap:10px;margin:8px 2px 0;padding:9px 12px;border-radius:14px;background:var(--s1)">${ic('alert-circle-outline', 'y', 'width:19px;height:19px;flex:none')}
 <div style="flex:1;font-size:13.5px;line-height:1.35">Cuenta principal queda en <b class="r">−$&nbsp;900.000</b><br><span class="mu">Ningún otro producto de Cajita Naranja tiene tanto</span></div></div>
 ${rest('vivienda', 'Vivienda', 'Nevera')}${save}`);

// 50g - a transfer out (paying a card) from the same product: the same line.
S['50g-transferencia-igual'] = form('Nueva transferencia', 'Transferir', `${amount('250.000')}
 <div class="list" style="margin-top:10px">${end('Desde', 'naranja', 'Cajita Naranja', 'Cuenta principal', '$ 40.000')}<div style="border-top:1px solid var(--line)"></div>${end('Hacia', 'coral', 'Tarjeta Coral', '')}</div>
 ${cover(true, 'Bolsillo Viajes', '210.000')}
 <div class="list" style="margin-top:12px"><div class="row">${ci('document-text-outline', C.cya, 34)}<div class="tx"><small>Nota</small><b>Pago tarjeta</b></div></div></div>${save}`);

// 50h - saved: Inicio shows the spending as always; the cover is one quiet
// line under it (on the account's own list it is the move between products).
const mrow = (icon, t, sub, v, cls, extra = '') => `<div class="row" style="gap:10px">${icon}<div class="tx"><b class="one" style="font-weight:500">${t}</b><small>${sub}</small>${extra}</div><div class="am ${cls}">${v}</div></div>`;
S['50h-guardado-en-la-lista'] = `${top('Cajita Naranja', { sub: 'Movimientos de hoy' })}<main>
 <div class="list" style="margin-top:8px"><div class="row" style="background:var(--s2);padding:9px 14px"><div class="tx"><b style="font-size:14.5px">Hoy, miércoles 29</b><small>1 movimiento</small></div><span class="r" style="font-weight:600">−20.000,00</span></div>
 ${mrow(catIcon('mercado', 40), 'Mercado semana', 'Mercado · Cuenta principal', '−20.000,00', 'r',
    `<small class="p" style="display:block;margin-top:2px">${ic('swap-vertical', '', 'width:13px;height:13px;vertical-align:-2px')} Cubierto con Bolsillo Viajes</small>`)}</div>
 ${note('El paso entre productos queda guardado como siempre, y se ve en la página de la cuenta. Tocar el gasto abre los dos: borrar el gasto pregunta si también se deshace el paso.')}
 <div style="height:110px"></div></main>${tabs('Inicio')}`;

export default S;
