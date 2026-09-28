// Group 5 (v4, 2026-09-28): the report, money and yields. What the report
// screen does today (features/report, rule 20): the Movimientos /
// Rendimientos switch; the account and the period shared with Inicio; each
// section in its order, folding, with the line that says what it shows; the
// five kinds of block (figures, ranked with bars and ring, comparison,
// trend with tappable bars and a paler estimated part, notes); huge changes
// drawn "x43"; and the spreadsheet. Drawn with the rules of groups 1-4:
// sections separated (only one open at a time, each closed one showing its
// key figure), the "about" line as an (i) that opens a bubble, icons on
// every account and category, long names on one line.
import { ic, ci, sq, C, CAT, ACC, PALETTE, catIcon, accIcon, chev, down, sw, tabs, status, tint } from './lib.mjs';

const S = {};
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const infoDot = `<span style="display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--s3);color:#aab6d3;flex:none">${ic('information', '', 'width:13px;height:13px')}</span>`;

// The Reporte tab: its title and the spreadsheet; the switch; the same two
// pickers as Inicio (the account, the period with its arrows).
const head = which => `<div class="bar-top">${st}<div class="tt" style="gap:10px"><h1 style="flex:1">Reporte</h1>
  <div class="btn-r">${ic('download-outline')}</div></div>
 <div class="seg" style="margin-top:10px"><div class="${which === 'm' ? 'on' : ''}">${ic('swap-vertical-outline')}Movimientos</div><div class="${which === 'y' ? 'on' : ''}">${ic('trending-up-outline')}Rendimientos</div></div>
 <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
  <span class="chip" style="flex:1;min-width:0;padding:6px 10px">${which === 'm' ? ci('layers-outline', C.blu, 24) : ci('trending-up-outline', C.grn, 24)}<span class="one">${which === 'm' ? 'Todas las cuentas' : 'Todas las cuentas que rinden'}</span>${down()}</span>
  <span class="chip" style="padding:6px 6px">${ic('chevron-back-outline', '', 'width:17px;height:17px')}<b style="font-weight:500">Septiembre 2026</b>${ic('chevron-forward-outline', '', 'width:17px;height:17px')}</span></div></div>`;

// A section: one row when closed, with the figure worth seeing at a glance;
// open, its content under the same header. The (i) says what it shows.
const closed = (icon, title, peek, cls = '') => `<div class="row" style="background:var(--s1);border:1px solid #17223b;border-radius:18px;margin-top:8px">${icon}<div class="tx"><b class="one">${title}</b></div><span class="${cls}" style="font-weight:500;font-size:14px;white-space:nowrap">${peek}</span>${ic('chevron-forward-outline', 'mu', 'width:18px;height:18px')}</div>`;
const open = (icon, title, body) => `<div class="card" style="margin-top:8px;padding:12px 14px"><div style="display:flex;align-items:center;gap:10px">${icon}<b style="flex:1;font-size:16px" class="one">${title}</b>${infoDot}${ic('chevron-down-outline', 'mu', 'width:18px;height:18px')}</div>${body}</div>`;
const sIcon = (i, c) => ci(i, c, 34);
const fig = (lab, v, cls = '', note = '') => `<div style="background:var(--s2);border-radius:14px;padding:10px 12px;min-width:0"><div class="lab" style="font-size:10.5px">${lab}</div><b class="${cls} one" style="display:block;font-size:17px;margin-top:3px">${v}</b>${note ? `<div class="sub one" style="font-size:12px">${note}</div>` : ''}</div>`;
const grid = items => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">${items.join('')}</div>`;
const partial = `<div class="sub" style="margin:10px 4px 0;display:flex;gap:6px;align-items:center">${ic('time-outline', '', 'width:15px;height:15px')}Van 27 de 30 días del periodo</div>`;

