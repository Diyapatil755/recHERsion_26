import type {SupportVolunteer} from './types';

export type JpegGpsResult = 'gps-present' | 'gps-not-found' | 'unsupported' | 'malformed';
export type VolunteerKind = 'unverified' | 'demo';

const u16 = (b: Uint8Array, o: number, le: boolean) => le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number, le: boolean) => le
  ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
  : (((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);

/** Reads JPEG APP1 EXIF/TIFF structures only. Does not decode, alter, or retain image bytes. */
export function inspectJpegGps(bytes: Uint8Array): JpegGpsResult {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 'unsupported';
  let p = 2;
  while (p < bytes.length) {
    if (bytes[p] !== 0xff) return 'malformed';
    while (p < bytes.length && bytes[p] === 0xff) p++;
    if (p >= bytes.length) return 'malformed';
    const marker = bytes[p++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (p + 2 > bytes.length) return 'malformed';
    const segmentLength = (bytes[p] << 8) | bytes[p + 1];
    if (segmentLength < 2 || p + segmentLength > bytes.length) return 'malformed';
    const segmentStart = p + 2;
    const segmentEnd = p + segmentLength;
    if (marker === 0xe1 && segmentEnd - segmentStart >= 6 &&
      bytes[segmentStart] === 0x45 && bytes[segmentStart + 1] === 0x78 && bytes[segmentStart + 2] === 0x69 &&
      bytes[segmentStart + 3] === 0x66 && bytes[segmentStart + 4] === 0 && bytes[segmentStart + 5] === 0) {
      const tiff = segmentStart + 6;
      if (tiff + 8 > segmentEnd) return 'malformed';
      const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
      const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
      if (!little && !big) return 'malformed';
      if (u16(bytes, tiff + 2, little) !== 42) return 'malformed';
      const ifd0Offset = u32(bytes, tiff + 4, little);
      const ifd0 = tiff + ifd0Offset;
      if (ifd0Offset < 8 || ifd0 + 2 > segmentEnd) return 'malformed';
      const count = u16(bytes, ifd0, little);
      if (ifd0 + 2 + count * 12 + 4 > segmentEnd) return 'malformed';
      for (let i = 0; i < count; i++) {
        const entry = ifd0 + 2 + i * 12;
        if (u16(bytes, entry, little) !== 0x8825) continue;
        const gpsOffset = u32(bytes, entry + 8, little);
        const gpsIfd = tiff + gpsOffset;
        if (gpsOffset < 8 || gpsIfd + 2 > segmentEnd) return 'malformed';
        const gpsCount = u16(bytes, gpsIfd, little);
        if (gpsIfd + 2 + gpsCount * 12 + 4 > segmentEnd) return 'malformed';
        for (let j = 0; j < gpsCount; j++) {
          const gpsTag = u16(bytes, gpsIfd + 2 + j * 12, little);
          if (gpsTag >= 0x0000 && gpsTag <= 0x001d) return 'gps-present';
        }
        return 'gps-not-found';
      }
    }
    p = segmentEnd;
  }
  return 'gps-not-found';
}

export function toggleChecklist(map: Record<string, boolean>, key: string): Record<string, boolean> {
  if (!/^[a-z0-9_-]{1,80}$/i.test(key)) throw new Error('Invalid checklist key.');
  return {...map, [key]: !map[key]};
}

export function validateVolunteer(name: string, contact: string, kind: VolunteerKind): {name: string; contact: string; verification: SupportVolunteer['verification']} {
  const cleanName = name.trim();
  const cleanContact = contact.trim();
  if (cleanName.length < 2 || cleanName.length > 100) throw new Error('Name must be 2–100 characters.');
  const validEmail = /^\S+@\S+\.\S+$/.test(cleanContact) && cleanContact.length <= 254;
  const validPhone = /^[+\d][\d\s()-]{5,22}$/.test(cleanContact);
  if (!validEmail && !validPhone) throw new Error('Enter a valid email or phone number.');
  return {name: cleanName, contact: cleanContact, verification: kind};
}

export function createVolunteerRecord(id:string,name:string,contact:string,kind:VolunteerKind,explicitOptIn:boolean,createdAt:number):SupportVolunteer {
  if(!id.trim()||id.length>120||!Number.isFinite(createdAt)||createdAt<=0)throw new Error('Invalid volunteer record metadata.');
  const checked=validateVolunteer(name,contact,kind);
  if(kind==='unverified'&&!explicitOptIn)throw new Error('Explicit volunteer opt-in is required.');
  return {id,name:checked.name,contact:checked.contact,verification:checked.verification,optedIn:kind==='unverified'&&explicitOptIn,createdAt};
}

export function makeSupportRequest(volunteerNames: string[], summary: string, callback: string): string {
  const cleanSummary = summary.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
  const cleanCallback = callback.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160);
  if (!cleanSummary) throw new Error('Write a brief request before preparing to share.');
  const targetLine = volunteerNames.map((name) => name.trim().slice(0, 100)).filter(Boolean).join(', ');
  return [
    'Saheli support request (user-prepared; not sent by Saheli)',
    targetLine ? `Intended support volunteer(s): ${targetLine}` : undefined,
    `Request: ${cleanSummary}`,
    cleanCallback ? `Callback detail volunteered by the user: ${cleanCallback}` : undefined,
    'No location is included. Please contact me only if you choose and are able.',
  ].filter(Boolean).join('\n');
}
