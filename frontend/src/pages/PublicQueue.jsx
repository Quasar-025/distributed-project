import { useEffect, useState } from "react";
import { getQueue } from "../services/api";
import useLiveQueue from "../hooks/useLiveQueue";
import QueueList from "../components/QueueList";

export default function PublicQueue() {
  const { queue, version, loading, refresh } = useLiveQueue();

  return (
    <div className="container">
      <div className="page-header">
        <h1>📋 Live Queue</h1>
        <p>Real-time view of the current queue</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">People Waiting</div>
          <div className="stat-value primary">{queue.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Est. Wait (last)</div>
          <div className="stat-value warning">
            {queue.length > 0 ? `~${queue.length * 3} min` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">State Version</div>
          <div className="stat-value">{version}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Queue ({queue.length})</h2>
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
