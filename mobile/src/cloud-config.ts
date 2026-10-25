import {toByteArray} from 'base64-js';

function jwtRole(key: string): string | null {
  try {
    const part = key.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!part) return null;
    const padded = part + '='.repeat((4 - part.length % 4) % 4);
    const json = Array.from(toByteArray(padded), (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
    const payload = JSON.parse(decodeURIComponent(json)) as {role?: unknown};
    return typeof payload.role === 'string' ? payload.role : null;
  } catch { return null; }
}

export function isPublicSupabaseKey(key: string): boolean {
  const value = key.trim();
  if (!value || /service[_-]?role|sb_secret_/i.test(value)) return false;
  if (value.startsWith('sb_publishable_')) return value.length >= 24;
  return jwtRole(value) === 'anon';
}

export function validateSupabaseConfig(url: string, key: string, rlsVerified: boolean): {ready: boolean; message: string} {
  if (!url.trim() || !key.trim()) return {ready: false, message: 'Supabase credentials are missing. Configure a project URL and publishable/anon key to continue.'};
  let parsed: URL;
  try { parsed = new URL(url); } catch { return {ready: false, message: 'Supabase URL is invalid. Cloud functions remain disabled.'}; }
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if ((!local && parsed.protocol !== 'https:') || (local && !['http:', 'https:'].includes(parsed.protocol)) ||
      parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname) {
    return {ready: false, message: 'Supabase URL must be a valid HTTPS project URL. Cloud functions remain disabled.'};
  }
  if (!isPublicSupabaseKey(key)) return {ready: false, message: 'The Supabase key is not recognized as a publishable/anon client key. Service-role or secret keys are rejected.'};
  if (!rlsVerified) return {ready: false, message: 'Cloud access is locked. Apply the schema and complete two-account RLS checks before setting EXPO_PUBLIC_SUPABASE_RLS_VERIFIED=true.'};
  return {ready: true, message: 'Supabase enabled by deployment configuration; RLS still requires independent project verification.'};
}
