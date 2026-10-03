// Group 17 - "¿Qué cambia?" on a transfer between two accounts (2026-10-03,
// for Jose to choose; nothing built). His case: an account pays its yields
// into a product; moving part of what was earned to another account is not
// net worth going down - it is money that was never counted being moved, and
// the person decides when it starts counting. So each end of a transfer
// between DIFFERENT accounts that has products asks what it changes, with
// the same answers the movement form already gives: the side money leaves
// takes the answers of a spending, the side it arrives at those of an
// income. A move between products of one account asks nothing (its net
// worth never moves), and an end without products asks nothing either.
// Every name and figure is invented.
import { ic, ci, sq, C, accIcon, down, top, tint } from './lib.mjs';
import { typeSeg, amount, prod, end, dayRow, note, allBtn, route } from './screens-1.mjs';

const S = {};

// What is left of the keypad's foot since #45: what is missing, "Registrar
// otro" and Guardar; the amount takes the phone's own keyboard.
const foot = `<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 26px;background:linear-gradient(transparent,var(--bg) 30%)">
 <div style="display:flex;align-items:center;gap:10px"><span class="mu" style="display:flex;align-items:center;gap:7px;font-size:13.5px"><span style="width:20px;height:20px;border-radius:6px;border:2px solid #3a4b73"></span>Registrar otro</span><span style="flex:1"></span>
 <span style="padding:13px 34px;border-radius:16px;background:linear-gradient(135deg,var(--pr),#4a5ef0);font-weight:700">Guardar</span></div></div>`;

const xTop = top('Transferir', { left: 'x' });
const W = ['wallet-outline', C.grn];
const verde = (p = W, name = 'Cuenta de ahorros') => end(accIcon('verde', 38), 'Desde', 'Ahorro Verde', prod(p[0], p[1], name));
const azul = end(accIcon('azul', 38), 'Hacia dónde', 'Banco Azul');
const naranja = end(accIcon('naranja', 38), 'Hacia dónde', 'Cajita Naranja', prod('car-outline', C.org, 'Meta carro'));

// Option A: one row per end that has products, under the two ends, saying
// which end it is about.
const scope = (side, acc, on) => `<div class="row">${ci('git-compare-outline', C.pur, 38)}<div class="tx"><span class="k">${side} ${acc} · ¿qué cambia?</span><b>${on}</b></div>${down()}</div>`;
// What the transfer does to net worth, in one line, worked out from the two
// answers - so nobody has to reason it through.
const effect = (kind, text, sub) => {
  const c = kind === 'up' ? C.grn : kind === 'down' ? C.red : '#8c9bb5';
  const i = kind === 'up' ? 'trending-up-outline' : kind === 'down' ? 'trending-down-outline' : 'remove-outline';
  return `<div class="card" style="margin-top:10px;padding:12px 14px;display:flex;gap:12px;align-items:center;background:${tint(c, .1)};border-color:${tint(c, .35)}">
 ${ci(i, c, 36)}<div style="flex:1;min-width:0"><b style="color:${c};font-size:15px">${text}</b><div class="mu" style="font-size:12.8px;margin-top:2px;line-height:1.35">${sub}</div></div></div>`;
};
const form = (mid, amt = '150.000', all = '' ) => `${xTop}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${amount('⇄', 'p', amt)}${all ? allBtn(all) : '<div style="height:8px"></div>'}
 ${mid}
 <div class="list" style="margin-top:10px">${dayRow}${note('Rendimientos de septiembre', '')}</div>
 <div style="height:120px"></div></main>${foot}`;

// 1. The case: what Ahorro Verde paid in September, moved to Banco Azul.
//    "Al salir" set to "Solo el producto": the account and net worth do not
//    go down; Banco Azul, with no products, receives it as always - so net
//    worth goes UP by what arrives, which is the truth of it.
S['17a-transferir-rendimientos-opcion-a'] = form(`${route(verde(), azul)}
 <div class="list" style="margin-top:10px">${scope('Al salir de', 'Ahorro Verde', 'Solo el producto')}</div>
 ${effect('up', 'Tu patrimonio sube 150.000', 'Sale de lo que la cuenta de ahorros ya había ganado, que no contaba, y llega a Banco Azul como plata nueva.')}`, '150.000', '412.830 ganados');

