import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { log } from "./index";

export type BroadcastFn = (event: string, data?: any) => void;

export function setupWebSocket(httpServer: Server): BroadcastFn {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    log("WebSocket client connected", "ws");

    ws.on("close", () => {
      log("WebSocket client disconnected", "ws");
    });

    ws.on("error", (err) => {
      log(`WebSocket error: ${err.message}`, "ws");
    });
  });

  const broadcast: BroadcastFn = (event: string, data?: any) => {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  return broadcast;
}
