import WebSocket from "ws";
import { getState, setState } from "./queue.js";
import { PEERS } from "./config.js";

const sockets = [];

export function startPeerSync(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", ws => {
    ws.on("message", data => {
      const msg = JSON.parse(data);
      const local = getState();

      if (msg.type === "STATE" && msg.version > local.version) {
        setState(msg.queue, msg.version);
        console.log("State updated from peer");
      }
    });
  });

  PEERS.forEach(peer => {
    const ws = new WebSocket(peer);
    ws.on("open", () => sockets.push(ws));
  });
}

export function broadcastState() {
  const state = getState();
  sockets.forEach(ws => {
    ws.send(JSON.stringify({
      type: "STATE",
      ...state
    }));
  });
}
