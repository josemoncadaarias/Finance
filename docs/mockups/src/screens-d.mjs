// Report, review, statement reading, bank notices, Más, backup, Google, tax.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, bigTitle, status, tint } from './lib.mjs';

const S = {};

const reportTop = on => top(`Resumen`, { sub: 'septiembre 2026 · todas las cuentas', left: 'back', right: `<div class="btn-r">${ic('document-text-outline')}</div>`,
  extra: `<div class="seg" style="margin-top:8px"><div class="${on === 'm' ? 'on blu' : ''}">${ic('swap-vertical-outline')}Movimientos</div><div class="${on === 'y' ? 'on grn' : ''}">${ic('trending-up-outline')}Rendimientos</div></div>
  <div style="display:flex;gap:8px;margin-top:8px"><div class="chip i" style="flex:1">${ci('layers-outline', C.blu, 27)}Todas las cuentas ${down()}</div><div class="chip">${ic('calendar-outline', 'p')}Septiembre ${down()}</div></div>` });

S['d01-resumen-financiero'] = `${reportTop('m')}<main>
 <div class="kpi"><div class="card"><span class="lab">Ingresos</span><b class="g">7.500.000,00</b></div><div class="card"><span class="lab">Gastos</span><b class="r">5.185.220,71</b></div>
  <div class="card"><span class="lab">Ahorrado</span><b class="g">2.314.779,29</b><span class="note">31 % de lo que entró</span></div>
  <div class="card"><span class="lab">vs. mismos días de agosto</span><b class="g">−8,2 %</b><span class="note">gastaste 462.110 menos</span></div></div>
 <div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between"><span class="lab">Dónde se fue la plata</span><span class="mu">${ic('chevron-up-outline', '', 'width:16px;height:16px')}</span></div>
  <div class="note" style="margin:4px 0 4px">Cada categoría, de mayor a menor, con su parte del gasto.</div>
  ${[['vivienda', 31, '1.600.000'], ['mercado', 20, '1.055.000'], ['rest', 19, '1.009.100'], ['transp', 11, '570.400']].map(([k, p, a]) =>
   `<div style="display:flex;align-items:center;gap:10px;margin-top:9px">${catIcon(k, 32)}<div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${CAT[k][2]}</span><span>${a}</span></div>
    <div class="pbar" style="margin-top:5px;height:6px"><i style="width:${p * 3}%;background:${CAT[k][1]}"></i></div></div><span class="mu" style="font-size:12px;width:30px;text-align:right">${p}%</span></div>`).join('')}</div>
 <div class="card" style="margin-top:10px"><div style="display:flex;gap:10px;align-items:flex-start">${ci('alert-circle-outline', C.yel, 36)}<div><b style="font-size:14.5px">Restaurantes subió 42 %</b>
  <div class="sub">Frente a los mismos días de agosto: 298.600 más.</div></div></div></div>
 <div class="h">Más secciones<span class="p">Expandir todo</span></div>
 <div class="list">${['Categorías antes y ahora', 'Lo que se repite cada mes', 'Cobros repetidos en el periodo', 'Los meses del año', 'Por cuenta', 'Los movimientos más grandes'].map(t => `<div class="row plain"><div class="tx"><b>${t}</b></div>${chev()}</div>`).join('')}</div>
 </main><div class="fade"></div>${tabs('Reporte')}`;

