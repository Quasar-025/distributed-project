import { useState } from "react";
import { dequeueToken } from "../services/api";
import useLiveQueue from "../hooks/useLiveQueue";

export default function CounterView({ addToast }) {
  const { queue, loading, refresh } = useLiveQueue();
  const [served, setServed] = useState(null);
  const [processing, setProcessing] = useState(false);

  const nextToken = queue.length > 0 ? queue[0] : null;

  async function handleServeNext() {
    setProcessing(true);
    try {
      const prev = nextToken;
      await dequeueToken();
      setServed(prev);
      refresh();
      if (addToast) addToast("Token served!", "success");
    } catch (err) {
      if (addToast) addToast(err.error || "Failed to dequeue", "error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1>🖥️ Counter Panel</h1>
        <p>Serve the next person in the queue</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">In Queue</div>
          <div className="stat-value primary">{queue.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Served</div>
          <div className="stat-value success">
            {served ? served.id.split("-").pop() : "—"}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="now-serving">
          {nextToken ? (
            <>
              <div className="label">Next Up</div>
              <div className="number">{nextToken.id.split("-").pop()}</div>
              <div className="sublabel">
                From {nextToken.origin} • {new Date(nextToken.timestamp).toLocaleTimeString()}
              </div>
              <div style={{ marginTop: 24 }}>
                <button
                  className="btn-success btn-lg"
                  onClick={handleServeNext}
                  disabled={processing}
                >
                  {processing ? "Processing..." : "✅ Serve & Call Next"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <div className="empty-icon">✨</div>
              <p>No one is waiting — queue is clear!</p>
            </div>
          )}
        </div>
      </div>

      {queue.length > 1 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 12px" }}>Upcoming ({queue.length - 1})</h3>
          <ul className="queue-list">
            {queue.slice(1, 6).map((item, i) => (
              <li key={item.id} className="queue-item">
                <div className="left-side">
                  <div className="position">{i + 2}</div>
                  <div className="token-info">
                    <span className="token-id">{item.id}</span>
                    <span className="token-meta">
                      {item.origin} • {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {queue.length > 6 && (
              <li className="queue-item" style={{ color: "#64748b", justifyContent: "center" }}>
                +{queue.length - 6} more in queue
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
