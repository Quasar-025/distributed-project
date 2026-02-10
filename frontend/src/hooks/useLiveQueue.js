import { useEffect, useState, useCallback } from "react";
import { getQueue } from "../services/api";
import { subscribe, connectSocket } from "../services/socket";

export default function useLiveQueue() {
  const [queue, setQueue] = useState([]);
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    getQueue()
      .then(data => {
        setQueue(data.queue || []);
        setVersion(data.version || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    connectSocket();

    const unsub = subscribe(msg => {
      if (msg.type === "_CONNECTED") setConnected(true);
      if (msg.type === "_DISCONNECTED") setConnected(false);

      if (msg.type === "STATE" || msg.type === "SYNC") {
        setQueue(msg.queue || []);
        setVersion(msg.version || 0);
      }

      if (msg.type === "LEADER") {
        // Refresh to get latest state after election
        refresh();
      }
    });

    return unsub;
  }, [refresh]);

  return { queue, version, connected, loading, refresh };
}
