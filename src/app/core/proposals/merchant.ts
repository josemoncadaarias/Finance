/**
 * The name under which a description is remembered.
 *
 * A category is nearly always a question that has been answered before: the
 * same supermarket, the same delivery app, the same payroll line. What changes
 * between one visit and the next is the noise around the name - a receipt
 * number, a branch code, the wording the bank puts in front of it - so the
 * dictionary is kept under the description with that noise folded out.
 *
 * Deliberately not an LLM. This costs nothing, works with no network, gives
 * the same answer twice and improves by being used, which is the whole of what
 * this job needs. Rule 22.
 */

/** Words a bank puts in front of the merchant, which say nothing about it. */
const NOISE = new Set([
  'COMPRA', 'COMPRAS', 'PAGO', 'PAGOS', 'ABONO', 'CARGO', 'DEBITO', 'CREDITO',
  'TRANSFERENCIA', 'TRANSF', 'TRF', 'ENVIO', 'RECIBIDO', 'RECIBIDA', 'ENVIADA',
  'POR', 'EN', 'DE', 'DEL', 'LA', 'EL', 'A', 'AL', 'CON', 'SU', 'TU',
  'TARJETA', 'TAR', 'TJ', 'CTA', 'CUENTA', 'REF', 'APROBADA', 'EXITOSA',
  'NEQUI', 'PSE', 'QR', 'DATAFONO', 'SUCURSAL', 'VIRTUAL',
]);

/**
 * Folds a description into its merchant.
 *
 * Upper case, without accents, without punctuation, without the numbers that
 * change every time, and without the words above. What is left is the name.
 * An empty result means there was nothing to remember - the description was
 * only noise - and then nothing is learned from it.
 */
export function merchantKeyOf(description: string | null | undefined): string {
  if (!description) return '';
  const folded = description
    .normalize('NFD')
    // Every accent, as one range, so "Éxito" and "EXITO" are one merchant.
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    // Anything that is not a letter or a digit separates words. A receipt
    // number written as 1.234 must not survive as two words either.
    .replace(/[^A-Z0-9Ñ]+/g, ' ')
    .trim();
  if (folded.length === 0) return '';

  const words = folded.split(' ').filter(word => {
    if (word.length === 0) return false;
    // A number on its own is a receipt, a branch, a card's last digits: it
    // changes between two visits to the same shop.
    if (/^[0-9]+$/.test(word)) return false;
    if (NOISE.has(word)) return false;
    // A single letter left over by the folding says nothing.
    return word.length > 1;
  });

  // Long descriptions are usually a name followed by a reference. The first
  // few words are the name; the rest is what made it long.
  return words.slice(0, 4).join(' ');
}

/** What the person sees when the app says where a category came from. */
export function merchantSampleOf(description: string | null | undefined): string {
  return (description ?? '').trim().slice(0, 120);
}
