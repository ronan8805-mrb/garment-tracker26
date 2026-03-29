import { queryClient } from "./queryClient";

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function invalidateDashboards() {
  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/admin"] });
  queryClient.invalidateQueries({ queryKey: ["/api/dashboard/factory"] });
  queryClient.invalidateQueries({ queryKey: ["/api/garments"] });
  queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
  queryClient.invalidateQueries({ queryKey: ["/api/scan-dates"] });
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    ws = new WebSocket(getWsUrl());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "scan" || msg.event === "batch_complete") {
          invalidateDashboards();
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

export function initWebSocket() {
  connect();
}

export function closeWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  ws?.close();
  ws = null;
}
