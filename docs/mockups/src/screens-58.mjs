// Group 58 - the app held sideways (Jose, 2026-11-18, after a video of Lukas
// turning his phone; proposal for his word, nothing built). Today the app is
// one column stretched across the width. Proposed: with the phone sideways
// (or on a tablet) every screen spreads into columns - what sums the screen
// up on the left, a chart in the middle, the list on the right - and a list
// opens what was tapped BESIDE it instead of over it. The floating bar
// becomes a rail on the left: the height is what is short sideways. Every
// name and figure invented. Drawn at 915 x 412, a phone of 412 held sideways.
import { ic, C, tint, ci, sq, catIcon, accIcon, donut, CAT } from './lib.mjs';

const S = {};
const B = C.blu, G = C.grn, Y = C.yel, R = C.red, MV = '#4cb8f5';

// What changes for every landscape screen: the page size, the rail, the
// header row, and the columns.
const LCSS = `<style>
body{width:915px;height:466px;font-size:14px;background:#03060d}
.land{position:absolute;left:0;top:0;width:915px;height:412px;display:flex;background:var(--bg);overflow:hidden}
.scrim{bottom:auto!important;height:412px}
.rail{width:76px;background:#0b1324;border-right:1px solid #17223b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px 0;flex:none}
.rail div{width:62px;display:flex;flex-direction:column;align-items:center;gap:2px;color:#7f8ba5;font-size:10.5px;padding:6px 0;border-radius:16px;position:relative}
.rail div .ic{width:21px;height:21px}.rail .on{background:${tint(B, .2)};color:var(--pr);font-weight:500}
.rail .plus{width:48px;height:48px;padding:0;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;display:grid;place-items:center;margin:4px 0;box-shadow:0 6px 18px ${tint(B, .45)}}
.rail .plus .ic{width:26px;height:26px}
.rail .dot{position:absolute;top:4px;right:16px;width:8px;height:8px;border-radius:50%;background:var(--red);border:2px solid #0b1324}
.pane{flex:1;min-width:0;display:flex;flex-direction:column}
.lhead{display:flex;align-items:center;gap:10px;padding:8px 14px 0;height:50px;flex:none}
.lhead h1{font-size:18px;font-weight:700;white-space:nowrap}
.cols{flex:1;min-height:0;display:flex;gap:12px;padding:10px 14px 12px}
.col{display:flex;flex-direction:column;gap:10px;min-width:0;min-height:0;overflow:hidden}
.mchip{display:inline-flex;align-items:center;gap:7px;padding:5px 10px 5px 5px;border-radius:20px;background:var(--s1);border:1px solid #1f2c47;font-size:13.5px;font-weight:500;white-space:nowrap}
.mchip .ci,.mchip .sq{width:26px!important;height:26px!important}
.per{display:inline-flex;align-items:center;gap:4px;background:var(--s1);border:1px solid #1f2c47;border-radius:20px;padding:2px;white-space:nowrap}
.per span.a{width:30px;height:30px;border-radius:50%;background:var(--s2);display:grid;place-items:center}
.per span.a .ic{width:17px;height:17px;color:#c9d2e6}
.per b{color:var(--pr);font-weight:500;font-size:13.5px;padding:0 6px;display:flex;align-items:center;gap:5px}
.rb{width:36px;height:36px;border-radius:50%;background:var(--s1);display:grid;place-items:center;color:#d7deea;flex:none;border:1px solid #1a2643}
.rb .ic{width:19px;height:19px}.rb.acc{background:${tint(B, .2)};color:var(--pr);border-color:${tint(B, .35)}}
.ct{font-size:11px;letter-spacing:1px;color:var(--mu);font-weight:500;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;gap:8px}
.ct .p{letter-spacing:0;text-transform:none;font-size:12.5px;font-weight:500}
.lrow{display:flex;align-items:center;gap:10px;padding:7px 10px;position:relative}
.lrow+.lrow:before{content:'';position:absolute;top:0;left:52px;right:0;height:1px;background:var(--line)}
.lrow .tx b{font-size:14px}.lrow .tx small{font-size:12px;margin-top:1px}
.lrow .am{font-size:14px}
.lrow.sel{background:${tint(B, .16)};box-shadow:inset 3px 0 0 var(--pr)}
.day{font-size:11.5px;color:var(--mu);font-weight:500;padding:7px 10px 3px;display:flex;justify-content:space-between}
.scrollfade{position:absolute;left:0;right:0;bottom:0;height:34px;background:linear-gradient(transparent,var(--s1));pointer-events:none}
.tile{background:var(--s1);border:1px solid #17223b;border-radius:16px;padding:10px 12px;min-width:0}
.tile .lab{font-size:10.5px}.tile b{display:block;font-size:18px;margin-top:3px;white-space:nowrap}.tile small{font-size:11.5px;color:var(--mu)}
.leg{display:flex;align-items:center;gap:8px;font-size:12.8px;padding:3px 0}
.leg i{width:9px;height:9px;border-radius:3px;flex:none}.leg .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leg b{font-weight:500}
.hbar{height:6px;border-radius:3px;background:var(--s3);overflow:hidden;margin-top:4px}.hbar i{display:block;height:100%;border-radius:3px}
.fold{display:flex;align-items:center;gap:10px;background:var(--s1);border:1px solid #17223b;border-radius:14px;padding:9px 12px}
.fold .tx b{font-size:13.8px}.fold .tx small{font-size:12px}
.panelx{background:#0f192c;border:1px solid #26365a;border-radius:20px;box-shadow:-10px 0 30px rgba(0,0,0,.35)}
.kb{position:absolute;left:0;right:0;top:206px;height:206px;background:#1b1f27;border-top:1px solid #2a2f3a;padding:8px 10px;display:grid;grid-template-columns:repeat(10,1fr);gap:6px}
.kb div{background:#3a3f4b;border-radius:7px;display:grid;place-items:center;color:#e8eaee;font-size:17px}
.kb .w{background:#2c313b}
.say{position:absolute;left:0;right:0;top:412px;height:54px;background:#03060d;color:#f3dca4;padding:0 18px;font-size:13.5px;line-height:1.35;display:flex;align-items:center;gap:8px}
</style>`;

const RAIL = [['home-outline', 'Inicio'], ['wallet-outline', 'Cuentas'], ['+'], ['stats-chart-outline', 'Reporte'], ['grid-outline', 'Más']];
const rail = (on, dot = false) => `<div class="rail">${RAIL.map(([i, l]) => i === '+'
  ? `<div class="plus">${ic('add')}</div>`
  : `<div class="${l === on ? 'on' : ''}">${ic(i)}${l}${dot && l === 'Más' ? '<span class="dot"></span>' : ''}</div>`).join('')}</div>`;
