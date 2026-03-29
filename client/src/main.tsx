import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { startAutoSync } from "./lib/offline-queue";

createRoot(document.getElementById("root")!).render(<App />);

startAutoSync();

if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  navigator.serviceWorker.register("/sw.js");
}
