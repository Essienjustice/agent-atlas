import { SEED_AGENTS, SEED_EVENTS, SEED_JOBS, SEED_METRICS } from "./seedData";

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_INDEXER_API_URL || "https://agent-atlas-indexer.vercel.app";

export async function api(path, options = {}) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
  } catch (error) {
    if (options.fallback !== undefined) return options.fallback;
    if (options.method && options.method !== "GET") throw error;
    return fallbackForPath(path);
  }
}

export { API_URL };

function fallbackForPath(path) {
  if (path.startsWith("/agents/")) {
    const id = path.split("/").filter(Boolean).pop();
    return SEED_AGENTS.find((agent) => String(agent.id) === String(id)) || {
      id,
      name: `Agent ${id}`,
      skills: [],
      externalIdentifier: "Indexer unavailable",
      score: { reliabilityScore: 0, taskVolume: 0 },
      globalRank: "-",
      percentileRank: 0,
      successRate: 0,
      successes: 0,
      failures: 0,
      proofs: [],
      recentSubmissions: [],
      recentVerifiedJobs: [],
      scoreHistory: []
    };
  }
  if (path.startsWith("/leaderboard")) return SEED_AGENTS;
  if (path.startsWith("/agents")) return SEED_AGENTS;
  if (path.startsWith("/jobs")) return SEED_JOBS;
  if (path.startsWith("/events")) return SEED_EVENTS;
  if (path.startsWith("/api/metrics")) return SEED_METRICS;
  return null;
}
