import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "factory"]);
export const scanDirectionEnum = pgEnum("scan_direction", ["IN", "OUT"]);
export const scanLocationEnum = pgEnum("scan_location", ["factory", "laundry"]);
export const garmentStatusEnum = pgEnum("garment_status", ["at_factory", "at_laundry"]);

// Extended user profiles for app-specific data
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  role: userRoleEnum("role").notNull().default("admin"),
  factoryId: varchar("factory_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Factories table
export const factories = pgTable("factories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  location: text("location"),
  username: varchar("username", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Garments table
export const garments = pgTable("garments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garmentId: varchar("garment_id", { length: 50 }).notNull().unique(),
  factoryId: varchar("factory_id").notNull(),
  garmentType: text("garment_type").notNull(),
  size: varchar("size", { length: 10 }).notNull(),
  status: garmentStatusEnum("status").notNull().default("at_factory"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scan events table (immutable log)
export const scanEvents = pgTable("scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garmentId: varchar("garment_id").notNull(),
  location: scanLocationEnum("location").notNull(),
  direction: scanDirectionEnum("direction").notNull(),
  userId: varchar("user_id").notNull(),
  batchId: varchar("batch_id"),
  scannedAt: timestamp("scanned_at").defaultNow(),
});

// Scan batches table
export const scanBatches = pgTable("scan_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchNumber: text("batch_number").notNull(),
  factoryId: varchar("factory_id").notNull(),
  location: scanLocationEnum("location").notNull(),
  direction: scanDirectionEnum("direction").notNull(),
  userId: varchar("user_id").notNull(),
  totalItems: integer("total_items").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const factoriesRelations = relations(factories, ({ many }) => ({
  garments: many(garments),
  batches: many(scanBatches),
}));

export const garmentsRelations = relations(garments, ({ one, many }) => ({
  factory: one(factories, {
    fields: [garments.factoryId],
    references: [factories.id],
  }),
  scanEvents: many(scanEvents),
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  garment: one(garments, {
    fields: [scanEvents.garmentId],
    references: [garments.id],
  }),
  batch: one(scanBatches, {
    fields: [scanEvents.batchId],
    references: [scanBatches.id],
  }),
}));

export const scanBatchesRelations = relations(scanBatches, ({ one, many }) => ({
  factory: one(factories, {
    fields: [scanBatches.factoryId],
    references: [factories.id],
  }),
  scanEvents: many(scanEvents),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  factory: one(factories, {
    fields: [userProfiles.factoryId],
    references: [factories.id],
  }),
}));

// Insert schemas
export const insertFactorySchema = createInsertSchema(factories).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
});

// Factory login schema
export const factoryLoginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Factory creation with password schema
export const createFactoryWithCredentialsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required").max(10, "Code must be 10 characters or less"),
  location: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertGarmentSchema = createInsertSchema(garments).omit({
  id: true,
  createdAt: true,
});

export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  scannedAt: true,
});

export const insertScanBatchSchema = createInsertSchema(scanBatches).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
});

// Bulk garment creation schema
export const bulkGarmentSchema = z.object({
  factoryId: z.string(),
  garments: z.array(z.object({
    garmentType: z.string(),
    size: z.string(),
    quantity: z.number().min(1),
  })),
});

// Types
export type Factory = typeof factories.$inferSelect;
export type InsertFactory = z.infer<typeof insertFactorySchema>;

export type Garment = typeof garments.$inferSelect;
export type InsertGarment = z.infer<typeof insertGarmentSchema>;

export type ScanEvent = typeof scanEvents.$inferSelect;
export type InsertScanEvent = z.infer<typeof insertScanEventSchema>;

export type ScanBatch = typeof scanBatches.$inferSelect;
export type InsertScanBatch = z.infer<typeof insertScanBatchSchema>;

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type BulkGarmentInput = z.infer<typeof bulkGarmentSchema>;

export type FactoryLoginInput = z.infer<typeof factoryLoginSchema>;
export type CreateFactoryWithCredentials = z.infer<typeof createFactoryWithCredentialsSchema>;
