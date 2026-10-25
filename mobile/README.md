# Saheli Android (native Expo app)

`mobile/` is the native continuation of Saheli. The original website remains at the repository root and its export workflow is unchanged. This app uses Expo SDK 57, React Native 0.86, TypeScript, and Expo Router; it is not a WebView.

## P1 digital safety additions

The Digital Safety screen includes a local, transparent keyword checker for selected message text and a rule-based review of existing incident notes. The text analyzer does not persist or transmit pasted text; results are session-only and use cautious Low/Medium/High labels with matched cues shown. These are simple language-specific patterns—not validated predictions, a safety assessment, or a substitute for trusted support. Rules can miss context, slang, and variations. Timeline labels are computed separately from saved user labels and do not edit incident records. The aftercare checklist is session-only. Support cards link to the Maharashtra WCD helpline listing (181 women, 1098 child) and the National Cyber Crime Reporting Portal; Saheli does not place calls, submit reports, or contact anyone.

## P2 privacy and device-safety checkups

Profile links to a secondary native Expo Router screen, preserving the five primary tabs. Privacy-footprint, account-security and stalkerware/tracker checklists save completion booleans in the existing local app-state database; checks are reminders, not technical verification. Existing stored-state fields default safely for prior installs. The privacy check accepts a selected JPEG up to 20 MB, parses JPEG APP1/TIFF EXIF GPS IFD tags locally, and reports GPS tags present/not found, unsupported file, or malformed input. It does not display coordinates, parse every metadata format, or save the photo or result. A reliable metadata-removal/export codec is not installed, so removal/export is intentionally unavailable; the original is unchanged. The image picker’s temporary cache copy is deleted when its URI is inside the app cache.

The volunteer feature is a local, manually managed list—not a live network. Entries are labelled unverified or demo/test; the app cannot verify a volunteer. Real-person entry requires the user's attestation of explicit opt-in; consent can be revoked and entries deleted. The request preview includes only selected volunteer names, the user's brief text and optional callback detail; it excludes location and volunteer contact values. A second confirmation precedes the system share sheet. Saheli cannot confirm delivery, receipt, or acceptance. No cross-device discovery or verification backend exists.

Panic voice keyword remains **deferred**: the installed app has no speech-recognition capability, and there is no microphone permission or listening service. No voice-trigger control is offered. The stalkerware/tracker feature is a guided checklist and opens Android Settings intents where available; it does not inspect installed packages or permissions. It is not a spyware/tracker detector. Android intent availability, setting names, Unknown tracker alerts and device navigation vary by manufacturer/version. The P2 screen's instructional copy is currently English; the existing P1 safety guidance remains available in English, Hindi and Marathi.

## Status labels and current implementation

| Area | Status | Verified behavior / limitation |
|---|---|---|
| Five primary tabs | **Implemented; automated route check; Android device unverified** | Home, Safety, Digital Safety, Evidence, Profile. Journey and Simulator are secondary stack routes. |
| Local SOS and 112 | **Implemented; automated logic tests; device unverified** | SOS records require a working local database. A rapid repeat within 10 seconds reuses the existing record instead of creating/re-sending. SMS opens the OS composer only after the user chooses it. Composer status is only an attempt; no delivery/acknowledgement is asserted. `tel:112` opens the device dialer flow; it does not silently call. |
| Journey | **Implemented; pure transition tests; OS timing unverified** | State persists locally. One-time scheduled notifications use Android's notification scheduler when permitted. No dependable background monitor, reboot/force-stop guarantee, or automatic contact escalation. Permission denial preserves the journey and reports that notification scheduling was unavailable. |
| Digital safety | **Implemented; partial automated coverage** | Bundled English/Hindi/Marathi guidance and simple local keyword hints; hints are not a risk prediction. Report drafts are user-reviewed and exported only after selecting the share action. |
| Evidence | **Implemented; hash/file-rule tests; Android picker/SQLite persistence unverified** | Selected PDF, text, DOCX, and common image files (up to 20 MB) are copied into app-controlled storage; SHA-256 is an integrity fingerprint, not proof of authenticity. Sharing rechecks hash/size. There is no auto-upload or password-protected PDF. |
| Website migration | **Implemented; validation/deduplication tests; file-picker UX unverified** | Only a user-selected JSON with `saheli-web-export-v1` format is accepted. Preview lists category counts and a sample; malformed entries are counted/skipped, duplicate records are skipped, active local journeys are not replaced. Evidence and location history are excluded. It never reads browser localStorage/IndexedDB. |
| Google Maps/location | **Implemented; config path inspected; tile/device behavior blocked** | Location is requested only after a location action. With no key, the screen says the map is unavailable and still supports manual coordinates, one-time location, private local reports, and external Google Maps directions. With a nonempty but invalid key, native tiles may fail; manual/current-location fallback remains visible. No safe-route guarantee. |
| Supabase | **Code present; disabled by default; live project/RLS testing blocked** | Requires valid HTTPS URL, a publishable key or legacy anon JWT, and explicit `EXPO_PUBLIC_SUPABASE_RLS_VERIFIED=true`. Service-role/secret keys are rejected. The flag is an operator assertion, not a technical RLS attestation. Local SOS/evidence still work when cloud is disabled. |
| SQLite/SQLCipher/key | **Configured; native encryption unverified** | Expo config enables `useSQLCipher`; the app stores a random key in SecureStore, applies it before schema access, checks `PRAGMA cipher_version`, and fails closed if SQLCipher is not reported. Android APK/native library, database header, Keystore persistence, backup behavior, and recovery have not been tested. The UI does not claim encryption is verified. |
| Data deletion | **Implemented; database path unverified on Android** | Confirmed deletion clears app database, records, evidence BLOBs, and the database key. It does not delete Supabase records or the Supabase sign-in session. Copies exported/shared to other apps or storage are outside Saheli's deletion control. |
| Root website | **Preserved; tests and production build passed** | `npm test` passed (4/4); `npm run build` passed after a clean root install. The supplied SQL policy fix is covered by the root static integration test. |

