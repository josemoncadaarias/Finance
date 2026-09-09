/**
 * Applies the account settings that can only come from Jose.
 *
 * Whether an account counts towards net worth is not in the backup — Monefy
 * exports eight columns and none of them is that flag — so it lives in
 * `KNOWN_ACCOUNTS` as configuration. Which means it has to be **applied**,
 * not merely used when a row is first created.
 *
 * This runs on startup, right after the migrations, but **only until the flag
 * can be set from inside the app**. Without it, changing the configuration
 * only reached a database that was imported afterwards, and an existing one
 * kept a stale answer until its owner happened to re-import — which is exactly
 * how Jose ended up looking at a net worth 63 million too high, twice, after
 * being told it was fixed.
 *
 * Now that the account editor exists, re-applying on every start would be the
 * opposite mistake: someone turns eToro back on, restarts, and the app quietly
 * turns it off again. So it applies once per database and records that it did.
 * From then on the answer is whatever the user last said, and this table is
 * only the starting point.
 */

import type { SqlDriver } from './sql-driver';
import { KNOWN_ACCOUNTS } from './import/account-plan';

export interface SettingsApplied {
  /** Accounts whose net-worth flag was corrected. */
  changed: { name: string; includeInNetWorth: boolean }[];
}

/** Marks that the defaults have been seeded, so they are never re-applied. */
const APPLIED_KEY = 'account_settings.seeded';

export async function applyAccountSettings(driver: SqlDriver): Promise<SettingsApplied> {
  const changed: SettingsApplied['changed'] = [];

  const seeded = await driver.queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', [APPLIED_KEY]);
  if (seeded) return { changed };

  for (const [sourceName, known] of Object.entries(KNOWN_ACCOUNTS)) {
    if (known.includeInNetWorth === undefined) continue;

    const wanted = known.includeInNetWorth ? 1 : 0;

    // A multi-currency account is several rows sharing a name prefix, so the
    // flag has to reach every one of them: `ARQ` is `ARQ USD` and `ARQ EUR`.
    const rows = await driver.query<{ id: number; name: string; include_in_net_worth: number }>(
      `SELECT id, name, include_in_net_worth FROM accounts
       WHERE name = ? OR name LIKE ? || ' %'`,
      [sourceName, sourceName],
    );

    for (const row of rows) {
      if (row.include_in_net_worth === wanted) continue;

      await driver.run(
        'UPDATE accounts SET include_in_net_worth = ?, updated_at = ? WHERE id = ?',
        [wanted, new Date().toISOString(), row.id],
      );
      changed.push({ name: row.name, includeInNetWorth: known.includeInNetWorth });
    }
  }

  await driver.run(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
    [APPLIED_KEY, new Date().toISOString(), new Date().toISOString()]);

  return { changed };
}
