// Group 31 - "Personaliza tu vista" (2026-10-15, from Jose's partner, for him
// to see what it would mean in this app). Two parts: (1) the app hides by
// itself what the person does not use, and (2) a screen in Más where each
// person chooses which blocks each screen shows and in what order. Proposed,
// nothing built. Every figure invented.
import { ic, ci, sq, C, accIcon, chev, sw, tabs, status, top, tint } from './lib.mjs';
import G8 from './screens-8.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const tag = (t, ok = false) => `<div style="display:flex;justify-content:center;margin:2px 0 8px"><span class="tag" style="background:${tint(ok ? '#34c98b' : '#8c9bb5', .18)};color:${ok ? '#34c98b' : '#aab6d3'};font-size:12.5px;padding:5px 12px">${t}</span></div>`;
const seg = (faces, on) => `<div class="seg" style="margin-top:10px">${faces.map(([t, i]) => `<div class="${t === on ? 'on' : ''}">${ic(i)}${t}</div>`).join('')}</div>`;
const FACES3 = [['Saldos', 'wallet-outline'], ['Rendimientos', 'trending-up-outline'], ['Deudas', 'receipt-outline']];
const head = (faces, on, action = 'Nueva deuda') => `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Cuentas</h1>
 <div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}${action}</div></div>${seg(faces, on)}</div>`;
const page = (h, body, tab = 'Cuentas') => `${h}<main>${body}<div style="height:110px"></div></main><div class="fade"></div>${tabs(tab)}`;
const eye = `<span style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:#fff;flex:none">${ic('eye-outline', '', 'width:21px;height:21px')}</span>`;
const card = `<div class="list"><div class="row" style="align-items:flex-start">${accIcon('coral', 42)}<div class="tx"><b class="one">Tarjeta Coral</b><small class="one">Usas 742.300,00 de 1.100.000,00</small><small class="y" style="white-space:normal">Paga 598.400 antes del 10 nov</small></div>${chev()}</div></div>`;
const hero = `<div class="card hero"><div style="display:flex;align-items:center;justify-content:space-between;min-height:40px;margin-top:-4px"><div class="lab">Debes hoy</div>${eye}</div>
  <div class="big">$ 742.300,00</div><div class="sub">Todo en tarjetas.</div></div>`;

// ---------------------------------------------------------------------------
// 1. The app hides by itself what the person does not use.
S['31a-deudas-hoy-sin-prestamos'] = page(head(FACES3, 'Deudas'), `${tag('Hoy')}${hero}
 <div class="h">Tarjetas · 1</div>${card}
 <div class="h">Préstamos</div>
 <div class="card" style="text-align:center;padding:18px">${ci('cash-outline', C.pur, 46).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="display:block">No tienes préstamos</b>
  <div class="sub" style="margin:4px 0 12px">Si tienes uno, agrégalo para ver cuánto debes y cuánto pagas en intereses.</div>
  <span class="chip" style="color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Agregar un préstamo</span></div>`);

S['31b-deudas-sin-prestamos-oculto'] = page(head(FACES3, 'Deudas'), `${tag('Parte 1 · lo que no usas no aparece', true)}${hero}
 <div class="h">Tarjetas · 1</div>${card}
 <div class="sub" style="text-align:center;margin-top:14px">${ic('information-circle-outline', '', 'width:15px;height:15px;vertical-align:-3px')} ¿Tienes un préstamo? Agrégalo en <b style="color:var(--pr)">Nueva deuda</b>.</div>`);

