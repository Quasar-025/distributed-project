import express from "express";
import { enqueue, dequeue, getState } from "./queue.js";
import { broadcastState } from "./sync.js";

const router = express.Router();

router.post("/enqueue", (req, res) => {
  const state = enqueue();
  broadcastState();
  res.json(state);
});

router.post("/dequeue", (req, res) => {
  const state = dequeue();
  broadcastState();
  res.json(state);
});

router.get("/queue", (req, res) => {
  res.json(getState());
});

export default router;
