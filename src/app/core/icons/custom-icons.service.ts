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
import {
  CustomIconsRepository, iconDataUrl, type CustomIcon,
} from '../database/repositories/custom-icons.repository';

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

  /** The icons themselves, without their images: enough to list them. */
  readonly icons = signal<CustomIcon[]>([]);

  /** The image for an icon, or nothing — in which case draw the built-in one. */
  urlFor(id: number | null | undefined): string | undefined {
    return id === null || id === undefined ? undefined : this.urls().get(id);
  }

  /**
   * Reads whatever is not in memory yet.
   *
   * Called on nearly every screen, and by the app shell after every write to
   * the database. It said it was cheap and it was not: it read every icon's
   * image every time and only skipped turning the ones it already had into
   * URLs. On Android a BLOB arrives as a JSON array with one number per byte,
   * so each of those calls carried fifty-odd logos across the bridge as text -
   * which is why screens took seconds on the phone and none in the browser.
   *
   * So the list of icons is read every time - ids and names, no images - and
   * only the images of ids not yet in memory are read at all. Comparing ids is
   * enough because an icon's bytes never change under its id: nothing updates
   * `custom_icons`, and a new image is always a new row. Should that ever
   * change, an edited image would be missed here and this must learn to
   * compare something else.
   */
  async load(): Promise<void> {
    if (this.database.status() !== 'ready') return;

    const repository = new CustomIconsRepository(this.database.driver);
    const known = this.urls();

    // In id order, the order the icon picker has always shown them in.
    const listed = (await repository.list()).sort((a, b) => a.id - b.id);
    this.read = true;
    this.icons.set(listed);

    const missing = listed.filter(icon => !known.has(icon.id)).map(icon => icon.id);
    if (missing.length > 0) {
      const urls = new Map(known);
      for (const icon of await repository.byIds(missing)) urls.set(icon.id, iconDataUrl(icon));
      this.urls.set(urls);
    }
    this.loading.set(false);
  }

  /** Reads them again, for after one has been added or replaced. */
  async refresh(): Promise<void> {
    this.read = false;
    await this.load();
  }

  /** Whether an icon that exists simply has not been read yet. */
  stillReading(): boolean {
    return !this.read;
  }
}
