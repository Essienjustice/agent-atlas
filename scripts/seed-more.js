require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.mantle.xyz";
const PRIVATE_KEY_A = process.env.SEED_PRIVATE_KEY;   // job creator (reused)
const PRIVATE_KEY_C = process.env.SEED_PRIVATE_KEY_C; // agent 2 owner
const PRIVATE_KEY_D = process.env.SEED_PRIVATE_KEY_D; // agent 3 owner
const PRIVATE_KEY_E = process.env.SEED_PRIVATE_KEY_E; // agent 4 owner

if (!PRIVATE_KEY_A || !PRIVATE_KEY_C || !PRIVATE_KEY_D || !PRIVATE_KEY_E) {
  console.error("Missing one or more keys: SEED_PRIVATE_KEY, SEED_PRIVATE_KEY_C, SEED_PRIVATE_KEY_D, SEED_PRIVATE_KEY_E");
  process.exit(1);
}

const AGENT_REGISTRY = "0x3cf0763443C8Ab7672f51B8e1B34956786522a0e";
const JOB_MANAGER    = "0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb";
const PROOF_VERIFIER = "0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565";

const REGISTRY_ABI = [
  "function registerAgent(string name, string skills, string erc8004Id) external payable returns (uint256)",
  "function REGISTRATION_STAKE() view returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId, string name, string skills, string erc8004Id, address indexed owner, uint256 registeredAt)"
];

const JOB_ABI = [
  "function createJob(string description, uint256 reward) external payable returns (uint256)",
  "function acceptJob(uint256 jobId, uint256 agentId) external",
  "function JOB_BOND() view returns (uint256)",
  "event JobCreated(uint256 indexed jobId, string description, uint256 reward, address indexed creator)",
  "event JobAccepted(uint256 indexed jobId, uint256 indexed agentId, address indexed agentOwner)"
];

const PROOF_ABI = [
  "function submitProof(uint256 jobId, uint256 agentId, bytes32 resultHash) external",
  "function acceptProof(uint256 jobId, uint256 agentId) external",
  "event ProofSubmitted(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash)",
  "event ProofVerified(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash)"
];

const AGENTS = [
  {
    wallet: "C",
    name: "NeuralScribe",
    skills: "nlp,content-generation,summarization",
    erc8004Id: "erc8004://neuralscribe",
    jobs: [
      "Generate structured reports from raw Mantle transaction logs",
      "Summarize weekly DeFi activity across Mantle Sepolia protocols"
    ]
  },
  {
    wallet: "D",
    name: "ChainSentinel",
    skills: "security-auditing,anomaly-detection,risk-scoring",
    erc8004Id: "erc8004://chainsentinel",
    jobs: [
      "Audit smart contract interactions for reentrancy patterns on Mantle",
      "Score risk levels of newly deployed contracts on Mantle Sepolia"
    ]
  },
  {
    wallet: "E",
    name: "OracleWeaver",
    skills: "data-feeds,price-aggregation,cross-chain-verification",
    erc8004Id: "erc8004://oracleweaver",
    jobs: [
      "Aggregate and verify MNT price feeds from three independent sources",
      "Cross-verify Mantle Sepolia state roots against L1 checkpoints"
    ]
  }
];

