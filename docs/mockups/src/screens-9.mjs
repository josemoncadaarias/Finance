// Group 9 (v4, 2026-09-28): the income-tax simulator (features/tax), looks
// and access only - rule 19, the engine, the form's rows, the casillas and
// the spreadsheet stay exactly as they are. Everything the screen does today
// is here: the year with its arrows and "Guardado", the verdict always in
// view (A pagar / A favor / En paz, "aparta X al mes", the tax and
// withholding line), the missing UVT, the key of typed and worked-out boxes,
// the spreadsheet, the kind of work, every section with its casillas,
// the year's parameters with where each comes from, casilla 59 asked two
// ways, bringing the salary by category and the yields (with Deshacer), the
// rate table, the monthly and extra withholding, the notes and sources, the
// two arrows and open/close all, the busy overlay while the file is written.
// Drawn with the rules of groups 1-8: a section closed shows its casilla and
// figure; an explanation is an (i); every word the app says is whole; a
// choice with explanations is one row opening a sheet.
import { ic, ci, sq, C, down, tabs, tint, status } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const GOLD = C.gold ?? '#e0b441';

// The title bar: back to Más, the title, the spreadsheet. Then the year with
// round arrows at its edges and whether it is saved. Scrolled, the verdict
// shrinks to one line under it, so it is never out of view.
const arrow = d => `<span style="width:42px;height:42px;border-radius:50%;background:var(--s2);display:grid;place-items:center;flex:none">${ic(`chevron-${d}-outline`, '', 'width:21px;height:21px')}</span>`;
const yearRow = (year, saved) => `<div style="display:flex;align-items:center;gap:8px;margin-top:6px">${arrow('back')}<div style="flex:1;text-align:center"><b style="font-size:16.5px">Año gravable ${year}</b>
 <div class="sub" style="font-size:12px;display:flex;gap:4px;justify-content:center;align-items:center">${saved === 'saving' ? `${ic('sync-outline', '', 'width:13px;height:13px')}Guardando…` : `${ic('checkmark-done-outline', 'g', 'width:14px;height:14px')}Guardado`}</div></div>${arrow('forward')}</div>`;
const VERDICT = {
  pay: { tag: 'A pagar', fig: '$ 4.812.000', c: C.red },
  favour: { tag: 'A favor', fig: '$ 1.268.400', c: C.grn },
  even: { tag: 'En paz', fig: '$ 0', c: C.blu },
};
const strip = kind => { const v = VERDICT[kind]; return `<div style="margin-top:10px;border-radius:14px;padding:9px 14px;display:flex;align-items:center;gap:10px;background:${tint(v.c, .15)};border:1px solid ${tint(v.c, .35)}"><span class="lab" style="flex:1;color:${v.c}">${v.tag}</span><b style="font-size:18px">${v.fig}</b></div>`; };
const head = ({ year = 2026, saved = 'saved', compact = '' } = {}) => `<div class="bar-top">${st}<div class="tt" style="gap:10px"><span class="btn-r" style="background:none">${ic('arrow-back')}</span><h1>Simulador de renta<small>Formulario 210</small></h1>
 <div class="btn-r">${ic('download-outline')}</div></div>${yearRow(year, saved)}${compact ? strip(compact) : ''}</div>`;

const verdict = (kind = 'pay') => {
  const v = VERDICT[kind];
  return `<div class="card" style="background:linear-gradient(145deg,${tint(v.c, .32)},${tint(v.c, .08)} 60%,#111b2f);border-color:${tint(v.c, .42)}">
 <span class="lab" style="color:${v.c}">${v.tag}</span><div class="big">${v.fig}</div>
 ${kind === 'pay' ? `<div style="display:flex;gap:8px;align-items:center;font-size:14px;margin-top:2px">${ic('wallet-outline', '', `width:17px;height:17px;color:${v.c};flex:none`)}<span>Aparta 401.000 cada mes para no tener sorpresas</span></div>` : ''}
 <div class="sub" style="margin-top:6px">Impuesto ${kind === 'favour' ? '47.893.600' : kind === 'even' ? '49.162.000' : '53.974.000'} · retenciones 49.162.000</div></div>`;
};