S['d02-resumen-rendimientos'] = `${reportTop('y')}<main>
 <div class="card hero"><div class="lab">Rendimiento neto del periodo</div><div class="big g">$ 998.551,09</div>
  <div class="sub">$ 39.942,04 por día · 25 días · incluye 0 estimado</div>
  <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-top:10px" class="mu"><span>Intereses 433.078</span><span>Inversiones 565.472</span></div>
  <div class="pbar" style="margin-top:6px"><i style="width:43%;background:var(--grn)"></i><i style="width:57%;background:${C.gold}"></i></div></div>
 <div class="kpi" style="margin-top:10px"><div class="card"><span class="lab">Rentabilidad E.A.</span><b>10,34 %</b><span class="note">ya sin retención</span></div>
  <div class="card"><span class="lab">Retefuente</span><b class="r">−26.360,57</b><span class="note">7 % · días ≥ 0,055 UVT</span></div></div>
 <div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="lab">Frente a la inflación</span>${tag('Le ganas', C.grn)}</div>
  ${[['Tu rentabilidad', '10,34', 82, C.grn], ['Inflación 2026 (promedio a agosto)', '5,77', 46, C.org]].map(([t, v, w, c]) => `<div style="display:flex;justify-content:space-between;margin-top:9px;font-size:13px"><span>${t}</span><b>${v} %</b></div><div class="pbar" style="margin-top:4px"><i style="width:${w}%;background:${c}"></i></div>`).join('')}
  <div class="sub" style="margin-top:8px">Rendimiento real <b class="g">+4,32 %</b> · ganancia real 417.330,12</div></div>
 <div class="card" style="margin-top:10px"><div class="lab">Rendimientos acumulados en 2026</div>
  <div class="bars">${[8, 22, 31, 40, 48, 60, 66, 76, 92].map((h, n) => `<div style="height:${h}%">${n < 8 ? `<i style="height:${n < 7 ? 45 : 20}%"></i>` : ''}</div>`).join('')}</div>
  <div class="months">${'ENE FEB MAR ABR MAY JUN JUL AGO SEP'.split(' ').map(m => `<span>${m}</span>`).join('')}</div>
  <div class="note" style="margin-top:6px">La parte clara es estimada. Toca una barra para ver su valor.</div></div>
 </main><div class="fade"></div>${tabs('Reporte')}`;

S['d03-leyendo-extracto'] = `${top('Importar extracto', { left: 'x' })}<main style="padding-top:30px;text-align:center">
 ${ci('document-text-outline', C.pur, 84).replace('display:grid', 'display:grid;margin:0 auto 16px')}
 <b style="font-size:19px">Leyendo el extracto</b><div class="sub" style="margin-top:4px">extracto-banco-azul-septiembre.pdf</div>
 <div class="card" style="margin-top:18px;text-align:left"><div style="display:flex;justify-content:space-between"><b>Página 3 de 4</b><span class="p b">72 %</span></div>
  <div class="pbar" style="margin-top:8px"><i style="width:72%;background:var(--pr)"></i></div>
  <div class="list" style="margin-top:12px;background:transparent;border:0">${[['Abrir el archivo', 1], ['Leer las líneas', 2], ['Cuadrar saldos', 0], ['Proponer categorías', 0]].map(([t, s]) => `<div class="row plain" style="padding:7px 0">${s === 1 ? ci('checkmark', C.grn, 26) : s === 2 ? ci('ellipsis-horizontal', C.blu, 26) : ci('ellipse-outline', C.gry, 26)}<div class="tx"><b style="font-size:14px;${s ? '' : 'color:var(--mu)'}">${t}</b></div></div>`).join('')}</div></div>
 <div class="banner" style="background:${tint(C.blu, .12)};color:#c3cdfa;margin-top:12px;text-align:left">${ic('shield-checkmark-outline')}<span>Nada se escribe hasta el final: detenerlo deja todo como estaba.</span></div>
 </main><div class="save" style="background:var(--s2);color:var(--tx)">Detener</div>`;

