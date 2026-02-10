import { getBaseUrlValue } from "./api";

let ws = null;
let reconnectTimer = null;
const listeners = new Set();

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(msg) {
  listeners.forEach(cb => cb(msg));
}

export function connectSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const base = getBaseUrlValue().replace(/^http/, "ws");
  ws = new WebSocket(base);

  ws.onopen = () => {
    notify({ type: "_CONNECTED" });
    // Identify as a frontend client
    ws.send(JSON.stringify({ type: "HELLO", peerId: `frontend-${Date.now()}` }));
  };

  ws.onmessage = event => {
    try {
      const msg = JSON.parse(event.data);
      // Respond to PINGs to stay alive
      if (msg.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG" }));
        return;
      }
      notify(msg);
    } catch {}
  };

  ws.onclose = () => {
    notify({ type: "_DISCONNECTED" });
    reconnectTimer = setTimeout(connectSocket, 3000);
  };

  ws.onerror = () => {};
}

export function disconnectSocket() {
  clearTimeout(reconnectTimer);
  if (ws) ws.close();
}