const per = label => `<span class="per"><span class="a">${ic('chevron-back-outline')}</span><b>${ic('calendar-outline', '', 'width:15px;height:15px')}${label}</b><span class="a">${ic('chevron-forward-outline')}</span></span>`;
const rb = (i, acc = false) => `<span class="rb ${acc ? 'acc' : ''}">${ic(i)}</span>`;
const ask = rb('sparkles-outline', true);
// Columns, then anything drawn over them (a sheet, the note); true lights Más's dot.
const land = (on, head, ...rest) => {
  const isCol = x => typeof x === 'string' && x.startsWith('<div class="col"');
  const cols = rest.filter(isCol).join(''), extra = rest.filter(x => typeof x === 'string' && !isCol(x)).join('');
  return `${LCSS}<div class="land">${rail(on, rest.includes(true))}<div class="pane"><div class="lhead">${head}</div><div class="cols">${cols}</div></div></div>${extra}`;
};
const col = (w, inner, style = '') => `<div class="col" style="${w ? `width:${w}px;flex:none` : 'flex:1'};${style}">${inner}</div>`;
const card = (inner, style = '') => `<div class="card" style="padding:12px 14px;${style}">${inner}</div>`;
const say = (t, style = '') => `<div class="say" style="${style}">${ic('bulb-outline', '', 'width:18px;height:18px')}<span>${t}</span></div>`;
const mov = (icon, t, s, a, cls, sel = false) => `<div class="lrow ${sel ? 'sel' : ''}">${icon}<div class="tx"><b class="one">${t}</b><small class="one">${s}</small></div><div class="am ${cls}">${a}</div></div>`;
const cat = (k, s = 32) => catIcon(k, s);
const acc = (k, s = 32) => accIcon(k, s);
const leg = (c, name, v, pct) => `<div class="leg"><i style="background:${c}"></i><span class="nm">${name}</span><b>${v}</b><span class="mu" style="flex:none;width:30px;text-align:right">${pct}</span></div>`;

// Charts, as small inline SVGs.
const pairBars = (pairs, labels, h = 120, w = 360) => {
  const max = Math.max(...pairs.flat()); const bw = w / pairs.length;
  const bars = pairs.map(([inc, out], k) => {
    const x = k * bw + bw * .18, one = bw * .3;
    const hi = inc / max * (h - 6), ho = out / max * (h - 6);
    return `<rect x="${x}" y="${h - hi}" width="${one}" height="${hi}" rx="3" fill="${G}"/><rect x="${x + one + 2}" y="${h - ho}" width="${one}" height="${ho}" rx="3" fill="${R}" opacity="${k === pairs.length - 1 ? .55 : 1}"/>`;
  }).join('');
  const lab = labels.map((l, k) => `<text x="${k * bw + bw / 2}" y="${h + 14}" fill="#8e9ab2" font-size="10.5" text-anchor="middle">${l}</text>`).join('');
  return `<svg width="100%" viewBox="0 0 ${w} ${h + 18}" preserveAspectRatio="none" style="display:block">${bars}${lab}</svg>`;
};
const line = (pts, { w = 360, h = 110, color = B, dashFrom = -1, zero = false, fill = true, labels = [] } = {}) => {
  const max = Math.max(...pts), min = Math.min(...pts, zero ? 0 : Infinity); const span = max - min || 1;
  const xy = pts.map((v, k) => [k / (pts.length - 1) * w, h - 4 - (v - min) / span * (h - 12)]);
  const d = (a) => a.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const solid = dashFrom < 0 ? xy : xy.slice(0, dashFrom + 1), dash = dashFrom < 0 ? [] : xy.slice(dashFrom);
  const area = fill ? `<path d="${d(solid)}L${solid.at(-1)[0]},${h}L0,${h}Z" fill="${tint(color, .18)}"/>` : '';
  const z = zero ? `<line x1="0" x2="${w}" y1="${h - 4 - (0 - min) / span * (h - 12)}" y2="${h - 4 - (0 - min) / span * (h - 12)}" stroke="#2a3857" stroke-dasharray="3 4"/>` : '';
  const lab = labels.map(([k, t]) => `<text x="${k / (pts.length - 1) * w}" y="${h + 14}" fill="#8e9ab2" font-size="10.5" text-anchor="${k === 0 ? 'start' : k === pts.length - 1 ? 'end' : 'middle'}">${t}</text>`).join('');
  return `<svg width="100%" viewBox="0 0 ${w} ${h + (labels.length ? 18 : 0)}" preserveAspectRatio="none" style="display:block">${z}${area}<path d="${d(solid)}" fill="none" stroke="${color}" stroke-width="2.4"/>${dash.length ? `<path d="${d(dash)}" fill="none" stroke="${color}" stroke-width="2.4" stroke-dasharray="5 5" opacity=".75"/>` : ''}<circle cx="${solid.at(-1)[0]}" cy="${solid.at(-1)[1]}" r="4" fill="${color}"/>${lab}</svg>`;
};
const bars1 = (vals, labels, { h = 100, w = 360, color = B, last = true } = {}) => {
  const max = Math.max(...vals); const bw = w / vals.length;
  return `<svg width="100%" viewBox="0 0 ${w} ${h + 18}" preserveAspectRatio="none" style="display:block">${vals.map((v, k) => { const hh = v / max * (h - 4); return `<rect x="${k * bw + bw * .2}" y="${h - hh}" width="${bw * .6}" height="${hh}" rx="4" fill="${color}" opacity="${last && k === vals.length - 1 ? .5 : 1}"/>`; }).join('')}${labels.map((l, k) => `<text x="${k * bw + bw / 2}" y="${h + 14}" fill="#8e9ab2" font-size="10.5" text-anchor="middle">${l}</text>`).join('')}</svg>`;
};
const donutC = (parts, size, center, sub) => `<div style="position:relative;width:${size}px;height:${size}px;flex:none">${donut(parts, size)}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><b style="font-size:${size > 160 ? 16 : 14}px;display:block;white-space:nowrap">${center}</b><small class="mu" style="font-size:11px">${sub}</small></div></div></div>`;
const SPEND = [[27, C.org, 'Vivienda', '1.733.500'], [19, C.grn, 'Mercado', '1.219.900'], [14, C.red, 'Restaurantes', '898.800'], [11, C.cya, 'Transporte', '706.200'], [9, C.yel, 'Servicios', '577.800'], [20, '#5a6683', '4 categorías más', '1.284.100']];

