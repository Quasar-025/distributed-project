let version = 0;

let state = {
  jobs: [],
  tasks: []
};

function now() {
  return Date.now();
}

function bumpVersion() {
  version += 1;
}

function buildQueueView() {
  return state.tasks
    .filter(task => task.status !== "DONE")
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(task => ({
      id: task.id,
      timestamp: task.createdAt,
      origin: task.createdBy,
      status: task.status,
      jobId: task.jobId,
      shard: task.shard
    }));
}

function summarizeJobs() {
  const active = state.jobs.filter(job => job.status !== "DONE").length;
  const completed = state.jobs.filter(job => job.status === "DONE").length;
  return {
    totalJobs: state.jobs.length,
    activeJobs: active,
    completedJobs: completed,
    waitingTasks: state.tasks.filter(t => t.status === "WAITING").length,
    processingTasks: state.tasks.filter(t => t.status === "PROCESSING").length,
    doneTasks: state.tasks.filter(t => t.status === "DONE").length
  };
}

function recalculateJobStatus(jobId) {
  const job = state.jobs.find(j => j.id === jobId);
  if (!job) return null;

  const jobTasks = state.tasks.filter(t => t.jobId === jobId);
  const doneCount = jobTasks.filter(t => t.status === "DONE").length;
  const processingCount = jobTasks.filter(t => t.status === "PROCESSING").length;
  const totalTasks = jobTasks.length;

  job.totalTasks = totalTasks;
  job.doneTasks = doneCount;
  job.processingTasks = processingCount;
  job.progressPct = totalTasks > 0 ? Number(((doneCount / totalTasks) * 100).toFixed(1)) : 0;
  job.cpuDurationMs = jobTasks.reduce((sum, t) => sum + (t.result?.durationMs || 0), 0);

  if (doneCount === totalTasks && totalTasks > 0) {
    job.status = "DONE";
    job.completedAt = now();
    job.totalDurationMs = Math.max(0, job.completedAt - job.createdAt);

    const accuracy = jobTasks.reduce((sum, t) => sum + (t.result?.accuracy || 0), 0) / jobTasks.length;
    const loss = jobTasks.reduce((sum, t) => sum + (t.result?.loss || 0), 0) / jobTasks.length;

    job.aggregation = {
      method: "mean",
      shards: jobTasks.length,
      accuracy: Number(accuracy.toFixed(4)),
      loss: Number(loss.toFixed(4))
    };
  } else if (processingCount > 0) {
    job.status = "PROCESSING";
    job.totalDurationMs = null;
  } else {
    job.status = "WAITING";
    job.totalDurationMs = null;
  }

  return job;
}

function snapshot() {
  return {
    version,
    queue: buildQueueView(),
    jobs: state.jobs,
    tasks: state.tasks,
    summary: summarizeJobs()
  };
}

export function submitTrainingJob({
  dataset = "synthetic.csv",
  operation = "classification",
  datasetProfile = "auto",
  model = "logistic-regression",
  executionMode = "distributed",
  benchmarkGroup = null,
  benchmarkLabel = null,
  shards = 4,
  epochs = 3,
  learningRate = 0.1,
  sampleCount = 600,
  featureCount = 2,
  computeMultiplier = 1,
  createdBy = process.env.NODE_ID || "unknown"
} = {}) {
  const shardCount = Math.max(1, Math.min(32, Number(shards) || 1));
  const createdAt = now();
  const jobId = `job-${createdBy}-${createdAt}`;

  const taskIds = [];
  for (let shard = 1; shard <= shardCount; shard += 1) {
    const taskId = `${jobId}-task-${shard}`;
    taskIds.push(taskId);
    state.tasks.push({
      id: taskId,
      jobId,
      shard,
      status: "WAITING",
      createdAt,
      updatedAt: createdAt,
      createdBy,
      assignedTo: null,
      leaseUntil: null,
      attempts: 0,
      payload: {
        dataset,
        operation,
        datasetProfile,
        model,
        epochs,
        learningRate,
        sampleCount,
        featureCount,
        computeMultiplier,
        totalShards: shardCount,
        shardIndex: shard
      }
    });
  }

  state.jobs.push({
    id: jobId,
    dataset,
    operation,
    datasetProfile,
    model,
    executionMode,
    benchmarkGroup,
    benchmarkLabel,
    epochs,
    learningRate,
    sampleCount,
    featureCount,
    computeMultiplier,
    createdBy,
    createdAt,
    status: "WAITING",
    progressPct: 0,
    totalTasks: shardCount,
    doneTasks: 0,
    processingTasks: 0,
    totalDurationMs: null,
    cpuDurationMs: 0,
    taskIds,
    aggregation: null
  });

  bumpVersion();
  return { jobId, ...snapshot() };
}

