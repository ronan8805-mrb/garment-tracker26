import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertFactorySchema, bulkGarmentSchema, insertScanEventSchema, insertScanBatchSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";

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

  // PDF Report routes
  app.get("/api/batches/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const batch = await storage.getBatch(req.params.id as string);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }

      const factory = await storage.getFactory(batch.factoryId);

      // Create PDF document
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${batch.batchNumber}.pdf"`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("Mr Bubbles Express", { align: "center" });
      doc.fontSize(10).font("Helvetica").text("Laundry & Linen Specialist", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#666").text("ISO 9001 & ISO 45001 Certified | Drogheda, Co. Louth", { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(2);

      // Title
      doc.fontSize(18).font("Helvetica-Bold").text("BATCH REPORT", { align: "center" });
      doc.moveDown(1);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Batch details
      doc.fontSize(12).font("Helvetica-Bold").text("Batch Details");
      doc.moveDown(0.5);
      
      doc.fontSize(11).font("Helvetica");
      doc.text(`Batch Number: `, { continued: true }).font("Helvetica-Bold").text(batch.batchNumber);
      doc.font("Helvetica").text(`Factory: `, { continued: true }).font("Helvetica-Bold").text(`${factory?.name || "Unknown"} (${factory?.code || "N/A"})`);
      doc.font("Helvetica").text(`Location: `, { continued: true }).font("Helvetica-Bold").text(batch.location);
      doc.font("Helvetica").text(`Direction: `, { continued: true }).font("Helvetica-Bold").text(batch.direction);
      doc.font("Helvetica").text(`Total Items: `, { continued: true }).font("Helvetica-Bold").text(String(batch.totalItems || 0));
      doc.moveDown(0.5);
      doc.font("Helvetica").text(`Created: `, { continued: true }).text(batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "Unknown");
      doc.text(`Completed: `, { continued: true }).text(batch.completedAt ? new Date(batch.completedAt).toLocaleString() : "Pending");
      
      doc.moveDown(2);

      // Footer
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#666").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.text("Mr Bubbles Express | 086 270 9299 | info@mrbubblesexpress.com", { align: "center" });

      doc.end();
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

      // Create PDF document
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${factory.code}_QR_Codes_${garments.length}_Garments.pdf"`);
      
      doc.pipe(res);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("Mr Bubbles Express", { align: "center" });
      doc.fontSize(10).font("Helvetica").text("Laundry & Linen Specialist", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#666").text("ISO 9001 & ISO 45001 Certified | Drogheda, Co. Louth", { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(2);

      // Title
      doc.fontSize(18).font("Helvetica-Bold").text("QR CODE LIST", { align: "center" });
      doc.moveDown(1);

      // Horizontal line
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Factory details
      doc.fontSize(12).font("Helvetica-Bold").text("Factory Details");
      doc.moveDown(0.5);
      
      doc.fontSize(11).font("Helvetica");
      doc.text(`Factory: `, { continued: true }).font("Helvetica-Bold").text(`${factory.name} (${factory.code})`);
      doc.font("Helvetica").text(`Total Garments: `, { continued: true }).font("Helvetica-Bold").text(String(garments.length));
      doc.font("Helvetica").text(`Generated: `, { continued: true }).text(new Date().toLocaleString());
      
      doc.moveDown(1.5);

      // Garment IDs section
      doc.fontSize(12).font("Helvetica-Bold").text("Garment IDs for QR Code Generation");
      doc.moveDown(0.5);
      doc.fontSize(9).font("Helvetica").fillColor("#666").text("Use these IDs to generate QR codes with any QR code generator tool.");
      doc.fillColor("#000");
      doc.moveDown(1);

      // Create a table-like layout for garment IDs (3 columns)
      const columns = 3;
      const columnWidth = 165;
      const startX = 50;
      let currentY = doc.y;
      
      doc.fontSize(9).font("Helvetica");
      
      garments.forEach((garment, index) => {
        const col = index % columns;
        const x = startX + (col * columnWidth);
        
        if (col === 0 && index > 0) {
          currentY += 14;
        }
        
        // Check if we need a new page
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }
        
        doc.text(garment.garmentId, x, currentY, { width: columnWidth - 10 });
      });
      
      doc.moveDown(2);

      // Footer on last page
      const footerY = doc.page.height - 80;
      doc.moveTo(50, footerY).lineTo(545, footerY).stroke();
      doc.fontSize(9).fillColor("#666").text(`Total: ${garments.length} garments`, 50, footerY + 10, { align: "center" });
      doc.text("Mr Bubbles Express | 086 270 9299 | info@mrbubblesexpress.com", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating QR list:", error);
      res.status(500).json({ message: "Failed to generate QR list" });
    }
  });

  return httpServer;
}
