// A bank's message read by its shape, for anybody (rule 22; Jose,
// 2026-10-02: nothing burned in for one bank). Every message here is
// INVENTED, in as many styles as could be imagined - different banks,
// countries, both languages - and none is copied from a real person.
//
//   node --import ./tools/db/register-ts.mjs --test tools/db/read-notice.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { looksLikeMoney, readNotice } from '../../src/app/core/notices/read-notice.ts';

const ON = '2026-10-02';
const P = pesos => Math.round(pesos * 100);

/** [text, title, expected subset] */
const CASES = [
  // Purchases, written every which way.
  ['Compraste $45.900 en EXITO POBLADO con tu tarjeta *1234 el 02/10/2026 a las 14:05.', 'Banco Uno',
    { kind: 'movement', direction: 'out', amountMinor: P(45900), merchant: 'EXITO POBLADO', digits: '1234', date: '2026-10-02' }],
  ['Banco Dos le informa compra por $120,500.00 en FARMACIA CENTRAL. T.Cred *9876. Saldo disponible $2,345,678.90', '',
    { kind: 'movement', direction: 'out', amountMinor: P(120500), merchant: 'FARMACIA CENTRAL', digits: '9876', balanceMinor: P(2345678.90) }],
  ['Compra aprobada en TIENDA LA 14 por COP 18.000 con tarjeta terminada en 4455', '',
    { kind: 'movement', direction: 'out', amountMinor: P(18000), merchant: 'TIENDA LA 14', digits: '4455' }],
  ['Realizaste una compra de 32.450 pesos en PANADERIA EL TRIGO', '',
    { kind: 'movement', direction: 'out', amountMinor: P(32450), merchant: 'PANADERIA EL TRIGO' }],
  ['Pagaste $85.000 a EMPRESA DE AGUA desde tu cuenta de ahorros *3321. Saldo: $1.200.000', '',
    { kind: 'movement', direction: 'out', amountMinor: P(85000), merchant: 'EMPRESA DE AGUA', digits: '3321', balanceMinor: P(1200000) }],
  ['Retiro en cajero por $200.000 el 01/10. Saldo disponible $650.000', '',
    { kind: 'movement', direction: 'out', amountMinor: P(200000), balanceMinor: P(650000), date: '2026-10-01' }],
  ['Transferiste $1.000.000 a Maria Perez. Tu saldo es $3.456.789,12', '',
    { kind: 'movement', direction: 'out', amountMinor: P(1000000), merchant: 'Maria Perez', balanceMinor: P(3456789.12) }],
  ['Enviaste $50.000 a 3001234567', '',
    { kind: 'movement', direction: 'out', amountMinor: P(50000) }],
  // Money coming in.
  ['Recibiste $1.500.000 de EMPRESA ABC SAS en tu cuenta *7788', '',
    { kind: 'movement', direction: 'in', amountMinor: P(1500000), merchant: 'EMPRESA ABC SAS', digits: '7788' }],
  ['Te transfirieron $25.000 desde otra entidad. Saldo $125.000', '',
    { kind: 'movement', direction: 'in', amountMinor: P(25000), balanceMinor: P(125000) }],
  ['Abono de nomina por $4.200.000,00 en tu cuenta', '',
    { kind: 'movement', direction: 'in', amountMinor: P(4200000) }],
  ['Recibiste un pago de $300.000 de Juan Gomez', '',
    { kind: 'movement', direction: 'in', amountMinor: P(300000), merchant: 'Juan Gomez' }],
  ['Te devolvimos $12.990 por tu compra en TIENDA X: reembolso aprobado', '',
    { kind: 'movement', direction: 'in', amountMinor: P(12990) }],
  // Other countries and English.
  ['Compra con tu tarjeta ****5566 por $1,234.56 MXN en OXXO CENTRO', '',
    { kind: 'movement', direction: 'out', amountMinor: P(1234.56), currency: 'MXN', digits: '5566' }],
  ['Purchase of USD 12.50 at COFFEE HOUSE with card ending in 2211. Available balance USD 840.10', '',
    { kind: 'movement', direction: 'out', amountMinor: P(12.5), currency: 'USD', merchant: 'COFFEE HOUSE', digits: '2211', balanceMinor: P(840.1) }],
  ['You received $250.00 from John Smith', '',
    { kind: 'movement', direction: 'in', amountMinor: P(250), merchant: 'John Smith' }],
  ['Your card x1234 was charged €45,60 at SUPERMARKT', '',
    { kind: 'movement', direction: 'out' }],
  ['Deposit of 2,000.00 USD credited to your account', '',
    { kind: 'movement', direction: 'in', amountMinor: P(2000), currency: 'USD' }],
  // Only a balance: nothing moved.
  ['Tu saldo es $1.234.567,89', '', { kind: 'balance', balanceMinor: P(1234567.89), amountMinor: null }],
  ['Saldo disponible en tu cuenta *1111: $54.300', '', { kind: 'balance', balanceMinor: P(54300) }],
  // Refused.
  ['Tu compra por $89.900 en TIENDA Y fue rechazada por fondos insuficientes', '', { kind: 'declined', amountMinor: P(89900) }],
  ['Transaction declined: $30.00 at STORE', '', { kind: 'declined' }],
  // Not money that moved.
  ['Tu codigo de verificacion es 483920. No lo compartas.', '', { kind: 'none' }],
  ['Usa el código 1234 para ingresar', '', { kind: 'none' }],
  ['Aprovecha: gana hasta $500.000 con nuestra promo de octubre', '', { kind: 'none' }],
  ['Te recordamos que tu pago minimo de $150.000 vence el 10/10', '', {}],
  ['Hola, ¿nos vemos a las 7:30 en el parque?', '', { kind: 'none' }],
  ['Tu pedido 12345678 va en camino', '', { kind: 'none' }],
  // A bank's usual footer does not hide the movement.
  ['Compraste $15.000 en DROGUERIA SAN JOSE con tarjeta 1234. Recuerda: nunca te pediremos tu clave.', '',
    { kind: 'movement', direction: 'out', amountMinor: P(15000), merchant: 'DROGUERIA SAN JOSE' }],
  ['BANCO TRES: Pago exitoso de $64.300 a SERVICIO DE GAS. Si no reconoces esta transaccion llama al 018000123456', '',
    { kind: 'movement', direction: 'out', amountMinor: P(64300), merchant: 'SERVICIO DE GAS' }],
  ['Se debito de tu cuenta *5544 el valor de $9.900 por SUSCRIPCION VIDEO', '',
    { kind: 'movement', direction: 'out', amountMinor: P(9900), digits: '5544' }],
  ['Consignacion recibida por valor de $700.000. Saldo actual $2.100.000', '',
    { kind: 'movement', direction: 'in', amountMinor: P(700000), balanceMinor: P(2100000) }],
  // "You made a transfer from your account": money that left (invented, in
  // the shape a bank signing its SMS uses).
  ['BancoX: Realizaste una transferencia a traves de llaves por un valor de $10.000,00 desde tu cuenta terminada en *1111. 08/10/2026 11:57AM', '',
    { kind: 'movement', direction: 'out', amountMinor: P(10000), digits: '1111' }],
  // Money with no movement word: the person decides.
  ['Movimiento por $77.000 en tu cuenta *2020', '', { kind: 'unclear', amountMinor: P(77000), direction: null }],
];