// 58a - Inicio sideways: the balance and what needs attention on the left,
// the chart in the middle, the movements on the right - the three things the
// portrait screen shows one under the other, now at once.
S['58a-inicio-horizontal'] = land('Inicio',
  `<span class="mchip">${ci('apps-outline', B, 26)}Todas las cuentas${ic('chevron-down-outline', 'mu', 'width:15px;height:15px')}</span>${per('Noviembre 2026')}<span style="flex:1"></span>${rb('eye-outline')}${ask}`,
  col(262, `${card(`<div class="lab">Patrimonio hoy</div><div style="font-size:26px;font-weight:700;margin:2px 0 8px;letter-spacing:-.3px">$ 48.215.300</div>
   <div style="display:flex;gap:8px"><div style="flex:1"><div class="mu" style="font-size:11.5px">Entró</div><b class="g" style="font-size:15px">+9.850.000</b></div><div style="flex:1"><div class="mu" style="font-size:11.5px">Salió</div><b class="r" style="font-size:15px">−6.420.300</b></div></div>
   <div class="mu" style="font-size:12px;margin-top:6px">${ic('swap-horizontal-outline', '', `width:14px;height:14px;vertical-align:-2px;color:${MV}`)} <span style="color:${MV}">$ 1.200.000</span> movido entre tus cuentas</div>`, `background:linear-gradient(145deg,${tint(B, .4)},${tint(B, .14)} 55%,#111b2f)`)}
   <div class="fold">${ci('alert-circle-outline', R, 32)}<div class="tx"><b>3 pendientes</b><small class="one"><span class="r">1 pago vencido</span> · 2 recordatorios</small></div>${ic('chevron-forward-outline', 'chev')}</div>
   <div class="fold">${ci('sunny-outline', G, 32)}<div class="tx"><b>Hoy puedes gastar</b><small>Por 13 días más</small></div><b class="g" style="font-size:15px">$ 112.400</b></div>
   <div class="fold" style="flex-direction:column;align-items:stretch;gap:2px"><div class="ct">Tu saldo a futuro<span class="p">90 días</span></div>${line([40, 42, 41, 44, 46, 45, 48, 49, 51, 52], { h: 34, w: 230, dashFrom: 6, fill: false })}</div>`),
  col(258, `${card(`<div class="ct">En qué se fue<span class="p">Toca una porción</span></div>
   <div style="display:flex;justify-content:center;margin:8px 0 6px">${donutC(SPEND.map(([p, c]) => [p, c]), 150, '$ 6.420.300', 'gastado')}</div>
   ${SPEND.map(([p, c, n, v]) => leg(c, n, v, p + ' %')).join('')}`, 'flex:1')}`),
  col(0, `<div class="search" style="padding:7px 12px;font-size:13px">${ic('search-outline')}Buscar en noviembre</div>
   <div class="list" style="flex:1;position:relative">
    <div class="day"><span>HOY · MIÉRCOLES 18</span><span class="r">−$ 92.300</span></div>
    ${mov(cat('mercado'), 'Mercado de la semana', 'Mercado · Banco Azul', '−$ 78.300', '')}
    ${mov(cat('transp'), 'Bus', 'Transporte · Efectivo', '−$ 14.000', '')}
    <div class="day"><span>AYER · MARTES 17</span><span class="g">+$ 3.950.000</span></div>
    ${mov(cat('salario'), 'Salario noviembre', 'Salario · Banco Azul', '+$ 4.200.000', 'g')}
    ${mov(ci('swap-horizontal-outline', MV, 32), 'Banco Azul → Ahorro Verde', 'Entre tus cuentas', '$ 1.200.000', '" style="color:' + MV)}
    ${mov(cat('rest'), 'Almuerzo con el equipo', 'Restaurantes · Tarjeta Coral', '−$ 250.000', '')}
    <div class="scrollfade"></div></div>`),
  say('Lo mismo que Inicio vertical, sin tener que bajar: el saldo, el gráfico y la lista se ven juntos.'));

// 58b - a movement tapped: it opens BESIDE the list, in the same movement
// form as always, while the list stays in view (Lukas's "detalle aquí").
const formBody = (saving = false) => `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px 8px">${rb('close')}<b style="font-size:16px;flex:1">Editar gasto</b>${rb('trash-outline')}</div>
  <div style="display:flex;gap:14px;padding:0 14px">
   <div style="width:220px;flex:none">
    <div class="seg" style="padding:3px"><div class="on red" style="padding:7px 2px">Gasto</div><div style="padding:7px 2px">Ingreso</div><div style="padding:7px 2px">Transferir</div></div>
    <div style="text-align:center;margin:16px 0 4px"><span class="r" style="font-size:34px;font-weight:700;letter-spacing:-.5px">−$ 78.300</span></div>
    <div style="display:flex;gap:6px;justify-content:center"><div style="border:1px dashed #33456a;border-radius:12px;padding:5px 10px;text-align:center"><div class="mu" style="font-size:10.5px">Nuevo saldo</div><b style="font-size:13px">$ 3.871.700</b></div></div>
   </div>
   <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px">
    <div class="field" style="padding:7px 11px;display:flex;align-items:center;gap:9px">${acc('azul', 30)}<div class="tx"><div class="lab">Desde</div><b style="font-size:14px">Banco Azul</b></div>${ic('chevron-down-outline', 'chev')}</div>
    <div class="field" style="padding:7px 11px;display:flex;align-items:center;gap:9px">${cat('mercado', 30)}<div class="tx"><div class="lab">Categoría</div><b style="font-size:14px">Mercado</b></div>${ic('create-outline', 'chev')}</div>
    <div style="display:flex;gap:7px"><div class="field" style="padding:7px 11px;flex:1"><div class="lab">Fecha</div><div style="font-size:14px;margin-top:2px;white-space:nowrap">Hoy, 18 nov</div></div><div class="field" style="padding:7px 11px;flex:1.4"><div class="lab">Nota</div><div class="one" style="font-size:14px;margin-top:2px">Mercado de la semana</div></div></div>
   </div></div>
  <div style="display:flex;justify-content:flex-end;padding:12px 14px 0"><div class="btn" style="width:200px;height:42px">${saving ? 'Guardando…' : 'Guardar'}</div></div>`;
S['58b-inicio-detalle-al-lado'] = land('Inicio',
  `<span class="mchip">${ci('apps-outline', B, 26)}Todas las cuentas${ic('chevron-down-outline', 'mu', 'width:15px;height:15px')}</span>${per('Noviembre 2026')}<span style="flex:1"></span>${rb('eye-outline')}${ask}`,
  col(290, `<div class="search" style="padding:7px 12px;font-size:13px">${ic('search-outline')}Buscar en noviembre</div>
   <div class="list" style="flex:1;position:relative">
    <div class="day"><span>HOY · MIÉRCOLES 18</span><span class="r">−$ 92.300</span></div>
    ${mov(cat('mercado'), 'Mercado de la semana', 'Mercado · Banco Azul', '−$ 78.300', '', true)}
    ${mov(cat('transp'), 'Bus', 'Transporte · Efectivo', '−$ 14.000', '')}
    <div class="day"><span>AYER · MARTES 17</span><span class="g">+$ 3.950.000</span></div>
    ${mov(cat('salario'), 'Salario noviembre', 'Salario · Banco Azul', '+$ 4.200.000', 'g')}
    ${mov(cat('rest'), 'Almuerzo con el equipo', 'Restaurantes · Coral', '−$ 250.000', '')}
    <div class="scrollfade"></div></div>`),
  col(0, `<div class="panelx" style="flex:1">${formBody()}</div>`),
  say('Tocar otro movimiento de la lista lo abre en el mismo lugar. Es el mismo formulario de siempre, solo que al lado.'));

// 58c - typing the amount sideways: Android's keyboard takes half the height,
// so the form keeps only what is being typed above it.
S['58c-escribiendo-con-teclado'] = `${LCSS}<div class="land">${rail('Inicio')}<div class="pane" style="padding:10px 14px">
  <div class="panelx" style="height:186px;padding:12px 16px;display:flex;align-items:center;gap:18px">
   <div style="width:210px;flex:none"><div class="seg" style="padding:3px"><div class="on red" style="padding:7px 2px">Gasto</div><div style="padding:7px 2px">Ingreso</div><div style="padding:7px 2px">Transferir</div></div>
    <div class="mu" style="font-size:12px;margin-top:10px;display:flex;align-items:center;gap:6px">${acc('azul', 22)} Banco Azul · ${cat('mercado', 22)} Mercado</div></div>
   <div style="flex:1;text-align:center"><div class="lab">Valor</div><div style="font-size:40px;font-weight:700;letter-spacing:-.6px;margin-top:2px"><span class="r">−$ 78.30</span><span style="display:inline-block;width:2px;height:34px;background:var(--pr);vertical-align:-4px"></span></div>
    <div style="display:inline-flex;gap:8px;margin-top:6px"><span style="border:1px dashed #33456a;border-radius:12px;padding:4px 10px;font-size:12px"><span class="mu">Nuevo saldo</span> <b>$ 3.871.770</b></span></div></div>
   <div style="display:flex;flex-direction:column;gap:8px;flex:none"><span class="rb">${ic('backspace-outline')}</span><span class="rb">${ic('close')}</span></div>
   <div class="btn" style="width:140px;height:44px;flex:none">Guardar</div></div>
 </div></div>
 <div class="kb">${'1234567890'.split('').map(k => `<div>${k}</div>`).join('')}${['−', ',', '.', '$', '(', ')', '/', '+', '*', '#'].map(k => `<div class="w">${k}</div>`).join('')}<div class="w" style="grid-column:span 2">ABC</div><div style="grid-column:span 6"></div><div class="w" style="grid-column:span 2;background:#5b7cfa">${ic('checkmark', '', 'width:20px;height:20px')}</div></div>
 ${say('Con el teclado abierto solo queda arriba lo que estás escribiendo, el nuevo saldo y Guardar.')}`;

// 58d - Reporte sideways: a dashboard. Headline figures in one row, then
// the charts side by side; it still scrolls for the rest of its sections.
const kpi = (lab, v, s, cls = '') => `<div class="tile" style="flex:1"><div class="lab">${lab}</div><b class="${cls}">${v}</b><small>${s}</small></div>`;
S['58d-reporte-tablero'] = land('Reporte',
  `<div class="seg" style="padding:3px;width:250px"><div class="on" style="padding:6px 2px">Movimientos</div><div style="padding:6px 2px">Rendimientos</div></div><span class="mchip">${ci('apps-outline', B, 26)}Todas</span>${per('Noviembre 2026')}<span style="flex:1"></span>${rb('download-outline')}${ask}`,
  col(0, `<div style="display:flex;gap:10px">${kpi('Entró', '+$ 9.850.000', '↑ 4 % que octubre', 'g')}${kpi('Salió', '−$ 6.420.300', '↓ 6 % que octubre', 'r')}${kpi('Ahorraste', '35 %', '$ 3.429.700 de lo que entró', 'p')}${kpi('Gasto por día', '$ 356.700', 'Van 18 de 30 días')}</div>
   <div style="display:flex;gap:10px;flex:1;min-height:0">
    ${card(`<div class="ct">Mes a mes<span class="p" style="display:flex;gap:10px"><span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${G}"></i> Ingresos</span><span><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${R}"></i> Gastos</span></span></div><div style="margin-top:10px">${pairBars([[8.9, 6.1], [9.2, 7.4], [9.0, 6.6], [9.5, 8.1], [9.4, 6.8], [9.85, 6.42]], ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'], 150, 380)}</div><div class="mu" style="font-size:11.5px;margin-top:4px">Noviembre va hasta hoy: la barra clara aún crece.</div>`, 'flex:1.25;min-width:0')}
    ${card(`<div class="ct">En qué se fue<span class="p">${ic('chevron-forward-outline', '', 'width:14px;height:14px')}</span></div>${SPEND.slice(0, 5).map(([p, c, n, v]) => `<div style="margin-top:9px"><div class="leg" style="padding:0">${sq(CAT[Object.keys(CAT).find(k => CAT[k][2] === n)]?.[0] ?? 'ellipse-outline', c, 22)}<span class="nm">${n}</span><b>$ ${v}</b></div><div class="hbar"><i style="width:${p * 3.4}%;background:${c}"></i></div></div>`).join('')}`, 'flex:1;min-width:0')}
    ${card(`<div class="ct">Tu saldo a futuro<span class="p">90 días</span></div><div style="margin-top:12px">${line([30, 31, 33, 32, 35, 36, 38, 39, 41, 43, 44, 46], { h: 120, w: 240, dashFrom: 7, labels: [[0, 'Ago'], [7, 'Hoy'], [11, 'Feb']] })}</div><div class="mu" style="font-size:11.5px;margin-top:6px">La línea punteada es una proyección.</div>`, 'flex:.9;min-width:0')}
   </div>`),
  say('Las secciones que hoy se abren una por una se ven juntas. Bajando siguen las demás, de dos en dos.'));

// 58e - Cuentas sideways: the list on the left, the account tapped on the
// right with its balance over the months and its latest movements.
const accRow = (k, name, sub, v, cls = '', sel = false) => `<div class="lrow ${sel ? 'sel' : ''}">${acc(k)}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small></div><div class="am ${cls}">${v}</div></div>`;
S['58e-cuentas-horizontal'] = land('Cuentas',
  `<div class="seg" style="padding:3px;width:420px"><div class="on" style="padding:6px 2px">${ic('wallet-outline')}Saldos</div><div style="padding:6px 2px">${ic('trending-up-outline')}Rendimientos</div><div style="padding:6px 2px">${ic('card-outline')}Deudas</div></div><span style="flex:1"></span>${rb('eye-outline')}${rb('add')}${ask}`,
  col(300, `${card(`<div style="display:flex;justify-content:space-between;align-items:flex-end"><div><div class="lab">Patrimonio hoy</div><b style="font-size:22px">$ 48.215.300</b></div><div style="text-align:right;font-size:11.5px" class="mu">Tienes <b class="g">$ 51,9 M</b><br>Debes <b class="r">$ 3,7 M</b></div></div>`, `padding:10px 14px;background:linear-gradient(145deg,${tint(B, .36)},#111b2f 70%)`)}
   <div class="list" style="flex:1;position:relative">
    ${accRow('azul', 'Banco Azul', 'Débito · 3 productos', '$ 3.950.000', '', true)}
    ${accRow('verde', 'Ahorro Verde', 'Ahorros · gana 9,5 % E.A.', '$ 18.420.000')}
    ${accRow('ambar', 'Fiducia Ámbar', 'Inversión', '$ 24.100.000')}
    ${accRow('dolar', 'Cuenta Dólar', 'US$ 1.250 · TRM 3.182', '$ 3.978.750')}
    ${accRow('coral', 'Tarjeta Coral', 'Disponible $ 2.300.000', '−$ 1.209.480', 'r')}
    <div class="scrollfade"></div></div>`),
  col(0, `${card(`<div style="display:flex;align-items:center;gap:12px">${acc('azul', 44)}<div class="tx"><b style="font-size:17px">Banco Azul</b><small>Débito · Cuenta de ahorros, Bolsillo viajes, Bolsillo casa</small></div><span class="rb">${ic('create-outline')}</span><span class="rb acc">${ic('home-outline')}</span></div>
   <div style="display:flex;gap:18px;align-items:flex-end;margin-top:10px"><div><div class="lab">Saldo hoy</div><b style="font-size:26px">$ 3.950.000</b></div><div style="font-size:12.5px;padding-bottom:4px"><span class="g">+$ 4.200.000</span> entró · <span class="r">−$ 2.180.300</span> salió en noviembre</div></div>
   <div style="margin-top:8px">${line([2.1, 2.8, 2.4, 3.1, 2.9, 3.6, 3.2, 3.95], { h: 70, w: 480, labels: [[0, 'Abr'], [2, 'Jun'], [4, 'Ago'], [6, 'Oct'], [7, 'Hoy']] })}</div>`)}
   <div class="list" style="flex:1;position:relative"><div class="day"><span>ÚLTIMOS MOVIMIENTOS</span><span class="p">Ver todos en Inicio</span></div>
    ${mov(cat('mercado'), 'Mercado de la semana', 'Hoy · Mercado', '−$ 78.300', '')}
    ${mov(cat('salario'), 'Salario noviembre', 'Ayer · Salario', '+$ 4.200.000', 'g')}
    <div class="scrollfade"></div></div>`),
  say('Tocar una cuenta la muestra a la derecha: su saldo de los últimos meses y lo último que pasó.'));

// 58f - Deudas sideways: what is owed on the left, the plan to get out on
// the right, with each debt's bar to the month it ends.
const debtRow = (icon, name, sub, v, sel = false) => `<div class="lrow ${sel ? 'sel' : ''}">${icon}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small></div><div class="am r">${v}</div></div>`;
const gantt = (name, c, w, end, first = false) => `<div style="display:flex;align-items:center;gap:10px;margin-top:9px"><span class="one" style="width:120px;font-size:12.8px">${name}</span><div style="flex:1;height:16px;background:var(--s2);border-radius:8px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:${w}%;border-radius:8px;background:${c}"></i>${first ? `<span style="position:absolute;left:calc(${w}% + 8px);top:0;font-size:11px;line-height:16px;color:${Y};font-weight:500">aquí va el dinero adicional</span>` : ''}</div><span style="width:70px;font-size:12px;text-align:right" class="mu">${end}</span></div>`;
S['58f-deudas-horizontal'] = land('Cuentas',
  `<div class="seg" style="padding:3px;width:420px"><div style="padding:6px 2px">${ic('wallet-outline')}Saldos</div><div style="padding:6px 2px">${ic('trending-up-outline')}Rendimientos</div><div class="on" style="padding:6px 2px">${ic('card-outline')}Deudas</div></div><span style="flex:1"></span>${rb('eye-outline')}${rb('add')}${ask}`,
  col(300, `${card(`<div class="lab">Debes hoy</div><b style="font-size:24px">$ 38.940.100</b><div class="mu" style="font-size:12px;margin-top:3px">Este mes pagas $ 1.512.000 · <span class="y">$ 498.000 son intereses</span></div>`, `padding:10px 14px;background:linear-gradient(145deg,${tint(R, .22)},#111b2f 70%)`)}
   <div class="list" style="flex:1;position:relative">
    ${debtRow(acc('coral'), 'Tarjeta Coral', 'Factura $ 640.200 · vence el 25', '$ 1.209.480')}
    ${debtRow(ci('car-outline', C.cya, 32), 'Crédito del carro', 'Cuota 24 de 60 · 16,5 % E.A.', '$ 37.730.620', true)}
    <div class="scrollfade"></div></div>
   <div class="fold">${ci('rocket-outline', G, 32)}<div class="tx"><b>Salir de tus deudas</b><small>Con $ 300.000 más al mes</small></div>${ic('chevron-forward-outline', 'chev')}</div>`),
  col(0, `${card(`<div class="ct">Salir de tus deudas<span class="p">Pagar menos intereses</span></div>
   <div style="display:flex;gap:10px;margin-top:10px"><div class="tile" style="flex:1;background:${tint(G, .12)};border-color:${tint(G, .35)}"><div class="lab">Sin deudas en</div><b class="g">Marzo de 2029</b><small>8 meses antes</small></div><div class="tile" style="flex:1"><div class="lab">Te ahorras</div><b>$ 4.180.000</b><small>en intereses</small></div><div class="tile" style="flex:1"><div class="lab">Dinero adicional</div><b class="p">$ 300.000</b><small>al mes · cambiar</small></div></div>
   <div class="ct" style="margin-top:12px">Cuándo terminas cada deuda</div>
   ${gantt('Tarjeta Coral', Y, 9, 'Ene 2027', true)}${gantt('Crédito del carro', C.cya, 100, 'Mar 2029')}
   <div style="display:flex;justify-content:space-between;margin:6px 0 0 130px;padding-right:80px" class="mu"><span style="font-size:10.5px">Hoy</span><span style="font-size:10.5px">2027</span><span style="font-size:10.5px">2028</span><span style="font-size:10.5px">2029</span></div>`, 'flex:1')}`),
  say('La lista de deudas y el plan para salir de ellas, en la misma pantalla.'));

// 58g - Productos y rendimientos of one account sideways: products and what
// each holds on the left, the interest by month on the right.
const prodRow = (i, c, name, sub, v, sel = false) => `<div class="lrow ${sel ? 'sel' : ''}">${sq(i, c, 32)}<div class="tx"><b class="one">${name}</b><small class="one">${sub}</small></div><div class="am">${v}</div></div>`;
S['58g-rendimientos-horizontal'] = land('Cuentas',
  `${rb('chevron-back-outline')}<span class="mchip">${acc('verde', 26)}Ahorro Verde${ic('chevron-down-outline', 'mu', 'width:15px;height:15px')}</span><div class="seg" style="padding:3px;width:340px"><div class="on" style="padding:6px 2px">Productos</div><div style="padding:6px 2px">Movimientos</div><div style="padding:6px 2px">Intereses</div></div><span style="flex:1"></span>${rb('ellipsis-horizontal')}${ask}`,
  col(310, `${card(`<div class="lab">Este mes te han pagado</div><b class="g" style="font-size:24px">+$ 126.840</b><div class="mu" style="font-size:12px;margin-top:2px">Hoy estás ganando unos $ 4.700 al día</div>`, `padding:10px 14px;background:linear-gradient(145deg,${tint(G, .24)},#111b2f 70%)`)}
   <div class="list" style="flex:1;position:relative">
    ${prodRow('wallet-outline', B, 'Cuenta de ahorros', '9,5 % E.A. · se usa por defecto', '$ 12.300.000', true)}
    ${prodRow('airplane-outline', C.tea, 'Bolsillo viajes', '9,5 % E.A.', '$ 3.120.000')}
    ${prodRow('ribbon-outline', C.gold, 'CDT 180 días', '11,2 % E.A. · vence 3 mar', '$ 3.000.000')}
    <div class="scrollfade"></div></div>`),
  col(0, `${card(`<div class="ct">Intereses de cada mes<span class="p">Netos · 6 meses</span></div><div style="margin-top:10px">${bars1([98, 104, 111, 117, 121, 126.8], ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'], { h: 110, w: 460, color: G })}</div>`)}
   <div style="display:flex;gap:10px">${kpi('Te pagaron en 2026', '+$ 1.204.300', 'netos de retención', 'g')}${kpi('Retención', '$ 90.600', '7 % de lo ganado')}${kpi('Frente a la inflación', '+3,6 %', 'tu dinero creció de verdad', 'g')}</div>`),
  say('Los productos de la cuenta y cuánto pagan, con la gráfica al lado.'));

// 58h - Por revisar sideways: the rows on the left, the one being answered
// on the right - going through a statement row by row without closing anything.
const revRow = (icon, t, s, a, need = false, sel = false) => `<div class="lrow ${sel ? 'sel' : ''}">${icon}<div class="tx"><b class="one">${t}</b><small class="one ${need ? 'y' : ''}">${s}</small></div><div class="am">${a}</div></div>`;
S['58h-por-revisar-horizontal'] = land('Más',
  `${rb('chevron-back-outline')}<h1>Extracto de Banco Azul</h1><span class="tag" style="background:${tint(G, .18)};color:${G}">Cuadra</span><span style="flex:1"></span>${rb('search-outline')}${rb('funnel-outline')}${ask}`,
  col(310, `<div class="fold" style="border-color:${tint(Y, .45)}">${ci('help-outline', Y, 30)}<div class="tx"><b>Te falta elegir algo</b><small>3 movimientos</small></div>${ic('chevron-up-outline', 'chev')}</div>
   <div class="list" style="flex:1;position:relative">
    ${revRow(sq('help-outline', Y, 32), 'COMPRA PANADERIA TRIGO', 'Falta la categoría · 14 nov', '−$ 18.400', true, true)}
    ${revRow(sq('help-outline', Y, 32), 'PAGO PSE ENERGIA', 'Falta la categoría · 12 nov', '−$ 142.900', true)}
    ${revRow(sq('help-outline', Y, 32), 'TRANSF RECIBIDA', 'Falta la categoría · 10 nov', '+$ 300.000', true)}
    <div class="scrollfade"></div></div>
   <div class="fold">${ci('checkmark-done-outline', G, 30)}<div class="tx"><b>Listos para guardar</b><small>15 movimientos</small></div><span class="pill">Guardar</span></div>`),
  col(0, `<div class="panelx" style="flex:1;padding:12px 14px">
   <div style="display:flex;align-items:center;gap:10px">${rb('close')}<b style="font-size:16px;flex:1">Revisar movimiento</b>${rb('eye-off-outline')}${rb('trash-outline')}</div>
   <div style="display:flex;align-items:center;gap:8px;background:#0a1222;border:1px dashed #2a3a5c;border-radius:12px;padding:7px 11px;margin-top:10px">${ic('document-text-outline', '', `width:16px;height:16px;color:${B}`)}<span class="one" style="font-size:12.5px;color:#b9c3d8">El extracto dice: 14/11 COMPRA PANADERIA TRIGO 18.400,00</span></div>
   <div style="display:flex;gap:14px;margin-top:10px;align-items:center"><div class="seg" style="padding:3px;width:240px;flex:none"><div class="on red" style="padding:6px 2px">Gasto</div><div style="padding:6px 2px">Ingreso</div><div style="padding:6px 2px">Transferir</div></div><div class="r" style="flex:1;text-align:center;font-size:28px;font-weight:700">−$ 18.400</div></div>
   <div class="lab" style="margin:10px 0 6px">Categoría · las que más usas</div>
   <div class="chips" style="gap:6px">${['mercado', 'rest', 'ocio', 'transp'].map((k, n) => `<div class="chip i ${n === 0 ? 'on' : ''}" style="padding:3px 9px 3px 3px;font-size:12.5px">${cat(k, 22)}${CAT[k][2]}</div>`).join('')}<div class="chip" style="padding:3px 9px;font-size:12.5px">Otra categoría</div></div>
   <div style="display:flex;gap:10px;align-items:center;margin-top:10px"><div class="field" style="padding:5px 11px;flex:1"><div class="lab">Nota</div><div style="font-size:13.5px;margin-top:1px">Panadería Trigo</div></div><div class="btn" style="width:170px;height:42px;flex:none">Guardar y seguir</div></div>
   <div class="mu" style="font-size:11.5px;text-align:right;margin-top:4px">Al guardar se abre el siguiente</div></div>`),
  say('Revisar un extracto entero sin cerrar nada: al guardar uno, se abre el siguiente al lado.'));

// 58i - the assistant sideways: the conversation on the left, its answer
// as a big card with its chart on the right.
const bubble = (t, me = false) => `<div style="align-self:${me ? 'flex-end' : 'flex-start'};max-width:88%;background:${me ? `linear-gradient(135deg,${B},${C.blu})` : 'var(--s1)'};border:1px solid ${me ? 'transparent' : '#1f2c47'};border-radius:16px;${me ? 'border-bottom-right-radius:5px' : 'border-bottom-left-radius:5px'};padding:8px 12px;font-size:13.5px;line-height:1.38">${t}</div>`;
S['58i-asistente-horizontal'] = land('Inicio',
  `${rb('chevron-back-outline')}<h1>Asistente</h1><span class="tag" style="background:${tint(B, .18)};color:${B}">${ic('time-outline', '', 'width:12px;height:12px;vertical-align:-2px')} Se guarda 3 días</span><span style="flex:1"></span>${rb('bulb-outline')}${rb('trash-outline')}`,
  col(340, `<div style="flex:1;display:flex;flex-direction:column;gap:8px;justify-content:flex-end;min-height:0">
    ${bubble('¿Cómo voy este mes?', true)}
    ${bubble('Vas bien: gastaste <b>6 % menos</b> que en los mismos días de octubre. Te sobran <b class="g" style="white-space:nowrap">$ 3.429.700</b>. A la derecha está el detalle.')}
    ${bubble('¿Y en qué gasté más?', true)}
    ${bubble('En <b>Vivienda</b>: $ 1.733.500, el 27 % de lo que gastaste.')}</div>
   <div class="chips" style="flex-wrap:nowrap;overflow:hidden">${['¿Y el mes pasado?', '¿Por qué gasté más?'].map(t => `<div class="chip" style="padding:5px 10px;font-size:12.5px">${t}</div>`).join('')}</div>
   <div class="search" style="padding:7px 8px 7px 14px;font-size:13.5px"><span style="flex:1">Escribe o dicta…</span>${rb('mic-outline')}<span class="rb acc">${ic('send')}</span></div>`),
  col(0, `${card(`<div class="ct">En qué gastaste más · noviembre<span class="p">Toca una categoría</span></div>
   <div style="display:flex;gap:16px;align-items:center;margin-top:8px">${donutC(SPEND.map(([p, c]) => [p, c]), 172, '$ 6.420.300', 'gastado')}
    <div style="flex:1;min-width:0">${SPEND.map(([p, c, n, v]) => `<div class="leg" style="padding:4px 0">${'<i style="background:' + c + '"></i>'}<span class="nm">${n}</span><b>$ ${v}</b>${ic('chevron-forward-outline', 'chev', 'width:14px;height:14px')}</div>`).join('')}</div></div>`, 'flex:1')}
   <div style="display:flex;gap:10px">${kpi('Contra octubre', '−6 %', 'los mismos 18 días', 'g')}${kpi('Lo que más subió', 'Restaurantes', '+$ 210.000')}</div>`),
  say('La conversación a la izquierda y la respuesta en grande a la derecha, con su gráfica.'));

// 58j - Bolsa de valores sideways: the portfolio and its positions on the
// left, the return chart big on the right - the chart a broker app opens on.
const pos = (t, n, units, v, g, cls) => `<div class="lrow">${sq('trending-up-outline', cls === 'g' ? G : R, 32)}<div class="tx"><b class="one">${t} <span class="mu" style="font-weight:400;font-size:12px">${n}</span></b><small class="one">${units}</small></div><div class="am">${v}<small class="${cls}">${g}</small></div></div>`;
S['58j-bolsa-horizontal'] = land('Más',
  `${rb('chevron-back-outline')}<h1>Bolsa de valores</h1><span class="tag" style="background:${tint(G, .18)};color:${G}">Precios de hoy, 10:42</span><span style="flex:1"></span>${rb('refresh-outline')}${rb('add')}${ask}`,
  col(300, `${card(`<div class="lab">Tu patrimonio en bolsa hoy</div><b style="font-size:24px">US$ 12.840,20</b><div style="font-size:12.5px;margin-top:2px"><span class="g">+US$ 1.612,40 · +14,4 %</span> <span class="mu">· $ 40.870.000</span></div>`, `padding:10px 14px;background:linear-gradient(145deg,${tint(G, .22)},#111b2f 70%)`)}
   <div class="list" style="flex:1;position:relative">
    ${pos('NOVA', 'Nova Tech', '12 acciones · 31 %', 'US$ 3.980', '+22,1 %', 'g')}
    ${pos('SOLR', 'Solaria', '40 acciones · 24 %', 'US$ 3.090', '+9,8 %', 'g')}
    ${pos('VIVA', 'Viva Foods', '25 acciones · 18 %', 'US$ 2.310', '−3,4 %', 'r')}
    ${pos('MUND', 'ETF Mundo', '8 unidades · 15 %', 'US$ 1.925', '+11,0 %', 'g')}
    <div class="scrollfade"></div></div>`),
  col(0, `${card(`<div class="ct">Lo que has ganado<span class="p">Sin contar lo que pusiste</span></div>
   <div style="display:flex;align-items:baseline;gap:10px;margin-top:4px"><b class="g" style="font-size:22px">+US$ 1.612,40</b><span class="g" style="font-size:13px">+14,4 %</span><span class="mu" style="font-size:12px">en el último año</span></div>
   <div style="margin-top:6px">${line([0, 120, 80, 260, 410, 350, 520, 700, 640, 880, 1050, 1230, 1180, 1420, 1612], { h: 140, w: 470, color: G, zero: true, labels: [[0, 'Nov 25'], [5, 'Mar'], [10, 'Jul'], [14, 'Hoy']] })}</div>
   <div class="chips" style="margin-top:6px;gap:5px">${['1 día', '5 días', '1 mes', '6 meses', 'Este año', '1 año', 'Todo'].map(t => `<div class="chip ${t === '1 año' ? 'on' : ''}" style="padding:4px 9px;font-size:12px">${t}</div>`).join('')}</div>`, 'flex:1')}
   <div style="display:flex;gap:10px">${kpi('Invertido', 'US$ 11.227,80', 'lo que pusiste')}${kpi('Dividendos', '+US$ 184,30', 'netos de retención', 'g')}${kpi('Ya vendido', '+US$ 96,10', 'ganancia realizada', 'g')}</div>`),
  say('La gráfica de ganancias ocupa el espacio grande, como en la app de un bróker.'));

// 58k - Más sideways: its groups as four columns, every row in view at once.
const mrow = (i, c, t, s) => `<div class="lrow" style="padding:7px 8px">${ci(i, c, 30)}<div class="tx"><b style="font-size:13.5px;white-space:normal;line-height:1.25">${t}</b><small class="one" style="font-size:11.5px">${s}</small></div></div>`;
const mgrp = (title, rows) => `<div class="col" style="flex:1"><div class="ct" style="padding:0 4px">${title}</div><div class="list">${rows}</div></div>`;
S['58k-mas-horizontal'] = land('Más',
  `<h1>Más</h1><span class="mchip" style="margin-left:8px">${ci('logo-google', B, 26)}Copia en Drive · hoy 8:12</span><span style="flex:1"></span><span class="mchip" style="padding-left:10px">${ic('star-outline', '', `width:16px;height:16px;color:${C.gold}`)}Finance Pro · activo</span>${ask}`,
  `${mgrp('Tu día a día', mrow('wallet-outline', B, 'Cuentas', '8 cuentas') + mrow('card-outline', R, 'Deudas', '2 · $ 38,9 M') + mrow('pie-chart-outline', C.pur, 'Presupuestos', '4 topes · 2 metas') + mrow('alarm-outline', C.pnk, 'Recordatorios', '3 este mes') + mrow('file-tray-full-outline', Y, 'Por revisar', '18 esperando'))}
   ${mgrp('Ahorro e inversión', mrow('cash-outline', G, 'Productos y rendimientos', '3 cuentas ganan') + mrow('trending-up-outline', C.lim, 'Bolsa de valores', 'US$ 12.840'))}
   ${mgrp('Análisis', mrow('stats-chart-outline', B, 'Reporte', 'Resumen de octubre listo') + mrow('document-text-outline', C.gold, 'Simulador de renta', 'Formulario 210') + mrow('logo-usd', C.cya, 'Monedas y TRM', 'COP · USD · EUR'))}
   ${mgrp('Tus datos y preferencias', mrow('pricetags-outline', C.org, 'Categorías', '24 de gastos') + mrow('notifications-outline', C.tea, 'Notificaciones', '3 bancos') + mrow('swap-vertical-outline', C.gry, 'Importar y exportar', 'Copia y CSV') + mrow('color-palette-outline', C.orq, 'Apariencia', 'Oscuro · Zafiro'))}`,
  say('Todos los grupos de Más se ven de una vez, sin bajar.'), true);

// 58l - the "+" sideways: a wide sheet, the three kinds of movement and the
// other ways in on the left, the fixed payments and habits on the right.
const big = (i, c, t) => `<div style="flex:1;background:${tint(c, .14)};border:1px solid ${tint(c, .4)};border-radius:16px;padding:12px;text-align:center;color:${c}">${ic(i, '', 'width:26px;height:26px')}<b style="display:block;margin-top:4px;color:var(--tx);font-size:14px">${t}</b></div>`;
S['58l-mas-boton-horizontal'] = land('Inicio',
  `<span class="mchip">${ci('apps-outline', B, 26)}Todas las cuentas</span>${per('Noviembre 2026')}<span style="flex:1"></span>${rb('eye-outline')}${ask}`,
  col(0, `<div style="opacity:.25;flex:1;background:var(--s1);border-radius:20px"></div>`),
  `<div class="scrim"></div><div style="position:absolute;left:96px;right:20px;height:366px;top:46px;background:#0f192c;border:1px solid #26365a;border-bottom:none;border-radius:24px 24px 0 0;padding:8px 16px 14px">
   <div class="grab"></div>
   <div style="display:flex;gap:18px">
    <div style="width:330px;flex:none">
     <div style="display:flex;gap:8px">${big('arrow-down-outline', R, 'Gasto')}${big('arrow-up-outline', G, 'Ingreso')}${big('swap-horizontal-outline', MV, 'Transferir')}</div>
     <div class="list" style="margin-top:10px">${mrow('sparkles-outline', B, 'Asistente', 'Escribe o dicta: «45 mil en mercado»')}${mrow('camera-outline', C.org, 'Foto de un recibo', 'Lo llena por ti')}${mrow('document-text-outline', C.cya, 'Importar un extracto', 'PDF, foto o captura de pantalla')}${mrow('add-circle-outline', C.gry, 'Nueva cuenta', '')}</div></div>
    <div style="flex:1;min-width:0">
     <div class="ct" style="padding:0 4px">Pagos de este mes que te faltan</div>
     <div class="list" style="margin-top:6px">${mov(cat('servicios'), 'Energía', 'Suele ser el día 20 · Banco Azul', '$ 142.000', '')}${mov(cat('vivienda'), 'Arriendo', 'Suele ser el día 25 · Banco Azul', '$ 1.600.000', '')}</div>
     <div class="ct" style="padding:0 4px;margin-top:10px">Lo que más registras</div>
     <div class="list" style="margin-top:6px">${mov(cat('transp'), 'Bus', 'Gasto · Efectivo · 18 veces', '$ 3.200', '')}${mov(ci('swap-horizontal-outline', MV, 32), 'Banco Azul → Ahorro Verde', 'Transferencia · 6 veces', '', '')}</div></div>
   </div></div>`,
  say('El "+" usa el ancho: lo de siempre a la izquierda y tus pagos y atajos a la derecha, sin bajar.'));

export default S;
