import type {Journey} from './types';

export type JourneyTransition = {journey: Journey; kind: 'check-in-due' | 'grace-expired'} | null;

/** Pure, timestamp-based local journey state transition; it never contacts anyone. */
export function transitionJourney(journey: Journey | null, now: number): JourneyTransition {
  if (!journey || !Number.isFinite(now)) return null;
  if (journey.stage === 'monitoring' && now >= journey.nextCheck) {
    const graceUntil = journey.nextCheck + journey.grace * 60_000;
    return graceUntil > now
      ? {journey: {...journey, stage: 'grace', graceUntil}, kind: 'check-in-due'}
      : {journey: {...journey, stage: 'escalation_attempted'}, kind: 'grace-expired'};
  }
  if (journey.stage === 'grace' && journey.graceUntil !== undefined && now >= journey.graceUntil) {
    return {journey: {...journey, stage: 'escalation_attempted'}, kind: 'grace-expired'};
  }
  return null;
}
