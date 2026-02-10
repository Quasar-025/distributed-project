import express from "express";
import http from "http";
import routes from "./routes.js";
import { startPeerSync } from "./sync.js";
import { PORT, NODE_ID } from "./config.js";
import { connectToPeer } from "./connect.js";

const app = express();
app.use(express.json());
app.use(routes);

const server = http.createServer(app);
startPeerSync(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Counter node ${NODE_ID} running on port ${PORT}`);
});

if (process.env.CONNECT_TO) {
  connectToPeer(process.env.CONNECT_TO);
}

