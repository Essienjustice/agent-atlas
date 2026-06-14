require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { ethers } = require("ethers");
const { agentRegistryAbi, atlasScoreAbi, jobManagerAbi, proofVerifierAbi } = require("../../shared/src/chain-abis");
const { addDeadLetter, applyEvent, getMeta, openIndexerDb, setMeta } = require("./store");

const deadLetters = [];
const pendingConfirmations = [];
const DEFAULT_RPC_URL = "https://rpc.sepolia.mantle.xyz";
const DEFAULT_AGENT_REGISTRY_ADDRESS = "0x3cf0763443C8Ab7672f51B8e1B34956786522a0e";
const DEFAULT_JOB_MANAGER_ADDRESS = "0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb";
const DEFAULT_PROOF_VERIFIER_ADDRESS = "0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565";
const DEFAULT_ATLAS_SCORE_ADDRESS = "0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB";
const DEFAULT_START_BLOCK = 39900000;
const DEFAULT_CHUNK_SIZE = 2000;
const MANTLE_SEPOLIA_NETWORK = { chainId: 5003, name: "mantle-sepolia" };

function defaultProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL ?? DEFAULT_RPC_URL, MANTLE_SEPOLIA_NETWORK, { staticNetwork: true });
}

function requireConfig() {
  return {
    RPC_URL: process.env.RPC_URL ?? DEFAULT_RPC_URL,
    AGENT_REGISTRY_ADDRESS: process.env.AGENT_REGISTRY_ADDRESS ?? DEFAULT_AGENT_REGISTRY_ADDRESS,
    JOB_MANAGER_ADDRESS: process.env.JOB_MANAGER_ADDRESS ?? DEFAULT_JOB_MANAGER_ADDRESS,
    PROOF_VERIFIER_ADDRESS: process.env.PROOF_VERIFIER_ADDRESS ?? DEFAULT_PROOF_VERIFIER_ADDRESS,
    ATLAS_SCORE_ADDRESS: process.env.ATLAS_SCORE_ADDRESS ?? DEFAULT_ATLAS_SCORE_ADDRESS
  };
}

function contracts(provider, config = requireConfig()) {
  return [
    {
      name: "AgentRegistry",
      address: config.AGENT_REGISTRY_ADDRESS,
      contract: new ethers.Contract(config.AGENT_REGISTRY_ADDRESS, agentRegistryAbi, provider),
      events: ["AgentRegistered"]
    },
    {
      name: "JobManager",
      address: config.JOB_MANAGER_ADDRESS,
      contract: new ethers.Contract(config.JOB_MANAGER_ADDRESS, jobManagerAbi, provider),
      events: ["JobCreated", "JobAccepted", "JobCompleted", "JobFailed"]
    },
    {
      name: "ProofVerifier",
      address: config.PROOF_VERIFIER_ADDRESS,
      contract: new ethers.Contract(config.PROOF_VERIFIER_ADDRESS, proofVerifierAbi, provider),
      events: ["ProofSubmitted", "ProofVerified", "ProofFailed"]
    },
    {
      name: "AtlasScore",
      address: config.ATLAS_SCORE_ADDRESS,
      contract: new ethers.Contract(config.ATLAS_SCORE_ADDRESS, atlasScoreAbi, provider),
      events: ["ScoreUpdated"]
    }
  ];
}

function payloadFor(eventName, args) {
  if (eventName === "AgentRegistered") {
    return {
      agentId: Number(args.agentId),
      name: args.name,
      skills: args.skills,
      externalIdentifier: args.externalIdentifier ?? args.erc8004Id ?? "",
      owner: args.owner,
      registeredAt: Number(args.registeredAt)
    };
  }
  if (eventName === "JobCreated") {
    return {
      jobId: Number(args.jobId),
      description: args.description,
      reward: args.reward.toString(),
      creator: args.creator
    };
  }
  if (eventName === "JobAccepted") {
    return { jobId: Number(args.jobId), agentId: Number(args.agentId), agentOwner: args.agentOwner };
  }
  if (eventName === "JobCompleted") {
    return { jobId: Number(args.jobId), agentId: Number(args.agentId) };
  }
  if (eventName === "JobFailed") {
    return { jobId: Number(args.jobId), agentId: Number(args.agentId), reasonHash: args.reasonHash };
  }
  if (eventName === "ProofSubmitted" || eventName === "ProofVerified") {
    return { jobId: Number(args.jobId), agentId: Number(args.agentId), resultHash: args.resultHash };
  }
  if (eventName === "ProofFailed") {
    return { jobId: Number(args.jobId), agentId: Number(args.agentId), reasonHash: args.reasonHash };
  }
  if (eventName === "ScoreUpdated") {
    return {
      agentId: Number(args.agentId),
      successCount: Number(args.successCount),
      failureCount: Number(args.failureCount),
      taskVolume: Number(args.taskVolume),
      reliabilityScore: Number(args.reliabilityScore),
      jobId: Number(args.jobId)
    };
  }
  return Object.fromEntries(Object.entries(args).filter(([key]) => Number.isNaN(Number(key))));
}

function normalizeLog(source, eventName, log) {
  return {
    contract: source.name,
    eventName,
    log,
    payload: payloadFor(eventName, log.args)
  };
}