## Prerequisites

- Node.js **22.13 or later** (SDK 57 toolchain) and npm.
- Android Studio with Android SDK Platform **36**, platform tools (ADB), and an Android emulator or physical device.
- JDK **17** recommended for this React Native/Expo generation. The audit environment had JDK 11, no `ANDROID_HOME`/`ANDROID_SDK_ROOT`, no `adb`, and no `android/` generated project.

## Clean install, checks, and development

From this directory:

```sh
npm ci
npm run typecheck
npm test
npx expo-doctor
npx expo config --type public
npm start
```

The checked-in `package-lock.json` supports reproducible `npm ci`. For a local Android build/install (once Android Studio, SDK 36, ADB and JDK 17 are installed/configured):

```sh
# Start an emulator from Android Studio, or connect a phone with USB debugging enabled.
npx expo run:android
```

Expo generates the native `android/` project from `app.config.ts` as needed. This command has **not** been run successfully here; no APK, native Gradle build, emulator launch, physical install, or UI/device test is claimed.

## EAS preview APK

`eas.json` includes a `preview` profile with Android `buildType: "apk"`. After setting up an Expo account and reviewing signing configuration:

```sh
npm install --global eas-cli
eas login
eas build --platform android --profile preview
```

Download and install the EAS artifact manually on a test device. This is an instruction only: no EAS credentials/build were available or executed for this audit.

## Environment configuration

