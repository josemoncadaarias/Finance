/**
 * The one file that knows what a PDF is.
 *
 * Everything else about reading a statement works on text with coordinates,
 * which is why it can be tested without a browser. This turns a file into that
 * text and nothing more: no deciding what a line means, no movements.
 *
 * It runs on the phone and in the browser, and it never sends anything
 * anywhere - the statement is opened where it already is. Rule 1.
 */

import type { TextItem } from './tokens';

/** A statement whose pages are locked. The caller asks for the password. */
export class StatementLocked extends Error {
  constructor() {
    super('This statement needs a password');
    this.name = 'StatementLocked';
  }
}

/** A file that is not a PDF at all, or one too damaged to open. */
export class StatementUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatementUnreadable';
  }
}

/**
 * The text of a PDF, piece by piece, with where each piece was printed.
 *
 * `y` grows upwards, as PDF itself measures it, and the reader sorts by it.
 * A password is only needed by some banks - and those that ask, ask for the
 * cedula - so it is a second attempt rather than a question up front.
 */
export async function textOfPdf(
  file: ArrayBuffer,
  password?: string,
  workerSrc?: string,
): Promise<TextItem[]> {
  // Loaded when a statement is actually opened. It is a megabyte and a half
  // of library that nobody who never imports a statement should pay for.
  const pdfjs = await import('pdfjs-dist');

  // Where the reading is done. In the app it is a worker served beside the
  // page - a statement of many pages would otherwise freeze the screen while
  // it is read - and `angular.json` copies that file into `assets`. In the
  // tests there is no page to freeze, so the library's own module is handed
  // over and pdf.js reads it here.
  (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = workerSrc
    ?? 'assets/pdf.worker.min.mjs';

  let task;
  let document;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(file),
      password,
      // Nothing is fetched from anywhere while a statement is read.
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: false,
    });
    document = await task.promise;
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'PasswordException') throw new StatementLocked();
    throw new StatementUnreadable((error as Error).message ?? String(error));
  }

  const items: TextItem[] = [];
  try {
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      for (const item of content.items) {
        const piece = item as { str?: string; transform?: number[] };
        if (typeof piece.str !== 'string' || piece.str.trim().length === 0) continue;
        // The last two of the six numbers are where it was put on the page.
        const transform = piece.transform ?? [0, 0, 0, 0, 0, 0];
        items.push({
          text: piece.str,
          x: Math.round(transform[4]),
          y: Math.round(transform[5]),
          page: number,
        });
      }
      page.cleanup();
    }
  } finally {
    // The task, not the document: it is what holds the reader open.
    await task.destroy();
  }

  if (items.length === 0) {
    // A statement that is a photograph of a statement. Nothing here can read
    // it, and saying so is better than proposing an empty list.
    throw new StatementUnreadable('no text');
  }
  return items;
}
