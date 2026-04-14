import { useMemo } from "react";
import useLiveStatus from "../hooks/useLiveStatus";

export default function CounterView() {
  const { status, error } = useLiveStatus(3000);

  const tasks = status?.state?.tasks || [];
  const peers = status?.peers || [];
  const workers = useMemo(
    () => [status?.nodeId, ...peers.map(peer => peer.peerId)].filter(Boolean),
    [status?.nodeId, peers]
  );

  const rows = useMemo(() => {
    return workers.map(workerId => {
      const assigned = tasks.filter(task => task.assignedTo === workerId);
      const done = assigned.filter(task => task.status === "DONE").length;
      const processing = assigned.filter(task => task.status === "PROCESSING").length;
      const failedRetries = assigned.filter(task => task.status === "WAITING" && task.attempts > 1).length;
      const totalAssigned = assigned.length;
      const completionPct = totalAssigned > 0 ? Math.round((done / totalAssigned) * 100) : 0;
      const avgMs = done > 0
        ? Math.round(assigned.filter(task => task.status === "DONE").reduce((sum, task) => sum + (task.result?.durationMs || 0), 0) / done)
        : null;

      return {
        workerId,
        totalAssigned,
        done,
        processing,
        failedRetries,
        completionPct,
        avgMs
      };
    });
  }, [workers, tasks]);

  return (
    <div className="container">
      <div className="page-header">
        <h1>Node Progress</h1>
        <p>Task assignment and completion progress for each machine in the cluster</p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Workers Seen</div>
          <div className="stat-value primary">{workers.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{tasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cluster Running</div>
          <div className="stat-value warning">{tasks.filter(task => task.status === "PROCESSING").length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cluster Done</div>
          <div className="stat-value success">{tasks.filter(task => task.status === "DONE").length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Per-Machine Assignment Progress</h2>
        </div>
        {rows.length === 0 ? (
          <div className="empty" style={{ padding: 24 }}>
            <p>No workers discovered yet.</p>
          </div>
        ) : (
          <div className="worker-progress-list">
            {rows.map(row => (
              <div className="worker-progress-card" key={row.workerId}>
                <div className="worker-progress-header">
                  <strong>{row.workerId}</strong>
                  <span>{row.done}/{row.totalAssigned || 0} completed</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${row.completionPct}%` }} />
                </div>
                <div className="worker-progress-meta">
                  <span>{row.processing} running</span>
                  <span>{row.failedRetries} retried</span>
                  <span>{row.avgMs ? `avg ${row.avgMs} ms` : "avg -"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