S['d04-por-revisar'] = `${top('Por revisar', { sub: 'Extracto de Banco Azul · septiembre', right: `<div class="btn-r">${ic('ellipsis-vertical')}</div>` })}<main>
 <div class="banner" style="background:${tint(C.grn, .12)};color:#a7ecc9">${ic('checkmark-circle')}<span><b>El extracto cuadra.</b> Saldo inicial + lo leído = saldo final 1.206.900,00.</span></div>
 <div class="search" style="margin-top:10px">${ic('search-outline')}Buscar: descripción, monto, fecha o categoría</div>
 <div style="display:flex;gap:8px;margin:10px 0;align-items:center"><div class="chip on">Todos · 14</div><div class="chip">Listos · 11</div><div class="chip">Les falta algo · 3</div><span style="margin-left:auto" class="p">Seleccionar</span></div>
 <div class="list">
  <div class="row">${catIcon('mercado', 38)}<div class="tx"><b style="font-size:14px">COMPRA EXITO POB MEDELLIN</b><small>26 sept · Mercado ${tag('aprendida', C.grn)}</small></div><div class="am r">−112.500,00</div></div>
  <div class="row">${catIcon('transp', 38)}<div class="tx"><b style="font-size:14px">PAGO SEGURO VEHICULO</b><small>19 sept · Transporte ${tag('sugerida', C.yel)}</small></div><div class="am r">−380.000,00</div></div>
  <div class="row">${sq('help-outline', C.gry, 38)}<div class="tx"><b style="font-size:14px">COMPRA ALKOSTO CALLE 30</b><small class="r">3 sept · Falta la categoría para poder guardarlo</small></div><div class="am r">−1.249.000,00</div></div>
  <div class="row">${ci('copy-outline', C.org, 38)}<div class="tx"><b style="font-size:14px">COMPRA CINE COLOMBIA</b><small>Puede ser el del 12 sept por 64.000 · Cine</small></div><div class="am r">−64.000,00</div></div>
  <div class="row">${ci('swap-horizontal', C.blu, 38)}<div class="tx"><b style="font-size:14px">TRANSF A AHORRO VERDE</b><small>Parece la otra mitad de un traslado con Ahorro Verde</small></div><div class="am">3.000.000,00</div></div></div>
 <div class="h">Comercios que se repiten</div>
 <div class="list"><div class="row">${sq('storefront-outline', C.tea, 38)}<div class="tx"><b>D1 LAURELES</b><small>4 movimientos · una categoría para todos</small></div><div class="chip" style="padding:5px 10px">Elegir</div></div></div>
 </main><div style="position:absolute;left:16px;right:16px;bottom:22px;display:flex;gap:10px"><div class="btn ghost" style="width:120px">Descartar</div><div class="btn" style="flex:1">Guardar los 11</div></div>`;

S['d05-por-revisar-seleccion'] = S['d04-por-revisar'].replace(/<div class="row">(<span class="sq|<span class="ci)/g, '<div class="row">' + tick(true) + '$1').replace('Guardar los 11', 'x')
  + `<div style="position:absolute;left:12px;right:12px;bottom:22px;background:#15213a;border:1px solid #2a3b60;border-radius:22px;padding:10px 12px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 30px rgba(0,0,0,.6)">
  <span class="btn-r" style="width:38px;height:38px">${ic('close')}</span><b style="flex:1">5 elegidos</b><span class="p" style="font-size:13px">Ninguno</span>
  <span class="chip" style="padding:8px 10px">${ic('pricetags-outline')}</span><span class="chip" style="padding:8px 10px;color:var(--red)">${ic('trash-outline')}</span><span class="chip" style="padding:8px 12px;background:var(--pr);border-color:var(--pr)">Guardar 4</span></div>`;

S['d06-avisos-sin-permiso'] = `${top('Avisos del banco', { sub: 'Lo que tus bancos mandan al celular, tal cual' })}<main>
 <div class="card hero" style="text-align:center">${ci('notifications-outline', C.yel, 60).replace('display:grid', 'display:grid;margin:0 auto 10px')}<b style="font-size:17px">Falta darle permiso</b>
  <div class="sub" style="margin-top:4px">Primero hay que ver qué mandan tus bancos, sin interpretar nada.</div></div>
 <div class="list" style="margin-top:12px">${[['eye-outline', 'La app anota QUÉ aplicaciones mandan avisos, sin guardar lo que dicen.'], ['checkbox-outline', 'Lo que dice un aviso solo se guarda para las apps que tú marques.'], ['phone-portrait-outline', 'Todo se queda en el celular. No se manda a ningún lado.']]
  .map(([i, t]) => `<div class="row">${ci(i, C.grn, 38)}<div class="tx"><small style="color:var(--tx);font-size:13.5px;margin:0">${t}</small></div></div>`).join('')}</div>
 <div class="hint">Android va a pedir permiso para leer TODOS los avisos del celular: no sabe distinguir. Todo lo que no sea de un banco marcado se descarta.</div>
 </main><div style="position:absolute;left:16px;right:16px;bottom:22px"><div class="btn">Abrir los ajustes de Android</div><div class="btn ghost" style="margin-top:8px">Ya lo di, volver a revisar</div></div>`;

