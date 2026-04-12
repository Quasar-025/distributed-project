export default function NodeStatus({ status }) {
  if (!status) return null;

  const peers = status.peers || [];
  const summary = status.state?.summary;

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
      </p>
      <p style={{ margin: "4px 0", fontSize: 14, color: "#64748b" }}>
        <strong>Peers:</strong> {peers.length}
      </p>
      <p style={{ margin: "4px 0", fontSize: 14, color: "#64748b" }}>
        <strong>Tasks:</strong> {summary ? `${summary.waitingTasks} waiting, ${summary.processingTasks} processing` : "—"}
      </p>


      {peers.length > 0 && (
        <ul className="peer-list" style={{ marginTop: 8 }}>
          {peers.map((peer) => (
            <li className="peer-item" key={peer.peerId}>
              <span className="peer-id">{peer.peerId}</span>
              <span className="peer-url">{peer.httpUrl || "unknown"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