// The key: two samples beside what they mean, never shaped like a button.
const typedSample = `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${tint(GOLD, .16)};border:1.5px solid ${GOLD};vertical-align:-2px;margin-right:6px"></span>`;
const workedSample = `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:var(--s3);vertical-align:-2px;margin-right:6px"></span>`;
const legend = `<div style="display:flex;gap:16px;margin:10px 4px 0;font-size:12.8px;flex-wrap:wrap" class="mu"><span>${typedSample}Casilla que escribes</span><span>${workedSample}Casilla que se calcula sola</span></div>`;

// A section: closed, its icon, its title (whole) and, under it, its casilla
// and figure; open, the same head and its rows.
const sIcon = (i, c) => sq(i, c, 36);
const closed = ([i, c, title, peek, cls = '']) => `<div class="row" style="background:var(--s1);border:1px solid #17223b;border-radius:18px;margin-top:8px;padding:10px 14px">${sIcon(i, c)}<div class="tx"><b style="white-space:normal;line-height:1.25">${title}</b><small class="${cls}" style="font-weight:500;font-size:13.3px;${cls ? '' : 'color:#aab6d3'}">${peek}</small></div>${ic('chevron-forward-outline', 'mu', 'width:18px;height:18px')}</div>`;
const open = ([i, c, title, , , sub = ''], body) => `<div class="card" style="margin-top:8px;padding:12px 14px"><div style="display:flex;align-items:center;gap:10px">${sIcon(i, c)}<div style="flex:1;min-width:0"><b style="display:block;font-size:16px;line-height:1.25">${title}</b>${sub ? `<small class="mu" style="font-size:12.5px">${sub}</small>` : ''}</div>${ic('chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>${body}</div>`;

const SECTIONS = {
  situation: ['person-outline', C.blu, 'Tu situación', 'Salario integral · 2 dependientes'],
  parameters: ['options-outline', C.gry, 'Parámetros del año', 'UVT 52.374 · 1 parámetro de referencia 2025', 'y', 'Cambian por ley cada año. Casi nunca se tocan.'],
  labour: ['briefcase-outline', C.blu, '1. Rentas de trabajo', 'Csl. 34 · 230.280.000', '', 'Casillas 32 a 42'],
  fees: ['laptop-outline', C.cya, '2. Rentas de trabajo sin relación laboral', 'Csl. 46 · 0', '', 'Casillas 43 a 46'],
  capital: ['trending-up-outline', C.grn, '3. Rentas de capital', 'Csl. 61 · 3.822.110', '', 'Casillas 58 a 62'],
  other: ['cash-outline', C.lim ?? C.grn, '4. Rentas no laborales', 'Csl. 78 · 0', '', 'Casillas 74 a 78'],
  general: ['layers-outline', C.pur, 'Cédula general', 'Csl. 91 · 234.102.110'],
  capped: ['shield-checkmark-outline', C.pur, '5. Rentas exentas y deducciones', 'Csl. 41 · 67.487.076', '', 'Con límite del 40% o 1.340 UVT · Casillas 35 a 41'],
  uncapped: ['people-outline', C.pnk, '6. Deducciones sin límite', 'Csl. 92 · 75.148.932', '', 'No compiten por el 40% ni por los 1.340 UVT'],
  tax: ['calculator-outline', C.org, 'Impuesto', 'Csl. 126 · 53.974.000'],
  withholding: ['receipt-outline', C.tea, 'Retenciones y anticipos', 'Csl. 132 · 49.162.000', '', 'Casillas 130 a 132'],
  settle: ['flag-outline', C.red, 'Liquidación final', 'Csl. 134 · a pagar 4.812.000', 'r'],
  planning: ['calendar-outline', C.yel, 'Para planear tu año', 'Aparta 401.000 al mes'],
  voluntary: ['leaf-outline', C.grn, 'Aporte voluntario óptimo', 'Recomendado 2.694.084', '', 'AFC, FVP o AVC'],
  notes: ['document-text-outline', C.gry, 'Notas y supuestos', '9 notas · 10 fuentes'],
};
const list = (openKey = '', body = '', from = 0, to = 99) => Object.entries(SECTIONS).slice(from, to).map(([k, s]) => k === openKey ? open(s, body) : closed(s)).join('');

