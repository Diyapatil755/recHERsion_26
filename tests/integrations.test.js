import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const moduleCode=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../migrations/001_initial.sql',import.meta.url),'utf8');
const sqlPatch=readFileSync(new URL('../migrations/002_public_reports_authenticated_select.sql',import.meta.url),'utf8');

test('classic app source parses and preserves primary safety controls',()=>{
 const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline,'classic UI script exists');
 assert.doesNotThrow(()=>new vm.Script(inline));
 for(const phrase of ['triggerSOS','startJourneyTimer','function runScenario','function evidencePage','function showAdvice','function reportPage']) assert.ok(inline.includes(phrase),`missing retained flow ${phrase}`);
 assert.match(html,/src="\/src\/main\.js"/);
});

test('optional integrations fail closed and never include a privileged key',()=>{
 assert.match(moduleCode,/VITE_GOOGLE_MAPS_API_KEY/);
 assert.match(moduleCode,/VITE_SUPABASE_URL/);
 assert.match(moduleCode,/VITE_SUPABASE_ANON_KEY/);
 assert.doesNotMatch(moduleCode,/SERVICE_ROLE|service_role/i);
 assert.match(moduleCode,/Google Maps is not configured/);
 assert.match(moduleCode,/not confirmed/);
});

test('RLS and public report view protect private records',()=>{
 for(const table of ['profiles','trusted_contacts','sos_events','journeys','check_ins','safety_reports','safety_report_flags','incidents','reporting_records']){
  assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security`),`${table} RLS enabled`);
 }
 assert.match(sql,/owner_user_id=auth\.uid\(\)/);
 assert.match(sql,/public_safety_reports with \(security_invoker=true\)/);
 assert.match(sql,/reporter_user_id.*?public_latitude as latitude/s);
 assert.match(sql,/pending_review/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/new\.latitude:=null; new\.longitude:=null/);
 assert.match(sql,/public verified reports read[^;]*to anon, authenticated/);
 assert.match(sqlPatch,/drop policy if exists "public verified reports read"/i);
 assert.match(sqlPatch,/for select to anon, authenticated/i);
});

test('configuration template contains placeholders only',()=>{
 const env=readFileSync(new URL('../.env.example',import.meta.url),'utf8');
 assert.match(env,/VITE_GOOGLE_MAPS_API_KEY=/);
 assert.match(env,/VITE_SUPABASE_URL=/);
 assert.match(env,/VITE_SUPABASE_ANON_KEY=/);
 assert.doesNotMatch(env,/AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}/);
});
