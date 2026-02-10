export default function QueueList({ queue, highlightId }) {
  if (!queue || queue.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">📭</div>
        <p>Queue is empty — no one is waiting</p>
      </div>
    );
  }

  return (
    <ul className="queue-list">
      {queue.map((item, index) => {
        const isHighlighted = highlightId && item.id === highlightId;
        return (
          <li
            key={item.id}
            className="queue-item"
            style={isHighlighted ? { background: "#eff6ff", borderRadius: 8, padding: "14px 12px" } : {}}
          >
            <div className="left-side">
              <div className="position">{index + 1}</div>
              <div className="token-info">
                <span className="token-id">{item.id}</span>
                <span className="token-meta">
                  {item.origin && `From ${item.origin}`}
                  {item.timestamp && ` • ${new Date(item.timestamp).toLocaleTimeString()}`}
                </span>
              </div>
            </div>
            <span className={`badge ${index === 0 ? "badge-serving" : "badge-waiting"}`}>
              {index === 0 ? "Next" : "Waiting"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
