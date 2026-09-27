// Inicio, the "+" sheet, the movement form and its pickers.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, status, M, donut, tint } from './lib.mjs';

const hdrHome = (hidden, acc = null) => {
  const who = acc ? `${accIcon(acc, 42)}<h1 style="font-size:18.5px">${ACC[acc][2]} ${down()}<small>COP · tarjeta de crédito</small></h1>`
    : `${ci('layers-outline', C.blu, 42)}<h1 style="font-size:18.5px">Todas las cuentas ${down()}<small>7 cuentas, todas incluidas</small></h1>`;
  return `<div class="bar-top">${status.replace('class="status"', 'class="status" style="padding:6px 6px"')}
 <div class="tt">${who}<div class="btn-r ${hidden ? 'on' : ''}">${ic(hidden ? 'eye-off-outline' : 'eye-outline')}</div></div>
 <div class="month">${ic('chevron-back-outline')}<span>Septiembre 2026 ${ic('calendar-outline', '', 'width:17px;height:17px')}</span>${ic('chevron-forward-outline')}</div></div>`;
};

const heroAll = hidden => `<div class="card hero"><div class="lab">Patrimonio hoy</div><div class="big">$ ${M('48.312.740,55', hidden)}</div>
  <div class="mini" style="margin-top:12px"><div><span class="lab">Entró</span><b class="g">${M('8.450.000,00', hidden)}</b></div>
   <div><span class="lab">Salió</span><b class="r">${M('5.236.418,00', hidden)}</b></div><div><span class="lab">Movido</span><b>${M('1.200.000', hidden)}</b></div></div></div>`;

const chartCard = `<div class="card" style="display:flex;align-items:center;gap:16px">${donut([[31, C.org], [20, C.grn], [19, C.red], [11, C.cya], [8, C.yel], [11, C.gry]])}
  <div style="flex:1">${[['vivienda', 31], ['mercado', 20], ['rest', 19], ['transp', 11], ['servicios', 8]].map(([k, p]) => `<div style="display:flex;align-items:center;gap:9px;margin:4px 0;font-size:13.5px">${catIcon(k, 25)}${CAT[k][2]}<span class="mu" style="margin-left:auto">${p}%</span></div>`).join('')}</div></div>`;

const catLine = (k, title, sub, amt, cls, when = '') => `<div class="row">${catIcon(k)}<div class="tx"><b>${title}</b><small>${sub}</small></div><div class="am ${cls}">${amt}${when ? `<small class="mu">${when}</small>` : ''}</div></div>`;

export const home = hidden => `${hdrHome(hidden)}<main>${heroAll(hidden)}
 <div class="seg" style="margin:12px 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos · 58</div></div>
 ${chartCard}
 <div class="h">Por categoría<span class="p">Resumen ${ic('chevron-forward-outline', '', 'width:14px;height:14px;vertical-align:-2px')}</span></div>
 <div class="list">${catLine('salario', 'Salario', '1 movimiento', `+${M('8.450.000,00', hidden)}`, 'g')}
  ${catLine('vivienda', 'Vivienda', '31 % · 2 movimientos', M('1.600.000,00', hidden), '')}</div>
 </main><div class="fade"></div><div class="fab">${ic('add')}</div>${tabs('Inicio', true)}`;

const S = {};
S['a01-inicio'] = home(false);
S['a02-inicio-montos-ocultos'] = home(true);

