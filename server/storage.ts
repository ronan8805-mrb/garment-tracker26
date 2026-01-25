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
  createFactory(factory: InsertFactory): Promise<Factory>;
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

  // Batch operations
  getBatches(factoryId?: string): Promise<ScanBatch[]>;
  getBatch(id: string): Promise<ScanBatch | undefined>;
  createBatch(batch: InsertScanBatch): Promise<ScanBatch>;
  completeBatch(id: string, totalItems: number): Promise<ScanBatch | undefined>;

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

  async createFactory(factory: InsertFactory): Promise<Factory> {
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
    const allFactories = await db.select().from(factories);
    const allGarments = await db.select().from(garments);
    const recentBatches = await db.select().from(scanBatches).orderBy(desc(scanBatches.createdAt)).limit(5);
    const recentFactories = await db.select().from(factories).orderBy(desc(factories.createdAt)).limit(5);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayScansResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scanEvents)
      .where(sql`${scanEvents.scannedAt} >= ${today}`);

    return {
      totalFactories: allFactories.length,
      activeFactories: allFactories.filter((f) => f.isActive).length,
      totalGarments: allGarments.length,
      atFactory: allGarments.filter((g) => g.status === "at_factory").length,
      atLaundry: allGarments.filter((g) => g.status === "at_laundry").length,
      todayScans: todayScansResult[0]?.count || 0,
      recentBatches,
      recentFactories,
    };
  }

  async getFactoryDashboardStats(factoryId: string) {
    const factory = await this.getFactory(factoryId);
    const factoryGarments = await db.select().from(garments).where(eq(garments.factoryId, factoryId));
    const recentBatches = await db
      .select()
      .from(scanBatches)
      .where(eq(scanBatches.factoryId, factoryId))
      .orderBy(desc(scanBatches.createdAt))
      .limit(5);

    return {
      factoryName: factory?.name || "Unknown Factory",
      totalGarments: factoryGarments.length,
      atFactory: factoryGarments.filter((g) => g.status === "at_factory").length,
      atLaundry: factoryGarments.filter((g) => g.status === "at_laundry").length,
      recentBatches,
    };
  }
}

export const storage = new DatabaseStorage();
