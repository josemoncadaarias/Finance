// Group 38 - a new account from the "+", "Agregar un producto" on top of the
// products, and a product's form as one guided page instead of tabs that
// change under the person (Jose, 2026-10-19). Figures invented.
import { ic, C, tint, top, tag, chev, ci, sq, sw, tabs, accIcon } from './lib.mjs';

const S = {};
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}<div style="height:14px"></div></div>`;

// --- 38a: the "+" also makes an account -------------------------------------
const kind = (i, c, t) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">${ci(i, c, 54)}<b style="font-weight:500">${t}</b></div>`;
const home = `${top('Inicio', { left: '' })}<main><div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 48.215.300</div></div></main>${tabs('Inicio')}`;
S['38a-mas-nueva-cuenta'] = home + sheet(`<div style="display:flex;padding:6px 0 16px">${kind('arrow-up', C.red, 'Gasto')}${kind('arrow-down', C.grn, 'Ingreso')}${kind('swap-horizontal', C.blu, 'Transferir')}</div>
 <div class="list">
  <div class="row">${ci('document-text-outline', C.pur, 38)}<div class="tx"><b>Importar extracto PDF</b></div>${chev()}</div>
  <div class="row">${ci('wallet-outline', C.blu, 38)}<div class="tx"><b>Nueva cuenta</b><small>Banco, efectivo, tarjeta o inversión</small></div>${chev()}</div></div>`);

// --- 38b: "Agregar un producto" first, and easy to see -----------------------
const prod = (i, c, name, line, am) => `<div class="row">${sq(i, c)}<div class="tx"><b class="one">${name}</b><small class="one">${line}</small></div><div class="am">${am}</div>${chev()}</div>`;
S['38b-agregar-producto-arriba'] = `${top('Banco Índigo', { sub: 'Rendimientos' })}<main>
 <div class="seg"><div class="on">Productos</div><div>Movimientos</div><div>Pagos</div><div>Días</div></div>
 <div style="margin-top:12px;border:1.5px dashed ${tint(C.blu, .7)};background:${tint(C.blu, .1)};border-radius:18px;padding:13px 14px;display:flex;align-items:center;gap:12px">
  ${ci('add', C.blu, 40)}<div class="tx"><b style="color:var(--pr)">Agregar un producto</b><small>Un bolsillo, una alcancía o un CDT de esta cuenta</small></div></div>
 <div class="h">Tus productos · 3</div>
 <div class="list">
  ${prod('wallet', C.blu, 'Cuenta de ahorros', '9,00 % E.A. · el habitual', '$ 3.420.000')}
  ${prod('star', C.yel, 'Bolsillo viajes', '10,50 % E.A. · con bonificación', '$ 1.250.000')}
  ${prod('lock-closed', C.pur, 'CDT 6 meses', '11,20 % E.A. · vence 12 mar', '$ 5.000.000')}
  <div class="row plain"><div class="tx"><b>Todos los productos</b></div><div class="am">$ 9.670.000</div></div></div>
 <div class="hint">Cada producto rinde por separado, con su propia tasa.</div></main>${tabs('Cuentas')}`;

