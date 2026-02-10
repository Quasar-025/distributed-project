let queue = [];
let version = 0;

export function enqueue() {
  const token = {
    id: `${process.env.NODE_ID}-${Date.now()}`,
    timestamp: Date.now(),
    origin: process.env.NODE_ID,
    status: "WAITING"
  };
  queue.push(token);
  version++;
  return { queue, version };
}

export function dequeue() {
  if (queue.length > 0) {
    queue[0].status = "DONE";
    queue.shift();
    version++;
  }
  return { queue, version };
}

export function getState() {
  return { queue, version };
}

export function setState(newQueue, newVersion) {
  queue = newQueue;
  version = newVersion;
}

/**
 * Merge two queues: combine unique tokens (by id), sort by timestamp,
 * and set version to the sum of both versions (guarantees higher than either).
 */
export function mergeState(remoteQueue, remoteVersion) {
  const merged = new Map();

  // Add local tokens
  for (const token of queue) {
    merged.set(token.id, token);
  }

  // Add remote tokens (skip duplicates — local copy wins if same id)
  for (const token of remoteQueue) {
    if (!merged.has(token.id)) {
      merged.set(token.id, token);
    }
  }

  // Sort by timestamp ascending
  queue = [...merged.values()]
    .filter(t => t.status === "WAITING")
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // New version must be higher than both
  version = Math.max(version, remoteVersion) + 1;

  console.log(`Merged queue: ${queue.length} tokens, version ${version}`);
  return { queue, version };
}
