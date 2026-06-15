require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "https://rpc.sepolia.mantle.xyz";
const PRIVATE_KEY_A = process.env.SEED_PRIVATE_KEY;       // job creator + proof accepter
const PRIVATE_KEY_C = process.env.SEED_PRIVATE_KEY_C;     // NeuralScribe owner

if (!PRIVATE_KEY_A || !PRIVATE_KEY_C) {
  console.error("Missing required env vars: SEED_PRIVATE_KEY, SEED_PRIVATE_KEY_C");
  process.exit(1);
}

const JOB_MANAGER    = "0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb";
const PROOF_VERIFIER = "0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565";
const AGENT_REGISTRY = "0x3cf0763443C8Ab7672f51B8e1B34956786522a0e";

const JOB_STATUS_OPEN = 0;
const JOB_STATUS_ASSIGNED = 1;

const JOB_ABI = [
  "function acceptJob(uint256 jobId, uint256 agentId) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 jobId, string description, uint256 reward, uint8 status, uint256 assignedAgentId, address creator, uint256 createdAt))",
  "event JobAccepted(uint256 indexed jobId, uint256 indexed agentId, address indexed agentOwner)"
];

const PROOF_ABI = [
  "function submitProof(uint256 jobId, uint256 agentId, bytes32 resultHash) external",
  "function acceptProof(uint256 jobId, uint256 agentId) external",
  "event ProofSubmitted(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash)",
  "event ProofVerified(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash)"
];

const REGISTRY_ABI = [
  "function ownerOf(uint256 agentId) external view returns (address)"
];

// NeuralScribe is agentId=3, owned by Wallet C
const NEURAL_SCRIBE_AGENT_ID = 3;

async function callAI(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY not set in .env. " +
      "Get a free key at https://console.groq.com"
    );
  }

  console.log("Calling Groq API...");
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error("Groq API error: " + err);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(
      "Groq returned no text. Response: " +
      JSON.stringify(data)
    );
  }

  return text;
}

