# Distributed ML Training Cluster (Leader + Worker)

This project now implements the PDF requirements end-to-end:

- Distributed queue-backed ML job scheduling
- Bully-style leader election
- Task lifecycle states: `WAITING`, `PROCESSING`, `DONE`
- Heartbeat-based fault handling with task reassignment
- Real Python shard execution and result aggregation

## Project Layout

- `backend/`: leader-worker cluster, APIs, WebSocket sync/election
- `frontend/`: real-time dashboard, public queue, counter demo view

## Backend Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Configure environment variables in `backend/.env`:
```bash
NODE_ID=counter-1
PORT=5000
PEERS=ws://127.0.0.1:5001
```

3. Start the node:
```bash
npm start
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Optional envs:

- `VITE_API_URL`: explicit backend URL
- `VITE_API_PORT`: backend port if using same host (default `5000`)

## Core APIs

- `POST /jobs`: submit distributed training job
	- body: `{ operation, dataset, datasetProfile, model, sampleCount, featureCount, shards, epochs, computeMultiplier, learningRate }`
- `GET /jobs`: list submitted jobs
- `GET /jobs/:jobId`: fetch a job with shard/task details
- `GET /queue`: queue-compatible live task view + state summary
- `GET /status`: node/leader/peers + full distributed state
- `POST /enqueue` and `POST /dequeue`: backward-compatible queue demo endpoints

## How The Cluster Works

1. Nodes connect over WebSockets and elect a single leader.
2. Leader receives jobs and splits them into shard tasks.
3. Leader assigns tasks to workers (including itself).
4. Workers execute tasks and return results to the leader.
5. Leader aggregates shard results into final job metrics.
6. Heartbeats detect failures and in-flight tasks are re-queued.

Each worker task is executed by `backend/python/worker_task.py` using the configured Python runtime.

## Demo Jobs

Use these payloads with `POST /jobs` to demonstrate distributed gains:

1. Heavy classification:
```json
{
	"operation": "classification",
	"dataset": "synthetic-heavy-A",
	"datasetProfile": "nl-heavy",
	"model": "logistic-regression",
	"sampleCount": 20000,
	"featureCount": 20,
	"shards": 32,
	"epochs": 45,
	"computeMultiplier": 4,
	"learningRate": 0.06
}
```

2. Heavy regression:
```json
{
	"operation": "regression",
	"dataset": "synthetic-heavy-B",
	"datasetProfile": "wide-heavy",
	"model": "linear-regression",
	"sampleCount": 26000,
	"featureCount": 28,
	"shards": 40,
	"epochs": 60,
	"computeMultiplier": 5,
	"learningRate": 0.02
}
```

## Run Multi-node Locally

Terminal 1:

```bash
cd backend
NODE_ID=counter-1 PORT=5000 PEERS=ws://127.0.0.1:5001 npm start
```

Terminal 2:

```bash
cd backend
NODE_ID=counter-2 PORT=5001 PEERS=ws://127.0.0.1:5000 npm start
```
