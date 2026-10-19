// Group 37 - currencies chosen from a list, each with its flag, and every
// rate automatic unless the person types one (Jose, 2026-10-19). Figures
// invented.
import { ic, C, tint, top, tag, chev } from './lib.mjs';

const S = {};
const flag = (f, size = 42) => `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;background:var(--s2);font-size:${Math.round(size * .58)}px;flex:none">${f}</span>`;
const row = (f, code, name, used, rate, how, c = C.mu) => `<div class="row">${flag(f)}<div class="tx"><b class="one">${code} · ${name}</b><small class="one">${used}</small></div>
 <div class="am">${rate}<small style="color:${c}">${how}</small></div>${chev()}</div>`;
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}<div style="height:14px"></div></div>`;
const btn = (t, ghost = false) => `<div class="btn ${ghost ? 'ghost' : ''}" style="margin-top:10px">${t}</div>`;

const list = `${top('Monedas y TRM', { right: `<div class="chip" style="padding:7px 12px;color:var(--pr)">${ic('add', '', 'width:18px;height:18px')}Moneda</div>` })}<main>
 <div class="card hero"><div class="lab">Tus monedas en pesos</div><div class="big" style="font-size:26px">Todas al día</div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:10px"><span class="chip" style="background:rgba(7,13,26,.35);color:#dfe4ff">${ic('refresh-outline')}Actualizar</span><span style="color:#8fe0b5;font-size:13px">Hoy 9:12</span></div></div>
 <div class="h">Tus monedas</div>
 <div class="list">
  ${row('🇨🇴', 'COP', 'Peso colombiano', 'En 9 cuentas', 'Principal', '')}
  ${row('🇺🇸', 'USD', 'Dólar estadounidense', 'En 3 cuentas', '3.912,40', 'TRM oficial · hoy', C.grn)}
  ${row('🇪🇺', 'EUR', 'Euro', 'En 1 cuenta', '4.580,00', 'Escrita por ti · hoy', C.yel)}
  ${row('🇲🇽', 'MXN', 'Peso mexicano', 'En 1 cuenta', '211,35', 'Automática · hoy', C.grn)}</div>
 <div class="hint">Cada moneda se calcula sola: el dólar con la TRM oficial y las demás con el BCE por la TRM. Toca una para ver su tasa o escribir la tuya.</div></main>`;
S['37a-monedas-con-bandera'] = list;

// Tapping a currency with a typed rate: one tap back to the automatic one.
S['37b-volver-a-la-automatica'] = list + sheet(`<div style="text-align:center">${flag('🇪🇺', 56).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="font-size:18px">EUR · Euro</b>
 <div class="sub" style="margin-top:4px">Cuánto vale un euro en pesos hoy</div></div>
 <div class="list" style="margin-top:14px">
  <div class="row"><div class="tx"><b>La que escribiste</b><small>Hoy · se usa ahora</small></div><div class="am" style="color:var(--yel)">4.580,00</div></div>
  <div class="row"><div class="tx"><b>La automática</b><small>BCE × TRM oficial · hoy</small></div><div class="am">4.512,73</div></div></div>
 ${btn('Usar la automática')}${btn('Escribir otra', true)}`);

// Adding a currency: a list ready to use, never a code typed.
const pick = (f, code, name, note = '', on = false) => `<div class="row">${flag(f, 38)}<div class="tx"><b class="one">${code} · ${name}</b>${note ? `<small>${note}</small>` : ''}</div>${on ? tag('Ya la tienes', C.grn) : ''}</div>`;
S['37c-agregar-de-la-lista'] = list + sheet(`<div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><b style="flex:1;text-align:center;font-size:17px">Agregar una moneda</b><span style="width:70px"></span></div>
 <div class="field" style="margin-top:12px;display:flex;align-items:center;gap:8px">${ic('search-outline', '', 'width:18px;height:18px;color:var(--mu)')}<span class="mu">Buscar por país, nombre o código</span></div>
 <div class="list" style="margin-top:10px">
  ${pick('🇺🇸', 'USD', 'Dólar estadounidense', '', true)}
  ${pick('🇪🇺', 'EUR', 'Euro', '', true)}
  ${pick('🇬🇧', 'GBP', 'Libra esterlina')}
  ${pick('🇧🇷', 'BRL', 'Real brasileño')}
  ${pick('🇨🇱', 'CLP', 'Peso chileno', 'Sin fuente automática: escribes su tasa')}
  ${pick('🇵🇪', 'PEN', 'Sol peruano', 'Sin fuente automática: escribes su tasa')}
  ${pick('🇯🇵', 'JPY', 'Yen japonés')}</div>`);

// Choosing the main currency: every total, chart and report is said in it.
S['37d-moneda-principal'] = list.replace('Tus monedas en pesos', 'Tus monedas en dólares') + sheet(`<div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><b style="flex:1;text-align:center;font-size:17px">Moneda principal</b><span style="width:70px"></span></div>
 <div class="sub" style="margin:8px 0 12px;text-align:center">Tu patrimonio, tus gráficos, tus reportes y tus topes se muestran en esta moneda. Tus movimientos no cambian.</div>
 <div class="list">
  <div class="row">${flag('🇨🇴', 38)}<div class="tx"><b>COP · Peso colombiano</b></div><span class="tick"></span></div>
  <div class="row">${flag('🇺🇸', 38)}<div class="tx"><b>USD · Dólar estadounidense</b></div><span class="tick on">${ic('checkmark')}</span></div>
  <div class="row">${flag('🇪🇺', 38)}<div class="tx"><b>EUR · Euro</b></div><span class="tick"></span></div></div>
 <div class="hint" style="margin-top:10px">Solo en pesos colombianos: el simulador de renta, los préstamos en UVR y la comparación con la inflación del DANE.</div>`);

// A currency no account uses can be removed from its sheet (Jose, 2026-10-19).
// COP and the main currency never offer it; one in use says why not.
const withJpy = list.replace(row('🇲🇽', 'MXN', 'Peso mexicano', 'En 1 cuenta', '211,35', 'Automática · hoy', C.grn), row('🇯🇵', 'JPY', 'Yen japonés', 'Sin cuentas', '26,10', 'Automática · hoy', C.grn));
const jpySheet = sheet(`<div style="text-align:center">${flag('🇯🇵', 56).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="font-size:18px">JPY · Yen japonés</b>
 <div class="sub" style="margin-top:4px">Cuánto vale un yen en pesos hoy</div></div>
 <div class="list" style="margin-top:14px">
  <div class="row"><div class="tx"><b>Tasa oficial de hoy</b><small>BCE × TRM oficial · se usa ahora</small></div><div class="am">26,10</div></div></div>
 ${btn('Escribir otra tasa', true)}
 <div class="hint" style="margin-top:12px;text-align:center">Ninguna cuenta usa esta moneda.</div>
 <div class="btn ghost" style="margin-top:8px;color:var(--red);border-color:${tint(C.red, .5)}">${ic('trash-outline', '', 'width:18px;height:18px')}Quitar el yen japonés</div>`);
S['37e-quitar-moneda-sin-uso'] = withJpy + jpySheet;
S['37f-quitar-moneda-confirmar'] = withJpy + jpySheet + `<div class="scrim"></div><div class="dialog" style="text-align:center">${flag('🇯🇵', 54).replace('display:grid', 'display:grid;margin:0 auto 10px')}
 <b style="font-size:18px">¿Quitar el yen japonés?</b>
 <div class="mu" style="font-size:13.5px;margin-top:8px;line-height:1.45">Sale de tus monedas junto con sus tasas guardadas. Ninguna cuenta la usa, así que ningún saldo cambia. Puedes volver a agregarla cuando quieras.</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><div class="btn ghost">Cancelar</div><div class="btn" style="background:var(--red)">Sí, quitarla</div></div></div>`;
S['37g-moneda-en-uso'] = list + sheet(`<div style="text-align:center">${flag('🇲🇽', 56).replace('display:grid', 'display:grid;margin:0 auto 8px')}<b style="font-size:18px">MXN · Peso mexicano</b>
 <div class="sub" style="margin-top:4px">Cuánto vale un peso mexicano en pesos hoy</div></div>
 <div class="list" style="margin-top:14px">
  <div class="row"><div class="tx"><b>Tasa oficial de hoy</b><small>BCE × TRM oficial · se usa ahora</small></div><div class="am">211,35</div></div></div>
 ${btn('Escribir otra tasa', true)}
 <div class="hint" style="margin-top:12px;text-align:center">La usa 1 cuenta, por eso no se puede quitar.</div>`);

export default S;
