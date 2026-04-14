import { useMemo, useState } from "react";
import { createTrainingJob } from "../services/api";
import useLiveStatus from "../hooks/useLiveStatus";

const DATASET_CHOICES = [
  { value: "sklearn:iris", label: "Iris (classification)" },
  { value: "sklearn:wine", label: "Wine (classification)" },
  { value: "sklearn:breast-cancer", label: "Breast Cancer (classification)" },
  { value: "sklearn:diabetes", label: "Diabetes (regression)" }
];

const LONG_RUN_PROFILES = [
  {
    id: "minute-1",
    label: "~1 minute",
    description: "Balanced heavy run",
    values: {
      epochs: 140,
      computeMultiplier: 10,
      sampleCount: 120000,
      featureCount: 64,
      learningRate: 0.06
    }
  },
  {
    id: "minute-2",
    label: "~2 minutes",
    description: "Deep stress run",
    values: {
      epochs: 180,
      computeMultiplier: 14,
      sampleCount: 180000,
      featureCount: 96,
      learningRate: 0.05
    }
  }
];

function formatMs(ms) {
  if (!Number.isFinite(ms)) return "-";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatMetric(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return value.toFixed(4);
}

export default function Enqueue({ addToast }) {
  const { status } = useLiveStatus(3000);
  const [dataset, setDataset] = useState("sklearn:iris");
  const [epochs, setEpochs] = useState(140);
  const [computeMultiplier, setComputeMultiplier] = useState(10);
  const [learningRate, setLearningRate] = useState(0.08);
  const [sampleCount, setSampleCount] = useState(120000);
  const [featureCount, setFeatureCount] = useState(64);
  const [running, setRunning] = useState(false);
  const [latestGroup, setLatestGroup] = useState(null);

  const jobs = status?.state?.jobs || [];
  const peers = status?.peers || [];
  const workerCount = 1 + peers.length;

  const selectedInfo = useMemo(
    () => DATASET_CHOICES.find(item => item.value === dataset) || DATASET_CHOICES[0],
    [dataset]
  );

  const operation = dataset === "sklearn:diabetes" ? "regression" : "classification";
  const model = operation === "regression" ? "linear-regression" : "logistic-regression";
  const shardTarget = Math.max(2, workerCount * 2);

  const benchmarkSummary = useMemo(() => {
    const groups = new Map();

    jobs.forEach(job => {
      if (!job.benchmarkGroup) return;
      const group = groups.get(job.benchmarkGroup) || { id: job.benchmarkGroup, single: null, distributed: null };
      if (job.executionMode === "single") group.single = job;
      if (job.executionMode === "distributed") group.distributed = job;
      groups.set(job.benchmarkGroup, group);
    });

    const ordered = [...groups.values()]
      .sort((a, b) => (Number(b.distributed?.createdAt || b.single?.createdAt || 0) - Number(a.distributed?.createdAt || a.single?.createdAt || 0)));

    if (latestGroup) {
      return ordered.find(entry => entry.id === latestGroup) || ordered[0] || null;
    }

    return ordered[0] || null;
  }, [jobs, latestGroup]);

  const speedup = useMemo(() => {
    const single = benchmarkSummary?.single?.totalDurationMs;
    const distributed = benchmarkSummary?.distributed?.totalDurationMs;
    if (!single || !distributed) return null;
    if (distributed <= 0) return null;
    return Number((single / distributed).toFixed(2));
  }, [benchmarkSummary]);

  function applyLongRunProfile(profileId) {
    const profile = LONG_RUN_PROFILES.find(item => item.id === profileId);
    if (!profile) return;

    setEpochs(profile.values.epochs);
    setComputeMultiplier(profile.values.computeMultiplier);
    setSampleCount(profile.values.sampleCount);
    setFeatureCount(profile.values.featureCount);
    setLearningRate(profile.values.learningRate);
  }

  async function runBenchmarkPair() {
    setRunning(true);

    const groupId = `bench-${Date.now()}`;
    const basePayload = {
      dataset,
      operation,
      datasetProfile: "auto",
      model,
      epochs: Number(epochs),
      computeMultiplier: Number(computeMultiplier),
      learningRate: Number(learningRate),
      sampleCount: Number(sampleCount),
      featureCount: Number(featureCount),
      benchmarkGroup: groupId
    };

    try {
      await createTrainingJob({
        ...basePayload,
        executionMode: "single",
        benchmarkLabel: "Single-machine baseline",
        shards: 1
      });

      await createTrainingJob({
        ...basePayload,
        executionMode: "distributed",
        benchmarkLabel: "Distributed run",
        shards: shardTarget
      });

      setLatestGroup(groupId);
      addToast?.("Benchmark pair submitted (single + distributed)", "success");
    } catch (err) {
      addToast?.(err?.error || "Failed to submit benchmark pair", "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>Benchmark Runner</h1>
        <p>Launch paired runs to compare one-machine baseline versus distributed execution</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>Benchmark Configuration</h2>
        </div>
        <form className="job-form" onSubmit={(event) => { event.preventDefault(); runBenchmarkPair(); }}>
          <label>
            Dataset
            <select value={dataset} onChange={(event) => setDataset(event.target.value)}>
              {DATASET_CHOICES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            Operation
            <input value={operation} disabled />
          </label>

          <label>
            Model
            <input value={model} disabled />
          </label>

          <label>
            Epochs
            <input type="number" min="1" max="120" value={epochs} onChange={(event) => setEpochs(event.target.value)} />
          </label>

          <label>
            Compute Multiplier
            <input type="number" min="1" max="20" value={computeMultiplier} onChange={(event) => setComputeMultiplier(event.target.value)} />
          </label>

          <label>
            Learning Rate
            <input type="number" min="0.0001" max="1" step="0.0001" value={learningRate} onChange={(event) => setLearningRate(event.target.value)} />
          </label>

          <label>
            Sample Count
            <input type="number" min="200" max="300000" value={sampleCount} onChange={(event) => setSampleCount(event.target.value)} />
          </label>

          <label>
            Feature Count
            <input type="number" min="2" max="128" value={featureCount} onChange={(event) => setFeatureCount(event.target.value)} />
          </label>

          <label>
            Single Run Shards
            <input value="1" disabled />
          </label>

          <label>
            Distributed Shards
            <input value={shardTarget} disabled />
          </label>

          <button className="btn-primary" type="submit" disabled={running}>
            {running ? "Submitting..." : "Run Comparison Pair"}
          </button>
        </form>
        <div className="profile-row">
          {LONG_RUN_PROFILES.map(profile => (
            <button
              className="btn-outline"
              type="button"
              key={profile.id}
              disabled={running}
              onClick={() => applyLongRunProfile(profile.id)}
            >
              {profile.label}
            </button>
          ))}
        </div>
        <p style={{ marginBottom: 0, marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
          Selected dataset: {selectedInfo.label}. Workers detected: {workerCount}. Install scikit-learn on each machine to run these presets.
          Use the ~1/~2 minute profile buttons to quickly switch to long-running jobs.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Latest Benchmark Result</h2>
        </div>
        {!benchmarkSummary ? (
          <div className="empty" style={{ padding: 24 }}>
            <p>No benchmark pair has been run yet.</p>
          </div>
        ) : (
          <div className="benchmark-grid">
            <div className="benchmark-card">
              <h3>Single Machine</h3>
              <p>Status: <strong>{benchmarkSummary.single?.status || "Not started"}</strong></p>
              <p>Duration: <strong>{formatMs(benchmarkSummary.single?.totalDurationMs)}</strong></p>
              <p>Progress: <strong>{benchmarkSummary.single?.progressPct ?? 0}%</strong></p>
              <p>Accuracy: <strong>{formatMetric(benchmarkSummary.single?.aggregation?.accuracy)}</strong></p>
              <p>Loss: <strong>{formatMetric(benchmarkSummary.single?.aggregation?.loss)}</strong></p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${benchmarkSummary.single?.progressPct ?? 0}%` }} />
              </div>
            </div>
            <div className="benchmark-card">
              <h3>Distributed</h3>
              <p>Status: <strong>{benchmarkSummary.distributed?.status || "Not started"}</strong></p>
              <p>Duration: <strong>{formatMs(benchmarkSummary.distributed?.totalDurationMs)}</strong></p>
              <p>Progress: <strong>{benchmarkSummary.distributed?.progressPct ?? 0}%</strong></p>
              <p>Accuracy: <strong>{formatMetric(benchmarkSummary.distributed?.aggregation?.accuracy)}</strong></p>
              <p>Loss: <strong>{formatMetric(benchmarkSummary.distributed?.aggregation?.loss)}</strong></p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${benchmarkSummary.distributed?.progressPct ?? 0}%` }} />
              </div>
            </div>
            <div className="benchmark-summary">
              <h3>Comparison</h3>
              <p>
                {speedup
                  ? `Distributed speedup: ${speedup}x (higher is better)`
                  : "Speedup will appear after both runs are DONE."}
              </p>
              <p>
                Result access:
                {benchmarkSummary.single?.id ? ` GET /jobs/${benchmarkSummary.single.id}` : " -"}
              </p>
              <p>
                {benchmarkSummary.distributed?.id ? `GET /jobs/${benchmarkSummary.distributed.id}` : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
