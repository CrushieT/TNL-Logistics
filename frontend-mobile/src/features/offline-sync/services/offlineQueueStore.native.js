import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { buildOfflineQueueItem, buildSyncChunk, canQueueOfflineItem, mapSyncOutcome, validateStoredQueueRow, validateSyncResponse } from '../offlineQueueFlow.mjs';

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
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`PRAGMA user_version = 1;
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
    await transaction.runAsync("UPDATE offline_scan_queue SET queue_status = 'PENDING', updated_at = ? WHERE queue_status = 'SYNCING'", new Date().toISOString());
  });
  return true;
}

export async function cacheVehicles(vehicles) {
  const db = await database();
  if (!db || !Array.isArray(vehicles)) return;
  const cachedAt = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const vehicle of vehicles) {
      if (!vehicle?.vehicleId || !vehicle?.plateNumber) continue;
      await transaction.runAsync('INSERT OR REPLACE INTO offline_vehicle_cache(vehicle_id, plate_number, active, cached_at) VALUES (?, ?, ?, ?)',
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
  let insertedItem;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const rows = await transaction.getAllAsync(`SELECT client_event_id AS clientEventId, owner_user_id AS ownerUserId, tracking_id AS trackingId,
      target_status AS targetStatus, vehicle_id AS vehicleId, queue_status AS queueStatus FROM offline_scan_queue WHERE owner_user_id = ?`, ownerUserId);
    const item = buildOfflineQueueItem({ clientEventId: Crypto.randomUUID(), ownerUserId, trackingId, targetStatus, vehicleId, clientSequence: 1 });
    const permission = canQueueOfflineItem(rows, item);
    if (!permission.allowed) throw new Error(permission.reason);
    const now = new Date().toISOString();
    const inserted = await transaction.runAsync(`INSERT INTO offline_scan_queue(client_event_id, owner_user_id, tracking_id, target_status, vehicle_id, captured_at, queue_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`, item.clientEventId, item.ownerUserId, item.trackingId, item.targetStatus, item.vehicleId, item.capturedAt, now, now);
    insertedItem = { ...item, clientSequence: inserted.lastInsertRowId };
  });
  return insertedItem;
}

export async function getQueueRows(ownerUserId) {
  const db = await database();
  if (!db) return [];
  return db.getAllAsync(`SELECT local_sequence AS clientSequence, client_event_id AS clientEventId, owner_user_id AS ownerUserId, tracking_id AS trackingId,
    target_status AS targetStatus, vehicle_id AS vehicleId, captured_at AS capturedAt, queue_status AS queueStatus, attempt_count AS attemptCount,
    next_attempt_at AS nextAttemptAt, last_outcome_code AS lastOutcomeCode, server_status AS serverStatus, server_vehicle_id AS serverVehicleId
    FROM offline_scan_queue WHERE owner_user_id = ? ORDER BY local_sequence`, ownerUserId);
}

export async function getOtherOwnerQueueCount(ownerUserId) {
  const db = await database();
  if (!db || !ownerUserId) return 0;
  const result = await db.getFirstAsync('SELECT COUNT(*) AS rowCount FROM offline_scan_queue WHERE owner_user_id <> ?', ownerUserId);
  return result?.rowCount || 0;
}

export async function prepareOfflineSyncChunk(ownerUserId, now = Date.now(), manual = false) {
  const db = await database();
  if (!db) return [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let claimedChunk = [];
      await db.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await transaction.getAllAsync(`SELECT local_sequence AS clientSequence, client_event_id AS clientEventId, owner_user_id AS ownerUserId,
          tracking_id AS trackingId, target_status AS targetStatus, vehicle_id AS vehicleId, captured_at AS capturedAt,
          queue_status AS queueStatus, attempt_count AS attemptCount, next_attempt_at AS nextAttemptAt,
          last_outcome_code AS lastOutcomeCode FROM offline_scan_queue WHERE owner_user_id = ?
          AND (queue_status = 'PENDING' OR (queue_status = 'RETRYABLE' AND
          (next_attempt_at IS NULL OR next_attempt_at <= ? OR (? = 1 AND last_outcome_code <> 'HTTP_429'))))
          ORDER BY local_sequence LIMIT 100`, ownerUserId, new Date(now).toISOString(), manual ? 1 : 0);
        const candidates = buildSyncChunk(rows, ownerUserId, 100, now, manual);
        const chunk = [];
        for (const row of candidates) {
          if (!validateStoredQueueRow(row, ownerUserId, now)) {
            const rejected = await transaction.runAsync(`UPDATE offline_scan_queue SET queue_status = 'REJECTED', last_outcome_code = 'INVALID_LOCAL_SCAN',
              next_attempt_at = NULL, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ? AND queue_status IN ('PENDING', 'RETRYABLE')`,
              new Date().toISOString(), row.clientEventId, ownerUserId);
            if (rejected.changes !== 1) throw new Error('CLAIM_CONFLICT');
            continue;
          }
          const claimed = await transaction.runAsync(`UPDATE offline_scan_queue SET queue_status = 'SYNCING', updated_at = ?
            WHERE client_event_id = ? AND owner_user_id = ? AND (queue_status = 'PENDING' OR
            (queue_status = 'RETRYABLE' AND (next_attempt_at IS NULL OR next_attempt_at <= ? OR (? = 1 AND last_outcome_code <> 'HTTP_429'))))`,
            new Date().toISOString(), row.clientEventId, ownerUserId, new Date(now).toISOString(), manual ? 1 : 0);
          if (claimed.changes !== 1) throw new Error('CLAIM_CONFLICT');
          chunk.push(row);
        }
        claimedChunk = chunk;
      });
      return claimedChunk;
    } catch (error) {
      if (error.message !== 'CLAIM_CONFLICT' || attempt === 2) throw error;
    }
  }
  return [];
}

export async function applyOfflineSyncResponse(ownerUserId, chunk, response, retryAt = null) {
  if (!validateSyncResponse(chunk, response)) {
    const error = new Error('Invalid offline sync response.');
    error.code = 'INVALID_SYNC_RESPONSE';
    throw error;
  }
  const db = await database();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const result of response.results) {
      const action = mapSyncOutcome(result);
      let changed;
      if (action.action === 'DELETE') {
        changed = await transaction.runAsync("DELETE FROM offline_scan_queue WHERE client_event_id = ? AND owner_user_id = ? AND queue_status = 'SYNCING'", result.clientEventId, ownerUserId);
      } else {
        changed = await transaction.runAsync(`UPDATE offline_scan_queue SET queue_status = ?, attempt_count = attempt_count + ?, next_attempt_at = ?, last_outcome_code = ?,
          server_status = ?, server_vehicle_id = ?, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ? AND queue_status = 'SYNCING'`,
          action.queueStatus, action.action === 'RETRY' ? 1 : 0, action.action === 'RETRY' ? retryAt : null,
          result.code || null, result.serverStatus || null, result.serverVehicleId || null, new Date().toISOString(), result.clientEventId, ownerUserId);
      }
      if (changed.changes !== 1) throw new Error('Offline sync queue changed during acknowledgement.');
    }
  });
}

export async function returnChunkToRetryable(ownerUserId, chunk, code = 'TEMPORARY_FAILURE', retryAt = null) {
  const db = await database();
  if (!db) return;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const row of chunk) {
      const changed = await transaction.runAsync("UPDATE offline_scan_queue SET queue_status = 'RETRYABLE', attempt_count = attempt_count + 1, next_attempt_at = ?, last_outcome_code = ?, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ? AND queue_status = 'SYNCING'", retryAt, code, new Date().toISOString(), row.clientEventId, ownerUserId);
      if (changed.changes !== 1) throw new Error('Offline sync queue changed during retry.');
    }
  });
}

export async function returnChunkToPending(ownerUserId, chunk) {
  const db = await database();
  if (!db) return;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const row of chunk) {
      const changed = await transaction.runAsync("UPDATE offline_scan_queue SET queue_status = 'PENDING', next_attempt_at = NULL, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ? AND queue_status = 'SYNCING'", new Date().toISOString(), row.clientEventId, ownerUserId);
      if (changed.changes !== 1) throw new Error('Offline sync queue changed during reset.');
    }
  });
}

export async function rejectChunk(ownerUserId, chunk, code) {
  const db = await database();
  if (!db) return;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    for (const row of chunk) {
      const changed = await transaction.runAsync("UPDATE offline_scan_queue SET queue_status = 'REJECTED', next_attempt_at = NULL, last_outcome_code = ?, updated_at = ? WHERE client_event_id = ? AND owner_user_id = ? AND queue_status = 'SYNCING'", code, new Date().toISOString(), row.clientEventId, ownerUserId);
      if (changed.changes !== 1) throw new Error('Offline sync queue changed during rejection.');
    }
  });
}

export async function rejectOwnerUnresolved(ownerUserId, code) {
  const db = await database();
  if (!db) return;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("UPDATE offline_scan_queue SET queue_status = 'REJECTED', next_attempt_at = NULL, last_outcome_code = ?, updated_at = ? WHERE owner_user_id = ? AND queue_status IN ('PENDING', 'SYNCING', 'RETRYABLE')", code, new Date().toISOString(), ownerUserId);
  });
}

export async function acknowledgeOfflineQueueRow(ownerUserId, clientEventId) {
  const db = await database();
  if (db) await db.withExclusiveTransactionAsync((transaction) => transaction.runAsync("DELETE FROM offline_scan_queue WHERE client_event_id = ? AND owner_user_id = ? AND queue_status IN ('STALE', 'CONFLICT', 'REJECTED', 'BLOCKED')", clientEventId, ownerUserId));
}