// --- the product's form: one page, the kind first ----------------------------
const head = title => `${top(title, { left: 'x' })}`;
const step = (n, title, state, sum = '', open = false, body = '') => {
  const badge = state === 'ok' ? `<span style="width:28px;height:28px;border-radius:50%;background:${tint(C.grn, .2)};color:var(--grn);display:grid;place-items:center;flex:none">${ic('checkmark', '', 'width:16px;height:16px')}</span>`
    : `<span style="width:28px;height:28px;border-radius:50%;background:var(--s3);color:#c9d2e4;display:grid;place-items:center;flex:none;font-weight:700;font-size:13.5px">${n}</span>`;
  const right = state === 'missing' ? tag('Falta', C.yel) : state === 'optional' ? tag('Opcional', C.gry) : '';
  return `<div class="list" style="margin-top:10px${state === 'missing' && open ? `;border-color:${tint(C.yel, .5)}` : ''}"><div class="row" style="gap:12px">${badge}<div class="tx"><b>${title}</b>${sum ? `<small class="one">${sum}</small>` : ''}</div>${right}${ic(open ? 'chevron-up-outline' : 'chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>${open ? `<div style="padding:0 14px 14px">${body}</div>` : ''}</div>`;
};
const fld = (lab, v, on = false, unit = '') => `<div class="field ${on ? 'on' : ''}" style="margin-top:8px;display:flex;align-items:center"><div style="flex:1"><div class="lab">${lab}</div><div class="v ${v ? '' : 'mu'}">${v || '—'}</div></div>${unit ? `<span class="mu" style="font-size:13px">${unit}</span>` : ''}</div>`;
const swRow = (t, s, on) => `<div style="display:flex;align-items:center;gap:12px;margin-top:12px"><div class="tx"><b style="white-space:normal;font-size:14.5px">${t}</b><small>${s}</small></div>${sw(on)}</div>`;
const foot = (missing) => missing
  ? `<div style="position:absolute;left:16px;right:16px;bottom:22px"><div class="sub" style="text-align:center;margin-bottom:8px;color:var(--yel)">Te falta: ${missing}</div><div class="btn" style="opacity:.4">Guardar el producto</div></div>`
  : `<div style="position:absolute;left:16px;right:16px;bottom:22px"><div class="btn">Guardar el producto</div></div>`;

const typeCard = (i, c, t, s, on = false) => `<div class="card" style="margin-top:10px;display:flex;gap:14px;align-items:center${on ? `;border-color:var(--pr);background:${tint(C.blu, .12)}` : ''}">${sq(i, c, 48)}<div class="tx"><b style="white-space:normal">${t}</b><small>${s}</small></div>${on ? `<span class="tick on">${ic('checkmark')}</span>` : '<span class="tick"></span>'}</div>`;

// 38c: nothing but the kind until it is chosen.
S['38c-producto-tipo-primero'] = `${head('Agregar un producto')}<main>
 <div class="sub" style="font-size:14px;margin:6px 4px 4px">Banco Índigo</div>
 <b style="display:block;font-size:19px;margin:8px 4px 2px">¿Qué tipo de producto es?</b>
 <div class="sub" style="margin:0 4px">Según el tipo te pedimos lo que hace falta para calcular sus intereses.</div>
 ${typeCard('wallet', C.blu, 'Ahorro de alta rentabilidad', 'Un bolsillo, una alcancía o la cuenta misma: paga intereses cada día o cada mes, y puede tener bonificación por gasto.')}
 ${typeCard('lock-closed', C.pur, 'CDT', 'Dinero a un plazo fijo: paga sus intereses al vencer o cada cierto número de meses.')}
 <div class="hint" style="margin-top:12px">Después no se puede cambiar el tipo.</div></main>`;

// 38d: high yield chosen; the steps say what is done and what is missing.
const kindChosen = `<div class="list" style="margin-top:6px"><div class="row">${sq('wallet', C.blu, 38)}<div class="tx"><small>Tipo</small><b>Ahorro de alta rentabilidad</b></div><span class="p" style="font-size:14px">Cambiar</span></div></div>`;
S['38d-producto-pasos'] = `${head('Agregar un producto')}<main>
 ${kindChosen}
 ${step(1, 'Nombre', 'ok', 'Bolsillo viajes')}
 ${step(2, 'Saldo de hoy', 'ok', '$ 1.250.000 · lo escribiste · rinde desde hoy')}
 ${step(3, 'Tasa', 'missing', 'La tasa anual que paga el banco', true,
   `${fld('Tasa anual (E.A.), %', '', true)}${fld('¿Cada cuánto paga el banco?', 'Cada día')}`)}
 ${step(4, 'Bonificación por gasto', 'optional', 'Una tasa extra si gastas cierto valor con la cuenta')}
 ${step(5, 'Ajustes', 'ok', 'Con retención · cuenta en el patrimonio')}
</main>${foot('la tasa')}`;