// Every money section, closed, with its peek - in the report's own order.
const MONEY = {
  headline: [sIcon('stats-chart-outline', C.blu), 'En este periodo', 'Ahorrado 38 %', 'g'],
  versus: [sIcon('git-compare-outline', C.pur), 'Comparado con antes', 'Gastos −6 %', 'g'],
  jump: [sIcon('flash-outline', C.yel), 'Lo que cambió', '2 categorías', ''],
  categories: [sIcon('pie-chart-outline', C.org), 'En qué se fue', 'Vivienda 27 %', ''],
  catVersus: [sIcon('swap-vertical-outline', C.cya), 'Categorías, antes y ahora', '16', ''],
  recurring: [sIcon('repeat-outline', C.tea), 'Gastos que se repiten', '2,1 M al mes', ''],
  repeated: [sIcon('receipt-outline', C.pnk), 'Cobros que se repiten cada mes', '6', ''],
  byMonth: [sIcon('bar-chart-outline', C.grn), 'Gasto mes a mes', 'Prom. 5,4 M', ''],
  accounts: [sIcon('wallet-outline', C.blu), 'Por cuenta', 'Tarjeta Coral 61 %', ''],
  biggest: [sIcon('arrow-up-outline', C.red), 'Los movimientos más grandes', '1,4 M', 'r'],
};
const moneyList = (openKey, body) => Object.entries(MONEY).map(([k, [i, t, p, c]]) => k === openKey ? open(i, t, body) : closed(i, t, p, c)).join('');
const page = (which, content) => `${head(which)}<main>${partial}${content}<div style="height:110px"></div></main><div class="fade"></div>${tabs('Reporte')}`;
const scrolledPage = (which, by, content) => `<div style="position:absolute;left:0;right:0;top:188px;bottom:0;overflow:hidden"><main style="margin-top:-${by}px">${partial}${content}<div style="height:110px"></div></main></div><div style="position:absolute;left:0;right:0;top:0">${head(which)}</div><div class="fade"></div>${tabs('Reporte')}`;

// 1. As it opens: the headline open, everything else closed with its peek.
S['5a-reporte-movimientos'] = page('m', moneyList('headline', grid([
  fig('Ingresos', '8.450.000,00', 'g'), fig('Gastos', '5.236.418,00', 'r'),
  fig('Balance', '+3.213.582,00', 'g'), fig('Del ingreso te quedó', '38 %', '', 'ingresos menos gastos'),
  fig('Gasto promedio por día', '193.941,41', '', 'sobre 27 días'), fig('Movimientos', '58'),
  fig('Gasto más grande', '1.400.000,00', '', 'Arriendo · Vivienda'), fig('Dónde más gastaste', 'Vivienda', '', '27 % del gasto')])
  + `<div class="sub" style="margin-top:10px">Movido entre tus cuentas: 3.400.000,00 · no cuenta como gasto</div>`));

// 2. Against the period before, on the same days; a huge change reads "x43".
const cmp = (icon, t, a, b, ch, cls, note = '') => `<div class="row" style="padding:9px 0">${icon}<div class="tx"><b class="one">${t}</b><small class="one">${a} → ${b}${note ? ` · ${note}` : ''}</small></div><span class="${cls}" style="font-weight:700;white-space:nowrap">${ch}</span></div>`;
S['5b-comparado-con-antes'] = page('m', moneyList('versus', `<div class="sub" style="margin-top:8px">Los mismos 27 días de cada periodo, para que la comparación sea justa.</div>
 <div style="margin-top:4px">${cmp(sq('arrow-down', C.grn, 34), 'Ingresos', '8.100.000', '8.450.000', '+4 %', 'g')}
 ${cmp(sq('arrow-up', C.red, 34), 'Gastos', '5.580.210', '5.236.418', '−6 %', 'g')}
 ${cmp(catIcon('ocio', 34), 'Entretenimiento', '12.000', '516.000', 'x43', 'r')}
 ${cmp(catIcon('transp', 34), 'Transporte', '402.300', '318.100', '−21 %', 'g')}</div>`));

