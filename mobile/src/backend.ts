import 'react-native-url-polyfill/auto';
import {createClient, type Session, type SupabaseClient} from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import {validateSupabaseConfig} from './cloud-config';

const extra = Constants.expoConfig?.extra || {};
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';
const rlsVerified = process.env.EXPO_PUBLIC_SUPABASE_RLS_VERIFIED === 'true';
const initialConfig = validateSupabaseConfig(SUPABASE_URL, SUPABASE_KEY, rlsVerified);
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
let constructedClient: SupabaseClient<any> | null = null;
let runtimeConfigMessage = initialConfig.message;
if (initialConfig.ready) {
  try {
    constructedClient = createClient<any>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false},
    });
  } catch {
    runtimeConfigMessage = 'Supabase client configuration failed. Cloud features remain disabled; check non-secret project settings.';
  }
}
export const supabase = constructedClient;
export const supabaseReady = Boolean(constructedClient);
export const supabaseStatus = runtimeConfigMessage;

function auth() {
  if (!supabaseReady || !supabase) throw new Error(supabaseStatus);
  return supabase;
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const {data, error} = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const client = auth();
  const {data, error} = await client.auth.signInWithPassword({email, password});
  if (error) throw error;
  const {error: profileError} = await client.from('profiles').upsert(
    {id: data.user.id, preferred_language: 'en'}, {onConflict: 'id', ignoreDuplicates: true}
  );
  if (profileError) throw new Error(`Signed in, but profile setup was not confirmed: ${profileError.message}`);
  return data.session;
}

export async function signUp(email: string, password: string, displayName: string) {
  const client = auth();
  const {data, error} = await client.auth.signUp({email, password, options: {data: {display_name: displayName}}});
  if (error) throw error;
  if (data.session && data.user) {
    const {error: profileError} = await client.from('profiles').upsert(
      {id: data.user.id, display_name: displayName, preferred_language: 'en'}, {onConflict: 'id'}
    );
    if (profileError) throw new Error(`Account created, but profile setup was not confirmed: ${profileError.message}`);
  }
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const {error} = await supabase.auth.signOut();
  if (error) throw error;
}

export const records = {
  contacts: {
    list: async () => {const {data, error} = await auth().from('trusted_contacts').select('*').order('created_at', {ascending: false}); if (error) throw error; return data;},
    upsert: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('trusted_contacts').upsert(row, {onConflict: 'owner_user_id,local_source_id'}).select(); if (error) throw error; return data;},
    remove: async (id: string) => {const {error} = await auth().from('trusted_contacts').delete().eq('id', id); if (error) throw error;},
  },
  sos: {
    list: async () => {const {data, error} = await auth().from('sos_events').select('*').order('created_at', {ascending: false}); if (error) throw error; return data;},
    record: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('sos_events').upsert(row, {onConflict: 'owner_user_id,local_source_id', ignoreDuplicates: true}).select('id,created_at,event_status'); if (error) throw error; return data;},
  },
  journeys: {
    list: async () => {const {data, error} = await auth().from('journeys').select('*').order('created_at', {ascending: false}); if (error) throw error; return data;},
    upsert: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('journeys').upsert(row, {onConflict: 'owner_user_id,local_source_id'}).select(); if (error) throw error; return data;},
  },
  checkIns: {
    list: async () => {const {data, error} = await auth().from('check_ins').select('*').order('check_in_time', {ascending: false}); if (error) throw error; return data;},
    create: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('check_ins').insert(row).select(); if (error) throw error; return data;},
  },
  incidents: {
    list: async () => {const {data, error} = await auth().from('incidents').select('*').order('incident_date', {ascending: false}); if (error) throw error; return data;},
    upsert: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('incidents').upsert(row, {onConflict: 'owner_user_id,local_source_id'}).select(); if (error) throw error; return data;},
  },
  reports: {
    publicList: async () => {const {data, error} = await auth().from('public_safety_reports').select('*').order('created_at', {ascending: false}); if (error) throw error; return data;},
    ownList: async () => {const {data, error} = await auth().from('safety_reports').select('id,category,severity,description,public_latitude,public_longitude,moderation_status,created_at,expires_at').order('created_at', {ascending: false}); if (error) throw error; return data;},
    submit: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('safety_reports').insert(row).select('id,category,severity,public_latitude,public_longitude,moderation_status,created_at,expires_at'); if (error) throw error; return data;},
    flag: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('safety_report_flags').insert(row).select(); if (error) throw error; return data;},
  },
  reporting: {
    list: async () => {const {data, error} = await auth().from('reporting_records').select('*').order('created_at', {ascending: false}); if (error) throw error; return data;},
    upsert: async (row: Record<string, unknown>) => {const {data, error} = await auth().from('reporting_records').upsert(row, {onConflict: 'owner_user_id,local_source_id'}).select(); if (error) throw error; return data;},
  },
};

export function getUserId(session: Session | null) {return session?.user.id || null;}