S['a03-inicio-una-cuenta'] = `${hdrHome(false, 'coral')}<main>
 <div class="card hero"><div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1"><div class="lab">Debes hoy</div><div class="big y">−4.127.100,00</div></div>
  <div class="btn-r">${ic('create-outline')}</div></div>
  <div class="sub">Disponible 3.872.900 de 8.000.000</div><div class="pbar" style="margin-top:8px"><i style="width:52%;background:var(--yel)"></i></div>
  <div class="mini" style="margin-top:12px"><div><span class="lab">Entró</span><b class="g">0,00</b></div><div><span class="lab">Salió</span><b class="r">4.560.400,00</b></div><div><span class="lab">Recibido</span><b>4.318.500</b></div></div></div>
 <div style="display:flex;gap:8px;margin-top:12px"><div class="chip" style="flex:1;justify-content:center">${ic('stats-chart-outline', 'p')}Resumen</div><div class="chip" style="flex:1;justify-content:center">${ic('document-text-outline', 'p')}Importar extracto</div></div>
 <div class="seg" style="margin:12px 0"><div>${ic('pie-chart-outline')}Gráfico</div><div class="on">${ic('list-outline')}Movimientos · 32</div></div>
 <div class="search">${ic('search-outline')}Buscar en septiembre: nota, categoría o cuenta</div>
 <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><div class="chip on">Por día</div><div class="chip">Por categoría</div><div class="chip">Los más grandes</div><span style="margin-left:auto" class="mu">${ic('contract-outline')}</span></div>
 <div class="h">Hoy · domingo 27<span class="r" style="letter-spacing:0">−32.000</span></div>
 <div class="list">${catLine('rest', 'Almuerzo', 'Restaurantes', '−32.000,00', 'r')}</div>
 <div class="h">Viernes 25<span class="r" style="letter-spacing:0">−181.600</span></div>
 <div class="list">${catLine('mercado', 'Mercado quincena', 'Mercado', '−164.200,00', 'r')}${catLine('transp', 'Taxi', 'Transporte · corregido a mano', '−17.400,00', 'r')}</div>
 </main><div class="float-ctl" style="bottom:176px"><div class="btn-r">${ic('chevron-up-outline')}</div><div class="btn-r">${ic('chevron-down-outline')}</div></div><div class="fade"></div><div class="fab">${ic('add')}</div>${tabs('Inicio')}`;

S['a04-inicio-nuevo-usuario'] = `${status}<main style="padding-top:18px">
 <div style="font-size:28px;font-weight:700;margin:6px 4px 4px">¡Hola!</div>
 <div class="sub" style="font-size:15px;margin:0 4px 14px">Empieza en cuatro pasos. Todo se guarda solo en tu teléfono.</div>
 <div class="pbar" style="margin:0 4px"><i style="width:25%;background:var(--pr)"></i></div><div class="note" style="margin:8px 4px 14px">1 de 4 listo</div>
 ${[['checkmark-done-outline', C.grn, 'PASO 1', 'Crea tu primera cuenta', '', 1], ['document-text-outline', C.pur, 'PASO 2', 'Importa un extracto en PDF', 'La app lee los movimientos y cuadra el saldo con el banco', 2], ['arrow-up', C.red, 'PASO 3', 'Registra tu primer gasto', 'O toca + cuando quieras', 0], ['cloud-upload-outline', C.blu, 'PASO 4', 'Activa la copia en Google Drive', 'En tu propio Drive. Nadie más la ve', 0]]
  .map(([i, c, n, t, s, stt]) => `<div class="card" style="display:flex;gap:13px;align-items:center;margin-bottom:10px;${stt === 1 ? 'opacity:.55' : ''}${stt === 2 ? 'border-color:var(--pr)' : ''}">${ci(i, c)}<div style="flex:1"><div class="note">${n}</div><b>${t}</b>${s ? `<div class="sub">${s}</div>` : ''}</div>${stt === 1 ? '' : chev()}</div>`).join('')}
 <div class="banner" style="background:${tint(C.blu, .1)};color:#c3cdfa">${ic('lock-closed-outline')}<span>Sin cuenta, sin servidor y sin anuncios. Tus cifras nunca salen del teléfono.</span></div>
 </main><div class="fab">${ic('add')}</div>${tabs('Inicio')}`;

S['a05-estas-viendo'] = `${home(false)}<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div class="sh"><h2>Estás viendo</h2><span class="p">Cerrar</span></div>
 <div class="seg" style="width:220px;margin-bottom:10px"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="list">
  <div class="row">${ci('layers-outline', C.blu)}<div class="tx"><b>Todas las cuentas</b><small>Sin las archivadas ni las apartadas del patrimonio</small></div>${tick(true)}</div>
  ${[['coral', '−4.127.100,00', 'tarjeta de crédito'], ['azul', '12.480.300,00', ''], ['verde', '55.240.546,90', '2 productos'], ['ambar', '8.400.000,00', 'aparte del patrimonio'], ['dolar', '87,34 USD', '']]
   .map(([k, a, t]) => `<div class="row">${accIcon(k)}<div class="tx"><b>${ACC[k][2]}</b><small>${a}${t ? ' · ' + t : ''}</small></div><span class="mu">${ic('create-outline', '', 'width:19px;height:19px')}</span></div>`).join('')}</div>
 <div class="list" style="margin-top:10px"><div class="row plain"><div class="tx"><b>Incluir lo apartado del patrimonio</b><small>1 cuenta y 2 productos que no cuentan</small></div>${sw(false)}</div></div></div>`;

