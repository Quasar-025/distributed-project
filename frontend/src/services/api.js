const DEFAULT_BACKEND_PORTS = ["5000", "5001"];
let activeBaseUrl = null;

export function getBaseUrlCandidates() {
  if (import.meta.env.VITE_API_URL) return [import.meta.env.VITE_API_URL];

  const host = window.location.hostname;
  const configuredPort = import.meta.env.VITE_API_PORT;
  const ports = configuredPort
    ? [configuredPort, ...DEFAULT_BACKEND_PORTS.filter(p => p !== configuredPort)]
    : DEFAULT_BACKEND_PORTS;

  return ports.map(port => `http://${host}:${port}`);
}

function getPrioritizedBaseUrls() {
  const candidates = getBaseUrlCandidates();
  if (!activeBaseUrl || !candidates.includes(activeBaseUrl)) return candidates;
  return [activeBaseUrl, ...candidates.filter(url => url !== activeBaseUrl)];
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  let lastNetworkError = null;

  for (const baseUrl of getPrioritizedBaseUrls()) {
    const url = `${baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers }
      });
      const data = await readJsonSafe(res);
      activeBaseUrl = baseUrl;
      if (!res.ok) throw { status: res.status, ...data };
      return data;
    } catch (err) {
      if (err.status) throw err;
      lastNetworkError = err;
    }
  }

  if (lastNetworkError?.status) throw lastNetworkError;
  throw { error: "Network error — backend unreachable", offline: true };
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

export async function createTrainingJob(payload) {
  return request("/jobs", {
    method: "POST",
    body: JSON.stringify(payload || {})
  });
}

export async function getJobs() {
  return request("/jobs");
}

export async function getJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export function getBaseUrlValue() {
  return activeBaseUrl || getBaseUrlCandidates()[0];
}
