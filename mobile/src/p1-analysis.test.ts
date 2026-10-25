import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeMessage, cautiousLevel, incidentRuleReview} from './p1-analysis';
import type {Incident} from './types';

const incident = (overrides: Partial<Incident> = {}): Incident => ({
  id:'incident-1', title:'Repeated unwanted contact', category:'Harassment', description:'They keep messaging after I blocked them.', sender:'@example', risk:'Low', time:123, files:[], ...overrides,
});

test('message analyzer returns cautious, explainable matches and does not classify unmatched text as safe', () => {
  const result = analyzeMessage('Pay me or I will leak your photo; send your password and intimate photo');
  assert.deepEqual(result.signals, ['blackmail','intimateCoercion','accountCoercion']);
  assert.equal(result.level, 'High');
  assert.equal(analyzeMessage('hello there').level, 'Low');
});

test('keyword rules recognize threat, harassment, coercion and multilingual cues', () => {
  assert.equal(analyzeMessage('I will kill you').level, 'High');
  assert.ok(analyzeMessage('They keep messaging me every day').signals.includes('repeatedContact'));
  assert.ok(analyzeMessage('पैसे नहीं दिए तो तस्वीरें वायरल कर दूँगा', 'hi').signals.includes('blackmail'));
  assert.ok(analyzeMessage('ओटीपी पाठव नाहीतर खाते बंद करेन', 'mr').signals.includes('accountCoercion'));
  assert.equal(analyzeMessage('hello').signals.length, 0);
});

test('incident review uses existing fields, explains rule cues and never changes saved incident', () => {
  const saved = incident();
  const before = structuredClone(saved);
  const review = incidentRuleReview(saved);
  assert.equal(review.level, 'Medium');
  assert.ok(review.signals.includes('repeatedContact'));
  assert.deepEqual(saved, before);
});

test('reported threat category is medium; explicit threat wording and strong combinations are high', () => {
  assert.equal(incidentRuleReview(incident({title:'Threat', category:'Threat', description:'User reported a threat.'})).level, 'Medium');
  assert.equal(analyzeMessage('I will hurt you').level, 'High');
  assert.equal(cautiousLevel(['intimateCoercion','blackmail']), 'High');
});
