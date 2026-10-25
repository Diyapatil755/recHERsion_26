import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState as RNAppState} from 'react-native';
import {randomId} from './id';
import {AppState, AlertRecord, initialState, Journey} from './types';
import {createLocalSOS} from './safety';
import {clearPrivateDatabase, deleteIncidentAndEvidence, loadState, saveState} from './db';
import {cancelJourneyNotifications, scheduleJourneyReminders} from './journey';
import {transitionJourney} from './journey-state';

type Ctx = {
  state: AppState; ready: boolean; error: string;
  clearLocal: () => Promise<void>; patch: (p: Partial<AppState>) => Promise<void>; deleteIncident: (id: string) => Promise<void>;
  checkIn: () => Promise<boolean>; finishJourney: () => Promise<void>;
  startJourney: (destination: string, arrival: number, interval: number) => Promise<boolean>;
  createSOS: (includeLocation: boolean, location?: {latitude: number; longitude: number; accuracy?: number}) => Promise<{id: string; created: boolean; record: AlertRecord}>;
  updateSOS: (id: string, status: 'Queued' | 'Attempted' | 'Sent' | 'Failed', note: string) => Promise<void>;
};
const Store = createContext<Ctx | null>(null);

type Mutation<T> = (current: AppState) => {next: AppState; result: T};

export function AppProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<AppState>(initialState);
  const hydrated = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const mutate = async <T,>(fn: Mutation<T>, persist: (next: AppState) => Promise<void> = saveState): Promise<T> => {
    const operation = queue.current.then(async () => {
      if (!hydrated.current) throw new Error('Local data could not be opened safely. No changes were saved; use explicit local-data deletion only if you intend to erase this device data.');
      const {next, result} = fn(current.current);
      if (next === current.current) return result;
      // Commit to the private DB before publishing state or reporting success to the caller.
      await persist(next);
      current.current = next;
      setState(next);
      setError('');
      return result;
    });
    const surfaced = operation.catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Could not save private local data.');
      throw cause;
    });
    queue.current = surfaced.then(() => undefined, () => undefined);
    return surfaced;
  };

  useEffect(() => {
    let active = true;
    loadState().then((loaded) => {
      if (!active) return;
      current.current = loaded;
      hydrated.current = true;
      setState(loaded);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Private local database unavailable.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const patch = (partial: Partial<AppState>) => mutate((old) => ({next: {...old, ...partial}, result: undefined}));
  const deleteIncident = (id: string) => mutate(
    (old) => old.incidents.some((incident) => incident.id === id)
      ? {next: {...old, incidents: old.incidents.filter((incident) => incident.id !== id)}, result: undefined}
      : {next: old, result: undefined},
    (next) => deleteIncidentAndEvidence(next, id)
  );

  const clearLocal = async () => {
    const operation = queue.current.then(async () => {
      await cancelJourneyNotifications().catch(() => undefined);
      await clearPrivateDatabase();
      current.current = initialState;
      hydrated.current = true;
      setState(initialState);
      setError('');
      setReady(true);
    });
    queue.current = operation.then(() => undefined, () => undefined);
    await operation;
  };

  const startJourney = async (destination: string, arrival: number, interval: number) => {
    const name = destination.trim();
    if (!name) throw new Error('Add a destination.');
    if (!Number.isFinite(arrival) || arrival <= Date.now()) throw new Error('Choose an arrival time in the future.');
    if (!Number.isFinite(interval) || interval < 1 || interval > 1440) throw new Error('Choose a valid check-in interval.');
    const journey = await mutate((old) => {
      const nextJourney: Journey = {
        id: randomId(), destination: name, arrival, interval, grace: old.grace,
        nextCheck: Date.now() + interval * 60_000, stage: 'monitoring',
      };
      return {next: {...old, journey: nextJourney}, result: nextJourney};
    });
    return scheduleJourneyReminders(journey);
  };

  const checkIn = async () => {
    const activeJourney = current.current.journey;
    if (!activeJourney) return false;
    await cancelJourneyNotifications();
    const journey = await mutate((old) => {
      if (!old.journey) return {next: old, result: null};
      const updated: Journey = {...old.journey, stage: 'monitoring', nextCheck: Date.now() + old.journey.interval * 60_000};
      delete updated.graceUntil;
      return {next: {...old, journey: updated}, result: updated};
    });
    return journey ? scheduleJourneyReminders(journey) : false;
  };

  const finishJourney = async () => {
    await cancelJourneyNotifications();
    await mutate((old) => ({next: old.journey ? {...old, journey: null} : old, result: undefined}));
  };

  const createSOS = (includeLocation: boolean, location?: {latitude: number; longitude: number; accuracy?: number}) =>
    mutate((old) => {
      const result = createLocalSOS(old.alerts, Date.now(), randomId, includeLocation, location);
      return {next: result.created ? {...old, alerts: result.alerts} : old, result: {id: result.id, created: result.created, record: result.record}};
    });

  const updateSOS = (id: string, status: 'Queued' | 'Attempted' | 'Sent' | 'Failed', note: string) =>
    mutate((old) => ({
      next: {...old, alerts: old.alerts.map((alert) => alert.id === id ? {...alert, status, note} : alert)},
      result: undefined,
    }));

  useEffect(() => {
    if (!ready || !state.journey) return;
    let running = false;
    const reconcile = async () => {
      if (running) return;
      running = true;
      try {
        const transition = await mutate((old) => {
          const result = transitionJourney(old.journey, Date.now());
          return result
            ? {next: {...old, journey: result.journey}, result: result.kind}
            : {next: old, result: null};
        });
        if (transition === 'check-in-due') {
          Alert.alert(
            'Check-in reminder',
            'Your check-in is due. This is a reminder, not evidence of an emergency.',
            [{text: 'I’m safe', onPress: () => void checkIn()}, {text: 'Later', style: 'cancel'}]
          );
        } else if (transition === 'grace-expired') {
          await cancelJourneyNotifications();
          Alert.alert('Grace period ended', 'Local escalation state recorded. No trusted contact has been alerted.');
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save journey state.');
      } finally { running = false; }
    };
    const subscription = RNAppState.addEventListener('change', (next) => { if (next === 'active') void reconcile(); });
    const timer = setInterval(() => { if (RNAppState.currentState === 'active') void reconcile(); }, 10_000);
    void reconcile();
    return () => { subscription.remove(); clearInterval(timer); };
  }, [ready, state.journey?.id, state.journey?.stage, state.journey?.nextCheck, state.journey?.graceUntil]);

  const value = useMemo(() => ({state, ready, error, clearLocal, patch, deleteIncident, checkIn, finishJourney, startJourney, createSOS, updateSOS}),
    [state, ready, error, deleteIncident]);
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useSaheli() {
  const context = useContext(Store);
  if (!context) throw new Error('AppProvider missing');
  return context;
}