S['d07-avisos-banco'] = `${top('Avisos del banco', { right: `<div class="btn-r">${ic('ellipsis-vertical')}</div>` })}<main>
 <div class="search">${ic('search-outline')}Buscar una app o lo que dijo</div>
 <div class="h">Apps que mandan avisos<span class="p">Seleccionar</span></div><div class="list">
  ${[['Banco Azul', 'com.bancoazul.app · 18 avisos', C.blu, true], ['Tarjeta Coral', 'com.coral.card · 6 avisos', C.yel, true], ['Mensajería', 'no es un banco · 212 avisos', C.gry, false]].map(([n, s, c, on]) =>
   `<div class="row">${sq('phone-portrait-outline', c, 40)}<div class="tx"><b>${n} ${on ? tag('se guarda', C.grn) : ''}</b><small>${s}</small></div>${sw(on)}</div>`).join('')}
  <div class="row">${sq('eye-off-outline', C.gry, 40)}<div class="tx"><b>Apps ocultas (2)</b></div><span class="p" style="font-size:13px">Mostrar</span></div></div>
 <div class="h">Lo que dijeron</div><div class="list">
  ${[['Banco Azul', 'Compra por $45.900 en EXITO POBLADO con tu tarjeta *1234', 'hace 12 min', C.blu], ['Tarjeta Coral', 'Tienes un nuevo movimiento. Abre la app para verlo.', 'ayer 8:14 p. m.', C.yel]].map(([n, t, w, c]) =>
   `<div class="row" style="align-items:flex-start">${sq('notifications-outline', c, 36)}<div class="tx"><b style="font-size:14px">${n} <span class="mu" style="font-weight:400;font-size:12px">· ${w}</span></b><small style="color:#c3cbdb">${t}</small></div></div>`).join('')}</div>
 <div class="hint">Tal cual llegó. Todavía no se saca monto ni categoría: primero hay que ver qué dicen.</div></main>`;

