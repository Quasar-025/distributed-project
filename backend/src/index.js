import express from "express";
import http from "http";
import routes from "./routes.js";
import { startPeerSync, connectToPeer } from "./sync.js";
import { PORT, NODE_ID, PEERS } from "./config.js";
import { startElection } from "./election.js";

const app = express();
app.use(express.json());
app.use(routes);

const server = http.createServer(app);
startPeerSync(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Counter node ${NODE_ID} running on port ${PORT}`);
});

PEERS.forEach(url => {
  if (url.trim()) connectToPeer(url.trim());
});

// Trigger initial election after a short delay to allow connections
setTimeout(() => {
  startElection(NODE_ID);
}, 5000);