// One row of the form. Typed: its box framed in gold, the unit inside. Worked
// out: its figure on grey; a total in bold. The casilla is a small chip; a
// hint is an (i) beside the label.
const csl = n => n ? `<span class="boxno" style="margin-left:6px;white-space:nowrap">Csl. ${n}</span>` : '';
const lbl = (label, { box, info, gloss } = {}) => `<div class="tx"><b style="white-space:normal;line-height:1.3;font-size:14.5px">${label}${gloss ? ` <span class="mu" style="font-weight:400">(${gloss})</span>` : ''}${csl(box)}${info ? ` <span style="display:inline-block;vertical-align:-4px;margin-left:4px">${infoDot}</span>` : ''}</b></div>`;
const typed = (label, value, opts = {}) => `<div class="row plain" style="padding:9px 0;gap:10px">${lbl(label, opts)}
 <div style="flex:none;min-width:118px;max-width:150px;border-radius:12px;padding:8px 10px;background:${tint(GOLD, .1)};border:1.5px solid ${opts.focus ? 'var(--pr)' : tint(GOLD, .7)};display:flex;gap:5px;align-items:baseline;justify-content:flex-end;font-weight:600;font-size:15px">${opts.unit === '$' || !opts.unit ? '<span class="mu" style="font-weight:400;font-size:13px;margin-right:auto">$</span>' : ''}<span>${value}</span>${opts.unit && opts.unit !== '$' ? `<span class="mu" style="font-weight:400;font-size:12.5px">${opts.unit}</span>` : ''}</div></div>`;
const worked = (label, value, opts = {}) => `<div class="row plain" style="padding:9px 0;gap:10px">${lbl(label, opts)}
 <div style="flex:none;min-width:118px;text-align:right;border-radius:12px;padding:8px 10px;background:${opts.total ? 'var(--s3)' : 'var(--s2)'};font-weight:${opts.total ? 700 : 500};font-size:15px;${opts.cls ? `color:var(--${opts.cls})` : ''}">${value}</div></div>`;
const noteLine = t => `<div class="sub" style="margin:10px 0 2px;font-size:13px;line-height:1.4">${t}</div>`;
const rows = (...r) => `<div style="margin-top:6px">${r.join('')}</div>`;
const smallBtn = (i, t, cls = '') => `<span class="chip ${cls}" style="padding:7px 12px;font-size:13.5px">${ic(i, cls ? '' : 'p')}${t}</span>`;
const bubble = (top, arrowLeft, text) => `<div style="position:absolute;left:22px;right:22px;top:${top}px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.42;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;left:${arrowLeft}px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>${text}</div>`;
const toast = t => `<div style="position:absolute;left:22px;right:22px;bottom:104px;background:#1e2b47;border:1px solid #33456f;border-radius:16px;padding:11px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 26px rgba(0,0,0,.55);font-size:13.5px">${ic('checkmark-circle', '', `width:20px;height:20px;color:${C.grn};flex:none`)}<span>${t}</span></div>`;
const allBar = (openAll) => `<div style="display:flex;align-items:center;margin:14px 2px 0"><span class="lab" style="flex:1">15 secciones</span><span class="chip" style="padding:6px 11px;font-size:13px">${ic(openAll ? 'chevron-expand-outline' : 'chevron-collapse-outline', '', 'width:16px;height:16px')}${openAll ? 'Abrir todas' : 'Cerrar todas'}</span></div>`;
// The two arrows of a long form, side by side in the faded strip above the
// bar: stacked on the right they covered the figures of the value column.
const arrowBtn = d => `<div style="width:38px;height:38px;border-radius:50%;background:rgba(38,50,79,.82);border:1px solid #3a4a72;display:grid;place-items:center;box-shadow:0 4px 14px rgba(0,0,0,.45)">${ic(`arrow-${d}-outline`, '', 'width:19px;height:19px')}</div>`;
const jump = (_b, show = 'both') => `<div style="position:absolute;right:16px;bottom:100px;display:flex;gap:8px">${show !== 'down' ? arrowBtn('up') : ''}${show !== 'up' ? arrowBtn('down') : ''}</div>`;
const end = `<div style="height:150px"></div></main><div class="fade" style="height:205px;background:linear-gradient(transparent,var(--bg) 42%)"></div>`;

