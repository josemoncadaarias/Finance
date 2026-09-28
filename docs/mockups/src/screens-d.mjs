// Report, review, statement reading, bank notices, Más, backup, Google, tax.
import { ic, ci, sq, C, CAT, ACC, catIcon, accIcon, chev, down, tick, tag, sw, top, tabs, bigTitle, status, tint } from './lib.mjs';

const S = {};

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
