import { WebSocketServer } from "ws";
import WebSocket from "ws";
import os from "os";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getState,
  setState,
  mergeState,
  getNextWaitingTask,
  assignTask,
  completeTask,
  requeueExpiredTasks,
  requeueWorkerTasks,
  requeueTask
} from "./queue.js";
import { startElection, handleLeaderMessage, getLeader, resetLeader, amILeader } from "./election.js";
import { PORT, PYTHON_BIN, WORKER_SCRIPT } from "./config.js";

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

/**
 * Set of WebSocket connections for frontend clients
 */
export const clients = new Set();
const localRunningTasks = new Set();
let roundRobinCursor = 0;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const workerScriptPath = path.isAbsolute(WORKER_SCRIPT)
  ? WORKER_SCRIPT
  : path.resolve(backendRoot, WORKER_SCRIPT);

function getWorkerPool() {
  const workers = [{ id: process.env.NODE_ID, ws: null, local: true }];

  peers.forEach((peer, peerId) => {
    workers.push({ id: peerId, ws: peer.ws, local: false });
  });

  return workers.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function executeTask(task, workerId, onDone, onError) {
  if (localRunningTasks.has(task.id)) return;
  localRunningTasks.add(task.id);

  const startedAt = Date.now();
  const child = spawn(PYTHON_BIN, [workerScriptPath], {
    cwd: backendRoot,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", chunk => {
    stdout += chunk.toString();
  });

  child.stderr.on("data", chunk => {
    stderr += chunk.toString();
  });

  child.on("error", (err) => {
    localRunningTasks.delete(task.id);
    if (onError) onError(`Worker launch error: ${err.message}`);
  });

  child.on("close", (code) => {
    localRunningTasks.delete(task.id);

    if (code !== 0) {
      if (onError) onError(stderr.trim() || `Worker exited with code ${code}`);
      return;
    }

    try {
      const raw = stdout.trim().split("\n").filter(Boolean).pop() || "{}";
      const parsed = JSON.parse(raw);
      const result = {
        ...parsed,
        workerId,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now()
      };
      onDone(result);
    } catch (err) {
      if (onError) onError(`Invalid worker output: ${err.message}`);
    }
  });

  child.stdin.write(JSON.stringify({
    taskId: task.id,
    jobId: task.jobId,
    shard: task.shard,
    payload: task.payload || {}
  }));
  child.stdin.end();
}

function scheduleTasks() {
  if (!amILeader()) return;

  const leaseMs = HEARTBEAT_INTERVAL * (MAX_MISSES + 2);
  const workers = getWorkerPool();
  if (workers.length === 0) return;

  let task = getNextWaitingTask();

  while (task) {
    const worker = workers[roundRobinCursor % workers.length];
    roundRobinCursor += 1;

    const assigned = assignTask(task.id, worker.id, leaseMs);
    if (!assigned) {
      task = getNextWaitingTask();
      continue;
    }

    if (worker.local) {
      executeTask(assigned, worker.id, (result) => {
        completeTask(assigned.id, worker.id, result);
        broadcastState();
      }, () => {
        requeueTask(assigned.id);
        broadcastState();
      });
    } else {
      try {
        worker.ws.send(JSON.stringify({
          type: "TASK_ASSIGN",
          task: assigned
        }));
      } catch {
        requeueTask(assigned.id);
      }
    }

    broadcastState();
    task = getNextWaitingTask();
  }
}

/* =========================
   SHARED MESSAGE HANDLER
   ========================= */
function handleMessage(ws, msg) {
  if (msg.type === "HELLO") {
    const peerId = msg.peerId;

    // Treat frontends as clients, not peers
    if (peerId.startsWith("frontend-")) {
      clients.add(ws);
      console.log(`Client ${peerId} connected`);
      
      // Send ACK
      ws.send(JSON.stringify({
        type: "HELLO_ACK",
        peerId: process.env.NODE_ID,
        httpUrl: `http://${getOwnIp()}:${PORT}`
      }));

      // Send current state
      ws.send(JSON.stringify({
        type: "SYNC",
        ...getState()
      }));
      return;
    }

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
    const merged = mergeState({ jobs: msg.jobs || [], tasks: msg.tasks || [] }, msg.version);
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
      setState({ jobs: msg.jobs || [], tasks: msg.tasks || [] }, msg.version);
      console.log("State updated from leader");
      
      // Propagate update to connected clients (frontends)
      notifyClients(msg);
    }
    return;
  }

  if (msg.type === "ELECTION") {
    startElection(process.env.NODE_ID);
    return;
  }

  if (msg.type === "TASK_ASSIGN") {
    const task = msg.task;
    if (!task || !task.id) return;

    executeTask(task, process.env.NODE_ID, (result) => {
      try {
        ws.send(JSON.stringify({
          type: "TASK_RESULT",
          taskId: task.id,
          workerId: process.env.NODE_ID,
          result
        }));
      } catch {}
    }, (error) => {
      try {
        ws.send(JSON.stringify({
          type: "TASK_FAILED",
          taskId: task.id,
          workerId: process.env.NODE_ID,
          error
        }));
      } catch {}
    });
    return;
  }

  if (msg.type === "TASK_RESULT") {
    if (!amILeader()) return;
    if (!msg.taskId) return;

    completeTask(msg.taskId, msg.workerId, msg.result);
    broadcastState();
    return;
  }

  if (msg.type === "TASK_FAILED") {
    if (!amILeader()) return;
    if (!msg.taskId) return;

    requeueTask(msg.taskId);
    broadcastState();
    return;
  }

  if (msg.type === "LEADER") {
    const changed = handleLeaderMessage(msg.leaderId);
    if (changed) {
      peers.forEach(p => {
        if (p.ws !== ws) {
          try {
            p.ws.send(JSON.stringify({ type: "LEADER", leaderId: msg.leaderId }));
          } catch {}
        }
      });
    }
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
  if (clients.has(ws)) {
    clients.delete(ws);
    return;
  }

  for (const [id, peer] of peers.entries()) {
    if (peer.ws === ws) {
      peers.delete(id);
      console.log(`Peer ${id} disconnected`);

      if (amILeader()) {
        const changed = requeueWorkerTasks(id);
        if (changed) {
          broadcastState();
          scheduleTasks();
        }
      }

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
    if (amILeader()) {
      const changed = requeueExpiredTasks();
      if (changed) broadcastState();
      scheduleTasks();
    }

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

          if (amILeader()) {
            const changed = requeueWorkerTasks(peerId);
            if (changed) broadcastState();
          }

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
  
  // 1. Send to peers (other nodes)
  peers.forEach((peer) => {
    try {
      if (peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(JSON.stringify({
          type: "STATE",
          version: state.version,
          jobs: state.jobs,
          tasks: state.tasks,
          queue: state.queue,
          summary: state.summary
        }));
      }
    } catch {}
  });

  // 2. Send to clients (frontends)
  notifyClients({ type: "STATE", ...state });
}

function notifyClients(msg) {
  clients.forEach(ws => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    } catch {}
  });
}
