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

export async function getPendingScans(): Promise<QueuedScan[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE_NAME, "synced", false);
  return all as QueuedScan[];
}

export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  const count = await db.countFromIndex(STORE_NAME, "synced", false);
  return count;
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

export function startAutoSync() {
  if (syncInterval) return;
  
  window.addEventListener("online", () => {
    syncPendingScans();
  });

  syncInterval = setInterval(async () => {
    if (navigator.onLine) {
      const count = await getPendingCount();
      if (count > 0) {
        await syncPendingScans();
      }
    }
  }, 10000);
}

export function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
