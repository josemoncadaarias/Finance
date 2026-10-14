// Group 28 - hiding the amounts with an eye (Jose, 2026-10-14: so someone
// looking at the phone does not see balances or net worth). It was idea 3/H,
// drawn in v3 and turned down on 2026-09-28; asked for again. Proposed,
// nothing built. Every figure invented.
import { ic, sq, C, tint, sw } from './lib.mjs';
import G1 from './screens-1.mjs';
import G2 from './screens-2.mjs';
import G8 from './screens-8.mjs';

const S = {};
const eye = hidden => `<span style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:#fff;flex:none">${ic(hidden ? 'eye-off-outline' : 'eye-outline', '', 'width:21px;height:21px')}</span>`;
// Every amount becomes dots; names, categories and percentages stay.
const hide = html => html
  .replace(/[−+-]?\$?\s?\d{1,3}(?:\.\d{3})+(?:,\d{2})?(?:\s?M\b)?/g, '••••••')
  .replace(/\b\d+,\d{2}\s?M\b/g, '••••')
  .replace(/(>|\s)\d{1,3},\d{2}(?=\s|<)/g, '$1••••••');

// 1. Inicio: the eye beside net worth, always in the same place.
const withEye = (html, hidden) => html.replace(
  '<div class="card hero"><div class="lab">Patrimonio hoy</div>',
  `<div class="card hero"><div style="display:flex;align-items:center;justify-content:space-between;margin:-4px 0 -2px"><div class="lab">Patrimonio hoy</div>${eye(hidden)}</div>`);
S['28a-inicio-con-ojo'] = withEye(G1['1a-inicio'], false);
S['28b-inicio-oculto'] = hide(withEye(G1['1a-inicio'], true));

// 2. One account: the eye first, then its own buttons.
const oneWithEye = (html, hidden) => html.replace('<div style="display:flex;gap:8px">', `<div style="display:flex;gap:8px">${eye(hidden)}`);
S['28c-cuenta-oculta'] = hide(oneWithEye(G1['1b-inicio-cuenta-con-productos'], true));

// 3. Cuentas, and every other screen with money, stays hidden too.
S['28d-cuentas-oculto'] = hide(G2['2a-cuentas']);

// 4. Más → Preferencias: start hidden every time the app opens.
const row = `<div class="row">${sq('eye-off-outline', C.gry ?? '#8c9bb5', 40)}<div class="tx"><b>Ocultar montos al abrir</b><small class="wrap">La app empieza con los montos ocultos. El ojo de Inicio los muestra.</small></div>${sw(true)}</div>`;
S['28e-mas-ocultar-al-abrir'] = G8['8a-mas'].replace(/(<div class="h">Preferencias<\/div><div class="list">)/, `$1${row}`);

export default S;
