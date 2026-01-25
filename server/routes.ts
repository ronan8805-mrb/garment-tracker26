import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertFactorySchema, bulkGarmentSchema, insertScanEventSchema, insertScanBatchSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper middleware to check if user is admin
  const requireAdmin = async (req: any, res: any, next: any) => {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (profile?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // User profile routes
  app.get("/api/user/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let profile = await storage.getUserProfile(userId);
      
      // For MVP: Create default admin profile only if no profiles exist in system (first user)
      // This makes the first user the admin, subsequent users need to be assigned roles
      if (!profile) {
        const allProfiles = await storage.getAllUserProfiles();
        const isFirstUser = allProfiles.length === 0;
        
        profile = await storage.createUserProfile({
          userId,
          role: isFirstUser ? "admin" : "factory",
          factoryId: null,
        });
      }
      
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const stats = await storage.getAdminDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/dashboard/factory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile?.factoryId) {
        return res.status(400).json({ message: "No factory assigned" });
      }
      
      const stats = await storage.getFactoryDashboardStats(profile.factoryId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching factory dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Factory routes - admin only for listing all, factory users can only see their assigned factory
  app.get("/api/factories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role === "admin") {
        const factories = await storage.getFactories();
        res.json(factories);
      } else if (profile?.factoryId) {
        // Factory users can only see their own factory
        const factory = await storage.getFactory(profile.factoryId);
        res.json(factory ? [factory] : []);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching factories:", error);
      res.status(500).json({ message: "Failed to fetch factories" });
    }
  });

  app.get("/api/factories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const factory = await storage.getFactory(req.params.id as string);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }
      res.json(factory);
    } catch (error) {
      console.error("Error fetching factory:", error);
      res.status(500).json({ message: "Failed to fetch factory" });
    }
  });

  app.post("/api/factories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role !== "admin") {
        return res.status(403).json({ message: "Only admins can create factories" });
      }

      const validatedData = insertFactorySchema.parse(req.body);
      
      // Check if code already exists
      const existing = await storage.getFactoryByCode(validatedData.code);
      if (existing) {
        return res.status(400).json({ message: "Factory code already exists" });
      }
      
      const factory = await storage.createFactory(validatedData);
      res.status(201).json(factory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating factory:", error);
      res.status(500).json({ message: "Failed to create factory" });
    }
  });

  app.patch("/api/factories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role !== "admin") {
        return res.status(403).json({ message: "Only admins can update factories" });
      }

      const factory = await storage.updateFactory(req.params.id, req.body);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }
      res.json(factory);
    } catch (error) {
      console.error("Error updating factory:", error);
      res.status(500).json({ message: "Failed to update factory" });
    }
  });

  // Garment routes
  app.get("/api/garments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      // Factory users can only see their own garments
      const factoryId = profile?.role === "factory" ? profile.factoryId : (req.query.factory as string | undefined);
      
      const garments = await storage.getGarments(factoryId || undefined);
      res.json(garments);
    } catch (error) {
      console.error("Error fetching garments:", error);
      res.status(500).json({ message: "Failed to fetch garments" });
    }
  });

  app.post("/api/garments/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role !== "admin") {
        return res.status(403).json({ message: "Only admins can create garments" });
      }

      const validatedData = bulkGarmentSchema.parse(req.body);
      
      // Get factory for code prefix
      const factory = await storage.getFactory(validatedData.factoryId);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }

      // Generate garment IDs and create records
      const garmentsToCreate = [];
      let counter = Date.now() % 1000000; // Use timestamp as base for unique IDs
      
      for (const item of validatedData.garments) {
        // Get type abbreviation (first 2 letters uppercase)
        const typeAbbrev = item.garmentType.replace(/\s+/g, "").substring(0, 2).toUpperCase();
        
        for (let i = 0; i < item.quantity; i++) {
          const garmentId = `${factory.code}-${typeAbbrev}-${item.size}-${String(counter++).padStart(6, "0")}`;
          garmentsToCreate.push({
            garmentId,
            factoryId: validatedData.factoryId,
            garmentType: item.garmentType,
            size: item.size,
            status: "at_factory" as const,
          });
        }
      }

      const created = await storage.createGarments(garmentsToCreate);
      
      res.status(201).json({
        count: created.length,
        factoryId: validatedData.factoryId,
        factoryCode: factory.code,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating garments:", error);
      res.status(500).json({ message: "Failed to create garments" });
    }
  });

  // Scan routes
  app.post("/api/scan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { garmentId, location, direction, factoryId } = req.body;

      if (!garmentId || !location || !direction) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find the garment by its garment ID (the QR code value)
      const garment = await storage.getGarmentByGarmentId(garmentId);
      if (!garment) {
        return res.status(404).json({ message: "Unknown garment: " + garmentId });
      }

      // Validate factory access for factory users
      const profile = await storage.getUserProfile(userId);
      if (profile?.role === "factory" && garment.factoryId !== profile.factoryId) {
        return res.status(403).json({ message: "This garment belongs to another factory" });
      }

      // Create scan event
      const scanEvent = await storage.createScanEvent({
        garmentId: garment.id,
        location,
        direction,
        userId,
        batchId: null,
      });

      // Update garment status only for IN scans
      if (direction === "IN") {
        const newStatus = location === "factory" ? "at_factory" : "at_laundry";
        await storage.updateGarmentStatus(garment.id, newStatus);
      }

      res.json({
        garmentId,
        garment,
        scanEvent,
      });
    } catch (error) {
      console.error("Error processing scan:", error);
      res.status(500).json({ message: "Failed to process scan" });
    }
  });

  // Batch routes
  app.get("/api/batches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      const factoryId = profile?.role === "factory" ? profile.factoryId : undefined;
      const batches = await storage.getBatches(factoryId || undefined);
      res.json(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: "Failed to fetch batches" });
    }
  });

  app.post("/api/batches", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { location, direction, factoryId, garmentIds, generateReport } = req.body;

      if (!location || !direction || !factoryId || !garmentIds?.length) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate batch number
      const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Create the batch
      const batch = await storage.createBatch({
        batchNumber,
        factoryId,
        location,
        direction,
        userId,
        totalItems: garmentIds.length,
      });

      // Create scan events for all garments in the batch
      for (const garmentId of garmentIds) {
        const garment = await storage.getGarmentByGarmentId(garmentId);
        if (garment) {
          await storage.createScanEvent({
            garmentId: garment.id,
            location,
            direction,
            userId,
            batchId: batch.id,
          });

          // Update status for IN scans
          if (direction === "IN") {
            const newStatus = location === "factory" ? "at_factory" : "at_laundry";
            await storage.updateGarmentStatus(garment.id, newStatus);
          }
        }
      }

      // Complete the batch
      const completedBatch = await storage.completeBatch(batch.id, garmentIds.length);

      res.status(201).json({
        batchId: batch.id,
        batchNumber,
        totalItems: garmentIds.length,
        reportUrl: generateReport ? `/api/batches/${batch.id}/report` : null,
      });
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: "Failed to create batch" });
    }
  });

  // PDF Report routes (placeholder - returns simple text for now)
  app.get("/api/batches/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const batch = await storage.getBatch(req.params.id as string);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      const factory = await storage.getFactory(batch.factoryId);

      // Return a simple text report for MVP
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="${batch.batchNumber}.txt"`);
      
      const report = `
BATCH REPORT
============

Batch Number: ${batch.batchNumber}
Factory: ${factory?.name || "Unknown"} (${factory?.code || "N/A"})
Location: ${batch.location}
Direction: ${batch.direction}
Total Items: ${batch.totalItems}
Date: ${batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "Unknown"}
Completed: ${batch.completedAt ? new Date(batch.completedAt).toLocaleString() : "Pending"}

---
Generated by LaundryTrack
      `.trim();

      res.send(report);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/factories/:id/qr-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (profile?.role !== "admin") {
        return res.status(403).json({ message: "Only admins can download QR codes" });
      }

      const factory = await storage.getFactory(req.params.id);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }

      const garments = await storage.getGarments(req.params.id);

      // Return a simple text list of garment IDs for MVP
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", `attachment; filename="${factory.code}_QR_Codes_${garments.length}_Garments.txt"`);
      
      const qrList = `
QR CODE LIST
============

Factory: ${factory.name} (${factory.code})
Total Garments: ${garments.length}
Generated: ${new Date().toLocaleString()}

Garment IDs (for QR Code generation):
=====================================

${garments.map((g) => g.garmentId).join("\n")}

---
Use these IDs to generate QR codes with any QR code generator tool.
Recommended: QR code containing only the Garment ID string.
      `.trim();

      res.send(qrList);
    } catch (error) {
      console.error("Error generating QR list:", error);
      res.status(500).json({ message: "Failed to generate QR list" });
    }
  });

  return httpServer;
}
