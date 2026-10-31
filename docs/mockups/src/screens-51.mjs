// Group 51 - "Puedes gastar hoy" from what the person receives, not from
// everything they have (Jose, 2026-10-31: 230 million free after the goals,
// and a 500 million goal still open; the app must never say "spend it all").
// Proposed, not decided. One idea and one setting:
//   what you receive in a normal month (average of the last 3 whole months)
//   - what you set aside for your goals (20 % by default, changeable)
//   - what you already spent this month
//   - fixed payments and loan installments still to come this month
//   = what is left for the rest of the month, divided by the days left.
// The money already saved is not counted. Nothing new on the categories.
// Figures invented.
import { ic, C, tint, ci, chev, tabs, status, sw, accIcon, top } from './lib.mjs';

const S = {};
const $ = v => `$&nbsp;${v}`;
const st = status.replace('class="status"', 'class="status" style="padding:6px 6px"');

const header = `<div class="bar-top">${st}
 <div class="tt" style="gap:10px">${ci('layers-outline', C.blu, 40)}<div style="flex:1;min-width:0"><b class="one" style="font-size:18px">Todas las cuentas</b>
 <div class="one sub" style="font-size:12.5px">21 cuentas, todas incluidas</div></div>${ci('sparkles-outline', C.blu, 40)}</div></div>`;
const hero = `<div class="card hero" style="margin-top:12px"><div class="lab">Patrimonio hoy</div><div class="big" style="margin-top:4px">${$('248.320.000,00')}</div></div>`;
const todayRow = (v, line, bad = false) => `<div class="row" style="background:${bad ? tint(C.red, .12) : 'var(--s1)'};border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px">${ci('sunny-outline', bad ? C.red : C.yel, 34)}
 <div class="tx"><b style="font-weight:500">Puedes gastar hoy</b><small style="white-space:normal">${line}</small></div><b class="${bad ? 'r' : 'g'}" style="font-size:16px">${v}</b>${chev()}</div>`;
const inicio = row => `${header}<main>${hero}${row}
 <div class="seg" style="margin:14px 0 0"><div class="on">${ic('pie-chart-outline')}Gráfico</div><div>${ic('list-outline')}Movimientos</div></div>
 <div style="height:110px"></div></main>${tabs('Inicio')}`;

// One line of the working-out: what it is, the figure, and why under it.
const line = (t, v, why = '', cls = '') => `<div class="row" style="gap:10px;align-items:flex-start"><div class="tx"><b style="white-space:normal;font-weight:500">${t}</b>${why ? `<small style="white-space:normal">${why}</small>` : ''}</div><b class="${cls}" style="white-space:nowrap">${v}</b></div>`;
const total = (t, v, cls = 'g') => `<div class="row" style="gap:10px;background:var(--s2)"><div class="tx"><b style="white-space:normal">${t}</b></div><b class="${cls}" style="font-size:17px;white-space:nowrap">${v}</b></div>`;
const note = t => `<div class="sub" style="margin:10px 4px 0;font-size:12.8px;line-height:1.45">${t}</div>`;
const sheet = (title, body) => `<div class="scrim"></div><div class="sheet" style="top:70px;bottom:0;overflow:hidden"><div class="grab"></div>
 <div style="color:var(--pr);font-size:15px;margin:-4px 0 4px">Cancelar</div><h2 style="text-align:center;margin:0 0 12px;font-size:19px">${title}</h2>${body}</div>`;
const saved = note(`${ic('lock-closed-outline', '', 'width:14px;height:14px;vertical-align:-2px')} Tus ahorros (${$('230.000.000')}) <b>no se cuentan aquí</b>. Lo que puedes gastar cada mes sale de lo que recibes cada mes.`);

// 51a - Inicio: the same row as today, its figure now from what comes in.
S['51a-inicio-puedes-gastar'] = inicio(todayRow($('128.000'), 'Para cada día, hasta el 31 de octubre'));

// 51b - tapping it: how it is worked out, in five lines.
S['51b-como-se-calcula'] = S['51a-inicio-puedes-gastar'] + sheet('Cómo se calcula lo que puedes gastar', `<div class="list">
 ${line('Lo que recibes en un mes normal', $('9.000.000'), 'Promedio de tus ingresos de julio, agosto y septiembre')}
 ${line('Para ahorrar: 20 %', `−${$('1.800.000')}`, 'Lo que te sugerimos pasar a tus metas este mes', 'p')}
 ${line('Ya gastaste en octubre', `−${$('4.900.000')}`, '', 'r')}
 ${line('Pagos que te faltan este mes', `−${$('640.000')}`, 'Arriendo y la cuota del crédito del carro', 'r')}
 ${total('Te queda para el resto del mes', $('1.660.000'))}
 ${line('Para gastar cada día, durante 13 días', $('128.000'), '', 'g')}</div>
 ${saved}
 ${note('Las compras con tarjeta ya cuentan en lo que gastaste. Por eso, el pago de la tarjeta no se resta otra vez.')}`);

