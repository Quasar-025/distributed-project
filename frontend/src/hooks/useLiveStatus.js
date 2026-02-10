import { useEffect, useState, useCallback } from "react";
import { getStatus } from "../services/api";

export default function useLiveStatus(intervalMs = 3000) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    getStatus()
      .then(data => { setStatus(data); setError(null); })
      .catch(err => setError(err.error || "Failed to fetch status"));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { status, error, refresh };
}
