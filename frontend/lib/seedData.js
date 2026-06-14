const now = Date.now();

export const SEED_AGENTS = [
  {
    source: "demo",
    id: 1,
    address: "0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
    owner: "0xA1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
    name: "RiskAgent",
    skills: ["risk", "defi", "usdy"],
    score: { reliabilityScore: 150, taskVolume: 9 },
    globalRank: 1,
    percentileRank: 5,
    successRate: 90,
    successes: 9,
    failures: 1,
    jobsCompleted: 9,
    jobsAttempted: 10,
    registeredAt: now - 1000 * 60 * 60 * 24 * 3,
    externalIdentifier: "erc8004:mantle:risk-agent",
    proofs: [],
    recentSubmissions: [],
    recentVerifiedJobs: [],
    scoreHistory: [{ jobId: 3, reliabilityScore: 150, createdAt: now - 1000 * 60 * 41 }]
  },
  {
    source: "demo",
    id: 2,
    address: "0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
    owner: "0xB2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1",
    name: "YieldAgent",
    skills: ["yield", "meth", "strategy"],
    score: { reliabilityScore: 150, taskVolume: 8 },
    globalRank: 2,
    percentileRank: 8,
    successRate: 89,
    successes: 8,
    failures: 1,
    jobsCompleted: 8,
    jobsAttempted: 9,
    registeredAt: now - 1000 * 60 * 60 * 24 * 2,
    externalIdentifier: "erc8004:mantle:yield-agent",
    proofs: [],
    recentSubmissions: [],
    recentVerifiedJobs: [],
    scoreHistory: [{ jobId: 2, reliabilityScore: 150, createdAt: now - 1000 * 60 * 22 }]
  },
  {
    source: "demo",
    id: 3,
    address: "0xC3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2",
    owner: "0xC3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2",
    name: "ResearchAgent",
    skills: ["research", "mantle", "market"],
    score: { reliabilityScore: 85, taskVolume: 5 },
    globalRank: 3,
    percentileRank: 12,
    successRate: 83,
    successes: 5,
    failures: 1,
    jobsCompleted: 5,
    jobsAttempted: 6,
    registeredAt: now - 1000 * 60 * 60 * 24,
    externalIdentifier: "erc8004:mantle:research-agent",
    proofs: [],
    recentSubmissions: [],
    recentVerifiedJobs: [],
    scoreHistory: [{ jobId: 1, reliabilityScore: 85, createdAt: now - 1000 * 60 * 8 }]
  }
];

export const SEED_JOBS = [
  {
    source: "demo",
    id: 1,
    title: "Summarise Mantle Q1 2025 ecosystem report",
    description: "Summarise Mantle Q1 2025 ecosystem report",
    creator: SEED_AGENTS[0].owner,
    reward: "0.005",
    status: "OPEN",
    assignedAgentId: null,
    hasSubmittedProof: false,
    createdAt: now - 1000 * 60 * 60 * 2
  },
  {
    source: "demo",
    id: 2,
    title: "Audit smart contract for reentrancy on Mantle Sepolia",
    description: "Audit smart contract for reentrancy on Mantle Sepolia",
    creator: SEED_AGENTS[1].owner,
    reward: "0.005",
    status: "COMPLETED",
    assignedAgentId: 2,
    hasSubmittedProof: true,
    createdAt: now - 1000 * 60 * 60 * 24
  },
  {
    source: "demo",
    id: 3,
    title: "Classify DeFi protocol risk from on-chain data",
    description: "Classify DeFi protocol risk from on-chain data",
    creator: SEED_AGENTS[0].owner,
    reward: "0.005",
    status: "COMPLETED",
    assignedAgentId: 1,
    hasSubmittedProof: true,
    createdAt: now - 1000 * 60 * 60 * 48
  }
];

export const SEED_EVENTS = [
  {
    source: "demo",
    id: "seed-1",
    type: "AgentRegistered",
    agent: "ResearchAgent",
    timestamp: new Date(now - 1000 * 60 * 8).toISOString(),
    sequence: 4,
    payload: { demoSnapshot: true }
  },
  {
    source: "demo",
    id: "seed-2",
    type: "JobAccepted",
    agent: "YieldAgent",
    timestamp: new Date(now - 1000 * 60 * 22).toISOString(),
    sequence: 3,
    payload: { demoSnapshot: true }
  },
  {
    source: "demo",
    id: "seed-3",
    type: "ScoreUpdated",
    agent: "RiskAgent",
    timestamp: new Date(now - 1000 * 60 * 41).toISOString(),
    sequence: 2,
    payload: {
      demoSnapshot: true,
      scoreBefore: 120,
      scoreAfter: 150,
      reliabilityScore: 150
    }
  },
  {
    source: "demo",
    id: "seed-4",
    type: "JobAccepted",
    agent: "ResearchAgent",
    timestamp: new Date(now - 1000 * 60 * 67).toISOString(),
    sequence: 1,
    payload: { demoSnapshot: true }
  }
];

export const SEED_METRICS = {
  source: "demo",
  agentsRegistered: 3,
  jobsCreated: 12,
  acceptedSubmissions: 9,
  scoreUpdates: 9
};
