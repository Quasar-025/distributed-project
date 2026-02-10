export default function NodeStatus({ status }) {
  if (!status) return null;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Node Info</h2>
        {status.isLeader && <span className="leader-badge">👑 Leader</span>}
      </div>
      <p style={{ margin: "4px 0", fontSize: 14, color: "#64748b" }}>
        <strong>Node:</strong> {status.nodeId}
      </p>
      <p style={{ margin: "4px 0", fontSize: 14, color: "#64748b" }}>
        <strong>Leader:</strong> {status.leader || "Electing..."}