// 51c - a goal with a date asks more than the 20 %: the larger is taken.
S['51c-metas-piden-mas'] = S['51a-inicio-puedes-gastar'] + sheet('Cómo se calcula lo que puedes gastar', `<div class="list">
 ${line('Lo que recibes en un mes normal', $('9.000.000'), 'Promedio de tus ingresos de julio, agosto y septiembre')}
 ${line('Para tus metas', `−${$('2.500.000')}`, 'Tu meta Casa propia, con fecha en diciembre de 2028, pide $&nbsp;2.500.000 al mes. Es más que el 20 % ($&nbsp;1.800.000), así que se resta lo que pide la meta.', 'p')}
 ${line('Ya gastaste en octubre', `−${$('4.900.000')}`, '', 'r')}
 ${line('Pagos que te faltan este mes', `−${$('640.000')}`, 'Arriendo y la cuota del crédito del carro', 'r')}
 ${total('Te queda para el resto del mes', $('960.000'))}
 ${line('Para gastar cada día, durante 13 días', $('73.800'), '', 'g')}</div>${saved}`);

// 51d - already spent more than the month allows.
S['51d-ya-te-pasaste'] = inicio(todayRow($('0'), 'Este mes ya gastaste $&nbsp;420.000 más de lo que te alcanza', true));

// 51e - no income on record: it cannot be worked out, and says so.
S['51e-sin-ingresos'] = inicio(`<div class="row" style="background:var(--s1);border-radius:16px;margin-top:12px;padding:11px 14px;gap:10px;align-items:flex-start">${ci('sunny-outline', C.yel, 34)}
 <div class="tx"><b style="font-weight:500">Puedes gastar hoy</b><small style="white-space:normal">No tienes ingresos registrados en los últimos 3 meses. Para calcular cuánto puedes gastar, la app necesita saber cuánto recibes.</small>
 <span class="p" style="display:block;margin-top:6px;font-size:14px;font-weight:500">Registrar un ingreso</span></div></div>`);

// 51f - the one setting, in Más → Preferencias.
const opt = (t, sub, on) => `<div class="row" style="gap:10px"><div class="tx"><b style="font-weight:500">${t}</b>${sub ? `<small style="white-space:normal">${sub}</small>` : ''}</div>${on ? `<span class="tick on">${ic('checkmark')}</span>` : '<span class="tick"></span>'}</div>`;
S['51f-cuanto-ahorrar'] = `${top('Cuánto ahorrar cada mes')}<main>
 ${note('Antes de calcular lo que puedes gastar, la app separa este porcentaje de lo que recibes para tus metas.')}
 <div class="list" style="margin-top:12px">
 ${opt('10 %', 'Si hoy te cuesta ahorrar', false)}
 ${opt('20 %', 'Recomendado. Es la regla más usada: 50 % para lo básico, 30 % para tus gustos y 20 % para ahorrar.', true)}
 ${opt('30 %', 'Si quieres llegar más rápido a tus metas', false)}
 ${opt('Otro porcentaje', 'Escríbelo tú', false)}</div>
 ${note('Si una meta con fecha pide más dinero al mes, se separa lo que pide la meta.')}
 <div style="height:110px"></div></main>${tabs('Más')}`;

// 51g - where it lives: a row in Más → Preferencias with its value.
const mrow = (icon, c, t, v) => `<div class="row" style="gap:10px">${ci(icon, c, 36)}<div class="tx"><b style="font-weight:500">${t}</b></div><span class="sub">${v}</span>${chev()}</div>`;
S['51g-mas-preferencias'] = `${top('Más', { left: '' })}<main>
 <div class="lab" style="margin:8px 4px">PREFERENCIAS</div><div class="list">
 ${mrow('language-outline', C.cya, 'Idioma', 'Español')}
 ${mrow('color-palette-outline', C.pur, 'Apariencia', 'Automático')}
 ${mrow('options-outline', C.blu, 'Personaliza tu vista', '')}
 ${mrow('save-outline', C.grn, 'Cuánto ahorrar cada mes', '20 %')}</div>
 <div style="height:110px"></div></main>${tabs('Más')}`;

export default S;
