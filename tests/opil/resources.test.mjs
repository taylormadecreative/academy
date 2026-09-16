// node --test tests/opil/resources.test.mjs — the Files tab's pure decisions
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileKind, KIND_WORD, canShowInline, fmtSize, FILE_MAX_BYTES, storagePath, fileRefusal, showingCopy } from '../../opil/hub/live-rooms.js';

test('fileKind reads the extension first, then the mime type, and never guesses beyond "file"', () => {
  assert.equal(fileKind('Team KIMT deck.pptx'), 'slides');
  assert.equal(fileKind('notes.PDF'), 'pdf');
  assert.equal(fileKind('budget.xlsx'), 'sheet');
  assert.equal(fileKind('photo.HEIC'), 'file');   /* a HEIC draws as a broken picture off Apple — download-only */
  assert.equal(fileKind('noext', 'application/pdf'), 'pdf');
  assert.equal(fileKind('noext', 'image/png'), 'image');
  assert.equal(fileKind('weird.bin', 'application/octet-stream'), 'file');
  assert.equal(KIND_WORD[fileKind('x.docx')], 'Doc');
});

test('only PDFs and pictures open on the stage; slides and docs are download-only', () => {
  assert.equal(canShowInline('pdf'), true);
  assert.equal(canShowInline('image'), true);
  for (const k of ['slides', 'doc', 'sheet', 'video', 'file']) assert.equal(canShowInline(k), false, k);
});

test('fmtSize reads like a person says it', () => {
  assert.equal(fmtSize(512), '512 B');
  assert.equal(fmtSize(24 * 1024), '24 KB');
  assert.equal(fmtSize(2.4 * 1024 * 1024), '2.4 MB');
  assert.equal(fmtSize(31 * 1024 * 1024), '31 MB');
});

test('storagePath stays inside materials/<uploader>/ and cleans the name', () => {
  const p = storagePath('u-1', '../../etc/passwd ; rm -rf', 'ts');
  assert.equal(p, 'materials/u-1/ts-....etcpasswd  rm -rf'.replace('  ', ' '));
  assert.ok(p.startsWith('materials/u-1/'));
  assert.equal(storagePath('u-1', '', 'ts'), 'materials/u-1/ts-file');
  assert.ok(storagePath('u-1', 'x'.repeat(300) + '.pdf', 'ts').length < 160);
});

test('fileRefusal: too big, empty, or missing — otherwise null', () => {
  assert.equal(fileRefusal(null), 'Pick a file first.');
  assert.match(fileRefusal({ size: FILE_MAX_BYTES + 1, name: 'big.pdf' }), /limit is 50 MB/);
  assert.equal(fileRefusal({ size: 0, name: 'x.pdf' }), 'That file is empty.');
  assert.equal(fileRefusal({ size: 1000, name: 'deck.pdf' }), null);
  assert.match(fileRefusal({ size: 1000, name: 'tool.exe' }), /can’t be shared here/);
  assert.match(fileRefusal({ size: 1000, name: 'noext' }), /can’t be shared here/);
});

test('showingCopy says who is showing what, and that a deck is a download', () => {
  assert.equal(showingCopy({ who: 'Kiara Pee', title: 'deck.pdf', kind: 'pdf', mine: false }), 'Kiara Pee is showing deck.pdf');
  assert.equal(showingCopy({ who: 'Kiara Pee', title: 'deck.pptx', kind: 'slides', mine: true }), 'You’re sharing deck.pptx — download it to open');
});
