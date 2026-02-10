import express from "express";
import { enqueue, dequeue, getState } from "./queue.js";
import { broadcastState, peers, getLeaderHttpUrl } from "./sync.js";
import { startElection, amILeader, getLeader } from "./election.js";

const router = express.Router();

// CORS middleware
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

async function forwardToLeader(path, req, res) {
  const leaderUrl = getLeaderHttpUrl();
  if (!leaderUrl) {
    return res.status(503).json({ error: "Leader URL unknown" });
  }

  try {
    const url = `${leaderUrl}${path}`;
    console.log(`Forwarding ${req.method} ${path} -> ${url}`);
    const response = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json", "X-Forwarded": "true" },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Forward failed:", err.message);
    res.status(502).json({ error: "Failed to reach leader" });
  }
}

router.post("/enqueue", async (req, res) => {
  const leader = getLeader();

  if (!leader) {
    peers.forEach(peer => {
      try { peer.ws.send(JSON.stringify({ type: "ELECTION" })); } catch {}
    });
    startElection(process.env.NODE_ID);
    return res.status(503).json({ error: "Leader election in progress" });
  }

  if (!amILeader()) {
    // Forward to leader instead of rejecting
    return forwardToLeader("/enqueue", req, res);
  }

  enqueue();
  broadcastState();
  res.json(getState());
});

router.post("/dequeue", async (req, res) => {
  const leader = getLeader();

  if (!leader) {
    startElection(process.env.NODE_ID);
    return res.status(503).json({ error: "Leader election in progress" });
  }

  if (!amILeader()) {
    return forwardToLeader("/dequeue", req, res);
  }

  const state = dequeue();
  broadcastState();
  res.json(state);
});

router.get("/queue", (req, res) => {
  res.json(getState());
});

router.get("/status", (req, res) => {
  const peerList = [];
  peers.forEach((peer, peerId) => {
    peerList.push({ peerId, httpUrl: peer.httpUrl });
  });

  res.json({
    nodeId: process.env.NODE_ID || "counter-1",
    peerCount: peers.size,
    peers: peerList,
    leader: getLeader(),
    isLeader: amILeader(),
    queue: getState()
  });
});

export default router;