// 1. As it opens: the verdict, the key, every section closed with its
//    casilla and figure, so the whole return reads in one screen.
S['9a-renta'] = `${head()}<main>${verdict('pay')}${legend}${allBar(true)}${list('', '', 0, 6)}${end}${jump(112, 'down')}${tabs('Más')}`;
S['9b-renta-abajo'] = `${head({ compact: 'pay' })}<main>${list('', '', 6)}
 <div class="sub" style="text-align:center;margin:14px 10px 0;font-size:12.5px;line-height:1.45">Es una herramienta de apoyo personal. No reemplaza a un contador ni la declaración oficial ante la DIAN.</div>${end}${jump(112, 'up')}${tabs('Más')}`;

// 2. Tu situación: the kind of work is one row; its three answers, each with
//    what it means, open in a sheet. Dependents is a typed box.
const situation = open(SECTIONS.situation, rows(
  `<div class="row plain" style="padding:9px 0;gap:10px"><div class="tx"><span class="k">Tipo de trabajo</span><b>Salario integral</b><small style="white-space:normal">Desde 13 salarios mínimos. Cotizas sobre el 70% del salario (Ley 344 de 1996, art. 18). Tú pagas 4% y 4%.</small></div>${down()}</div>`,
  typed('Dependientes económicos', '2', { unit: 'personas', info: true })));
S['9c-situacion'] = `${head({ compact: 'pay' })}<main>${situation}${list('', '', 1, 4)}${end}${jump(112)}${tabs('Más')}`;
const kind = (i, c, t, d, on) => `<div class="row" style="align-items:flex-start">${ci(i, c, 38)}<div class="tx"><b>${t}</b><small style="white-space:normal">${d}</small></div>${on ? ic('checkmark', 'p', 'width:20px;height:20px;margin-top:8px') : '<span style="width:20px"></span>'}</div>`;
S['9d-tipo-de-trabajo'] = S['9c-situacion'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div><b style="display:block;text-align:center;font-size:17px;margin-bottom:12px">Tipo de trabajo</b>
 <div class="list">${kind('briefcase-outline', C.blu, 'Salario ordinario', 'Cotizas sobre todo tu salario. Tú pagas 4% de salud y 4% de pensión; tu empleador paga el resto.')}
 ${kind('ribbon-outline', C.pur, 'Salario integral', 'Desde 13 salarios mínimos. Cotizas sobre el 70% del salario (Ley 344 de 1996, art. 18). Tú pagas 4% y 4%.', true)}
 ${kind('laptop-outline', C.cya, 'Independiente', 'Por contrato o prestación de servicios. Cotizas sobre el 40% de lo que facturas (Ley 1955 de 2019, art. 244) y pagas todo: 12,5% de salud y 16% de pensión.')}</div></div>`;

// 3. Rentas de trabajo: the salary and the button that brings it from a
//    category; the non-salary part; the contributions worked out.
const labour = (notice = false) => open(SECTIONS.labour, rows(
  typed('Salario mensual bruto', '20.000.000'),
  `<div style="padding:2px 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${smallBtn('download-outline', 'Traer el salario de 2026')}${infoDot}</div>`,
  notice ? `<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;color:#c3cdfa;padding:0 0 8px">${ic('pricetag-outline', '', 'width:16px;height:16px;flex:none;margin-top:1px')}<span>Traído de Salario: 181.604.000 en 12 meses. Es lo que te llegó, el neto: corrígelo al bruto.</span></div>` : '',
  typed('De ese salario, pagos que no son salario', '10.000.000', { info: true }),
  typed('Meses trabajados en el año', '12', { unit: 'meses' }),
  typed('Otros ingresos laborales del año', '0'),
  worked('Total ingresos brutos de trabajo', '240.000.000', { box: 32, total: true }),
  noteLine('Aportes obligatorios a seguridad social. Se restan como ingresos no constitutivos de renta.'),
  worked('Base de cotización mensual (IBC)', '9.000.000', { info: true }),
  typed('% aporte a salud', '4', { unit: '%', info: true }),
  typed('% aporte a pensión', '4', { unit: '%', info: true }),
  worked('% de solidaridad aplicado', '1 %'),
  worked('Total aportes obligatorios', '9.720.000', { box: 33, total: true }),
  worked('Renta líquida de trabajo', '230.280.000', { box: 34, total: true })));
