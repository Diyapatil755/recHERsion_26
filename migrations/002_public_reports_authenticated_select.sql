-- Fix mobile/account-authenticated reads of the safe, moderator-verified report view.
-- Apply after 001_initial.sql, including on projects that already ran the original 001.
drop policy if exists "public verified reports read" on public.safety_reports;
create policy "public verified reports read" on public.safety_reports
  for select to anon, authenticated
  using (moderation_status='verified' and expires_at>now() and public_latitude is not null);
