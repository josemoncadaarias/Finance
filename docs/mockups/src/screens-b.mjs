// Categories and their editor (v3 draft; group 3). Accounts and currencies
// moved to screens-2.mjs (group 2).
import { ic, ci, sq, C, CAT, ACC, PALETTE, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, bigTitle, tint } from './lib.mjs';

const S = {};
const fams = [['Cálidos', ['coral', 'cereza', 'mandarina', 'ambar', 'oro', 'arena']], ['Verdes y azules', ['lima', 'esmeralda', 'menta', 'turquesa', 'cielo', 'zafiro']], ['Violetas y neutros', ['violeta', 'orquidea', 'rosa', 'pizarra']]];

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