Copy `.env.example` to `.env` inside `mobile/`, then fill only values needed for the features you are ready to test. `.env` is ignored by Git.

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`: Android Maps SDK key. Restrict to package `com.saheli.safety` and the signing certificate SHA-1/SHA-256 used for the build; enable Maps SDK for Android and billing. A different EAS/local signing certificate requires the corresponding restriction. Keys are public client configuration, not server secrets. With no key, use manual point/current-location fallback. With an invalid key, check Android logcat and Cloud Console; no map-tile error event has been device-verified.
- `EXPO_PUBLIC_SUPABASE_URL`: HTTPS Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: publishable key (`sb_publishable_…`) or a legacy anon JWT only. Never use `service_role`, `sb_secret_…`, or any server secret.
- `EXPO_PUBLIC_SUPABASE_RLS_VERIFIED`: remains `false` by default. Change to `true` only after applying both migrations and completing the two-account policy checks below. It is a deployment-owner assertion; Saheli cannot prove cross-account authorization from one client session. Merely adding URL/key will not instantiate the cloud client or enable account sync.

### Supabase schema and RLS

The native client expects the tables/columns in `../migrations/001_initial.sql`. Apply the migration and then `../migrations/002_public_reports_authenticated_select.sql` in Supabase SQL Editor or your controlled migration pipeline. Migration 002 updates the safe verified-report SELECT policy for both `anon` and `authenticated`; apply it even if 001 was already applied. These SQL migrations have not been applied to a live project here.

Before enabling the flag, use two test accounts and an anon client to verify:

1. Each account reads/writes/deletes only its own profile, contacts, SOS rows, journeys/check-ins, incidents and reporting rows.
2. Each user's report reads are limited to their own pending reports; public reads return only verified, unexpired rows and only approved public fields.
3. Neither the view nor base-table grants expose reporter identity or exact `latitude`/`longitude`; the report trigger clears exact coordinates and rounds the public point.
4. Users cannot self-assign moderator/contact verification; the trusted `app_metadata.saheli_role=moderator` claim is supplied only by controlled admin tooling.
5. Inserts, updates, deletes, flags and rate limits behave as intended for each role.

The app submits community reports with exact coordinate columns null and approximate public coordinates after explicit consent. It uses only a publishable/anon client key. No live RLS/auth/query behavior was tested; the SQL is not treated as proof of authorization. Do not enable account sync until your real project passes those checks.

## Permissions, offline behavior, and data

- Android manifest configuration is limited to location and notification permissions required by included features. Runtime location permission is requested only from a user-selected location action; notifications permission is requested when scheduling journey reminders. The app does not request background location, microphone, camera, or contacts permission.
- SOS records, emergency guidance, manual coordinates, local reports, contacts, incidents, demo log, journeys, and evidence are intended to be device-only unless the user separately selects explicit account sync categories (cloud is disabled by default).
- SMS does not send itself. The user must review/submit in the device composer. Neither a local status nor a database row confirms carrier delivery, contact receipt, or acknowledgement.
- A missed journey check-in is not proof of emergency. OS doze, app force-stop, OEM battery controls, reboot, denied permission, and user settings can delay/drop reminders. No background reliability is promised.
- Evidence attachments are BLOBs in the local database, not uploaded. Manual share/export copies can be retained by the receiving app/user and cannot be remotely recalled. Hashing is not authentication or chain of custody.
- Migration import previews selected categories, skips invalid/duplicate entries, and keeps existing data. Web exporter excludes evidence attachments; the native import also rejects unknown formats and does not access browser stores.
- Local safety-data deletion removes the database key and database contents if the native delete succeeds. Cloud data and the saved Supabase login session are left intact; sign out separately. Deletion does not erase screenshots, downloads, share targets, backups or OS traces.

## Security and dependency audit

`npm audit` currently reports **9 advisories (6 high, 3 moderate)**. The high findings are in the Expo CLI/build chain: `expo → @expo/cli → @expo/code-signing-certificates → node-forge` and Expo CLI's Zod 3 dependency. `npm audit` also lists the direct datetime-picker package through its Expo dependency edge; the audit path points back to Expo CLI, not a separate datetime-picker code advisory. The affected CLI/signature-validation code is build/development tooling, not a module imported into the Android JS bundle, but still update/monitor before release because the builder handles project code/signing-related metadata. The moderate finding is `expo-router → query-string@7 → decode-uri-component@0.2.2`; Router uses this in navigation/query parsing and it can be in the application bundle. `node-forge@1.4.0` is the latest version visible from the configured registry and is still within the advisory range; Expo CLI requires Zod 3, while the audit fix is in Zod 4, so no compatible patch was identified. A trial query-string 9/10 override was reverted after a Node smoke check showed the ESM default-export/CommonJS namespace mismatch expected by Router 57; it needs a Router-compatible patch and runtime tests. `npm audit fix` has no compatible non-breaking resolution in this SDK line; the forced suggested upgrades downgrade Expo to 44 or move Router to 58, so neither was applied. Review advisories again before release.

SQLCipher and SecureStore key handling remain **unverified** until a native Android build passes and a device test confirms the SQLCipher PRAGMA, encrypted database behavior across relaunch, wrong-key fail-closed behavior, and deletion. This audit does not claim end-to-end encryption, backup exclusion, tamper-proofing, secure erasure, a secure evidence chain of custody, live RLS security, or real notification delivery.

## Checks performed for this audit

After targeted repairs:

```sh
npm ci
npm run typecheck
npm test
npx expo-doctor
npx expo config --type public
npx expo export --platform android
npm audit
```

The latest P2 check run passed `npm run typecheck`, `npm test` (**21/21**, including EXIF GPS parser, checklist state, volunteer validation/opt-in, privacy-sensitive request construction, and route reachability), and `npx expo export --platform android`. The Android JavaScript bundle/export is a Metro bundling check only—not a native Android build. Android OS intents/settings navigation, share-sheet behavior, actual document-provider cache cleanup, SQLCipher/Keystore, file-picker UI, notification delivery, Supabase auth/RLS, accessibility on real screen sizes, and back behavior remain device/project checks.
