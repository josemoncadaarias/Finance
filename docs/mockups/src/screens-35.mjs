// Group 35 - a bank message and no account to put it in (Jose, 2026-10-16).
// Proposed: every account list that cannot answer offers "Crear la cuenta",
// the form comes filled with the bank's name, and saving goes back to where
// the person was, with the new account chosen. Every name invented.
import { ic, ci, C, top, tabs, tint } from './lib.mjs';
import G2 from './screens-2.mjs';
import G6 from './screens-6.mjs';

const S = {};
const btn = (t, style = '') => `<div style="height:50px;border-radius:16px;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;font-weight:700;font-size:15.5px;${style}">${t}</div>`;
const head = (title, sub) => `<div style="display:flex;align-items:center"><span class="p" style="font-size:14.5px;width:70px">Cancelar</span><div style="flex:1;text-align:center"><b style="font-size:17px">${title}</b><div class="mu" style="font-size:12.5px">${sub}</div></div><span style="width:70px"></span></div>`;
const nequi = (size = 40) => ci('phone-portrait-outline', C.pur, size);
const createRow = `<div class="list" style="margin-top:10px"><div class="row">${ci('add', C.pur, 40)}<div class="tx"><b>Crear la cuenta Nequi</b><small>Lista en un paso, y vuelves aquí</small></div>${ic('chevron-forward-outline', 'chev')}</div></div>`;
const empty = `<div style="text-align:center;padding:14px 8px 4px">${ci('wallet-outline', C.blu, 56).replace('display:grid', 'display:grid;margin:0 auto 10px')}
 <b style="font-size:16px">Aún no tienes cuentas</b><div class="sub" style="margin-top:4px">Crea la de este banco y queda lista.</div></div>
 ${btn(`<span style="display:inline-flex;gap:6px;align-items:center">${ic('add', '', 'width:20px;height:20px')}Crear la cuenta Nequi</span>`, 'margin-top:14px')}`;
const sheet = inner => `<div class="scrim"></div><div class="sheet"><div class="grab"></div>${inner}<div style="height:12px"></div></div>`;

// 1. Turning a bank on with no account yet.
const notices = `${top('Notificaciones del teléfono')}<main>
 <div class="list" style="margin-top:8px"><div class="row">${nequi()}<div class="tx"><b>Nequi</b><small>App · 3 mensajes con dinero</small></div><div class="sw on"></div></div></div>
 <div style="height:110px"></div></main>${tabs('Más')}`;
S['35a-activar-sin-cuentas'] = notices + sheet(`${head('¿De qué cuenta es?', 'Nequi · App')}${empty}`);

// 2. A movement waiting, no account: the form's account list says the same.
const review = G6['6e-revisar-un-movimiento']
  .replace('26/09 COMPRA EXITO POB MEDELLIN −112.500,00 1.206.900,00', 'Nequi: Pagaste $45.900 en EXITO')
  .replace('112.500', '45.900').replace('del extracto', 'tal como vino');
// The app's own keypad is gone (#45): the phone's keyboard, and Guardar at the foot.
const formOnly = html => html.slice(0, html.indexOf('</main>') + 7) + `<div style="position:absolute;left:16px;right:16px;bottom:24px">${btn('Guardar')}</div>`;
const reviewNone = formOnly(review.replace('>Banco Azul<', ' style="color:var(--yel)">Elige la cuenta<'));
const reviewNequi = formOnly(review.replace('Banco Azul', 'Nequi'));
S['35b-revisar-sin-cuentas'] = reviewNone + sheet(`${head('Desde dónde', 'Nequi te avisó')}${empty}`);

// 3. The account form, already with the bank's name; only the type is left.
S['35c-cuenta-ya-llena'] = G2['2f-nueva-cuenta']
  .replace(/<div class="list">[\s\S]*?o escríbela tú<\/div>/, `<div style="display:flex;gap:10px;align-items:center;background:${tint(C.pur, .12)};border:1px solid ${tint(C.pur, .45)};border-radius:14px;padding:10px 12px;font-size:13.5px">${ic('notifications-outline', '', `width:19px;height:19px;color:${C.pur};flex:none`)}<span>Para tus mensajes de <b>Nequi</b>. Al guardar vuelves al movimiento.</span></div><div style="height:14px"></div>`)
  .replace('Nombre de la cuenta', 'Nequi').replace('class="v one mu"', 'class="v one"');

// 4. Back where it was: the account chosen, the movement ready to save.
const toast = t => `<div style="position:absolute;left:24px;right:24px;bottom:96px;background:#1e2b47;border:1px solid #33456f;border-radius:16px;padding:11px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 26px rgba(0,0,0,.55);font-size:13.5px">${ic('checkmark-circle', '', `width:20px;height:20px;color:${C.grn};flex:none`)}<span>${t}</span></div>`;
S['35d-de-vuelta-con-la-cuenta'] = reviewNequi + toast('Cuenta Nequi creada. Sus 3 mensajes ya la tienen.');

// 5. With accounts, but not this bank's: "Crear la cuenta" at the foot.
const acc = (i, c, t, s) => `<div class="row">${ci(i, c, 40)}<div class="tx"><b class="one">${t}</b><small>${s}</small></div></div>`;
S['35e-con-cuentas-pero-no-esta'] = notices + sheet(`${head('¿De qué cuenta es?', 'Nequi · App')}
 <div class="list" style="margin-top:12px">${acc('wallet-outline', C.blu, 'Banco Azul', 'Bancaria')}${acc('card-outline', C.yel, 'Tarjeta Coral', 'Tarjeta')}</div>${createRow}`);

export default S;
