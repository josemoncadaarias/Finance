// Group 25 - repeated movements answered whole, and several chosen edited in
// everything (Jose, 2026-10-14, after his partner imported a statement: a
// shop that repeats could only take a category; a transfer, its account,
// product and "¿Qué cambia?" could not be said). Proposed, nothing built.
// Every name and figure invented.
import { ic, ci, sq, C, tint, top, tabs, down, chev, tick, mgroup, foldAll, catIcon, accIcon, jump } from './lib.mjs';
import { typeSeg, prod, end, note, route, infoDot } from './screens-1.mjs';

const S = {};
const P = C.blu;

const btn = (t, kind = 'pr') => kind === 'pr'
  ? `<div style="flex:1;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">${t}</div>`
  : `<div style="flex:1;height:50px;border-radius:15px;background:var(--s2);border:1px solid #2c3d63;display:grid;place-items:center;font-weight:600;color:var(--pr)">${t}</div>`;
const foot = (...b) => `<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 26px;background:linear-gradient(transparent,var(--bg) 30%);display:flex;gap:10px">${b.join('')}</div>`;

// 1. Por revisar: "Movimientos que se repiten" (was "Comercios que se repiten").
const group = (icon, name, sub, total, cls) => `<div class="row">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small></div><span class="${cls}" style="font-weight:600;font-size:14px;white-space:nowrap">${total}</span>${chev()}</div>`;
const repeated = mgroup('Movimientos que se repiten', '3 grupos · 11 movimientos', '', '', true,
  group(sq('storefront-outline', C.tea, 38), 'D1 LAURELES', '4 movimientos · Mercado sugerida', '−182.400', 'r')
  + group(sq('swap-horizontal', P, 38), 'TRANSF A NEQUI 3001234567', '5 movimientos · sin responder', '−750.000', 'r')
  + group(sq('briefcase-outline', C.grn, 38), 'PAGO NOMINA EMPRESA SAS', '2 movimientos · Salario aprendida', '+8.400.000', 'g'),
  sq('repeat-outline', C.tea, 30));
const origin = `<div class="card" style="margin-top:12px;padding:12px 14px;display:flex;gap:12px;align-items:center">${ci('document-text-outline', C.pur, 40)}<div style="flex:1;min-width:0"><b>Extracto de Banco Azul</b><div class="mu" style="font-size:12.5px">extracto-sep-2026.pdf · 38 movimientos</div></div><span class="chip" style="padding:4px 10px;font-size:12px;color:${C.grn}">${ic('checkmark-circle', '', 'width:14px;height:14px')}Cuadra</span></div>`;
S['25a-movimientos-que-se-repiten'] = `${top('Movimientos por revisar')}<main style="padding-top:6px">${origin}${repeated}
 ${mgroup('Viernes 26 de septiembre', 3, '−1.741.500,00', 'r', false)}${mgroup('Martes 23 de septiembre', 2, '−3.064.000,00', 'r', false)}</main>${tabs('Más')}`;

// 2. The page of one group: every movement it found, by day or category.
const mv = (day, amt, desc, cat) => `<div class="row">${cat}<div class="tx"><b class="one" style="font-size:14.5px">${desc}</b><small>${day}</small></div><span class="r" style="font-weight:600;font-size:14px;white-space:nowrap">${amt}</span></div>`;
const unknown = sq('help-outline', C.yel, 38);
const groupBar = on => `<div style="display:flex;gap:6px;margin-top:12px;align-items:center">${['Por día', 'Por categoría', 'Más grandes'].map(t => `<div class="chip ${t === on ? 'on' : ''}" style="padding:7px 10px;font-size:13px">${t}</div>`).join('')}<span style="flex:1"></span>${foldAll(true)}</div>`;
const head = `<div class="card" style="padding:14px;display:flex;gap:12px;align-items:center;margin-top:6px">${sq('swap-horizontal', P, 46)}<div style="flex:1;min-width:0"><b class="one" style="font-size:16px">TRANSF A NEQUI 3001234567</b><div class="mu" style="font-size:13px;margin-top:2px">5 movimientos · −750.000 en total</div><div class="mu" style="font-size:12.5px">Del 2 al 28 de septiembre · Banco Azul</div></div></div>`;
S['25b-un-grupo-por-dia'] = `${top('Movimientos que se repiten', { right: `<span class="p" style="font-size:14px;font-weight:600">Seleccionar</span>` })}<main style="padding-top:4px">${head}${groupBar('Por día')}
 ${mgroup('Domingo 28 de septiembre', 1, '−150.000', 'r', true, mv('28 sept', '−150.000', 'TRANSF A NEQUI 3001234567', unknown))}
 ${mgroup('Lunes 15 de septiembre', 2, '−300.000', 'r', true, mv('15 sept · 9:12', '−150.000', 'TRANSF A NEQUI 3001234567', unknown) + mv('15 sept · 18:40', '−150.000', 'TRANSF A NEQUI 3001234567', unknown))}
 ${mgroup('Martes 2 de septiembre', 2, '−300.000', 'r', true, mv('2 sept', '−200.000', 'TRANSF A NEQUI 3001234567', unknown) + mv('2 sept', '−100.000', 'TRANSF A NEQUI 3001234567', unknown))}
 <div class="hint" style="margin-top:10px">Toca uno para revisarlo solo, o responde los 5 de una vez.</div></main>
 ${foot(btn('Responder los 5'))}`;

