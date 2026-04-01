import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum, index } from "drizzle-orm/pg-core";
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
}, (table) => [
  index("idx_garments_factory_id").on(table.factoryId),
  index("idx_garments_status").on(table.status),
]);

// Scan events table (immutable log)
export const scanEvents = pgTable("scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  garmentId: varchar("garment_id").notNull(),
  location: scanLocationEnum("location").notNull(),
  direction: scanDirectionEnum("direction").notNull(),
  userId: varchar("user_id").notNull(),
  batchId: varchar("batch_id"),
  clientScanId: varchar("client_scan_id", { length: 64 }),
  scannedAt: timestamp("scanned_at").defaultNow(),
}, (table) => [
  index("idx_scan_events_garment_id").on(table.garmentId),
  index("idx_scan_events_batch_id").on(table.batchId),
  index("idx_scan_events_scanned_at").on(table.scannedAt),
]);

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
}, (table) => [
  index("idx_scan_batches_factory_id").on(table.factoryId),
  index("idx_scan_batches_created_at").on(table.createdAt),
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 20 }).notNull().unique(),
  factoryId: varchar("factory_id").notNull(),
  invoiceDate: timestamp("invoice_date").notNull().defaultNow(),
  dueDate: timestamp("due_date").notNull(),
  customerName: text("customer_name").notNull(),
  customerAddress: text("customer_address"),
  deliveryAddress: text("delivery_address"),
  subtotal: integer("subtotal").notNull().default(0),
  taxRate: varchar("tax_rate", { length: 10 }).notNull().default("13.5"),
  taxAmount: integer("tax_amount").notNull().default(0),
  total: integer("total").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_invoices_factory_id").on(table.factoryId),
]);

// Invoice line items
export const invoiceLines = pgTable("invoice_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  batchId: varchar("batch_id"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull().default(80),
  amount: integer("amount").notNull(),
}, (table) => [
  index("idx_invoice_lines_invoice_id").on(table.invoiceId),
]);

// Relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  factory: one(factories, {
    fields: [invoices.factoryId],
    references: [factories.id],
  }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
  batch: one(scanBatches, {
    fields: [invoiceLines.batchId],
    references: [scanBatches.id],
  }),
}));

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

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceLineSchema = createInsertSchema(invoiceLines).omit({
  id: true,
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

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type InsertInvoiceLine = z.infer<typeof insertInvoiceLineSchema>;

export type BulkGarmentInput = z.infer<typeof bulkGarmentSchema>;

export type FactoryLoginInput = z.infer<typeof factoryLoginSchema>;
export type CreateFactoryWithCredentials = z.infer<typeof createFactoryWithCredentialsSchema>;
