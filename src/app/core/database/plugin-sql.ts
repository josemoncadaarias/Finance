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
