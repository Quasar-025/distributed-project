export const NODE_ID = process.env.NODE_ID || "counter-1";
export const PORT = process.env.PORT || 5000;

/*
  Add peer WebSocket URLs here
  Example:
  ws://192.168.1.10:5000
*/
export const PEERS = process.env.PEERS
  ? process.env.PEERS.split(",")
  : [];
