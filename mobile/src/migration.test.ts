import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMigration, validateWebMigration} from './migration';
import {initialState} from './types';
const good = {
  format:'saheli-web-export-v1', exportedAt:'2026-10-25T00:00:00.000Z',
  contacts:[{id:'c1',name:'Asha',phone:'+919999999999',types:['SOS','malicious']}],
  alerts:[{kind:'SOS alert',time:1_700_000_000_000,status:'Sent'},{kind:'Other',time:1}],
  journey:{destination:'Home',arrival:1_900_000_000_000,interval:30,nextCheck:1_800_000_000_000},
  incidents:[{title:'Threat',category:'Harassment',note:'private note',sender:'site',risk:'High',time:1_700_000_000_000}],
};
test('validates version, bounds, and filters malformed records before preview', () => {
  const parsed = validateWebMigration(good);
  assert.equal(parsed.contacts.length, 1);
  assert.deepEqual(parsed.contacts[0].types, ['SOS']);
  assert.equal(parsed.invalid.alerts.skipped, 1);
  assert.throws(() => validateWebMigration({...good, format:'v99'}), /Unsupported/);
  assert.throws(() => validateWebMigration({...good, journey:{destination:'',arrival:0,interval:0,nextCheck:0}}), /journey data is malformed/);
});
test('imports selected categories only, de-duplicates and never overwrites active journey', () => {
  const data = validateWebMigration(good);
  const existing = {...initialState, contacts:[{id:'old',name:'Asha',value:'+919999999999',method:'phone' as const,preferences:['SOS'],verification:'unverified' as const}], journey:{id:'local',destination:'Current trip',arrival:5,interval:30,grace:2,nextCheck:4,stage:'monitoring' as const}};
  const plan = applyMigration(data, existing, ['contacts','journey','incidents']);
  assert.equal(plan.state.contacts.length, 1);
  assert.equal(plan.counts.contacts.skipped, 1);
  assert.equal(plan.state.journey?.id, 'local');
  assert.equal(plan.counts.journey.skipped, 1);
  assert.equal(plan.state.incidents.length, 1);
  assert.equal(plan.state.alerts.length, 0, 'unselected alerts remain unimported');
});
