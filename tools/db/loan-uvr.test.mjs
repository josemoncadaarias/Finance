// Loans in UVR (core/loans/uvr.ts and the UVR half of schedule.ts), against
// Jose's reference package of 2026-10-01 ("Paquete_pruebas_prestamos_Colombia.xlsx"):
//
// - UVR_oficial: the Banco de la Republica's daily UVR, 16 Sep - 15 Oct 2026
//   (Boletin 24 de 2026). Official.
// - UVR_Cuota_constante, UVR_Capital_constante, UVR_Ciclico: the three systems
//   the Superfinanciera describes, worked out by the package for 100,000,000
//   at 8 % E.A. over the UVR, 120 monthly installments - simulated, built on
//   those formulas, each month turned into pesos at the "UVR referencia" of
//   its row (the package takes consecutive days of the bulletin for them).
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/loan-uvr.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { loanSchedule, dueDate, firstInstallment } from '../../src/app/core/loans/schedule.ts';
import { uvrLookup, UVR_SCALE } from '../../src/app/core/loans/uvr.ts';

// [month, UVR referencia, cuota UVR, interes UVR, capital UVR, saldo UVR, cuota pesos, saldo pesos]
const FIXED = [
  [1, 418.0925, 2866.770563796892, 1538.901106813308, 1327.869456983584, 237853.6513787167, 1198575.271944252, 99444827.7390561],
  [2, 418.1468, 2866.770563796892, 1530.357554744922, 1336.41300905197, 236517.2383696647, 1198730.937585866, 98898926.3691125],
  [3, 418.201, 2866.770563796892, 1521.759033205281, 1345.011530591611, 235172.2268390731, 1198886.316550424, 98349260.4363272],
  [4, 418.2553, 2866.770563796892, 1513.105188519153, 1353.665375277739, 233818.5614637953, 1199041.982192038, 97795852.57060815],
  [5, 418.3096, 2866.770563796892, 1504.395664735747, 1362.374899061145, 232456.1865647342, 1199197.647833652, 97238654.41941933],
  [6, 418.3639, 2866.770563796892, 1495.630103614075, 1371.140460182817, 231085.0461045514, 1199353.313475267, 96677641.11997992],
  [7, 418.4181, 2866.770563796892, 1486.808144608214, 1379.962419188678, 229705.0836853627, 1199508.692439824, 96112764.67597046],
  [8, 418.4724, 2866.770563796892, 1477.929424852481, 1388.841138944411, 228316.2425464183, 1199664.358081439, 95544045.97738178],
  [9, 418.5267, 2866.770563796892, 1468.993579146502, 1397.77698465039, 226918.4655617679, 1199820.023723053, 94971436.56063038],
  [10, 418.581, 2866.770563796892, 1460.000239940191, 1406.770323856701, 225511.6952379112, 1199975.689364667, 94394910.90438011],
  [11, 418.6354, 2866.770563796892, 1450.949037318638, 1415.821526478254, 224095.873711433, 1200131.641683338, 93814465.72953522],
  [12, 418.6897, 2866.770563796892, 1441.839598986886, 1424.930964810006, 222670.942746623, 1200287.307324952, 93230030.21730074]
];
const CAPITAL = [
  [1, 418.0925, 3532.08044711081, 1538.901106813308, 1993.179340297502, 237188.3414954027, 1476736.344333676, 99166666.66666666],
  [2, 418.1468, 3519.256271220699, 1526.076930923197, 1993.179340297502, 235195.1621551052, 1471565.748190867, 98346104.43063836],
  [3, 418.201, 3506.432095330589, 1513.252755033086, 1993.179340297502, 233201.9828148077, 1466393.408699348, 97525302.41513541],
  [4, 418.2553, 3493.607919440477, 1500.428579142975, 1993.179340297502, 231208.8034745102, 1461220.028427953, 96704307.45987232],
  [5, 418.3096, 3480.783743550367, 1487.604403252865, 1993.179340297502, 229215.6241342127, 1456045.255451056, 95883096.04533288],
  [6, 418.3639, 3467.959567660256, 1474.780227362754, 1993.179340297502, 227222.4447939152, 1450869.089768658, 95061668.17151707],
  [7, 418.4181, 3455.135391770144, 1461.956051472643, 1993.179340297502, 225229.2654536177, 1445691.185867219, 94240001.31549837],
  [8, 418.4724, 3442.311215880034, 1449.131875582532, 1993.179340297502, 223236.0861133202, 1440512.236056236, 93418140.72244778],
  [9, 418.5267, 3429.487039989923, 1436.307699692421, 1993.179340297502, 221242.9067730227, 1435331.89353975, 92596063.67012085],
  [10, 418.581, 3416.662864099812, 1423.48352380231, 1993.179340297502, 219249.7274327252, 1430150.158317764, 91773770.15851755],
  [11, 418.6354, 3403.838688209701, 1410.659347912199, 1993.179340297502, 217256.5480924277, 1424967.370774144, 90951281.91329272],
  [12, 418.6897, 3391.01451231959, 1397.835172022088, 1993.179340297502, 215263.3687521302, 1419782.848858736, 90128555.28381878]
];
const CYCLIC = [
  [1, 418.0925, 2930.662105734705, 1538.901106813308, 1391.760998921397, 237789.7598367788, 1225287.846441887, 99418115.16455844],
  [2, 418.1468, 2918.722225547895, 1529.946474640319, 1388.775750907575, 236400.9840858713, 1220454.35870173, 98850315.01235798],
  [3, 418.201, 2906.830989910927, 1521.011049642937, 1385.819940267989, 235015.1641456033, 1215639.62681174, 98283576.66085543],
  [4, 418.2553, 2894.988200639885, 1512.09464242021, 1382.893558219675, 233632.2705873836, 1210844.158355095, 97717935.42420729],
  [5, 418.3096, 2883.193660358276, 1503.197063627695, 1379.996596730582, 232252.273990653, 1206067.586787006, 97153355.83212045],
  [6, 418.3639, 2871.447172493747, 1494.318123972628, 1377.129048521119, 230875.1449421319, 1201309.837728457, 96589826.05105557],
  [7, 418.4181, 2859.7485412748, 1485.457634209083, 1374.290907065717, 229500.8540350662, 1196570.551117973, 96027311.29372972],
  [8, 418.4724, 2848.097571727538, 1476.615405133118, 1371.48216659442, 228129.3718684718, 1191850.226274995, 95465845.75629187],
  [9, 418.5267, 2836.494069672412, 1467.791247577917, 1368.702822094495, 226760.6690463773, 1187148.502549565, 94905394.50577243],
  [10, 418.581, 2824.937841720982, 1458.984972408914, 1365.952869312068, 225394.7161770652, 1182465.306725411, 94345945.69211213],
  [11, 418.6354, 2813.428695272698, 1450.196390518915, 1363.232304753784, 224031.4838723114, 1177800.847216964, 93787509.86347863],
  [12, 418.6897, 2801.966438511689, 1441.425312823199, 1360.54112568849, 222670.9427466229, 1173154.487550528, 93230030.21730071]
];
const OFFICIAL = [
  ['2026-09-16', 418.0925],
  ['2026-09-17', 418.1468],
  ['2026-09-18', 418.201],
  ['2026-09-19', 418.2553],
  ['2026-09-20', 418.3096],
  ['2026-09-21', 418.3639],
  ['2026-09-22', 418.4181],
  ['2026-09-23', 418.4724],
  ['2026-09-24', 418.5267],
  ['2026-09-25', 418.581],
  ['2026-09-26', 418.6354],
  ['2026-09-27', 418.6897],
  ['2026-09-28', 418.744],
  ['2026-09-29', 418.7983],
  ['2026-09-30', 418.8527],
  ['2026-10-01', 418.907],
  ['2026-10-02', 418.9614],
  ['2026-10-03', 419.0157],
  ['2026-10-04', 419.0701],
  ['2026-10-05', 419.1245],
  ['2026-10-06', 419.1789],
  ['2026-10-07', 419.2333],
  ['2026-10-08', 419.2877],
  ['2026-10-09', 419.3421],
  ['2026-10-10', 419.3965],
  ['2026-10-11', 419.4509],
  ['2026-10-12', 419.5053],
  ['2026-10-13', 419.5598],
  ['2026-10-14', 419.6142],
  ['2026-10-15', 419.6686]
];