S['9e-rentas-de-trabajo'] = `${head({ compact: 'pay' })}<main>${labour()}${end}${jump(112)}${tabs('Más')}`;
S['9f-salario-ayuda'] = S['9e-rentas-de-trabajo'] + bubble(372, 206, 'Tú registras lo que te llega a la cuenta, que es el neto. Aquí va el bruto: úsalo solo como punto de partida y corrígelo.');
const salaryOpt = (i, c, n, v, sub) => `<div class="row">${sq(i, c, 40)}<div class="tx"><b>${n}</b><small>${sub}</small></div><b style="font-weight:500">${v}</b></div>`;
S['9g-salario-categoria'] = S['9e-rentas-de-trabajo'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div><b style="display:block;text-align:center;font-size:17px;margin-bottom:4px">¿En qué categoría registras tu salario?</b>
 <div class="sub" style="text-align:center;margin-bottom:12px">Ingresos de 2026 por categoría</div>
 <div class="list">${salaryOpt('briefcase-outline', C.grn, 'Salario', '181.604.000', '12 movimientos')}${salaryOpt('gift-outline', C.pnk, 'Bonificaciones', '18.000.000', '2 movimientos')}${salaryOpt('cash-outline', C.lim ?? C.grn, 'Otros ingresos', '2.450.000', '5 movimientos')}</div>
 <div class="btn ghost" style="margin-top:12px">Cerrar</div></div>`;
S['9h-salario-traido'] = `${head({ compact: 'pay', saved: 'saving' })}<main>${labour(true)}${end}${tabs('Más')}`;

// 4. Rentas de capital: the yields brought in (and undone), casilla 59 asked
//    two ways, the year's percentage with where it comes from.
const capital = ({ brought = false, typedMode = false } = {}) => open(SECTIONS.capital, rows(
  typed('Ingresos brutos por rentas de capital', brought ? '6.148.220' : '0', { box: 58 }),
  `<div style="padding:2px 0 8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${smallBtn('download-outline', 'Traer los rendimientos de 2026')}${brought ? smallBtn('arrow-undo-outline', 'Deshacer', 'x') : ''}${infoDot}</div>`,
  brought ? `<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;color:#c3cdfa;padding:0 0 8px">${ic('trending-up-outline', '', 'width:16px;height:16px;flex:none;margin-top:1px')}<span>Traje 6.148.220 de 2026, de ellos 5.702.000 estimados. Las cuentas de inversión no se incluyen: suma a mano lo que el fondo certifique.</span></div>` : '',
  `<div class="row plain" style="padding:9px 0;gap:10px"><div class="tx"><span class="k">Componente inflacionario <span class="boxno">Csl. 59</span></span></div></div>
   <div class="seg" style="margin-bottom:4px"><div class="${typedMode ? '' : 'on'}">Calcularlo</div><div class="${typedMode ? 'on' : ''}">Escribirlo del certificado</div></div>`,
  ...(typedMode ? [typed('Componente inflacionario certificado', '2.100.000', { info: true })]
    : [typed('De ellos, rendimientos financieros', '6.010.000'),
      typed('% componente inflacionario del año', '38,70', { unit: '%' }),
      `<div style="display:flex;gap:8px;align-items:center;padding:0 0 8px;font-size:12.8px"><span class="tag" style="background:${tint(C.yel, .18)};color:${C.yel}">Referencia 2025</span><span class="mu" style="flex:1">Se publica meses después del año</span>${infoDot}</div>`]),
  worked('Ingresos no constitutivos de renta', typedMode ? '2.100.000' : '2.326.110', { box: 59 }),
  typed('Costos y deducciones procedentes', '0', { box: 60 }),
  worked('Renta líquida de capital', typedMode ? '4.048.220' : '3.822.110', { box: 61, total: true }),
  typed('Rentas líquidas pasivas - ECE', '0', { box: 62, info: true })));
