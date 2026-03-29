import {
  factories,
  garments,
  scanEvents,
  scanBatches,
  userProfiles,
  type Factory,
  type InsertFactory,
  type Garment,
  type InsertGarment,
  type ScanEvent,
  type InsertScanEvent,
  type ScanBatch,
  type InsertScanBatch,
  type UserProfile,
  type InsertUserProfile,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Factory operations
  getFactories(): Promise<Factory[]>;
  getFactory(id: string): Promise<Factory | undefined>;
  getFactoryByCode(code: string): Promise<Factory | undefined>;
  getFactoryByUsername(username: string): Promise<Factory | undefined>;
  createFactory(factory: InsertFactory): Promise<Factory>;
  createFactoryWithPassword(factory: InsertFactory & { passwordHash: string }): Promise<Factory>;
  updateFactory(id: string, factory: Partial<InsertFactory>): Promise<Factory | undefined>;

  // Garment operations
  getGarments(factoryId?: string): Promise<Garment[]>;
  getGarment(id: string): Promise<Garment | undefined>;
  getGarmentByGarmentId(garmentId: string): Promise<Garment | undefined>;
  createGarments(garmentsData: InsertGarment[]): Promise<Garment[]>;
  updateGarmentStatus(id: string, status: "at_factory" | "at_laundry"): Promise<void>;

  // Scan event operations
  createScanEvent(event: InsertScanEvent): Promise<ScanEvent>;
  getScanEvents(garmentId?: string): Promise<ScanEvent[]>;
  getScanEventsByBatchId(batchId: string): Promise<ScanEvent[]>;
  getScanByClientId(clientScanId: string): Promise<ScanEvent | undefined>;
  getScanDates(factoryId?: string): Promise<{ date: string; count: number }[]>;
  getScanEventsByDate(date: string, factoryId?: string): Promise<ScanEvent[]>;

  // Batch operations
  getBatches(factoryId?: string): Promise<ScanBatch[]>;
  getBatch(id: string): Promise<ScanBatch | undefined>;
  createBatch(batch: InsertScanBatch): Promise<ScanBatch>;
  completeBatch(id: string, totalItems: number): Promise<ScanBatch | undefined>;
  createBatchWithScans(params: {
    batchData: InsertScanBatch;
    garmentIds: string[];
    location: "factory" | "laundry";
    direction: "IN" | "OUT";
    userId: string;
  }): Promise<ScanBatch>;

  // User profile operations
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  getAllUserProfiles(): Promise<UserProfile[]>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;

  // Dashboard stats
  getAdminDashboardStats(): Promise<{
    totalFactories: number;
    activeFactories: number;
    totalGarments: number;
    atFactory: number;
    atLaundry: number;
    todayScans: number;
    recentBatches: ScanBatch[];
    recentFactories: Factory[];
  }>;
  getFactoryDashboardStats(factoryId: string): Promise<{
    factoryName: string;
    totalGarments: number;
    atFactory: number;
    atLaundry: number;
    recentBatches: ScanBatch[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Factory operations
  async getFactories(): Promise<Factory[]> {
    return db.select().from(factories).orderBy(desc(factories.createdAt));
  }

  async getFactory(id: string): Promise<Factory | undefined> {
    const [factory] = await db.select().from(factories).where(eq(factories.id, id));
    return factory;
  }

  async getFactoryByCode(code: string): Promise<Factory | undefined> {
    const [factory] = await db.select().from(factories).where(eq(factories.code, code));
    return factory;
  }

  async getFactoryByUsername(username: string): Promise<Factory | undefined> {
    const [factory] = await db.select().from(factories).where(eq(factories.username, username));
    return factory;
  }

  async createFactory(factory: InsertFactory): Promise<Factory> {
    const [created] = await db.insert(factories).values(factory).returning();
    return created;
  }

  async createFactoryWithPassword(factory: InsertFactory & { passwordHash: string }): Promise<Factory> {
    const [created] = await db.insert(factories).values(factory).returning();
    return created;
  }

  async updateFactory(id: string, factory: Partial<InsertFactory>): Promise<Factory | undefined> {
    const [updated] = await db
      .update(factories)
      .set({ ...factory, updatedAt: new Date() })
      .where(eq(factories.id, id))
      .returning();
    return updated;
  }

  // Garment operations
  async getGarments(factoryId?: string): Promise<Garment[]> {
    if (factoryId) {
      return db.select().from(garments).where(eq(garments.factoryId, factoryId)).orderBy(desc(garments.createdAt));
    }
    return db.select().from(garments).orderBy(desc(garments.createdAt));
  }

  async getGarment(id: string): Promise<Garment | undefined> {
    const [garment] = await db.select().from(garments).where(eq(garments.id, id));
    return garment;
  }

  async getGarmentByGarmentId(garmentId: string): Promise<Garment | undefined> {
    const [garment] = await db.select().from(garments).where(eq(garments.garmentId, garmentId));
    return garment;
  }

  async createGarments(garmentsData: InsertGarment[]): Promise<Garment[]> {
    if (garmentsData.length === 0) return [];
    return db.insert(garments).values(garmentsData).returning();
  }

  async updateGarmentStatus(id: string, status: "at_factory" | "at_laundry"): Promise<void> {
    await db.update(garments).set({ status }).where(eq(garments.id, id));
  }

  // Scan event operations
  async createScanEvent(event: InsertScanEvent): Promise<ScanEvent> {
    const [created] = await db.insert(scanEvents).values(event).returning();
    return created;
  }

  async getScanEvents(garmentId?: string): Promise<ScanEvent[]> {
    if (garmentId) {
      return db.select().from(scanEvents).where(eq(scanEvents.garmentId, garmentId)).orderBy(desc(scanEvents.scannedAt));
    }
    return db.select().from(scanEvents).orderBy(desc(scanEvents.scannedAt));
  }

  async getScanEventsByBatchId(batchId: string): Promise<ScanEvent[]> {
    return db.select().from(scanEvents).where(eq(scanEvents.batchId, batchId)).orderBy(scanEvents.scannedAt);
  }

  async getScanByClientId(clientScanId: string): Promise<ScanEvent | undefined> {
    const [event] = await db.select().from(scanEvents).where(eq(scanEvents.clientScanId, clientScanId));
    return event;
  }

  async getScanDates(factoryId?: string): Promise<{ date: string; count: number }[]> {
    const dateExpr = sql<string>`date(${scanEvents.scannedAt})`;
    if (factoryId) {
      const results = await db
        .select({
          date: dateExpr,
          count: sql<number>`count(*)::int`,
        })
        .from(scanEvents)
        .innerJoin(garments, eq(scanEvents.garmentId, garments.id))
        .where(eq(garments.factoryId, factoryId))
        .groupBy(dateExpr)
        .orderBy(desc(dateExpr));
      return results;
    }
    const results = await db
      .select({
        date: dateExpr,
        count: sql<number>`count(*)::int`,
      })
      .from(scanEvents)
      .groupBy(dateExpr)
      .orderBy(desc(dateExpr));
    return results;
  }

  async getScanEventsByDate(date: string, factoryId?: string): Promise<ScanEvent[]> {
    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59.999");
    if (factoryId) {
      return db
        .select({ scanEvent: scanEvents })
        .from(scanEvents)
        .innerJoin(garments, eq(scanEvents.garmentId, garments.id))
        .where(
          and(
            sql`${scanEvents.scannedAt} >= ${dayStart}`,
            sql`${scanEvents.scannedAt} <= ${dayEnd}`,
            eq(garments.factoryId, factoryId)
          )
        )
        .orderBy(scanEvents.scannedAt)
        .then((rows) => rows.map((r) => r.scanEvent));
    }
    return db
      .select()
      .from(scanEvents)
      .where(
        and(
          sql`${scanEvents.scannedAt} >= ${dayStart}`,
          sql`${scanEvents.scannedAt} <= ${dayEnd}`
        )
      )
      .orderBy(scanEvents.scannedAt);
  }

  // Batch operations
  async getBatches(factoryId?: string): Promise<ScanBatch[]> {
    if (factoryId) {
      return db.select().from(scanBatches).where(eq(scanBatches.factoryId, factoryId)).orderBy(desc(scanBatches.createdAt));
    }
    return db.select().from(scanBatches).orderBy(desc(scanBatches.createdAt));
  }

  async getBatch(id: string): Promise<ScanBatch | undefined> {
    const [batch] = await db.select().from(scanBatches).where(eq(scanBatches.id, id));
    return batch;
  }

  async createBatch(batch: InsertScanBatch): Promise<ScanBatch> {
    const [created] = await db.insert(scanBatches).values(batch).returning();
    return created;
  }

  async completeBatch(id: string, totalItems: number): Promise<ScanBatch | undefined> {
    const [updated] = await db
      .update(scanBatches)
      .set({ totalItems, completedAt: new Date() })
      .where(eq(scanBatches.id, id))
      .returning();
    return updated;
  }

  async createBatchWithScans(params: {
    batchData: InsertScanBatch;
    garmentIds: string[];
    location: "factory" | "laundry";
    direction: "IN" | "OUT";
    userId: string;
  }): Promise<ScanBatch> {
    const { batchData, garmentIds, location, direction, userId } = params;

    return await db.transaction(async (tx) => {
      const [batch] = await tx.insert(scanBatches).values(batchData).returning();
      let processedCount = 0;

      for (const gId of garmentIds) {
        const [garment] = await tx.select().from(garments).where(eq(garments.garmentId, gId));
        if (!garment) continue;

        await tx.insert(scanEvents).values({
          garmentId: garment.id,
          location,
          direction,
          userId,
          batchId: batch.id,
        });

        const newStatus = location === "factory" ? "at_factory" : "at_laundry";
        await tx.update(garments).set({ status: newStatus }).where(eq(garments.id, garment.id));
        processedCount++;
      }

      const [completed] = await tx
        .update(scanBatches)
        .set({ totalItems: processedCount, completedAt: new Date() })
        .where(eq(scanBatches.id, batch.id))
        .returning();

      return completed;
    });
  }

  // User profile operations
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async getAllUserProfiles(): Promise<UserProfile[]> {
    return db.select().from(userProfiles);
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [created] = await db.insert(userProfiles).values(profile).returning();
    return created;
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const [updated] = await db
      .update(userProfiles)
      .set(profile)
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Dashboard stats
  async getAdminDashboardStats() {
    const [factoryStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${factories.isActive} = true)::int`,
      })
      .from(factories);

    const [garmentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        atFactory: sql<number>`count(*) filter (where ${garments.status} = 'at_factory')::int`,
        atLaundry: sql<number>`count(*) filter (where ${garments.status} = 'at_laundry')::int`,
      })
      .from(garments);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayScansResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanEvents)
      .where(sql`${scanEvents.scannedAt} >= ${today}`);

    const recentBatches = await db.select().from(scanBatches).orderBy(desc(scanBatches.createdAt)).limit(5);
    const recentFactories = await db.select().from(factories).orderBy(desc(factories.createdAt)).limit(5);

    return {
      totalFactories: factoryStats.total,
      activeFactories: factoryStats.active,
      totalGarments: garmentStats.total,
      atFactory: garmentStats.atFactory,
      atLaundry: garmentStats.atLaundry,
      todayScans: todayScansResult?.count || 0,
      recentBatches,
      recentFactories,
    };
  }

  async getFactoryDashboardStats(factoryId: string) {
    const factory = await this.getFactory(factoryId);

    const [garmentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        atFactory: sql<number>`count(*) filter (where ${garments.status} = 'at_factory')::int`,
        atLaundry: sql<number>`count(*) filter (where ${garments.status} = 'at_laundry')::int`,
      })
      .from(garments)
      .where(eq(garments.factoryId, factoryId));

    const recentBatches = await db
      .select()
      .from(scanBatches)
      .where(eq(scanBatches.factoryId, factoryId))
      .orderBy(desc(scanBatches.createdAt))
      .limit(5);

    return {
      factoryName: factory?.name || "Unknown Factory",
      totalGarments: garmentStats.total,
      atFactory: garmentStats.atFactory,
      atLaundry: garmentStats.atLaundry,
      recentBatches,
    };
  }
}

// Use in-memory storage when no DATABASE_URL is configured (local dev without DB)
import { MemoryStorage } from "./memory-storage";
export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemoryStorage();
