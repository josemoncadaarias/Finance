// Products and yields: the list, an account's sheet with its tabs, a day, a
// product, a CDT, a rate, a product's own movement.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, tint } from './lib.mjs';

const S = {};

S['c01-rendimientos'] = `${top('Productos y rendimientos', { sub: 'Lo que tus cuentas te pagan', right: `<div class="btn-r">${ic('refresh-outline')}</div><div class="btn-r">${ic('add')}</div>` })}<main>
 <div class="card hero" style="text-align:center"><div class="lab">Rendimiento acumulado</div><div class="big g">3.948.450,62 <span style="font-size:15px;color:var(--mu)">COP</span></div>
  <div class="sub">Rendimientos y cashback que todavía no son parte de tu patrimonio</div>
  <div class="mini" style="margin-top:12px;text-align:left"><div><span class="lab">Rindió el 26</span><b class="g">+16.147,84</b></div><div><span class="lab">Septiembre</span><b class="g">+433.078,76</b></div><div><span class="lab">E.A. real</span><b>10,34 %</b></div></div>
  <div class="chip" style="margin-top:12px;border-color:var(--pr);color:#dfe4ff">${ic('stats-chart-outline', 'p')} Resumen de rendimientos ${chev()}</div></div>
 <div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>2 días sin retefuente calculada: faltan parámetros por confirmar.</span></div>
 <div class="h">En pesos</div><div class="list">
  ${[['verde', '10,50 % E.A. · 3 productos', '55.240.546,90', '+14.051,57'], ['naranja', '8,25 % E.A. · 2 productos · CDT', '501.714,50', '+1.846,26'], ['azul', '6,00 % E.A. · pausado', '12.480.300,00', '']]
   .map(([k, s, a, g]) => `<div class="row">${accIcon(k)}<div class="tx"><b>${ACC[k][2]}</b><small>${s}</small></div><div class="am">${a}${g ? `<small class="g">${g}</small>` : `<small class="mu">${ic('pause-circle-outline', '', 'width:14px;height:14px;vertical-align:-2px')}</small>`}</div></div>`).join('')}</div>
 <div class="h">En otras monedas</div><div class="list"><div class="row">${accIcon('dolar')}<div class="tx"><b>Cuenta Dólar</b><small>USD · 4,00 % E.A. · sin retefuente</small></div><div class="am">87,34 USD<small class="g">+0,33</small></div></div></div>
 </main><div class="fade"></div>${tabs('Cuentas')}`;

const sheetHead = (tab) => `${top(`<span style="display:flex;align-items:center;gap:9px">${accIcon('verde', 32)}Ahorro Verde ${down()}</span>`, { left: 'x' })}
 <div style="padding:10px 16px 0"><div class="card hero"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="lab">Rendimiento disponible</div><div class="big g" style="font-size:27px">3.240.546,90</div></div>
  <div style="text-align:right"><div class="lab">Rinde sobre</div><b style="font-size:16px">55.240.546,90</b></div></div>
  <div class="sub">Hoy el banco pagó sobre 55.226.495,33, el saldo con que cerró ayer. Lo de hoy se paga mañana.</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px">${[['stats-chart-outline', C.blu, 'Resumen'], ['pie-chart-outline', C.tea, 'En Inicio'], ['swap-horizontal', C.yel, 'Mover'], ['add', C.grn, 'Producto']]
   .map(([i, c, t]) => `<div style="text-align:center;font-size:11.5px;color:#c9d1e6">${ci(i, c, 42).replace('display:grid', 'display:grid;margin:0 auto 4px')}${t}</div>`).join('')}</div></div>
 <div class="tabs" style="margin:10px -16px 0;padding:0 16px">${['Productos', 'Días', 'Movimientos', 'Tasas'].map(t => `<div class="${t === tab ? 'on' : ''}">${t}</div>`).join('')}</div></div>`;
