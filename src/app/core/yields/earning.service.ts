/**
 * Whether any account earns: the Cuentas tab shows its Rendimientos face only
 * then (Jose, 2026-10-15, mockup 31c - what the person does not use is not
 * shown). Read once per change to the data. Más → Productos y rendimientos
 * stays the way in to set up the first one.
 */
import { Injectable, effect, inject, signal, untracked } from '@angular/core';

import { DatabaseService } from '../database/database.service';
import { YieldsRepository } from '../database/repositories/yields.repository';

@Injectable({ providedIn: 'root' })
export class EarningService {
  private readonly database = inject(DatabaseService);
  /** null until read: the face stays until it is known not to be needed. */
  readonly any = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      this.database.dataVersion();
      if (this.database.status() !== 'ready') return;
      untracked(async () => {
        try {
          this.any.set((await new YieldsRepository(this.database.driver).accounts()).length > 0);
        } catch {
          this.any.set(null);
        }
      });
    });
  }
}
