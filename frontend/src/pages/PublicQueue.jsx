import { useEffect, useState } from "react";
import { getQueue } from "../services/api";
import QueueList from "../components/QueueList";

export default function PublicQueue() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    getQueue().then(data => setQueue(data.queue));
  }, []);

  return (
    <div>
      <h1>Live Queue</h1>
      <QueueList queue={queue} />
    </div>
  );
}