// 3. Where the money went: the ring and the ranked list, with icons.
const bar = (k, t, amt, pct, w) => `<div style="display:flex;align-items:center;gap:10px;margin-top:10px">${catIcon(k, 32)}<div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><b class="one" style="flex:1;font-weight:500;font-size:14.5px">${t}</b><span style="font-size:14px;white-space:nowrap">${amt}</span></div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:5px"><div class="pbar" style="flex:1;height:6px"><i style="width:${w}%;background:${CAT[k][1]}"></i></div><span class="mu" style="font-size:12px;width:34px;text-align:right">${pct}</span></div></div></div>`;
S['5c-en-que-se-fue'] = page('m', moneyList('categories', `${bar('vivienda', 'Vivienda y arriendo del apartamento', '1.400.000', '27 %', 100)}${bar('mercado', 'Mercado', '890.200', '17 %', 64)}${bar('rest', 'Restaurantes', '785.400', '15 %', 56)}${bar('transp', 'Transporte', '523.600', '10 %', 37)}${bar('servicios', 'Servicios', '418.900', '8 %', 30)}
 <div class="p" style="margin-top:12px;font-size:14px">Ver las 11 restantes</div>`));

// 4. What changed, in words; charges that repeat, ranked.
const noteLine = (t, amber = false) => `<div style="display:flex;gap:9px;margin-top:10px;font-size:14px;line-height:1.4;${amber ? 'color:#f3d58a' : ''}">${ic(amber ? 'alert-circle-outline' : 'ellipse', '', `width:${amber ? 17 : 7}px;height:${amber ? 17 : 7}px;flex:none;margin-top:${amber ? 1 : 7}px`)}<span>${t}</span></div>`;
S['5d-lo-que-cambio'] = page('m', moneyList('jump', `${noteLine('Entretenimiento subió x43. Lo más grande ahí: Concierto en el estadio (480.000).')}${noteLine('En Ropa no gastaste nada este periodo.')}`));

S['5e-cobros-que-se-repiten'] = scrolledPage('m', 330, moneyList('repeated', ['Plan de celular|45.900|servicios', 'Plataforma de música|16.900|ocio', 'Gimnasio|89.000|salud', 'Seguro del carro|212.400|transp']
  .map(r => { const [t, a, k] = r.split('|'); return `<div class="row" style="padding:8px 0">${catIcon(k, 32)}<div class="tx"><b class="one">${t}</b><small>${a} cada vez · en 9 de 9 meses</small></div></div>`; }).join('')
  + `<div class="row" style="padding:8px 0;border-top:1px solid var(--line)"><div class="tx"><b>Suma por mes</b></div><b>364.200</b></div>`));

// 5. Month by month: bars, the average, the tapped bar with its value; the
//    month in course is paler and not in the average.
const bars = (vals, max, pick, colour, avg, parts = []) => `<div style="display:flex;align-items:flex-end;gap:6px;height:130px;margin-top:14px;position:relative">
  ${avg ? `<div style="position:absolute;left:0;right:0;bottom:${avg}px;border-top:1px dashed #6b7a9c"></div>` : ''}
  ${vals.map(([m, v], n) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px"><div style="width:100%;height:${Math.round(v / max * 110)}px;border-radius:6px 6px 3px 3px;background:${n === pick ? colour : tint(colour, n === vals.length - 1 ? .25 : .55)};position:relative;overflow:hidden">${parts[n] ? `<i style="position:absolute;left:0;right:0;bottom:0;height:${parts[n]}%;background:rgba(255,255,255,.28)"></i>` : ''}</div><span class="mu" style="font-size:10.5px">${m}</span></div>`).join('')}</div>`;
const MONTHS = [['oct', 5.1], ['nov', 5.9], ['dic', 7.8], ['ene', 4.6], ['feb', 4.9], ['mar', 5.2], ['abr', 5.0], ['may', 5.6], ['jun', 5.3], ['jul', 6.1], ['ago', 5.4], ['sep', 5.2]];
S['5f-gasto-mes-a-mes'] = scrolledPage('m', 460, moneyList('byMonth', `${bars(MONTHS, 7.8, 9, C.grn, 76)}
 <div class="card" style="margin-top:10px;padding:10px 12px;background:var(--s2);display:flex;justify-content:space-between"><span>Julio 2026</span><b>6.104.300,00</b></div>
 <div class="sub" style="margin-top:8px">Promedio mensual 5.536.000 · por encima: diciembre, julio, noviembre.</div>`));

// 6. The (i) of a section, opened.
S['5g-seccion-ayuda'] = S['5c-en-que-se-fue'] + `<div style="position:absolute;left:24px;right:24px;top:392px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;right:44px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>En qué categorías se fue el gasto del periodo y qué parte del total es cada una.</div>`;

