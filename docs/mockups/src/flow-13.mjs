// Draws docs/mockups/13s-recorrido-prestamo.jpg: how the loan screens lead to one
// another, from the rendered 13* mockups. Run after render.mjs 13:
//   MOCK_DEPS=<dir> MOCK_CHROME=<chrome> node docs/mockups/src/flow-13.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire((process.env.MOCK_DEPS ?? process.cwd()) + '/');
const { chromium } = require('playwright-core');
const dir = '/home/user/Finance/docs/mockups/';
const img = n => `data:image/jpeg;base64,${readFileSync(dir + n + '.jpg').toString('base64')}`;
const card = (n, step, text) => `<div class="c"><div class="s">${step}</div><img src="${img(n)}"><div class="t">${text}</div></div>`;
const arrow = t => t ? `<div class="a"><div>➜</div><small>${t}</small></div>` : '<div class="a"></div>';
const row = (title, items) => `<h2>${title}</h2><div class="r">${items.join('')}</div>`;
const html = `<html><head><meta charset=utf-8><style>
body{margin:0;background:#070d1a;color:#e8edf7;font-family:Roboto,Arial,sans-serif;padding:28px}
h1{font-size:30px;margin:0 0 6px} p.sub{color:#8e9ab2;margin:0 0 18px;font-size:16px}
h2{font-size:20px;margin:26px 0 12px;color:#c3cdfa}
.r{display:flex;align-items:center;gap:10px}
.c{width:240px;flex:none}.c img{width:240px;border-radius:18px;border:1px solid #1f2c47;display:block}
.s{width:30px;height:30px;border-radius:50%;background:#6378ff;display:grid;place-items:center;font-weight:700;margin-bottom:8px}
.t{font-size:14px;color:#aab4c8;margin-top:8px;line-height:1.35;min-height:56px}
.a{width:90px;flex:none;text-align:center;color:#6378ff;font-size:34px}.a small{display:block;font-size:12.5px;color:#aab4c8;line-height:1.3}
</style></head><body>
<h1>Cómo se navega un préstamo</h1><p class="sub">Todo vive en la página del préstamo: Cuentas → Deudas → el préstamo. Arriba tiene tres pestañas: Resumen, Cuotas y Abonar.</p>
${row('Abonar a capital', [
 card('13e-prestamo-resumen', 1, 'Resumen. El aviso azul "Ver cómo" lleva a Abonar (o toca la pestaña).'), arrow('pestaña Abonar'),
 card('13l-abonar-una-vez', 2, 'Abonar, arriba: el monto y Una vez / Cada mes / En primas. Debajo, plazo contra cuota.'), arrow('bajas'),
 card('13m-abonar-cuanto', 3, 'La misma pestaña, más abajo: cuánto ahorras según el monto y los dos botones.'), arrow('Registrar el abono'),
 card('13o-registrar-abono', 4, 'La transferencia de siempre, marcada como abono a capital. Guardar.'), arrow('al guardar'),
 card('13p-cuotas-con-abono', 5, 'Cuotas: el abono aparece en su lugar y las fechas ya cambiaron.')])}
${row('Otras salidas', [
 card('13n-abonar-en-primas', 'A', 'En la pestaña Abonar, tocar "En primas" o "Cada mes" cambia las cifras ahí mismo.'), arrow(''),
 card('13q-pagar-todo', 'B', 'Desde Abonar, "Pagar todo el préstamo": cuánto pagarías hoy. "Pagar todo" abre la transferencia.'), arrow(''),
 card('13i-cuota-vencida', 'C', 'Si una cuota se vence, el Resumen se pone rojo.'), arrow('Pagar la cuota'),
 card('13r-pagar-cuota-con-mora', 'D', 'La transferencia de la cuota, con la mora si el banco la cobró.')])}
</body></html>`;
const browser = await chromium.launch({ executablePath: process.env.MOCK_CHROME });
const p = await browser.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1.5 });
await p.setContent(html); await p.waitForTimeout(300);
await p.screenshot({ path: dir + '13s-recorrido-prestamo.jpg', type: 'jpeg', quality: 85, fullPage: true });
await browser.close();
