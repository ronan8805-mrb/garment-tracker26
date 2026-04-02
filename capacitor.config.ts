import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mrbubblesexpress.laundrytrack",
  appName: "LaundryTrack",
  webDir: "dist/public",
  server: {
    url: "https://garment-tracker26-production.up.railway.app",
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
