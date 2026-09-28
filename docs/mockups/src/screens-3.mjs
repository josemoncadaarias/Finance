// Group 3 (v4, 2026-09-28): Categories and their editor. What the screen does
// today (features/categories): two lists, Gastos and Ingresos, each folding
// with its count; "Nueva categoría" asking which list; opening or closing
// every list at once; Más usadas / A-Z shared with the picker; "En N
// movimientos"; the archived, shown on demand with their hint; the two
// arrows on a long list. The editor: the face, the name, "Para" (locked once
// in use, saying why), "Ganancia o pérdida de inversión", "Usada en",
// archive. Drawn with the rules of groups 1 and 2: categories are rounded
// squares, the face opens Ícono / Color / Imagen propia, one line per name.
import { ic, sq, ci, C, CAT, PALETTE, catIcon, chev, down, sw, top, status, tint } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);

// Categorías is reached from Más, so it has a back arrow and no bottom bar.
const head = top('Categorías', { right: `<div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Nueva categoría</div>` });

const order = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div class="seg" style="flex:1"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="chip" style="padding:9px 12px">${ic('chevron-collapse-outline', '', 'width:18px;height:18px')}Cerrar todas</div></div>`;
const orderClosed = order.replace('chevron-collapse-outline', 'chevron-expand-outline').replace('Cerrar todas', 'Abrir todas');

// A list's heading: the mark and colour of the movement form's two sides,
// its name, its count, and whether it is open.
const side = (kind, count, open) => {
  const [i, c, t] = kind === 'g' ? ['arrow-up', C.red, 'Gastos'] : ['arrow-down', C.grn, 'Ingresos'];
  return `<div class="row" style="background:var(--s1);border-radius:18px;border:1px solid #17223b;margin-top:10px">${ci(i, c, 36)}<div class="tx"><b style="font-size:16.5px">${t}</b></div>
   <span class="chip" style="padding:3px 10px;font-size:12.5px">${count}</span>${ic(open ? 'chevron-down-outline' : 'chevron-forward-outline', 'mu', 'width:19px;height:19px')}</div>`;
};
const row = (k, n) => `<div class="row">${catIcon(k)}<div class="tx"><b class="one">${CAT[k][2]}</b><small>${n === 0 ? 'Sin usar' : n === 1 ? 'En 1 movimiento' : `En ${n} movimientos`}</small></div>${chev()}</div>`;
const longRow = `<div class="row">${sq('paw-outline', PALETTE.arena)}<div class="tx"><b class="one">Mascotas: comida, veterinario y peluquería</b><small>En 7 movimientos</small></div>${chev()}</div>`;
const archivedRow = (open, n = 3) => `<div class="list" style="margin-top:12px"><div class="row">${sq('archive-outline', C.gry, 40)}<div class="tx"><b>${open ? 'Ocultar' : 'Ver'} ${n} archivadas</b></div>${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px')}</div></div>`;
const jump = `<div class="float-ctl" style="bottom:28px"><div class="btn-r" style="background:var(--s3)">${ic('arrow-up-outline')}</div><div class="btn-r" style="background:var(--s3)">${ic('arrow-down-outline')}</div></div>`;

// As it opens: both lists closed, so both headings and the archived fit.
S['3a-categorias'] = `${head}<main>${orderClosed}${side('g', 16, false)}${side('i', 6, false)}${archivedRow(false)}</main>`;

// Gastos open, most used first; a long name ends in "…".
S['3b-categorias-gastos'] = `${head}<main>${order}${side('g', 16, true)}
 <div class="list" style="margin-top:8px">${row('rest', 112)}${row('mercado', 96)}${row('transp', 81)}${row('servicios', 36)}${row('vivienda', 12)}${row('salud', 9)}${longRow}${row('ocio', 8)}${row('ropa', 0)}</div>
 ${side('i', 6, false)}</main><div class="fade" style="height:90px"></div>${jump}`;

// "Nueva categoría": which list, first.
S['3c-nueva-cual-lista'] = S['3a-categorias'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <h2 style="text-align:center;font-size:19px;margin:6px 0 14px">¿En cuál lista?</h2>
 <div style="display:flex;gap:10px">${[['arrow-up', C.red, 'Gastos'], ['arrow-down', C.grn, 'Ingresos']]
  .map(([i, c, t]) => `<div style="flex:1;background:var(--s2);border-radius:20px;padding:18px 6px;text-align:center">${centred(ci(i, c, 50), 9)}<b style="font-size:15.5px">${t}</b></div>`).join('')}</div></div>`;

// The editor, the account form's shape: the face and the name together, then
// one list of rows.
const saveBar = t => `<div class="bar-top">${st}<div class="tt">${ic('close', 'back')}<h1>${t}</h1><div class="chip" style="padding:7px 14px;background:linear-gradient(135deg,var(--pr),var(--pr2));border:0;color:#fff;font-weight:500">${ic('checkmark', '', 'width:18px;height:18px')}Guardar</div></div></div>`;
const face = (icon, name, empty = false) => `<div style="display:flex;align-items:center;gap:14px"><div style="position:relative;flex:none">${icon}<span style="position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:var(--pr);display:grid;place-items:center;color:#fff">${ic('create-outline', '', 'width:13px;height:13px')}</span></div>
  <div class="field ${empty ? 'on' : ''}" style="flex:1;min-width:0"><div class="lab">Nombre</div><div class="v one ${empty ? 'mu' : ''}">${name}</div></div></div>`;
const toggle = (t, h, on) => `<div class="row"><div class="tx"><b>${t}</b><small>${h}</small></div>${sw(on)}</div>`;
const RETURN = ['Ganancia o pérdida de inversión', 'En una cuenta de tipo Inversión, el resumen de rendimientos lo cuenta como lo que ganó o perdió, no como plata que metiste o sacaste'];
const ARCHIVE = ['Archivar', 'Deja de ofrecerse al registrar, pero lo ya registrado no cambia'];

S['3d-editar-categoria'] = `${saveBar('Editar categoría')}<main style="padding-top:14px">
 ${face(sq('restaurant-outline', PALETTE.coral, 60), 'Restaurantes')}
 <div class="list" style="margin-top:14px">
  <div class="row">${ci('arrow-up', C.red, 34)}<div class="tx"><span class="k">Para</span><b>Gastos</b><small>No se puede cambiar: lo que ya está clasificado aquí se registró como gasto o como ingreso.</small></div>${ic('lock-closed-outline', 'mu', 'width:18px;height:18px')}</div>
  <div class="row"><div class="tx"><span class="k">Usada en</span><b>112 movimientos</b></div></div></div>
 <div class="list" style="margin-top:12px">${toggle(...RETURN, false)}${toggle(...ARCHIVE, false)}</div>
 </main>`;

// A new one, in Ingresos: "Para" can still change, since nothing uses it.
S['3e-nueva-categoria'] = `${saveBar('Nueva categoría')}<main style="padding-top:14px">
 ${face(sq('pricetag-outline', PALETTE.esmeralda, 60), 'Nombre de la categoría', true)}
 <div class="list" style="margin-top:14px">
  <div class="row">${ci('arrow-down', C.grn, 34)}<div class="tx"><span class="k">Para</span><b>Ingresos</b></div>${down()}</div></div>
 <div class="list" style="margin-top:12px">${toggle(...RETURN, false)}</div>
 </main>`;

// The investment return, switched on, with its hint.
S['3f-categoria-ganancia'] = `${saveBar('Editar categoría')}<main style="padding-top:14px">
 ${face(catIcon('ganancia', 60), 'Ganancia de inversión')}
 <div class="list" style="margin-top:14px">
  <div class="row">${ci('arrow-down', C.grn, 34)}<div class="tx"><span class="k">Para</span><b>Ingresos</b><small>No se puede cambiar: lo que ya está clasificado aquí se registró como gasto o como ingreso.</small></div>${ic('lock-closed-outline', 'mu', 'width:18px;height:18px')}</div>
  <div class="row"><div class="tx"><span class="k">Usada en</span><b>14 movimientos</b></div></div></div>
 <div class="list" style="margin-top:12px">${toggle(...RETURN, true)}${toggle(...ARCHIVE, false)}</div>
 </main>`;

// The face: Ícono first, then Color, then Imagen propia, as for accounts.
const preview = icon => `<div class="card" style="display:flex;align-items:center;gap:14px;padding:14px">${icon}
  <div style="flex:1;min-width:0"><div class="lab">Así se verá</div><b style="font-size:17px" class="one">Restaurantes</b><div class="sub">En 112 movimientos</div></div><span class="r" style="font-weight:500">−32.000</span></div>`;
const faceTabs = on => `<div class="tabs" style="margin-top:8px">${['Ícono', 'Color', 'Imagen propia'].map(t => `<div class="${t === on ? 'on' : ''}">${t}</div>`).join('')}</div>`;
const faceTop = top('Ícono y color', { left: 'x', right: `<span class="p" style="font-weight:500">Listo</span>` });
const R = '30%';

S['3g-cara-icono'] = `${faceTop}<main style="padding-top:10px">
 ${preview(sq('cafe-outline', PALETTE.coral, 58))}${faceTabs('Ícono')}
 <div class="search" style="margin-top:12px">${ic('search-outline')}Buscar ícono</div>
 ${[['Del día a día', ['restaurant-outline', 'cafe-outline', 'fast-food-outline', 'pizza-outline', 'beer-outline', 'basket-outline']], ['Casa', ['home-outline', 'flash-outline', 'water-outline', 'wifi-outline', 'bed-outline', 'construct-outline']], ['Transporte', ['bus-outline', 'car-outline', 'bicycle-outline', 'airplane-outline', 'train-outline', 'boat-outline']], ['Vida', ['medkit-outline', 'fitness-outline', 'school-outline', 'shirt-outline', 'paw-outline', 'gift-outline']]]
  .map(([t, is]) => `<div class="lab" style="margin:12px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${is.map(i => { const on = i === 'cafe-outline';
   return `<div style="aspect-ratio:1;border-radius:${R};display:grid;place-items:center;background:${on ? tint(PALETTE.coral, .22) : 'var(--s1)'};color:${on ? PALETTE.coral : '#c9d2e3'};border:1px solid ${on ? PALETTE.coral : '#1c2843'}">${ic(i, '', 'width:46%;height:46%')}</div>`; }).join('')}</div>`).join('')}
 </main>`;

const fams = [['Cálidos', ['coral', 'cereza', 'mandarina', 'ambar', 'oro', 'arena']], ['Verdes y azules', ['lima', 'esmeralda', 'menta', 'turquesa', 'cielo', 'zafiro']], ['Violetas y neutros', ['violeta', 'orquidea', 'rosa', 'pizarra']]];
const mark = c => `<span style="position:absolute;right:-5px;top:-5px;width:18px;height:18px;border-radius:50%;background:${c};color:#0b1222;display:grid;place-items:center">${ic('checkmark', '', 'width:12px;height:12px')}</span>`;
S['3h-cara-color'] = `${faceTop}<main style="padding-top:10px">
 ${preview(sq('cafe-outline', PALETTE.mandarina, 58))}${faceTabs('Color')}
 ${fams.map(([t, cs]) => `<div class="lab" style="margin:14px 2px 8px">${t}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:9px">${cs.map(n => { const c = PALETTE[n]; const on = n === 'mandarina';
   return `<div style="aspect-ratio:1;border-radius:${R};background:${tint(c, .2)};color:${c};display:grid;place-items:center;position:relative;${on ? `box-shadow:0 0 0 2px var(--bg),0 0 0 4px ${c}` : ''}">${ic('cafe-outline', '', 'width:45%;height:45%')}${on ? mark(c) : ''}</div>`; }).join('')}</div>`).join('')}
 </main>`;

// Own images: pictures, in the category's rounded square. Invented logos.
const LOGOS = [
  (z, bg = 'transparent') => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:${bg};flex:none"><path d="M12 13h16l-2 15H14z" fill="#fff"/><path d="M16 13a4 4 0 0 1 8 0" stroke="#fff" stroke-width="2.5" fill="none"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:#fff;flex:none"><text x="20" y="26" text-anchor="middle" font-family="Arial" font-weight="900" font-size="14" fill="#d62828">D2</text></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:#ffd400;flex:none"><circle cx="20" cy="20" r="8" fill="#1a1a1a"/><circle cx="20" cy="20" r="3" fill="#ffd400"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:#0e7c3a;flex:none"><path d="M10 26l6-10 5 7 4-5 5 8z" fill="#fff"/></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:#1d1d1f;flex:none"><text x="20" y="27" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#ff5a36">m</text></svg>`,
  z => `<svg width="${z}" height="${z}" viewBox="0 0 40 40" style="border-radius:${R};background:#2563eb;flex:none"><path d="M20 9l9 5v12l-9 5-9-5V14z" fill="none" stroke="#fff" stroke-width="3"/></svg>`,
];
S['3i-cara-imagen-propia'] = `${faceTop}<main style="padding-top:10px">
 ${preview(LOGOS[0](58, PALETTE.coral))}${faceTabs('Imagen propia')}
 <div class="card" style="margin-top:12px;display:flex;align-items:center;gap:12px;border-style:dashed;border-color:#34466b">${sq('cloud-upload-outline', C.blu, 46)}<div class="tx"><b>Subir una imagen</b><small>PNG, JPG, WEBP o SVG, hasta 100 kB. El logo de una tienda, por ejemplo.</small></div></div>
 <div class="lab" style="margin:16px 2px 10px">Tus imágenes</div>
 <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;justify-items:center">${LOGOS.map((l, n) => `<div style="position:relative;border-radius:${R};${n === 0 ? 'box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--pr)' : ''}">${n === 0 ? l(52, PALETTE.coral) : l(52)}${n === 0 ? mark('var(--pr)').replace('color:#0b1222', 'color:#fff') : ''}</div>`).join('')}</div>
 <div class="p" style="margin-top:12px;font-size:13.5px">Ver 4 imágenes más</div>
 <div class="hint" style="margin-top:12px">Son las mismas que usan tus cuentas: se guardan dentro de tu copia de seguridad. El color escogido va detrás de la imagen.</div>
 </main>`;

// The archived, opened at the foot of the screen: history only, each saying
// which list it belonged to.
S['3j-archivadas'] = `${head}<main>${orderClosed}${side('g', 16, false)}${side('i', 6, false)}${archivedRow(true)}
 <div class="hint" style="margin:10px 4px 8px">Ya no se ofrecen al registrar, pero lo que quedó clasificado en ellas no cambió.</div>
 <div class="list" style="opacity:.8">${[['car-outline', 'Carro', 'Gastos', C.red], ['cash-outline', 'Arriendo del local', 'Ingresos', C.grn], ['school-outline', 'Universidad', 'Gastos', C.red]]
  .map(([i, t, k, c]) => `<div class="row">${sq(i, C.gry)}<div class="tx"><b class="one">${t}</b></div><span class="tag" style="background:${tint(c, .16)};color:${c}">${k}</span>${chev()}</div>`).join('')}</div></main>`;

export default S;
