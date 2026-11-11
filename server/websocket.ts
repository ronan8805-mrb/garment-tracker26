import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { log } from "./index";
import { getSession } from "./replit_integrations/auth";

/**
 * Send a live-update event. Admins receive every event; a factory login only
 * receives events for its own factory (pass that factory's id).
 */
export type BroadcastFn = (event: string, data?: any, factoryId?: string | null) => void;

interface ClientInfo {
  isAdmin: boolean;
  factoryId: string | null;
}

const clients = new WeakMap<WebSocket, ClientInfo>();

// Read the login session from the upgrade request (same cookie as the API)
function readSession(req: IncomingMessage): Promise<ClientInfo | null> {
  return new Promise((resolve) => {
    const res: any = { getHeader() {}, setHeader() {}, end() {} };
    try {
      getSession()(req as any, res, () => {
        const s = (req as any).session;
        if (s?.isAdmin) return resolve({ isAdmin: true, factoryId: null });
        if (s?.isFactoryUser && s?.factoryId) {
          return resolve({ isAdmin: false, factoryId: s.factoryId });
        }
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export function setupWebSocket(httpServer: Server): BroadcastFn {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    maxPayload: 4 * 1024, // clients never send anything meaningful
    verifyClient: (info, done) => {
      readSession(info.req).then((client) => {
        if (!client) return done(false, 401, "Unauthorized");
        (info.req as any).wsClient = client;
        done(true);
      });
    },
  });

  wss.on("connection", (ws, req) => {
    clients.set(ws, (req as any).wsClient);
    log("WebSocket client connected", "ws");

    ws.on("close", () => {
      log("WebSocket client disconnected", "ws");
    });

    ws.on("error", (err) => {
      log(`WebSocket error: ${err.message}`, "ws");
    });
  });

  const broadcast: BroadcastFn = (event, data, factoryId) => {
    const full = JSON.stringify({ event, data, timestamp: Date.now() });
    // Factory clients only need to know something changed, not the details
    const brief = JSON.stringify({ event, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const info = clients.get(client);
      if (!info) return;
      if (info.isAdmin) {
        client.send(full);
      } else if (factoryId && info.factoryId === factoryId) {
        client.send(brief);
      }
    });
  };

  return broadcast;
}
