// Accounts, currencies, categories and the colour picker.
import { ic, ci, sq, C, CAT, ACC, PALETTE, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, bigTitle, tint } from './lib.mjs';

const S = {};
const fams = [['Cálidos', ['coral', 'cereza', 'mandarina', 'ambar', 'oro', 'arena']], ['Verdes y azules', ['lima', 'esmeralda', 'menta', 'turquesa', 'cielo', 'zafiro']], ['Violetas y neutros', ['violeta', 'orquidea', 'rosa', 'pizarra']]];

S['b01-cuentas'] = `${bigTitle('Cuentas', `<div class="btn-r">${ic('swap-vertical-outline')}</div><div class="btn-r">${ic('add')}</div>`)}<main style="padding-top:8px">
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.312.740,55</div>
  <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><span class="chip" style="background:rgba(7,13,26,.35);padding:5px 10px;font-size:12.5px">TRM 3.912,40 · oficial hoy ${ic('refresh-outline')}</span><span class="chip" style="background:rgba(7,13,26,.35);padding:5px 10px;font-size:12.5px;color:#cdd5ff">¿De dónde sale?</span></div>
  <div class="note" style="margin-top:8px">Los brókers muestran lo que metiste, no lo que valen hoy.</div></div>
 <div class="h">Para el día a día<span class="p">Por monto</span></div><div class="list">
  <div class="row">${accIcon('azul')}<div class="tx"><b>Banco Azul</b><small>Cuenta bancaria · COP</small></div><div class="am">12.480.300,00</div></div>
  <div class="row">${accIcon('efectivo')}<div class="tx"><b>Efectivo</b><small>COP</small></div><div class="am">180.000,00</div></div>
  <div class="row">${accIcon('global')}<div class="tx"><b>Global Viajes</b><small>2 monedas</small></div><div class="am">2.106.000,00<small class="mu">+ 120,00 USD</small></div></div></div>
 <div class="h">Tarjetas</div><div class="list"><div class="row">${accIcon('coral')}<div class="tx"><b>Tarjeta Coral</b><small>3.872.900 disponible de 8.000.000</small>
  <div class="pbar" style="margin-top:7px"><i style="width:52%;background:var(--yel)"></i></div></div><div class="am y">−4.127.100,00</div></div></div>
 <div class="h">Ganan rendimientos</div><div class="list">
  <div class="row">${accIcon('verde')}<div class="tx"><b>Ahorro Verde</b><small>3 productos · hoy +924,31</small></div><div class="am">55.240.546,90</div></div>
  <div class="row">${accIcon('ambar')}<div class="tx"><b>Fiducia Ámbar</b><small>Inversión · ${tag('aparte del patrimonio', C.gry)}</small></div><div class="am mu">8.400.000,00</div></div></div>
 <div class="list" style="margin-top:12px"><div class="row">${sq('cash-outline', C.lim, 40)}<div class="tx"><b>Monedas y tasas</b><small>COP, USD, EUR · falta la tasa de EUR</small></div>${chev()}</div>
  <div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>Ver 1 cuenta archivada</b><small>Historial nada más; no cuenta para el patrimonio</small></div>${chev()}</div></div>
 </main><div class="fade"></div>${tabs('Cuentas')}`;

S['b02-de-donde-sale'] = S['b01-cuentas'] + `<div class="scrim"></div><div class="sheet" style="top:140px"><div class="grab"></div>
 <div class="sh"><h2>Cómo se arma el patrimonio</h2><span class="p">Cerrar</span></div>
 <div class="sub" style="margin-bottom:10px">Cada cuenta que cuenta, con lo que aporta al total. Las de otra moneda van a la tasa de hoy.</div>
 <div class="list">${[['azul', '12.480.300,00', ''], ['verde', '55.240.546,90', ''], ['global', '2.575.480,00', '2.106.000 + 120 USD × 3.912,40'], ['dolar', '341.708,00', '87,34 USD × 3.912,40'], ['coral', '−4.127.100,00', 'deuda']]
  .map(([k, a, s]) => `<div class="row">${accIcon(k, 36)}<div class="tx"><b>${ACC[k][2]}</b>${s ? `<small>${s}</small>` : ''}</div><div class="am ${a.startsWith('−') ? 'y' : ''}">${a}</div></div>`).join('')}
  <div class="row plain"><div class="tx"><b>Total</b></div><div class="am b">48.312.740,55</div></div></div>
 <div class="banner" style="background:${tint(C.yel, .12)};color:#f3d58a;margin-top:10px">${ic('alert-circle-outline')}<span>Falta la tasa de EUR: esa plata no está sumando. Fiducia Ámbar está apartada del patrimonio.</span></div></div>`;

