# Saheli — Safety, on your terms

Saheli is a local-first safety web app with an optional Google Maps Platform map and optional authenticated Supabase synchronization. The core app remains available signed out/offline, and emergency actions are never represented as delivered just because a database row exists.

## Current integration status

| Area | Status | Requirements / limits |
|---|---|---|
| Google Maps JavaScript API | **Implemented, configuration required** | Real map is loaded only when `VITE_GOOGLE_MAPS_API_KEY` is set. Without it, the map gives a clear error and never substitutes the old illustrative markers. |
| User-controlled geolocation | **Implemented, permission required** | One-shot browser location is requested only from the location button. Manual map click/coordinate selection remains available. No background tracking. |
| Google Maps directions | **Implemented, configuration required** | Uses Maps JavaScript DirectionsService walking routes when configured, or links to external Google Maps directions. Normal directions only; no safety score. |
| Community report persistence | **Implemented, Supabase setup required** | Authenticated submission, consent, approximate coordinate rounding, moderation status, 5/hour database limit, public view only for moderator-verified reports. No anonymous report submission. |
| Supabase Auth | **Implemented, configuration required** | Email/password sign-up/sign-in/sign-out and persistent SDK session. Confirmation behavior depends on Supabase Auth settings. |
| Private database sync | **Implemented, explicit import only** | User selects local contacts, real SOS event records, active journey, incident text, and/or report-tracker status. No auto-upload. Evidence files, local community reports, simulated records, or location history are excluded. Idempotency uses per-user local-source IDs. |
| Database security | **Migration implemented; must apply/test in configured project** | RLS enabled for user tables; verified report public view excludes reporter identity and exact coordinates. We have not applied the migration to a live project because credentials are not provided. |
| SMS, delivery receipts, remote location sharing | **Not implemented** | Supabase stores records; it does not send messages, call emergency services, or share a live location. |
| Evidence encryption/PDF | **Not implemented** | Evidence remains local in IndexedDB and is not end-to-end encrypted. |

## Run locally

Node.js 20+ recommended.

```bash
npm install
cp .env.example .env.local
# Fill in only the browser-safe values described below; leave blank to run local-only.
npm run dev
```

Open the Vite URL shown in the terminal. Production bundle: `npm run build`; preview it with `npm run preview`. No service-role key belongs in `.env.local` or browser code. `.env*`, `node_modules/`, and `dist/` are ignored by Git.

## Google Maps setup

1. Create/select a Google Cloud project at https://console.cloud.google.com/ and enable billing.
2. Enable **Maps JavaScript API**. Enable **Directions API** (legacy) if required for the selected DirectionsService project configuration.
3. Create a browser API key. Apply **Website (HTTP referrer)** restrictions and allow only the exact production origin(s) and local development origin(s), for example `http://localhost:5173/*`; for a deployed app add its HTTPS host. Never use an unrestricted key.
4. Add `VITE_GOOGLE_MAPS_API_KEY=...` in `.env.local`, restart Vite, and test the map. Vite embeds this browser key into client output by design; it is not a secret. Restrict it by referrer and API, monitor quotas, and rotate if exposed outside those restrictions.
5. Google Maps usage may incur billing charges under Google's current pricing/quotas. Set Cloud billing budgets/alerts and review the applicable Maps Platform terms before public deployment. This project does not proxy requests or provide spend protection.

Map fallback is deliberately **not a fake map**: absent/invalid key shows a configuration/API error. A user can still use manual coordinates for a report and open external Google Maps directions. The default map center is a non-personal Nashik-area viewport. Location is requested only after an explicit button click; users can deny it.

## Supabase setup

1. Create a Supabase project. In **Project Settings → API**, copy the Project URL and publishable key (or legacy anon key). These are browser client values protected by RLS—not service credentials.
2. Set in `.env.local`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

3. Apply `migrations/001_initial.sql` once and then `migrations/002_public_reports_authenticated_select.sql` using Supabase SQL Editor, or configure the Supabase CLI. Review each file first. Migration 002 replaces the public-report SELECT policy so both anon and authenticated roles can read only moderator-verified, unexpired public-safe rows. The schema includes profiles, trusted contacts, SOS event records, journeys, check-ins, safety reports, report flags, incidents, and report-tracking records.
4. Configure Supabase Auth email confirmation, redirect/allowed URLs and password policy for the deployed origin. Current UI uses email/password. If email confirmation is enabled, confirm the email before sign-in. The app attempts to create the user's profile after a valid session.
5. Moderator verification requires trusted operations to assign `saheli_role: moderator` in the user's Supabase **app_metadata** from a privileged server/admin process. Never expose the service-role key. There is no moderation-admin UI in this prototype; without an authorized moderator, user reports remain pending and are not shown publicly.
6. Add the deployed Vite origin to Supabase Auth's allowed redirect/site URLs. Test policies using at least two distinct test accounts and the anon role before deployment.

