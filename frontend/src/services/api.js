function getBaseUrl() {
  // In production, backend runs on same host but port 5000
  // In dev, Vite proxy handles it via /api prefix
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Use same hostname as frontend with backend port
  const port = import.meta.env.VITE_API_PORT || "5000";
  return `http://${window.location.hostname}:${port}`;
}

const BASE_URL = getBaseUrl();

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers }
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  } catch (err) {
    if (err.status) throw err;
    throw { error: "Network error — backend unreachable", offline: true };
  }
}

export async function getQueue() {
  return request("/queue");
}

export async function enqueueToken() {
  return request("/enqueue", { method: "POST" });
}

export async function dequeueToken() {
  return request("/dequeue", { method: "POST" });
}

export async function getStatus() {
  return request("/status");
}

export function getBaseUrlValue() {
  return BASE_URL;
}