S['b03-monedas'] = `${top('Monedas y tasas', { right: `<div class="btn-r">${ic('add')}</div>` })}<main>
 <div class="card hero"><div class="lab">Tasa de hoy · USD</div><div class="big">3.912,40</div>
  <div class="sub">TRM oficial del 27 sept · Superfinanciera</div>
  <div style="display:flex;gap:8px;margin-top:10px"><div class="chip" style="background:rgba(7,13,26,.35)">${ic('refresh-outline')} Actualizar</div><div class="chip" style="background:rgba(7,13,26,.35)">${ic('create-outline')} Escribirla a mano</div></div></div>
 <div class="h">Tus monedas</div><div class="list">
  ${[['COP', 'Peso colombiano', '$', 'En 9 cuentas · la principal', C.grn], ['USD', 'Dólar estadounidense', 'US$', 'En 3 cuentas · 3.912,40 hoy', C.cya], ['EUR', 'Euro', '€', 'En 1 cuenta · sin tasa: no se puede valorar', C.yel]]
   .map(([c, n, s, h, col]) => `<div class="row"><span class="sq" style="width:42px;height:42px;background:${tint(col)};color:${col};font-weight:700;font-size:12.5px">${c}</span><div class="tx"><b>${n} <span class="mu" style="font-weight:400">${s}</span></b><small>${h}</small></div>${chev()}</div>`).join('')}</div>
 <div class="hint">El código de una moneda en uso no se puede cambiar: todos los montos guardados están en esa moneda.</div>
 <div class="banner" style="background:${tint(C.blu, .12)};color:#c3cdfa;margin-top:12px">${ic('cloud-offline-outline')}<span>Sin internet se queda la última tasa que había, y se dice.</span></div></main>`;

S['b04-agregar-moneda'] = S['b03-monedas'] + `<div class="scrim"></div><div class="dialog">
 <b style="font-size:18px">Agregar una moneda</b><div class="sub" style="margin:4px 0 14px">Luego podrás crear cuentas en ella.</div>
 <div class="field on"><div class="lab">Código</div><div class="v">CAD</div></div><div class="hint">Tres letras: CAD, MXN, BRL…</div>
 <div class="field" style="margin-top:10px"><div class="lab">Nombre</div><div class="v">Dólar canadiense</div></div>
 <div class="field" style="margin-top:10px"><div class="lab">Símbolo</div><div class="v">C$</div></div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Guardar</div></div></div>`;

const typePick = on => `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['wallet-outline', C.blu, 'Bancaria'], ['card-outline', C.yel, 'Tarjeta'], ['cash-outline', C.lim, 'Efectivo'], ['trending-up-outline', C.gold, 'Inversión']]
  .map(([i, c, t], n) => `<div style="background:${n === on ? tint(c, .16) : 'var(--s1)'};border:1px solid ${n === on ? c : '#1f2c47'};border-radius:16px;padding:10px 4px;text-align:center;font-size:12.5px">${ci(i, c, 36).replace('display:grid', 'display:grid;margin:0 auto 6px')}${t}</div>`).join('')}</div>`;

S['b05-nueva-cuenta'] = `${top('Nueva cuenta', { left: 'x' })}<main style="padding-top:10px">
 <div class="card" style="display:flex;gap:12px;align-items:center;border-color:${tint(C.pur, .5)};background:${tint(C.pur, .1)}">${ci('document-text-outline', C.pur)}<div class="tx"><b>Llenarla desde un extracto PDF</b><small>Nombre, moneda y movimientos, y el saldo cuadra con el banco</small></div>${chev()}</div>
 <div style="text-align:center;margin:12px 0" class="mu">o escríbela tú</div>
 <div style="display:flex;align-items:center;gap:14px"><div style="position:relative">${ci('wallet-outline', C.blu, 64)}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field on" style="flex:1"><div class="lab">Nombre</div><div class="v mu">Nombre de la cuenta</div></div></div>
 <div class="lab" style="margin:14px 4px 8px">Tipo</div>${typePick(0)}
 <div class="list" style="margin-top:12px">
  <div class="row plain"><div class="tx"><span class="k">MONEDA</span><b>COP · Peso colombiano</b></div><span class="p" style="font-size:13px">+ Otra</span>${chev()}</div>
  <div class="row plain"><div class="tx"><span class="k">SALDO INICIAL</span><b>0,00</b></div></div>
  <div class="row plain"><div class="tx"><span class="k">ABIERTA EL</span><b>Hoy</b></div>${chev()}</div></div>
 <div class="list" style="margin-top:12px"><div class="row plain"><div class="tx"><b>Cuenta para el patrimonio</b><small>Apágalo para brókers o plata apartada</small></div>${sw(true)}</div></div>
 </main><div class="save">Crear cuenta</div>`;

