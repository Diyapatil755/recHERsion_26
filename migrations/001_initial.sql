-- Saheli Phase 3 schema. Apply via Supabase SQL Editor or `supabase db push`.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  preferred_language text not null default 'en' check (preferred_language in ('en','hi','mr')),
  role text not null default 'user' check (role in ('user','moderator')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.trusted_contacts (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 1 and 100),
  contact_method text not null check (contact_method in ('phone','email','other')),
  contact_value text not null check (char_length(contact_value) between 1 and 254),
  alert_preferences jsonb not null default '{"SOS":true}'::jsonb,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified')),
  local_source_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_user_id,local_source_id)
);
create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'physical_sos', created_at timestamptz not null default now(),
  event_status text not null default 'queued' check(event_status in ('queued','failed','cancelled','recorded')),
  delivery_channel text, latitude double precision, longitude double precision, location_consent boolean not null default false,
  demo_mode boolean not null default false, local_source_id text,
  check ((latitude is null and longitude is null) or (location_consent and latitude between -90 and 90 and longitude between -180 and 180)),
  unique(owner_user_id,local_source_id)
);
create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  destination_label text not null check(char_length(destination_label) <= 200), start_time timestamptz not null default now(),
  expected_arrival_time timestamptz, end_time timestamptz,
  journey_status text not null default 'active' check(journey_status in ('active','completed','cancelled')),
  check_in_interval_minutes integer not null default 30 check(check_in_interval_minutes between 1 and 1440),
  grace_period_minutes integer not null default 2 check(grace_period_minutes between 1 and 60),
  location_sharing_preference jsonb not null default '{"enabled":false}'::jsonb, local_source_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,local_source_id)
);
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(), journey_id uuid not null references public.journeys(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade, check_in_time timestamptz not null default now(),
  check_in_status text not null default 'safe' check(check_in_status in ('safe','missed','cancelled')),
  escalation_status text not null default 'none' check(escalation_status in ('none','simulated','queued','failed')),
  local_source_id text, unique(owner_user_id,local_source_id)
);
create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(), reporter_user_id uuid references auth.users(id) on delete set null,
  category text not null check(category in ('Lighting','Harassment','Transport','Other concern')), severity text not null check(severity in ('low','moderate','high')),
  description text not null default '' check(char_length(description) <= 1000),
  latitude double precision, longitude double precision, public_latitude double precision, public_longitude double precision,
  moderation_status text not null default 'pending_review' check(moderation_status in ('pending_review','unverified','verified','rejected','expired')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now() + interval '90 days'),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  check ((public_latitude is null and public_longitude is null) or (public_latitude between -90 and 90 and public_longitude between -180 and 180))
);
create table if not exists public.safety_report_flags (
  id uuid primary key default gen_random_uuid(), report_id uuid not null references public.safety_reports(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade, reason text not null check(char_length(reason) between 5 and 500),
  created_at timestamptz not null default now(), unique(report_id,reporter_user_id)
);
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check(char_length(category) <= 80), title text not null check(char_length(title) between 1 and 200),
  description text not null default '' check(char_length(description) <= 10000), incident_date timestamptz not null default now(),
  sender_or_platform text check(char_length(sender_or_platform) <= 200), organizational_risk_label text not null default 'Low' check(organizational_risk_label in ('Low','Medium','High')),
  local_source_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,local_source_id)
);
create table if not exists public.reporting_records (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references auth.users(id) on delete cascade,
  selected_incident_ids uuid[] not null default '{}', reporting_destination text not null check(char_length(reporting_destination) <= 200),
  tracking_status text not null default 'not_started' check(tracking_status in ('not_started','draft_prepared','user_reports_submitted','follow_up')),
  local_source_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_user_id,local_source_id)
);

create index if not exists safety_reports_public_idx on public.safety_reports(moderation_status, expires_at, created_at desc);
create index if not exists safety_reports_public_coords_idx on public.safety_reports(public_latitude, public_longitude) where public_latitude is not null;
create index if not exists incidents_owner_date_idx on public.incidents(owner_user_id, incident_date desc);
create index if not exists journeys_owner_status_idx on public.journeys(owner_user_id, journey_status);
create index if not exists check_ins_journey_date_idx on public.check_ins(journey_id, check_in_time desc);

-- Role claims are assigned only by trusted server-side Supabase Auth administration.
create or replace function public.is_saheli_moderator() returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((auth.jwt() -> 'app_metadata' ->> 'saheli_role') = 'moderator', false);
$$;

-- Verification cannot be self-asserted by a contact owner.
create or replace function public.saheli_contact_verification_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if not public.is_saheli_moderator() then new.verification_status:='unverified'; end if;
 return new;
