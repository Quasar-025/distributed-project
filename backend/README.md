# Distributed Leader-Worker Backend

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
- `PYTHON_BIN`: Python executable for task workers (default: `python3`)
- `WORKER_SCRIPT`: Worker script path (default: `python/worker_task.py`)

## How It Works

- Nodes elect a leader using Bully-style priority (`counter-N` ranks by `N`).
- Leader accepts training jobs, splits into shard tasks, and assigns workers.
- Tasks move through `WAITING -> PROCESSING -> DONE`.
- Workers run real Python training on each shard and return metrics (`accuracy`, `loss`) for aggregation.
- Heartbeats detect failures and expired in-flight tasks are reassigned.
- Job/task state is broadcast to peers and frontend clients.

## API Summary

- `POST /jobs` submit `{ operation, dataset, datasetProfile, model, sampleCount, featureCount, shards, epochs, computeMultiplier, learningRate }`
- `GET /jobs` list jobs
- `GET /jobs/:jobId` view one job with tasks
- `GET /queue` queue-compatible task list and summary
- `GET /status` node and cluster state
- `POST /enqueue`, `POST /dequeue` backward-compatible queue demo routes

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
