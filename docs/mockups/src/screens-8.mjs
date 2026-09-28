// Group 8 (v4, 2026-09-28): Más, Importar y exportar, and Google. What the
// app does today in the drawer (every destination), features/export and
// features/account: the backup saved and restored (asked the moment the file
// is chosen, naming it, the warning inside the dialog, "no" back to the
// picker), the CSV; Google - sign in, sign out, save now, bring the Drive
// copy back, save by itself on leaving, what is up there, replace only what
// this device has seen and keep the old copy aside; language and theme.
// Drawn with the rules of groups 1-7: one row shape (round tinted icon,
// title, grey second line with the current value), counts that say what
// they count, explanations behind an (i), no dead ends.
import { ic, ci, sq, C, chev, sw, top, tabs, tint, bigTitle } from './lib.mjs';
import { infoDot } from './screens-1.mjs';

const S = {};
const centred = (html, gap = 12) => html.replace('display:grid', `display:grid;margin:0 auto ${gap}px`);
const bubble = (top, arrowRight, text) => `<div style="position:absolute;left:24px;right:24px;top:${top}px;background:#26324f;border:1px solid #3a4a72;border-radius:14px;padding:11px 13px;font-size:13px;line-height:1.4;color:#e3e8f4;box-shadow:0 10px 26px rgba(0,0,0,.5)">
 <span style="position:absolute;top:-7px;right:${arrowRight}px;width:12px;height:12px;background:#26324f;border-left:1px solid #3a4a72;border-top:1px solid #3a4a72;transform:rotate(45deg)"></span>${text}</div>`;
const toast = t => `<div style="position:absolute;left:24px;right:24px;bottom:104px;background:#1e2b47;border:1px solid #33456f;border-radius:16px;padding:11px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 10px 26px rgba(0,0,0,.55);font-size:13.5px">${ic('checkmark-circle', '', `width:20px;height:20px;color:${C.grn};flex:none`)}<span>${t}</span></div>`;
const dialog = (icon, title, body, no, yes, danger = false) => `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(icon)}<b style="font-size:18px">${title}</b>
 <div class="sub" style="margin-top:8px;line-height:1.45">${body}</div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ghost" style="flex:1">${no}</div><div class="btn${danger ? ' danger' : ''}" style="flex:1">${yes}</div></div></div>`;
const row = (icon, t, s, right = chev()) => `<div class="row">${icon}<div class="tx"><b class="one">${t}</b>${s ? `<small class="one">${s}</small>` : ''}</div>${right}</div>`;
const photo = (size = 50) => `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--pr),${C.pur});display:grid;place-items:center;font-weight:700;font-size:${Math.round(size * .4)}px;flex:none">J</div>`;

// 1. Más: whose Google account it is, then everything the drawer held that
//    is not a tab, grouped, each row saying its current value. The dot on
//    the tab says something waits in "Movimientos por revisar".
const count = (n, t) => `<span style="background:${tint(C.blu, .2)};color:#c3cdfa;border-radius:10px;padding:2px 9px;font-size:12px;white-space:nowrap">${n} ${t}</span>`;
S['8a-mas'] = `${bigTitle('Más')}<main style="padding-top:6px">
 <div class="card hero" style="display:flex;align-items:center;gap:14px">${photo()}<div style="flex:1;min-width:0"><b class="one" style="font-size:16px;display:block">Jose</b><div class="sub one">Copia en Drive · hoy 8:12 a. m.</div></div>${chev()}</div>
 <div class="h">Tus datos</div><div class="list">
  ${row(sq('checkmark-done-outline', C.blu, 40), 'Movimientos por revisar', '<span style="color:#c3cdfa">18 movimientos esperan tu respuesta</span>', '<span style="width:9px;height:9px;border-radius:50%;background:var(--red);flex:none"></span>' + chev())}
  ${row(sq('pricetags-outline', C.pur, 40), 'Categorías', '22 categorías · 3 archivadas')}
  ${row(sq('notifications-outline', C.yel, 40), 'Avisos del banco', '2 apps marcadas')}
  ${row(sq('swap-vertical-outline', C.tea, 40), 'Importar y exportar', 'Copia de seguridad y CSV')}</div>
 <div class="h">Herramientas</div><div class="list">
  ${row(sq('calculator-outline', C.org, 40), 'Simulador de renta', 'Formulario 210 · año 2026')}</div>
 <div class="h">Preferencias</div><div class="list">
  ${row(sq('language-outline', C.cya, 40), 'Idioma', 'Español')}
  ${row(sq('contrast-outline', C.pnk, 40), 'Apariencia', 'Automático, como el teléfono')}</div>
 <div style="height:110px"></div></main><div class="fade"></div>${tabs('Más', true)}`;

