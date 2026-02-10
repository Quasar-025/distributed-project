import { useEffect, useState } from "react";
import { getStatus } from "../services/api";
import useLiveStatus from "../hooks/useLiveStatus";
import useLiveQueue from "../hooks/useLiveQueue";

export default function AdminDashboard() {
  const { status, error, refresh } = useLiveStatus(3000);
  const { queue, version, connected } = useLiveQueue();

  return (
    <div className="container">
      <div className="page-header">
        <h1>⚙️ Admin Dashboard</h1>
        <p>System health and cluster monitoring</p>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid var(--danger)", marginBottom: 16 }}>
          ⚠️ {error}
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
      </div>
    </div>
  );
}
