// Shared look of the mockups: tokens, helpers and the pieces every screen uses.
// Mockups only - nothing here is app code. See docs/mockups/README.md.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../../', import.meta.url).pathname;
const SVG = join(ROOT, 'node_modules/ionicons/dist/svg/');
const DEPS = process.env.MOCK_DEPS ?? '';
const FONT = join(DEPS, 'node_modules/@fontsource/roboto/files/');

const font = w => {
  const f = `${FONT}roboto-latin-${w}-normal.woff2`;
  return existsSync(f) ? `@font-face{font-family:R;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(f).toString('base64')})}` : '';
};
export const ic = (name, cls = '', style = '') =>
  `<span class="ic ${cls}" style="${style}">${readFileSync(SVG + name + '.svg', 'utf8')}</span>`;

// The accent. "Zafiro": the wallet of the app's own icon, lifted for a dark
// background. Not Ionic's default blue (#4d8dff) and not a competitor's teal.
export const ACCENT = process.env.MOCK_ACCENT ?? '#6378ff';
export const ACCENT2 = process.env.MOCK_ACCENT2 ?? '#4a5ef0';

// Sixteen colours at one lightness, so no category shouts over another.
export const PALETTE = {
  coral: '#ff6b6b', mandarina: '#ff9152', ambar: '#f6b93b', oro: '#e8c15a',
  lima: '#a3d65c', esmeralda: '#34c98b', menta: '#5fd8bf', turquesa: '#2ec4b6',
  cielo: '#4cb8f5', zafiro: '#6378ff', violeta: '#9b7bff', orquidea: '#d07bf0',
  rosa: '#f2709c', cereza: '#e0525e', arena: '#d4a373', pizarra: '#8c9bb5',
};
const P = PALETTE;
export const C = { red: P.coral, grn: P.esmeralda, blu: ACCENT, yel: P.ambar, pur: P.violeta, org: P.mandarina,
  pnk: P.rosa, tea: P.turquesa, cya: P.cielo, lim: P.lima, gry: P.pizarra, brn: P.arena, gold: P.oro, orq: P.orquidea };
export const tint = (hex, a = .16) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// Categories are rounded squares, accounts are circles: the shape says which.
export const sq = (i, c, size = 42) => `<span class="sq" style="display:grid;width:${size}px;height:${size}px;background:${tint(c)};color:${c}">${ic(i)}</span>`;
export const ci = (i, c, size = 42) => `<span class="ci" style="display:grid;width:${size}px;height:${size}px;background:${tint(c)};color:${c}">${ic(i)}</span>`;
export const chev = () => ic('chevron-forward-outline', 'chev');
export const down = () => ic('chevron-down-outline', 'chev');
export const tick = on => on ? `<span class="tick on">${ic('checkmark')}</span>` : '<span class="tick"></span>';
export const tag = (t, c) => `<span class="tag" style="background:${tint(c, .18)};color:${c}">${t}</span>`;
export const sw = on => `<div class="sw ${on ? 'on' : ''}"></div>`;

export const CAT = {
  vivienda: ['home-outline', C.org, 'Vivienda'], mercado: ['basket-outline', C.grn, 'Mercado'],
  rest: ['restaurant-outline', C.red, 'Restaurantes'], transp: ['bus-outline', C.cya, 'Transporte'],
  salud: ['medkit-outline', C.pnk, 'Salud'], ropa: ['shirt-outline', C.pur, 'Ropa'],
  ocio: ['game-controller-outline', C.tea, 'Entretenimiento'], educ: ['school-outline', C.blu, 'Educación'],
  servicios: ['flash-outline', C.yel, 'Servicios'], salario: ['briefcase-outline', C.grn, 'Salario'],
  honorarios: ['laptop-outline', C.cya, 'Honorarios'], ganancia: ['trending-up-outline', C.lim, 'Ganancia de inversión'],
  perdida: ['trending-down-outline', C.red, 'Pérdida de inversión'], regalo: ['gift-outline', C.orq, 'Regalos'],
  cashback: ['sparkles-outline', C.gold, 'Cashback'], correccion: ['construct-outline', C.gry, 'Corrección del banco'],
};
export const catIcon = (k, size = 42) => sq(CAT[k][0], CAT[k][1], size);
export const ACC = {
  coral: ['card-outline', C.yel, 'Tarjeta Coral'], azul: ['wallet-outline', C.blu, 'Banco Azul'],
  verde: ['leaf-outline', C.grn, 'Ahorro Verde'], efectivo: ['cash-outline', C.lim, 'Efectivo'],
  naranja: ['cube-outline', C.org, 'Cajita Naranja'], dolar: ['logo-usd', C.cya, 'Cuenta Dólar'],
  ambar: ['trending-up-outline', C.gold, 'Fiducia Ámbar'], global: ['globe-outline', C.tea, 'Global Viajes'],
};
export const accIcon = (k, size = 42) => ci(ACC[k][0], ACC[k][1], size);