for (const [text, title, expected] of CASES) {
  test(`reads: ${text.slice(0, 70)}`, () => {
    const got = readNotice(text, title, ON);
    for (const [key, value] of Object.entries(expected)) {
      assert.deepEqual(got[key], value, `${key} of "${text}"`);
    }
  });
}

test('a reminder of an amount due is never a movement', () => {
  const got = readNotice('Te recordamos que tu pago minimo de $150.000 vence el 10/10', '', ON);
  assert.notEqual(got.kind, 'movement');
});

test('a card number, a phone number, an hour and a date are never money', () => {
  assert.equal(readNotice('Tarjeta 4455 activada el 02/10/2026 a las 14:05. Llama al 6015551234', '', ON).amountMinor, null);
});

test('only what is left is taken for the balance, wherever it sits', () => {
  const got = readNotice('Saldo anterior $500.000. Compra $20.000 en KIOSKO', '', ON);
  assert.equal(got.amountMinor, P(20000));
  assert.equal(got.balanceMinor, P(500000));
});

test('which messages look like a bank', () => {
  assert.equal(looksLikeMoney('Compraste $45.900 en EXITO'), true);
  assert.equal(looksLikeMoney('Tu saldo es $10.000'), true);
  assert.equal(looksLikeMoney('Tu codigo es 483920'), false);
  assert.equal(looksLikeMoney('Llego tu pedido'), false);
});
