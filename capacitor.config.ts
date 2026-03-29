import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mrbubblesexpress.laundrytrack",
  appName: "LaundryTrack",
  webDir: "dist/public",
  server: {
    // In production, point to your Railway URL:
    // url: "https://garment-tracker.up.railway.app",
    // For local development, use the local server:
    // url: "http://192.168.1.100:5000",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: "#1a56db",
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
    },
  },
};

export default config;