export const css = `
${font(400)}${font(500)}${font(700)}
:root{--bg:#070d1a;--top:#0d1527;--s1:#111b2f;--s2:#18243d;--s3:#213050;--line:#1f2c47;--tx:#eef2f9;--mu:#8e9ab2;
 --pr:${ACCENT};--pr2:${ACCENT2};--red:${C.red};--grn:${C.grn};--yel:${C.yel}}
*{box-sizing:border-box;margin:0;padding:0}
body{width:412px;height:915px;background:var(--bg);color:var(--tx);font-family:R,Roboto,'Liberation Sans',sans-serif;overflow:hidden;position:relative;font-size:15px}
.ic{display:inline-flex;width:22px;height:22px;flex:none}.ic svg{width:100%;height:100%;fill:currentColor;stroke:currentColor}.ic svg [fill=none]{fill:none}
.sq,.ci{display:grid;place-items:center;flex:none}.sq{border-radius:30%}.ci{border-radius:50%}.sq .ic,.ci .ic{width:48%;height:48%}
.status{height:28px;display:flex;justify-content:space-between;padding:6px 22px;font-size:13px;color:#cfd6e4}
.bar-top{background:var(--top);padding:4px 16px 12px;border-bottom:1px solid #15203a}
.tt{display:flex;align-items:center;gap:12px;min-height:44px}
.tt h1{font-size:20px;font-weight:700;flex:1;min-width:0}.tt h1 small{display:block;font-size:12.5px;color:var(--mu);font-weight:400;margin-top:1px}
.btn-r{width:40px;height:40px;border-radius:50%;background:var(--s1);display:grid;place-items:center;color:#d7deea;flex:none}
.btn-r .ic{width:21px;height:21px}.btn-r.on{background:${tint(ACCENT, .2)};color:var(--pr)}
.back{color:#d7deea}
main{padding:12px 16px 0}
.card{background:var(--s1);border-radius:20px;padding:16px;border:1px solid #17223b}
.hero{background:linear-gradient(145deg,${tint(ACCENT, .42)} 0%,${tint(ACCENT, .18)} 50%,#111b2f 100%);border:1px solid ${tint(ACCENT, .4)}}
.lab{font-size:11.5px;letter-spacing:1.1px;color:var(--mu);font-weight:500;text-transform:uppercase}
.big{font-size:31px;font-weight:700;margin:4px 0 2px;letter-spacing:-.4px}
.sub{color:var(--mu);font-size:13px;line-height:1.38}
.g{color:var(--grn)}.r{color:var(--red)}.y{color:var(--yel)}.p{color:var(--pr)}.mu{color:var(--mu)}.b{font-weight:700}
.h{font-size:12px;letter-spacing:1.1px;color:var(--mu);font-weight:500;margin:16px 4px 8px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center}
.h .p{letter-spacing:0;text-transform:none;font-size:13px}
.list{background:var(--s1);border-radius:18px;overflow:hidden;border:1px solid #17223b}
.row{display:flex;align-items:center;gap:13px;padding:11px 14px;position:relative}
.row+.row:before{content:'';position:absolute;top:0;left:69px;right:0;height:1px;background:var(--line)}
.row.plain+.row.plain:before,.row.plain+.row:before{left:14px}
.tx{flex:1;min-width:0}.tx b{font-weight:500;font-size:15.3px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tx small{color:var(--mu);font-size:12.8px;display:block;margin-top:2px;line-height:1.35}
.tx .k{font-size:11px;color:var(--mu);display:block;margin-bottom:1px;letter-spacing:.3px}
.am{text-align:right;font-weight:500;font-size:15px;white-space:nowrap}.am small{display:block;font-size:12px;font-weight:400;margin-top:2px}
.chev{color:#5f6d88;width:18px;height:18px}
.sw{width:46px;height:28px;border-radius:14px;background:#2a3857;position:relative;flex:none}
.sw:after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#dfe5f0}
.sw.on{background:var(--pr)}.sw.on:after{left:21px;background:#fff}
.pill{font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:10px;background:var(--pr);color:#fff}
.tag{font-size:11px;font-weight:500;padding:2px 7px;border-radius:7px;display:inline-block;vertical-align:1px}
.seg{display:flex;background:var(--s1);border-radius:14px;padding:4px;gap:4px;border:1px solid #17223b}
.seg div{flex:1;text-align:center;padding:9px 4px;border-radius:11px;color:var(--mu);font-weight:500;font-size:13.6px;display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.seg .on{background:var(--s3);color:var(--tx)}.seg .on.red{background:${tint(C.red, .2)};color:var(--red)}
.seg .on.grn{background:${tint(C.grn, .2)};color:var(--grn)}.seg .on.blu{background:${tint(ACCENT, .24)};color:var(--pr)}
.seg .ic{width:17px;height:17px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:14px;background:var(--s1);border:1px solid #1f2c47;font-size:13.8px;white-space:nowrap}
.chip.on{border-color:var(--pr);background:${tint(ACCENT, .16)};color:#dfe4ff}
.chip.i{padding-left:6px}.chip .sq,.chip .ci{width:27px!important;height:27px!important}
.chip .ic{width:17px;height:17px}
.month{display:flex;align-items:center;justify-content:space-between;background:var(--s1);border-radius:14px;padding:8px 10px;margin-top:10px}
.month span{font-weight:500;color:var(--pr);font-size:15.5px;display:flex;align-items:center;gap:6px}.month .ic{color:#aab4c8;width:20px;height:20px}
nav{position:absolute;left:16px;right:16px;bottom:22px;height:66px;border-radius:33px;background:rgba(17,27,47,.97);border:1px solid #25355a;display:flex;align-items:center;padding:0 6px;box-shadow:0 10px 30px rgba(0,0,0,.6)}
nav div{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:#7f8ba5;font-size:11px;padding:7px 0;border-radius:26px;position:relative}
nav div .ic{width:23px;height:23px}nav .on{background:${tint(ACCENT, .2)};color:var(--pr);font-weight:500}
nav .dot{position:absolute;top:5px;right:26px;width:9px;height:9px;border-radius:50%;background:var(--red);border:2px solid #111b2f}
.fab{position:absolute;right:20px;bottom:104px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;display:grid;place-items:center;box-shadow:0 8px 22px ${tint(ACCENT, .5)}}
.fab .ic{width:30px;height:30px}
.fade{position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(transparent,var(--bg) 55%)}
.scrim{position:absolute;inset:0;background:rgba(2,6,14,.68)}
.sheet{position:absolute;left:0;right:0;bottom:0;background:#0f192c;border-radius:26px 26px 0 0;padding:10px 16px 26px;border-top:1px solid #22314f}
.dialog{position:absolute;left:22px;right:22px;top:50%;transform:translateY(-50%);background:#111c31;border:1px solid #26365a;border-radius:24px;padding:20px}
.grab{width:42px;height:5px;border-radius:3px;background:#34445f;margin:0 auto 12px}
.sh{display:flex;align-items:center;gap:10px;margin-bottom:12px}.sh h2{font-size:19px;flex:1}
.search{display:flex;align-items:center;gap:10px;background:var(--s1);border:1px solid #1f2c47;border-radius:14px;padding:11px 14px;color:var(--mu);font-size:14.5px}
.search .ic{width:19px;height:19px}
.field{background:var(--s1);border-radius:16px;padding:10px 14px;border:1px solid #17223b}
.field .lab{font-size:10.8px}.field .v{font-size:16px;margin-top:3px}
.field.on{border-color:var(--pr)}
.save{position:absolute;left:16px;right:16px;bottom:24px;height:54px;border-radius:17px;background:linear-gradient(135deg,var(--pr),var(--pr2));display:grid;place-items:center;font-weight:700;font-size:16.5px}
.btn{height:48px;border-radius:15px;background:linear-gradient(135deg,var(--pr),var(--pr2));display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:15px}
.btn.ghost{background:var(--s2);color:var(--tx);font-weight:500}.btn.danger{background:${tint(C.red, .18)};color:var(--red)}
.kp{position:absolute;left:0;right:0;bottom:0;background:#0a1222;padding:8px 8px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px;border-top:1px solid #1a2743}
.kp div{height:50px;border-radius:14px;background:#16213a;display:grid;place-items:center;font-size:22px;font-weight:500}
.kp .op{background:${tint(ACCENT, .18)};color:var(--pr)}.kp .ok{background:linear-gradient(135deg,var(--pr),var(--pr2));color:#fff;font-size:16px;font-weight:700}
.kp .ic{width:24px;height:24px}
.amount{text-align:center;padding:12px 0 6px;position:relative}.amount .v{font-size:44px;font-weight:700;letter-spacing:-.8px}
.amount .cur{font-size:15px;color:var(--mu);margin-left:6px;font-weight:500}
.pbar{height:7px;border-radius:4px;background:var(--s3);overflow:hidden;display:flex}.pbar i{display:block;height:100%}
.tick{width:24px;height:24px;border-radius:50%;border:2px solid #3a4a69;flex:none}
.tick.on{border:none;background:var(--pr);display:grid;place-items:center}.tick.on .ic{width:15px;height:15px;color:#fff}
.kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kpi .card{padding:13px 14px}.kpi b{display:block;font-size:19px;margin-top:5px}
.note{font-size:12.5px;color:var(--mu);line-height:1.4}
.bars{display:flex;align-items:flex-end;gap:7px;height:110px;padding-top:6px}
.bars div{flex:1;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--pr),var(--pr2));position:relative}
.bars div i{position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.2);border-radius:0 0 3px 3px}
.months{display:flex;gap:7px;margin-top:6px}.months span{flex:1;text-align:center;font-size:10.5px;color:var(--mu)}
.banner{display:flex;gap:10px;align-items:flex-start;border-radius:14px;padding:11px 12px;font-size:13px;line-height:1.38}
.banner .ic{width:19px;height:19px;margin-top:1px}
.mini{display:flex;gap:8px}.mini>div{flex:1;background:rgba(7,13,26,.35);border-radius:14px;padding:9px 11px}.mini b{display:block;margin-top:3px;font-size:15.5px}
.tabs{display:flex;gap:18px;border-bottom:1px solid var(--line);margin:0 -16px;padding:0 16px}
.tabs div{padding:11px 0;color:var(--mu);font-weight:500;font-size:14.5px}.tabs .on{color:var(--tx);box-shadow:inset 0 -3px 0 var(--pr)}
.hint{font-size:12.5px;color:var(--mu);margin:6px 4px 0;line-height:1.4}
.boxno{font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;background:var(--s3);color:#b9c3d8;margin-left:4px;vertical-align:1px}
.typed{border-left:3px solid ${C.gold};}
.one{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.float-ctl{position:absolute;right:16px;bottom:110px;display:flex;flex-direction:column;gap:8px}
`;

