import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {AppState, initialState} from './types';

const DB_NAME = 'saheli-private.db';
const KEY_NAME = 'saheli.sqlcipher.key.v1';
let dbTask: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();
function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const task = writeQueue.then(operation);
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function openPrivateDb(): Promise<SQLite.SQLiteDatabase> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure device storage is unavailable; private local storage is disabled.');
  }
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    key = [...Crypto.getRandomBytes(32)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_NAME, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f\d]{64}$/i.test(key)) {
    throw new Error('The local database key is invalid. Local data was not opened or reset.');
  }

  const db = await SQLite.openDatabaseAsync(DB_NAME, {useNewConnection: true});
  try {
    // Key before *any* schema/read operation. The key contains hex only, preventing SQL injection.
    await db.execAsync(`PRAGMA key = "x'${key}'"; PRAGMA foreign_keys=ON;`);
    const cipher = await db.getFirstAsync<{cipher_version?: string}>('PRAGMA cipher_version');
    if (!cipher?.cipher_version) {
      throw new Error('This native SQLite build did not report SQLCipher support; private data was not opened.');
    }
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS evidence_files (id TEXT PRIMARY KEY, incident_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>=0), sha256 TEXT NOT NULL, bytes BLOB NOT NULL, created_at INTEGER NOT NULL);'
    );
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbTask) {
    dbTask = openPrivateDb().catch((error) => {
      dbTask = null;
      throw error;
    });
  }
  return dbTask;
}

function validCheckMap(value: unknown): value is Record<string, boolean> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length <= 100 && Object.entries(value).every(([key, checked]) => key.length <= 100 && typeof checked === 'boolean');
}
function validVolunteers(value: unknown): boolean {
  return Array.isArray(value) && value.length <= 500 && value.every((item) => !!item && typeof item === 'object' &&
    typeof item.id === 'string' && item.id.length <= 120 && typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 100 &&
    typeof item.contact === 'string' && item.contact.length > 0 && item.contact.length <= 254 &&
    ['unverified','verified','demo'].includes(item.verification) && typeof item.optedIn === 'boolean' && Number.isFinite(item.createdAt));
}

function validState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<AppState>;
  return Array.isArray(s.contacts) && Array.isArray(s.alerts) && Array.isArray(s.incidents) &&
    Array.isArray(s.reports) && Array.isArray(s.demoLog) &&
    (s.journey === null || (typeof s.journey === 'object' && s.journey !== undefined)) &&
    (s.language === 'en' || s.language === 'hi' || s.language === 'mr') &&
    Number.isFinite(s.grace) && typeof s.reportTracker === 'string' &&
    (s.shareUntil === null || Number.isFinite(s.shareUntil)) && typeof s.privacyLock === 'boolean' &&
    (s.privacyCheckup === undefined || validCheckMap(s.privacyCheckup)) &&
    (s.accountSecurityCheckup === undefined || validCheckMap(s.accountSecurityCheckup)) &&
    (s.trackerSafetyCheckup === undefined || validCheckMap(s.trackerSafetyCheckup)) &&
    (s.supportVolunteers === undefined || validVolunteers(s.supportVolunteers));
}

export async function loadState(): Promise<AppState> {
  const db = await getDb();
  const row = await db.getFirstAsync<{value: string}>('SELECT value FROM app_state WHERE id=1');
  if (!row) return initialState;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch {
    throw new Error('Saved local app data is unreadable. It was preserved; no reset or overwrite was attempted.');
  }
  if (!validState(parsed)) {
    throw new Error('Saved local app data has an unsupported shape. It was preserved without overwrite.');
  }
  return {...initialState, ...parsed};
}

async function writeState(db: SQLite.SQLiteDatabase, value: AppState): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
    JSON.stringify(value)
  );
}

export async function saveState(value: AppState): Promise<void> {
  return serializeWrite(async () => writeState(await getDb(), value));
}

export async function deleteIncidentAndEvidence(value: AppState, incidentId: string): Promise<void> {
  return serializeWrite(async () => {
    const db = await getDb();
    // Use the already-keyed connection. The app-level write queue prevents interleaved writes.
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM evidence_files WHERE incident_id=?', incidentId);
      await writeState(db, value);
    });
  });
}

export async function addEvidence(file: {id: string; incidentId: string; name: string; mime: string; size: number; sha256: string; bytes: Uint8Array}): Promise<void> {
  return serializeWrite(async () => {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO evidence_files(id,incident_id,name,mime,size,sha256,bytes,created_at) VALUES(?,?,?,?,?,?,?,?)',
      file.id, file.incidentId, file.name, file.mime, file.size, file.sha256, file.bytes, Date.now()
    );
  });
}

export async function getEvidence(id: string) {
  const db = await getDb();
  return db.getFirstAsync<{id: string; name: string; mime: string; size: number; sha256: string; bytes: Uint8Array}>(
    'SELECT id,name,mime,size,sha256,bytes FROM evidence_files WHERE id=?', id
  );
}

export async function deleteEvidence(id: string): Promise<void> {
  return serializeWrite(async () => { const db = await getDb(); await db.runAsync('DELETE FROM evidence_files WHERE id=?', id); });
}

export async function deleteEvidenceForIncident(id: string): Promise<void> {
  return serializeWrite(async () => { const db = await getDb(); await db.runAsync('DELETE FROM evidence_files WHERE incident_id=?', id); });
}

export async function clearPrivateDatabase(): Promise<void> {
  await writeQueue;
  if (dbTask) {
    try { const db = await dbTask; await db.closeAsync(); } catch { /* an already-failed connection is closed by its initializer */ }
    dbTask = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
  await SecureStore.deleteItemAsync(KEY_NAME);
}