// Option B: the answer lives inside its own end, as a small chip under the
// product - one place to look per end, nothing below the route.
const chip = t => `<div style="padding:7px 0 0 36px"><span class="chip" style="padding:4px 10px 4px 6px;font-size:12.6px;display:inline-flex;align-items:center;gap:6px;background:${tint(C.pur, .14)};color:#c9b8ff;border-color:${tint(C.pur, .35)}">${ic('git-compare-outline', '', 'width:15px;height:15px')}${t}${ic('chevron-down-outline', '', 'width:13px;height:13px')}</span></div>`;
const verdeB = end(accIcon('verde', 38), 'Desde', 'Ahorro Verde', prod(W[0], W[1], 'Cuenta de ahorros') + chip('Solo el producto'));
S['17b-transferir-rendimientos-opcion-b'] = form(`${route(verdeB, azul)}
 ${effect('up', 'Tu patrimonio sube 150.000', 'Sale de lo que la cuenta de ahorros ya había ganado, que no contaba, y llega a Banco Azul como plata nueva.')}`, '150.000', '412.830 ganados');

// 2. Tapping it: the answers of a spending, said for a transfer. The one in
//    use today ("Producto y patrimonio") stays the default.
const sheet = (base, title, rows, on) => base + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center">${ci('git-compare-outline', C.pur, 46).replace('display:grid', 'display:grid;margin:0 auto 8px')}<h2 style="font-size:19px">${title}</h2></div>
 <div class="list" style="margin-top:12px">${rows.map(([t, h]) => `<div class="row"><div class="tx"><b>${t}</b><small style="white-space:normal;line-height:1.4">${h}</small></div>${t === on ? `<span class="tick on">${ic('checkmark')}</span>` : '<span class="tick"></span>'}</div>`).join('')}</div>
 <div style="text-align:center;margin-top:12px" class="p">Cancelar</div></div>`;
const OUT = [
  ['Producto y patrimonio', 'Como hoy: sale del producto y del saldo de la cuenta, y tu patrimonio baja aquí lo que suba en la otra.'],
  ['Solo el producto', 'Sale de lo que el producto ya había ganado. El saldo de la cuenta y tu patrimonio no bajan: es plata que todavía no contaba.'],
  ['Solo el patrimonio', 'Sale del saldo de la cuenta y de tu patrimonio, y lo que tiene el producto no cambia.'],
];
const IN = [
  ['Producto y patrimonio', 'Como hoy: entra al producto y al saldo de la cuenta, y cuenta en tu patrimonio.'],
  ['Solo el producto', 'Entra a lo que el producto ha ganado, sin contar todavía en el saldo ni en tu patrimonio. Lo haces efectivo cuando quieras.'],
  ['Hacer efectivo', 'Entra al saldo de la cuenta y a tu patrimonio, y lo que tiene el producto no cambia.'],
];
S['17c-que-cambia-al-salir'] = sheet(S['17a-transferir-rendimientos-opcion-a'], 'Al salir de Ahorro Verde', OUT, 'Solo el producto');

// 3. Both accounts with products, and both "Solo el producto": earnings
//    moved from one product to another, still uncounted - net worth stays.
S['17d-entre-cuentas-con-productos'] = form(`${route(verde(), naranja)}
 <div class="list" style="margin-top:10px">${scope('Al salir de', 'Ahorro Verde', 'Solo el producto')}${scope('Al llegar a', 'Cajita Naranja', 'Solo el producto')}</div>
 ${effect('same', 'Tu patrimonio no cambia', 'Pasan rendimientos de un producto a otro, y siguen sin contar hasta que los hagas efectivos.')}`, '150.000', '412.830 ganados');

// 4. The sheet of the end money arrives at: the answers of an income.
S['17e-que-cambia-al-llegar'] = sheet(S['17d-entre-cuentas-con-productos'], 'Al llegar a Cajita Naranja', IN, 'Solo el producto');

// 5. The usual transfer is untouched: with the defaults on both ends the
//    line says what it always meant - net worth does not move, money only
//    changes account.
S['17f-transferencia-de-siempre'] = form(`${route(verde(), naranja)}
 <div class="list" style="margin-top:10px">${scope('Al salir de', 'Ahorro Verde', 'Producto y patrimonio')}${scope('Al llegar a', 'Cajita Naranja', 'Producto y patrimonio')}</div>
 ${effect('same', 'Tu patrimonio no cambia', 'La plata solo cambia de cuenta.')}`, '800.000', '52.000.000');

export default S;
