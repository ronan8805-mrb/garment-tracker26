import type { Express } from "express";
import { type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { bulkGarmentSchema, createFactoryWithCredentialsSchema, factoryLoginSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import JsBarcode from "jsbarcode";
import { createCanvas } from "canvas";
import bcrypt from "bcryptjs";
import type { BroadcastFn } from "./websocket";

function stripPasswordHash(obj: any) {
  if (!obj) return obj;
  const { passwordHash, ...rest } = obj;
  return rest;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  broadcast: BroadcastFn
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many login attempts, try again later" },
  });

  const isAuthenticatedOrFactory = async (req: any, res: any, next: any) => {
    const session = req.session as any;
    
    if (session?.isAdmin) {
      req.isFactorySession = false;
      req.isAdminSession = true;
      return next();
    }
    
    if (session?.isFactoryUser && session?.factoryId) {
      req.isFactorySession = true;
      req.isAdminSession = false;
      req.factoryId = session.factoryId;
      req.factoryName = session.factoryName;
      return next();
    }
    
    return res.status(401).json({ message: "Authentication required" });
  };

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_USERNAME and ADMIN_PASSWORD must be set via environment variables");
  }

  app.post("/api/factory/login", loginLimiter, async (req, res) => {
    try {
      const validatedData = factoryLoginSchema.parse(req.body);
      
      // Check for admin login first
      if (validatedData.username === ADMIN_USERNAME && validatedData.password === ADMIN_PASSWORD) {
        // Store admin session
        (req.session as any).isAdmin = true;
        (req.session as any).isFactoryUser = false;
        (req.session as any).factoryId = null;
        (req.session as any).factoryName = null;
        
        return res.json({
          success: true,
          isAdmin: true,
        });
      }
      
      // Check for factory login
      const factory = await storage.getFactoryByUsername(validatedData.username);
      if (!factory || !factory.passwordHash) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      const isValidPassword = await bcrypt.compare(validatedData.password, factory.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      if (!factory.isActive) {
        return res.status(403).json({ message: "This factory account is deactivated" });
      }
      
      // Store factory session
      (req.session as any).factoryId = factory.id;
      (req.session as any).factoryName = factory.name;
      (req.session as any).isFactoryUser = true;
      (req.session as any).isAdmin = false;
      
      res.json({
        success: true,
        factory: {
          id: factory.id,
          name: factory.name,
          code: factory.code,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Factory login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Session logout endpoint (for both admin and factory)
  app.post("/api/factory/logout", (req, res) => {
    (req.session as any).factoryId = undefined;
    (req.session as any).factoryName = undefined;
    (req.session as any).isFactoryUser = false;
    (req.session as any).isAdmin = false;
    res.json({ success: true });
  });

  // Get current session (admin or factory)
  app.get("/api/factory/session", (req, res) => {
    const session = req.session as any;
    
    // Check for admin session
    if (session?.isAdmin) {
      return res.json({
        isLoggedIn: true,
        isAdmin: true,
      });
    }
    
    // Check for factory session
    if (session?.isFactoryUser && session?.factoryId) {
      return res.json({
        isLoggedIn: true,
        isAdmin: false,
        factoryId: session.factoryId,
        factoryName: session.factoryName,
      });
    }
    
    res.json({ isLoggedIn: false });
  });

  // Dashboard routes
  app.get("/api/dashboard/admin", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (!req.isAdminSession) {
        return res.status(403).json({ message: "Access denied" });
      }
      const stats = await storage.getAdminDashboardStats();
      res.json({
        ...stats,
        recentFactories: stats.recentFactories.map(stripPasswordHash),
      });
    } catch (error) {
      console.error("Error fetching admin dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  app.get("/api/dashboard/factory", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | null = null;
      
      if (req.isFactorySession) {
        factoryId = req.factoryId;
      } else if (req.isAdminSession) {
        return res.status(400).json({ message: "Admins should use admin dashboard" });
      } else {
        return res.status(400).json({ message: "No factory assigned" });
      }
      
      if (!factoryId) {
        return res.status(400).json({ message: "No factory assigned" });
      }
      
      const stats = await storage.getFactoryDashboardStats(factoryId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching factory dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // Factory routes - admin only for listing all, factory users can only see their assigned factory
  app.get("/api/factories", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (req.isAdminSession) {
        const factories = await storage.getFactories();
        res.json(factories.map(stripPasswordHash));
      } else if (req.isFactorySession) {
        const factory = await storage.getFactory(req.factoryId);
        res.json(factory ? [stripPasswordHash(factory)] : []);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Error fetching factories:", error);
      res.status(500).json({ message: "Failed to fetch factories" });
    }
  });

  app.get("/api/factories/:id", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const factory = await storage.getFactory(req.params.id as string);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }
      
      if (req.isFactorySession && factory.id !== req.factoryId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(stripPasswordHash(factory));
    } catch (error) {
      console.error("Error fetching factory:", error);
      res.status(500).json({ message: "Failed to fetch factory" });
    }
  });

  app.post("/api/factories", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (!req.isAdminSession) {
        return res.status(403).json({ message: "Only admins can create factories" });
      }

      const validatedData = createFactoryWithCredentialsSchema.parse(req.body);
      
      // Check if code already exists
      const existingCode = await storage.getFactoryByCode(validatedData.code);
      if (existingCode) {
        return res.status(400).json({ message: "Factory code already exists" });
      }
      
      // Check if username already exists
      const existingUsername = await storage.getFactoryByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash the password
      const passwordHash = await bcrypt.hash(validatedData.password, 10);
      
      const factory = await storage.createFactoryWithPassword({
        name: validatedData.name,
        code: validatedData.code,
        location: validatedData.location,
        username: validatedData.username,
        passwordHash,
      });
      
      res.status(201).json({
        ...factory,
        passwordHash: undefined,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error creating factory:", error);
      res.status(500).json({ message: "Failed to create factory" });
    }
  });

  app.patch("/api/factories/:id", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (!req.isAdminSession) {
        return res.status(403).json({ message: "Only admins can update factories" });
      }

      const { password, ...otherData } = req.body;
      const updateData: any = { ...otherData };
      if (password && password.trim() !== "") {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const factory = await storage.updateFactory(req.params.id, updateData);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }
      res.json(stripPasswordHash(factory));
    } catch (error) {
      console.error("Error updating factory:", error);
      res.status(500).json({ message: "Failed to update factory" });
    }
  });

  // Garment routes
  app.get("/api/garments", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | undefined;
      
      if (req.isAdminSession) {
        factoryId = req.query.factory as string | undefined;
      } else if (req.isFactorySession) {
        factoryId = req.factoryId;
      }
      
      const garments = await storage.getGarments(factoryId);
      res.json(garments);
    } catch (error) {
      console.error("Error fetching garments:", error);
      res.status(500).json({ message: "Failed to fetch garments" });
    }
  });

  app.post("/api/garments/bulk", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (!req.isAdminSession) {
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
      const ts = new Date();
      const timestamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}`;
      let seq = 1;
      
      for (const item of validatedData.garments) {
        const typeAbbrev = item.garmentType.replace(/\s+/g, "").substring(0, 2).toUpperCase();
        
        for (let i = 0; i < item.quantity; i++) {
          const garmentId = `${factory.code}-${typeAbbrev}-${item.size}-${timestamp}-${String(seq++).padStart(3, "0")}`;
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
  app.post("/api/scan", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const { garmentId, location, direction, clientScanId } = req.body;

      if (!garmentId || !location || !direction) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (clientScanId) {
        const existing = await storage.getScanByClientId(clientScanId);
        if (existing) {
          return res.status(200).json({ garmentId, duplicate: true });
        }
      }

      const garment = await storage.getGarmentByGarmentId(garmentId);
      if (!garment) {
        return res.status(404).json({ message: "Unknown garment: " + garmentId });
      }

      let userId: string;
      let userFactoryId: string | null = null;
      
      if (req.isFactorySession) {
        userId = `factory:${req.factoryId}`;
        userFactoryId = req.factoryId;
      } else if (req.isAdminSession) {
        userId = "admin";
      } else {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate factory access for factory users
      if (userFactoryId && garment.factoryId !== userFactoryId) {
        return res.status(403).json({ message: "This garment belongs to another factory" });
      }

      const scanEvent = await storage.createScanEvent({
        garmentId: garment.id,
        location,
        direction,
        userId,
        batchId: null,
        clientScanId: clientScanId || null,
      });

      if (direction === "IN") {
        const newStatus = location === "factory" ? "at_factory" : "at_laundry";
        await storage.updateGarmentStatus(garment.id, newStatus);
      } else {
        // OUT at factory → heading to laundry; OUT at laundry → heading to factory
        const newStatus = location === "factory" ? "at_laundry" : "at_factory";
        await storage.updateGarmentStatus(garment.id, newStatus);
      }

      broadcast("scan", { garmentId, direction, location });

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
  app.get("/api/batches", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | undefined;
      
      if (req.isAdminSession) {
        factoryId = undefined;
      } else if (req.isFactorySession) {
        factoryId = req.factoryId;
      }
      
      const batches = await storage.getBatches(factoryId);
      res.json(batches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      res.status(500).json({ message: "Failed to fetch batches" });
    }
  });

  app.post("/api/batches", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const { location, direction, factoryId, garmentIds, generateReport } = req.body;

      if (!location || !direction || !factoryId || !garmentIds?.length) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      let userId: string;
      let userFactoryId: string | null = null;
      
      if (req.isAdminSession) {
        userId = "admin";
        userFactoryId = null;
      } else if (req.isFactorySession) {
        userId = `factory:${req.factoryId}`;
        userFactoryId = req.factoryId;
      } else {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Validate factory access for factory users
      if (userFactoryId && factoryId !== userFactoryId) {
        return res.status(403).json({ message: "Cannot create batch for another factory" });
      }

      const batchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const completedBatch = await storage.createBatchWithScans({
        batchData: {
          batchNumber,
          factoryId,
          location,
          direction,
          userId,
          totalItems: garmentIds.length,
        },
        garmentIds,
        location,
        direction,
        userId,
      });

      broadcast("batch_complete", { batchNumber, totalItems: completedBatch.totalItems, factoryId, direction });

      res.status(201).json({
        batchId: completedBatch.id,
        batchNumber,
        totalItems: completedBatch.totalItems,
        reportUrl: generateReport ? `/api/batches/${completedBatch.id}/report` : null,
      });
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ message: "Failed to create batch" });
    }
  });

  // PDF Report routes
  app.get("/api/batches/:id/report", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const batch = await storage.getBatch(req.params.id as string);
      if (!batch) {
        return res.status(404).json({ message: "Batch not found" });
      }
      
      // Validate factory access for factory users
      if (req.isFactorySession && batch.factoryId !== req.factoryId) {
        return res.status(403).json({ message: "Access denied to this batch" });
      }

      const factory = await storage.getFactory(batch.factoryId);
      const scanEventsData = await storage.getScanEventsByBatchId(batch.id);

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

      // Title - include direction
      const reportTitle = batch.direction === "IN" ? "SCAN IN REPORT" : "SCAN OUT REPORT";
      doc.fontSize(18).font("Helvetica-Bold").text(reportTitle, { align: "center" });
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
      doc.font("Helvetica").text(`Direction: `, { continued: true }).font("Helvetica-Bold").text(batch.direction === "IN" ? "Scan IN" : "Scan OUT");
      doc.font("Helvetica").text(`Total Items: `, { continued: true }).font("Helvetica-Bold").text(String(batch.totalItems || 0));
      doc.moveDown(0.5);
      doc.font("Helvetica").text(`Created: `, { continued: true }).text(batch.createdAt ? new Date(batch.createdAt).toLocaleString() : "Unknown");
      doc.text(`Completed: `, { continued: true }).text(batch.completedAt ? new Date(batch.completedAt).toLocaleString() : "Pending");
      
      doc.moveDown(1.5);

      if (scanEventsData.length > 0) {
        const seenGarments = new Set<string>();
        const duplicateGarments = new Set<string>();
        for (const ev of scanEventsData) {
          if (seenGarments.has(ev.garmentId)) {
            duplicateGarments.add(ev.garmentId);
          }
          seenGarments.add(ev.garmentId);
        }

        doc.fontSize(12).font("Helvetica-Bold").text("Scanned Items");
        if (duplicateGarments.size > 0) {
          doc.fontSize(10).fillColor("#cc0000").font("Helvetica-Bold")
            .text(`WARNING: ${duplicateGarments.size} duplicate garment(s) detected`, { align: "left" });
          doc.fillColor("#000");
        }
        doc.moveDown(0.5);
        
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 80;
        const col3 = 250;
        const col4 = 360;
        const col5 = 470;
        
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("#", col1, tableTop);
        doc.text("Garment ID", col2, tableTop);
        doc.text("Type / Size", col3, tableTop);
        doc.text("Scan Time", col4, tableTop);
        doc.text("Flag", col5, tableTop);
        
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);

        doc.font("Helvetica").fontSize(9);
        let rowY = doc.y;
        const lineHeight = 14;
        const seenInRows = new Set<string>();
        
        for (let i = 0; i < scanEventsData.length; i++) {
          const event = scanEventsData[i];
          
          if (rowY > doc.page.height - 100) {
            doc.addPage();
            rowY = 50;
          }
          
          const garment = await storage.getGarment(event.garmentId);
          const displayId = garment?.garmentId || event.garmentId;
          const typeSize = garment ? `${garment.garmentType} / ${garment.size}` : "-";
          const scanTime = event.scannedAt ? new Date(event.scannedAt).toLocaleString() : "-";
          const isDup = seenInRows.has(event.garmentId);
          seenInRows.add(event.garmentId);
          
          if (isDup) {
            doc.fillColor("#cc0000");
          }
          doc.text(String(i + 1), col1, rowY);
          doc.text(displayId, col2, rowY);
          doc.text(typeSize, col3, rowY);
          doc.text(scanTime, col4, rowY);
          if (isDup) {
            doc.font("Helvetica-Bold").text("DUPLICATE", col5, rowY);
            doc.font("Helvetica");
          }
          doc.fillColor("#000");
          
          rowY += lineHeight;
        }
        
        doc.y = rowY;
        doc.moveDown(1);
      }

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

  // Scan dates (grouped by day)
  app.get("/api/scan-dates", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | undefined;

      if (req.isAdminSession) {
        factoryId = req.query.factory as string | undefined;
      } else if (req.isFactorySession) {
        factoryId = req.factoryId;
      }

      const dates = await storage.getScanDates(factoryId);
      res.json(dates);
    } catch (error) {
      console.error("Error fetching scan dates:", error);
      res.status(500).json({ message: "Failed to fetch scan dates" });
    }
  });

  // PDF report for a specific date
  app.get("/api/scan-dates/:date/report", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const date = req.params.date as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      let factoryId: string | undefined;
      if (req.isAdminSession) {
        factoryId = req.query.factory as string | undefined;
      } else if (req.isFactorySession) {
        factoryId = req.factoryId;
      }

      const scanEventsData = await storage.getScanEventsByDate(date, factoryId);

      const factoryName = factoryId
        ? (await storage.getFactory(factoryId))?.name || "Unknown"
        : "All Factories";

      const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const doc = new PDFDocument({ size: "A4", margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Scan_Report_${date}.pdf"`
      );

      doc.pipe(res);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("Mr Bubbles Express", { align: "center" });
      doc.fontSize(10).font("Helvetica").text("Laundry & Linen Specialist", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor("#666").text("ISO 9001 & ISO 45001 Certified | Drogheda, Co. Louth", { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(2);

      doc.fontSize(18).font("Helvetica-Bold").text("DAILY SCAN REPORT", { align: "center" });
      doc.moveDown(1);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Report Details");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text("Date: ", { continued: true }).font("Helvetica-Bold").text(displayDate);
      doc.font("Helvetica").text("Factory: ", { continued: true }).font("Helvetica-Bold").text(factoryName);
      doc.font("Helvetica").text("Total Scans: ", { continued: true }).font("Helvetica-Bold").text(String(scanEventsData.length));
      doc.moveDown(1);

      // Count IN vs OUT
      const inCount = scanEventsData.filter((e) => e.direction === "IN").length;
      const outCount = scanEventsData.filter((e) => e.direction === "OUT").length;
      doc.font("Helvetica").text("Scanned IN: ", { continued: true }).font("Helvetica-Bold").text(String(inCount));
      doc.font("Helvetica").text("Scanned OUT: ", { continued: true }).font("Helvetica-Bold").text(String(outCount));
      doc.moveDown(1.5);

      if (scanEventsData.length > 0) {
        const seenGarments = new Set<string>();
        const duplicateGarments = new Set<string>();
        for (const ev of scanEventsData) {
          if (seenGarments.has(ev.garmentId)) {
            duplicateGarments.add(ev.garmentId);
          }
          seenGarments.add(ev.garmentId);
        }

        doc.fontSize(12).font("Helvetica-Bold").text("Scanned Items");
        if (duplicateGarments.size > 0) {
          doc.fontSize(10).fillColor("#cc0000").font("Helvetica-Bold")
            .text(`WARNING: ${duplicateGarments.size} duplicate garment(s) detected`, { align: "left" });
          doc.fillColor("#000");
        }
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 68;
        const col3 = 200;
        const col4 = 290;
        const col5 = 340;
        const col6 = 400;
        const col7 = 470;

        doc.fontSize(8).font("Helvetica-Bold");
        doc.text("#", col1, tableTop);
        doc.text("Garment ID", col2, tableTop);
        doc.text("Type / Size", col3, tableTop);
        doc.text("Dir", col4, tableTop);
        doc.text("Location", col5, tableTop);
        doc.text("Time", col6, tableTop);
        doc.text("Flag", col7, tableTop);

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.3);

        doc.font("Helvetica").fontSize(7);
        let rowY = doc.y;
        const lineHeight = 12;
        const seenInRows = new Set<string>();

        for (let i = 0; i < scanEventsData.length; i++) {
          const event = scanEventsData[i];

          if (rowY > doc.page.height - 80) {
            doc.addPage();
            rowY = 50;
          }

          const garment = await storage.getGarment(event.garmentId);
          const displayId = garment?.garmentId || event.garmentId;
          const typeSize = garment ? `${garment.garmentType} / ${garment.size}` : "-";
          const scanTime = event.scannedAt
            ? new Date(event.scannedAt).toLocaleTimeString()
            : "-";
          const isDup = seenInRows.has(event.garmentId);
          seenInRows.add(event.garmentId);

          if (isDup) {
            doc.fillColor("#cc0000");
          }
          doc.text(String(i + 1), col1, rowY);
          doc.text(displayId, col2, rowY);
          doc.text(typeSize, col3, rowY);
          doc.text(event.direction, col4, rowY);
          doc.text(event.location, col5, rowY);
          doc.text(scanTime, col6, rowY);
          if (isDup) {
            doc.font("Helvetica-Bold").text("DUPLICATE", col7, rowY);
            doc.font("Helvetica");
          }
          doc.fillColor("#000");

          rowY += lineHeight;
        }

        doc.y = rowY;
        doc.moveDown(1);
      } else {
        doc.fontSize(11).font("Helvetica").text("No scans recorded on this date.", { align: "center" });
        doc.moveDown(1);
      }

      // Footer
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#666").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.text("Mr Bubbles Express | 086 270 9299 | info@mrbubblesexpress.com", { align: "center" });

      doc.end();
    } catch (error) {
      console.error("Error generating date report:", error);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

  app.get("/api/factories/:id/qr-codes", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      if (!req.isAdminSession) {
        return res.status(403).json({ message: "Only admins can download QR codes" });
      }

      const factory = await storage.getFactory(req.params.id);
      if (!factory) {
        return res.status(404).json({ message: "Factory not found" });
      }

      const garments = await storage.getGarments(req.params.id);

      // Create PDF document
      const doc = new PDFDocument({ size: "A4", margin: 30 });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${factory.code}_Barcodes_${garments.length}_Garments.pdf"`);
      
      doc.pipe(res);

      // Generate barcodes for all garments - labels with factory, size, type info
      const barcodeWidth = 150;
      const barcodeHeight = 40;
      const labelPadding = 8;
      const labelHeight = barcodeHeight + 55; // Space for factory name, barcode, type/size
      const cellHeight = labelHeight + 10;
      const columns = 3;
      const startX = 30;
      const startY = 95;
      const columnWidth = 180;
      const pageHeight = doc.page.height;
      
      // Helper function to generate barcode as buffer
      const generateBarcodeBuffer = (text: string): Buffer => {
        const canvas = createCanvas(barcodeWidth * 2, barcodeHeight * 2);
        JsBarcode(canvas, text, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 2,
          background: "#ffffff",
          lineColor: "#000000"
        });
        return canvas.toBuffer("image/png");
      };
      
      // Add header function
      const addHeader = () => {
        doc.fontSize(16).font("Helvetica-Bold").text("Mr Bubbles Express", 30, 25, { align: "center" });
        doc.fontSize(8).font("Helvetica").text("Laundry & Linen Specialist | ISO 9001 & ISO 45001", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica-Bold").text(`${factory.name} (${factory.code}) - Barcodes`, { align: "center" });
        doc.moveTo(30, 75).lineTo(565, 75).stroke();
      };

      // Add footer function
      const addFooter = (pageNum: number, totalPages: number) => {
        doc.fontSize(7).fillColor("#666").text(
          `Page ${pageNum} of ${totalPages} | Generated: ${new Date().toLocaleString()} | Mr Bubbles Express | 086 270 9299`,
          30, pageHeight - 30, { align: "center", width: 535 }
        );
        doc.fillColor("#000");
      };

      // Calculate total pages needed
      const rowsPerPage = Math.floor((pageHeight - startY - 50) / cellHeight);
      const itemsPerPage = rowsPerPage * columns;
      const totalPages = Math.ceil(garments.length / itemsPerPage);
      
      addHeader();
      
      let currentPage = 1;
      let itemsOnCurrentPage = 0;
      let currentY = startY;

      for (let i = 0; i < garments.length; i++) {
        const garment = garments[i];
        const col = itemsOnCurrentPage % columns;
        const x = startX + (col * columnWidth);
        
        // Check if we need a new row
        if (col === 0 && itemsOnCurrentPage > 0) {
          currentY += cellHeight;
        }
        
        // Check if we need a new page
        if (currentY + cellHeight > pageHeight - 50) {
          addFooter(currentPage, totalPages);
          doc.addPage();
          currentPage++;
          addHeader();
          currentY = startY;
          itemsOnCurrentPage = 0;
        }
        
        // Draw label border
        const labelX = x + 5;
        const labelWidth = columnWidth - 10;
        doc.rect(labelX, currentY, labelWidth, labelHeight).stroke();
        
        // Factory name at top of label
        doc.fontSize(8).font("Helvetica-Bold").text(
          `${factory.name} (${factory.code})`,
          labelX,
          currentY + labelPadding,
          { width: labelWidth, align: "center" }
        );
        
        // Generate and add barcode
        const barcodeBuffer = generateBarcodeBuffer(garment.garmentId);
        doc.image(barcodeBuffer, labelX + (labelWidth - barcodeWidth) / 2, currentY + 18, { 
          width: barcodeWidth, 
          height: barcodeHeight 
        });
        
        // Garment type and size at bottom
        doc.fontSize(10).font("Helvetica-Bold").text(
          `${garment.garmentType.toUpperCase()} - SIZE: ${garment.size}`,
          labelX,
          currentY + labelHeight - 18,
          { width: labelWidth, align: "center" }
        );
        
        itemsOnCurrentPage++;
      }
      
      // Add footer on last page
      addFooter(currentPage, totalPages);

      doc.end();
    } catch (error) {
      console.error("Error generating barcode list:", error);
      res.status(500).json({ message: "Failed to generate barcode list" });
    }
  });

  return httpServer;
}
