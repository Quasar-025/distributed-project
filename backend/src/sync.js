import { WebSocketServer } from "ws";
import WebSocket from "ws";
import os from "os";
import { getState, setState, mergeState } from "./queue.js";
import { startElection, handleLeaderMessage, getLeader, resetLeader } from "./election.js";
import { PORT } from "./config.js";

const HEARTBEAT_INTERVAL = 3000;
const MAX_MISSES = 3;
const RECONNECT_DELAY = 5000;

/**
 * peerId -> {
 *   ws,
 *   missed,
 *   httpUrl
 * }
 */
export const peers = new Map();

/* =========================
   SHARED MESSAGE HANDLER
   ========================= */
function handleMessage(ws, msg) {
  if (msg.type === "HELLO") {
    const peerId = msg.peerId;

    peers.set(peerId, { ws, missed: 0, httpUrl: msg.httpUrl || null });
    console.log(`Peer ${peerId} registered (http: ${msg.httpUrl})`);

    // Send our own identity back
    ws.send(JSON.stringify({
      type: "HELLO_ACK",
      peerId: process.env.NODE_ID,
      httpUrl: `http://${getOwnIp()}:${PORT}`
    }));

    // Send current state for merging
    ws.send(JSON.stringify({
      type: "SYNC",
      ...getState()
    }));

    // Reset leader so both sides re-elect after reconnect
    resetLeader();
    return;
  }

  if (msg.type === "HELLO_ACK") {
    const peerId = msg.peerId;
    peers.set(peerId, { ws, missed: 0, httpUrl: msg.httpUrl || null });
    console.log(`Peer ${peerId} acknowledged (http: ${msg.httpUrl})`);

    // Send our state for merging
    ws.send(JSON.stringify({
      type: "SYNC",
      ...getState()
    }));

    // Reset leader so both sides re-elect after reconnect
    resetLeader();
    return;
  }

  // Find peerId by socket
  const entry = [...peers.entries()].find(([, p]) => p.ws === ws);
  if (!entry) return;

  const [, peer] = entry;

  if (msg.type === "PONG") {
    peer.missed = 0;
    return;
  }

  if (msg.type === "PING") {
    ws.send(JSON.stringify({ type: "PONG" }));
    return;
  }

  // SYNC = merge queues (used on reconnect)
  if (msg.type === "SYNC") {
    const merged = mergeState(msg.queue, msg.version);
    console.log("Queues merged after reconnect");

    // Broadcast merged state to all peers
    broadcastState();

    // Trigger election after merge
    setTimeout(() => {
      if (!getLeader()) {
        startElection(process.env.NODE_ID);
      }
    }, 500);
    return;
  }

  // STATE = authoritative update from leader (normal operation)
  if (msg.type === "STATE") {
    const local = getState();
    if (msg.version > local.version) {
      setState(msg.queue, msg.version);
      console.log("State updated from leader");
    }
    return;
  }

  if (msg.type === "ELECTION") {
    startElection(process.env.NODE_ID);
    return;
  }

  if (msg.type === "LEADER") {
    handleLeaderMessage(msg.leaderId);
    peers.forEach(p => {
      if (p.ws !== ws) {
        try {
          p.ws.send(JSON.stringify({ type: "LEADER", leaderId: msg.leaderId }));
        } catch {}
      }
    });
    return;
  }
}

function getOwnIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function removePeerByWs(ws) {
  for (const [id, peer] of peers.entries()) {
    if (peer.ws === ws) {
      peers.delete(id);
      console.log(`Peer ${id} disconnected`);

      if (getLeader() === id) {
        console.log(`Leader ${id} went down — starting new election`);
        resetLeader();
        startElection(process.env.NODE_ID);
      }
    }
  }
}

/* =========================
   SERVER (INBOUND PEERS)
   ========================= */
export function startPeerSync(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", data => {
      try {
        handleMessage(ws, JSON.parse(data));
      } catch (e) {
        console.error("Bad message:", e.message);
      }
    });

    ws.on("close", () => removePeerByWs(ws));
    ws.on("error", () => {});
  });

  startHeartbeatLoop();
}

/* =========================
   CLIENT (OUTBOUND PEERS)
   ========================= */
export function connectToPeer(url) {
  const httpUrl = url.replace(/^ws:/, "http:");

  function connect() {
    const ws = new WebSocket(url);

    ws.on("open", () => {
      console.log(`Connected to ${url}`);
      ws.send(JSON.stringify({
        type: "HELLO",
        peerId: process.env.NODE_ID,
        httpUrl: `http://${getOwnIp()}:${PORT}`
      }));
    });

    ws.on("message", data => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === "HELLO_ACK") {
          const peerId = msg.peerId;
          peers.set(peerId, { ws, missed: 0, httpUrl: msg.httpUrl || httpUrl });
          console.log(`Peer ${peerId} acknowledged (http: ${msg.httpUrl || httpUrl})`);

          // Send our state for merging
          ws.send(JSON.stringify({
            type: "SYNC",
            ...getState()
          }));

          // Reset leader for re-election
          resetLeader();
          return;
        }

        handleMessage(ws, msg);
      } catch (e) {
        console.error("Bad message:", e.message);
      }
    });

    ws.on("close", () => {
      removePeerByWs(ws);
      console.log(`Lost connection to ${url}, retrying in ${RECONNECT_DELAY}ms`);
      setTimeout(connect, RECONNECT_DELAY);
    });

    ws.on("error", () => {});
  }

  connect();
}

/* =========================
   GET LEADER HTTP URL
   ========================= */
export function getLeaderHttpUrl() {
  const leaderId = getLeader();
  if (!leaderId) return null;
  if (leaderId === process.env.NODE_ID) return null; // shouldn't forward to self
  const peer = peers.get(leaderId);
  return peer?.httpUrl || null;
}

/* =========================
   HEARTBEATS
   ========================= */
function startHeartbeatLoop() {
  setInterval(() => {
    peers.forEach((peer, peerId) => {
      try {
        if (peer.ws.readyState !== WebSocket.OPEN) {
          peers.delete(peerId);
          if (getLeader() === peerId) {
            resetLeader();
            startElection(process.env.NODE_ID);
          }
          return;
        }

        peer.missed += 1;
        peer.ws.send(JSON.stringify({ type: "PING" }));

        if (peer.missed >= MAX_MISSES) {
          console.log(`Peer ${peerId} marked DOWN`);
          peer.ws.close();
          peers.delete(peerId);
          if (getLeader() === peerId) {
            console.log(`Leader ${peerId} went down — starting new election`);
            resetLeader();
          }
          startElection(process.env.NODE_ID);
        }
      } catch {
        peers.delete(peerId);
      }
    });
  }, HEARTBEAT_INTERVAL);
}

/* =========================
   STATE BROADCAST
   ========================= */
export function broadcastState() {
  const state = getState();
  peers.forEach((peer) => {
    try {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({
          type: "STATE",
          ...state
        }));
      }
    } catch {}
  });
}
