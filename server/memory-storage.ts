import { randomUUID } from "crypto";
import type {
  Factory,
  InsertFactory,
  Garment,
  InsertGarment,
  ScanEvent,
  InsertScanEvent,
  ScanBatch,
  InsertScanBatch,
  UserProfile,
  InsertUserProfile,
} from "@shared/schema";
import type { IStorage } from "./storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = () => new Date();

function uuid(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const DEMO_FACTORY_ID = uuid();
const DEMO_USER_ID = "admin-user-1";

const seedFactories: Factory[] = [
  {
    id: DEMO_FACTORY_ID,
    name: "Demo Factory",
    code: "DEMO01",
    location: "London, UK",
    username: "factory",
    passwordHash: "$2a$10$X9o9XnDH9FKmVr9fYVfZAu8.KLqQzQ9VrWc9e1xGQBZ2mDsxFwRiO", // "password"
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

const seedUserProfiles: UserProfile[] = [
  {
    id: uuid(),
    userId: DEMO_USER_ID,
    role: "admin",
    factoryId: null,
    createdAt: now(),
  },
];

// ---------------------------------------------------------------------------
// MemoryStorage
// ---------------------------------------------------------------------------
export class MemoryStorage implements IStorage {
  private _factories: Factory[] = [...seedFactories];
  private _garments: Garment[] = [];
  private _scanEvents: ScanEvent[] = [];
  private _scanBatches: ScanBatch[] = [];
  private _userProfiles: UserProfile[] = [...seedUserProfiles];

  // ---- Factories -----------------------------------------------------------

  async getFactories(): Promise<Factory[]> {
    return [...this._factories].sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async getFactory(id: string): Promise<Factory | undefined> {
    return this._factories.find((f) => f.id === id);
  }

  async getFactoryByCode(code: string): Promise<Factory | undefined> {
    return this._factories.find((f) => f.code === code);
  }

  async getFactoryByUsername(username: string): Promise<Factory | undefined> {
    return this._factories.find((f) => f.username === username);
  }

  async createFactory(factory: InsertFactory): Promise<Factory> {
    const record: Factory = {
      id: uuid(),
      name: factory.name,
      code: factory.code,
      location: factory.location ?? null,
      username: factory.username ?? null,
      passwordHash: null,
      isActive: factory.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    this._factories.push(record);
    return record;
  }

  async createFactoryWithPassword(
    factory: InsertFactory & { passwordHash: string }
  ): Promise<Factory> {
    const record: Factory = {
      id: uuid(),
      name: factory.name,
      code: factory.code,
      location: factory.location ?? null,
      username: factory.username ?? null,
      passwordHash: factory.passwordHash,
      isActive: factory.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
    };
    this._factories.push(record);
    return record;
  }

  async updateFactory(
    id: string,
    factory: Partial<InsertFactory>
  ): Promise<Factory | undefined> {
    const idx = this._factories.findIndex((f) => f.id === id);
    if (idx === -1) return undefined;
    this._factories[idx] = {
      ...this._factories[idx],
      ...factory,
      updatedAt: now(),
    };
    return this._factories[idx];
  }

  // ---- Garments ------------------------------------------------------------

  async getGarments(factoryId?: string): Promise<Garment[]> {
    const list = factoryId
      ? this._garments.filter((g) => g.factoryId === factoryId)
      : [...this._garments];
    return list.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async getGarment(id: string): Promise<Garment | undefined> {
    return this._garments.find((g) => g.id === id);
  }

  async getGarmentByGarmentId(garmentId: string): Promise<Garment | undefined> {
    return this._garments.find((g) => g.garmentId === garmentId);
  }

  async createGarments(garmentsData: InsertGarment[]): Promise<Garment[]> {
    const records: Garment[] = garmentsData.map((g) => ({
      id: uuid(),
      garmentId: g.garmentId,
      factoryId: g.factoryId,
      garmentType: g.garmentType,
      size: g.size,
      status: g.status ?? "at_factory",
      createdAt: now(),
    }));
    this._garments.push(...records);
    return records;
  }

  async updateGarmentStatus(
    id: string,
    status: "at_factory" | "at_laundry"
  ): Promise<void> {
    const idx = this._garments.findIndex((g) => g.id === id);
    if (idx !== -1) this._garments[idx].status = status;
  }

  // ---- Scan Events ---------------------------------------------------------

  async createScanEvent(event: InsertScanEvent): Promise<ScanEvent> {
    const record: ScanEvent = {
      id: uuid(),
      garmentId: event.garmentId,
      location: event.location,
      direction: event.direction,
      userId: event.userId,
      batchId: event.batchId ?? null,
      clientScanId: (event as any).clientScanId ?? null,
      scannedAt: now(),
    };
    this._scanEvents.push(record);
    return record;
  }

  async getScanEvents(garmentId?: string): Promise<ScanEvent[]> {
    const list = garmentId
      ? this._scanEvents.filter((e) => e.garmentId === garmentId)
      : [...this._scanEvents];
    return list.sort(
      (a, b) => (b.scannedAt?.getTime() ?? 0) - (a.scannedAt?.getTime() ?? 0)
    );
  }

  async getScanEventsByBatchId(batchId: string): Promise<ScanEvent[]> {
    return this._scanEvents
      .filter((e) => e.batchId === batchId)
      .sort(
        (a, b) => (a.scannedAt?.getTime() ?? 0) - (b.scannedAt?.getTime() ?? 0)
      );
  }

  async getScanByClientId(clientScanId: string): Promise<ScanEvent | undefined> {
    return this._scanEvents.find((e) => e.clientScanId === clientScanId);
  }

  async getScanDates(factoryId?: string): Promise<{ date: string; count: number }[]> {
    let events = this._scanEvents;
    if (factoryId) {
      const factoryGarmentIds = new Set(
        this._garments.filter((g) => g.factoryId === factoryId).map((g) => g.id)
      );
      events = events.filter((e) => factoryGarmentIds.has(e.garmentId));
    }
    const dateMap = new Map<string, number>();
    for (const e of events) {
      if (!e.scannedAt) continue;
      const d = e.scannedAt.toISOString().split("T")[0];
      dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
    }
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async getScanEventsByDate(date: string, factoryId?: string): Promise<ScanEvent[]> {
    const dayStart = new Date(date + "T00:00:00").getTime();
    const dayEnd = new Date(date + "T23:59:59.999").getTime();
    let events = this._scanEvents.filter((e) => {
      const t = e.scannedAt?.getTime() ?? 0;
      return t >= dayStart && t <= dayEnd;
    });
    if (factoryId) {
      const factoryGarmentIds = new Set(
        this._garments.filter((g) => g.factoryId === factoryId).map((g) => g.id)
      );
      events = events.filter((e) => factoryGarmentIds.has(e.garmentId));
    }
    return events.sort(
      (a, b) => (a.scannedAt?.getTime() ?? 0) - (b.scannedAt?.getTime() ?? 0)
    );
  }

  // ---- Batches -------------------------------------------------------------

  async getBatches(factoryId?: string): Promise<ScanBatch[]> {
    const list = factoryId
      ? this._scanBatches.filter((b) => b.factoryId === factoryId)
      : [...this._scanBatches];
    return list.sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
  }

  async getBatch(id: string): Promise<ScanBatch | undefined> {
    return this._scanBatches.find((b) => b.id === id);
  }

  async createBatch(batch: InsertScanBatch): Promise<ScanBatch> {
    const record: ScanBatch = {
      id: uuid(),
      batchNumber: batch.batchNumber,
      factoryId: batch.factoryId,
      location: batch.location,
      direction: batch.direction,
      userId: batch.userId,
      totalItems: batch.totalItems ?? 0,
      createdAt: now(),
      completedAt: null,
    };
    this._scanBatches.push(record);
    return record;
  }

  async completeBatch(
    id: string,
    totalItems: number
  ): Promise<ScanBatch | undefined> {
    const idx = this._scanBatches.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    this._scanBatches[idx] = {
      ...this._scanBatches[idx],
      totalItems,
      completedAt: now(),
    };
    return this._scanBatches[idx];
  }

  async createBatchWithScans(params: {
    batchData: InsertScanBatch;
    garmentIds: string[];
    location: "factory" | "laundry";
    direction: "IN" | "OUT";
    userId: string;
  }): Promise<ScanBatch> {
    const { batchData, garmentIds, location, direction, userId } = params;
    const batch = await this.createBatch(batchData);
    let processedCount = 0;

    for (const gId of garmentIds) {
      const garment = this._garments.find((g) => g.garmentId === gId);
      if (!garment) continue;

      await this.createScanEvent({
        garmentId: garment.id,
        location,
        direction,
        userId,
        batchId: batch.id,
      });

      const newStatus = location === "factory" ? "at_factory" : "at_laundry";
      await this.updateGarmentStatus(garment.id, newStatus);
      processedCount++;
    }

    return (await this.completeBatch(batch.id, processedCount)) ?? batch;
  }

  // ---- User Profiles -------------------------------------------------------

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this._userProfiles.find((p) => p.userId === userId);
  }

  async getAllUserProfiles(): Promise<UserProfile[]> {
    return [...this._userProfiles];
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const record: UserProfile = {
      id: uuid(),
      userId: profile.userId,
      role: profile.role ?? "admin",
      factoryId: profile.factoryId ?? null,
      createdAt: now(),
    };
    this._userProfiles.push(record);
    return record;
  }

  async updateUserProfile(
    userId: string,
    profile: Partial<InsertUserProfile>
  ): Promise<UserProfile | undefined> {
    const idx = this._userProfiles.findIndex((p) => p.userId === userId);
    if (idx === -1) return undefined;
    this._userProfiles[idx] = { ...this._userProfiles[idx], ...profile };
    return this._userProfiles[idx];
  }

  // ---- Dashboard -----------------------------------------------------------

  async getAdminDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalFactories: this._factories.length,
      activeFactories: this._factories.filter((f) => f.isActive).length,
      totalGarments: this._garments.length,
      atFactory: this._garments.filter((g) => g.status === "at_factory").length,
      atLaundry: this._garments.filter((g) => g.status === "at_laundry").length,
      todayScans: this._scanEvents.filter(
        (e) => (e.scannedAt?.getTime() ?? 0) >= today.getTime()
      ).length,
      recentBatches: [...this._scanBatches]
        .sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        )
        .slice(0, 5),
      recentFactories: [...this._factories]
        .sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        )
        .slice(0, 5),
    };
  }

  async getFactoryDashboardStats(factoryId: string) {
    const factory = await this.getFactory(factoryId);
    const factoryGarments = this._garments.filter(
      (g) => g.factoryId === factoryId
    );
    const recentBatches = [...this._scanBatches]
      .filter((b) => b.factoryId === factoryId)
      .sort(
        (a, b) =>
          (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      )
      .slice(0, 5);

    return {
      factoryName: factory?.name ?? "Unknown Factory",
      totalGarments: factoryGarments.length,
      atFactory: factoryGarments.filter((g) => g.status === "at_factory").length,
      atLaundry: factoryGarments.filter((g) => g.status === "at_laundry").length,
      recentBatches,
    };
  }
}
