import { getBaseUrlCandidates, getBaseUrlValue } from "./api";

let ws = null;
let reconnectTimer = null;
const listeners = new Set();
let socketTargetIndex = 0;

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(msg) {
  listeners.forEach(cb => cb(msg));
}

function getSocketTargets() {
  const active = getBaseUrlValue();
  const candidates = getBaseUrlCandidates();
  const ordered = [active, ...candidates.filter(url => url !== active)].filter(Boolean);
  return ordered.map(url => url.replace(/^http/, "ws"));
}

export function connectSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const targets = getSocketTargets();
  const base = targets[socketTargetIndex % targets.length];
  socketTargetIndex += 1;
  ws = new WebSocket(base);

  ws.onopen = () => {
    socketTargetIndex = 0;
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
