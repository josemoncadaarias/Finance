// Group 43 - the opening balance set from a statement that adds up (rule 22,
// "The opening balance is what absorbs the history nobody typed in"). Only
// ever offered, never done; only from a statement that adds up; it touches
// one figure and writes no movement. Names and figures invented.
import { ic, C, tint, top, ci, accIcon, tabs } from './lib.mjs';

const S = {};
const note = t => `<div class="sub" style="margin:8px 4px 0;font-size:12.5px;line-height:1.4">${t}</div>`;
const line = (k, v, cls = '') => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:14px"><span class="mu">${k}</span><b class="${cls}" style="font-weight:500;white-space:nowrap">${v}</b></div>`;
const head = top('Movimientos por revisar', { sub: 'Banco Azul' });

// The batch card as Por revisar shows it once a statement is read.
const batch = extra => `<div class="card" style="padding:14px">
 <div style="display:flex;gap:12px;align-items:center">${accIcon('azul', 40)}<div class="tx"><b>Banco Azul</b><small>extracto-septiembre.pdf · 18 movimientos</small></div>
 <span class="tag" style="background:${tint(C.grn, .18)};color:${C.grn}">Cuadra</span></div>${extra}</div>`;

// 43a - after saving a statement's rows, the account still differs from the
// bank's closing figure: the card says by how much and offers the adjustment.
S['43a-extracto-no-coincide'] = `${head}<main>
 ${batch(`<div style="margin-top:12px;padding:12px;border-radius:14px;background:${tint(C.yel, .12)};border:1px solid ${tint(C.yel, .35)}">
  <b style="font-size:14.5px">Tu cuenta no dice lo mismo que el banco</b>
  ${line('El banco, al 30 de septiembre', '$ 4.120.300')}
  ${line('La app, al 30 de septiembre', '$ 2.040.300')}
  ${line('Diferencia', '$ 2.080.000', 'y')}
  <div class="mu" style="font-size:12.8px;line-height:1.4;margin-top:4px">Casi siempre es lo que pasó antes de que empezaras a usar la app.</div>
  <div class="btn" style="margin-top:12px;height:44px">Ajustar el saldo inicial</div>
  <div class="p" style="text-align:center;margin-top:10px;font-size:14px">Dejarlo así</div></div>`)}
 ${note('Los 18 movimientos ya están guardados. Esto es aparte.')}</main>${tabs('Más')}`;

// 43b - the question, before anything changes: what it is now, what it would
// be, and that no movement is touched.
S['43b-ajustar-pregunta'] = S['43a-extracto-no-coincide'] + `<div class="scrim"></div><div class="sheet"><div class="grab"></div>
 <div style="text-align:center">${ci('git-compare-outline', C.blu, 52).replace('display:grid', 'display:grid;margin:0 auto 10px')}
 <b style="font-size:18px">¿Ajustar el saldo inicial de Banco Azul?</b></div>
 <div class="card" style="margin-top:14px;padding:12px 14px">
  ${line('Saldo inicial hoy', '$ 500.000')}
  ${line('Saldo inicial nuevo', '$ 2.580.000', 'p')}
  <div style="border-top:1px solid var(--line);margin:4px 0"></div>
  ${line('Tu saldo, al 30 de septiembre', '$ 4.120.300', 'g')}</div>
 <div class="list" style="margin-top:10px">
  <div class="row plain">${ic('checkmark-circle-outline', 'g')}<div class="tx"><b style="white-space:normal">Tu cuenta queda igual que el banco</b><small>Desde el 30 de septiembre, y lo que registres después suma encima.</small></div></div>
  <div class="row plain">${ic('lock-closed-outline', 'p')}<div class="tx"><b style="white-space:normal">No cambia ningún movimiento</b><small>Solo cambia el saldo con el que empezó la cuenta.</small></div></div>
  <div class="row plain">${ic('arrow-undo-outline', 'mu')}<div class="tx"><b style="white-space:normal">Lo puedes cambiar después</b><small>En la cuenta, con el lápiz.</small></div></div></div>
 <div class="btn" style="margin-top:14px">Ajustar a $ 2.580.000</div>
 <div class="btn ghost" style="margin-top:8px">Cancelar</div></div>`;

// 43c - done: the card says it adds up with the bank, and a notice that goes.
S['43c-ajustado'] = `${head}<main>
 ${batch(`<div style="margin-top:12px;display:flex;gap:10px;align-items:center;font-size:13.5px">${ic('checkmark-circle', 'g', 'width:20px;height:20px')}<span>Tu cuenta y el banco dicen lo mismo al 30 de septiembre: <b>$ 4.120.300</b></span></div>`)}
 </main>
 <div style="position:absolute;left:16px;right:16px;bottom:104px;padding:12px 14px;border-radius:14px;background:#1b2740;border:1px solid #2c3d63;display:flex;gap:10px;align-items:center;font-size:13.5px">${ic('checkmark', 'g')}<span style="flex:1">Saldo inicial ajustado a $ 2.580.000</span><span class="p">Deshacer</span></div>${tabs('Más')}`;

// 43d - a statement that does not add up is never used to adjust anything.
S['43d-no-cuadra-no-se-ofrece'] = `${head}<main>
 <div class="card" style="padding:14px"><div style="display:flex;gap:12px;align-items:center">${accIcon('azul', 40)}<div class="tx"><b>Banco Azul</b><small>extracto-agosto.pdf · 21 movimientos</small></div>
 <span class="tag" style="background:${tint(C.yel, .18)};color:${C.yel}">No cuadra</span></div>
 <div class="mu" style="font-size:13px;line-height:1.4;margin-top:10px">No cuadra por $ 45.900. Mientras no cuadre, no te ofrecemos ajustar el saldo inicial con él: si leímos mal una cifra, tu cuenta quedaría mal.</div></div>
 </main>${tabs('Más')}`;

// 43e - an older statement read later: the opening balance goes down by what
// its movements add, and the balance today does not move.
S['43e-extracto-anterior'] = `${head}<main>
 ${batch(`<div style="margin-top:12px;padding:12px;border-radius:14px;background:${tint(C.blu, .12)};border:1px solid ${tint(C.blu, .35)}">
  <b style="font-size:14.5px">Ya ajustaste esta cuenta con el extracto de septiembre</b>
  <div class="mu" style="font-size:12.8px;line-height:1.4;margin-top:4px">Con los movimientos de agosto que acabas de guardar, el saldo inicial tiene que bajar para que todo siga cuadrando.</div>
  ${line('Saldo inicial hoy', '$ 2.580.000')}
  ${line('Saldo inicial nuevo', '$ 1.932.150', 'p')}
  ${line('Tu saldo de hoy', 'no cambia', 'g')}
  <div class="btn" style="margin-top:12px;height:44px">Ajustar a $ 1.932.150</div></div>`).replace('extracto-septiembre.pdf · 18', 'extracto-agosto.pdf · 21')}
 </main>${tabs('Más')}`;

export default S;