async function runAgentFlow(provider, walletA, agentWallet, agentDef, registry, bond, stake) {
  const registryAgent = new ethers.Contract(AGENT_REGISTRY, REGISTRY_ABI, agentWallet);
  const jobManagerA = new ethers.Contract(JOB_MANAGER, JOB_ABI, walletA);
  const jobManagerAgent = new ethers.Contract(JOB_MANAGER, JOB_ABI, agentWallet);
  const proofVerifierAgent = new ethers.Contract(PROOF_VERIFIER, PROOF_ABI, agentWallet);
  const proofVerifierA = new ethers.Contract(PROOF_VERIFIER, PROOF_ABI, walletA);

  // Register agent
  console.log(`\n[${agentDef.name}] Registering agent...`);
  const regTx = await registryAgent.registerAgent(
    agentDef.name,
    agentDef.skills,
    agentDef.erc8004Id,
    { value: stake }
  );
  const regReceipt = await regTx.wait();
  const regEvent = regReceipt.logs
    .map(log => { try { return registryAgent.interface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "AgentRegistered");
  const agentId = regEvent ? Number(regEvent.args.agentId) : null;
  console.log(`[${agentDef.name}] Registered! agentId=${agentId} tx=${regReceipt.hash}`);

  // Run each job
  for (let i = 0; i < agentDef.jobs.length; i++) {
    const description = agentDef.jobs[i];
    console.log(`\n[${agentDef.name}] Creating job ${i + 1}: "${description}"`);

    const jobTx = await jobManagerA.createJob(description, 0, { value: bond });
    const jobReceipt = await jobTx.wait();
    const jobEvent = jobReceipt.logs
      .map(log => { try { return jobManagerA.interface.parseLog(log); } catch { return null; } })
      .find(e => e?.name === "JobCreated");
    const jobId = jobEvent ? Number(jobEvent.args.jobId) : null;
    console.log(`[${agentDef.name}] Job created! jobId=${jobId} tx=${jobReceipt.hash}`);

    console.log(`[${agentDef.name}] Accepting job ${jobId}...`);
    const acceptTx = await jobManagerAgent.acceptJob(jobId, agentId);
    const acceptReceipt = await acceptTx.wait();
    console.log(`[${agentDef.name}] Job accepted! tx=${acceptReceipt.hash}`);

    const resultHash = ethers.keccak256(ethers.toUtf8Bytes(`job-${jobId}-agent-${agentId}-result-${i}`));
    console.log(`[${agentDef.name}] Submitting proof for job ${jobId}...`);
    const proofTx = await proofVerifierAgent.submitProof(jobId, agentId, resultHash);
    const proofReceipt = await proofTx.wait();
    console.log(`[${agentDef.name}] Proof submitted! tx=${proofReceipt.hash}`);

    console.log(`[${agentDef.name}] Accepting proof for job ${jobId}...`);
    const acceptProofTx = await proofVerifierA.acceptProof(jobId, agentId);
    const acceptProofReceipt = await acceptProofTx.wait();
    console.log(`[${agentDef.name}] Proof accepted! tx=${acceptProofReceipt.hash}`);
  }

  console.log(`\n✅ [${agentDef.name}] Complete! agentId=${agentId}`);
  return agentId;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 5003, name: "mantle-sepolia" }, { staticNetwork: true });
  const walletA = new ethers.Wallet(PRIVATE_KEY_A, provider);
  const walletC = new ethers.Wallet(PRIVATE_KEY_C, provider);
  const walletD = new ethers.Wallet(PRIVATE_KEY_D, provider);
  const walletE = new ethers.Wallet(PRIVATE_KEY_E, provider);

  console.log(`Wallet A (job creator): ${walletA.address}`);
  console.log(`Wallet C (NeuralScribe): ${walletC.address}`);
  console.log(`Wallet D (ChainSentinel): ${walletD.address}`);
  console.log(`Wallet E (OracleWeaver): ${walletE.address}`);

  const registry = new ethers.Contract(AGENT_REGISTRY, REGISTRY_ABI, walletA);
  const jobManager = new ethers.Contract(JOB_MANAGER, JOB_ABI, walletA);

  const stake = await registry.REGISTRATION_STAKE();
  const bond = await jobManager.JOB_BOND();
  console.log(`\nStake: ${ethers.formatEther(stake)} MNT | Bond: ${ethers.formatEther(bond)} MNT per job`);
  console.log(`Wallet A needs: ${ethers.formatEther(bond * 6n)} MNT (6 jobs x bond)`);
  console.log(`Each agent wallet needs: ${ethers.formatEther(stake + bond * 2n)} MNT (stake + 2 job bonds)`);

  const wallets = [walletC, walletD, walletE];
  for (let i = 0; i < AGENTS.length; i++) {
    await runAgentFlow(provider, walletA, wallets[i], AGENTS[i], registry, bond, stake);
  }

  console.log("\n🎉 All agents seeded!");
  console.log(`Explorer: https://sepolia.mantlescan.xyz/address/${walletA.address}`);
}

main().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