// 2. Language and appearance: a sheet each, the current one ticked.
const choice = (title, opts) => `<div class="scrim"></div><div class="sheet"><div class="grab"></div><b style="display:block;text-align:center;font-size:17px;margin-bottom:12px">${title}</b>
 <div class="list">${opts.map(([i, c, t, s, on]) => row(ci(i, c, 38), t, s, on ? ic('checkmark', 'p', 'width:20px;height:20px') : '')).join('')}</div></div>`;
S['8b-idioma'] = S['8a-mas'] + choice('Idioma', [['text-outline', C.cya, 'Español', 'Los nombres de tus cuentas y categorías no cambian', true], ['text-outline', C.blu, 'English', '', false]]);
S['8c-apariencia'] = S['8a-mas'] + choice('Apariencia', [['phone-portrait-outline', C.pnk, 'Automático', 'Como esté el teléfono', true], ['sunny-outline', C.yel, 'Claro', '', false], ['moon-outline', C.pur, 'Oscuro', '', false]]);

// 3. Importar y exportar: the backup (save it, restore one), the CSV, and
//    the way to the Drive copy. Each warning is one (i).
const exportPage = (after = '') => `${top('Importar y exportar')}<main>
 <div class="card" style="padding:14px"><div style="display:flex;gap:12px;align-items:center">${ci('shield-checkmark-outline', C.grn, 44)}<div style="flex:1;min-width:0"><b style="display:flex;gap:8px;align-items:center">Copia de seguridad ${infoDot}</b><small class="mu" style="font-size:12.5px;display:block;margin-top:2px;line-height:1.35">Todo lo de la app en un archivo que se puede volver a cargar, imágenes incluidas</small></div></div>
  <div class="btn" style="margin-top:12px">${ic('download-outline')}Guardar copia de seguridad</div>
  <div class="btn ghost" style="margin-top:8px">${ic('refresh-outline')}Restaurar desde un archivo</div></div>
 <div class="card" style="padding:14px;margin-top:10px"><div style="display:flex;gap:12px;align-items:center">${ci('grid-outline', C.tea, 44)}<div style="flex:1;min-width:0"><b style="display:flex;gap:8px;align-items:center">CSV para leer ${infoDot}</b><small class="mu" style="font-size:12.5px;display:block;margin-top:2px;line-height:1.35">Tus movimientos en una tabla que abre Excel</small></div></div>
  <div class="btn ghost" style="margin-top:12px">${ic('download-outline')}Descargar CSV</div></div>
 <div class="list" style="margin-top:10px">${row(sq('logo-google', C.blu, 40), 'Copia en Google Drive', 'Se guarda sola · hoy 8:12 a. m.')}</div>
 </main>${tabs('Más')}${after}`;
S['8d-importar-exportar'] = exportPage();
S['8e-copia-ayuda'] = exportPage() + bubble(168, 214, 'Esta base de datos vive solo en este teléfono. Si lo pierdes y no tienes esta copia, se pierde todo: guárdala fuera del teléfono.');
S['8f-csv-ayuda'] = exportPage() + bubble(352, 250, 'Sirve para revisar o pasárselo a alguien, pero no para restaurar: un CSV no guarda qué parte pertenece a cuál transferencia ni qué corregiste a mano.');
S['8g-copia-guardada'] = exportPage(toast('Se guardó finance-2026-09-28.json'));

// 4. Restoring: asked the moment the file is chosen, naming it and saying
//    what it holds, the warning inside; "Escoger otro" goes back to the
//    picker.
S['8h-restaurar'] = exportPage() + `<div class="scrim"></div><div class="dialog">
 <div style="text-align:center">${centred(ci('refresh-outline', C.org, 54))}<b style="font-size:18px">¿Reemplazar todo con finance-2026-09-20.json?</b></div>
 <div class="list" style="margin-top:12px">${[['Guardado el', '20 sept 2026'], ['Movimientos', '13.214 movimientos'], ['Cuentas', '19 cuentas']].map(([k, v]) => `<div class="row plain" style="padding:8px 12px"><div class="tx"><small style="margin:0">${k}</small></div><b>${v}</b></div>`).join('')}</div>
 <div class="banner" style="background:${tint(C.red, .14)};color:#ffb4b9;margin-top:10px">${ic('alert-circle-outline')}<span>Borra todo lo que hay hoy en la app y lo reemplaza por lo del archivo. Lo que no esté en el archivo se pierde.</span></div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Escoger otro</div><div class="btn danger" style="flex:1">Sí, reemplazar</div></div></div>`;
