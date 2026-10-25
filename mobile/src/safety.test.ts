import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalSOS, recentSOSId, removeSimulatedAlerts} from './safety';
import type {AlertRecord} from './types';
const real: AlertRecord = {id:'real-1', kind:'SOS', time:1000, status:'Queued', network:'unconfirmed'};
const demo: AlertRecord = {id:'demo-1', kind:'SIMULATED', time:1000, status:'Sent', network:'simulation', demo:true};

test('offline SOS creation is durable-ready data, consent-scoped, and idempotent within the tap window', () => {
  const made = createLocalSOS([], 1000, () => 'sos-1', false);
  assert.equal(made.created, true);
  assert.equal(made.alerts.length, 1);
  assert.equal(made.alerts[0].status, 'Queued');
  assert.match(made.alerts[0].note || '', /No location/);
  const again = createLocalSOS(made.alerts, 2000, () => 'sos-2', true, {latitude: 20, longitude: 74});
  assert.equal(again.created, false);
  assert.equal(again.id, 'sos-1');
  assert.equal(again.record.note, made.record.note);
  assert.equal(again.alerts.length, 1);
});

test('invalid location is never added and simulated events are not SOS duplicates', () => {
  const invalid = createLocalSOS([], 1000, () => 'sos-1', true, {latitude: 120, longitude: 74});
  assert.equal('location' in invalid.alerts[0], false);
  const fromDemo = createLocalSOS([demo], 1000, () => 'sos-2', false);
  assert.equal(fromDemo.created, true);
});

test('only recent real SOS records are deduplicated; demo reset preserves real events', () => {
  assert.equal(recentSOSId([real], 5000), 'real-1');
  assert.equal(recentSOSId([demo], 5000), null);
  assert.equal(recentSOSId([{...real, time:0}], 10_001), null);
  assert.equal(recentSOSId([real], 999), null);
  assert.deepEqual(removeSimulatedAlerts([demo, real]), [real]);
  assert.deepEqual(removeSimulatedAlerts([{...real, demo:true}]), []);
});
