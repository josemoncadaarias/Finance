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
 * So the SQL goes out with its comments removed, and every line that does not
 * end a statement is followed by a space before its newline. With its
 * newlines removed it still reads the same; split on ";\n" it still splits
 * into the same statements.
 */
export function sqlForPlugin(sql: string): string {
  const out: string[] = [];
  for (const rawLine of sql.split(/\r?\n/)) {
    const line = withoutComment(rawLine).trimEnd();
    if (line.trim().length === 0) continue;
    out.push(line.endsWith(';') ? `${line}\n` : `${line} \n`);
  }
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
 */
export function paramForDevice(value: unknown): unknown {
  return value instanceof Uint8Array ? { type: 'Buffer', data: Array.from(value) } : value;
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
