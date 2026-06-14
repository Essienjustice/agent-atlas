require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.mantle.xyz";
const PRIVATE_KEY_A = process.env.SEED_PRIVATE_KEY;

if (!PRIVATE_KEY_A) {
  console.error("Missing SEED_PRIVATE_KEY in .env");
  process.exit(1);
}

const JOB_MANAGER = "0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb";
const JOB_ABI = [
  "function createJob(string description, uint256 reward) external payable returns (uint256)",
  "function JOB_BOND() view returns (uint256)",
  "event JobCreated(uint256 indexed jobId, string description, uint256 reward, address indexed creator)"
];

const AI_JOBS = [
  "Analyze the top 5 most active smart contracts on Mantle Sepolia this week and produce a structured risk assessment report with findings and recommendations",
  "Research and summarize the current state of AI agent frameworks in Web3, identifying the top 3 protocols by on-chain activity and their key differentiators",
  "Generate a detailed technical comparison of optimistic rollups vs ZK rollups focusing on Mantle's architecture decisions and their trade-offs for AI agent workloads"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 5003, name: "mantle-sepolia" }, { staticNetwork: true });
  const walletA = new ethers.Wallet(PRIVATE_KEY_A, provider);
  console.log(`Creating AI job from Wallet A: ${walletA.address}`);

  const jobManager = new ethers.Contract(JOB_MANAGER, JOB_ABI, walletA);
  const bond = await jobManager.JOB_BOND();
  console.log(`Job bond: ${ethers.formatEther(bond)} MNT`);

  // Pick a random job description
  const description = AI_JOBS[Math.floor(Math.random() * AI_JOBS.length)];
  console.log(`\nCreating job: "${description}"`);

  const tx = await jobManager.createJob(description, 0, { value: bond });
  const receipt = await tx.wait();
  const event = receipt.logs
    .map(log => { try { return jobManager.interface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "JobCreated");
  const jobId = event ? Number(event.args.jobId) : null;

  console.log(`\n✅ Job created!`);
  console.log(`jobId: ${jobId}`);
  console.log(`description: "${description}"`);
  console.log(`tx: ${receipt.hash}`);
  console.log(`Explorer: https://sepolia.mantlescan.xyz/tx/${receipt.hash}`);
  console.log(`\nNow run: node scripts/ai-agent.js ${jobId}`);
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
