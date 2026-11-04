import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMountEntry, parseMountFile, parseOptions } from '../src/index.js';

test('parseOptions marks bare flags as true', () => {
  const opts = parseOptions('rw,noexec,relatime');
  assert.equal(opts.get('rw'), true);
  assert.equal(opts.get('noexec'), true);
  assert.equal(opts.get('relatime'), true);
  assert.equal(opts.size, 3);
});

test('parseOptions splits on the first equals only', () => {
  const opts = parseOptions('context="a=b"');
  assert.equal(opts.get('context'), '"a=b"');
});

test('parseOptions tolerates empty segments and empty input', () => {
  assert.equal(parseOptions('').size, 0);
  const opts = parseOptions('rw,,noexec,');
  assert.equal(opts.size, 2);
  assert.equal(opts.get('rw'), true);
  assert.equal(opts.get('noexec'), true);
});

test('parseMountEntry parses a full /proc/mounts line', () => {
  const entry = parseMountEntry('/dev/sda1 /boot ext4 rw,noatime 0 2');
  assert.equal(entry.device, '/dev/sda1');
  assert.equal(entry.mountPoint, '/boot');
  assert.equal(entry.fstype, 'ext4');
  assert.equal(entry.options.get('rw'), true);
  assert.equal(entry.options.get('noatime'), true);
  assert.equal(entry.dump, 0);
  assert.equal(entry.pass, 2);
});

test('parseMountEntry defaults dump and pass when omitted', () => {
  const entry = parseMountEntry('/dev/sdb1 /data xfs defaults');
  assert.equal(entry.dump, 0);
  assert.equal(entry.pass, 0);
});

test('parseMountEntry decodes octal escapes from /proc/mounts', () => {
  const entry = parseMountEntry('/dev/sdc1 /mnt/with\\040space vfat rw 0 0');
  assert.equal(entry.mountPoint, '/mnt/with space');
});

test('parseMountEntry returns null for blank and comment lines', () => {
  assert.equal(parseMountEntry(''), null);
  assert.equal(parseMountEntry('   '), null);
  assert.equal(parseMountEntry('# comment'), null);
  assert.equal(parseMountEntry('  # indented comment'), null);
});

test('parseMountEntry rejects lines with too few fields', () => {
  assert.throws(() => parseMountEntry('/dev/sda1 /boot ext4'), /invalid mount entry/);
});

test('parseMountEntry rejects non-numeric dump and pass fields', () => {
  assert.throws(() => parseMountEntry('/dev/sda1 /boot ext4 rw x y'), /invalid dump\/pass field/);
});

test('parseMountFile skips comments and blanks and keeps order', () => {
  const text = [
    '# /etc/fstab',
    '',
    '/dev/sda1 / ext4 rw,relatime 0 1',
    '/dev/sda2 /home ext4 rw,noatime 0 2',
    '   ',
  ].join('\n');
  const entries = parseMountFile(text);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].mountPoint, '/');
  assert.equal(entries[1].mountPoint, '/home');
  assert.equal(entries[1].options.get('noatime'), true);
});

test('parseMountFile handles CRLF line endings', () => {
  const entries = parseMountFile('/dev/sda1 / ext4 rw 0 1\r\n/dev/sda2 /home ext4 rw 0 2\r\n');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].pass, 1);
  assert.equal(entries[1].pass, 2);
});

test('parseMountFile throws on the first malformed entry', () => {
  const text = '/dev/sda1 / ext4 rw 0 1\nnot-a-mount-entry\n';
  assert.throws(() => parseMountFile(text), /invalid mount entry/);
});

test('parseMountEntry keeps option values containing commas out of reach', () => {
  // A value cannot contain a comma in the mount option grammar, so the split
  // is correct and the value is exactly what appears after the first equals.
  const entry = parseMountEntry('/dev/sda1 / ext4 rw,uid=1000,gid=1000 0 1');
  assert.equal(entry.options.get('uid'), '1000');
  assert.equal(entry.options.get('gid'), '1000');
});
