// Missing-garment rules, shared by the Postgres and in-memory storage.
//
// A garment is "last seen" at the latest of: its last scan, when its label was
// created, and when someone pressed "Found". It is missing once that is more
// than `days` ago. A written-off garment stays written off until it is scanned
// again (or marked found).

import type { MissingGarment } from "@shared/schema";

export interface GarmentWithLastScan {
  id: string;
  garmentId: string;
  factoryId: string;
  garmentType: string;
  size: string;
  status: "at_factory" | "at_laundry";
  createdAt: Date | null;
  missingResetAt: Date | null;
  writtenOffAt: Date | null;
  lastScanAt: Date | null;
  lastLocation: "factory" | "laundry" | null;
  lastDirection: "IN" | "OUT" | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const t = (d: Date | null | undefined) => (d ? new Date(d).getTime() : NaN);

export function isWrittenOff(g: GarmentWithLastScan): boolean {
  if (!g.writtenOffAt) return false;
  const off = t(g.writtenOffAt);
  // A scan after the write-off brings it back
  return isNaN(t(g.lastScanAt)) || t(g.lastScanAt) < off;
}

export function toMissingGarment(g: GarmentWithLastScan, now = Date.now()): MissingGarment {
  type Reason = MissingGarment["lastSeenReason"];
  const all: { at: number; reason: Reason }[] = [
    { at: t(g.lastScanAt), reason: "scan" },
    { at: t(g.createdAt), reason: "created" },
    { at: t(g.missingResetAt), reason: "found" },
  ];
  const candidates = all.filter((c) => !isNaN(c.at));
  const latest = candidates.sort((a, b) => b.at - a.at)[0];

  return {
    id: g.id,
    garmentId: g.garmentId,
    factoryId: g.factoryId,
    garmentType: g.garmentType,
    size: g.size,
    status: g.status,
    createdAt: g.createdAt,
    lastSeenAt: latest ? new Date(latest.at) : null,
    lastSeenReason: latest?.reason ?? "created",
    lastScanAt: g.lastScanAt,
    lastLocation: g.lastLocation,
    lastDirection: g.lastDirection,
    daysMissing: latest ? Math.floor((now - latest.at) / DAY_MS) : 0,
    writtenOffAt: isWrittenOff(g) ? g.writtenOffAt : null,
  };
}

/** Split garments into missing (oldest first) and written off. */
export function classifyMissing(rows: GarmentWithLastScan[], days: number, now = Date.now()) {
  const cutoff = now - days * DAY_MS;
  const missing: MissingGarment[] = [];
  const writtenOff: MissingGarment[] = [];
  for (const row of rows) {
    const m = toMissingGarment(row, now);
    if (m.writtenOffAt) {
      writtenOff.push(m);
    } else if (!m.lastSeenAt || m.lastSeenAt.getTime() < cutoff) {
      missing.push(m);
    }
  }
  missing.sort((a, b) => b.daysMissing - a.daysMissing);
  writtenOff.sort((a, b) => t(b.writtenOffAt) - t(a.writtenOffAt));
  return { missing, writtenOff };
}
