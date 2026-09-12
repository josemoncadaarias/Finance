/**
 * Hands a file to the person: a download in a browser, the share sheet on the
 * phone.
 *
 * Shared by every screen that produces a file - the backup, the CSV, the tax
 * spreadsheet - so how a file leaves the app lives in one place.
 *
 * On Android a link clicked from code does nothing: the app's WebView has no
 * downloads, so a backup made on the phone went nowhere. There the file is
 * written to the app's cache and offered through the system share sheet, where
 * Drive, Files or a chat can take it.
 *
 * Resolves to false when the person closed the share sheet without choosing,
 * so a screen does not claim the file was saved.
 */

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Bytes written per call on the phone. The backup runs to tens of megabytes and
 * crosses to the native side as base64 text, so it goes in pieces. A multiple of
 * three, so each piece encodes without padding and the pieces join cleanly.
 */
const CHUNK_BYTES = 3 * 512 * 1024;

export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    download(blob, name);
    return true;
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let uri = '';
  let at = 0;
  do {
    const data = toBase64(bytes.subarray(at, at + CHUNK_BYTES));
    if (at === 0) {
      uri = (await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })).uri;
    } else {
      await Filesystem.appendFile({ path: name, data, directory: Directory.Cache });
    }
    at += CHUNK_BYTES;
  } while (at < bytes.length);

  try {
    await Share.share({ title: name, dialogTitle: name, files: [uri] });
    return true;
  } catch (error) {
    // Closing the sheet is a choice, not a failure.
    if (/cancel/i.test(error instanceof Error ? error.message : String(error))) return false;
    throw error;
  }
}

/** A link clicked from code, which is a download in any browser. */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoked a moment later: revoking immediately cancels the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Base64 of some bytes, built in slices so a large file does not overflow the call stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