S['25c-un-grupo-por-categoria'] = `${top('Movimientos que se repiten', { right: `<span class="p" style="font-size:14px;font-weight:600">Seleccionar</span>` })}<main style="padding-top:4px">
 <div class="card" style="padding:14px;display:flex;gap:12px;align-items:center;margin-top:6px">${sq('storefront-outline', C.tea, 46)}<div style="flex:1;min-width:0"><b class="one" style="font-size:16px">D1 LAURELES</b><div class="mu" style="font-size:13px;margin-top:2px">4 movimientos · −182.400 en total</div></div></div>
 ${groupBar('Por categoría')}
 ${mgroup('Mercado · sugerida', 3, '−158.900', 'r', true, mv('26 sept', '−62.300', 'D1 LAURELES', catIcon('mercado', 38)) + mv('19 sept', '−48.100', 'D1 LAURELES', catIcon('mercado', 38)) + mv('8 sept', '−48.500', 'D1 LAURELES', catIcon('mercado', 38)), catIcon('mercado', 30))}
 ${mgroup('Sin categoría', 1, '−23.500', 'r', true, mv('12 sept', '−23.500', 'D1 LAURELES', unknown), unknown.replace(/38px/g, '30px'))}
 </main>${foot(btn('Responder los 4'))}`;

// 3. Answering the whole group in the ONE movement form. No amount and no
//    day: each movement keeps its own. Everything else, as for one.
const many = (n, total, days) => `<div class="card" style="margin:12px 0 10px;padding:12px 14px;display:flex;gap:12px;align-items:center;background:${tint(P, .1)};border-color:${tint(P, .35)}">${ci('layers-outline', P, 38)}<div style="flex:1;min-width:0"><b style="font-size:15px">${n} movimientos · ${total}</b><div class="mu" style="font-size:12.5px;margin-top:2px;line-height:1.35">${days}. Cada uno conserva su monto y su fecha.</div></div>${chev()}</div>`;
const pickRow = (icon, k, v, sub = '') => `<div class="row">${icon}<div class="tx"><span class="k">${k}</span><b class="one">${v}</b>${sub ? `<small class="wrap">${sub}</small>` : ''}</div>${down()}</div>`;
const scopeRow = (k, v) => pickRow(ci('git-compare-outline', C.pur, 38), k, v);
const remember = (name, on = true) => `<div class="row">${ci('school-outline', C.grn, 38)}<div class="tx"><b class="wrap" style="font-size:14.5px">Recordar para ${name}</b><small class="wrap">Los próximos llegan así, listos para guardar</small></div><div class="sw ${on ? 'on' : ''}"></div></div>`;
const formTop = n => top(`Responder ${n} movimientos`, { left: 'x' });
S['25d-responder-grupo-transferencia'] = `${formTop(5)}<main style="padding-top:8px">${typeSeg('Transferir')}
 ${many(5, '−750.000', 'Del 2 al 28 de septiembre')}
 ${route(end(accIcon('azul', 38), 'Desde', 'Banco Azul', prod('wallet-outline', C.blu, 'Cuenta de ahorros')), end(accIcon('naranja', 38), 'Hacia dónde', 'Cajita Naranja', prod('car-outline', C.org, 'Meta carro')))}
 <div class="list" style="margin-top:10px">${scopeRow('Al llegar a Cajita Naranja · ¿qué cambia?', 'Producto y patrimonio')}${note('Ahorro carro', 'la de siempre de esta ruta')}${remember('TRANSF A NEQUI…')}</div>
 </main>${foot(btn('Solo aplicar', 'sec'), btn('Guardar los 5'))}`;

S['25e-responder-grupo-gasto'] = `${formTop(4)}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${many(4, '−182.400', 'Del 8 al 26 de septiembre')}
 <div class="list">${end(accIcon('verde', 38), 'Desde dónde', 'Ahorro Verde', prod('basket-outline', C.lim, 'Bolsillo Mercado'))}
  <div class="row">${catIcon('mercado', 38)}<div class="tx"><span class="k">Categoría</span><b>Mercado</b></div><span class="mu">${ic('create-outline', '', 'width:19px;height:19px')}</span>${down()}</div>
  ${scopeRow('¿Qué cambia?', 'Producto y patrimonio')}
  ${note('Mercado D1', 'para los 4 · o "Cada uno con la suya"')}${remember('D1 LAURELES')}</div>
 </main>${foot(btn('Solo aplicar', 'sec'), btn('Guardar los 4'))}`;

