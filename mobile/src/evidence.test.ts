import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceHash, evidenceMatches, safeEvidenceName, validEvidenceFile, MAX_EVIDENCE_BYTES} from './evidence';
const abc = new TextEncoder().encode('abc');
test('SHA-256 matches a standard known vector and detects changed bytes', () => {
  const hash = evidenceHash(abc);
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(evidenceMatches(abc, hash, 3), true);
  assert.equal(evidenceMatches(new TextEncoder().encode('abd'), hash, 3), false);
});
test('evidence acceptance checks size and extension/MIME; names cannot traverse paths', () => {
  assert.equal(validEvidenceFile('report.pdf', 'application/pdf', 10), true);
  assert.equal(validEvidenceFile('archive.exe', 'application/octet-stream', 10), false);
  assert.equal(validEvidenceFile('empty.txt', 'text/plain', 0), false);
  assert.equal(validEvidenceFile('huge.txt', 'text/plain', MAX_EVIDENCE_BYTES+1), false);
  assert.equal(safeEvidenceName('../private\\file.pdf').includes('/'), false);
  assert.equal(safeEvidenceName('../private\\file.pdf').includes('..'), false);
});