S['8i-restaurando'] = exportPage() + `<div class="scrim"></div><div class="dialog" style="text-align:center">${centred(ci('refresh-outline', C.blu, 54))}<b style="font-size:18px">Restaurando tus datos</b>
 <div class="sub" style="margin-top:6px">Paso 3 de 7</div><div class="pbar" style="margin-top:12px;height:8px"><i style="width:43%;background:var(--pr)"></i></div>
 <div class="sub" style="margin-top:10px;font-size:12.5px">No cierres la app mientras termina.</div></div>`;

// 5. Google, not signed in: what it is, the three promises, one button.
const promise = (i, t) => `<div class="row">${ci(i, C.grn, 36)}<div class="tx"><small style="color:var(--tx);font-size:14px;margin:0;white-space:normal;line-height:1.4">${t}</small></div></div>`;
S['8j-google-sin-sesion'] = `${top('Copia en Google Drive')}<main>
 <div style="text-align:center;margin-top:10px">${centred(ci('logo-google', C.blu, 72))}<b style="font-size:19px">Guarda una copia en tu Drive</b>
  <div class="sub" style="margin:6px 12px 0;line-height:1.45">Opcional. La app funciona igual sin conectarte: tus datos viven en este teléfono.</div></div>
 <div class="list" style="margin-top:14px">${promise('phone-portrait-outline', 'Todo sigue guardándose en el teléfono, incluso sin internet.')}${promise('lock-closed-outline', 'La copia va a una carpeta de tu propio Drive que solo esta app puede ver.')}${promise('server-outline', 'No pasa por ningún servidor nuestro.')}</div>
 </main><div style="position:absolute;left:16px;right:16px;bottom:112px;height:52px;border-radius:16px;background:#fff;color:#1f1f1f;display:flex;gap:10px;align-items:center;justify-content:center;font-weight:600">${ic('logo-google', '', 'width:20px;height:20px;color:#4285f4')}Continuar con Google</div>${tabs('Más')}`;

