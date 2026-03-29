# LaundryTrack Deployment Guide

## Architecture Overview

```
Railway (Cloud)
├── Express API Server (Node.js)
└── PostgreSQL Database

Factory Floor
├── Android Tablets (APK via Capacitor)
└── Bluetooth Barcode Scanners (HID keyboard mode)

Office
└── Windows PCs (EXE via Electron)
```

All apps connect to the same Railway backend over HTTPS + WebSocket.

---

## Step 1: Deploy Backend to Railway

### Prerequisites
- GitHub account (free)
- Railway account (https://railway.app — $5/mo Hobby plan)

### Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/garment-tracker.git
git push -u origin main
```

### Create Railway Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your `garment-tracker` repository
4. Railway will auto-detect Node.js

### Add PostgreSQL

1. In your Railway project, click "New" → "Database" → "Add PostgreSQL"
2. Railway auto-creates `DATABASE_URL` and links it to your service

### Set Environment Variables

In Railway → your Node.js service → Variables tab, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | (auto-linked from PostgreSQL) |
| `SESSION_SECRET` | (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `ADMIN_USERNAME` | your admin username |
| `ADMIN_PASSWORD` | your admin password |
| `NODE_ENV` | `production` |

### Create Database Tables

1. Go to Railway → your PostgreSQL service → "Data" tab → "Query"
2. Or use Railway CLI: `railway run npm run db:push`

### Verify

- Your app will be live at `https://YOUR_APP.up.railway.app`
- Railway provides free HTTPS/TLS
- Test login at `https://YOUR_APP.up.railway.app`

---

## Step 2: Build Android APK

### Prerequisites
- Android Studio (free download from https://developer.android.com/studio)
- Java JDK 17+ (bundled with Android Studio)

### Configure Production URL

Edit `capacitor.config.ts` and uncomment the production URL:

```typescript
server: {
  url: "https://YOUR_APP.up.railway.app",
  cleartext: false,
  androidScheme: "https",
},
```

### Build

```bash
npm run build
npx cap sync android
```

### Open in Android Studio

```bash
npx cap open android
```

Or manually open the `android/` folder in Android Studio.

### Generate APK

1. In Android Studio: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for build to complete
3. APK is at: `android/app/build/outputs/apk/debug/app-debug.apk`

For a signed release APK:
1. **Build** → **Generate Signed Bundle / APK**
2. Create a keystore (first time only)
3. Select APK, then Release
4. Output: `android/app/build/outputs/apk/release/app-release.apk`

### Install on Tablets

1. Transfer APK to tablet via USB cable, email, or file share
2. On the tablet, go to **Settings** → **Security** → Enable **Install from unknown sources**
3. Tap the APK file to install
4. The app appears as "LaundryTrack" in the app drawer

### Bluetooth Scanner Setup

1. Put your Netum CS7501 (or similar) scanner in **HID Keyboard mode**
2. Pair it via tablet's Bluetooth settings
3. Open LaundryTrack app → Scan page
4. Scan any barcode — it types into the input field and auto-submits

---

## Step 3: Build Windows EXE

### Prerequisites
- Node.js 20+ installed on Windows

### Configure Production URL

Edit `electron/main.js` and set your Railway URL:

```javascript
const PRODUCTION_URL = "https://YOUR_APP.up.railway.app";
```

### Build

```bash
cd electron
npm install
npm run build
```

### Output

The installer is at: `electron/dist/LaundryTrack Setup.exe`

### Install on Office PCs

1. Copy `LaundryTrack Setup.exe` to the PC
2. Double-click to install (standard Windows installer)
3. Desktop shortcut "LaundryTrack" is created
4. Open LaundryTrack — it shows the full app connected to Railway

### Bluetooth Scanner Setup (Windows)

1. Put your Netum CS7501 (or similar) scanner in **HID Keyboard mode**
2. Open Windows **Settings** → **Bluetooth & devices** → **Add device** → pair the scanner
3. Open LaundryTrack desktop app → Scan page
4. Scan any barcode — the scanner types into the input field and auto-submits on Enter
5. Works exactly the same as on the Android tablets — HID scanners act as a keyboard

---

## Updating the App

### Backend Updates

1. Make code changes locally
2. `git add . && git commit -m "description" && git push`
3. Railway auto-deploys on push (zero-downtime)

### Android App Updates

1. Make code changes
2. `npm run build && npx cap sync android`
3. Build new APK in Android Studio
4. Transfer and install on tablets (overwrites the old version)

### Windows App Updates

1. Make code changes
2. Update `electron/main.js` if needed
3. `cd electron && npm run build`
4. Re-install the new EXE on office PCs

---

## Backup Strategy

### Automatic (Railway)

Railway PostgreSQL includes automatic daily backups on the Hobby plan.

### Manual Backup

Run from Railway CLI or any machine with access:

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
psql $DATABASE_URL < backup_20260329.sql
```

---

## Offline Mode

- The scan page works without internet
- Scans are queued locally in IndexedDB
- A "Queued" badge shows how many scans are waiting
- When internet returns, scans auto-sync to the server
- Each scan has a unique client ID to prevent duplicates

---

## Security Checklist

- [x] HTTPS/TLS enforced (Railway provides this)
- [x] Passwords stored as bcrypt hashes
- [x] Session cookies: httpOnly, secure, sameSite
- [x] Admin credentials in environment variables (not in code)
- [x] Rate limiting on login endpoint (20 attempts per 15 min)
- [x] Helmet security headers
- [x] passwordHash never returned in API responses
- [x] Factory users can only see their own data
- [x] CORS configured for production
- [x] Offline data syncs securely with idempotent scan IDs

---

## Troubleshooting

### "Cannot connect" on Android/Windows app
- Check internet connection
- Verify Railway service is running (check Railway dashboard)
- Check the production URL is correct in `capacitor.config.ts` / `electron/main.js`

### "Invalid username or password"
- Verify ADMIN_USERNAME and ADMIN_PASSWORD are set in Railway env vars
- For factory accounts: check the account was created after DB migration

### Data not persisting
- Ensure DATABASE_URL is set in Railway environment variables
- Run `railway run npm run db:push` to create tables

### Scans not syncing from offline
- Check the "Queued" badge count on the scan page
- Verify internet connection
- Scans auto-retry every 10 seconds when online
