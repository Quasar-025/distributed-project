import { WebSocketServer } from "ws";
import { getState, setState } from "./queue.js";

const HEARTBEAT_INTERVAL = 3000; // 3 seconds
const MAX_MISSES = 3;            // allow 3 missed heartbeats

/**
 * peerId -> {
 *   ws,
 *   missed
 * }
 */
const peers = new Map();

export function startPeerSync(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", ws => {
    let peerId = null;

    ws.on("message", data => {
      const msg = JSON.parse(data);

      // FIRST message must identify peer
      if (msg.type === "HELLO") {
        peerId = msg.peerId;

        peers.set(peerId, {
          ws,
          missed: 0
        });

        console.log(`Peer ${peerId} connected`);

        // Send current state immediately
        ws.send(JSON.stringify({
          type: "STATE",
          ...getState()
        }));
        return;
      }

      if (!peerId) return;

      const peer = peers.get(peerId);
      if (!peer) return;

      // Heartbeat success
      if (msg.type === "PONG") {
        peer.missed = 0;
        return;
      }

      if (msg.type === "STATE") {
        const local = getState();
        if (msg.version > local.version) {
          setState(msg.queue, msg.version);
          console.log("State updated from peer");
        }
      }

      if (msg.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG" }));
      }
    });

    ws.on("close", () => {
      if (peerId) {
        console.log(`Peer ${peerId} disconnected`);
        peers.delete(peerId);
      }
    });
  });

  startHeartbeatLoop();
}

function startHeartbeatLoop() {
  setInterval(() => {
    peers.forEach((peer, peerId) => {
      try {
        peer.ws.send(JSON.stringify({ type: "PING" }));
        peer.missed += 1;

        if (peer.missed >= MAX_MISSES) {
          console.log(`Peer ${peerId} marked DOWN`);
          peer.ws.close();
          peers.delete(peerId);
        }
      } catch {
        peer.missed += 1;
      }
    });
  }, HEARTBEAT_INTERVAL);
}

export function broadcastState() {
  const state = getState();
  peers.forEach(peer => {
    peer.ws.send(JSON.stringify({
      type: "STATE",
      ...state
    }));
  });
}
