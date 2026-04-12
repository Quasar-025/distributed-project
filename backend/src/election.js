import { peers } from "./sync.js";

let currentLeader = null;
let isLeader = false;
let electionInProgress = false;

function nodeRank(nodeId) {
  const match = String(nodeId).match(/(\d+)$/);
  if (!match) return Number.MIN_SAFE_INTEGER;
  return Number(match[1]);
}

function isHigherPriority(candidateId, selfId) {
  const candidateRank = nodeRank(candidateId);
  const selfRank = nodeRank(selfId);

  if (candidateRank === selfRank) {
    return String(candidateId) > String(selfId);
  }
  return candidateRank > selfRank;
}

export function startElection(selfId) {
  if (electionInProgress) return;

  electionInProgress = true;
  console.log("Starting leader election");

  let higherNodeFound = false;

  peers.forEach((peer, peerId) => {
    if (isHigherPriority(peerId, selfId)) {
      higherNodeFound = true;
      try {
        peer.ws.send(JSON.stringify({ type: "ELECTION", from: selfId }));
      } catch {}
    }
  });

  if (!higherNodeFound) {
    becomeLeader(selfId);
  } else {
    // We're not the highest — wait for the higher node to declare
    // Timeout fallback in case the higher node doesn't respond
    setTimeout(() => {
      if (!currentLeader) {
        console.log("Election timeout — becoming leader by default");
        becomeLeader(selfId);
      }
    }, 5000);
  }
}

function becomeLeader(selfId) {
  handleLeaderMessage(selfId);
  console.log(`Node ${selfId} became LEADER`);

  peers.forEach(peer => {
    try {
      peer.ws.send(JSON.stringify({
        type: "LEADER",
        leaderId: selfId
      }));
    } catch {}
  });
}

export function handleLeaderMessage(leaderId) {
  if (currentLeader === leaderId) return false;
  
  currentLeader = leaderId;
  isLeader = leaderId === process.env.NODE_ID;
  electionInProgress = false;
  console.log(`Leader confirmed: ${leaderId} (isLeader: ${isLeader})`);
  return true;
}

export function resetLeader() {
  currentLeader = null;
  isLeader = false;
  electionInProgress = false;
  console.log("Leader reset — ready for new election");
}

export function getLeader() {
  return currentLeader;
}

export function amILeader() {
  return isLeader;
}
