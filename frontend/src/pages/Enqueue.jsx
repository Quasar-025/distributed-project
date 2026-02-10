import { useState } from "react";
import { enqueueToken } from "../services/api";
import useLiveQueue from "../hooks/useLiveQueue";

export default function Enqueue({ addToast }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const { queue } = useLiveQueue();

  async function handleEnqueue() {
    setLoading(true);
    try {
      const data = await enqueueToken();
      const newToken = data.queue[data.queue.length - 1];
      setToken(newToken);
      if (addToast) addToast("Token generated successfully!", "success");
    } catch (err) {
      if (addToast) addToast(err.error || "Failed to get token", "error");
    } finally {
      setLoading(false);
    }
  }

  // Find position of current token in queue
  const position = token ? queue.findIndex((t) => t.id === token.id) + 1 : 0;

  return (
    <div className="container">
      <div className="page-header">
        <h1>🎫 Get Your Token</h1>
        <p>Press the button to join the queue</p>
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <button
          className="btn-primary btn-lg"
          onClick={handleEnqueue}
          disabled={loading}
        >
          {loading ? "Generating..." : "🎟️  Generate Token"}
        </button>

        {token && (
          <div className="ticket">
            <div className="ticket-label">Your Token</div>
            <div className="ticket-number">
              {token.id.split("-").pop()}
            </div>
            <div className="ticket-time">
              Issued at {new Date(token.timestamp).toLocaleTimeString()}
            </div>
            {position > 0 && (
              <div className="ticket-position">
                📍 Position in queue: <strong>{position}</strong>
                {position > 1 && ` • Est. wait: ~${(position - 1) * 3} min`}
              </div>
            )}
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 16, marginBottom: 0 }}>
              Full ID: {token.id}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
