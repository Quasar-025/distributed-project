export default function NodeStatus({ status }) {
  return (
    <div>
      <h3>Node Status</h3>
      <p>Node ID: {status.nodeId}</p>
      <p>Connected Peers: {status.peerCount}</p>
    </div>
  );
}
