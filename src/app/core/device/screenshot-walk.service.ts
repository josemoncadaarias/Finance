import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Directory, Filesystem, Encoding } from '@capacitor/filesystem';

import { DEVICE } from './device';
import { DatabaseService } from '../database/database.service';
import { DemoService } from '../demo/demo.service';
import { TourService } from '../tour/tour.service';

/** What the iOS simulator's run hands the app: the screens to show, in order. */
interface Walk {
  /** Load the sample data first (into an empty app). */
  demo?: boolean;
  /** Each screen: a name for its picture and the route that shows it. */
  shots: { name: string; route: string }[];
}

/** Written beside `index.html` ONLY by `.github/workflows/ios-simulator.yml`. */
const WALK_FILE = 'screenshot-walk.json';
const STEP_FILE = 'walk-step.txt';
/** Why the sample data did not load, when it did not. */
const ERROR_FILE = 'walk-error.txt';
/** Time for a screen to draw before its picture is asked for. */
const SETTLE_MS = 3000;
const WAIT_MS = 60_000;

/**
 * The screenshot run of the iOS simulator. Every other build has no
 * `screenshot-walk.json`, so this asks once for a file that is not there and
 * does nothing more - and only on an iPhone.
 *
 * With the file, it goes through each screen and talks with the workflow
 * through two files in the app's Documents folder: it writes `walk-step.txt`
 * ("3|accounts") once a screen has drawn, and waits for the workflow to take
 * the picture and leave `shot-3.done` beside it. So no picture is taken of a
 * screen still loading, however slow the runner. Guides are switched off.
 */
@Injectable({ providedIn: 'root' })
export class ScreenshotWalkService {
  private readonly router = inject(Router);
  private readonly database = inject(DatabaseService);
  private readonly demo = inject(DemoService);
  private readonly tours = inject(TourService);
  private started = false;

  constructor() {
    if (DEVICE.platform !== 'ios') return;
    effect(() => {
      if (this.database.status() !== 'ready' || this.started) return;
      this.started = true;
      untracked(() => void this.begin());
    });
  }

  private async begin(): Promise<void> {
    let walk: Walk;
    try {
      const answer = await fetch(WALK_FILE, { cache: 'no-store' });
      if (!answer.ok) return;
      walk = await answer.json() as Walk;
    } catch {
      return;
    }
    this.tours.setEnabled(false);
    if (walk.demo) {
      try {
        await this.demo.load(() => undefined);
      } catch (error) {
        // Written for the workflow to print: on 2026-11-25 the sample data did
        // not load on the simulator and nothing said why.
        await write(ERROR_FILE, describe(error)).catch(() => undefined);
      }
    }
    for (const [i, shot] of walk.shots.entries()) {
      await this.router.navigateByUrl(shot.route);
      await pause(SETTLE_MS);
      await write(STEP_FILE, `${i}|${shot.name}`);
      await this.waitFor(`shot-${i}.done`);
    }
    await write(STEP_FILE, 'end');
  }

  private async waitFor(path: string): Promise<void> {
    const until = Date.now() + WAIT_MS;
    while (Date.now() < until) {
      try {
        await Filesystem.stat({ path, directory: Directory.Documents });
        return;
      } catch {
        await pause(400);
      }
    }
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function write(path: string, data: string): Promise<void> {
  await Filesystem.writeFile({ path, data, directory: Directory.Documents, encoding: Encoding.UTF8 });
}