// 6. Signed in: whose account; the copy up there (when, how much); save now
//    and bring it back; saving by itself; changing account; signing out.
const googlePage = (after = '', saving = false) => `${top('Copia en Google Drive')}<main>
 <div class="card hero" style="display:flex;align-items:center;gap:14px">${photo(52)}<div style="flex:1;min-width:0"><b class="one" style="display:block">Jose</b><div class="sub one">jose.ejemplo@gmail.com</div></div></div>
 <div class="card" style="margin-top:10px"><div style="display:flex;align-items:center;gap:8px"><span class="lab" style="flex:1">La copia en tu Drive</span>${infoDot}</div>
  <div class="mini" style="margin-top:8px"><div><span class="lab">Guardada</span><b>Hoy 8:12 a. m.</b></div><div><span class="lab">Tiene</span><b>13.402 registros</b></div></div>
  ${saving ? `<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:13.5px"><span>Subiendo a Drive</span><span class="p">62 %</span></div><div class="pbar" style="margin-top:6px;height:7px"><i style="width:62%;background:var(--pr)"></i></div></div>`
    : `<div style="display:flex;gap:10px;margin-top:12px"><div class="btn" style="flex:1;font-size:14px">${ic('cloud-upload-outline')}Guardar ahora</div><div class="btn ghost" style="flex:1;font-size:14px">${ic('cloud-download-outline')}Traer la copia</div></div>`}</div>
 <div class="list" style="margin-top:10px"><div class="row"><div class="tx"><b style="display:flex;gap:8px;align-items:center">Guardar la copia sola ${infoDot}</b><small>Sube cuando sales de la app</small></div>${sw(true)}</div></div>
 <div class="list" style="margin-top:10px">${row(sq('swap-horizontal', C.blu, 40), 'Cambiar de cuenta de Google', 'Entras con otra; tus datos no se mueven')}
  ${row(sq('log-out-outline', C.red, 40), '<span class="r">Cerrar sesión</span>', 'Tus datos se quedan en el teléfono', '')}</div>
 </main>${tabs('Más')}${after}`;
S['8k-google-con-sesion'] = googlePage();
S['8l-guardar-sola-ayuda'] = googlePage() + bubble(388, 206, 'La copia sube cuando sales de la app, que es cuando no estorba. Si Android corta la app antes de terminar, se sube al volver a abrirla. Cada subida es la base completa.');
S['8m-subiendo'] = googlePage('', true);

// 7. Bringing the Drive copy back: the question, with what it replaces.
S['8n-traer-la-copia'] = googlePage() + dialog(ci('cloud-download-outline', C.org, 54), '¿Traer la copia de Drive?',
  'Reemplaza TODO lo que tienes en este teléfono por la copia guardada hoy 8:12 a. m. (13.402 registros). Lo que esté aquí y no esté allá se pierde.', 'Cancelar', 'Sí, reemplazar', true);

// 8. Saving over a copy this device has never seen: when it was written,
//    how much it holds, and that it is kept aside, not lost.
S['8o-reemplazar-copia-ajena'] = googlePage() + `<div class="scrim"></div><div class="dialog">
 <div style="text-align:center">${centred(ci('cloud-outline', C.yel, 54))}<b style="font-size:18px">¿Reemplazar la copia de Drive?</b></div>
 <div class="sub" style="margin-top:8px;line-height:1.45;text-align:center">La que hay se guardó el 26 sept a las 9:40 p. m. y este teléfono nunca la ha visto: viene de otro lado.</div>
 <div class="list" style="margin-top:12px"><div class="row plain" style="padding:8px 12px"><div class="tx"><small style="margin:0">Tiene</small></div><b>12.998 registros</b></div></div>
 <div style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px;color:#a7ecc9">${ic('shield-checkmark-outline', '', 'width:17px;height:17px;flex:none')}<span>No se pierde: queda guardada aparte, con su fecha.</span></div>
 <div style="display:flex;gap:10px;margin-top:14px"><div class="btn ghost" style="flex:1">Cancelar</div><div class="btn" style="flex:1">Reemplazarla</div></div></div>`;
S['8p-copia-anterior-guardada'] = googlePage(toast('La copia anterior quedó guardada como finance-backup-replaced-2026-09-26.json'));

// 9. Changing account: Android's own chooser.
S['8q-cambiar-de-cuenta'] = googlePage() + `<div class="scrim"></div><div class="sheet" style="background:#f3f6fc;color:#1f1f1f;border-top:0"><div class="grab" style="background:#c4c7cf"></div>
 <div style="text-align:center;margin:6px 0 14px">${ic('logo-google', '', 'width:26px;height:26px;color:#4285f4')}<div style="font-size:18px;margin-top:6px">Elige una cuenta</div><div style="font-size:13px;color:#5f6368;margin-top:2px">para continuar a Finance</div></div>
 ${[['J', 'Jose', 'jose.ejemplo@gmail.com'], ['J', 'Jadex Labs', 'jadex.ejemplo@gmail.com']].map(([l, n, e]) => `<div style="display:flex;gap:12px;align-items:center;padding:11px 6px;border-bottom:1px solid #dadce0"><div style="width:36px;height:36px;border-radius:50%;background:#6378ff;color:#fff;display:grid;place-items:center;font-weight:600">${l}</div><div><div style="font-size:15px">${n}</div><div style="font-size:13px;color:#5f6368">${e}</div></div></div>`).join('')}
 <div style="display:flex;gap:12px;align-items:center;padding:13px 6px">${ic('person-add-outline', '', 'width:22px;height:22px;color:#5f6368')}<span style="font-size:15px">Usar otra cuenta</span></div></div>`;

// 10. In the browser: the Drive copy belongs to the phone, and it says why -
//     then points to what does work here.
S['8r-google-en-el-navegador'] = `${top('Copia en Google Drive')}<main style="padding-top:70px;text-align:center">${centred(ci('phone-portrait-outline', C.blu, 80), 16)}
 <b style="font-size:19px">Se conecta desde la app del teléfono</b>
 <div class="sub" style="margin:8px 22px 0;line-height:1.45">El navegador tiene su propia base de datos, la de tus pruebas: si se conectara desde aquí podría subirla encima de la buena.</div>
 <div class="btn ghost" style="margin:22px 30px 0">${ic('swap-vertical-outline')}Ir a Importar y exportar</div></main>${tabs('Más')}`;

export default S;
