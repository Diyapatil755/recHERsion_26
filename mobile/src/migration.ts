import type {AppState, Contact, Incident, AlertRecord, Journey} from './types';

export type WebMigration = {
  format: 'saheli-web-export-v1'; exportedAt?: string;
  contacts: Array<{id?: string; name: string; phone: string; types: string[]}>;
  alerts: Array<{kind: 'SOS alert'; time: number; status?: string}>;
  journey: null | {destination: string; arrival: number; interval: number; nextCheck: number};
  incidents: Array<{title: string; category: string; note: string; sender: string; risk: 'Low'|'Medium'|'High'; time: number}>;
  invalid: MigrationPreview;
};
export type MigrationCategory = 'contacts'|'alerts'|'journey'|'incidents';
export type MigrationPreview = Record<MigrationCategory, {valid: number; skipped: number}>;

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const time = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8.64e15;
const validTypes = new Set(['SOS', 'Journey', 'Digital']);
const validContact = (value: string) => /^\S+@\S+\.\S+$/.test(value) || /^[+\d][\d\s()-]{5,22}$/.test(value);

export function validateWebMigration(input: unknown): WebMigration {
  if (!record(input) || input.format !== 'saheli-web-export-v1') throw new Error('Unsupported Saheli migration format.');
  if (!Array.isArray(input.contacts) || !Array.isArray(input.alerts) || !Array.isArray(input.incidents)) {
    throw new Error('Migration is incomplete: contacts, alerts, and incidents must be arrays.');
  }
  const rawContactCount = input.contacts.length, rawAlertCount = input.alerts.length, rawIncidentCount = input.incidents.length;
  const contacts = input.contacts.filter((c): c is Record<string, unknown> => record(c) && text(c.name, 100) && text(c.phone, 254) && validContact((c.phone as string).trim()))
    .map((c) => ({id: typeof c.id === 'string' && c.id.length <= 100 ? c.id : undefined,
      name: (c.name as string).trim(), phone: (c.phone as string).trim(),
      types: Array.isArray(c.types) ? c.types.filter((x): x is string => typeof x === 'string' && validTypes.has(x)) : []}));
  const alerts = input.alerts.filter((a): a is Record<string, unknown> => record(a) && a.kind === 'SOS alert' && time(a.time))
    .map((a) => ({kind: 'SOS alert' as const, time: a.time as number, status: typeof a.status === 'string' ? a.status.slice(0, 40) : undefined}));
  const incidents = input.incidents.filter((i): i is Record<string, unknown> => record(i) && text(i.title, 200) && time(i.time))
    .map((i) => ({title: (i.title as string).trim(), category: text(i.category, 80) ? (i.category as string).trim() : 'Other',
      note: typeof i.note === 'string' ? i.note.slice(0, 10_000) : '', sender: typeof i.sender === 'string' ? i.sender.slice(0, 200) : '',
      risk: (['Low','Medium','High'].includes(String(i.risk)) ? i.risk : 'Low') as 'Low'|'Medium'|'High', time: i.time as number}));
  let journey: WebMigration['journey'] = null;
  if (input.journey !== null) {
    const rawJourney = input.journey;
    if (!record(rawJourney) || !text(rawJourney.destination, 200) || !time(rawJourney.arrival) ||
      !time(rawJourney.nextCheck) || typeof rawJourney.interval !== 'number' ||
      !Number.isInteger(rawJourney.interval) || rawJourney.interval < 1 || rawJourney.interval > 1440) {
      throw new Error('Migration journey data is malformed; nothing was imported.');
    }
    journey = {destination: (rawJourney.destination as string).trim(), arrival: rawJourney.arrival as number,
      interval: rawJourney.interval as number, nextCheck: rawJourney.nextCheck as number};
  }
  const invalid: MigrationPreview = {
    contacts: {valid: contacts.length, skipped: rawContactCount - contacts.length},
    alerts: {valid: alerts.length, skipped: rawAlertCount - alerts.length},
    journey: {valid: journey ? 1 : 0, skipped: 0},
    incidents: {valid: incidents.length, skipped: rawIncidentCount - incidents.length},
  };
  return {format: 'saheli-web-export-v1', exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : undefined,
    contacts, alerts, incidents, journey, invalid};
}

export function migrationPreview(data: WebMigration): MigrationPreview { return data.invalid; }

const norm = (value: string) => value.trim().toLowerCase();
export function applyMigration(data: WebMigration, old: AppState, selected: MigrationCategory[]): {state: AppState; counts: MigrationPreview} {
  const counts: MigrationPreview = {
    contacts: {valid: 0, skipped: 0}, alerts: {valid: 0, skipped: 0},
    journey: {valid: 0, skipped: 0}, incidents: {valid: 0, skipped: 0},
  };
  const next: AppState = {...old};
  if (selected.includes('contacts')) {
    const contacts: Contact[] = [...old.contacts];
    for (const c of data.contacts) {
      const duplicate = contacts.some((existing) => norm(existing.value) === norm(c.phone));
      if (duplicate) { counts.contacts.skipped++; continue; }
      const id = c.id && !contacts.some((existing) => existing.id === c.id) ? c.id : `web-contact-${contacts.length + 1}`;
      contacts.push({id, name: c.name, value: c.phone, method: c.phone.includes('@') ? 'email' : 'phone',
        preferences: c.types.length ? c.types : ['SOS'], verification: 'unverified'});
      counts.contacts.valid++;
    }
    next.contacts = contacts;
  }
  if (selected.includes('alerts')) {
    const alerts: AlertRecord[] = [...old.alerts];
    for (const a of data.alerts) {
      if (alerts.some((x) => x.kind === 'SOS' && x.time === a.time)) { counts.alerts.skipped++; continue; }
      alerts.unshift({id: `web-import-${a.time}`, kind: 'SOS', time: a.time, status: 'Queued',
        network: 'Imported local record; transport not verified', note: 'Imported from website export. No delivery claim.'});
      counts.alerts.valid++;
    }
    next.alerts = alerts;
  }
  if (selected.includes('journey') && data.journey) {
    if (old.journey || data.journey.arrival <= Date.now() || data.journey.nextCheck <= Date.now()) counts.journey.skipped = 1;
    else {
      const j: Journey = {id: `web-journey-${data.journey.nextCheck}`, destination: data.journey.destination,
        arrival: data.journey.arrival, interval: data.journey.interval, nextCheck: data.journey.nextCheck,
        grace: old.grace, stage: 'monitoring'};
      next.journey = j; counts.journey.valid = 1;
    }
  }
  if (selected.includes('incidents')) {
    const incidents: Incident[] = [...old.incidents];
    for (const i of data.incidents) {
      const duplicate = incidents.some((x) => x.time === i.time && norm(x.title) === norm(i.title));
      if (duplicate) { counts.incidents.skipped++; continue; }
      incidents.unshift({id: `web-incident-${i.time}-${incidents.length}`, title: i.title, category: i.category,
        description: i.note, sender: i.sender, risk: i.risk, time: i.time, files: []});
      counts.incidents.valid++;
    }
    next.incidents = incidents;
  }
  return {state: next, counts};
}
