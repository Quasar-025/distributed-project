# Distributed Counter Node

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```bash
NODE_ID=counter-1
PORT=5000
CONNECT_TO=ws://192.168.1.10:5001
```

3. Start the node:
```bash
npm start
```

## Environment Variables

- `NODE_ID`: Unique identifier for this node (default: `counter-1`)
- `PORT`: Port to run the server on (default: `5000`)
- `CONNECT_TO`: WebSocket URL of peer to connect to (optional)

## Running Multiple Nodes

**Node 1 (Server):**
```bash
NODE_ID=counter-1
PORT=5000
```

**Node 2 (Client):**
```bash
NODE_ID=counter-2
PORT=5001
CONNECT_TO=ws://10.13.225.209:5000
```

Node 2 will connect to Node 1 and they will sync their queue state.
