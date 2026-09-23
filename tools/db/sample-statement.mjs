// A statement in PDF, written by hand.
//
//   node tools/db/sample-statement.mjs <file.pdf> [--password 1234]
//
// Two of them exist for the same reason the schema has tests: so the reader
// can be tried end to end against a real file, and so Jose has something to
// import that is not five years of his own money. It is a PDF the plain way -
// one page, one font, text placed by coordinates - which is exactly the shape
// a bank's own statement has.

import { writeFileSync } from 'node:fs';

/** The lines of the sample, as [x, text] at a falling y. */
export const SAMPLE_LINES = [
  [[40, 'BANCO DE PRUEBA S.A.'], [330, 'Extracto de cuenta - septiembre 2026']],
  [[40, 'Cuenta de ahorros No. 001-234567-89'], [330, 'Periodo: 01/09/2026 al 30/09/2026']],
  [[40, 'Fecha'], [90, 'Descripcion'], [330, 'Valor'], [440, 'Saldo']],
  [[40, 'Saldo anterior'], [440, '1.250.000,00']],
  [[40, '02/09'], [90, 'COMPRA EXITO POBLADO MEDELLIN'], [330, '145.300,00'], [440, '1.104.700,00']],
  [[40, '04/09'], [90, 'PAGO NOMINA ACME SAS'], [330, '3.200.000,00'], [440, '4.304.700,00']],
  [[40, '05/09'], [90, 'COMPRA RAPPI COLOMBIA'], [330, '38.900,00'], [440, '4.265.800,00']],
  [[40, '09/09'], [90, 'TRANSFERENCIA ENVIADA A CUENTA 987'], [330, '500.000,00'], [440, '3.765.800,00']],
  [[40, '12/09'], [90, 'RETIRO CAJERO AUTOMATICO CC SANTAFE'], [330, '200.000,00'], [440, '3.565.800,00']],
  [[40, '15/09'], [90, 'COMPRA EXITO POBLADO MEDELLIN'], [330, '92.450,00'], [440, '3.473.350,00']],
  [[40, '18/09'], [90, 'PAGO TARJETA DE CREDITO'], [330, '1.100.000,00'], [440, '2.373.350,00']],
  [[40, '21/09'], [90, 'ABONO INTERESES AHORRO'], [330, '4.120,00'], [440, '2.377.470,00']],
  [[40, '25/09'], [90, 'COMPRA NETFLIX COM'], [330, '44.900,00'], [440, '2.332.570,00']],
  [[40, '28/09'], [90, 'COMPRA RAPPI COLOMBIA'], [330, '61.300,00'], [440, '2.271.270,00']],
  [[40, 'Saldo final'], [440, '2.271.270,00']],
  [[40, 'Linea de atencion 018000 912345 - NIT 890.903.938-8']],
];

/** Escapes the few characters a PDF string cannot hold as they are. */
const escaped = text => text.replace(/[\\()]/g, match => `\\${match}`);

/** The page's drawing instructions: place the cursor, print the text. */
function contentStream(lines, top = 760, step = 22) {
  const out = ['BT', '/F1 10 Tf'];
  let y = top;
  for (const line of lines) {
    for (const [x, text] of line) {
      out.push(`1 0 0 1 ${x} ${y} Tm (${escaped(text)}) Tj`);
    }
    y -= step;
  }
  out.push('ET');
  return out.join('\n');
}

/**
 * A one-page PDF holding those lines.
 *
 * Built object by object with a real cross-reference table, because a reader
 * that repairs a broken file would be proving something other than what this
 * is here to prove.
 */
export function samplePdf(lines = SAMPLE_LINES) {
  const stream = contentStream(lines);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
      + '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }

  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

if (process.argv[1] && process.argv[1].endsWith('sample-statement.mjs')) {
  const to = process.argv[2] ?? 'extracto-de-prueba.pdf';
  writeFileSync(to, samplePdf());
  console.log(`escrito ${to}`);
}
