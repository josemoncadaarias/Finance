/**
 * Hands a file to the person: a download in a browser, the system's save
 * dialog on Android.
 *
 * A link clicked from code. Shared by every screen that produces a file, so
 * the one quirk it carries - revoking the address a moment later, not at once
 * - lives in one place.
 */
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoked on the next tick: revoking immediately cancels the download in
  // some browsers before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