end $$;
create trigger trusted_contact_verification_guard before insert or update on public.trusted_contacts for each row execute function public.saheli_contact_verification_guard();

alter table public.profiles enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.sos_events enable row level security;
alter table public.journeys enable row level security;
alter table public.check_ins enable row level security;
alter table public.safety_reports enable row level security;
alter table public.safety_report_flags enable row level security;
alter table public.incidents enable row level security;
alter table public.reporting_records enable row level security;

-- Explicit grants complement RLS; policies are not a substitute for SQL privileges.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.trusted_contacts, public.sos_events, public.journeys, public.check_ins, public.incidents, public.reporting_records to authenticated;
grant insert, delete, update on public.safety_reports to authenticated;
grant insert, select on public.safety_report_flags to authenticated;

create policy "profile own read" on public.profiles for select to authenticated using(id=auth.uid());
create policy "profile own insert" on public.profiles for insert to authenticated with check(id=auth.uid() and role='user');
create policy "profile own update" on public.profiles for update to authenticated using(id=auth.uid() and role='user') with check(id=auth.uid() and role='user');
create policy "contacts owner all" on public.trusted_contacts for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy "sos owner all" on public.sos_events for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy "journey owner all" on public.journeys for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy "checkins owner all" on public.check_ins for all to authenticated using(owner_user_id=auth.uid() and exists(select 1 from public.journeys j where j.id=journey_id and j.owner_user_id=auth.uid())) with check(owner_user_id=auth.uid() and exists(select 1 from public.journeys j where j.id=journey_id and j.owner_user_id=auth.uid()));
create policy "incidents owner all" on public.incidents for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());
create policy "reports owner read" on public.safety_reports for select to authenticated using(reporter_user_id=auth.uid() or (moderation_status='verified' and expires_at>now()));
create policy "reports authenticated submit" on public.safety_reports for insert to authenticated with check(reporter_user_id=auth.uid() and moderation_status='pending_review');
create policy "reports owner delete pending" on public.safety_reports for delete to authenticated using(reporter_user_id=auth.uid() and moderation_status='pending_review');
create policy "reports moderator update" on public.safety_reports for update to authenticated using(public.is_saheli_moderator()) with check(public.is_saheli_moderator());
create policy "flags owner insert" on public.safety_report_flags for insert to authenticated with check(reporter_user_id=auth.uid());
create policy "flags own read" on public.safety_report_flags for select to authenticated using(reporter_user_id=auth.uid() or public.is_saheli_moderator());
create policy "reporting records owner" on public.reporting_records for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid());

-- Authenticated submissions are rate-limited and forced into moderation; public coordinates are approximate.
create or replace function public.saheli_guard_safety_report() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare n integer;
begin
 if tg_op='INSERT' then
   perform pg_advisory_xact_lock(hashtext(coalesce(auth.uid()::text,'anon')));
   select count(*) into n from public.safety_reports where reporter_user_id=auth.uid() and created_at>now()-interval '1 hour';
   if n>=5 then raise exception 'report submission limit reached; try again later'; end if;
   new.reporter_user_id:=auth.uid(); new.moderation_status:='pending_review';
   if new.public_latitude is not null then new.public_latitude:=round(new.public_latitude::numeric,3)::double precision; end if;
   if new.public_longitude is not null then new.public_longitude:=round(new.public_longitude::numeric,3)::double precision; end if;
   new.latitude:=null; new.longitude:=null; new.expires_at:=least(coalesce(new.expires_at,now()+interval '90 days'),now()+interval '90 days');
 end if;
 return new;
end $$;
create trigger safety_report_guard before insert on public.safety_reports for each row execute function public.saheli_guard_safety_report();

-- Authenticated users may read only public-safe fields and only moderated verified, unexpired entries.
create or replace view public.public_safety_reports with (security_invoker=true) as
 select id, category, severity, description, public_latitude as latitude, public_longitude as longitude,
        moderation_status, created_at, expires_at
 from public.safety_reports where moderation_status='verified' and expires_at>now() and public_latitude is not null;
grant select on public.public_safety_reports to anon, authenticated;
-- Restrict raw table column access too: public clients cannot select reporter identity or precise coordinates.
revoke select on public.safety_reports from anon, authenticated;
grant select (id, category, severity, description, public_latitude, public_longitude, moderation_status, created_at, expires_at) on public.safety_reports to anon, authenticated;
-- Public view security: underlying table RLS must allow select to anon for verified rows.
create policy "public verified reports read" on public.safety_reports for select to anon, authenticated using(moderation_status='verified' and expires_at>now() and public_latitude is not null);

-- Moderation and precise coordinates are deliberately unavailable through public view.
revoke all on public.safety_report_flags from anon;