const compose = `<div style="position:absolute;left:16px;right:16px;bottom:22px;display:flex;gap:10px">
  <div style="flex:1;height:54px;border-radius:17px;background:${tint(C.red, .2)};color:var(--red);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;backdrop-filter:blur(6px)">${ic('arrow-up')}Gasto</div>
  <div style="flex:1;height:54px;border-radius:17px;background:${tint(C.grn, .2)};color:var(--grn);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700">${ic('arrow-down')}Ingreso</div>
  <div style="width:54px;height:54px;border-radius:17px;background:${tint(C.blu, .24)};color:var(--pr);display:grid;place-items:center">${ic('swap-horizontal')}</div></div>`;

S['c02-ficha-productos'] = `${sheetHead('Productos')}<main style="padding-top:10px">
 <div class="list">
  <div class="row">${sq('wallet-outline', C.grn)}<div class="tx"><b>Cuenta de ahorros</b><small>10,50 % E.A. · todos los días ${tag('Habitual', C.blu)}</small></div><div class="am">52.000.000,00<small class="g">+13.702,10</small></div></div>
  <div class="row">${sq('basket-outline', C.lim)}<div class="tx"><b>Bolsillo Mercado</b><small>10,50 % E.A. · saldo leído el 20 sept</small></div><div class="am">1.240.546,90<small class="g">+349,47</small></div></div>
  <div class="row">${sq('lock-closed-outline', C.org)}<div class="tx"><b>CDT 90 días</b><small>11,20 % E.A. · paga cada 3 meses ${tag('CDT', C.org)} ${tag('aparte', C.gry)}</small></div><div class="am">2.000.000,00<small class="mu">paga 12 dic</small></div></div></div>
 <div class="hint">De este saldo, 3.240.546,90 son rendimientos que pagó el banco. Toca un producto para ver o cambiar su saldo, su tasa y sus días.</div>
 </main><div class="fade"></div>${compose}`;

S['c03-ficha-dias'] = `${sheetHead('Días')}<main style="padding-top:10px">
 <div style="display:flex;gap:8px"><div class="chip on">Todos los productos ${down()}</div><div class="chip">Septiembre ${down()}</div><span style="margin-left:auto" class="mu note">26 días</span></div>
 <div class="list" style="margin-top:10px">
  ${[['27 sept', '55.226.495,33', '14.051,57', '−983,61', '13.067,96', 'lock', ''], ['26 sept', '55.212.448,02', '14.047,99', '−983,36', '13.064,63', 'check', '13.064,60 el banco'], ['25 sept', '55.198.404,30', '14.044,42', '−983,11', '13.061,31', '', ''], ['24 sept', '53.198.404,30', '13.535,57', '−947,49', '12.588,08', '', 'incluye bonificación']]
   .map(([d, base, gross, tax, net, st, note]) => `<div class="row" style="align-items:flex-start">${ci(st === 'lock' ? 'lock-closed-outline' : st === 'check' ? 'checkmark-done-outline' : 'calendar-outline', st ? C.grn : C.gry, 38)}
    <div class="tx"><b>${d}</b><small>Sobre ${base} · bruto ${gross} · retefuente <span class="r">${tax}</span>${note ? `<br>${note}` : ''}</small></div><div class="am g">+${net}</div></div>`).join('')}</div>
 <div class="hint">${ic('lock-closed-outline', '', 'width:13px;height:13px;vertical-align:-2px')} Días fijados a lo que pagó el banco. Toca un día para escribir lo que pagó, fijarlo o dejarlo en cero.</div>
 </main><div class="fade"></div>${compose}`;