const LOAN = {
  principalMinor: 100_000_000_00, system: 'fixed_installment', installments: 120, periodMonths: 1,
  disbursedOn: '2026-01-15', firstDueOn: '2026-02-15', insuranceKind: 'fixed', insuranceMinor: 0,
  insuranceRateScaled: 0, bankInstallmentMinor: null, paidBefore: 0, balanceAfterBeforeMinor: null,
  rates: [{ validFrom: '2026-01-15', annualRateScaled: 80_000 }], unit: 'UVR', decreaseScaled: null,
};

/** The package's UVR: the disbursement at the first reference, month k at its row's. */
function packageUvr(sheet) {
  const byDay = new Map([[LOAN.disbursedOn, sheet[0][1]]]);
  sheet.forEach(row => byDay.set(dueDate(LOAN.firstDueOn, 1, row[0]), row[1]));
  return day => ({ value: byDay.get(day) ?? sheet[0][1], kind: 'official' });
}

function checkAgainst(sheet, terms) {
  const s = loanSchedule({ ...terms, uvr: packageUvr(sheet) }, [], '2026-01-20');
  const rows = s.rows.filter(r => r.type === 'installment');
  for (const [month, , cuota, interest, capital, balance, cuotaPesos, balancePesos] of sheet) {
    const row = rows[month - 1];
    assert.ok(Math.abs(row.uvr.installment - cuota) < 1e-5, `month ${month}: installment ${row.uvr.installment} UVR, package ${cuota}`);
    assert.ok(Math.abs(row.uvr.interest - interest) < 1e-5, `month ${month}: interest ${row.uvr.interest} UVR, package ${interest}`);
    assert.ok(Math.abs(row.uvr.capital - capital) < 1e-5, `month ${month}: capital`);
    assert.ok(Math.abs(row.uvr.balanceAfter - balance) < 1e-5, `month ${month}: balance ${row.uvr.balanceAfter} UVR, package ${balance}`);
    // To the centavo in pesos (capital and interest are each rounded, so their sum may be one centavo apart).
    assert.ok(Math.abs(row.capitalMinor + row.interestMinor - Math.round(cuotaPesos * 100)) <= 1, `month ${month}: installment in pesos`);
    assert.ok(Math.abs(row.balanceAfterMinor - Math.round(balancePesos * 100)) <= 1, `month ${month}: balance in pesos`);
  }
  return s;
}

