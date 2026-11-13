import {
  factories,
  garments,
  scanEvents,
  scanBatches,
  userProfiles,
  invoices,
  invoiceLines,
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
  type Invoice,
  type InsertInvoice,
  type InvoiceLine,
  type InsertInvoiceLine,
  type MissingGarment,
  statusAfterScan,
} from "@shared/schema";
import { db } from "./db";
import { classifyMissing, type GarmentWithLastScan } from "./missing";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface DeleteFactoryResult {
  name: string;
  garments: number;
  scans: number;
  batches: number;
  invoices: number;
}

export interface BackupData {
  factories: Factory[];
  garments: Garment[];
  scanEvents: ScanEvent[];
  scanBatches: ScanBatch[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
}

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
  /** Everything in the database, for backups */
  exportAll(): Promise<BackupData>;
  getGarment(id: string): Promise<Garment | undefined>;
  getGarmentByGarmentId(garmentId: string): Promise<Garment | undefined>;
  createGarments(garmentsData: InsertGarment[]): Promise<Garment[]>;
  updateGarmentStatus(id: string, status: "at_factory" | "at_laundry"): Promise<void>;

  // Missing garments: not seen for `days`, plus written-off garments
  getMissingReport(opts: { factoryId?: string; days: number }): Promise<{
    missing: MissingGarment[];
    writtenOff: MissingGarment[];
  }>;
  /** Permanently delete a factory and everything belonging to it */
  deleteFactory(id: string): Promise<DeleteFactoryResult | null>;
  /** Delete a batch and its scans; affected garments go back to their previous location */
  deleteBatch(id: string): Promise<{ scans: number; garments: number } | null>;
  /** "Found": clears any write-off and restarts the missing countdown */
  markGarmentFound(id: string): Promise<Garment | undefined>;
  writeOffGarment(id: string): Promise<Garment | undefined>;

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

