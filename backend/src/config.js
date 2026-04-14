export const NODE_ID = process.env.NODE_ID || "counter-1";
export const PORT = process.env.PORT || 5000;
const defaultPythonBin = process.platform === "win32" ? "py" : "python3";
export const PYTHON_BIN = process.env.PYTHON_BIN || defaultPythonBin;
export const WORKER_SCRIPT = process.env.WORKER_SCRIPT || "python/worker_task.py";

/*
  Add peer WebSocket URLs here
  Example:
  ws://192.168.1.10:5000
*/
export const PEERS = process.env.PEERS
  ? process.env.PEERS.split(",")
  : [];