S['b06-editar-tarjeta'] = `${top('Editar cuenta')}<main style="padding-top:10px">
 <div style="display:flex;align-items:center;gap:14px"><div style="position:relative">${accIcon('coral', 64)}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field" style="flex:1"><div class="lab">Nombre</div><div class="v">Tarjeta Coral</div></div></div>
 <div class="lab" style="margin:14px 4px 8px">Tipo</div>${typePick(1)}
 <div class="list" style="margin-top:12px">
  <div class="row plain"><div class="tx"><span class="k">MONEDA</span><b>COP · Peso colombiano</b><small>No se puede cambiar: tiene movimientos</small></div>${ic('lock-closed-outline', 'mu')}</div>
  <div class="row plain"><div class="tx"><span class="k">CUPO TOTAL · VIGENTE DESDE 1 AGO</span><b>8.000.000,00</b></div><span class="p" style="font-size:13px">Historial (3)</span>${chev()}</div>
  <div class="row plain"><div class="tx"><span class="k">SALDO INICIAL</span><b>0,00</b></div></div>
  <div class="row plain"><div class="tx"><span class="k">ABIERTA EL</span><b>12 de marzo de 2024</b></div>${chev()}</div></div>
 <div class="hint">Cambiar el cupo no mueve plata: la deuda sigue igual y solo cambia lo disponible.</div>
 <div class="list" style="margin-top:12px"><div class="row plain"><div class="tx"><b>Cuenta para el patrimonio</b></div>${sw(true)}</div>
  <div class="row plain"><div class="tx"><b>Archivar</b><small>Se esconde de las listas; su historial se conserva</small></div>${sw(false)}</div>
  <div class="row plain">${ic('document-text-outline', 'p')}<div class="tx"><b class="p">Importar un extracto PDF</b></div>${chev()}</div>
  <div class="row plain">${ic('trash-outline', 'r')}<div class="tx"><b class="r">Eliminar esta cuenta</b><small>Se borran también sus 32 movimientos</small></div></div></div>
 </main><div class="save">Guardar</div>`;

S['b06b-editar-cuenta-icono-color'] = `${top('Ícono y color', { left: 'x' })}<main style="padding-top:10px">
 <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${ci('card-outline', PALETTE.ambar, 58)}
  <div style="flex:1"><div class="lab">Así se verá</div><b style="font-size:17px">Tarjeta Coral</b><div class="sub">Disponible 3.872.900</div></div><span class="y b">−4.127.100</span></div>
 <div class="tabs" style="margin-top:6px"><div class="on">Color</div><div>Ícono</div><div>Logo de tu banco</div></div>
 ${fams.map(([t, cs]) => `<div class="lab" style="margin:12px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${cs.map(n => { const c = PALETTE[n]; const on = n === 'ambar';
   return `<div style="aspect-ratio:1;border-radius:50%;background:${tint(c, .2)};color:${c};display:grid;place-items:center;position:relative;${on ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${ic('card-outline', '', 'width:45%;height:45%')}${on ? `<span style="position:absolute;right:-4px;top:-4px;width:18px;height:18px;border-radius:50%;background:${c};color:#0b1222;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>` : ''}</div>`; }).join('')}</div>`).join('')}
 <div class="hint" style="margin-top:12px">Las cuentas van en círculo y las categorías en cuadrado: así se distinguen de un vistazo. El color ya existe en tus datos; esto solo lo deja escoger.</div>
 </main><div class="save">Listo</div>`;

S['b07-historial-cupos'] = S['b06-editar-tarjeta'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>Historial de cupos</h2><span class="p">${ic('add')}</span></div>
 <div class="list">${[['8.000.000,00', '1 ago 2026', 'Cambio de cupo', C.grn], ['6.500.000,00', '15 ene 2025', 'Cambio de cupo', C.cya], ['800.000,00', '12 mar 2024', 'Cupo inicial · del backup', C.gry]]
  .map(([a, d, t, c]) => `<div class="row">${ci('trending-up-outline', c, 38)}<div class="tx"><b>${a}</b><small>${t} · desde ${d}</small></div>${chev()}</div>`).join('')}</div>
 <div class="hint">Cada fila es el cupo desde ese día. Nunca es un movimiento.</div></div>`;

