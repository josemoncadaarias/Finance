/**
 * Text as a search compares it: lowercased, without accents and trimmed, so
 * "exito" finds "Éxito". One definition for every search in the app.
 */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
