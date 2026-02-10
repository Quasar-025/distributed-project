const BASE_URL = "http://localhost:5000";

export async function getQueue() {
  const res = await fetch(`${BASE_URL}/queue`);
  return res.json();
}

export async function enqueueToken() {
  const res = await fetch(`${BASE_URL}/enqueue`, {
    method: "POST"
  });
  return res.json();
}

export async function dequeueToken() {
  const res = await fetch(`${BASE_URL}/dequeue`, {
    method: "POST"
  });
  return res.json();
}

export async function getStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  return res.json();
}
