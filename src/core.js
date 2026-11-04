// Core parsing logic for /proc/mounts and /etc/fstab style entries.
//
// Design decision: a single parser handles both formats because they share the
// same field layout (device, mount point, fstype, options, dump, pass). The only
// real difference is that /proc/mounts escapes spaces as \040 and /etc/fstab
// does not. We decode \040, \011, \012, and \134 unconditionally; that is safe
// for fstab because those sequences do not appear in normal fstab paths.

const ESCAPE_RE = /\\([0-7]{3})/g;

/**
 * Decode octal escapes used by /proc/mounts (e.g. \040 for space).
 * fstab entries are not escaped, but decoding is harmless for them.
 * @param {string} value
 * @returns {string}
 */
function decodeEscapes(value) {
  return value.replace(ESCAPE_RE, (_match, octal) =>
    String.fromCharCode(parseInt(octal, 8)),
  );
}

/**
 * Parse an option string like "rw,noexec,relatime" into a Map.
 *
 * Flags are stored with value `true`. Options with a value use the first `=`
 * as the separator, so `context="a=b"` yields key `context` and value `"a=b"`.
 * Empty segments are skipped; a trailing comma is therefore tolerated.
 *
 * @param {string} options
 * @returns {Map<string, string|true>}
 */
export function parseOptions(options) {
  const result = new Map();
  if (options === '') {
    return result;
  }
  for (const segment of options.split(',')) {
    if (segment === '') {
      continue;
    }
    const eq = segment.indexOf('=');
    if (eq === -1) {
      result.set(segment, true);
    } else {
      const key = segment.slice(0, eq);
      const value = segment.slice(eq + 1);
      result.set(key, value);
    }
  }
  return result;
}

/**
 * Parse one line from /proc/mounts or /etc/fstab.
 *
 * Returns `null` for blank lines and comment lines (lines whose first
 * non-whitespace character is `#`). Throws if the line has fewer than four
 * fields, because such a line is not a valid mount entry in either format.
 *
 * @param {string} line
 * @returns {{device: string, mountPoint: string, fstype: string, options: Map<string, string|true>, dump: number, pass: number} | null}
 */
export function parseMountEntry(line) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) {
    return null;
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length < 4) {
    throw new Error(`invalid mount entry: ${line}`);
  }
  const [device, mountPoint, fstype, optionString] = fields;
  const dump = fields.length >= 5 ? Number.parseInt(fields[4], 10) : 0;
  const pass = fields.length >= 6 ? Number.parseInt(fields[5], 10) : 0;
  if (Number.isNaN(dump) || Number.isNaN(pass)) {
    throw new Error(`invalid dump/pass field: ${line}`);
  }
  return {
    device: decodeEscapes(device),
    mountPoint: decodeEscapes(mountPoint),
    fstype,
    options: parseOptions(optionString),
    dump,
    pass,
  };
}

/**
 * Parse the whole text of /proc/mounts or /etc/fstab.
 *
 * Skips blank and comment lines. Throws on the first malformed entry so the
 * caller is not left with a partially valid result that silently drops data.
 *
 * @param {string} text
 * @returns {Array<{device: string, mountPoint: string, fstype: string, options: Map<string, string|true>, dump: number, pass: number}>}
 */
export function parseMountFile(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const entry = parseMountEntry(line);
    if (entry !== null) {
      entries.push(entry);
    }
  }
  return entries;
}