// 38e: the bonus, always offered for a high-yield product, new or not.
S['38e-producto-bonificacion'] = `${head('Agregar un producto')}<main>
 ${kindChosen}
 ${step(1, 'Nombre', 'ok', 'Bolsillo viajes')}
 ${step(2, 'Saldo de hoy', 'ok', '$ 1.250.000 · lo escribiste · rinde desde hoy')}
 ${step(3, 'Tasa', 'ok', '5,00 % E.A. · paga cada día')}
 ${step(4, 'Bonificación por gasto', 'optional', '', true,
   `${swRow('Tiene bonificación por gasto', 'El banco paga una tasa extra solo si gastas cierto valor con esta cuenta.', true)}
    ${fld('Tasa extra (E.A.), %', '5,50')}${fld('Gasto mínimo con esta cuenta', '$ 400.000', false, 'al mes')}${fld('¿Cada cuántos meses se revisa el gasto?', '1')}
    <div class="sub" style="margin-top:8px">Se paga el 1.º del mes siguiente, si llegaste al gasto.</div>`)}
 ${step(5, 'Ajustes', 'ok', 'Con retención · cuenta en el patrimonio')}
</main>${foot('')}`;

// 38f: Guardar pressed early: it opens what is missing, saves nothing.
S['38f-producto-falta-algo'] = `${head('Agregar un producto')}<main>
 ${kindChosen}
 ${step(1, 'Nombre', 'missing', 'Cómo lo llama el banco', true, `${fld('Nombre', '', true)}<div class="sub" style="margin-top:6px">Por ejemplo: Bolsillo viajes, Alcancía, Cuenta de ahorros.</div>`)}
 ${step(2, 'Saldo de hoy', 'missing', 'Lo que tiene hoy, como lo ves en el banco')}
 ${step(3, 'Tasa', 'missing', 'La tasa anual que paga el banco')}
 ${step(4, 'Bonificación por gasto', 'optional', 'Una tasa extra si gastas cierto valor con la cuenta')}
 ${step(5, 'Ajustes', 'ok', 'Con retención · cuenta en el patrimonio')}
</main>${foot('el nombre, el saldo y la tasa')}`;

// 38g: a CDT, its own steps.
S['38g-cdt-pasos'] = `${head('Agregar un producto')}<main>
 <div class="list" style="margin-top:6px"><div class="row">${sq('lock-closed', C.pur, 38)}<div class="tx"><small>Tipo</small><b>CDT</b></div><span class="p" style="font-size:14px">Cambiar</span></div></div>
 ${step(1, 'Nombre', 'ok', 'CDT 6 meses')}
 ${step(2, 'Monto y plazo', 'ok', '$ 5.000.000 · 6 meses · desde el 12 sept')}
 ${step(3, 'Tasa', 'missing', 'La tasa anual del CDT', true, `${fld('Tasa anual (E.A.), %', '', true)}${fld('¿Cada cuánto paga?', 'Al vencer')}`)}
 ${step(4, 'Al vencer', 'missing', 'A qué producto pasa el dinero')}
 ${step(5, 'Ajustes', 'ok', 'Con retención · cuenta en el patrimonio')}
</main>${foot('la tasa y a dónde pasa al vencer')}`;

// 38h: an existing product opens on the same page, every step closed with
// what it holds.
S['38h-producto-editar'] = `${top('Bolsillo viajes', { left: 'x', right: '<span class="p" style="font-weight:500">Guardar</span>' })}<main>
 <div class="card" style="display:flex;gap:12px;align-items:center">${sq('star', C.yel, 48)}<div class="tx"><small>Tiene hoy</small><b style="font-size:20px">$ 1.262.418</b><small>Ahorro de alta rentabilidad</small></div></div>
 ${step(1, 'Nombre', 'ok', 'Bolsillo viajes')}
 ${step(2, 'Saldo', 'ok', '$ 1.250.000 al cierre del 19 oct · + $ 12.418 desde entonces')}
 ${step(3, 'Tasa', 'ok', '5,00 % E.A. desde el 1 sept · paga cada día')}
 ${step(4, 'Bonificación por gasto', 'ok', '+5,50 % si gastas $ 400.000 al mes')}
 ${step(5, 'Ajustes', 'ok', 'Con retención · cuenta en el patrimonio · no es el habitual')}
 <div class="list" style="margin-top:16px"><div class="row plain" style="color:var(--red)">${ic('trash-outline')}<div class="tx"><b style="color:var(--red)">Eliminar este producto</b></div></div></div>
</main>`;

export default S;
