import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';

export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EVIDENCE_MIME = new Set([
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);
export function evidenceHash(bytes: Uint8Array): string { return bytesToHex(sha256(bytes)); }
export function evidenceMatches(bytes: Uint8Array, expectedHash: string, expectedSize: number): boolean {
  return bytes.byteLength === expectedSize && /^[a-f\d]{64}$/i.test(expectedHash) && evidenceHash(bytes) === expectedHash.toLowerCase();
}
export function safeEvidenceName(name: string): string {
  return name.replace(/[\\/\\0-\\x1f]/g, '_').replace(/\.\./g, '_').slice(0, 150) || 'evidence-file';
}
export function validEvidenceFile(name: string, mime: string, size: number): boolean {
  const ext = name.toLowerCase().split('.').pop() || '';
  const allowedExt = ['pdf','txt','docx','jpg','jpeg','png','webp','gif'].includes(ext);
  return Number.isFinite(size) && size > 0 && size <= MAX_EVIDENCE_BYTES && (ALLOWED_EVIDENCE_MIME.has(mime) || allowedExt);
}