S['b08-categorias'] = `${top('Categorías', { right: `<div class="btn-r">${ic('add')}</div>` })}<main>
 <div class="seg"><div class="on red">Gastos · 16</div><div>Ingresos · 6</div><div>De productos · 3</div></div>
 <div class="search" style="margin-top:10px">${ic('search-outline')}Buscar categoría</div>
 <div class="h">Más usadas primero<span class="p">A–Z</span></div>
 <div class="list">${[['rest', 112], ['mercado', 96], ['transp', 81], ['servicios', 36], ['vivienda', 12], ['salud', 9], ['ocio', 8], ['ropa', 7]]
   .map(([k, t]) => `<div class="row">${catIcon(k)}<div class="tx"><b>${CAT[k][2]}</b><small>En ${t} movimientos</small></div>${chev()}</div>`).join('')}</div>
 <div class="list" style="margin-top:12px"><div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>Ver 3 archivadas</b><small>Ya no se ofrecen; lo registrado no cambia</small></div>${chev()}</div></div></main>`;

S['b09-categorias-de-productos'] = `${top('Categorías', { right: `<div class="btn-r">${ic('add')}</div>` })}<main>
 <div class="seg"><div>Gastos · 16</div><div>Ingresos · 6</div><div class="on blu">De productos · 3</div></div>
 <div class="banner" style="background:${tint(C.gold, .1)};color:#f0dca4;margin-top:10px">${ic('information-circle-outline')}<span>De un movimiento que solo toca lo que el producto acumuló: un cashback, una corrección contra el banco…</span></div>
 <div class="list" style="margin-top:12px">${['cashback', 'correccion'].map(k => `<div class="row">${catIcon(k)}<div class="tx"><b>${CAT[k][2]}</b><small>${k === 'cashback' ? 'En 41 movimientos' : 'En 4 movimientos'}</small></div>${chev()}</div>`).join('')}
  <div class="row">${sq('ellipsis-horizontal', C.gry)}<div class="tx"><b>Otro</b><small>sin usar</small></div>${chev()}</div></div></main>`;