S['a06-periodo'] = `${home(false)}<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>Periodo</h2><span class="p">Cerrar</span></div>
 <div class="chips">${['Día', 'Semana', 'Mes', 'Año', 'Todo', 'Rango'].map((t, n) => `<div class="chip ${n === 2 ? 'on' : ''}">${t}</div>`).join('')}</div>
 <div class="card" style="margin-top:12px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center"><b>Septiembre 2026</b><span class="mu">${ic('chevron-back-outline')} ${ic('chevron-forward-outline')}</span></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px">${'Ene Feb Mar Abr May Jun Jul Ago Sep Oct Nov Dic'.split(' ').map((m, n) => `<div style="text-align:center;padding:10px 0;border-radius:12px;${n === 8 ? 'background:var(--pr);font-weight:700' : n > 8 ? 'color:#4b587a' : 'background:var(--s2)'}">${m}</div>`).join('')}</div></div>
 <div style="display:flex;gap:10px;margin-top:12px"><div class="field" style="flex:1"><div class="lab">Desde</div><div class="v">1 sept 2026</div></div><div class="field" style="flex:1"><div class="lab">Hasta</div><div class="v">30 sept 2026</div></div></div>
 <div class="btn" style="margin-top:12px">Aplicar</div></div>`;

S['a07-boton-mas'] = home(false) + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="lab" style="margin:0 4px 12px">Registrar</div>
 <div style="display:flex;gap:10px">${[['arrow-up', C.red, 'Gasto', 'Salió dinero'], ['arrow-down', C.grn, 'Ingreso', 'Entró dinero'], ['swap-horizontal', C.blu, 'Transferir', 'Entre tus cuentas']]
  .map(([i, c, t, s]) => `<div style="flex:1;background:var(--s2);border-radius:20px;padding:16px 6px;text-align:center">${ci(i, c, 52).replace('display:grid', 'display:grid;margin:0 auto 10px')}<b style="display:block;font-size:16px">${t}</b><small class="mu" style="font-size:12px">${s}</small></div>`).join('')}</div>
 <div class="h" style="margin-top:14px">Frecuentes ${tag('idea nueva', C.gold)}</div>
 <div class="chips">${[['vivienda', 'Arriendo 1.600.000'], ['rest', 'Almuerzo 32.000'], ['transp', 'Metro 3.200']].map(([k, t]) => `<div class="chip i">${catIcon(k, 27)}${t}</div>`).join('')}</div>
 <div class="list" style="margin-top:14px;background:var(--s2)">
  <div class="row">${ci('document-text-outline', C.pur, 40)}<div class="tx"><b>Importar extracto PDF</b><small>La app lee el extracto y tú confirmas</small></div>${chev()}</div>
  <div class="row">${ci('cube-outline', C.yel, 40)}<div class="tx"><b>Mover entre productos</b><small>Bolsillos, alcancías y CDTs</small></div>${chev()}</div></div></div>`;

const kp = label => `<div class="kp">${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', ',', '0', ic('backspace-outline'), '+'].map(k => `<div class="${'÷×−+'.includes(k) && k.length === 1 ? 'op' : ''}">${k}</div>`).join('')}
  <div style="grid-column:span 4" class="ok">${label}</div></div>`;
const typeSeg = on => `<div class="seg">${[['arrow-up', 'Gasto', 'red'], ['arrow-down', 'Ingreso', 'grn'], ['swap-horizontal', 'Transferir', 'blu']].map(([i, t, c]) => `<div class="${on === t ? 'on ' + c : ''}">${ic(i)}${t}</div>`).join('')}</div>`;

// The account with products: the product chosen shows under it and changes on its own.
S['a08-gasto-cuenta-con-productos'] = `${top('Nuevo gasto', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Gasto')}
 <div class="amount"><span class="r" style="font-size:30px;vertical-align:8px">−</span><span class="v">164.200</span><span class="cur">COP</span>
  <span style="position:absolute;right:0;top:26px" class="mu">${ic('close-circle')}</span></div>
 <div class="list"><div class="row">${accIcon('verde', 40)}<div class="tx"><span class="k">DESDE DÓNDE</span><b>Ahorro Verde</b></div>
   <div class="chip i" style="padding:5px 10px 5px 5px;font-size:13px">${sq('wallet-outline', C.grn, 24)}Bolsillo Mercado ${down()}</div></div>
  <div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Hoy · domingo 27 sept</b></div><div class="chip" style="padding:5px 11px">Ayer</div><div class="chip" style="padding:5px 11px">${ic('calendar-number-outline')}</div></div></div>
 <div class="h">Categoría<span class="p">Ver todas (22)</span></div>
 <div class="chips">${['mercado', 'rest', 'transp', 'servicios'].map((k, n) => `<div class="chip i ${n ? '' : 'on'}">${catIcon(k, 27)}${CAT[k][2]}</div>`).join('')}</div>
 <div class="field" style="margin-top:12px"><div class="lab">Nota</div><div class="v">Mercado quincena <span class="tag" style="background:var(--s3);color:#b9c3d8">la de siempre</span></div></div>
 </main>${kp('Guardar gasto')}`;

S['a09-elegir-producto'] = S['a08-gasto-cuenta-con-productos'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div class="sh"><h2>Productos de Ahorro Verde</h2></div>
 <div class="list">
  <div class="row">${sq('wallet-outline', C.grn)}<div class="tx"><b>Cuenta de ahorros</b><small>El habitual · 52.000.000,00</small></div>${tick(false)}</div>
  <div class="row">${sq('basket-outline', C.lim)}<div class="tx"><b>Bolsillo Mercado</b><small>1.240.546,90</small></div>${tick(true)}</div>
  <div class="row">${sq('airplane-outline', C.cya)}<div class="tx"><b>Bolsillo Viajes</b><small>2.000.000,00</small></div>${tick(false)}</div></div>
 <div class="list" style="margin-top:10px"><div class="row">${ci('swap-horizontal', C.blu, 40)}<div class="tx"><b class="p">Escoger otra cuenta</b></div>${chev()}</div></div></div>`;

S['a10-elegir-cuenta'] = S['a08-gasto-cuenta-con-productos'] + `<div class="scrim"></div><div class="sheet" style="top:150px"><div class="grab"></div>
 <div class="sh"><h2>Desde dónde</h2><span class="p">Cancelar</span></div>
 <div class="seg" style="width:220px;margin-bottom:10px"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="list">${[['verde', '55.240.546,90 · 3 productos', true], ['coral', 'Disponible 3.872.900'], ['azul', '12.480.300,00'], ['efectivo', '180.000,00'], ['naranja', '501.714,50 · 2 productos'], ['dolar', '87,34 USD']]
   .map(([k, s, on]) => `<div class="row">${accIcon(k)}<div class="tx"><b>${ACC[k][2]}</b><small>${s}</small></div>${on ? tick(true) : ''}</div>`).join('')}</div></div>`;

S['a11-elegir-categoria'] = S['a08-gasto-cuenta-con-productos'] + `<div class="scrim"></div><div class="sheet" style="top:110px"><div class="grab"></div>
 <div class="sh"><h2>Escoge una categoría</h2><span class="p">${ic('add')}</span></div>
 <div class="search">${ic('search-outline')}Buscar categoría</div>
 <div class="seg" style="margin:10px 0;width:220px"><div class="on">Más usadas</div><div>A–Z</div></div>
 <div class="list">${[['mercado', '96 veces', true], ['rest', '112 veces'], ['transp', '81 veces'], ['servicios', '36 veces'], ['vivienda', '12 veces'], ['salud', '9 veces'], ['ropa', 'sin usar']]
   .map(([k, t, on]) => `<div class="row">${catIcon(k)}<div class="tx"><b>${CAT[k][2]}</b><small>${t}</small></div>${on ? tick(true) : `<span class="mu">${ic('create-outline', '', 'width:18px;height:18px')}</span>`}</div>`).join('')}</div></div>`;

S['a12-transferencia-dos-monedas'] = `${top('Transferir', { left: 'x' })}<main style="padding-top:8px">${typeSeg('Transferir')}
 <div style="display:flex;gap:10px;margin-top:14px;align-items:center">
  <div class="card" style="flex:1;text-align:center;padding:12px;border-color:var(--pr)"><div class="lab">Sale</div><div style="font-size:24px;font-weight:700;margin-top:4px">1.000.000</div><div class="mu" style="font-size:13px">COP</div></div>
  <span class="p">${ic('arrow-forward-outline')}</span>
  <div class="card" style="flex:1;text-align:center;padding:12px"><div class="lab">Llega</div><div style="font-size:24px;font-weight:700;margin-top:4px">254,12</div><div class="mu" style="font-size:13px">USD · tasa 3.935,15</div></div></div>
 <div class="list" style="margin-top:12px">
  <div class="row">${accIcon('azul', 40)}<div class="tx"><span class="k">DESDE</span><b>Banco Azul</b></div><div class="chip" style="padding:6px 10px;font-size:12.5px">Pasar todo · 12.480.300</div></div>
  <div class="row" style="justify-content:center;padding:6px"><div class="chip" style="padding:6px 12px;font-size:13px">${ic('swap-vertical-outline')} Invertir</div></div>
  <div class="row">${accIcon('dolar', 40)}<div class="tx"><span class="k">HACIA DÓNDE</span><b>Cuenta Dólar</b></div>${tag('USD', C.cya)}${chev()}</div></div>
 <div class="list" style="margin-top:12px"><div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Hoy · domingo 27 sept</b></div>${chev()}</div>
  <div class="row">${ic('create-outline', 'mu')}<div class="tx"><b>Ahorro en dólares</b><small>La nota de siempre en esta ruta</small></div><span class="mu">${ic('close-circle')}</span></div></div>
 <div class="banner" style="background:${tint(C.blu, .12)};color:#c3cdfa;margin-top:12px">${ic('information-circle-outline')}<span>La tasa que aplicó el banco queda guardada en este movimiento; la historia nunca se recalcula.</span></div>
 </main><div class="save">Guardar transferencia</div>`;

S['a13-mover-entre-productos'] = `${top('Mover entre productos', { left: 'x' })}<main style="padding-top:10px">
 <div class="amount"><span class="p" style="font-size:28px;vertical-align:8px">⇄</span><span class="v">2.000.000</span><span class="cur">COP</span></div>
 <div class="list">
  <div class="row">${sq('airplane-outline', C.cya)}<div class="tx"><span class="k">SALE DE</span><b>Bolsillo Viajes</b><small>Ahorro Verde</small></div><div class="chip" style="padding:6px 10px;font-size:12.5px">Pasar todo · 2.000.000</div></div>
  <div class="row" style="justify-content:center;padding:6px"><div class="chip" style="padding:6px 12px;font-size:13px">${ic('swap-vertical-outline')} Invertir</div></div>
  <div class="row">${sq('wallet-outline', C.grn)}<div class="tx"><span class="k">ENTRA A</span><b>Cuenta de ahorros</b><small>El habitual</small></div>${chev()}</div></div>
 <div class="banner" style="background:${tint(C.grn, .1)};color:#a7ecc9;margin-top:12px">${ic('information-circle-outline')}<span>El saldo de la cuenta no cambia: la misma plata queda en otro producto. Desde mañana cada uno rinde con lo suyo.</span></div>
 <div class="list" style="margin-top:12px"><div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Hoy · domingo 27 sept</b></div>${chev()}</div>
  <div class="row">${ic('create-outline', 'mu')}<div class="tx"><b>Retiro bolsillo viajes</b><small>La nota de siempre</small></div></div></div>
 </main>${kp('Mover')}`;

S['a14-editar-movimiento'] = `${top('Editar movimiento', { left: 'x', right: `<div class="btn-r" style="color:var(--red)">${ic('trash-outline')}</div>` })}<main style="padding-top:8px">${typeSeg('Gasto')}
 <div class="amount"><span class="r" style="font-size:30px;vertical-align:8px">−</span><span class="v">17.400</span><span class="cur">COP</span></div>
 <div class="banner" style="background:${tint(C.gold, .12)};color:#f3dc9a">${ic('create-outline')}<span>Corregido a mano: una importación nunca lo va a sobrescribir.</span></div>
 <div class="list" style="margin-top:10px"><div class="row">${accIcon('coral', 40)}<div class="tx"><span class="k">DESDE DÓNDE</span><b>Tarjeta Coral</b></div>${chev()}</div>
  <div class="row">${ic('calendar-outline', 'mu')}<div class="tx"><b>Viernes 25 sept</b></div>${chev()}</div>
  <div class="row">${catIcon('transp', 40)}<div class="tx"><span class="k">CATEGORÍA</span><b>Transporte</b></div>${chev()}</div>
  <div class="row">${ic('create-outline', 'mu')}<div class="tx"><b>Taxi</b></div></div></div>
 </main>
 <div class="scrim"></div><div class="dialog"><div style="text-align:center">${ci('trash-outline', C.red, 54).replace('display:grid', 'display:grid;margin:0 auto 12px')}<b style="font-size:18px">¿Borrar este movimiento?</b>
  <div class="sub" style="margin-top:6px">No se puede deshacer.</div></div>
  <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn danger" style="flex:1">Sí, borrar</div></div></div>`;

export default S;