export function enqueue() {
  return submitTrainingJob({ shards: 1 });
}

export function dequeue() {
  const next = state.tasks
    .filter(task => task.status !== "DONE")
    .sort((a, b) => a.createdAt - b.createdAt)[0];

  if (!next) {
    return snapshot();
  }

  next.status = "DONE";
  next.updatedAt = now();
  next.assignedTo = next.assignedTo || "manual-counter";
  next.result = next.result || { accuracy: 1, loss: 0 };

  recalculateJobStatus(next.jobId);
  bumpVersion();
  return snapshot();
}

export function getNextWaitingTask() {
  const waiting = state.tasks
    .filter(task => task.status === "WAITING")
    .sort((a, b) => a.createdAt - b.createdAt);
  return waiting[0] || null;
}

export function assignTask(taskId, workerId, leaseMs = 12000) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== "WAITING") return null;

  task.status = "PROCESSING";
  task.assignedTo = workerId;
  task.updatedAt = now();
  task.leaseUntil = now() + leaseMs;
  task.attempts += 1;

  recalculateJobStatus(task.jobId);
  bumpVersion();
  return task;
}

export function completeTask(taskId, workerId, result) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return null;

  task.status = "DONE";
  task.assignedTo = workerId || task.assignedTo;
  task.updatedAt = now();
  task.leaseUntil = null;
  task.result = result || null;

  const job = recalculateJobStatus(task.jobId);
  bumpVersion();
  return { task, job };
}

export function requeueExpiredTasks() {
  const current = now();
  let changed = false;

  for (const task of state.tasks) {
    if (task.status === "PROCESSING" && task.leaseUntil && task.leaseUntil < current) {
      task.status = "WAITING";
      task.updatedAt = current;
      task.assignedTo = null;
      task.leaseUntil = null;
      changed = true;
      recalculateJobStatus(task.jobId);
    }
  }

  if (changed) bumpVersion();
  return changed;
}

export function requeueWorkerTasks(workerId) {
  let changed = false;

  for (const task of state.tasks) {
    if (task.status === "PROCESSING" && task.assignedTo === workerId) {
      task.status = "WAITING";
      task.assignedTo = null;
      task.leaseUntil = null;
      task.updatedAt = now();
      changed = true;
      recalculateJobStatus(task.jobId);
    }
  }

  if (changed) bumpVersion();
  return changed;
}

export function requeueTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status === "DONE") return false;

  task.status = "WAITING";
  task.assignedTo = null;
  task.leaseUntil = null;
  task.updatedAt = now();

  recalculateJobStatus(task.jobId);
  bumpVersion();
  return true;
}

export function getJobs() {
  return state.jobs;
}

export function getJob(jobId) {
  const job = state.jobs.find(item => item.id === jobId);
  if (!job) return null;

  return {
    ...job,
    tasks: state.tasks
      .filter(task => task.jobId === jobId)
      .sort((a, b) => a.shard - b.shard)
  };
}

export function getState() {
  return snapshot();
}

export function setState(newState, newVersion) {
  if (!newState || typeof newState !== "object") return;

  state = {
    jobs: Array.isArray(newState.jobs) ? newState.jobs : [],
    tasks: Array.isArray(newState.tasks) ? newState.tasks : []
  };
  version = Number(newVersion) || 0;
}

export function mergeState(remoteState, remoteVersion) {
  const remoteV = Number(remoteVersion) || 0;
  if (remoteV <= version || !remoteState) {
    return snapshot();
  }

  setState(remoteState, remoteV);
  return snapshot();
}
