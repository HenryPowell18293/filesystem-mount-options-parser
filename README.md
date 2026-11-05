# filesystem-mount-options-parser

Parses `/proc/mounts` or `/etc/fstab` lines into structured objects with a `Map` of decoded mount options plus numeric `dump` and `pass` fields.

```js
import { parseMountEntry, parseMountFile, parseOptions } from 'filesystem-mount-options-parser';

const entry = parseMountEntry('/dev/sda1 /boot ext4 rw,noatime 0 2');
entry.device;            // '/dev/sda1'
entry.mountPoint;        // '/boot'
entry.fstype;            // 'ext4'
entry.options.get('rw'); // true
entry.options.get('noatime'); // true
entry.dump;              // 0
entry.pass;              // 2

const entries = parseMountFile('/dev/sda1 / ext4 rw,relatime 0 1\n# ignored\n');
entries.length;          // 1

parseOptions('rw,uid=1000').get('uid'); // '1000'
```

## Why this exists

Mount tables are line-oriented but not trivial: `/proc/mounts` escapes spaces in paths as `\040`, option strings mix flags and key=value pairs, and `dump`/`pass` may be omitted. Reading those fields by hand with `split(' ')` breaks on escaped paths and on option values that contain `=`.

This library makes one decision: a single parser handles both `/proc/mounts` and `/etc/fstab`, and it always decodes `\NNN` octal escapes. That is correct for `/proc/mounts` and harmless for `/etc/fstab`, where those sequences do not occur in practice. The alternative — two parsers with different escape rules — would double the API surface for a difference that almost never matters.

## Exports

- `parseMountEntry(line)` — parse one line; returns `null` for blank or `#` comment lines; throws on malformed entries.
- `parseMountFile(text)` — parse a whole file; skips blanks and comments; throws on the first malformed entry.
- `parseOptions(string)` — parse an option string into a `Map<string, string | true>`.

## The awkward edge

Option values cannot contain a comma. `parseOptions` splits on every comma, so `foo=a,b` becomes two entries, not one. That matches the kernel's mount option grammar, but it surprises people who expect CSV-style quoting. If you need commas inside a value, encode them before the option string reaches this parser.