S['9i-rentas-de-capital'] = `${head({ compact: 'pay' })}<main>${capital()}${end}${jump(112)}${tabs('Más')}`;
S['9j-rendimientos-traidos'] = `${head({ compact: 'pay', saved: 'saving' })}<main>${capital({ brought: true })}${end}${tabs('Más')}`;
S['9k-rendimientos-ayuda'] = S['9i-rentas-de-capital'] + bubble(362, 252, 'Los rendimientos y el cashback van aquí, en rentas de capital, no en ganancias ocasionales. Lo que trae la app es aproximado: usa el certificado de cada banco. Las cuentas de inversión no se traen: suma a mano lo que el fondo certifique que hiciste efectivo en el año, y vuelve a sumarlo si traes los rendimientos otra vez.');
S['9l-componente-escrito'] = `${head({ compact: 'pay' })}<main>${capital({ brought: true, typedMode: true })}${end}${tabs('Más')}`;

// 5. Parámetros del año: where each comes from (Oficial, Referencia, Estimado)
//    and, loud, one taken from a later year; then the boxes themselves.
const standing = (t, c) => `<span class="tag" style="background:${tint(c, .18)};color:${c};white-space:nowrap">${t}</span>`;
const ref = (tag, label, v, src) => `<div class="row plain" style="padding:9px 0;gap:10px;align-items:flex-start">${tag}<div class="tx"><b style="white-space:normal;font-size:14.3px">${label}: ${v}</b><small style="white-space:normal">${src}</small></div></div>`;
S['9m-parametros'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.parameters, `
 <div class="sub" style="margin-top:10px;display:flex;gap:6px;align-items:center">De dónde salen los parámetros de este año ${infoDot}</div>
 ${rows(ref(standing('Oficial', C.grn), 'UVT', '52.374', 'Resolución DIAN 000238 del 15 de diciembre de 2025'),
    ref(standing('Oficial', C.grn), 'Salario mínimo', '1.750.905', 'Decreto de salario mínimo 2026'),
    ref(standing('Referencia 2025', C.yel), '% componente inflacionario', '38,70 %', 'El de 2026 se publica meses después del año; se usa el de 2025'))}
 <div class="h" style="margin-top:12px">Los valores</div>
 ${rows(typed('Valor de la UVT', '52.374'), typed('Salario mínimo mensual', '1.750.905'),
    typed('% renta exenta de trabajo', '25', { unit: '%', info: true }), typed('Tope renta exenta (UVT al año)', '790', { unit: 'UVT', info: true }),
    typed('Tope deducción por dependiente (UVT al mes)', '32', { unit: 'UVT', info: true }))}`)}${end}${jump(112)}${tabs('Más')}`;
S['9n-parametro-posterior'] = `${head({ year: 2025, compact: 'favour' })}<main>${open(SECTIONS.parameters, `
 <div class="banner" style="background:${tint(C.red, .14)};color:#ffb4b9;margin-top:10px">${ic('warning-outline')}<span>De este año falta el % componente inflacionario, y se está usando el de un año posterior, que no le corresponde. Escríbelo a mano abajo si lo conoces.</span></div>
 ${rows(ref(standing('Oficial', C.grn), 'UVT', '49.799', 'Resolución DIAN 000193 de 2024'),
    ref(standing('De 2026, posterior', C.red), '% componente inflacionario', '38,70 %', 'Tomado de 2026 a falta del de 2025'))}`)}${end}${jump(112)}${tabs('Más')}`;

// 6. The year with no UVT: said where the verdict is, and one tap takes you
//    to the box.
S['9o-falta-uvt'] = `${head({ year: 2027 })}<main>${verdict('even')}
 <div class="banner" style="background:${tint(C.yel, .14)};color:#f5dfa0;margin-top:10px">${ic('alert-circle-outline')}<span style="flex:1">Falta la UVT de 2027. Sin ella ningún tope se puede calcular: escríbela en Parámetros del año.</span></div>
 <div style="text-align:right;margin-top:8px">${smallBtn('options-outline', 'Ir a Parámetros del año')}</div>
 ${legend}${allBar(true)}${list('', '', 0, 4).replace('UVT 52.374 · 1 parámetro de referencia 2025', '<span class="y">Falta la UVT de 2027</span>')}${end}${tabs('Más')}`;

// 7. Deductions with their cap, and the tax with the rate table - the band
//    this return falls in lit.
S['9p-deducciones'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.capped, rows(
  typed('Aportes voluntarios AFC, FVP o AVC por nómina', '0', { info: true }),
  typed('Aportes voluntarios propios', '0', { info: true }),
  worked('Total aportes voluntarios', '0', { box: 35 }),
  typed('Intereses de vivienda o ICETEX', '0', { box: 38 }),
  worked('Renta exenta de trabajo', '41.375.460', { box: 36, info: true }),
  worked('Deducción por dependiente', '20.111.616', { box: 39, info: true }),
  typed('Pagos de medicina prepagada o pólizas de salud', '6.000.000', { info: true }),
  worked('Deducción por salud', '6.000.000', { box: 39, info: true }),
  typed('Otras deducciones', '0', { box: 39 }),
  worked('Subtotal sin aplicar el límite', '67.487.076'),
  worked('Límite aplicable', '70.181.160', { info: true }),
  worked('Rentas exentas y deducciones limitadas', '67.487.076', { box: 41, total: true })))}${end}${jump(112)}${tabs('Más')}`;
