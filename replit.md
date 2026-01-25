# LaundryTrack - Industrial Garment Tracking System

## Overview
LaundryTrack is a barcode-driven track-and-trace web application for industrial laundries managing garments for multiple factories. The system uses scan-based tracking where garments are only considered at a location when they are scanned IN.

## Core Principles
- **Scan-driven only**: No manual status editing
- **No "in transit" status**: A garment is only somewhere when scanned IN
- **Two locations only**: At Factory or At Laundry
- **Immutable scan log**: The scan event log is the single source of truth

## User Roles

### Laundrette Admin (Full Control)
- See all factories and garments
- See all scan events
- Generate barcodes
- Download batch reports
- Create and manage factory accounts

### Factory User (Limited Access)
- Scan garments OUT of factory (sending to laundry)
- Scan garments IN to factory (receiving from laundry)
- View their own garments (read-only)
- Cannot see other factories or generate barcodes

## Tech Stack
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OIDC)
- **Routing**: wouter (frontend), Express Router (backend)
- **State Management**: TanStack Query

## Project Structure
```
├── client/src/
│   ├── components/       # UI components
│   │   ├── ui/          # shadcn components
│   │   ├── app-sidebar.tsx
│   │   ├── theme-provider.tsx
│   │   └── theme-toggle.tsx
│   ├── pages/           # Route pages
│   │   ├── landing.tsx
│   │   ├── admin-dashboard.tsx
│   │   ├── factory-dashboard.tsx
│   │   ├── factories.tsx
│   │   ├── garments.tsx
│   │   ├── scan.tsx
│   │   └── reports.tsx
│   ├── hooks/           # Custom hooks
│   └── lib/             # Utilities
├── server/
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database operations
│   ├── db.ts           # Database connection
│   └── replit_integrations/  # Replit Auth
├── shared/
│   ├── schema.ts        # Drizzle schema
│   └── models/          # Auth models
```

## Key Features

### Factory Management
- Create, edit, and deactivate factories
- Each factory has a unique code (e.g., "HF" for Honey Factory)
- Admin-only access

### Garment Creation with Barcodes
- Bulk create garments by type, size, and quantity
- Auto-generated garment IDs (format: FACTORY-TYPE-SIZE-NUMBER)
- Download barcode sheets for printing and labeling

### Scanning Interface
- Auto-focused input for barcode scanner compatibility
- Batch scanning mode with live counter
- Duplicate detection
- Direction selection (IN/OUT)
- Location selection (Factory/Laundry for admins)

### Reports
- View all scan batches
- Download batch reports
- Download barcode sheets per factory

## API Endpoints

### Authentication
- `GET /api/login` - Initiate Replit Auth login
- `GET /api/logout` - Logout user
- `GET /api/auth/user` - Get authenticated user

### User Profile
- `GET /api/user/profile` - Get user profile with role

### Dashboard
- `GET /api/dashboard/admin` - Admin dashboard stats
- `GET /api/dashboard/factory` - Factory dashboard stats

### Factories
- `GET /api/factories` - List factories (filtered by role)
- `GET /api/factories/:id` - Get factory details
- `POST /api/factories` - Create factory (admin only)
- `PATCH /api/factories/:id` - Update factory (admin only)

### Garments
- `GET /api/garments` - List garments (filtered by role)
- `POST /api/garments/bulk` - Bulk create garments (admin only)

### Scanning
- `POST /api/scan` - Record a single scan event
- `GET /api/batches` - List scan batches
- `POST /api/batches` - Create and complete a batch

### Reports
- `GET /api/batches/:id/report` - Download batch report
- `GET /api/factories/:id/qr-codes` - Download barcode sheet

## Database Schema

### Tables
- `users` - Replit Auth users
- `sessions` - Session storage
- `user_profiles` - App-specific user data (role, factory assignment)
- `factories` - Factory profiles
- `garments` - Individual garment records
- `scan_events` - Immutable scan log
- `scan_batches` - Grouped scan operations

## Development

### Running the app
```bash
npm run dev
```

### Database migrations
```bash
npm run db:push
```

## Role-Based Access Control
- First user to sign in becomes admin
- Subsequent users are assigned factory role
- Admins can view/manage all factories and garments
- Factory users can only see their assigned factory's garments
- Scanning validates factory ownership for factory users
