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
    const listed = await repository.list();

    const missing = listed.filter(icon => !known.has(icon.id));
    if (missing.length === 0) return;

    const urls = new Map(known);
    for (const icon of missing) {
      const full = await repository.findById(icon.id);
      if (full) urls.set(icon.id, iconDataUrl(full));
    }
    this.urls.set(urls);
  }

  /** Drops an image that has been replaced, so the next load fetches it again. */
  forget(id: number): void {
    this.urls.update(current => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }
}
