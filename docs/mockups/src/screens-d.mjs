// Report, review, statement reading, bank notices, Más, backup, Google, tax.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, bigTitle, status, tint } from './lib.mjs';

const S = {};

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
