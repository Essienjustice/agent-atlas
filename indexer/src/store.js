const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const defaultDbPath = path.join(__dirname, "..", "data", "atlas-index.sqlite");

function openIndexerDb(dbPath = process.env.INDEXER_DB || defaultDbPath) {
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new DatabaseSync(resolved);
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      contract TEXT NOT NULL,
      event_name TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      block_hash TEXT,
      log_index INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      skills TEXT NOT NULL,
      external_identifier TEXT,
      owner TEXT,
      registered_at INTEGER,
      tx_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      reward TEXT NOT NULL,
      status TEXT NOT NULL,
      assigned_agent_id INTEGER,
      creator TEXT,
      created_at INTEGER,
      completed_at INTEGER,
      created_tx_hash TEXT,
      accepted_tx_hash TEXT,
      completed_tx_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS proofs (
      job_id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      result_hash TEXT NOT NULL,
      submitted_tx_hash TEXT,
      verified_tx_hash TEXT,
      submitted_block INTEGER,
      verified_block INTEGER,
      failed_tx_hash TEXT,
      failed_block INTEGER,
      reason_hash TEXT,
      failed INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scores (
      agent_id INTEGER PRIMARY KEY,
      success_count INTEGER NOT NULL,
      failure_count INTEGER NOT NULL DEFAULT 0,
      task_volume INTEGER NOT NULL,
      reliability_score INTEGER NOT NULL,
      updated_job_id INTEGER,
      tx_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS pair_credits (
      agent_id INTEGER NOT NULL,
      creator TEXT NOT NULL,
      positive_credits INTEGER NOT NULL,
      PRIMARY KEY (agent_id, creator)
    );
    CREATE TABLE IF NOT EXISTS blocks (
      number INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      first_seen_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dead_letters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      error TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "events", "block_hash", "TEXT");
  ensureColumn(db, "agents", "owner", "TEXT");
  ensureColumn(db, "proofs", "failed_tx_hash", "TEXT");
  ensureColumn(db, "proofs", "failed_block", "INTEGER");
  ensureColumn(db, "proofs", "reason_hash", "TEXT");
  ensureColumn(db, "proofs", "failed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "scores", "failure_count", "INTEGER NOT NULL DEFAULT 0");
  return db;
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function logIndex(log) {
  return Number(log.index ?? log.logIndex ?? 0);
}

function eventId(log) {
  return `${log.transactionHash}:${logIndex(log)}`;
}

function recordBlock(db, log) {
  const blockHash = log.blockHash || null;
  if (!blockHash) return;
  const existing = db.prepare("SELECT hash FROM blocks WHERE number = ?").get(Number(log.blockNumber));
  if (existing && existing.hash !== blockHash) {
    const error = new Error(`reorg detected at block ${log.blockNumber}`);
    error.code = "REORG_DETECTED";
    error.blockNumber = Number(log.blockNumber);
    error.expectedHash = existing.hash;
    error.actualHash = blockHash;
    throw error;
  }
  db.prepare(`
    INSERT OR IGNORE INTO blocks (number, hash, first_seen_at)
    VALUES (?, ?, ?)
  `).run(Number(log.blockNumber), blockHash, new Date().toISOString());
}

function insertEvent(db, { contract, eventName, log, payload }) {
  recordBlock(db, log);
  const result = db.prepare(`
    INSERT OR IGNORE INTO events (id, contract, event_name, block_number, block_hash, log_index, tx_hash, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId(log),
    contract,
    eventName,
    Number(log.blockNumber),
    log.blockHash || null,
    logIndex(log),
    log.transactionHash,
    JSON.stringify(payload),
    new Date().toISOString()
  );
  return result.changes > 0;
}

function applyEventMutation(db, event) {
  const { contract, eventName, log, payload } = event;
  if (!insertEvent(db, event)) return;

  if (eventName === "AgentRegistered") {
    db.prepare(`
      INSERT OR REPLACE INTO agents (id, name, skills, external_identifier, owner, registered_at, tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(payload.agentId, payload.name, payload.skills, payload.externalIdentifier, payload.owner, payload.registeredAt, log.transactionHash);
  }

  if (eventName === "JobCreated") {
    db.prepare(`
      INSERT INTO jobs (id, description, reward, status, assigned_agent_id, creator, created_at, created_tx_hash)
      VALUES (?, ?, ?, 'OPEN', NULL, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(payload.jobId, payload.description, String(payload.reward), payload.creator, Number(log.blockNumber), log.transactionHash);
  }

  if (eventName === "JobAccepted") {
    db.prepare(`
      UPDATE jobs SET status = 'ASSIGNED', assigned_agent_id = ?, accepted_tx_hash = ? WHERE id = ?
    `).run(payload.agentId, log.transactionHash, payload.jobId);
  }

  if (eventName === "JobCompleted") {
    db.prepare(`
      UPDATE jobs SET status = 'COMPLETED', completed_at = ?, completed_tx_hash = ? WHERE id = ?
    `).run(Number(log.blockNumber), log.transactionHash, payload.jobId);
  }

  if (eventName === "JobFailed") {
    db.prepare(`
      UPDATE jobs SET status = 'FAILED', completed_at = ?, completed_tx_hash = ? WHERE id = ?
    `).run(Number(log.blockNumber), log.transactionHash, payload.jobId);
  }

  if (eventName === "ProofSubmitted") {
    db.prepare(`
      INSERT INTO proofs (job_id, agent_id, result_hash, submitted_tx_hash, submitted_block, verified, failed)
      VALUES (?, ?, ?, ?, ?, 0, 0)
      ON CONFLICT(job_id) DO UPDATE SET
        agent_id = excluded.agent_id,
        result_hash = excluded.result_hash,
        submitted_tx_hash = excluded.submitted_tx_hash,
        submitted_block = excluded.submitted_block
    `).run(payload.jobId, payload.agentId, payload.resultHash, log.transactionHash, Number(log.blockNumber));
  }

  if (eventName === "ProofVerified") {
    db.prepare(`
      INSERT INTO proofs (job_id, agent_id, result_hash, submitted_tx_hash, submitted_block, verified, failed)
      VALUES (?, ?, ?, NULL, NULL, 1, 0)
      ON CONFLICT(job_id) DO NOTHING
    `).run(payload.jobId, payload.agentId, payload.resultHash);
    db.prepare(`
      UPDATE proofs SET verified = 1, verified_tx_hash = ?, verified_block = ? WHERE job_id = ?
    `).run(log.transactionHash, Number(log.blockNumber), payload.jobId);
  }

  if (eventName === "ProofFailed") {
    db.prepare(`
      INSERT INTO proofs (job_id, agent_id, result_hash, reason_hash, failed_tx_hash, failed_block, failed, verified)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      ON CONFLICT(job_id) DO UPDATE SET
        agent_id = excluded.agent_id,
        reason_hash = excluded.reason_hash,
        failed_tx_hash = excluded.failed_tx_hash,
        failed_block = excluded.failed_block,
        failed = 1
    `).run(payload.jobId, payload.agentId, "0x0000000000000000000000000000000000000000000000000000000000000000", payload.reasonHash, log.transactionHash, Number(log.blockNumber));
  }

  if (eventName === "ScoreUpdated") {
    const previous = db.prepare("SELECT * FROM scores WHERE agent_id = ?").get(payload.agentId);
    db.prepare(`
      INSERT OR REPLACE INTO scores (agent_id, success_count, failure_count, task_volume, reliability_score, updated_job_id, tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.agentId,
      payload.successCount,
      payload.failureCount,
      payload.taskVolume,
      payload.reliabilityScore,
      payload.jobId,
      log.transactionHash
    );
    if (!previous || Number(payload.successCount) > Number(previous.success_count)) {
      const job = db.prepare("SELECT creator FROM jobs WHERE id = ?").get(payload.jobId);
      if (job?.creator) {
        db.prepare(`
          INSERT INTO pair_credits (agent_id, creator, positive_credits)
          VALUES (?, ?, 1)
          ON CONFLICT(agent_id, creator) DO UPDATE SET
            positive_credits = positive_credits + 1
        `).run(payload.agentId, job.creator);
      }
    }
  }
}

function applyEvent(db, event) {
  // Keep the raw event insert and derived-state mutation atomic so replay cannot skip a partially applied event.
  db.exec("BEGIN");
  try {
    const result = applyEventMutation(db, event);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function clearIndexedState(db) {
  db.exec(`
    DELETE FROM events;
    DELETE FROM agents;
    DELETE FROM jobs;
    DELETE FROM proofs;
    DELETE FROM scores;
    DELETE FROM pair_credits;
    DELETE FROM meta;
    DELETE FROM blocks;
  `);
}

function setMeta(db, key, value) {
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, String(value));
}

function getMeta(db, key) {
  return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value || null;
}

function addDeadLetter(db, label, error, payload = null) {
  db.prepare(`
    INSERT INTO dead_letters (label, error, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(label, error instanceof Error ? error.message : String(error), payload ? JSON.stringify(payload) : null, new Date().toISOString());
}

function listDeadLetters(db, limit = 50) {
  return db.prepare("SELECT * FROM dead_letters ORDER BY id DESC LIMIT ?").all(limit);
}

module.exports = { addDeadLetter, applyEvent, clearIndexedState, getMeta, listDeadLetters, openIndexerDb, setMeta };
