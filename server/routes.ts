import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertFactorySchema, bulkGarmentSchema, insertScanEventSchema, insertScanBatchSchema, createFactoryWithCredentialsSchema, factoryLoginSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import JsBarcode from "jsbarcode";
import { createCanvas } from "canvas";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Helper middleware to check if user is admin (via Replit Auth)
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.user?.claims?.sub) {
      return res.status(401).json({ message: "Admin authentication required" });
    }
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (profile?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Combined auth middleware: allows either Replit Auth (admin) or factory session
  const isAuthenticatedOrFactory = async (req: any, res: any, next: any) => {
    const session = req.session as any;
    
    // Check factory session first
    if (session?.isFactoryUser && session?.factoryId) {
      req.isFactorySession = true;
      req.factoryId = session.factoryId;
      req.factoryName = session.factoryName;
      return next();
    }
    
    // Fall back to Replit Auth
    if (req.user?.claims?.sub) {
      req.isFactorySession = false;
      return next();
    }
    
    return res.status(401).json({ message: "Authentication required" });
  };

  // Factory-only middleware (for factory session users)
  const requireFactorySession = (req: any, res: any, next: any) => {
    const session = req.session as any;
    if (session?.isFactoryUser && session?.factoryId) {
      req.factoryId = session.factoryId;
      req.factoryName = session.factoryName;
      return next();
    }
    return res.status(401).json({ message: "Factory authentication required" });
  };

  // Factory login endpoint (username/password authentication)
  app.post("/api/factory/login", async (req, res) => {
    try {
      const validatedData = factoryLoginSchema.parse(req.body);
      
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

  // Factory logout endpoint
  app.post("/api/factory/logout", (req, res) => {
    (req.session as any).factoryId = undefined;
    (req.session as any).factoryName = undefined;
    (req.session as any).isFactoryUser = false;
    res.json({ success: true });
  });

  // Get current factory session
  app.get("/api/factory/session", (req, res) => {
    const session = req.session as any;
    if (session?.isFactoryUser && session?.factoryId) {
      res.json({
        isLoggedIn: true,
        factoryId: session.factoryId,
        factoryName: session.factoryName,
      });
    } else {
      res.json({ isLoggedIn: false });
    }
  });

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

  app.get("/api/dashboard/factory", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | null = null;
      
      // Factory session login (username/password)
      if (req.isFactorySession) {
        factoryId = req.factoryId;
      } else {
        // Replit Auth login - check user profile
        const userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        factoryId = profile?.factoryId || null;
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
      if (req.isFactorySession) {
        // Factory session login - only see their own factory
        const factory = await storage.getFactory(req.factoryId);
        res.json(factory ? [factory] : []);
      } else {
        // Replit Auth login
        const userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        
        if (profile?.role === "admin") {
          const factories = await storage.getFactories();
          res.json(factories);
        } else if (profile?.factoryId) {
          const factory = await storage.getFactory(profile.factoryId);
          res.json(factory ? [factory] : []);
        } else {
          res.json([]);
        }
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
      
      // Factory session users can only see their own factory
      if (req.isFactorySession && factory.id !== req.factoryId) {
        return res.status(403).json({ message: "Access denied" });
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
      
      // Return factory with the original password (so admin can share it)
      res.status(201).json({
        ...factory,
        password: validatedData.password, // Include password for admin to share
      });
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
  app.get("/api/garments", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | undefined;
      
      if (req.isFactorySession) {
        // Factory session login - only see their own garments
        factoryId = req.factoryId;
      } else {
        // Replit Auth login
        const userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        // Factory users can only see their own garments, admins can filter by factory
        factoryId = profile?.role === "factory" ? profile.factoryId || undefined : (req.query.factory as string | undefined);
      }
      
      const garments = await storage.getGarments(factoryId);
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
  app.post("/api/scan", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      const { garmentId, location, direction } = req.body;

      if (!garmentId || !location || !direction) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Find the garment by its garment ID (the QR code value)
      const garment = await storage.getGarmentByGarmentId(garmentId);
      if (!garment) {
        return res.status(404).json({ message: "Unknown garment: " + garmentId });
      }

      let userId: string;
      let userFactoryId: string | null = null;
      
      if (req.isFactorySession) {
        // Factory session login
        userId = `factory:${req.factoryId}`;
        userFactoryId = req.factoryId;
      } else {
        // Replit Auth login
        userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        if (profile?.role === "factory") {
          userFactoryId = profile.factoryId;
        }
      }

      // Validate factory access for factory users
      if (userFactoryId && garment.factoryId !== userFactoryId) {
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
  app.get("/api/batches", isAuthenticatedOrFactory, async (req: any, res) => {
    try {
      let factoryId: string | undefined;
      
      if (req.isFactorySession) {
        // Factory session login - only see their own batches
        factoryId = req.factoryId;
      } else {
        // Replit Auth login
        const userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        factoryId = profile?.role === "factory" ? profile.factoryId || undefined : undefined;
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
      
      if (req.isFactorySession) {
        // Factory session login
        userId = `factory:${req.factoryId}`;
        userFactoryId = req.factoryId;
      } else {
        // Replit Auth login
        userId = req.user.claims.sub;
        const profile = await storage.getUserProfile(userId);
        if (profile?.role === "factory") {
          userFactoryId = profile.factoryId;
        }
      }

      // Validate factory access for factory users
      if (userFactoryId && factoryId !== userFactoryId) {
        return res.status(403).json({ message: "Cannot create batch for another factory" });
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
