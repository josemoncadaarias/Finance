/**
 * The text of photos or screenshots of a statement, as the PDF reader takes
 * it (the other door into `readStatement`, rule 22).
 *
 * Each image is turned upright (a phone photo carries its turn in EXIF) and
 * shrunk to at most `LONGEST` pixels on its long side - plenty for printed
 * text, and a few hundred KB over the bridge instead of several MB - then read
 * by the phone's own text recognition (`OcrPlugin`, Google Play services, on
 * the device). Android only: elsewhere `canReadImages` is false and the
 * screens offer PDF alone.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

import { itemsOfPages, type OcrPage } from './ocr-items';
import { StatementUnreadable, stopIfCancelled, type ReadingProgress } from './pdf-text';
import type { TextItem } from './tokens';

interface OcrPlugin {
  read(options: { image: string }): Promise<OcrPage>;
}

const Native = registerPlugin<OcrPlugin>('Ocr');

const LONGEST = 2400;

/** Whether this device can read a statement from an image. */
export function canReadImages(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** What a statement's file picker accepts: PDF, and images where they can be read. */
export function statementAccept(): string {
  return canReadImages() ? 'application/pdf,.pdf,image/*' : 'application/pdf,.pdf';
}

/**
 * What was chosen, as one statement: the PDF alone, or every image chosen
 * (several screenshots of one statement are its pages, in order).
 */
export function statementFiles(list: FileList | null | undefined): File[] {
  const files = Array.from(list ?? []);
  const images = files.filter(isImage);
  if (images.length > 0 && canReadImages()) return images;
  const pdf = files.find(f => !isImage(f));
  return pdf ? [pdf] : [];
}

/** Whether a file chosen is an image rather than a PDF. */
export function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/** The text recognition is still being fetched by the phone. */
export class ReaderNotReady extends Error {
  constructor() {
    super('not ready');
    this.name = 'ReaderNotReady';
  }
}

async function upright(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, LONGEST / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new StatementUnreadable('no canvas');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL('image/jpeg', 0.9);
  return url.slice(url.indexOf(',') + 1);
}

/** The text of the images, in the order chosen, one page each. */
export async function textOfImages(
  files: readonly File[],
  options: { onProgress?: (progress: ReadingProgress) => void; signal?: AbortSignal } = {},
): Promise<TextItem[]> {
  const say = options.onProgress ?? (() => {});
  const pages: OcrPage[] = [];
  for (let i = 0; i < files.length; i++) {
    stopIfCancelled(options.signal);
    say({ part: 0.05 + 0.6 * (i / files.length), stage: 'pages', page: i + 1, pages: files.length });
    let image: string;
    try {
      image = await upright(files[i]);
    } catch (error) {
      if (error instanceof StatementUnreadable) throw error;
      throw new StatementUnreadable(`image: ${(error as Error).message ?? String(error)}`);
    }
    stopIfCancelled(options.signal);
    try {
      pages.push(await Native.read({ image }));
    } catch (error) {
      const message = (error as Error).message ?? String(error);
      if (message.includes('not ready')) throw new ReaderNotReady();
      throw new StatementUnreadable(`ocr: ${message}`);
    }
  }
  const items = itemsOfPages(pages);
  if (items.length === 0) throw new StatementUnreadable('no text');
  return items;
}
