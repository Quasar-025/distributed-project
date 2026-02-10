export function connectSocket(onMessage) {
  const ws = new WebSocket("ws://localhost:5000");

  ws.onmessage = event => {
    onMessage(JSON.parse(event.data));
  };

  return ws;
}
