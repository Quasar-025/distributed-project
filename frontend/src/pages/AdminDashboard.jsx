import { useMemo, useState } from "react";
import { createTrainingJob } from "../services/api";
import useLiveStatus from "../hooks/useLiveStatus";
import useLiveQueue from "../hooks/useLiveQueue";

const PRESET_JOBS = [
  {
    name: "Iris Distributed Quick Run",
    description: "Dataset quick check with light parallelism",
    payload: {
      operation: "classification",
      dataset: "sklearn:iris",
      datasetProfile: "auto",
      model: "logistic-regression",
      sampleCount: 1200,
      featureCount: 4,
      shards: 4,
      epochs: 10,
      computeMultiplier: 1,
      learningRate: 0.08,
      executionMode: "distributed"
    }
  },
  {
    name: "Wine Benchmark",
    description: "Good for single-vs-cluster benchmark pairs",
    payload: {
      operation: "classification",
      dataset: "sklearn:wine",
      datasetProfile: "auto",
      model: "logistic-regression",
      sampleCount: 2000,
      featureCount: 13,
      shards: 8,
      epochs: 24,
      computeMultiplier: 2,
      learningRate: 0.06
    }
  },
  {
    name: "Diabetes Regression",
    description: "Regression task over tabular medical features",
    payload: {
      operation: "regression",
      dataset: "sklearn:diabetes",
      datasetProfile: "auto",
      model: "linear-regression",
      sampleCount: 2400,
      featureCount: 10,
      shards: 8,
      epochs: 25,
      computeMultiplier: 2,
      learningRate: 0.02
    }
  }
];

