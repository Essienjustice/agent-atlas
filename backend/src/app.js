const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { listDeadLetters, openIndexerDb } = require("../../indexer/src/store");
const {
  getAgent,
  getAgentHistory,
  getAgentReputation,
  getLeaderboard,
  getProofHistory,
  getScoreHistory,
  indexerStatus,
  integritySnapshot,
  listAgents,
  listJobs,
  protocolEvents,
  recentEvents
} = require("../../indexer/src/read-model");
const { acceptJobOnChain, buildUnsignedTransaction, createJobOnChain, isChainMode, markJobFailedOnChain, submitProofOnChain } = require("./chain");

function createApp(options = {}) {
  const app = express();
  const db = options.db || openIndexerDb();
  const appMode = process.env.APP_MODE === "polish" ? "polish" : "mvp";
  const demoMode = process.env.DEMO_MODE === "true";
  const demoDay = process.env.DEMO_DAY === "true";

  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      service: "agent-atlas-backend",
      network: "mantle-sepolia",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/events", streamIndexedEvents(db));
  app.get("/events/recent", (req, res) => res.json(recentEvents(db)));
  app.get("/debug/dead-letters", (req, res) => res.json(listDeadLetters(db)));
  app.get("/api/metrics", (req, res) => {
    try {
      return res.json(metricsSnapshot(db));
    } catch (error) {
      return res.status(200).json({
        ok: false,
        source: "indexer-sqlite",
        error: error.message,
        agentsRegistered: 0,
        jobsCreated: 0,
        acceptedSubmissions: 0,
        scoreUpdates: 0,
        eventsIndexed: 0
      });
    }
  });

  app.get("/agents", (req, res) => res.json(listAgents(db)));
  app.get("/agents/:id", (req, res) => {
    const agent = getAgent(db, Number(req.params.id));
    if (!agent) return res.status(404).json({ error: "Agent not found in indexed chain state" });
    return res.json(agent);
  });
  app.get("/leaderboard", (req, res) => res.json(getLeaderboard(db, { skill: req.query.skill })));
  app.get("/jobs", (req, res) => res.json(listJobs(db)));

  app.get("/protocol/v1/status", (req, res) => res.json(indexerStatus(db)));
  app.get("/protocol/v1/reputation/:agentId", (req, res) => {
    const reputation = getAgentReputation(db, Number(req.params.agentId));
    if (!reputation) return res.status(404).json({ error: "Agent not found in indexed chain state" });
    return res.json(reputation);
  });
  app.get("/protocol/v1/agents/:agentId/history", (req, res) => {
    const history = getAgentHistory(db, Number(req.params.agentId));
    if (!history) return res.status(404).json({ error: "Agent not found in indexed chain state" });
    return res.json(history);
  });
  app.get("/protocol/v1/proofs", (req, res) => res.json(getProofHistory(db, req.query)));
  app.get("/protocol/v1/scores", (req, res) => res.json(getScoreHistory(db, req.query)));
  app.get("/protocol/v1/events", (req, res) => res.json(protocolEvents(db, req.query)));
  app.post("/protocol/v1/transactions", (req, res) => {
    try {
      const tx = buildUnsignedTransaction({ action: req.body.action, params: req.body.params || {} });
      return res.json({ transaction: tx, signer: "caller-wallet" });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post("/jobs/create", requireServerSigner, async (req, res) => {
    const { description, reward = 0 } = req.body;
    if (!description) return res.status(400).json({ error: "description is required" });
    try {
      const chain = await createJobOnChain({ description, reward: Number(reward) || 0 });
      return res.status(202).json({ submitted: true, ...chain });
    } catch (error) {
      return res.status(502).json({ error: `On-chain job creation failed: ${error.message}` });
    }
  });

  app.post("/jobs/:id/accept", requireServerSigner, async (req, res) => {
    const agent = getAgent(db, Number(req.body.agentId));
    if (!agent) return res.status(404).json({ error: "Agent not found in indexed chain state" });
    try {
      const chain = await acceptJobOnChain({ jobId: Number(req.params.id), agent });
      return res.status(202).json({ submitted: true, ...chain });
    } catch (error) {
      return res.status(502).json({ error: `On-chain job acceptance failed: ${error.message}` });
    }
  });

  app.post("/jobs/:id/submit-proof", requireServerSigner, async (req, res) => {
    const job = listJobs(db).find((item) => item.id === Number(req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found in indexed chain state" });
    if (job.status !== "ASSIGNED") return res.status(409).json({ error: "Job is not assigned in indexed chain state" });

    const result = req.body.result || `${job.description}:${Date.now()}`;
    const resultHash = req.body.resultHash || `0x${crypto.createHash("sha256").update(result).digest("hex")}`;
    try {
      const chain = await submitProofOnChain({ jobId: job.id, agentId: job.assignedAgentId, resultHash });
      return res.status(202).json({ submitted: true, resultHash, ...chain });
    } catch (error) {
      return res.status(502).json({ error: `On-chain proof submission failed: ${error.message}` });
    }
  });

  app.post("/jobs/:id/mark-failed", requireServerSigner, async (req, res) => {
    const job = listJobs(db).find((item) => item.id === Number(req.params.id));
    if (!job) return res.status(404).json({ error: "Job not found in indexed chain state" });
    if (job.status !== "ASSIGNED") return res.status(409).json({ error: "Job is not assigned in indexed chain state" });

    const reason = req.body.reason || `failed:${job.id}:${Date.now()}`;
    const reasonHash = req.body.reasonHash || `0x${crypto.createHash("sha256").update(reason).digest("hex")}`;
    try {
      const chain = await markJobFailedOnChain({ jobId: job.id, agentId: job.assignedAgentId, reasonHash });
      return res.status(202).json({ submitted: true, reasonHash, ...chain });
    } catch (error) {
      return res.status(502).json({ error: `On-chain failure marking failed: ${error.message}` });
    }
  });

  app.locals.db = db;
  return app;
}

function metricsSnapshot(db) {
  const snapshot = integritySnapshot(db);
  const acceptedSubmissions = db
    .prepare("SELECT COUNT(*) AS count FROM proofs WHERE verified = 1")
    .get().count;
  const scoreUpdates = db
    .prepare("SELECT COUNT(*) AS count FROM events WHERE event_name = 'ScoreUpdated'")
    .get().count;
  return {
    ok: true,
    source: "indexer-sqlite",
    agentsRegistered: snapshot.agents,
    jobsCreated: snapshot.jobs,
    acceptedSubmissions: Number(acceptedSubmissions),
    scoreUpdates: Number(scoreUpdates),
    eventsIndexed: snapshot.events,
    indexed: snapshot
  };
}

function requireChainMode(req, res, next) {
  if (!isChainMode()) {
    return res.status(503).json({ error: "CHAIN_MODE=chain is required. Backend does not own demo state." });
  }
  return next();
}

function requireServerSigner(req, res, next) {
  if (process.env.ENABLE_SERVER_SIGNER !== "true") {
    return res.status(403).json({
      error: "Server-signed transactions are disabled. Use POST /protocol/v1/transactions and sign with the caller wallet."
    });
  }
  return requireChainMode(req, res, next);
}

function streamIndexedEvents(db) {
  return (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    let lastSeen = null;
    const send = () => {
      const events = recentEvents(db, 20).reverse();
      for (const event of events) {
        if (lastSeen && event.sequence <= lastSeen) continue;
        res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        lastSeen = event.sequence;
      }
    };
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);
    send();
    const timer = setInterval(send, 1500);
    req.on("close", () => clearInterval(timer));
  };
}

module.exports = { createApp };