export const status = `<div class="status"><span>9:41</span><span>5G ▮▮▮ 87%</span></div>`;
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');
export const tabs = (on, dot = false) => `<nav>${[['home-outline', 'Inicio'], ['wallet-outline', 'Cuentas'], ['stats-chart-outline', 'Reporte'], ['grid-outline', 'Más']]
  .map(([i, l]) => `<div class="${l === on ? 'on' : ''}">${ic(i)}${l}${dot && l === 'Más' ? '<span class="dot"></span>' : ''}</div>`).join('')}</nav>`;
export const top = (title, { sub = '', left = 'back', right = '', extra = '' } = {}) => `<div class="bar-top">${st}
 <div class="tt">${left === 'back' ? ic('chevron-back-outline', 'back') : left === 'x' ? ic('close', 'back') : left}
 <h1>${title}${sub ? `<small>${sub}</small>` : ''}</h1>${right}</div>${extra}</div>`;
export const bigTitle = (t, right = '') => `${status}<div style="padding:4px 16px 0" class="tt"><h1 style="font-size:25px">${t}</h1>${right}</div>`;
export const M = (v, h) => h ? '••••••' : v;
export const donut = (parts, size = 128) => {
  let off = 0; const rings = parts.map(([p, c]) => { const s = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="6" stroke-dasharray="${p - .7} ${100 - p + .7}" stroke-dashoffset="${-off}"/>`; off += p; return s; }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 42 42" style="transform:rotate(-90deg);flex:none"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#18243d" stroke-width="6"/>${rings}</svg>`;
};
export const page = body => `<!doctype html><html><head><meta charset=utf-8><style>${css}</style></head><body>${body}</body></html>`;
