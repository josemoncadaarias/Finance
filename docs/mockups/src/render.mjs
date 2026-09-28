// Renders every mockup to docs/mockups/*.png.
//   MOCK_DEPS=<dir with playwright-core and @fontsource/roboto> node docs/mockups/src/render.mjs [filter]
// MOCK_CHROME points at a Chromium binary when Playwright's own is not installed.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { page } from './lib.mjs';
import G1 from './screens-1.mjs';
import G2 from './screens-2.mjs';
import G3 from './screens-3.mjs';
import Cc from './screens-c.mjs';
import D from './screens-d.mjs';

const require = createRequire((process.env.MOCK_DEPS ?? process.cwd()) + '/');
const { chromium } = require('playwright-core');
const out = new URL('../', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// The accent, three candidates side by side, for Jose to choose.
const swatch = (name, hex, hex2, note) => `<div style="flex:1;background:#111b2f;border:1px solid #1f2c47;border-radius:20px;padding:14px">
 <div style="height:64px;border-radius:14px;background:linear-gradient(135deg,${hex},${hex2})"></div>
 <b style="display:block;margin-top:10px;font-size:15px">${name}</b><div style="color:#8e9ab2;font-size:12px">${hex}</div>
 <div style="margin-top:10px;height:40px;border-radius:13px;background:linear-gradient(135deg,${hex},${hex2});display:grid;place-items:center;font-weight:700;font-size:13px">Guardar</div>
 <div style="margin-top:8px;height:36px;border-radius:12px;background:${hex}33;color:${hex};display:grid;place-items:center;font-weight:600;font-size:13px">Inicio</div>
 <div style="color:#aab4c8;font-size:12px;margin-top:10px;line-height:1.35">${note}</div></div>`;
const accents = `<div style="padding:20px 16px"><div style="font-size:21px;font-weight:700">El azul de la app</div>
 <div style="color:#8e9ab2;font-size:13px;margin:4px 0 16px">Sacado de la billetera del ícono, más claro para fondo oscuro. Hoy: ${'#4d8dff'} (el azul por defecto de Ionic).</div>
 <div style="display:flex;gap:10px">${swatch('Zafiro', '#6378ff', '#4a5ef0', 'Recomendado. El azul del ícono, con un toque violeta: propio y tranquilo.')}${swatch('Cobalto', '#3f7bf2', '#2f5fd8', 'Más cerca del de hoy, un poco más profundo.')}</div>
 <div style="display:flex;gap:10px;margin-top:10px">${swatch('Índigo', '#7c6cff', '#6352f0', 'Más violeta: se distingue de todos los bancos.')}${swatch('Hoy', '#4d8dff', '#3a6fe0', 'El que tiene la app ahora.')}</div></div>`;

const all = { '00-azul-opciones': accents, ...G1, ...G2, ...G3, ...Cc, ...D };
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.MOCK_CHROME });
const p = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
let n = 0;
for (const [name, body] of Object.entries(all)) {
  if (only && !name.includes(only)) continue;
  await p.setContent(page(body));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `${out}${name}.jpg`, type: 'jpeg', quality: 86 });
  n++;
}
await browser.close();
console.log(`${n} mockups in ${out}`);