function sortLogs(events) {
  return events.sort((a, b) => {
    const block = Number(a.log.blockNumber) - Number(b.log.blockNumber);
    if (block !== 0) return block;
    return Number(a.log.index ?? a.log.logIndex ?? 0) - Number(b.log.index ?? b.log.logIndex ?? 0);
  });
}

async function withRetry(label, handler, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await handler();
    } catch (error) {
      if (attempt === attempts) {
        const item = { label, error: error.message, createdAt: new Date().toISOString() };
        deadLetters.push(item);
        console.error("indexer dead-letter", item);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  return null;
}

async function replay({ db = openIndexerDb(), fromBlock = DEFAULT_START_BLOCK, toBlock = "latest", provider = defaultProvider() } = {}) {
  const confirmations = Number(process.env.INDEXER_CONFIRMATIONS || 6);
  const chainTip = toBlock === "latest" ? await provider.getBlockNumber() : Number(toBlock);
  const latest = Math.max(0, chainTip - confirmations);
  const chunkSize = Number(process.env.CHUNK_SIZE || process.env.INDEXER_BLOCK_CHUNK || DEFAULT_CHUNK_SIZE);
  const sources = contracts(provider);
  let eventCount = 0;
  for (let start = Number(fromBlock); start <= latest; start += chunkSize + 1) {
    const end = Math.min(start + chunkSize, latest);
    const batch = [];
    for (const source of sources) {
      for (const eventName of source.events) {
        const filter = source.contract.filters[eventName]();
        const logs = await withRetry(`replay:${source.name}:${eventName}:${start}-${end}`, () => source.contract.queryFilter(filter, start, end));
        if (!logs) {
          const error = new Error(`RPC replay failed for ${source.name}.${eventName} ${start}-${end}`);
          addDeadLetter(db, "replay-rpc", error, { contract: source.name, eventName, start, end });
          throw error;
        }
        for (const log of logs) batch.push(normalizeLog(source, eventName, log));
      }
    }
    for (const event of sortLogs(batch)) {
      try {
        applyEvent(db, event);
      } catch (error) {
        addDeadLetter(db, event.eventName, error, event.payload);
        throw error;
      }
    }
    eventCount += batch.length;
    setMeta(db, "lastReplayFromBlock", start);
    setMeta(db, "lastReplayToBlock", end);
    setMeta(db, "lastReplayEventCount", eventCount);
    setMeta(db, "lastBlock", end);
    console.log(`Indexer replay checkpoint ${start}-${end}: ${batch.length} events`);
  }
  setMeta(db, "lastBlock", latest);
  setMeta(db, "chainTip", chainTip);
  setMeta(db, "confirmations", confirmations);
  return { fromBlock: Number(fromBlock), toBlock: latest, chainTip, confirmations, events: eventCount };
}

async function listen({ db = openIndexerDb(), provider = defaultProvider() } = {}) {
  const sources = contracts(provider);
  setInterval(() => {
    drainPendingConfirmations(db, provider).catch((error) => {
      addDeadLetter(db, "pending-confirmation-drain", error);
    });
  }, Number(process.env.INDEXER_CONFIRMATION_POLL_MS || 5000));
  for (const source of sources) {
    for (const eventName of source.events) {
      source.contract.on(eventName, (...values) => {
        const log = values.at(-1);
        withRetry(eventName, async () => {
          const confirmations = Number(process.env.INDEXER_CONFIRMATIONS || 6);
          const latest = await provider.getBlockNumber();
          const event = normalizeLog(source, eventName, log);
          if (Number(log.blockNumber) > latest - confirmations) {
            pendingConfirmations.push(event);
            return;
          }
          try {
            applyEvent(db, event);
          } catch (error) {
            addDeadLetter(db, eventName, error, event.payload);
            throw error;
          }
          setMeta(db, "lastBlock", Number(log.blockNumber));
          console.log(`${eventName} indexed ${log.transactionHash}`);
        });
      });
    }
  }
}

async function drainPendingConfirmations(db, provider) {
  if (pendingConfirmations.length === 0) return;
  const confirmations = Number(process.env.INDEXER_CONFIRMATIONS || 6);
  const latest = await provider.getBlockNumber();
  const ready = [];
  for (let index = pendingConfirmations.length - 1; index >= 0; index -= 1) {
    const event = pendingConfirmations[index];
    if (Number(event.log.blockNumber) <= latest - confirmations) {
      ready.push(event);
      pendingConfirmations.splice(index, 1);
    }
  }
  for (const event of sortLogs(ready)) {
    try {
      applyEvent(db, event);
      setMeta(db, "lastBlock", Number(event.log.blockNumber));
    } catch (error) {
      addDeadLetter(db, event.eventName, error, event.payload);
      throw error;
    }
  }
}

async function main() {
  if (process.env.CHAIN_MODE !== "chain") {
    throw new Error("Indexer requires CHAIN_MODE=chain. Demo/mock state is not indexer-canonical.");
  }
  const db = openIndexerDb();
  const fromBlock = Number(getMeta(db, "lastBlock") || process.env.INDEXER_FROM_BLOCK || DEFAULT_START_BLOCK);
  const result = await replay({ db, fromBlock });
  console.log(`Indexer replayed ${result.events} events through block ${result.toBlock}.`);
  await listen({ db });
  console.log("Indexer listening to Mantle events.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { deadLetters, drainPendingConfirmations, pendingConfirmations, replay, listen, normalizeLog, payloadFor };
