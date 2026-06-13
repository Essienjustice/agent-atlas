const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { createApp } = require("../src/app");
const { applyEvent, openIndexerDb } = require("../../indexer/src/store");

function log(tx, block, index = 0) {
  return { transactionHash: tx, blockNumber: block, blockHash: `0xblock${block}`, index };
}

function indexedApp() {
  const db = openIndexerDb(path.join(os.tmpdir(), `atlas-index-${Date.now()}-${Math.random()}.sqlite`));
  return { db, app: createApp({ db }) };
}

test("api reads leaderboard and lifecycle state from indexed contract events", async () => {
  const { app, db } = indexedApp();
  const indexedEvents = [
  {
    contract: "AgentRegistry",
    eventName: "AgentRegistered",
    log: log("0xagent", 1),
    payload: { agentId: 1, name: "RiskAgent", skills: "risk,USDY", externalIdentifier: "external:risk", owner: "0x0000000000000000000000000000000000000002", registeredAt: 1 }
  },
  {
    contract: "JobManager",
    eventName: "JobCreated",
    log: log("0xjob", 2),
    payload: { jobId: 7, description: "USDY Risk Analysis", reward: "100", creator: "0x0000000000000000000000000000000000000001" }
  },
  {
    contract: "JobManager",
    eventName: "JobAccepted",
    log: log("0xaccept", 3),
    payload: { jobId: 7, agentId: 1, agentOwner: "0x0000000000000000000000000000000000000002" }
  },
  {
    contract: "ProofVerifier",
    eventName: "ProofSubmitted",
    log: log("0xproof", 4),
    payload: { jobId: 7, agentId: 1, resultHash: "0xabc" }
  },
  {
    contract: "ProofVerifier",
    eventName: "ProofVerified",
    log: log("0xproof", 4, 1),
    payload: { jobId: 7, agentId: 1, resultHash: "0xabc" }
  },
  {
    contract: "AtlasScore",
    eventName: "ScoreUpdated",
    log: log("0xproof", 4, 2),
    payload: { agentId: 1, successCount: 1, failureCount: 0, taskVolume: 1, reliabilityScore: 70, jobId: 7 }
  }
  ];
  indexedEvents.forEach((event) => applyEvent(db, event));

  const leaderboard = await request(app).get("/leaderboard").expect(200);
  assert.equal(leaderboard.body[0].id, 1);
  assert.equal(leaderboard.body[0].score.reliabilityScore, 70);
  assert.equal(leaderboard.body[0].verifiedJobsCount, 1);
  assert.equal(leaderboard.body[0].failedJobsCount, 0);

  const jobs = await request(app).get("/jobs").expect(200);
  assert.equal(jobs.body[0].status, "ASSIGNED");

  applyEvent(db, {
    contract: "JobManager",
    eventName: "JobCreated",
    log: log("0xjob", 2),
    payload: { jobId: 7, description: "USDY Risk Analysis", reward: "100", creator: "0x0000000000000000000000000000000000000001" }
  });
  const jobsAfterDuplicate = await request(app).get("/jobs").expect(200);
  assert.equal(jobsAfterDuplicate.body[0].status, "ASSIGNED");

  const profile = await request(app).get("/agents/1").expect(200);
  assert.equal(profile.body.proofs[0].verified, true);
  assert.equal(profile.body.recentVerifiedJobs[0].proof.resultHash, "0xabc");

  const reputation = await request(app).get("/protocol/v1/reputation/1").expect(200);
  assert.equal(reputation.body.score, 70);
  assert.equal(reputation.body.source, "AtlasScore.ScoreUpdated events");
  assert.equal(reputation.body.uniquePositiveCounterparties, 1);

  const proofs = await request(app).get("/protocol/v1/proofs?agentId=1").expect(200);
  assert.equal(proofs.body[0].resultHash, "0xabc");

  const scores = await request(app).get("/protocol/v1/scores?agentId=1").expect(200);
  assert.equal(scores.body[0].blockHash, "0xblock4");

  const events = await request(app).get("/protocol/v1/events?eventName=ScoreUpdated").expect(200);
  assert.equal(events.body[0].eventName, "ScoreUpdated");

  applyEvent(db, {
    contract: "ProofVerifier",
    eventName: "ProofFailed",
    log: log("0xfail", 5),
    payload: { jobId: 8, agentId: 1, reasonHash: "0xfailreason" }
  });
  const failedProofs = await request(app).get("/protocol/v1/proofs?jobId=8").expect(200);
  assert.equal(
    failedProofs.body[0].resultHash,
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  );
  assert.equal(failedProofs.body[0].reasonHash, "0xfailreason");

  applyEvent(db, {
    contract: "AtlasScore",
    eventName: "ScoreUpdated",
    log: log("0xotherproof", 6),
    payload: { agentId: 2, successCount: 1, failureCount: 0, taskVolume: 1, reliabilityScore: 70, jobId: 9 }
  });
  const filteredEvents = await request(app).get("/protocol/v1/events?eventName=ScoreUpdated&agentId=1&limit=1").expect(200);
  assert.equal(filteredEvents.body.length, 1);
  assert.equal(filteredEvents.body[0].payload.agentId, 1);

  const replayDb = openIndexerDb(path.join(os.tmpdir(), `atlas-replay-${Date.now()}-${Math.random()}.sqlite`));
  indexedEvents.forEach((event) => applyEvent(replayDb, event));
  const replayApp = createApp({ db: replayDb });
  const replayLeaderboard = await request(replayApp).get("/leaderboard").expect(200);
  assert.equal(replayLeaderboard.body[0].score.reliabilityScore, leaderboard.body[0].score.reliabilityScore);

  process.env.JOB_MANAGER_ADDRESS = "0x0000000000000000000000000000000000000010";
  process.env.PROOF_VERIFIER_ADDRESS = "0x0000000000000000000000000000000000000020";
  process.env.AGENT_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000030";
  process.env.ATLAS_SCORE_ADDRESS = "0x0000000000000000000000000000000000000040";
  const tx = await request(app)
    .post("/protocol/v1/transactions")
    .send({ action: "acceptJob", params: { jobId: 7, agentId: 1 } })
    .expect(200);
  assert.equal(tx.body.signer, "caller-wallet");
  assert.equal(tx.body.transaction.to, process.env.JOB_MANAGER_ADDRESS);
  assert.match(tx.body.transaction.data, /^0x/);
  const acceptProofTx = await request(app)
    .post("/protocol/v1/transactions")
    .send({ action: "acceptProof", params: { jobId: 7, agentId: 1 } })
    .expect(200);
  assert.equal(acceptProofTx.body.transaction.to, process.env.PROOF_VERIFIER_ADDRESS);
  assert.equal(acceptProofTx.body.transaction.value, "0x0");

  await request(app).post("/jobs/create").send({ description: "server signer disabled" }).expect(403);
});

test("event application rolls back event insert when derived mutation fails", () => {
  const { db } = indexedApp();
  const badEvent = {
    contract: "AgentRegistry",
    eventName: "AgentRegistered",
    log: log("0xbadagent", 11),
    payload: {
      agentId: 99,
      name: null,
      skills: "risk",
      externalIdentifier: "external:bad",
      owner: "0x0000000000000000000000000000000000000099",
      registeredAt: 11
    }
  };

  assert.throws(() => applyEvent(db, badEvent));
  const eventRow = db.prepare("SELECT * FROM events WHERE id = ?").get("0xbadagent:0");
  const agentRow = db.prepare("SELECT * FROM agents WHERE id = ?").get(99);
  assert.equal(eventRow, undefined);
  assert.equal(agentRow, undefined);
});
