import { openDB, type IDBPDatabase } from "idb";
import { v4 as uuidv4 } from "uuid";
import { queryClient } from "./queryClient";

interface QueuedScan {
  id: string;
  clientScanId: string;
  garmentId: string;
  location: string;
  direction: string;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = "garment-tracker-offline";
const DB_VERSION = 1;
const STORE_NAME = "scan-queue";

let dbInstance: IDBPDatabase | null = null;

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("synced", "synced");
      }
    },
  });
  return dbInstance;
}

export async function queueScan(garmentId: string, location: string, direction: string): Promise<QueuedScan> {
  const db = await getDb();
  const scan: QueuedScan = {
    id: uuidv4(),
    clientScanId: uuidv4(),
    garmentId,
    location,
    direction,
    timestamp: Date.now(),
    synced: false,
  };
  await db.put(STORE_NAME, scan);
  return scan;
}

// Synced scans are deleted from the store (see markScanSynced), so every
// record still in it is pending. (IndexedDB can't use true/false as an index
// key, so querying the "synced" index with `false` throws a DataError.)
export async function getPendingScans(): Promise<QueuedScan[]> {
  const db = await getDb();
  const all = (await db.getAll(STORE_NAME)) as QueuedScan[];
  return all.sort((a, b) => a.timestamp - b.timestamp); // send in the order scanned
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

export async function markScanSynced(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

export async function syncPendingScans(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingScans();
  let synced = 0;
  let failed = 0;

  for (const scan of pending) {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          garmentId: scan.garmentId,
          location: scan.location,
          direction: scan.direction,
          clientScanId: scan.clientScanId,
        }),
      });

      if (res.ok || res.status === 409) {
        await markScanSynced(scan.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  if (synced > 0) {
    queryClient.invalidateQueries({ queryKey: ["/api/garments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/admin"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/factory"] });
  }

  return { synced, failed };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncing = false;

export function startAutoSync() {
  if (syncInterval) return;
  
  // Never run two syncs at once, or the same scan could be sent twice
  const trySync = async () => {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    try {
      if ((await getPendingCount()) > 0) await syncPendingScans();
    } catch (err) {
      console.error("Offline scan sync failed", err);
    } finally {
      syncing = false;
    }
  };

  window.addEventListener("online", trySync);
  syncInterval = setInterval(trySync, 10000);
  trySync();
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
