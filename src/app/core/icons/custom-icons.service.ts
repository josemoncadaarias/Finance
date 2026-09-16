/**
 * The images accounts and categories wear, ready to render.
 *
 * A custom icon lives in the database as a BLOB, and every screen that draws
 * one needs the same three steps: read the rows, turn each into a data URL,
 * keep them by id. That loop was written out four times, and the fourth time
 * it was simply forgotten — the summary screen drew a built-in icon for an
 * account whose icon is a bank logo, so every account Jose had given a real
 * logo to came out wearing the wrong picture.
 *
 * One copy, injected wherever an icon is drawn. A screen that forgets to call
 * `load()` shows the fallback rather than the wrong image, which is the safer
 * way round.
 */

import { Injectable, inject, signal } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { CustomIconsRepository, iconDataUrl } from '../database/repositories/custom-icons.repository';

@Injectable({ providedIn: 'root' })
export class CustomIconsService {
  private readonly database = inject(DatabaseService);

  /** Data URLs by icon id. A signal, so a screen redraws when one arrives. */
  private readonly urls = signal<Map<number, string>>(new Map());

  /**
   * True until the images are in memory.
   *
   * A screen drawing an account whose icon has not arrived yet should say
   * "coming" rather than draw the generic wallet and then swap it: on a phone
   * that swap is slow enough to look like the wrong icon was chosen.
   */
  readonly loading = signal(true);

  /** Set once the first read finishes, so later calls are free. */
  private read = false;

  /** The image for an icon, or nothing — in which case draw the built-in one. */
  urlFor(id: number | null | undefined): string | undefined {
    return id === null || id === undefined ? undefined : this.urls().get(id);
  }

  /**
   * Reads whatever is not in memory yet.
   *
   * Icons are small and few, and they never change without the app knowing, so
   * this only ever grows. Cheap to call on every screen load; it does nothing
   * once the images are there.
   */
  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const repository = new CustomIconsRepository(this.database.driver);
    const known = this.urls();

    // Every image in one call rather than one call each. Fifty icons were
    // fifty crossings into the native side, each carrying an image.
    const all = await repository.all();
    this.read = true;

    const missing = all.filter(icon => !known.has(icon.id));
    if (missing.length > 0) {
      const urls = new Map(known);
      for (const icon of missing) urls.set(icon.id, iconDataUrl(icon));
      this.urls.set(urls);
    }
    this.loading.set(false);
  }

  /** Whether an icon that exists simply has not been read yet. */
  stillReading(): boolean {
    return !this.read;
  }

  /** Drops an image that has been replaced, so the next load fetches it again. */
  forget(id: number): void {
    this.read = false;
    this.urls.update(current => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }
}
