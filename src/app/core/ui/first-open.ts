/**
 * Which sections of a folding list are open: only the first, until the
 * person says otherwise (Jose, 2026-09-28: "mostrar la primera sección por
 * defecto y el resto de secciones colapsadas").
 *
 * What is kept is only what the person changed - the keys whose state is
 * not the default - so a list that grows, or whose first section changes,
 * still opens on its new first one without anybody resetting anything.
 */

import { computed, signal } from '@angular/core';

export class FirstOpen {
  private readonly flipped = signal<ReadonlySet<string>>(new Set());

  constructor(private readonly keys: () => readonly string[]) {}

  isOpen(key: string): boolean {
    return (key === this.keys()[0]) !== this.flipped().has(key);
  }

  toggle(key: string): void {
    this.flipped.update(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  /** True when no section is open, which is what "Abrir todas" answers to. */
  readonly allClosed = computed(() => {
    const keys = this.keys();
    return keys.length > 0 && keys.every(key => !this.isOpen(key));
  });

  /** Opens every section, or closes every one. */
  setAll(open: boolean): void {
    const keys = this.keys();
    this.flipped.set(new Set(keys.filter(key => (key === keys[0]) !== open)));
  }

  toggleAll(): void {
    this.setAll(this.allClosed());
  }

  /** Back to the first alone: a new account, a new period. */
  reset(): void {
    this.flipped.set(new Set());
  }
}
