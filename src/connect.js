import WebSocket from "ws";

export function connectToPeer(url) {
  const ws = new WebSocket(url);

  ws.on("open", () => {
    ws.send(JSON.stringify({
      type: "HELLO",
      peerId: process.env.NODE_ID
    }));
  });

  ws.on("message", data => {
    const msg = JSON.parse(data);

    if (msg.type === "PING") {
      ws.send(JSON.stringify({ type: "PONG" }));
    }
  });
}