// 4. Several chosen by hand: "Editar" opens the same form. A field where the
//    chosen ones differ says "Varios" and is left as it is unless touched.
const mixed = (icon, k, said) => `<div class="row">${icon}<div class="tx"><span class="k">${k}</span><b class="mu" style="font-weight:500">${said}</b><small>Se deja como está si no lo tocas</small></div>${down()}</div>`;
const tile = (i, t, c = 'var(--tx)') => `<div style="flex:1;background:var(--s2);border-radius:14px;padding:9px 4px;text-align:center;font-size:12px;color:${c}">${ic(i, '', 'width:20px;height:20px;display:block;margin:0 auto 4px')}${t}</div>`;
const sel = (desc, day, amt, cat, on) => `<div class="row" style="${on ? `background:${tint(P, .12)}` : ''}">${tick(on)}${cat}<div class="tx"><b class="one" style="font-size:14.5px">${desc}</b><small>${day}</small></div><span class="r" style="font-weight:600;font-size:14px">${amt}</span></div>`;
S['25f-seleccion-editar'] = `${top('Movimientos por revisar')}<main style="padding-top:6px">${origin}
 ${mgroup('Viernes 26 de septiembre', '3 de 3 elegidos', '−1.741.500,00', 'r', true, sel('UBER *TRIP', '26 sept', '−21.400', catIcon('transp', 38), true) + sel('FARMACIA SALUD', '26 sept', '−54.900', unknown, true) + sel('PAGO TARJETA CORAL', '26 sept', '−1.665.200', unknown, true), '', tick(true))}
 ${mgroup('Martes 23 de septiembre', '1 de 2 elegidos', '−3.064.000,00', 'r', true, sel('CINE CENTRO', '23 sept', '−34.000', catIcon('ocio', 38), true) + sel('ARRIENDO OCTUBRE', '23 sept', '−3.030.000', catIcon('vivienda', 38), false))}
 </main>
 <div style="position:absolute;left:12px;right:12px;bottom:24px;background:var(--s1);border:1px solid #2c3d63;border-radius:22px;padding:12px;box-shadow:0 -6px 24px rgba(0,0,0,.4)">
  <div style="display:flex;align-items:center;gap:8px"><b>4 elegidos</b><span class="mu" style="font-size:12.5px">de 38 a la vista</span><span style="flex:1"></span><span class="chip" style="padding:5px 10px;font-size:12.5px">Todos</span></div>
  <div style="display:flex;gap:7px;margin-top:10px">${tile('create-outline', 'Editar', 'var(--pr)')}${tile('pricetag-outline', 'Categoría')}${tile('eye-off-outline', 'No ver más')}${tile('trash-outline', 'Descartar', 'var(--red)')}</div>
  <div style="margin-top:10px;height:46px;border-radius:14px;background:linear-gradient(135deg,var(--pr),#4a5ef0);display:grid;place-items:center;font-weight:700">Guardar 2 listos</div></div>`;

S['25g-editar-varios'] = `${top('Editar 4 movimientos', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Gasto')}
 ${many(4, '−1.775.500', 'Del 23 al 26 de septiembre')}
 <div class="list">${end(accIcon('azul', 38), 'Desde dónde', 'Banco Azul', '')}
  ${mixed(sq('pricetag-outline', '#8c9bb5', 38), 'Categoría', 'Varias · 2 sin categoría')}
  ${mixed(ic('create-outline', 'mu'), 'Nota', 'Cada uno con la suya')}
  ${mixed(ci('calendar-outline', '#8c9bb5', 38), 'Fecha', 'Varias')}</div>
 <div class="hint" style="margin-top:10px">Solo cambia lo que toques. El monto de cada uno no se toca aquí.</div>
 </main>${foot(btn('Solo aplicar', 'sec'), btn('Guardar los 4'))}`;

// 5. After: the group answered, with Deshacer.
S['25h-listo'] = `${top('Movimientos por revisar')}<main style="padding-top:6px">${origin}
 ${mgroup('Movimientos que se repiten', '2 grupos · 6 movimientos', '', '', true,
  group(sq('storefront-outline', C.tea, 38), 'D1 LAURELES', '4 movimientos · Mercado sugerida', '−182.400', 'r')
  + group(sq('briefcase-outline', C.grn, 38), 'PAGO NOMINA EMPRESA SAS', '2 movimientos · Salario aprendida', '+8.400.000', 'g'), sq('repeat-outline', C.tea, 30))}
 </main>
 <div style="position:absolute;left:16px;right:16px;bottom:104px;background:#26324f;border:1px solid #3a4a72;border-radius:16px;padding:12px 14px;font-size:13.5px;line-height:1.4;display:flex;gap:10px;align-items:center">${ic('checkmark-circle', '', `width:20px;height:20px;flex:none;color:${C.grn}`)}<span style="flex:1">5 transferencias guardadas a Cajita Naranja. Los próximos llegan así.</span><b class="p">Deshacer</b></div>${tabs('Más')}`;

export default S;