export default function AdminDashboard({ addToast }) {
  const { status, error } = useLiveStatus(3000);
  const { version, summary, connected } = useLiveQueue();
  const [operation, setOperation] = useState("classification");
  const [datasetMode, setDatasetMode] = useState("preset");
  const [datasetPreset, setDatasetPreset] = useState("sklearn:iris");
  const [datasetPath, setDatasetPath] = useState("synthetic.csv");
  const [datasetProfile, setDatasetProfile] = useState("auto");
  const [model, setModel] = useState("logistic-regression");
  const [sampleCount, setSampleCount] = useState(1200);
  const [featureCount, setFeatureCount] = useState(4);
  const [shards, setShards] = useState(4);
  const [epochs, setEpochs] = useState(8);
  const [computeMultiplier, setComputeMultiplier] = useState(1);
  const [learningRate, setLearningRate] = useState(0.1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const jobs = status?.state?.jobs || [];
  const tasks = status?.state?.tasks || [];
  const peers = status?.peers || [];
  const workerCount = 1 + peers.length;

  const activeWorkers = useMemo(() => {
    return [status?.nodeId, ...peers.map(p => p.peerId)].filter(Boolean);
  }, [status?.nodeId, peers]);

  const workerStats = useMemo(() => {
    const stats = {};
    activeWorkers.forEach(workerId => {
      stats[workerId] = {
        processing: 0,
        done: 0,
        totalDuration: 0,
        completedWithDuration: 0
      };
    });

    tasks.forEach(task => {
      const key = task.assignedTo || "unassigned";
      if (!stats[key]) {
        stats[key] = { processing: 0, done: 0, totalDuration: 0, completedWithDuration: 0 };
      }

      if (task.status === "PROCESSING") {
        stats[key].processing += 1;
      }

      if (task.status === "DONE") {
        stats[key].done += 1;
        if (task.result?.durationMs) {
          stats[key].totalDuration += task.result.durationMs;
          stats[key].completedWithDuration += 1;
        }
      }
    });

    return stats;
  }, [tasks, activeWorkers]);

  const workerRows = useMemo(() => {
    return Object.entries(workerStats).map(([workerId, stats]) => {
      const avgDuration = stats.completedWithDuration > 0
        ? Math.round(stats.totalDuration / stats.completedWithDuration)
        : null;
      const totalAssigned = stats.processing + stats.done;
      const progressPct = totalAssigned > 0 ? Math.round((stats.done / totalAssigned) * 100) : 0;
      return { workerId, ...stats, avgDuration, totalAssigned, progressPct };
    });
  }, [workerStats]);

  const modelOptions = operation === "regression"
    ? ["linear-regression"]
    : ["logistic-regression"];

  function buildPayload(overrides = {}) {
    const dataset = datasetMode === "custom" ? datasetPath : datasetPreset;
    const baseModel = modelOptions.includes(model) ? model : modelOptions[0];

    return {
      operation,
      dataset,
      datasetProfile,
      model: baseModel,
      executionMode: "distributed",
      sampleCount: Number(sampleCount),
      featureCount: Number(featureCount),
      shards: Number(shards),
      epochs: Number(epochs),
      computeMultiplier: Number(computeMultiplier),
      learningRate: Number(learningRate),
      ...overrides
    };
  }

  async function runPresetJob(preset) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTrainingJob(preset.payload);
      addToast?.(`Submitted preset job: ${preset.name}`, "success");
    } catch (err) {
      const message = err?.error || "Failed to submit preset job";
      setSubmitError(message);
      addToast?.(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateJob(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      await createTrainingJob(buildPayload());
      addToast?.("Training job submitted", "success");
    } catch (err) {
      const message = err?.error || "Failed to submit training job";
      setSubmitError(message);
      addToast?.(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Cluster Control Center</h1>
        <p>Configure training jobs, run datasets, and inspect worker utilization</p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {submitError && (
        <div className="card" style={{ borderLeft: "4px solid var(--warning)", marginBottom: 16 }}>
          ⚠️ {submitError}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">This Node</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {status?.nodeId || "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Role</div>
          <div className={`stat-value ${status?.isLeader ? "warning" : "primary"}`} style={{ fontSize: 18 }}>
            {status?.isLeader ? "👑 Leader" : "Follower"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Leader</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {status?.leader || "Electing..."}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Socket</div>
          <div className={`stat-value ${connected ? "success" : "danger"}`} style={{ fontSize: 18 }}>
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Workers Available</div>
          <div className="stat-value primary">{workerCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">State Version</div>
          <div className="stat-value">{version}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Jobs</div>
          <div className="stat-value primary">{summary?.activeJobs ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Processing Tasks</div>
          <div className="stat-value warning">{summary?.processingTasks ?? 0}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>Submit ML Job</h2>
        </div>
        <form className="job-form" onSubmit={handleCreateJob}>
          <label>
            Operation
            <select value={operation} onChange={(e) => setOperation(e.target.value)}>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </label>

          <label>
            Dataset Source
            <select value={datasetMode} onChange={(e) => setDatasetMode(e.target.value)}>
              <option value="preset">Preset Name</option>
              <option value="custom">CSV Path</option>
            </select>
          </label>

          {datasetMode === "custom" ? (
            <label>
              Dataset Path
              <input value={datasetPath} onChange={(e) => setDatasetPath(e.target.value)} placeholder="datasets/my_data.csv" required />
            </label>
          ) : (
            <label>
              Dataset Preset
              <select value={datasetPreset} onChange={(e) => setDatasetPreset(e.target.value)}>
                <option value="sklearn:iris">sklearn:iris</option>
                <option value="sklearn:wine">sklearn:wine</option>
                <option value="sklearn:breast-cancer">sklearn:breast-cancer</option>
                <option value="sklearn:diabetes">sklearn:diabetes</option>
                <option value="synthetic.csv">synthetic.csv (fallback)</option>
              </select>
            </label>
          )}

          <label>
            Dataset Profile
            <select value={datasetProfile} onChange={(e) => setDatasetProfile(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="nonlinear">Nonlinear</option>
              <option value="nl-heavy">Nonlinear Heavy</option>
              <option value="wide-heavy">Wide Heavy</option>
              <option value="noisy">Noisy</option>
            </select>
          </label>

          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOptions.map(option => (
                <option value={option} key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            Samples
            <input
              type="number"
              min="200"
              max="300000"
              value={sampleCount}
              onChange={(e) => setSampleCount(e.target.value)}
              required
            />
          </label>

          <label>
            Features
            <input
              type="number"
              min="2"
              max="128"
              value={featureCount}
              onChange={(e) => setFeatureCount(e.target.value)}
              required
            />
          </label>

          <label>
            Shards
            <input
              type="number"
              min="1"
              max="32"
              value={shards}
              onChange={(e) => setShards(e.target.value)}
              required
            />
          </label>

          <label>
            Epochs
            <input
              type="number"
              min="1"
              max="100"
              value={epochs}
              onChange={(e) => setEpochs(e.target.value)}
              required
            />
          </label>

          <label>
            Compute Multiplier
            <input
              type="number"
              min="1"
              max="20"
              value={computeMultiplier}
              onChange={(e) => setComputeMultiplier(e.target.value)}
              required
            />
          </label>

          <label>
            Learning Rate
            <input
              type="number"
              min="0.0001"
              max="1"
              step="0.0001"
              value={learningRate}
              onChange={(e) => setLearningRate(e.target.value)}
              required
            />
          </label>

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Launch Job"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>Demo Jobs</h2>
        </div>
        <div className="preset-grid">
          {PRESET_JOBS.map((preset) => (
            <div className="preset-card" key={preset.name}>
              <h3>{preset.name}</h3>
              <p>{preset.description}</p>
              <div className="preset-meta">
                {preset.payload.shards} shards • {preset.payload.epochs} epochs • x{preset.payload.computeMultiplier} compute
              </div>
              <button
                className="btn-outline"
                onClick={() => runPresetJob(preset)}
                disabled={submitting}
                type="button"
              >
                Run Preset
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>Worker Assignment Progress</h2>
        </div>
        {workerRows.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            <p>No completed task results yet.</p>
          </div>
        ) : (
          <ul className="peer-list split-list">
            {workerRows.map((row) => (
              <li className="peer-item split-item" key={row.workerId}>
                <span className="peer-id">{row.workerId}</span>
                <span className="peer-url">
                  {row.processing} processing • {row.done} done • {row.totalAssigned} assigned
                  {row.avgDuration ? ` • avg ${row.avgDuration} ms` : ""}
                </span>
                <div className="split-bar-wrap">
                  <div
                    className="split-bar"
                    style={{ width: `${row.progressPct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
        }
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Recent Jobs</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            <p>No jobs submitted yet.</p>
          </div>
        ) : (
          <ul className="peer-list">
            {jobs
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, 8)
              .map(job => (
                <li className="peer-item" key={job.id}>
                  <span className="peer-id">{job.model} on {job.dataset}</span>
                  <span className="peer-url">
                    {job.status}
                    {job.aggregation ? ` • acc ${job.aggregation.accuracy} • loss ${job.aggregation.loss}` : ""}
                    {job.executionMode ? ` • mode ${job.executionMode}` : ""}
                    {job.progressPct !== undefined ? ` • ${job.progressPct}%` : ""}
                    {job.totalDurationMs ? ` • ${job.totalDurationMs} ms` : ""}
                    {job.sampleCount ? ` • samples ${job.sampleCount}` : ""}
                    {job.computeMultiplier ? ` • x${job.computeMultiplier}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
