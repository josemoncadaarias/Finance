/**
 * SQL rewritten into the one shape both SQLite plugins run correctly.
 *
 * The plugin does not hand a multi-statement string to SQLite as it is.
 *
 *   * In the browser, jeep-sqlite removes EVERY newline from a string that
 *     contains "DELETE FROM" anywhere, before running it. The first `--`
 *     comment then swallows the rest of the string, SQLite is handed nothing
 *     but a comment, and it succeeds at doing nothing. That is how migration
 *     030 reported success on the web and added no column - and very likely
 *     why migrations 023 to 026 never deleted the duplicate card they were
 *     written to delete. Removing newlines also glues words across lines:
 *     `FROM yield_rates r` followed by `JOIN ...` becomes `rJOIN`.
 *   * On a device the string is split on ";\n" instead.
 *
 * So the SQL goes out with its comments removed and EACH STATEMENT ON ONE
 * LINE: the lines of a statement joined by a space, a newline only after the
 * semicolon that ends it. Split on ";\n" it splits into the same statements;
 * with its newlines removed it still reads the same.
 *
 *   * On an iPhone (found by the simulator run, 2026-11-25) the plugin trims
 *     every line, spaces included, and then - for a string holding "DELETE
 *     FROM" - removes the newlines too. A space left at the end of a line was
 *     trimmed away first, so `UPDATE transactions` and `SET account_id = ...`
 *     became `transactionsSET` and migration 023 failed. With no line break
 *     inside a statement there is nothing to glue.
 */
export function sqlForPlugin(sql: string): string {
  const out: string[] = [];
  let statement: string[] = [];
  for (const rawLine of sql.split(/\r?\n/)) {
    const line = withoutComment(rawLine).trim();
    if (line.length === 0) continue;
    statement.push(line);
    if (line.endsWith(';')) {
      out.push(`${statement.join(' ')}\n`);
      statement = [];
    }
  }
  if (statement.length > 0) out.push(`${statement.join(' ')}\n`);
  return out.join('');
}

/**
 * A value as the device plugin will bind it.
 *
 * On Android the only object the plugin accepts among the values is a Node-style
 * buffer, `{ type: 'Buffer', data: [...] }`; anything else it reads as an object
 * without a `type` and fails with "No value for type". A `Uint8Array` - an icon
 * image - crosses the bridge as exactly such an object, so the first restore of
 * a backup on Jose's phone stopped at the first icon (2026-09-12). The browser
 * plugin takes the `Uint8Array` as it is.
 *
 * iOS wants another shape (`CapacitorSQLite.run` in the plugin's Swift): an
 * object whose keys are the byte positions and whose values are the bytes, read
 * in the keys' natural order - which is what a `Uint8Array` becomes on the
 * bridge. Handed the Android shape, its `type: 'Buffer'` is no byte and it fails
 * with "Error in reading buffer": the sample data, which carries pictures of
 * its own, did not load on the iPhone simulator (2026-11-25).
 */
export function paramForDevice(value: unknown, platform: 'android' | 'ios' = 'android'): unknown {
  if (!(value instanceof Uint8Array)) return value;
  if (platform === 'ios') {
    const bytes: Record<string, number> = {};
    value.forEach((byte, index) => { bytes[String(index)] = byte; });
    return bytes;
  }
  return { type: 'Buffer', data: Array.from(value) };
}

/**
 * A row as the device plugin returns it, with its BLOBs as bytes again.
 *
 * Android hands a BLOB back as an array of byte values. No other column comes
 * back as an array - text is a string, numbers are numbers - so every array is
 * a BLOB. Left as an array, a backup made on the phone would write it as a list
 * of numbers and restore it as one, and the icon would be lost.
 */
export function rowFromDevice<T>(row: T): T {
  const fields = row as Record<string, unknown>;
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) fields[key] = Uint8Array.from(value as number[]);
  }
  return row;
}

/** A line without its `--` comment. A `--` inside a quoted string is left alone. */
function withoutComment(line: string): string {
  let quoted = false;
  for (let at = 0; at < line.length; at++) {
    const char = line[at];
    // An escaped quote inside a string is two quotes, which toggles twice.
    if (char === "'") quoted = !quoted;
    else if (!quoted && char === '-' && line[at + 1] === '-') return line.slice(0, at);
  }
  return line;
}