const band = (from, rate, on) => `<div style="display:flex;justify-content:space-between;padding:7px 10px;border-radius:10px;font-size:13.5px;${on ? `background:${tint(C.org, .18)};color:#ffd2ad;font-weight:600` : ''}"><span>Desde ${from} UVT</span><span>${rate}</span></div>`;
S['9q-impuesto'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.tax, rows(
  worked('Renta líquida ordinaria', '158.953.178', { box: 93, total: true }),
  worked('Renta líquida gravable en UVT', '3.035 UVT'),
  `<div style="margin:8px 0"><span class="lab">Tabla de tarifas · art. 241 E.T.</span><div style="margin-top:6px;background:var(--s2);border-radius:14px;padding:4px">${[['0', '0%'], ['1.090', '19%'], ['1.700', '28%'], ['4.100', '33%', true], ['8.670', '35%'], ['18.970', '37%'], ['31.000', '39%']].map(([f, r, o]) => band(f, r, o)).join('')}</div></div>`,
  typed('Impuesto de ganancias ocasionales', '0', { box: 127, info: true }),
  worked('Impuesto neto de renta', '53.974.000', { box: 126, total: true })))}${end}${jump(112)}${tabs('Más')}`;

// 8. Withholding: the twelve months, typed; up to four other concepts.
const month = (m, v) => `<div style="background:${tint(GOLD, .1)};border:1.5px solid ${tint(GOLD, .7)};border-radius:12px;padding:6px 10px"><div class="mu" style="font-size:11.5px">${m}</div><b style="font-size:14.5px">${v}</b></div>`;
const extra = (c, v) => `<div style="display:flex;gap:8px;margin-top:6px"><div style="flex:1;min-width:0;background:${tint(GOLD, .1)};border:1.5px solid ${tint(GOLD, .7)};border-radius:12px;padding:8px 10px;font-size:14px;${c ? '' : 'color:var(--mu)'}">${c || 'Concepto'}</div><div style="width:120px;background:${tint(GOLD, .1)};border:1.5px solid ${tint(GOLD, .7)};border-radius:12px;padding:8px 10px;text-align:right;font-weight:600;font-size:14px">${v}</div></div>`;
S['9r-retenciones'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.withholding, `
 ${noteLine('Retención practicada en la nómina, mes a mes.')}
 <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px">${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map(m => month(m, '4.050.000')).join('')}</div>
 ${rows(worked('Subtotal retención de nómina', '48.600.000'))}
 ${noteLine('Retenciones por otros conceptos: rendimientos financieros, honorarios, venta de activos.')}
 ${extra('Rendimientos financieros', '562.000')}${extra('', '0')}
 ${rows(worked('Subtotal retenciones adicionales', '562.000'), worked('Total retenciones del año', '49.162.000', { box: 132, total: true }),
    typed('Saldo a favor del año anterior', '0', { box: 131, info: true }), typed('Anticipo de renta del año anterior', '0', { box: 130 }))}`)}${end}${jump(112)}${tabs('Más')}`;

