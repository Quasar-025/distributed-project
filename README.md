# Distributed Queue System

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```bash
NODE_ID=counter-1
PORT=5000
PEERS=ws://10.13.225.209:5001
```

3. Start the node:
```bash
npm start
```

## Environment Variables

- `NODE_ID`: Unique identifier for this node (default: `counter-1`)
- `PORT`: Port to run the server on (default: `5000`)
- `PEERS`: Comma-separated list of peer WebSocket URLs

## How It Works

- On startup, nodes connect to peers and elect a leader (highest NODE_ID wins).
- **Enqueue/Dequeue requests can be sent to any node** — non-leader nodes automatically forward to the leader.
- If the leader goes down, a new election happens automatically.
- Queue state is synced across all nodes via WebSocket.

## Running Two Nodes

**PC A (.env):**
```
NODE_ID=counter-1
PORT=5000
PEERS=ws://10.13.225.209:5001
```

**PC B (.env):**
```
NODE_ID=counter-2
PORT=5001
PEERS=ws://10.13.225.28:5000
```
