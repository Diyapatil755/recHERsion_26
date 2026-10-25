import type {AlertRecord} from './types';

/** Prevent repeated taps from creating duplicate real SOS records; simulated events never qualify. */
export function recentSOSId(alerts: readonly AlertRecord[], now: number, windowMs = 10_000): string | null {
  const match = alerts.find((alert) => alert.kind === 'SOS' && !alert.demo && now >= alert.time && now - alert.time < windowMs);
  return match?.id ?? null;
}

export function createLocalSOS(
  alerts: readonly AlertRecord[], now: number, createId: () => string,
  includeLocation: boolean, location?: {latitude: number; longitude: number; accuracy?: number},
): {id: string; record: AlertRecord; alerts: AlertRecord[]; created: boolean} {
  const duplicate = recentSOSId(alerts, now);
  if (duplicate) return {id: duplicate, record: alerts.find((alert) => alert.id === duplicate)!, alerts: [...alerts], created: false};
  const validLocation = location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) &&
    location.latitude >= -90 && location.latitude <= 90 && location.longitude >= -180 && location.longitude <= 180;
  const record: AlertRecord = {
    id: createId(), kind: 'SOS', time: now, status: 'Queued',
    network: 'Native app · transport not confirmed',
    note: includeLocation ? (validLocation ? 'One-time location included with your consent.' : 'Location permission unavailable; no location included.') : 'No location included',
    ...(includeLocation && validLocation ? {location} : {}),
  };
  return {id: record.id, record, alerts: [record, ...alerts], created: true};
}

/** Demo reset is deliberately scoped to simulated events, never real SOS records. */
export function removeSimulatedAlerts(alerts: readonly AlertRecord[]): AlertRecord[] {
  return alerts.filter((alert) => alert.kind !== 'SIMULATED' && !alert.demo);
}