// 9. The end of the return: what is owed, how to plan for it, and the
//    voluntary contribution that would lower it.
S['9s-liquidacion'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.settle, rows(
  worked('Total impuesto a cargo', '53.974.000', { box: 129 }),
  worked('Retenciones, anticipos y saldo a favor', '49.162.000'),
  worked('Saldo a pagar', '4.812.000', { box: 134, total: true, cls: 'red' }),
  worked('Saldo a favor', '0', { box: 137, total: true })))}
 ${open(SECTIONS.planning, rows(
  worked('Ingreso bruto mensual promedio', '20.000.000'), worked('Aportes obligatorios al mes', '810.000'),
  worked('Aporte voluntario al mes', '0'), worked('Retención en la fuente al mes', '4.050.000'),
  worked('Salario neto mensual promedio', '15.140.000', { total: true }),
  worked('Ahorro mensual para el saldo a pagar', '401.000', { total: true, info: true })))}${end}${jump(112)}${tabs('Más')}`;
S['9t-aporte-voluntario'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.voluntary, rows(
  worked('Espacio libre dentro del límite', '2.694.084', { info: true }),
  worked('Tope del aporte voluntario', '73.800.000', { info: true }),
  worked('Aporte voluntario recomendado', '2.694.084', { total: true }),
  worked('Lo que falta por trasladar', '2.694.084'),
  worked('Lo que falta, repartido al mes', '224.507')))}${list('', '', 14)}${end}${jump(112)}${tabs('Más')}`;

// 10. Notes and sources: each note whole, each source a link.
const nt = t => `<div style="display:flex;gap:10px;padding:8px 0;font-size:13.5px;line-height:1.42"><span style="width:6px;height:6px;border-radius:50%;background:var(--mu);flex:none;margin-top:7px"></span><span>${t}</span></div>`;
const src = t => `<div class="row plain" style="padding:9px 0;gap:10px">${ic('open-outline', 'p', 'width:17px;height:17px;flex:none')}<div class="tx"><b style="white-space:normal;font-size:13.8px;font-weight:400">${t}</b></div></div>`;
S['9u-notas'] = `${head({ compact: 'pay' })}<main>${open(SECTIONS.notes, `<div style="margin-top:6px">
 ${nt('El IBC depende del tipo de contrato: todo el salario si es ordinario, 70% si es integral y 40% si eres independiente.')}
 ${nt('La deducción por dependientes y la del 1% por factura electrónica no compiten por el límite del 40% o 1.340 UVT (art. 336 num. 3 y 5 E.T.).')}
 ${nt('Cubre la cédula general. No incluye las cédulas de pensiones ni de dividendos.')}
 ${nt('Nada de esto está confirmado con un contador todavía.')}
 <div class="sub" style="margin:4px 0 0">y 5 notas más</div></div>
 <div class="h" style="margin-top:12px">10 fuentes</div>
 ${src('DIAN - Formulario 210, año gravable 2025')}${src('Siempre al Día - Ingresos en el formulario 210: casillas y cédulas')}${src('Actualícese - Quiénes usan las casillas 43 a 57 del formulario 210')}`)}${end}${jump(112, 'up')}${tabs('Más')}`;

// 11. The spreadsheet: the (i) of the download button, the file being
//     written, and the short notice once it is saved.
const plain = `${head()}<main>${verdict('pay')}${legend}${allBar(true)}${list('', '', 0, 6)}${end}${tabs('Más')}`;
S['9v-excel-ayuda'] = plain + bubble(118, 338, 'Descarga un archivo como tu simulador de Excel: lo amarillo lo escribes tú y lo demás se recalcula solo. Se llama simulador-renta-2026.xlsx.');
S['9w-excel-escribiendo'] = plain + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('grid-outline', C.grn, 54))}<b style="font-size:18px">Escribiendo la hoja de cálculo</b>
 <div class="pbar" style="margin-top:14px;height:8px"><i style="width:55%;background:var(--pr)"></i></div></div>`;
S['9x-excel-guardado'] = plain + toast('Se guardó simulador-renta-2026.xlsx');

// 12. The other two verdicts: money back, and nothing either way.
S['9y-a-favor'] = `${head({ year: 2025 })}<main>${verdict('favour')}${legend}${allBar(true)}${list('', '', 0, 6).replace('Csl. 134 · a pagar 4.812.000', 'Csl. 137 · a favor 1.268.400')}${end}${jump(112, 'down')}${tabs('Más')}`;

export default S;