### RLS design

RLS is enabled for all private/user-specific tables. User table policies use `auth.uid()` ownership; check-ins additionally require ownership of their journey. Contact verification status is forced to `unverified` unless the trusted moderator claim is present. Safety report submissions require an authenticated owner, are forced into `pending_review`, and are rate-limited to five per user per hour by a database trigger. Public map reads use `public_safety_reports`, restricted to verified, unexpired reports with public approximate coordinates. The view omits reporter IDs and precise coordinate columns; base-table column grants are restricted too. User-generated descriptions are shown publicly only after moderation—reporters are cautioned not to identify people.

**Important:** SQL is supplied but has not been applied against a real project or penetration-tested here. Supabase is access-controlled cloud storage, **not end-to-end encryption**. DB rows never prove SOS delivery.

## Local data and migration behavior

- **Device only:** browser `localStorage` contacts, SOS records, active journey, incident text and app settings; evidence files in IndexedDB with SHA-256 fingerprints. Browser storage is not encrypted.
- **Account synchronized:** nothing until signed in and the user selects import categories and confirms the explicit consent checkbox. Contact details and incident descriptions are sensitive and the UI explains they will be uploaded to the account. SOS records are records only, not delivery proof. Active journey imports destination/timing only, with no location history.
- **Intentionally shared community reports:** authenticated user must select/currently enter a point, choose category/severity, optionally describe, review a confirmation, and consent. The exact lat/lng fields are not stored. The DB rounds the public point to 3 decimal degrees (roughly 100 m, longitude distance varies), forces pending moderation, and only moderator-verified entries are available from the public map view. Reporter ID remains private.
- **Never synchronized:** evidence files/attachments, demo events, private location histories, and local sample reports. Local records remain until the user deletes them; import does not erase local copies.

## Features retained from P0

- Local SOS record, duplicate suppression, connectivity status and 112 shortcut; real SMS/notification transport is not configured.
- Trusted-contact CRUD/preferences (local) and unverified labels.
- Journey timers/check-in/grace and simulated escalation; browser foreground timers may pause/suspend in background.
- Evidence notes and IndexedDB selected files/hash; no encryption/password-protected PDF.
- Offline guidance English/Hindi/Marathi, digital incident flows, editable reporting draft, local report tracker.
- Repeatable DEMO scenarios separate from real SOS records.
- Safety map and routes described above when configured.

## Testing

```bash
npm test
npm run build
node --check /tmp/saheli-check.js # optional after extracting inline script; see below
```

`npm test` contains static/schema assertions and validates core UI script syntax. `npm run build` verifies Vite production bundling. To separately check the inline UI script: `python3 -c "import re,pathlib; s=pathlib.Path('index.html').read_text(); pathlib.Path('/tmp/saheli-check.js').write_text(re.search(r'<script>(.*?)</script>',s,re.S).group(1))" && node --check /tmp/saheli-check.js`. Existing workflow runtime smoke tests were also run in a lightweight DOM stub for route rendering, SOS duplicate prevention/demo separation, journey reminder→grace→check-in cancel→escalation→end, and language changes. Browser automation against actual Google/Supabase services cannot be run until keys/project are configured. RLS has not been executed against a live Supabase instance; see two-account manual test procedure below.

Manual configured integration check: verify valid/restricted and missing/invalid Google key; map at mobile/desktop; deny geolocation; set a manual point; create report and ensure it remains pending/private; verify approved public report marker; route success/failure; create two Supabase users and verify each cannot query/mutate the other's contacts/incidents/journeys; query public view and confirm reporter IDs and exact coordinates are unavailable; disconnect network and confirm local SOS/guidance still work.

## Still requires credentials, providers, or native work

- Google Cloud project, API enablement, billing, restricted Maps key, and allowed website origins.
- Supabase project URL/publishable key, applied migration, Auth settings, tested RLS, and an operator/moderation process with trusted moderator app_metadata assignment.
- No provider/backend for actual SMS/notifications, acknowledgements/delivery receipts, contact verification, remote location sharing or timed escalation.
- Native Android/iOS work and OS permissions are needed for reliable background reminders, SMS intents, device permissions scanning, and durable location-sharing controls.
- No service-role keys, server functions, evidence-file cloud storage, end-to-end encryption, Google Places search/autocomplete, crime feed, safe-route score, or community authentication beyond Supabase Auth.