// The same rule on the tab's faces: no account earns, no Rendimientos face.
S['31c-cuentas-sin-rendimientos'] = page(head([['Saldos', 'wallet-outline'], ['Deudas', 'receipt-outline']], 'Saldos', 'Nueva cuenta'), `${tag('Parte 1 · ninguna cuenta rinde', true)}
 <div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ 12.840.300,00</div><div class="sub">Lo que tienes menos lo que debes</div></div>
 <div class="list" style="margin-top:12px">
  <div class="row">${accIcon('azul')}<div class="tx"><b>Banco Azul</b></div><div class="am">12.400.000,00</div></div>
  <div class="row">${accIcon('efectivo')}<div class="tx"><b>Efectivo</b></div><div class="am">1.182.600,00</div></div>
  <div class="row">${accIcon('coral')}<div class="tx"><b>Tarjeta Coral</b><small>Disponible 357.700</small></div><div class="am y">−742.300,00</div></div></div>
 <div class="sub" style="text-align:center;margin-top:14px">La pestaña <b>Rendimientos</b> aparece sola cuando una cuenta tenga productos que rinden.</div>`);

// ---------------------------------------------------------------------------
// 2. "Personaliza tu vista", in Más → Preferencias.
const prefRow = `<div class="row">${sq('options-outline', C.pur, 40)}<div class="tx"><b>Personaliza tu vista</b><small class="wrap">Qué ves en cada pantalla y en qué orden</small></div>${chev()}</div>`;
S['31d-mas-personaliza'] = G8['8a-mas'].replace(/(<div class="h">Preferencias<\/div><div class="list">)/, `$1${prefRow}`)
  .replace('<main style="padding-top:6px">', `<main style="padding-top:6px">${tag('Parte 2 · Más → Preferencias', true)}`);

const screenRow = (icon, color, name, shown) => `<div class="row">${sq(icon, color, 40)}<div class="tx"><b>${name}</b><small>${shown}</small></div>${chev()}</div>`;
S['31e-personaliza-pantallas'] = `${top('Personaliza tu vista')}<main>
 <div class="sub" style="margin:2px 4px 12px">Elige qué ver en cada pantalla y en qué orden. Ocultar algo no borra nada: solo deja de verse.</div>
 <div class="list">
  ${screenRow('home-outline', C.blu, 'Inicio', '4 de 4 bloques')}
  ${screenRow('wallet-outline', C.grn, 'Cuentas', 'Saldos, Rendimientos y Deudas')}
  ${screenRow('receipt-outline', C.yel, 'Deudas', 'Tarjetas · Préstamos oculto')}
  ${screenRow('stats-chart-outline', C.pur, 'Reporte', '9 de 11 secciones')}
  ${screenRow('grid-outline', C.tea, 'Más', 'Todo visible')}</div>
 <div class="sub" style="text-align:center;margin-top:16px;color:var(--pr);font-weight:600">${ic('refresh-outline', '', 'width:16px;height:16px;vertical-align:-3px')} Volver a como viene la app</div>
</main>`;

// One screen's blocks: a switch each, and the handle to drag it up or down.
const grip = `<span class="mu" style="flex:none;margin-left:2px">${ic('reorder-three-outline', '', 'width:22px;height:22px')}</span>`;
const block = (icon, color, name, about, on, fixed = false) => `<div class="row" style="align-items:center">${sq(icon, color, 40)}<div class="tx"><b>${name}</b><small style="white-space:normal;line-height:1.3">${about}</small></div>${fixed ? `<span class="mu" style="font-size:12px;flex:none">Siempre</span>` : sw(on)}${grip}</div>`;
S['31f-personaliza-inicio'] = `${top('Inicio')}<main>
 <div class="sub" style="margin:2px 4px 12px">Activa lo que quieres ver. Arrastra ${ic('reorder-three-outline', '', 'width:16px;height:16px;vertical-align:-4px')} para cambiar el orden.</div>
 <div class="list">
  ${block('wallet-outline', C.blu, 'Tu saldo y el periodo', 'Cuánto tienes, lo que entró y salió', true, true)}
  ${block('notifications-outline', C.red, 'Pendientes', 'Pagos de tarjetas y cuotas, topes y metas', true)}
  ${block('pie-chart-outline', C.org, 'Gráfico de gastos', 'La dona con tus categorías', true)}
  ${block('list-outline', C.grn, 'Movimientos', 'La lista del periodo', true)}</div>
 <div class="h">Al abrir Inicio, mostrar primero</div>
 <div class="seg"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos</div></div>
 <div class="card" style="margin-top:14px;display:flex;gap:10px;align-items:flex-start;padding:12px">${ic('shield-checkmark-outline', '', 'width:20px;height:20px;color:var(--yel);flex:none')}<div class="sub" style="margin:0">Aunque ocultes Pendientes, un pago vencido siempre se avisa.</div></div>
</main><div class="save">Listo</div>`;

