import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicSupabaseKey, validateSupabaseConfig} from './cloud-config';
const anon = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.sig`;
const service = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.sig`;
test('Supabase access is closed unless URL, public client key, and explicit RLS deployment assertion pass', () => {
  assert.equal(isPublicSupabaseKey(anon), true);
  assert.equal(isPublicSupabaseKey(service), false);
  assert.equal(validateSupabaseConfig('https://example.supabase.co', anon, false).ready, false);
  assert.equal(validateSupabaseConfig('https://example.supabase.co', anon, true).ready, true);
  assert.equal(validateSupabaseConfig('http://example.supabase.co', anon, true).ready, false);
  assert.equal(validateSupabaseConfig('https://example.supabase.co', 'sb_secret_fake', true).ready, false);
  assert.equal(validateSupabaseConfig('', '', true).ready, false);
});