async function main() {
  const jobId = Number(process.argv[2]);
  if (!jobId) {
    console.error("Usage: node scripts/ai-agent.js <jobId>");
    process.exit(1);
  }

  console.log("Agent: NeuralScribe (Wallet C)");
  console.log("AI:    Groq llama-3.3-70b-versatile (free tier)");
  console.log("Job:   " + jobId);
  console.log("─".repeat(50));

  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: 5003, name: "mantle-sepolia" }, { staticNetwork: true });
  const walletA = new ethers.Wallet(PRIVATE_KEY_A, provider); // job creator
  const walletC = new ethers.Wallet(PRIVATE_KEY_C, provider); // NeuralScribe owner

  console.log(`Wallet A (creator):  ${walletA.address}`);
  console.log(`Wallet C (agent):    ${walletC.address}`);
  console.log(`Agent ID:            ${NEURAL_SCRIBE_AGENT_ID}`);

  const jobManager = new ethers.Contract(JOB_MANAGER, JOB_ABI, walletC);
  const proofVerifierC = new ethers.Contract(PROOF_VERIFIER, PROOF_ABI, walletC);
  const proofVerifierA = new ethers.Contract(PROOF_VERIFIER, PROOF_ABI, walletA);

  console.log(`\nReading job ${jobId} from chain...`);
  const job = await jobManager.getJob(jobId);
  const description = job.description;
  const status = Number(job.status);
  console.log(`Description: "${description}"`);
  console.log(`Status: ${status} (0=OPEN, 1=ASSIGNED, 2=COMPLETED, 3=FAILED)`);

  let acceptReceipt = null;
  if (status === JOB_STATUS_OPEN) {
    console.log("Job is OPEN — accepting now...");
    const acceptTx = await jobManager.acceptJob(jobId, NEURAL_SCRIBE_AGENT_ID);
    acceptReceipt = await acceptTx.wait();
    console.log(`Job accepted. Tx: ${acceptReceipt.hash}`);
    console.log(`Explorer: https://sepolia.mantlescan.xyz/tx/${acceptReceipt.hash}`);
  } else if (status === JOB_STATUS_ASSIGNED) {
    if (Number(job.assignedAgentId) !== NEURAL_SCRIBE_AGENT_ID) {
      throw new Error(
        "Job " + jobId + " is ASSIGNED to agent " +
        job.assignedAgentId + ", not NeuralScribe agent " +
        NEURAL_SCRIBE_AGENT_ID + ". Cannot proceed."
      );
    }
    console.log(
      "Job is already ASSIGNED — skipping acceptJob, " +
      "proceeding directly to AI execution and submitProof."
    );
  } else {
    throw new Error(
      "Job " + jobId + " is in unexpected status: " +
      status + ". Cannot proceed."
    );
  }

  const prompt = `You are NeuralScribe, an autonomous AI agent registered on the Agent Atlas reputation protocol on Mantle blockchain. You have been assigned the following task:

TASK: ${description}

Complete this task thoroughly and professionally. Your output will be cryptographically hashed and submitted as proof of work on the Mantle blockchain. The hash of your response will be permanently recorded on-chain as evidence of task completion.

Provide a complete, structured response with clear sections, findings, and conclusions. This is real work that will be verified by the job creator.`;

  const aiOutput = await callAI(prompt);
  console.log(
    "AI response received (" +
    aiOutput.length + " characters)"
  );
  console.log(`\nAI output preview:`);
  console.log(`${"─".repeat(60)}`);
  console.log(aiOutput.substring(0, 500) + (aiOutput.length > 500 ? "\n... [truncated for display]" : ""));
  console.log(`${"─".repeat(60)}`);

  const outputDir = path.join(__dirname, "..", "submission-assets");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `ai-job-${jobId}-output.txt`);
  const resultHash = ethers.keccak256(ethers.toUtf8Bytes(aiOutput));
  const fullOutput = `Agent Atlas AI Agent — NeuralScribe (agentId=${NEURAL_SCRIBE_AGENT_ID})
Job ID: ${jobId}
Job Description: ${description}
Executed: ${new Date().toISOString()}
Model: llama-3.3-70b-versatile

════════════════════════════════════════════════════════════════
AI WORK OUTPUT
════════════════════════════════════════════════════════════════

${aiOutput}

════════════════════════════════════════════════════════════════
PROOF
════════════════════════════════════════════════════════════════
Result Hash: ${resultHash}
Job Accept Tx: ${acceptReceipt ? acceptReceipt.hash : "already assigned before script run"}
`;
  fs.writeFileSync(outputFile, fullOutput);
  console.log(`\nFull AI output saved to: ${outputFile}`);

  console.log(`\nSubmitting proof hash: ${resultHash}`);
  const proofTx = await proofVerifierC.submitProof(jobId, NEURAL_SCRIBE_AGENT_ID, resultHash);
  const proofReceipt = await proofTx.wait();
  console.log(`Proof submitted. Tx: ${proofReceipt.hash}`);
  console.log(`Explorer: https://sepolia.mantlescan.xyz/tx/${proofReceipt.hash}`);

  console.log("\nAccepting proof...");
  const acceptProofTx = await proofVerifierA.acceptProof(jobId, NEURAL_SCRIBE_AGENT_ID);
  const acceptProofReceipt = await acceptProofTx.wait();
  console.log(`Proof accepted. Tx: ${acceptProofReceipt.hash}`);
  console.log(`Explorer: https://sepolia.mantlescan.xyz/tx/${acceptProofReceipt.hash}`);

  fs.appendFileSync(outputFile, `Proof Submit Tx: ${proofReceipt.hash}
Proof Accept Tx: ${acceptProofReceipt.hash}
Explorer (proof): https://sepolia.mantlescan.xyz/tx/${acceptProofReceipt.hash}
`);

  console.log("\nSaving AI output to backend...");
  try {
    const saveRes = await fetch("https://agent-atlas.up.railway.app/outputs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId,
        agentId: NEURAL_SCRIBE_AGENT_ID,
        agentName: "NeuralScribe",
        jobDescription: description,
        aiOutput,
        model: "llama-3.3-70b-versatile",
        proofHash: resultHash,
        submitTx: proofReceipt.hash,
        acceptTx: acceptProofReceipt.hash
      })
    });
    const saveData = await saveRes.json();
    if (saveData.success) {
      console.log(`   AI output saved. ${saveData.outputLength} chars stored.`);
      console.log(`   View at: https://agent-atlas.up.railway.app/outputs/${jobId}`);
    } else {
      console.warn(`   Save failed: ${saveData.error}`);
    }
  } catch (err) {
    console.warn(`   Could not save output: ${err.message}`);
  }

  console.log(`\nJob ${jobId} complete. NeuralScribe score updated.`);
  console.log(`Output file: ${outputFile}`);
  console.log(`View on chain: https://sepolia.mantlescan.xyz/tx/${acceptProofReceipt.hash}`);
}

main().catch(err => {
  console.error("AI Agent failed:", err.message);
  process.exit(1);
});

