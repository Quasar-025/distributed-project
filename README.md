# ShardForge Lab (Distributed ML Benchmark Cluster)

This project now focuses on practical distributed training benchmarks:

- Distributed queue-backed ML job scheduling
- Bully-style leader election
- Task lifecycle states: `WAITING`, `PROCESSING`, `DONE`
- Heartbeat-based fault handling with task reassignment
- Python shard execution and result aggregation
- Single-machine vs distributed comparison workflow
- Per-machine task assignment progress bars in the UI

## Project Layout

- `backend/`: leader-worker cluster, APIs, WebSocket sync/election
- `frontend/`: cluster monitor, benchmark runner, node progress, control center

## Python Setup For Datasets

Dataset presets use scikit-learn (`sklearn:*`). Install Python deps on every machine that runs a backend node:

```bash
cd backend
py -m pip install -r python/requirements.txt
```

If your Python launcher is not `py`, set it in `backend/.env`:

```bash
PYTHON_BIN=python
```

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

- `POST /jobs`: submit training job
	- body: `{ operation, dataset, datasetProfile, model, sampleCount, featureCount, shards, epochs, computeMultiplier, learningRate, executionMode?, benchmarkGroup?, benchmarkLabel? }`
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

1. Classification (Wine):
```json
{
	"operation": "classification",
	"dataset": "sklearn:wine",
	"datasetProfile": "auto",
	"model": "logistic-regression",
	"sampleCount": 2000,
	"featureCount": 13,
	"shards": 8,
	"epochs": 24,
	"computeMultiplier": 2,
	"learningRate": 0.06
}
```

2. Regression (Diabetes):
```json
{
	"operation": "regression",
	"dataset": "sklearn:diabetes",
	"datasetProfile": "auto",
	"model": "linear-regression",
	"sampleCount": 2400,
	"featureCount": 10,
	"shards": 8,
	"epochs": 25,
	"computeMultiplier": 2,
	"learningRate": 0.02
}
```

## How To Compare Single Vs Distributed

1. Open the `Benchmark` page in the frontend.
2. Select one of the datasets (`sklearn:*`).
3. Run a comparison pair.
4. The app submits two jobs with the same configuration:
	- Single machine: `shards=1`, `executionMode=single`
	- Distributed: `shards=workers*2`, `executionMode=distributed`
5. Wait for both jobs to become `DONE` and read the speedup result.

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
