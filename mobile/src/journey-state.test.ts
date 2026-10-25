import test from 'node:test';
import assert from 'node:assert/strict';
import {transitionJourney} from './journey-state';
import type {Journey} from './types';
const journey: Journey = {id:'j1', destination:'Home', arrival:10_000, interval:30, grace:2, nextCheck:1_000, stage:'monitoring'};
test('journey moves to grace at check-in due and escalation only after grace', () => {
  const due = transitionJourney(journey, 1_000);
  assert.equal(due?.kind, 'check-in-due');
  assert.equal(due?.journey.stage, 'grace');
  assert.equal(due?.journey.graceUntil, 121_000);
  assert.equal(transitionJourney(due!.journey, 120_999), null);
  assert.equal(transitionJourney(due!.journey, 121_000)?.kind, 'grace-expired');
});
test('a long pause can move directly to local escalation; no transition repeats', () => {
  const overdue = transitionJourney(journey, 121_001);
  assert.equal(overdue?.journey.stage, 'escalation_attempted');
  assert.equal(transitionJourney(overdue!.journey, 999_999), null);
  assert.equal(transitionJourney(null, 0), null);
});
test('timestamp arithmetic is fixed-duration and timezone-independent', () => {
  assert.equal(transitionJourney({...journey, nextCheck: 86_399_000}, 86_399_000)?.journey.graceUntil, 86_519_000);
});