S['d08-mas'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="card hero" style="display:flex;align-items:center;gap:14px"><div style="width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--pr),${C.pur});display:grid;place-items:center;font-weight:700;font-size:20px">J</div>
  <div style="flex:1"><b style="font-size:16px">Jose</b><div class="sub">Copia en tu Google Drive · hoy 8:12 a. m.</div></div>${chev()}</div>
 <div class="h">Tus datos</div><div class="list">
  <div class="row">${sq('checkmark-done-outline', C.blu, 40)}<div class="tx"><b>Por revisar</b><small>Lo que la app leyó y tú confirmas</small></div><span class="pill">14</span>${chev()}</div>
  <div class="row">${sq('pricetags-outline', C.pur, 40)}<div class="tx"><b>Categorías</b><small>22 activas · 3 archivadas</small></div>${chev()}</div>
  <div class="row">${sq('notifications-outline', C.yel, 40)}<div class="tx"><b>Avisos del banco</b><small>2 apps marcadas</small></div>${chev()}</div>
  <div class="row">${sq('swap-vertical-outline', C.tea, 40)}<div class="tx"><b>Importar y exportar</b><small>Copia de seguridad y CSV</small></div>${chev()}</div></div>
 <div class="h">Herramientas</div><div class="list">
  <div class="row">${sq('calculator-outline', C.org, 40)}<div class="tx"><b>Simulador de renta</b><small>Formulario 210 · 2026</small></div>${chev()}</div>
  <div class="row">${sq('cash-outline', C.lim, 40)}<div class="tx"><b>Monedas y tasas</b><small>COP, USD, EUR · TRM de hoy</small></div>${chev()}</div></div>
 <div class="h">Preferencias</div><div class="list">
  <div class="row">${sq('language-outline', C.cya, 40)}<div class="tx"><b>Idioma</b><small>Español</small></div>${chev()}</div>
  <div class="row">${sq('color-palette-outline', C.pnk, 40)}<div class="tx"><b>Tema</b><small>Automático</small></div>${chev()}</div></div>
 </main><div class="fade"></div>${tabs('Más', true)}`;

S['d09-importar-exportar'] = `${top('Importar y exportar')}<main>
 <div class="card hero"><div style="display:flex;gap:12px;align-items:center">${ci('shield-checkmark-outline', C.grn, 46)}<div class="tx"><b>Copia de seguridad</b><small>Un solo archivo con todo: cuentas, movimientos, productos e imágenes</small></div></div>
  <div class="btn" style="margin-top:12px">${ic('download-outline')}Guardar copia de seguridad</div></div>
 <div class="list" style="margin-top:10px"><div class="row">${sq('refresh-outline', C.org, 40)}<div class="tx"><b>Restaurar una copia</b><small>Reemplaza lo que hay en este teléfono; te preguntamos al elegir el archivo</small></div>${chev()}</div></div>
 <div class="card" style="margin-top:10px"><div style="display:flex;gap:12px;align-items:center">${ci('grid-outline', C.tea, 46)}<div class="tx"><b>CSV para leer</b><small>Tus movimientos en una hoja, para Excel. No sirve para restaurar.</small></div></div>
  <div class="btn ghost" style="margin-top:12px">${ic('download-outline')}Descargar CSV</div></div>
 <div class="list" style="margin-top:10px"><div class="row">${sq('logo-google', C.blu, 40)}<div class="tx"><b>Copia en Google Drive</b><small>Automática · hoy 8:12 a. m.</small></div>${chev()}</div></div>
 <div class="banner" style="background:${tint(C.grn, .1)};color:#a7ecc9;margin-top:12px">${ic('checkmark-circle')}<span>Se guardó finance-2026-09-27.json</span></div></main>`;

S['d10-restaurar-dialogo'] = S['d09-importar-exportar'] + `<div class="scrim"></div><div class="dialog">
 <div style="text-align:center">${ci('refresh-outline', C.org, 54).replace('display:grid', 'display:grid;margin:0 auto 12px')}<b style="font-size:18px">¿Restaurar finance-2026-09-20.json?</b></div>
 <div class="list" style="margin-top:12px">${[['Guardada el', '20 sept 2026'], ['Movimientos', '13.214'], ['Cuentas', '19']].map(([k, v]) => `<div class="row plain" style="padding:8px 12px"><div class="tx"><small style="margin:0">${k}</small></div><b>${v}</b></div>`).join('')}</div>
 <div class="banner" style="background:${tint(C.red, .14)};color:#ffb4b9;margin-top:10px">${ic('alert-circle-outline')}<span>Reemplaza TODO lo que hay en este teléfono. Guarda una copia antes si no estás seguro.</span></div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Elegir otro</div><div class="btn danger" style="flex:1">Restaurar</div></div></div>`;

S['d11-google-sin-sesion'] = `${top('Copia en Google Drive')}<main>
 <div style="text-align:center;margin-top:10px">${ci('logo-google', C.blu, 76).replace('display:grid', 'display:grid;margin:0 auto 12px')}<b style="font-size:19px">Guarda una copia en tu Google Drive</b>
  <div class="sub" style="margin-top:6px">Opcional. La app funciona igual sin conectarte: tus datos viven en este celular.</div></div>
 <div class="list" style="margin-top:14px">${[['phone-portrait-outline', 'Todo sigue guardándose en el celular, incluso sin internet.'], ['lock-closed-outline', 'La copia va a una carpeta de tu propio Drive que solo esta app puede ver.'], ['hand-left-outline', 'Tú decides si se guarda sola o con un botón.']]
  .map(([i, t]) => `<div class="row">${ci(i, C.grn, 38)}<div class="tx"><small style="color:var(--tx);font-size:13.5px;margin:0">${t}</small></div></div>`).join('')}</div>
 </main><div class="save" style="background:#fff;color:#1f1f1f;display:flex;gap:10px;align-items:center;justify-content:center">${ic('logo-google', '', 'width:20px;height:20px;color:#4285f4')}Continuar con Google</div>`;

S['d12-google-con-sesion'] = `${top('Copia en Google Drive')}<main>
 <div class="card hero" style="display:flex;align-items:center;gap:14px"><div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--pr),${C.pur});display:grid;place-items:center;font-weight:700;font-size:20px">J</div>
  <div style="flex:1"><b>Jose</b><div class="sub">jose@gmail.com</div></div></div>
 <div class="card" style="margin-top:10px"><div class="lab">Copia en Drive</div>
  <div class="mini" style="margin-top:8px"><div><span class="lab">Guardada</span><b>Hoy 8:12 a. m.</b></div><div><span class="lab">Tiene</span><b>13.402 registros</b></div></div>
  <div style="display:flex;gap:10px;margin-top:12px"><div class="btn" style="flex:1">${ic('cloud-upload-outline')}Guardar ahora</div><div class="btn ghost" style="flex:1">${ic('cloud-download-outline')}Traer la copia</div></div></div>
 <div class="list" style="margin-top:10px"><div class="row plain"><div class="tx"><b>Guardar la copia sola</b><small>Sube cuando sales de la app, que es cuando no estorba</small></div>${sw(true)}</div></div>
 <div class="hint">Es el mismo archivo que guarda "Importar y exportar". La copia anterior nunca se pierde: si otro teléfono la cambió, se guarda aparte con su fecha.</div>
 <div class="list" style="margin-top:12px"><div class="row">${sq('swap-horizontal', C.blu, 40)}<div class="tx"><b>Cambiar de cuenta de Google</b><small>Cierra esta sesión y entra con otra</small></div>${chev()}</div>
  <div class="row">${sq('log-out-outline', C.red, 40)}<div class="tx"><b class="r">Cerrar sesión</b><small>Tus datos se quedan en el teléfono</small></div></div></div></main>`;

S['d13-drive-reemplazar'] = S['d12-google-con-sesion'] + `<div class="scrim"></div><div class="dialog">
 <div style="text-align:center">${ci('cloud-upload-outline', C.yel, 54).replace('display:grid', 'display:grid;margin:0 auto 12px')}<b style="font-size:18px">¿Reemplazar la copia de Drive?</b></div>
 <div class="sub" style="margin-top:8px">La copia que hay en Drive se guardó el 25 sept a las 9:40 p. m. y este teléfono nunca la ha visto. Tiene 13.388 registros.</div>
 <div class="banner" style="background:${tint(C.grn, .1)};color:#a7ecc9;margin-top:10px">${ic('shield-checkmark-outline')}<span>La que hay hoy no se pierde: queda guardada aparte, con su fecha.</span></div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Reemplazarla</div></div></div>`;

// The income-tax simulator: the verdict stays pinned, the form below it.
const taxTop = `${top('Simulador de renta', { sub: 'Formulario 210', right: `<div class="btn-r">${ic('cloud-done-outline')}</div><div class="btn-r">${ic('language-outline')}</div>`,
  extra: `<div class="month" style="margin-top:8px">${ic('chevron-back-outline')}<span>Año gravable 2026 <small class="mu" style="font-weight:400;font-size:12px">· guardado</small></span>${ic('chevron-forward-outline')}</div>` })}`;
const verdict = `<div class="card" style="background:linear-gradient(145deg,${tint(C.red, .3)},${tint(C.red, .08)} 60%,#111b2f);border-color:${tint(C.red, .4)}">
 <span class="lab">A pagar</span>
 <div class="big">$ 4.812.000</div><div class="sub">Ahorra 401.000 al mes para pagarlo sin sustos · impuesto 9.312.000 − retenido 4.500.000</div></div>`;
const legend = `<div style="display:flex;gap:14px;margin:10px 4px;font-size:12.5px" class="mu"><span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;border:2px solid ${C.gold};vertical-align:-2px;margin-right:5px"></span>Lo escribes tú</span><span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--s3);vertical-align:-2px;margin-right:5px"></span>Lo calcula la app</span></div>`;

S['d14-renta-inicio'] = `${taxTop}<main>${verdict}${legend}
 <div class="card" style="display:flex;gap:12px;align-items:center;padding:12px">${ci('grid-outline', C.grn, 40)}<div class="tx"><b>Descargar en Excel</b><small>Con fórmulas vivas, igual a tu hoja de siempre</small></div>${ic('download-outline', 'p')}</div>
 <div class="h">Tu situación</div>
 <div class="seg"><div>Ordinario</div><div class="on blu">Integral</div><div>Independiente</div></div>
 <div class="list" style="margin-top:10px">${[['Parámetros del año', 'UVT, salario mínimo, topes · 2 prestados de 2025', 'options-outline', C.gry], ['1. Rentas de trabajo', 'Casillas 32 a 42', 'briefcase-outline', C.blu], ['2. Trabajo sin relación laboral', 'Casillas 43 a 46', 'laptop-outline', C.cya], ['3. Rentas de capital', 'Casillas 58 a 62', 'trending-up-outline', C.grn], ['4. Rentas no laborales', 'Casillas 74 a 78', 'cash-outline', C.lim], ['5. Exentas y deducciones', 'Con límite del 40 % o 1.340 UVT', 'shield-checkmark-outline', C.pur], ['6. Deducciones sin límite', 'Dependientes, factura electrónica', 'people-outline', C.pnk]]
  .map(([t, s, i, c]) => `<div class="row">${sq(i, c, 40)}<div class="tx"><b>${t}</b><small>${s}</small></div>${chev()}</div>`).join('')}</div>
 </main>`;

S['d15-renta-seccion'] = `${taxTop}<main><div class="card" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:${tint(C.red, .14)};border-color:${tint(C.red, .35)}"><span class="lab">A pagar</span><b style="font-size:18px">$ 4.812.000</b></div>
 <div class="h">3. Rentas de capital<span class="mu" style="letter-spacing:0;text-transform:none">Casillas 58 a 62</span></div>
 <div class="list">
  <div class="row plain typed" style="flex-direction:column;align-items:stretch;gap:8px"><div class="tx"><b style="white-space:normal">Ingresos brutos por rentas de capital <span class="mu" style="font-weight:400">(gross capital income)</span><span class="boxno">Csl. 58</span></b><small>Rendimientos, cashback e intereses del año</small></div>
   <div class="field on" style="display:flex;justify-content:space-between"><span class="mu">$</span><b>6.148.220</b></div>
   <div style="display:flex;gap:8px"><div class="chip" style="font-size:12.5px">${ic('trending-up-outline', 'g')}Traer los rendimientos</div><div class="chip" style="font-size:12.5px">${ic('arrow-undo-outline')}Deshacer</div></div>
   <div class="note">Trae los del año, estimado incluido. Las cuentas de inversión no se incluyen: escribe aparte lo que el fondo certifique.</div></div>
  <div class="row plain typed"><div class="tx"><b>De ellos, rendimientos financieros</b><small>Lo que certifica el banco</small></div><b>6.010.000</b></div>
  <div class="row plain"><div class="tx"><b>Componente inflacionario <span class="boxno">Csl. 59</span></b>
   <div class="seg" style="margin-top:6px"><div class="on">Calcularlo</div><div>Escribirlo del certificado</div></div></div></div>
  <div class="row plain" style="background:var(--s2)"><div class="tx"><b>Renta líquida de capital <span class="boxno">Csl. 61</span></b></div><b>3.822.110</b></div></div>
 <div class="banner" style="background:${tint(C.gold, .1)};color:#f0dca4;margin-top:10px">${ic('information-circle-outline')}<span>% componente inflacionario 2026: prestado de 2025 (se publica meses después del año). Fuente: Siempre al Día.</span></div>
 </main><div class="float-ctl" style="bottom:30px"><div class="btn-r">${ic('chevron-up-outline')}</div><div class="btn-r">${ic('chevron-down-outline')}</div></div>`;

S['d16-renta-trabajo'] = `${taxTop}<main><div class="card" style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;background:${tint(C.red, .14)};border-color:${tint(C.red, .35)}"><span class="lab">A pagar</span><b style="font-size:18px">$ 4.812.000</b></div>
 <div class="h">1. Rentas de trabajo<span class="mu" style="letter-spacing:0;text-transform:none">Casillas 32 a 42</span></div>
 <div class="list">
  <div class="row plain typed"><div class="tx"><b>Salario mensual bruto</b><small>${ic('pricetag-outline', '', 'width:13px;height:13px;vertical-align:-2px')} Traído de la categoría Salario · aproximado</small></div><b>20.000.000</b></div>
  <div class="row plain typed"><div class="tx"><b>De ese salario, pagos que no son salario</b><small>Bonos y auxilios pactados como no salariales</small></div><b>10.000.000</b></div>
  <div class="row plain typed"><div class="tx"><b>Meses trabajados en el año</b></div><b>12</b></div>
  <div class="row plain" style="background:var(--s2)"><div class="tx"><b>Base de cotización mensual (IBC)</b><small>70 % de lo salarial + lo no salarial que pasa el 40 %</small></div><b>9.000.000</b></div>
  <div class="row plain" style="background:var(--s2)"><div class="tx"><b>Total aportes obligatorios</b></div><b>10.584.000</b></div>
  <div class="row plain" style="background:var(--s3)"><div class="tx"><b>Renta líquida de trabajo</b></div><b>229.416.000</b></div></div>
 <div class="chip" style="margin-top:10px">${ic('briefcase-outline', 'p')}Traer el salario de una categoría</div>
 <div class="h">Fuentes y referencias</div><div class="list"><div class="row plain"><div class="tx"><b>Tabla de tarifas del art. 241</b></div>${chev()}</div><div class="row plain"><div class="tx"><b>Fuentes (10)</b><small>DIAN, Actualícese, CONCP…</small></div>${chev()}</div></div>
 </main>`;

export default S;