S['c04-ficha-dia-detalle'] = S['c03-ficha-dias'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>26 de septiembre</h2><span class="p">Cerrar</span></div>
 <div class="list">${[['Base', 'Saldo con que cerró el 25', '55.212.448,02'], ['Tasa', 'Base 10,50 % · bonificación 5,50 %', '16,00 % E.A.'], ['Bruto', '', '14.047,99'], ['Retefuente 7 %', 'El día pasó 0,055 UVT', '−983,36'], ['Neto', 'Lo que calculó la app', '13.064,63']]
  .map(([t, s, a]) => `<div class="row plain"><div class="tx"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div><div class="am ${a.startsWith('−') ? 'r' : ''}">${a}</div></div>`).join('')}</div>
 <div class="field on" style="margin-top:10px"><div class="lab">Lo que pagó el banco</div><div class="v">13.064,60</div></div>
 <div class="list" style="margin-top:10px"><div class="row plain"><div class="tx"><b>Fijar este día</b><small>Un recálculo no lo vuelve a tocar</small></div>${sw(true)}</div></div>
 <div style="display:flex;gap:10px;margin-top:12px"><div class="btn ghost" style="flex:1">${ic('arrow-undo-outline')}Deshacer corrección</div><div class="btn ghost" style="flex:1">Dejar en cero</div></div></div>`;

S['c05-ficha-movimientos'] = `${sheetHead('Movimientos')}<main style="padding-top:10px">
 <div class="search">${ic('search-outline')}Buscar en septiembre: nota o categoría</div>
 <div style="display:flex;gap:8px;margin-top:10px"><div class="chip on">Por fecha</div><div class="chip">Por categoría</div><div class="chip">Más altos</div><div class="chip">${ic('funnel-outline')}</div></div>
 <div class="list" style="margin-top:10px">
  <div class="row">${catIcon('mercado', 38)}<div class="tx"><b>Mercado quincena</b><small>25 sept · Bolsillo Mercado</small></div><div class="am r">−164.200,00</div></div>
  <div class="row">${ci('swap-horizontal', C.blu, 38)}<div class="tx"><b>Entre productos</b><small>24 sept · Viajes → Cuenta de ahorros</small></div><div class="am">2.000.000,00</div></div>
  <div class="row">${catIcon('cashback', 38)}<div class="tx"><b>Cashback</b><small>20 sept · solo el producto</small></div><div class="am g">+12.400,00</div></div>
  <div class="row">${ci('arrow-down', C.grn, 38)}<div class="tx"><b>Desde Banco Azul</b><small>18 sept · transferencia</small></div><div class="am g">+3.000.000,00</div></div></div>
 <div class="card" style="margin-top:10px;border-color:${tint(C.yel, .4)}"><div style="display:flex;gap:10px">${ci('alert-circle-outline', C.yel, 36)}<div class="tx"><b>Retiro sin su movimiento</b><small>Este retiro de 50.000 del 3 sept quedó solo: el movimiento de la cuenta que lo acompañaba ya no está.</small><div class="p" style="margin-top:6px;font-size:13.5px">Borrar retiro</div></div></div></div>
 </main><div class="fade"></div>${compose}`;

S['c06-ficha-tasas'] = `${sheetHead('Tasas')}<main style="padding-top:10px">
 <div class="list">
  <div class="row">${sq('trending-up-outline', C.tea)}<div class="tx"><b>10,50 % E.A. · Base</b><small>Desde el 1 ene 2026 · todos los productos</small></div>${tag('Vigente', C.grn)}</div>
  <div class="row">${sq('flame-outline', C.pnk)}<div class="tx"><b>+5,50 % · Bonificación por gasto</b><small>si gastas 400.000 en el mes · septiembre: cumplido</small></div>${tag('Vigente', C.grn)}</div>
  <div class="row">${sq('trending-up-outline', C.gry)}<div class="tx"><b>9,00 % E.A. · Base</b><small>del 1 jun al 31 dic 2025</small></div>${tag('Ya no aplica', C.gry)}</div>
  <div class="row">${sq('lock-closed-outline', C.org)}<div class="tx"><b>11,20 % E.A. · CDT 90 días</b><small>Solo ese producto · desde el 12 sept</small></div>${tag('Vigente', C.grn)}</div></div>
 <div class="btn ghost" style="margin-top:10px">${ic('add')}Agregar tasa</div>
 <div class="h">Cómo paga</div><div class="list">
  <div class="row plain"><div class="tx"><b>Todos los días</b><small>o cada N meses, como un CDT</small></div>${chev()}</div>
  <div class="row plain"><div class="tx"><b>Dejar de calcular</b><small>Los días ya calculados se quedan</small></div>${sw(false)}</div></div>
 <div class="hint">Una tasa nueva no borra la anterior: manda la más reciente hasta su fecha.</div>
 </main>`;

S['c07-producto'] = `${top('Bolsillo Mercado', { sub: 'Ahorro Verde', left: 'x', right: `<div class="btn-r" style="color:var(--red)">${ic('trash-outline')}</div>` })}<main style="padding-top:10px">
 <div class="card hero"><div class="mini"><div><span class="lab">Saldo hoy</span><b>1.240.546,90</b></div><div><span class="lab">Rindió desde el 20</span><b class="g">+2.446,29</b></div></div></div>
 <div class="field" style="margin-top:10px"><div class="lab">Nombre</div><div class="v">Bolsillo Mercado</div></div>
 <div class="lab" style="margin:12px 4px 8px">Tipo</div>
 <div class="seg"><div class="on blu">Alto rendimiento</div><div>CDT</div></div>
 <div class="h">Su saldo</div><div class="list">
  <div class="row plain"><div class="tx"><span class="k">¿DE DÓNDE SALE SU SALDO?</span><b>Lo escribo yo, leído del banco</b><small>o lo que otro producto le pasó</small></div>${chev()}</div>
  <div class="row plain"><div class="tx"><span class="k">SALDO LEÍDO DEL BANCO · CIERRE DEL 20 SEPT</span><b>1.238.100,61</b><small>Movido desde entonces: +0,00</small></div>${chev()}</div>
  <div class="row plain"><div class="tx"><span class="k">RINDE DESDE</span><b>20 de septiembre de 2026</b><small>Antes de esa fecha no se calcula nada</small></div>${chev()}</div></div>
 <div class="list" style="margin-top:12px">
  <div class="row plain"><div class="tx"><b>Retención en la fuente</b><small>7 % los días de 0,055 UVT o más</small></div>${sw(true)}</div>
  <div class="row plain"><div class="tx"><b>Cuenta para el patrimonio</b></div>${sw(true)}</div>
  <div class="row plain"><div class="tx"><b>Hacerlo el habitual</b><small>Recibe lo que no dice de qué producto es</small></div>${sw(false)}</div>
  <div class="row plain"><div class="tx"><b>Tasa</b><small>Usa las de la cuenta · 10,50 % E.A.</small></div><span class="p" style="font-size:13px">Tasa propia</span></div></div>
 </main><div class="save">Guardar</div>`;

S['c08-producto-cdt'] = `${top('CDT 90 días', { sub: 'Ahorro Verde', left: 'x' })}<main style="padding-top:10px">
 <div class="card hero"><div class="lab">Al vencer recibes</div><div class="big g">2.051.330,04</div>
  <div class="sub">Bruto 55.193,59 · retefuente −3.863,55 · neto 51.330,04</div>
  <div class="pbar" style="margin-top:10px"><i style="width:18%;background:var(--grn)"></i></div><div class="note" style="margin-top:6px">16 de 91 días · vence el 12 de diciembre</div></div>
 <div class="list" style="margin-top:10px">${[['Monto', '2.000.000,00'], ['Plazo', '91 días · paga al final'], ['Abierto el', '12 sept 2026'], ['Vence el', '12 dic 2026'], ['Tasa', '11,20 % E.A.']].map(([k, v]) => `<div class="row plain"><div class="tx"><span class="k">${k.toUpperCase()}</span><b>${v}</b></div></div>`).join('')}</div>
 <div class="h">Al pagar</div><div class="list">
  <div class="row">${accIcon('verde', 38)}<div class="tx"><span class="k">ENTRA A</span><b>Cuenta de ahorros</b></div>${chev()}</div>
  <div class="row">${catIcon('ganancia', 38)}<div class="tx"><span class="k">CATEGORÍA</span><b>Rendimientos</b></div>${chev()}</div></div>
 <div class="h">Pagos<span class="mu" style="letter-spacing:0;text-transform:none">0 de 1 · pendiente</span></div>
 <div class="list"><div class="row plain"><div class="tx"><b>12 dic 2026</b><small>de 91 días</small></div>${tag('Pendiente', C.yel)}</div></div>
 </main>`;

S['c09-nueva-tasa'] = `${top('Agregar tasa', { left: 'x' })}<main style="padding-top:10px">
 <div class="lab" style="margin:0 4px 8px">¿Qué quieres hacer?</div>
 <div class="list"><div class="row plain">${tick(true)}<div class="tx"><b>Cambiar una tasa que ya tenía</b><small>La anterior deja de aplicar el día antes y queda en el historial</small></div></div>
  <div class="row plain">${tick(false)}<div class="tx"><b>Agregar otra tasa que se suma</b><small>Las dos quedan vigentes al mismo tiempo, cada una con su condición</small></div></div></div>
 <div class="field" style="margin-top:10px"><div class="lab">¿Cuál cambias?</div><div class="v">10,50 % · Base ${down()}</div></div>
 <div style="display:flex;gap:10px;margin-top:10px"><div class="field on" style="flex:1"><div class="lab">% E.A.</div><div class="v">11,00</div></div><div class="field" style="flex:1"><div class="lab">Nombre de la parte</div><div class="v">Base</div></div></div>
 <div style="display:flex;gap:10px;margin-top:10px"><div class="field" style="flex:1"><div class="lab">Válida desde</div><div class="v">1 oct 2026</div></div><div class="field" style="flex:1"><div class="lab">Hasta (opcional)</div><div class="v mu">Sin fecha</div></div></div>
 <div class="h">¿A cuáles productos aplica?</div>
 <div class="chips">${['Cuenta de ahorros', 'Bolsillo Mercado', 'CDT 90 días'].map((t, n) => `<div class="chip ${n < 2 ? 'on' : ''}">${n < 2 ? ic('checkmark') : ''}${t}</div>`).join('')}</div>
 <div class="hint">Sin marcar ninguno aplica a todos. Un producto con tasas propias usa solo esas.</div>
 <div class="list" style="margin-top:12px"><div class="row plain"><div class="tx"><b>Es una bonificación por gasto</b><small>Solo si gastas un mínimo con esta cuenta</small></div>${sw(false)}</div></div>
 </main><div class="save">Guardar tasa</div>`;

S['c10-movimiento-de-producto'] = `${top('Ingreso a un producto', { left: 'x' })}<main style="padding-top:8px">
 <div class="seg"><div>${ic('arrow-up')}Gasto</div><div class="on grn">${ic('arrow-down')}Ingreso</div></div>
 <div class="amount"><span class="g" style="font-size:30px;vertical-align:8px">+</span><span class="v">12.400</span><span class="cur">COP</span></div>
 <div class="list"><div class="row">${accIcon('verde', 40)}<div class="tx"><span class="k">CUENTA</span><b>Ahorro Verde</b></div><div class="chip i" style="padding:5px 10px 5px 5px;font-size:13px">${sq('wallet-outline', C.grn, 24)}Cuenta de ahorros ${down()}</div></div></div>
 <div class="lab" style="margin:12px 4px 8px">¿Qué cambia?</div>
 <div class="list">${[['Solo el producto', 'Solo cambia sus rendimientos; no el saldo de la cuenta ni tu patrimonio', true], ['Producto y patrimonio', 'Queda como un movimiento normal de la cuenta', false], ['Hacer efectivo', 'Plata que el producto ya tenía pasa a contar en la cuenta', false]]
   .map(([t, s, on]) => `<div class="row plain">${tick(on)}<div class="tx"><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>
 <div class="h">Categoría<span class="p">Nueva categoría</span></div>
 <div class="chips"><div class="chip i on">${catIcon('cashback', 27)}Cashback</div><div class="chip i">${catIcon('correccion', 27)}Corrección del banco</div></div>
 </main><div class="save">Guardar</div>`;

S['c11-agregar-cuenta-rendimientos'] = S['c01-rendimientos'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>Agregar una cuenta</h2><span class="p">Cerrar</span></div>
 <div class="sub" style="margin-bottom:10px">Solo las cuentas que agregues aquí generan rendimientos. Las que se mueven con el mercado no deberían estar aquí.</div>
 <div class="list">${['efectivo', 'global', 'ambar'].map(k => `<div class="row">${accIcon(k)}<div class="tx"><b>${ACC[k][2]}</b></div>${ic('add-circle-outline', 'p')}</div>`).join('')}</div></div>`;

export default S;
