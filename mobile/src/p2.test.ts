import test from 'node:test';
import assert from 'node:assert/strict';
import {createVolunteerRecord, inspectJpegGps, makeSupportRequest, toggleChecklist, validateVolunteer} from './p2';

function jpegWithGps(gps: boolean): Uint8Array {
  const tiff = new Uint8Array(44);
  tiff[0]=0x49;tiff[1]=0x49;tiff[2]=42;tiff[4]=8; // little-endian TIFF header, IFD0 offset
  tiff[8]=1; // one IFD0 entry
  tiff[10]=0x25;tiff[11]=0x88;tiff[12]=4;tiff[14]=1;tiff[18]=26; // GPS IFD pointer
  if (gps) { tiff[26]=1;tiff[28]=1;tiff[30]=2;tiff[32]=2;tiff[36]=0x4e; }
  const exif = new Uint8Array(6+tiff.length); exif.set([0x45,0x78,0x69,0x66,0,0]);exif.set(tiff,6);
  const segmentLen=exif.length+2;
  const out=new Uint8Array(2+2+2+exif.length+2);
  out.set([0xff,0xd8,0xff,0xe1,segmentLen>>8,segmentLen&255]);out.set(exif,6);out.set([0xff,0xd9],6+exif.length);
  return out;
}

test('JPEG GPS parser distinguishes GPS tags, absent tags, unsupported data and malformed segments', () => {
  assert.equal(inspectJpegGps(jpegWithGps(true)), 'gps-present');
  assert.equal(inspectJpegGps(jpegWithGps(false)), 'gps-not-found');
  assert.equal(inspectJpegGps(new Uint8Array([1,2,3])), 'unsupported');
  assert.equal(inspectJpegGps(new Uint8Array([0xff,0xd8,0xff,0xe1,0,80,1])), 'malformed');
});

test('checklist toggles are immutable and reject unsafe keys', () => {
  const original={profile:false};
  const done=toggleChecklist(original,'profile');
  assert.deepEqual(done,{profile:true});assert.deepEqual(original,{profile:false});
  assert.throws(()=>toggleChecklist(original,'../../x'));
});

test('volunteer data validation distinguishes opted-in demo and unverified records only', () => {
  assert.deepEqual(validateVolunteer('  Sam  ','sam@example.org','unverified'),{name:'Sam',contact:'sam@example.org',verification:'unverified'});
  assert.equal(validateVolunteer('Demo','+1 (555) 123-4567','demo').verification,'demo');
  assert.throws(()=>validateVolunteer('A','not contact','unverified'));
  assert.throws(()=>createVolunteerRecord('id','Sam','sam@example.org','unverified',false,1),/opt-in/);
  assert.equal(createVolunteerRecord('id','Sam','sam@example.org','unverified',true,1).optedIn,true);
  assert.equal(createVolunteerRecord('demo','Demo','demo@example.org','demo',false,1).optedIn,false);
});

test('support request includes only user-selected text, no location or volunteer contact', () => {
  const request=makeSupportRequest(['Rita'],'Please call when available','+91 99999 11111');
  assert.match(request,/Rita/);assert.match(request,/Please call/);assert.doesNotMatch(request,/location:|latitude|longitude/);assert.doesNotMatch(request,/sam@example/);
  assert.throws(()=>makeSupportRequest([],'  ',' '));
});
