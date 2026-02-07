let queue = [];
let version = 0;

export function enqueue() {
  const token = {
    id: `${Date.now()}`,
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