// The colour picker, redone: every swatch IS the category as it will look,
// grouped by family, and a live preview of the row it becomes.
S['b10-editar-categoria-color'] = `${top('Editar categoría')}<main style="padding-top:10px">
 <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${sq('restaurant-outline', PALETTE.coral, 58)}
  <div style="flex:1"><div class="lab">Así se verá</div><b style="font-size:17px">Restaurantes</b><div class="sub">En 112 movimientos</div></div><span class="r b">−32.000</span></div>
 <div class="field" style="margin-top:10px"><div class="lab">Nombre</div><div class="v">Restaurantes</div></div>
 <div class="seg" style="margin-top:10px"><div class="on red">Gastos</div><div>Ingresos</div></div>
 <div class="tabs" style="margin-top:6px"><div class="on">Color</div><div>Ícono</div><div>Imagen propia</div></div>
 ${fams.map(([t, cs]) => `<div class="lab" style="margin:12px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${cs.map(n => { const c = PALETTE[n]; const on = n === 'coral';
   return `<div style="aspect-ratio:1;border-radius:30%;background:${tint(c, .2)};color:${c};display:grid;place-items:center;position:relative;${on ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${ic('restaurant-outline', '', 'width:45%;height:45%')}${on ? `<span style="position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;background:${c};color:#0b1222;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>` : ''}</div>`; }).join('')}</div>`).join('')}
 <div class="list" style="margin-top:14px"><div class="row plain"><div class="tx"><b>Ganancia o pérdida de inversión</b><small>En una cuenta de tipo Inversión cuenta como lo que ganó o perdió</small></div>${sw(false)}</div>
  <div class="row plain"><div class="tx"><b>Archivar</b><small>Deja de ofrecerse; lo registrado no cambia</small></div>${sw(false)}</div></div>
 </main>`;

S['b11-editar-categoria-icono'] = `${top('Editar categoría')}<main style="padding-top:10px">
 <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${sq('cafe-outline', PALETTE.coral, 58)}
  <div style="flex:1"><div class="lab">Así se verá</div><b style="font-size:17px">Restaurantes</b><div class="sub">Usada en 112 movimientos</div></div></div>
 <div class="tabs" style="margin-top:6px"><div>Color</div><div class="on">Ícono</div><div>Imagen propia</div></div>
 <div class="search" style="margin-top:12px">${ic('search-outline')}Buscar ícono</div>
 ${[['Del día a día', ['restaurant-outline', 'cafe-outline', 'fast-food-outline', 'pizza-outline', 'beer-outline', 'wine-outline', 'basket-outline', 'cart-outline', 'bag-handle-outline', 'shirt-outline', 'cut-outline', 'paw-outline']], ['Transporte', ['bus-outline', 'car-outline', 'bicycle-outline', 'airplane-outline', 'train-outline', 'boat-outline']], ['Dinero', ['cash-outline', 'card-outline', 'wallet-outline', 'trending-up-outline', 'gift-outline', 'receipt-outline']]]
  .map(([t, is]) => `<div class="lab" style="margin:12px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${is.map((i, n) => `<div style="aspect-ratio:1;border-radius:30%;display:grid;place-items:center;background:${i === 'cafe-outline' ? tint(PALETTE.coral, .22) : 'var(--s1)'};color:${i === 'cafe-outline' ? PALETTE.coral : '#c9d2e3'};border:1px solid ${i === 'cafe-outline' ? PALETTE.coral : '#1c2843'}">${ic(i, '', 'width:46%;height:46%')}</div>`).join('')}</div>`).join('')}
 </main><div class="save">Guardar</div>`;

S['b12-editar-categoria-imagen'] = `${top('Editar categoría')}<main style="padding-top:10px">
 <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px"><span class="sq" style="width:58px;height:58px;background:#fff;color:#e11;font-weight:900;font-size:13px">LOGO</span>
  <div style="flex:1"><div class="lab">Así se verá</div><b style="font-size:17px">Restaurantes</b></div></div>
 <div class="tabs" style="margin-top:6px"><div>Color</div><div>Ícono</div><div class="on">Imagen propia</div></div>
 <div class="card" style="margin-top:12px;text-align:center;border-style:dashed;border-color:#34466b">${ci('image-outline', C.blu, 52).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b>Subir una imagen</b>
  <div class="sub">PNG, JPG, WEBP o SVG, hasta 100 kB. Sirve para el logo de tu banco. Se guarda dentro de tu copia.</div></div>
 <div class="lab" style="margin:14px 2px 8px">Tus imágenes</div>
 <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px">${['#fff', '#ffd400', '#e30613', '#6d28d9', '#0ea5e9'].map((c, n) => `<div style="aspect-ratio:1;border-radius:30%;background:${c};${n === 0 ? 'box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--pr)' : ''}"></div>`).join('')}</div>
 <div class="p" style="margin-top:10px;font-size:13.5px">Ver 4 imágenes más</div></main><div class="save">Guardar</div>`;

S['b13-categoria-de-producto'] = `${top('Editar la categoría', { left: 'x' })}<main style="padding-top:10px">
 <div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${catIcon('cashback', 58)}<div style="flex:1"><div class="lab">Así se verá</div><b style="font-size:17px">Cashback</b><div class="sub">De productos · 41 movimientos</div></div></div>
 <div class="field" style="margin-top:10px"><div class="lab">Nombre</div><div class="v">Cashback</div></div>
 <div class="tabs" style="margin-top:6px"><div class="on">Color</div><div>Ícono</div></div>
 <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-top:12px">${Object.values(PALETTE).map(c => `<div style="aspect-ratio:1;border-radius:30%;background:${tint(c, .22)};color:${c};display:grid;place-items:center;${c === PALETTE.oro ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${ic('sparkles-outline', '', 'width:50%;height:50%')}</div>`).join('')}</div>
 <div class="list" style="margin-top:14px"><div class="row plain">${ic('trash-outline', 'r')}<div class="tx"><b class="r">Borrar esta categoría</b></div></div></div>
 </main><div class="save">Guardar</div>`;

export default S;
