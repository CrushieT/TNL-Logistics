import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { buildOfflineQueueItem, buildSyncChunk, canQueueOfflineItem, mapSyncOutcome, validateSyncResponse } from '../offlineQueueFlow.mjs';

let databasePromise = null;
const isNative = Platform.OS !== 'web';

async function database() {
  if (!isNative) return null;
  if (!databasePromise) databasePromise = SQLite.openDatabaseAsync('tnl-offline-scans.db');
  return databasePromise;
}

export async function initializeOfflineQueue() {
  const db = await database();
  if (!db) return false;
  await db.execAsync(`PRAGMA user_version = 1;
    CREATE TABLE IF NOT EXISTS offline_scan_queue (
      local_sequence INTEGER PRIMARY KEY AUTOINCREMENT, client_event_id TEXT NOT NULL UNIQUE, owner_user_id TEXT NOT NULL,
      tracking_id TEXT NOT NULL, target_status TEXT NOT NULL, vehicle_id TEXT, captured_at TEXT NOT NULL,
      queue_status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT,
      last_outcome_code TEXT, safe_message TEXT, server_status TEXT, server_vehicle_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_offline_queue_owner_status_sequence ON offline_scan_queue(owner_user_id, queue_status, local_sequence);
    CREATE TABLE IF NOT EXISTS offline_vehicle_cache (
      vehicle_id TEXT PRIMARY KEY, plate_number TEXT NOT NULL, active INTEGER NOT NULL, cached_at TEXT NOT NULL
    );`);
  await db.runAsync("UPDATE offline_scan_queue SET queue_status = 'PENDING', updated_at = ? WHERE queue_status = 'SYNCING'", new Date().toISOString());
  return true;
}

export async function cacheVehicles(vehicles) {
  const db = await database();
  if (!db || !Array.isArray(vehicles)) return;
  const cachedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const vehicle of vehicles) {
      if (!vehicle?.vehicleId || !vehicle?.plateNumber) continue;
      await db.runAsync('INSERT OR REPLACE INTO offline_vehicle_cache(vehicle_id, plate_number, active, cached_at) VALUES (?, ?, ?, ?)',
        vehicle.vehicleId, vehicle.plateNumber, vehicle.active === false ? 0 : 1, cachedAt);
    }
  });
}

export async function getCachedVehicles() {
  const db = await database();
  if (!db) return [];
  return db.getAllAsync('SELECT vehicle_id AS vehicleId, plate_number AS plateNumber, cached_at AS cachedAt FROM offline_vehicle_cache WHERE active = 1 ORDER BY vehicle_id');
}

export async function queueOfflineScan({ ownerUserId, trackingId, targetStatus, vehicleId }) {
  const db = await database();
  if (!db) throw new Error('Offline scanning is unavailable on web.');
  const rows = await db.getAllAsync('SELECT client_event_id AS clientEventId, owner_user_id AS ownerUserId, tracking_id AS trackingId, target_status AS targetStatus, vehicle_id AS vehicleId, queue_status AS queueStatus FROM offline_scan_queue WHERE owner_user_id = ?', ownerUserId);
  const sequenceRow = await db.getFirstAsync('SELECT COALESCE(MAX(local_sequence), 0) + 1 AS nextSequence FROM offline_scan_queue WHERE owner_user_id = ?', ownerUserId);
  const item = buildOfflineQueueItem({ clientEventId: Crypto.randomUUID(), ownerUserId, trackingId, targetStatus, vehicleId, clientSequence: Number(sequenceRow?.nextSequence || 1) });
  const permission = canQueueOfflineItem(rows, item);
  if (!permission.allowed) throw new Error(permission.reason);
  const now = new Date().toISOString();
  await db.runAsync(`INSERT INTO offline_scan_queue(client_event_id, owner_user_id, tracking_id, target_status, vehicle_id, captured_at, queue_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`, item.clientEventId, item.ownerUserId, item.trackingId, item.targetStatus, item.vehicleId, item.capturedAt, now, now);
  return item;
}

export async function getQueueRows(ownerUserId) {
  const db = await database();
  if (!db) return [];
  return db.getAllAsync(`SELECT local_sequence AS clientSequence, client_event_id AS clientEventId, owner_user_id AS ownerUserId, tracking_id AS trackingId,
    target_status AS targetStatus, vehicle_id AS vehicleId, captured_at AS capturedAt, queue_status AS queueStatus, attempt_count AS attemptCount,
    next_attempt_at AS nextAttemptAt, last_outcome_code AS lastOutcomeCode, server_status AS serverStatus, server_vehicle_id AS serverVehicleId
    FROM offline_scan_queue WHERE owner_user_id = ? ORDER BY local_sequence`, ownerUserId);
}

export async function prepareOfflineSyncChunk(ownerUserId, now = Date.now()) {
  const rows = await getQueueRows(ownerUserId);
  const chunk = buildSyncChunk(rows, ownerUserId, 100, now);
  if (!chunk.length) return [];
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const row of chunk) await db.runAsync("UPDATE offline_scan_queue SET queue_status = 'SYNCING', updated_at = ? WHERE client_event_id = ? AND owner_user_id = ?", new Date().toISOString(), row.clientEventId, ownerUserId);
  });
  return chunk;
}

export async function applyOfflineSyncResponse(ownerUserId, chunk, response, retryAt = null) {
  if (!validateSyncResponse(chunk, response)) throw new Error('Offline sync response was incomplete.');
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const result of response.results) {
      const action = mapSyncOutcome(result);
      if (action.action === 'DELETE') {
        await db.runAsync('DELETE FROM offline_scan_queue WHERE client_event_id = ? AND owner_user_id = ?', result.clientEventId, ownerUserId);
      } else {
        await db.runAsync(`UPDATE offline_scan_queue SET queue_status = ?, attempt_count = attempt_count + ?, next_attempt_at = ?, last_outcome_code = ?,
          server_status = ?, server_vehicle_id = ?, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ?`,
          action.queueStatus, action.action === 'RETRY' ? 1 : 0, action.action === 'RETRY' ? retryAt : null,
          result.code || null, result.serverStatus || null, result.serverVehicleId || null, new Date().toISOString(), result.clientEventId, ownerUserId);
      }
    }
  });
}

export async function returnChunkToRetryable(ownerUserId, chunk, code = 'TEMPORARY_FAILURE', retryAt = null) {
  const db = await database();
  if (!db) return;
  await db.withTransactionAsync(async () => {
    for (const row of chunk) await db.runAsync("UPDATE offline_scan_queue SET queue_status = 'RETRYABLE', attempt_count = attempt_count + 1, next_attempt_at = ?, last_outcome_code = ?, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ?", retryAt, code, new Date().toISOString(), row.clientEventId, ownerUserId);
  });
}

export async function acknowledgeOfflineQueueRow(ownerUserId, clientEventId) {
  const db = await database();
  if (db) await db.runAsync("DELETE FROM offline_scan_queue WHERE client_event_id = ? AND owner_user_id = ? AND queue_status IN ('STALE', 'CONFLICT', 'REJECTED', 'BLOCKED')", clientEventId, ownerUserId);
}
