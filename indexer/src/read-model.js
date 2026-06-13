function parseSkills(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreShape(row) {
  return {
    successCount: row ? Number(row.success_count) : 0,
    failureCount: row ? Number(row.failure_count || 0) : 0,
    verifiedJobs: row ? Number(row.success_count) : 0,
    failedJobs: row ? Number(row.failure_count || 0) : 0,
    taskVolume: row ? Number(row.task_volume) : 0,
    reliabilityScore: row ? Number(row.reliability_score) : 0
  };
}

function proofShape(row) {
  if (!row) return null;
  return {
    id: row.job_id,
    jobId: Number(row.job_id),
    agentId: Number(row.agent_id),
    resultHash: row.result_hash,
    reasonHash: row.reason_hash,
    verified: Boolean(row.verified),
    failed: Boolean(row.failed),
    verificationStatus: row.failed ? "FAILED" : row.verified ? "VERIFIED" : "SUBMITTED",
    submittedTransactionHash: row.submitted_tx_hash,
    transactionHash: row.verified_tx_hash || row.failed_tx_hash || row.submitted_tx_hash,
    submittedBlock: row.submitted_block,
    verifiedBlock: row.verified_block,
    failedBlock: row.failed_block,
    verificationBlock: row.verified_block ? `Block ${row.verified_block}` : null,
    failureBlock: row.failed_block ? `Block ${row.failed_block}` : null,
    verificationTimestamp: null,
    failureTimestamp: null,
    createdAt: row.submitted_block ? `Block ${row.submitted_block}` : null
  };
}

function jobShape(row, proofRow = null) {
  const proof = proofShape(proofRow);
  return {
    id: Number(row.id),
    description: row.description,
    reward: Number(row.reward),
    status: row.status,
    assignedAgentId: row.assigned_agent_id == null ? null : Number(row.assigned_agent_id),
    creator: row.creator,
    createdAt: row.created_at ? `Block ${row.created_at}` : null,
    completedAt: row.completed_at ? `Block ${row.completed_at}` : null,
    transactionHash: row.created_tx_hash,
    acceptTransactionHash: row.accepted_tx_hash,
    completedTransactionHash: row.completed_tx_hash,
    proof: enrichProof(proof),
    proofStatus: proof ? proof.verificationStatus : "NONE",
    hasSubmittedProof: Boolean(proof && proof.submittedTransactionHash)
  };
}

function explorerTxUrl(hash) {
  const base = process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz";
  return hash ? `${base.replace(/\/$/, "")}/tx/${hash}` : null;
}

function contractUrl(address) {
  const base = process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz";
  return address ? `${base.replace(/\/$/, "")}/address/${address}` : null;
}

function enrichProof(proof) {
  if (!proof) return null;
  return {
    ...proof,
    transactionUrl: explorerTxUrl(proof.transactionHash),
    submittedTransactionUrl: explorerTxUrl(proof.submittedTransactionHash),
    contractAddress: process.env.PROOF_VERIFIER_ADDRESS || null,
    contractUrl: contractUrl(process.env.PROOF_VERIFIER_ADDRESS)
  };
}

function agentBase(row, db) {
  const scoreRow = db.prepare("SELECT * FROM scores WHERE agent_id = ?").get(row.id);
  const proofRows = db.prepare("SELECT * FROM proofs WHERE agent_id = ? ORDER BY COALESCE(verified_block, failed_block, submitted_block, 0)").all(row.id);
  const verifiedCount = proofRows.filter((proof) => Number(proof.verified) === 1).length;
  const failedCount = proofRows.filter((proof) => Number(proof.failed) === 1).length;
  const completedJobs = db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE assigned_agent_id = ? AND status = 'COMPLETED'").get(row.id).count;
  const proofs = proofRows.map(proofShape).map(enrichProof);
  return {
    id: Number(row.id),
    name: row.name,
    skills: parseSkills(row.skills),
    externalIdentifier: row.external_identifier,
    erc8004Id: row.external_identifier,
    owner: row.owner,
    registeredAt: row.registered_at ? new Date(Number(row.registered_at) * 1000).toISOString() : null,
    transactionHash: row.tx_hash,
    transactionUrl: explorerTxUrl(row.tx_hash),
    score: scoreShape(scoreRow),
    tasksCompleted: Number(completedJobs),
    verifiedJobsCount: verifiedCount,
    failedJobsCount: failedCount,
    successes: verifiedCount,
    failures: failedCount,
    successRate: scoreRow && Number(scoreRow.task_volume) > 0 ? Number(((Number(scoreRow.success_count) / Number(scoreRow.task_volume)) * 100).toFixed(2)) : 0,
    verificationRate: scoreRow && Number(scoreRow.task_volume) > 0 ? Number(((Number(scoreRow.success_count) / Number(scoreRow.task_volume)) * 100).toFixed(2)) : 0,
    proofs
  };
}

function withRanks(agents) {
  const rankedIds = [...agents]
    .sort((a, b) => b.score.reliabilityScore - a.score.reliabilityScore || b.score.taskVolume - a.score.taskVolume || a.id - b.id)
    .map((agent) => agent.id);
  const total = rankedIds.length || 1;
  return agents.map((agent) => {
    const rank = rankedIds.indexOf(agent.id) + 1;
    return {
      ...agent,
      globalRank: rank,
      percentileRank: Math.max(1, Math.round((rank / total) * 100))
    };
  });
}

function listAgents(db, { skill } = {}) {
  const rows = db.prepare("SELECT * FROM agents ORDER BY id").all();
  const agents = rows.map((row) => agentBase(row, db));
  const filtered = skill
    ? agents.filter((agent) => agent.skills.some((item) => item.toLowerCase().includes(String(skill).toLowerCase())))
    : agents;
  return withRanks(filtered);
}

function getAgent(db, id) {
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
  if (!row) return null;
  const agent = withRanks(listAgents(db)).find((item) => item.id === Number(id)) || agentBase(row, db);
  const jobs = db.prepare("SELECT * FROM jobs WHERE assigned_agent_id = ? ORDER BY id").all(id).map((job) => {
    const proof = db.prepare("SELECT * FROM proofs WHERE job_id = ?").get(job.id);
    return jobShape(job, proof);
  });
  const scoreHistory = scoreEventsForAgent(db, id);
  const scoreByJob = new Map(scoreHistory.map((point, index) => [
    point.jobId,
    {
      scoreBefore: index === 0 ? 0 : scoreHistory[index - 1].reliabilityScore,
      scoreAfter: point.reliabilityScore
    }
  ]));
  agent.proofs = agent.proofs.map((proof) => ({ ...proof, ...(scoreByJob.get(proof.jobId) || {}) }));
  const recentVerifiedJobs = agent.proofs
    .filter((proof) => proof.verified)
    .slice(-3)
    .reverse()
    .map((proof) => ({
      proof,
        job: jobs.find((job) => job.id === proof.jobId) || getJob(db, proof.jobId)
      }));
  const recentSubmissions = agent.proofs
    .filter((proof) => proof.verified || proof.failed)
    .slice(-5)
    .reverse()
    .map((proof) => ({
      proof,
      job: jobs.find((job) => job.id === proof.jobId) || getJob(db, proof.jobId)
    }));
  return { ...agent, jobs, recentVerifiedJobs, recentSubmissions, scoreHistory };
}

function scoreEventsForAgent(db, id) {
  return db
    .prepare("SELECT * FROM events WHERE event_name = 'ScoreUpdated' ORDER BY block_number, log_index")
    .all()
    .map((event) => ({ event, payload: JSON.parse(event.payload) }))
    .filter(({ payload }) => Number(payload.agentId) === Number(id))
    .map(({ event, payload }) => ({
      agentId: Number(payload.agentId),
      jobId: Number(payload.jobId),
      reliabilityScore: Number(payload.reliabilityScore),
      successCount: Number(payload.successCount),
      failureCount: Number(payload.failureCount || 0),
      taskVolume: Number(payload.taskVolume),
      createdAt: `Block ${event.block_number}`,
      transactionHash: event.tx_hash,
      transactionUrl: explorerTxUrl(event.tx_hash)
    }));
}

function getJob(db, id) {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
  if (!row) return null;
  const proof = db.prepare("SELECT * FROM proofs WHERE job_id = ?").get(id);
  return jobShape(row, proof);
}

function listJobs(db) {
  return db.prepare(`
    SELECT
      jobs.*,
      proofs.job_id AS proof_job_id,
      proofs.agent_id AS proof_agent_id,
      proofs.result_hash AS proof_result_hash,
      proofs.reason_hash AS proof_reason_hash,
      proofs.verified AS proof_verified,
      proofs.failed AS proof_failed,
      proofs.submitted_tx_hash AS proof_submitted_tx_hash,
      proofs.verified_tx_hash AS proof_verified_tx_hash,
      proofs.failed_tx_hash AS proof_failed_tx_hash,
      proofs.submitted_block AS proof_submitted_block,
      proofs.verified_block AS proof_verified_block,
      proofs.failed_block AS proof_failed_block
    FROM jobs
    LEFT JOIN proofs ON proofs.job_id = jobs.id
    ORDER BY jobs.id DESC
  `).all().map((row) => {
    const proof = row.proof_job_id == null
      ? null
      : {
          job_id: row.proof_job_id,
          agent_id: row.proof_agent_id,
          result_hash: row.proof_result_hash,
          reason_hash: row.proof_reason_hash,
          verified: row.proof_verified,
          failed: row.proof_failed,
          submitted_tx_hash: row.proof_submitted_tx_hash,
          verified_tx_hash: row.proof_verified_tx_hash,
          failed_tx_hash: row.proof_failed_tx_hash,
          submitted_block: row.proof_submitted_block,
          verified_block: row.proof_verified_block,
          failed_block: row.proof_failed_block
        };
    return jobShape(row, proof);
  });
}

function getLeaderboard(db, { skill } = {}) {
  return withRanks(listAgents(db, { skill })).sort((a, b) => a.globalRank - b.globalRank);
}

function getAgentReputation(db, id) {
  const agent = getAgent(db, id);
  if (!agent) return null;
  const uniquePositiveCounterparties = db
    .prepare("SELECT COUNT(*) AS count FROM pair_credits WHERE agent_id = ? AND positive_credits > 0")
    .get(id).count;
  return {
    agentId: agent.id,
    owner: agent.owner,
    score: agent.score.reliabilityScore,
    successes: agent.successes,
    failures: agent.failures,
    successRate: agent.successRate,
    taskVolume: agent.score.taskVolume,
    uniquePositiveCounterparties: Number(uniquePositiveCounterparties),
    rank: agent.globalRank,
    percentile: agent.percentileRank,
    source: "AtlasScore.ScoreUpdated events",
    contractAddress: process.env.ATLAS_SCORE_ADDRESS || null,
    contractUrl: contractUrl(process.env.ATLAS_SCORE_ADDRESS)
  };
}

function getAgentHistory(db, id) {
  const agent = getAgent(db, id);
  if (!agent) return null;
  return {
    agent: {
      id: agent.id,
      name: agent.name,
      owner: agent.owner,
      externalIdentifier: agent.externalIdentifier,
      skills: agent.skills
    },
    jobs: agent.jobs,
    submissions: agent.recentSubmissions,
    scoreHistory: agent.scoreHistory
  };
}

function getProofHistory(db, { agentId, jobId } = {}) {
  let sql = "SELECT * FROM proofs";
  const where = [];
  const args = [];
  if (agentId) {
    where.push("agent_id = ?");
    args.push(Number(agentId));
  }
  if (jobId) {
    where.push("job_id = ?");
    args.push(Number(jobId));
  }
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY COALESCE(verified_block, failed_block, submitted_block, 0) DESC";
  return db.prepare(sql).all(...args).map(proofShape).map(enrichProof);
}

function getScoreHistory(db, { agentId } = {}) {
  let rows = db.prepare("SELECT * FROM events WHERE event_name = 'ScoreUpdated' ORDER BY block_number, log_index").all();
  return rows
    .map((event) => ({ event, payload: JSON.parse(event.payload) }))
    .filter(({ payload }) => !agentId || Number(payload.agentId) === Number(agentId))
    .map(({ event, payload }) => ({
      agentId: Number(payload.agentId),
      jobId: Number(payload.jobId),
      successCount: Number(payload.successCount),
      failureCount: Number(payload.failureCount || 0),
      taskVolume: Number(payload.taskVolume),
      reliabilityScore: Number(payload.reliabilityScore),
      blockNumber: Number(event.block_number),
      blockHash: event.block_hash,
      transactionHash: event.tx_hash,
      transactionUrl: explorerTxUrl(event.tx_hash)
    }));
}

function recentEvents(db, limit = 30) {
  return db
    .prepare("SELECT * FROM events ORDER BY block_number DESC, log_index DESC LIMIT ?")
    .all(limit)
    .map((row) => {
      const payload = JSON.parse(row.payload);
      return {
        id: row.id,
        type: row.event_name,
        sequence: row.block_number * 100000 + row.log_index,
        timestamp: `Block ${row.block_number}`,
        transactionHash: row.tx_hash,
        transactionUrl: explorerTxUrl(row.tx_hash),
        payload: {
          ...payload,
          transactionHash: row.tx_hash,
          transactionUrl: explorerTxUrl(row.tx_hash),
          contractAddress: addressForContract(row.contract),
          contractUrl: contractUrl(addressForContract(row.contract))
        }
      };
    });
}

function protocolEvents(db, { eventName, agentId, jobId, limit = 100 } = {}) {
  const where = [];
  const args = [];
  if (eventName) {
    where.push("event_name = ?");
    args.push(String(eventName));
  }
  if (agentId) {
    where.push("CAST(json_extract(payload, '$.agentId') AS INTEGER) = ?");
    args.push(Number(agentId));
  }
  if (jobId) {
    where.push("CAST(json_extract(payload, '$.jobId') AS INTEGER) = ?");
    args.push(Number(jobId));
  }
  let sql = "SELECT * FROM events";
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  sql += " ORDER BY block_number DESC, log_index DESC LIMIT ?";
  args.push(Number(limit));
  return db.prepare(sql).all(...args)
    .map((row) => ({ row, payload: JSON.parse(row.payload) }))
    .map(({ row, payload }) => ({
      id: row.id,
      contract: row.contract,
      eventName: row.event_name,
      blockNumber: Number(row.block_number),
      blockHash: row.block_hash,
      logIndex: Number(row.log_index),
      transactionHash: row.tx_hash,
      transactionUrl: explorerTxUrl(row.tx_hash),
      payload
    }));
}

function indexerStatus(db) {
  const meta = Object.fromEntries(db.prepare("SELECT key, value FROM meta").all().map((row) => [row.key, row.value]));
  const deadLetters = db.prepare("SELECT COUNT(*) AS count FROM dead_letters").get().count;
  const blocks = db.prepare("SELECT COUNT(*) AS count FROM blocks").get().count;
  return {
    ...integritySnapshot(db),
    indexedBlocks: Number(blocks),
    deadLetters: Number(deadLetters),
    checkpoints: {
      lastBlock: meta.lastBlock ? Number(meta.lastBlock) : null,
      chainTip: meta.chainTip ? Number(meta.chainTip) : null,
      confirmations: meta.confirmations ? Number(meta.confirmations) : null,
      lastReplayFromBlock: meta.lastReplayFromBlock ? Number(meta.lastReplayFromBlock) : null,
      lastReplayToBlock: meta.lastReplayToBlock ? Number(meta.lastReplayToBlock) : null,
      lastReplayEventCount: meta.lastReplayEventCount ? Number(meta.lastReplayEventCount) : null
    }
  };
}

function addressForContract(contractName) {
  return {
    AgentRegistry: process.env.AGENT_REGISTRY_ADDRESS,
    JobManager: process.env.JOB_MANAGER_ADDRESS,
    ProofVerifier: process.env.PROOF_VERIFIER_ADDRESS,
    AtlasScore: process.env.ATLAS_SCORE_ADDRESS
  }[contractName] || null;
}

function integritySnapshot(db) {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  return {
    agents: Number(count("agents")),
    jobs: Number(count("jobs")),
    proofs: Number(count("proofs")),
    scores: Number(count("scores")),
    events: Number(count("events"))
  };
}

module.exports = {
  getAgent,
  getAgentHistory,
  getAgentReputation,
  getJob,
  getLeaderboard,
  getProofHistory,
  getScoreHistory,
  indexerStatus,
  integritySnapshot,
  listAgents,
  listJobs,
  protocolEvents,
  recentEvents
};