// 7. The account and the period, the same sheets as Inicio.
S['5h-elegir-periodo'] = S['5a-reporte-movimientos'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <h2 style="text-align:center;font-size:19px;margin-bottom:12px">Periodo</h2>
 <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${['Día', 'Semana', 'Mes', 'Trimestre', 'Año', 'Todo', 'Entre dos fechas'].map(t => `<div class="chip ${t === 'Mes' ? 'on' : ''}" style="justify-content:center;${t === 'Entre dos fechas' ? 'grid-column:span 2' : ''}">${t}</div>`).join('')}</div>
 <div class="list" style="margin-top:12px"><div class="row"><div class="tx"><b>Incluir lo apartado del patrimonio</b><small>1 cuenta y 1 producto que no cuentan para el patrimonio</small></div>${sw(false)}</div></div>
 <div class="btn" style="margin-top:14px">Aplicar</div></div>`;

// 8. The spreadsheet, being made.
S['5i-exportando'] = S['5a-reporte-movimientos'] + `<div class="scrim"></div><div class="dialog" style="text-align:center">
 ${centred(ci('document-text-outline', C.grn, 56))}<b style="font-size:18px">Armando el resumen…</b>
 <div class="sub" style="margin-top:6px">resumen-financiero-septiembre-2026.xlsx</div>
 <div class="pbar" style="margin-top:14px;height:8px"><i style="width:64%;background:var(--pr)"></i></div></div>`;

// ------------------------------------------------------------- yields
const YIELDS = {
  headline: [sIcon('stats-chart-outline', C.grn), 'El periodo en cifras', '+381.004', 'g'],
  inflation: [sIcon('flame-outline', C.org), 'Frente a la inflación', 'Real +2,1 %', 'g'],
  notes: [sIcon('bulb-outline', C.yel), 'Vale la pena saber', '4 notas', ''],
  growth: [sIcon('trending-up-outline', C.cya), 'Tu saldo frente al cierre de agosto', '+1,9 %', 'g'],
  soFar: [sIcon('bar-chart-outline', C.grn), 'Rendimientos acumulados en 2026', '3,1 M', ''],
  best: [sIcon('trophy-outline', C.gold), 'Qué cuenta rindió más', 'Ahorro Verde', ''],
  byMonth: [sIcon('calendar-outline', C.pur), 'Rendimientos de cada mes', 'Prom. 352 mil', ''],
  versus: [sIcon('git-compare-outline', C.blu), 'Contra el periodo anterior', '+8 %', 'g'],
};
const yieldList = (openKey, body) => Object.entries(YIELDS).map(([k, [i, t, p, c]]) => k === openKey ? open(i, t, body) : closed(i, t, p, c)).join('');

S['5j-reporte-rendimientos'] = page('y', yieldList('headline', grid([
  fig('Rendimiento neto', '+381.004,10', 'g', 'incluye 52.180 estimado'), fig('De eso, estimado', '52.180,40', 'y', 'días antes de que la app calculara'),
  fig('Promedio por día', '14.111,26', '', 'en 27 días'), fig('Rentabilidad efectiva anual', '9,02 % E.A.', '', 'ya descontada la retención'),
  fig('Retención en la fuente', '−26.401,77', 'r', '7 % de los días sobre 0,055 UVT'), fig('Ganancia de inversiones', '+48.200,00', 'g', 'lo que registraste')])));

S['5k-frente-a-la-inflacion'] = page('y', yieldList('inflation', grid([
  fig('Rentabilidad real', '+2,13 %', 'g', 'al año, por encima de la inflación'), fig('Inflación del año', '5,77 %', '', 'promedio DANE, ene a ago'),
  fig('Lo que se llevó la inflación', '−243.110,00', 'r', 'sobre 56,1 M rindiendo'), fig('Ganancia real', '+137.894,10', 'g', 'incluye 52.180 estimado')])));

S['5l-vale-la-pena-saber'] = page('y', yieldList('notes', `${noteLine('A este ritmo el mes cerraría en 423.300. Es una proyección, no un hecho.')}${noteLine('Todavía te deben 12.453, que el banco paga el 28 sept.')}${noteLine('La mejor tasa hoy es la de Bolsillo Viajes: 11,00 % E.A.')}${noteLine('52.180 de estos rendimientos son un estimado: Ahorro Verde empezó a calcularse en la app el 10 sept. Para los días antes se usó la tasa de sus primeros días.', true)}`));

S['5m-crecimiento'] = scrolledPage('y', 150, yieldList('growth', `${bars([['ago', 60.2], ['sep', 61.4]], 62, 1, C.cya, 0)}
 <div class="sub" style="margin-top:8px">Medido desde el cierre de agosto, no desde cero. Desde entonces el dinero rindiendo pasó de 60,2 M a 61,4 M (+1,9 %); 381.004 de eso fueron rendimientos.</div>`));

S['5n-rendimientos-acumulados'] = scrolledPage('y', 205, yieldList('soFar', `${bars([['ene', .3], ['feb', .6], ['mar', .9], ['abr', 1.2], ['may', 1.5], ['jun', 1.8], ['jul', 2.1], ['ago', 2.7], ['sep', 3.1]], 3.1, 7, C.grn, 0, [100, 100, 100, 100, 100, 100, 100, 82, 18])}
 <div class="card" style="margin-top:10px;padding:10px 12px;background:var(--s2)"><div style="display:flex;justify-content:space-between"><span>Agosto 2026</span><b>2.703.400,00</b></div><div class="sub" style="font-size:12px">De eso, estimado: 2.216.800,00 · la parte clara de la barra</div></div>`));

const rank = (icon, t, s2, amt, w, c) => `<div style="display:flex;align-items:center;gap:10px;margin-top:10px">${icon}<div style="flex:1;min-width:0"><div style="display:flex;gap:8px"><b class="one" style="flex:1;font-weight:500;font-size:14.5px">${t}</b><span class="g" style="font-size:14px;white-space:nowrap">${amt}</span></div><div class="sub one" style="font-size:12px">${s2}</div>
  <div class="pbar" style="height:6px;margin-top:5px"><i style="width:${w}%;background:${c}"></i></div></div></div>`;
S['5o-que-rindio-mas'] = scrolledPage('y', 260, yieldList('best', `<div class="seg" style="margin-top:10px"><div class="on">Por cuenta</div><div>Por producto</div></div>
 ${rank(accIcon('verde', 32), 'Ahorro Verde', 'hoy al 9,25 % E.A.', '+342.118', 100, C.grn)}${rank(accIcon('naranja', 32), 'Cajita Naranja', 'hoy al 8,25 % E.A.', '+31.240', 9, C.org)}${rank(accIcon('ambar', 32), 'Fiducia Ámbar', 'inversión · 7,4 % E.A. en el periodo', '+48.200', 14, C.gold)}${rank(accIcon('dolar', 32), 'Cuenta Dólar', 'hoy al 4,00 % E.A.', '+0,31 USD', 2, C.cya)}`));

S['5p-contra-el-periodo-anterior'] = scrolledPage('y', 420, yieldList('versus', `<div class="sub" style="margin-top:8px">Se comparan los mismos días en los dos periodos. Parte de estas cifras es estimada.</div>
 ${cmp(accIcon('verde', 34), 'Ahorro Verde', '316.940', '342.118', '+8 %', 'g', 'saldo promedio 52,1 M → 55,2 M')}
 ${cmp(accIcon('dolar', 34), 'Cuenta Dólar', '0,05 USD', '0,31 USD', 'x6', 'g', 'saldo promedio 14 → 87 USD')}`));

export default S;
