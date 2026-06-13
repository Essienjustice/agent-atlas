require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ethers } = require("ethers");
const { atlasScoreAbi } = require("../shared/src/chain-abis");
const { openIndexerDb } = require("../indexer/src/store");
const { getLeaderboard, integritySnapshot } = require("../indexer/src/read-model");

async function main() {
  const required = {
    CHAIN_MODE: process.env.CHAIN_MODE,
    RPC_URL: process.env.RPC_URL,
    AGENT_REGISTRY_ADDRESS: process.env.AGENT_REGISTRY_ADDRESS,
    JOB_MANAGER_ADDRESS: process.env.JOB_MANAGER_ADDRESS,
    PROOF_VERIFIER_ADDRESS: process.env.PROOF_VERIFIER_ADDRESS,
    ATLAS_SCORE_ADDRESS: process.env.ATLAS_SCORE_ADDRESS
  };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) throw new Error(`Missing required config: ${missing.join(", ")}`);
  if (process.env.CHAIN_MODE !== "chain") throw new Error("CHAIN_MODE must be chain.");

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  for (const [name, address] of Object.entries(required).filter(([key]) => key.endsWith("_ADDRESS"))) {
    const code = await provider.getCode(address);
    if (!code || code === "0x") throw new Error(`${name} has no bytecode at ${address}`);
  }

  const db = openIndexerDb();
  const snapshot = integritySnapshot(db);
  if (snapshot.events === 0) throw new Error("Indexer database has no events. Run `npm run rebuild:indexer`.");

  const atlasScore = new ethers.Contract(process.env.ATLAS_SCORE_ADDRESS, atlasScoreAbi, provider);
  const leaderboard = getLeaderboard(db);
  for (const agent of leaderboard) {
    const score = await atlasScore.scores(agent.id);
    const onChainReliability = Number(score.reliabilityScore);
    if (agent.score.reliabilityScore !== onChainReliability) {
      throw new Error(`Indexed score mismatch for agent ${agent.id}: indexer=${agent.score.reliabilityScore} chain=${onChainReliability}`);
    }
  }

  console.log(JSON.stringify({ ok: true, indexed: snapshot, checkedAgents: leaderboard.length }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
