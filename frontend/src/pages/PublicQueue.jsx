import useLiveQueue from "../hooks/useLiveQueue";
import QueueList from "../components/QueueList";

export default function PublicQueue() {
  const { queue, version, summary, loading, refresh } = useLiveQueue();

  return (
    <div className="container">
      <div className="page-header">
        <h1>Cluster Monitor</h1>
        <p>Real-time task flow across the distributed training cluster</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Queued Tasks</div>
          <div className="stat-value primary">{summary?.waitingTasks ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Running Tasks</div>
          <div className="stat-value warning">
            {summary?.processingTasks ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed Tasks</div>
          <div className="stat-value success">{summary?.doneTasks ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">State Version</div>
          <div className="stat-value">{version}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Jobs</div>
          <div className="stat-value primary">{summary?.activeJobs ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Live Task Queue ({queue.length})</h2>
          <button className="btn-outline" onClick={refresh} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
        {loading ? (
          <div className="empty"><p>Loading...</p></div>
        ) : (
          <QueueList queue={queue} />
        )}
      </div>
    </div>
  );
}