  // Invoice operations
  getInvoices(factoryId?: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]>;
  getNextInvoiceNumber(): Promise<string>;
  createInvoice(invoice: InsertInvoice, lines: InsertInvoiceLine[]): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<InsertInvoice>, lines?: InsertInvoiceLine[]): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<void>;

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
    factoryBreakdown: {
      id: string;
      name: string;
      code: string;
      total: number;
      atFactory: number;
      atLaundry: number;
    }[];
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
  async exportAll(): Promise<BackupData> {
    const [f, g, se, sb, inv, lines] = await Promise.all([
      db.select().from(factories),
      db.select().from(garments),
      db.select().from(scanEvents),
      db.select().from(scanBatches),
      db.select().from(invoices),
      db.select().from(invoiceLines),
    ]);
    return { factories: f, garments: g, scanEvents: se, scanBatches: sb, invoices: inv, invoiceLines: lines };
  }

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

  async getMissingReport({ factoryId, days }: { factoryId?: string; days: number }) {
    // Each garment with its latest scan; the database only returns garments that
    // could be missing or written off, the final rules live in classifyMissing.
    const factoryFilter = factoryId ? sql`AND g.factory_id = ${factoryId}` : sql``;
    const result = await db.execute(sql`
      SELECT g.id, g.garment_id, g.factory_id, g.garment_type, g.size, g.status,
             g.created_at, g.missing_reset_at, g.written_off_at,
             ls.scanned_at AS last_scan_at, ls.location AS last_location, ls.direction AS last_direction
      FROM garments g
      LEFT JOIN LATERAL (
        SELECT e.scanned_at, e.location, e.direction
        FROM scan_events e
        WHERE e.garment_id = g.id
        ORDER BY e.scanned_at DESC
        LIMIT 1
      ) ls ON true
      WHERE (
        g.written_off_at IS NOT NULL
        OR COALESCE(GREATEST(ls.scanned_at, g.created_at, g.missing_reset_at), 'epoch'::timestamp)
           < now()::timestamp - make_interval(days => ${days}::int)
      )
      ${factoryFilter}
    `);
    const rows: GarmentWithLastScan[] = (result.rows as any[]).map((r) => ({
      id: r.id,
      garmentId: r.garment_id,
      factoryId: r.factory_id,
      garmentType: r.garment_type,
      size: r.size,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at) : null,
      missingResetAt: r.missing_reset_at ? new Date(r.missing_reset_at) : null,
      writtenOffAt: r.written_off_at ? new Date(r.written_off_at) : null,
      lastScanAt: r.last_scan_at ? new Date(r.last_scan_at) : null,
      lastLocation: r.last_location ?? null,
      lastDirection: r.last_direction ?? null,
    }));
    return classifyMissing(rows, days);
  }

  async deleteFactory(id: string): Promise<DeleteFactoryResult | null> {
    return db.transaction(async (tx) => {
      const [factory] = await tx.select().from(factories).where(eq(factories.id, id));
      if (!factory) return null;

      const invoiceIds = (
        await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.factoryId, id))
      ).map((i) => i.id);
      if (invoiceIds.length) {
        await tx.delete(invoiceLines).where(inArray(invoiceLines.invoiceId, invoiceIds));
      }
      const deletedInvoices = await tx.delete(invoices).where(eq(invoices.factoryId, id)).returning({ id: invoices.id });

      const byGarment = await tx.execute(
        sql`DELETE FROM scan_events WHERE garment_id IN (SELECT id FROM garments WHERE factory_id = ${id}) RETURNING id`,
      );
      const byBatch = await tx.execute(
        sql`DELETE FROM scan_events WHERE batch_id IN (SELECT id FROM scan_batches WHERE factory_id = ${id}) RETURNING id`,
      );
      const deletedBatches = await tx.delete(scanBatches).where(eq(scanBatches.factoryId, id)).returning({ id: scanBatches.id });
      const deletedGarments = await tx.delete(garments).where(eq(garments.factoryId, id)).returning({ id: garments.id });
      await tx.update(userProfiles).set({ factoryId: null }).where(eq(userProfiles.factoryId, id));
      await tx.delete(factories).where(eq(factories.id, id));

      return {
        name: factory.name,
        garments: deletedGarments.length,
        scans: (byGarment.rowCount ?? 0) + (byBatch.rowCount ?? 0),
        batches: deletedBatches.length,
        invoices: deletedInvoices.length,
      };
    });
  }

  async deleteBatch(id: string): Promise<{ scans: number; garments: number } | null> {
    return db.transaction(async (tx) => {
      const [batch] = await tx.select().from(scanBatches).where(eq(scanBatches.id, id));
      if (!batch) return null;

      const removed = await tx
        .delete(scanEvents)
        .where(eq(scanEvents.batchId, id))
        .returning({ garmentId: scanEvents.garmentId });
      // Invoices are financial records: keep them, just unlink the batch
      await tx.update(invoiceLines).set({ batchId: null }).where(eq(invoiceLines.batchId, id));
      await tx.delete(scanBatches).where(eq(scanBatches.id, id));

      // Put each garment back where its latest remaining scan says it is
      const garmentIds = Array.from(new Set(removed.map((r) => r.garmentId)));
      for (const garmentId of garmentIds) {
        const [last] = await tx
          .select()
          .from(scanEvents)
          .where(eq(scanEvents.garmentId, garmentId))
          .orderBy(desc(scanEvents.scannedAt))
          .limit(1);
        const status = last ? statusAfterScan(last.location, last.direction) : "at_factory";
        await tx.update(garments).set({ status }).where(eq(garments.id, garmentId));
      }
      return { scans: removed.length, garments: garmentIds.length };
    });
  }

  async markGarmentFound(id: string): Promise<Garment | undefined> {
    const [updated] = await db
      .update(garments)
      .set({ missingResetAt: new Date(), writtenOffAt: null })
      .where(eq(garments.id, id))
      .returning();
    return updated;
  }

  async writeOffGarment(id: string): Promise<Garment | undefined> {
    const [updated] = await db
      .update(garments)
      .set({ writtenOffAt: new Date() })
      .where(eq(garments.id, id))
      .returning();
    return updated;
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
        // Skip unknown garments and garments that belong to a different factory
        if (!garment || garment.factoryId !== batchData.factoryId) continue;

        const [existingScan] = await tx
          .select()
          .from(scanEvents)
          .where(
            and(
              eq(scanEvents.garmentId, garment.id),
              eq(scanEvents.location, location),
              eq(scanEvents.direction, direction),
              sql`${scanEvents.batchId} IS NULL`
            )
          )
          .orderBy(desc(scanEvents.scannedAt))
          .limit(1);

        if (existingScan) {
          await tx.update(scanEvents).set({ batchId: batch.id }).where(eq(scanEvents.id, existingScan.id));
        } else {
          await tx.insert(scanEvents).values({
            garmentId: garment.id,
            location,
            direction,
            userId,
            batchId: batch.id,
          });
        }

        const newStatus = statusAfterScan(location, direction);
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

  // Invoice operations
  async getInvoices(factoryId?: string): Promise<Invoice[]> {
    if (factoryId) {
      return db.select().from(invoices).where(eq(invoices.factoryId, factoryId)).orderBy(desc(invoices.createdAt));
    }
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceLines(invoiceId: string): Promise<InvoiceLine[]> {
    return db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
  }

  async getNextInvoiceNumber(): Promise<string> {
    const [result] = await db
      .select({ maxNum: sql<string>`max(${invoices.invoiceNumber})` })
      .from(invoices);
    const last = result?.maxNum;
    if (!last) return "INV-0001";
    const num = parseInt(last.replace("INV-", ""), 10);
    return `INV-${String(num + 1).padStart(4, "0")}`;
  }

  async createInvoice(invoice: InsertInvoice, lines: InsertInvoiceLine[]): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(invoices).values(invoice).returning();
      if (lines.length > 0) {
        const linesWithId = lines.map((l) => ({ ...l, invoiceId: created.id }));
        await tx.insert(invoiceLines).values(linesWithId);
      }
      return created;
    });
  }

  async updateInvoice(id: string, invoice: Partial<InsertInvoice>, lines?: InsertInvoiceLine[]): Promise<Invoice | undefined> {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoices)
        .set({ ...invoice, updatedAt: new Date() })
        .where(eq(invoices.id, id))
        .returning();
      if (!updated) return undefined;
      if (lines) {
        await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
        if (lines.length > 0) {
          const linesWithId = lines.map((l) => ({ ...l, invoiceId: id }));
          await tx.insert(invoiceLines).values(linesWithId);
        }
      }
      return updated;
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
    });
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

    const factoryBreakdown = await db
      .select({
        id: factories.id,
        name: factories.name,
        code: factories.code,
        total: sql<number>`count(${garments.id})::int`,
        atFactory: sql<number>`count(${garments.id}) filter (where ${garments.status} = 'at_factory')::int`,
        atLaundry: sql<number>`count(${garments.id}) filter (where ${garments.status} = 'at_laundry')::int`,
      })
      .from(factories)
      .leftJoin(garments, eq(garments.factoryId, factories.id))
      .groupBy(factories.id, factories.name, factories.code)
      .orderBy(factories.name);

    return {
      totalFactories: factoryStats.total,
      activeFactories: factoryStats.active,
      totalGarments: garmentStats.total,
      atFactory: garmentStats.atFactory,
      atLaundry: garmentStats.atLaundry,
      todayScans: todayScansResult?.count || 0,
      recentBatches,
      recentFactories,
      factoryBreakdown,
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

// Use in-memory storage only for local testing without a database. In
// production a missing DATABASE_URL must stop the app: running on temporary
// memory would silently lose every garment created or scanned.
import { MemoryStorage } from "./memory-storage";
if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORAGE !== "1") {
  throw new Error(
    "DATABASE_URL is not set. Refusing to start without the database so no garments are ever lost. " +
      "(For a local test without a database set ALLOW_MEMORY_STORAGE=1.)",
  );
}
export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemoryStorage();