test('UVR, constant installment: every month of the package, in UVR and in pesos', () => {
  const s = checkAgainst(FIXED, LOAN);
  assert.equal(s.totalCount, 120);
});

test('UVR, constant capital: every month of the package', () => {
  checkAgainst(CAPITAL, { ...LOAN, system: 'constant_capital' });
});

test('UVR, cyclic decreasing installment (5 % a year): every month, and the year ends where the constant one does', () => {
  const s = checkAgainst(CYCLIC, { ...LOAN, decreaseScaled: 50_000 });
  const rows = s.rows.filter(r => r.type === 'installment');
  assert.ok(Math.abs(rows[11].uvr.balanceAfter - FIXED[11][5]) < 1e-5);
  // The second year starts again from the constant installment's level.
  assert.ok(rows[12].uvr.installment > CYCLIC[11][2], 'a new year starts higher than the last month of the one before');
  assert.ok(Math.abs(rows[12].uvr.installment - CYCLIC[0][2]) < 1e-5, 'and at the same level as the first year');
});

test('the first installment the form shows, in UVR and pesos', () => {
  const first = firstInstallment({ ...LOAN, uvr: packageUvr(FIXED) });
  assert.ok(Math.abs(first.uvr - FIXED[0][2]) < 1e-5);
  assert.ok(Math.abs(first.paymentMinor - Math.round(FIXED[0][6] * 100)) <= 1);
});

test('a payment of the first installment lowers the UVR balance by the capital it paid in UVR', () => {
  const uvr = packageUvr(FIXED);
  const s = loanSchedule({ ...LOAN, uvr }, [{
    kind: 'installment', number: 1, paidOn: '2026-02-15', capitalMinor: Math.round(FIXED[0][4] * FIXED[0][1] * 100),
    interestMinor: Math.round(FIXED[0][3] * FIXED[0][1] * 100), insuranceMinor: 0, lateMinor: 0, extraMode: null,
    capitalUvrMicro: Math.round(FIXED[0][4] * 1e6),
  }], '2026-02-20');
  assert.equal(s.paidCount, 1);
  assert.ok(Math.abs(s.balanceUvr - FIXED[0][5]) < 1e-5);
  assert.equal(s.next.number, 2);
});

// The official series: the rule reproduces the bulletin from the 15th.
test("the UVR rule gives every value of the bulletin from the 15th of September and August's IPC", () => {
  const lookup = uvrLookup({
    known: [{ day: '2026-09-15', valueScaled: 4_180_383, source: 'official' }],
    ipc: [{ month: '2026-07', index: 15979 }, { month: '2026-08', index: 16042 }],
  });
  for (const [day, value] of OFFICIAL) {
    const got = lookup(day);
    assert.equal(got.value, value, day);
    assert.equal(got.kind, 'derived');
  }
});

test('the UVR: a published day is used as it is, a later one is projected, an earlier one derived', () => {
  const lookup = uvrLookup({
    known: OFFICIAL.map(([day, value]) => ({ day, valueScaled: Math.round(value * UVR_SCALE), source: 'official' })),
    ipc: [{ month: '2026-06', index: 15953 }, { month: '2026-07', index: 15979 }, { month: '2026-08', index: 16042 }],
  });
  assert.deepEqual(lookup('2026-09-25'), { value: 418.581, kind: 'official' });
  // After 15 Oct the September IPC is not known yet: August's variation stands in.
  const later = lookup('2026-10-20');
  assert.equal(later.kind, 'projected');
  assert.ok(later.value > 419.6686 && later.value < 420);
  // Before 16 Sep: worked back through August's and July's variations.
  const earlier = lookup('2026-09-01');
  assert.equal(earlier.kind, 'derived');
  assert.ok(earlier.value < 418.0925 && earlier.value > 417.5);
  assert.equal(lookup('1990-01-01'), null, 'with no IPC that far back there is nothing to work it from');
});