S['31g-personaliza-deudas'] = `${top('Deudas')}<main>
 <div class="sub" style="margin:2px 4px 12px">Activa lo que quieres ver. Arrastra ${ic('reorder-three-outline', '', 'width:16px;height:16px;vertical-align:-4px')} para cambiar el orden.</div>
 <div class="list">
  ${block('receipt-outline', C.pur, 'Lo que debes hoy', 'El total, lo que pagas este mes y sus intereses', true, true)}
  ${block('card-outline', C.yel, 'Tarjetas', 'Cada tarjeta con su cupo y su factura', true)}
  ${block('cash-outline', C.pur, 'Préstamos', 'Cada préstamo con su próxima cuota', false)}</div>
 <div class="sub" style="margin:12px 4px">Préstamos está oculto porque no tienes ninguno. Si agregas uno, vuelve a aparecer solo.</div>
</main><div class="save">Listo</div>`;

S['31h-personaliza-reporte'] = `${top('Reporte')}<main>
 <div class="sub" style="margin:2px 4px 12px">Las secciones del reporte, en el orden en que salen. Lo oculto tampoco va a la hoja de cálculo.</div>
 <div class="list">
  ${block('podium-outline', C.blu, 'Cifras del periodo', 'Ingresos, gastos y lo que ahorraste', true, true)}
  ${block('swap-vertical-outline', C.tea, 'Contra el periodo anterior', 'Qué cambió frente al mes pasado', true)}
  ${block('pie-chart-outline', C.org, 'En qué se fue', 'Tus gastos por categoría', true)}
  ${block('trending-up-outline', C.red, 'Categorías que se dispararon', 'Las que más subieron', true)}
  ${block('repeat-outline', C.pur, 'Lo que vuelve cada mes', 'Gastos que se repiten', false)}
  ${block('bar-chart-outline', C.grn, 'Mes a mes', 'Ingresos y gastos de cada mes', true)}
  ${block('analytics-outline', C.cya ?? C.blu, 'Tu saldo a futuro', 'La proyección a 90 días', false)}
  ${block('arrow-up-circle-outline', C.yel, 'Los movimientos más grandes', 'Los diez mayores', true)}</div>
</main><div class="save">Listo</div>`;

// What Inicio looks like with "Gráfico de gastos" turned off: straight to the list.
S['31i-inicio-sin-grafico'] = `<div class="bar-top">${st}<div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Todas las cuentas</b><div class="sub one">7 cuentas, todas incluidas</div></div></div></div>
 <main>${tag('Inicio con el gráfico oculto', true)}
 <div class="card hero"><div style="display:flex;align-items:center;justify-content:space-between;min-height:40px;margin-top:-4px"><div class="lab">Patrimonio hoy</div>${eye}</div><div class="big">$ 46.055.454,90</div>
  <div class="mini" style="margin-top:10px"><div><span class="lab">Entró</span><b class="g">8.400.000,00</b></div><div><span class="lab">Salió</span><b class="r">2.013.000,00</b></div></div></div>
 <div class="h">Movimientos · 14</div>
 <div class="list">
  <div class="row" style="background:var(--s2)"><div class="tx"><b>Hoy · jueves 15</b><small>2 movimientos</small></div><span class="r" style="font-weight:600">−52.000,00</span></div>
  <div class="row">${sq('restaurant-outline', C.org, 42)}<div class="tx"><b>Almuerzo</b><small>Restaurantes · Banco Azul</small></div><div class="am r">−32.000,00</div></div>
  <div class="row">${sq('car-outline', C.blu, 42)}<div class="tx"><b>Taxi al centro</b><small>Transporte · Efectivo</small></div><div class="am r">−20.000,00</div></div></div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Inicio')}`;

export default S;
