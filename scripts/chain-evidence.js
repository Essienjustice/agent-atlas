require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const {
  createJobOnChain
} = require("../backend/src/chain");

const deployment = require("../contracts/deployments/mantleSepolia.json");

const explorer = (process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz").replace(/\/$/, "");
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const agentOwner = ethers.Wallet.fromPhrase("test test test test test test test test test test test junk", provider);

const agentRegistryAbi = [
  "function registerAgent(string name,string skills,string erc8004Id) external payable returns (uint256)",
  "event AgentRegistered(uint256 indexed agentId,string name,string skills,string erc8004Id,address indexed owner,uint256 registeredAt)"
];

const agentRegistry = new ethers.Contract(
  process.env.AGENT_REGISTRY_ADDRESS,
  agentRegistryAbi,
  agentOwner
);

async function retry(label, fn, attempts = 5) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      console.error(`${label} attempt ${i} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1200 * i));
    }
  }
  throw last;
}

async function txEvidence(hash) {
  const receipt = await retry(`receipt ${hash}`, () => provider.getTransactionReceipt(hash));
  const block = await retry(`block ${receipt.blockNumber}`, () => provider.getBlock(receipt.blockNumber));
  return {
    hash,
    blockNumber: receipt.blockNumber,
    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    explorerUrl: `${explorer}/tx/${hash}`
  };
}

async function deploymentEvidence() {
  const entries = {};
  for (const [name, item] of Object.entries(deployment.contracts)) {
    entries[name] = {
      address: item.address,
      explorerUrl: `${explorer}/address/${item.address}`,
      deploymentTx: await txEvidence(item.deploymentTxHash)
    };
  }
  return entries;
}

function parseEvent(receipt, contract, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === eventName) return parsed;
    } catch {
      // Ignore logs from other contracts.
    }
  }
  return null;
}

async function registerFreshAgent() {
  const balance = await provider.getBalance(agentOwner.address);
  if (balance < ethers.parseEther("0.02")) {
    await (await wallet.sendTransaction({ to: agentOwner.address, value: ethers.parseEther("0.05") })).wait(1);
  }
  const nonce = Date.now();
  const tx = await agentRegistry.registerAgent(
    `AuditAgent${nonce}`,
    "audit,proof,reputation",
    `erc8004:mantle:audit-agent-${nonce}`,
    { value: ethers.parseEther("0.01") }
  );
  const receipt = await tx.wait(1);
  const event = parseEvent(receipt, agentRegistry, "AgentRegistered");
  return {
    chainMode: true,
    onChainAgentId: Number(event.args.agentId),
    transactionHash: receipt.hash || receipt.transactionHash,
    transactionUrl: `${explorer}/tx/${receipt.hash || receipt.transactionHash}`,
    contractAddress: process.env.AGENT_REGISTRY_ADDRESS,
    contractUrl: `${explorer}/address/${process.env.AGENT_REGISTRY_ADDRESS}`,
    blockNumber: Number(receipt.blockNumber),
    emittedEvents: ["AgentRegistered"]
  };
}

async function main() {
  const agentCreated = await retry("register fresh agent", () => registerFreshAgent());
  const agent = {
    id: agentCreated.onChainAgentId,
    name: `AuditAgent${agentCreated.onChainAgentId}`,
    skills: ["audit", "proof", "reputation"],
    erc8004Id: `erc8004:mantle:audit-agent-${agentCreated.onChainAgentId}`
  };
  const jobCreated = await retry("create job", () =>
    createJobOnChain({ description: `Deployment Verification ${Date.now()}`, reward: 1 })
  );
  const jobManagerAbi = ["function acceptJob(uint256 jobId,uint256 agentId) external"];
  const proofVerifierAbi = [
    "function submitProof(uint256 jobId,uint256 agentId,bytes32 resultHash) external",
    "function acceptProof(uint256 jobId,uint256 agentId) external",
    "event ProofSubmitted(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)",
    "event ProofVerified(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)"
  ];
  const jobManager = new ethers.Contract(process.env.JOB_MANAGER_ADDRESS, jobManagerAbi, agentOwner);
  const proofVerifier = new ethers.Contract(process.env.PROOF_VERIFIER_ADDRESS, proofVerifierAbi, agentOwner);
  const atlasScoreAbi = [
    "function scores(uint256 agentId) external view returns (uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore)",
    "event ScoreUpdated(uint256 indexed agentId,uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore,uint256 indexed jobId)"
  ];
  const atlasScore = new ethers.Contract(process.env.ATLAS_SCORE_ADDRESS, atlasScoreAbi, provider);
  const acceptTx = await jobManager.acceptJob(jobCreated.onChainJobId, agent.id);
  const acceptReceipt = await acceptTx.wait(1);
  const jobAccepted = {
    chainMode: true,
    onChainAgentId: agent.id,
    transactionHash: acceptReceipt.hash || acceptReceipt.transactionHash,
    transactionUrl: `${explorer}/tx/${acceptReceipt.hash || acceptReceipt.transactionHash}`,
    contractAddress: process.env.JOB_MANAGER_ADDRESS,
    contractUrl: `${explorer}/address/${process.env.JOB_MANAGER_ADDRESS}`,
    blockNumber: Number(acceptReceipt.blockNumber)
  };
  const proofHash = ethers.id(`agent-atlas-proof-${jobCreated.onChainJobId}`);
  const proofTx = await proofVerifier.submitProof(jobCreated.onChainJobId, jobAccepted.onChainAgentId, proofHash);
  const proofReceipt = await proofTx.wait(1);
  const proofSubmittedEvent = parseEvent(proofReceipt, proofVerifier, "ProofSubmitted");
  const creatorProofVerifier = new ethers.Contract(process.env.PROOF_VERIFIER_ADDRESS, proofVerifierAbi, wallet);
  const acceptProofTx = await creatorProofVerifier.acceptProof(jobCreated.onChainJobId, jobAccepted.onChainAgentId);
  const acceptProofReceipt = await acceptProofTx.wait(1);
  const proofVerifiedEvent = parseEvent(acceptProofReceipt, creatorProofVerifier, "ProofVerified");
  const scoreUpdatedEvent = parseEvent(acceptProofReceipt, atlasScore, "ScoreUpdated");
  const scoreState = await atlasScore.scores(jobAccepted.onChainAgentId);
  const proofVerified = {
    chainMode: true,
    transactionHash: acceptProofReceipt.hash || acceptProofReceipt.transactionHash,
    transactionUrl: `${explorer}/tx/${acceptProofReceipt.hash || acceptProofReceipt.transactionHash}`,
    contractAddress: process.env.PROOF_VERIFIER_ADDRESS,
    contractUrl: `${explorer}/address/${process.env.PROOF_VERIFIER_ADDRESS}`,
    blockNumber: Number(acceptProofReceipt.blockNumber),
    events: {
      ProofVerified: Boolean(proofVerifiedEvent),
      ScoreUpdated: Boolean(scoreUpdatedEvent)
    },
    emittedEvents: [
      proofVerifiedEvent
        ? {
            name: "ProofVerified",
            args: {
              jobId: Number(proofVerifiedEvent.args.jobId),
              agentId: Number(proofVerifiedEvent.args.agentId),
              resultHash: proofVerifiedEvent.args.resultHash
            }
          }
        : null,
      scoreUpdatedEvent
        ? {
            name: "ScoreUpdated",
            args: {
              agentId: Number(scoreUpdatedEvent.args.agentId),
              successCount: Number(scoreUpdatedEvent.args.successCount),
              failureCount: Number(scoreUpdatedEvent.args.failureCount || 0),
              taskVolume: Number(scoreUpdatedEvent.args.taskVolume),
              reliabilityScore: Number(scoreUpdatedEvent.args.reliabilityScore),
              jobId: Number(scoreUpdatedEvent.args.jobId)
            }
          }
        : null
    ].filter(Boolean)
  };
  const proofSubmitted = {
    chainMode: true,
    transactionHash: proofReceipt.hash || proofReceipt.transactionHash,
    transactionUrl: `${explorer}/tx/${proofReceipt.hash || proofReceipt.transactionHash}`,
    contractAddress: process.env.PROOF_VERIFIER_ADDRESS,
    contractUrl: `${explorer}/address/${process.env.PROOF_VERIFIER_ADDRESS}`,
    blockNumber: Number(proofReceipt.blockNumber),
    events: { ProofSubmitted: Boolean(proofSubmittedEvent) },
    emittedEvents: proofSubmittedEvent
      ? [
          {
            name: "ProofSubmitted",
            args: {
              jobId: Number(proofSubmittedEvent.args.jobId),
              agentId: Number(proofSubmittedEvent.args.agentId),
              resultHash: proofSubmittedEvent.args.resultHash
            }
          }
        ]
      : []
  };

  const evidence = {
    network: deployment.network,
    chainId: deployment.chainId,
    rpcUrl: process.env.RPC_URL,
    explorer,
    deployment: await deploymentEvidence(),
    runtime: {
      CHAIN_MODE: process.env.CHAIN_MODE,
      DEMO_MODE: process.env.DEMO_MODE,
      DEMO_DAY: process.env.DEMO_DAY,
      AGENT_REGISTRY_ADDRESS: process.env.AGENT_REGISTRY_ADDRESS,
      JOB_MANAGER_ADDRESS: process.env.JOB_MANAGER_ADDRESS,
      PROOF_VERIFIER_ADDRESS: process.env.PROOF_VERIFIER_ADDRESS,
      ATLAS_SCORE_ADDRESS: process.env.ATLAS_SCORE_ADDRESS
    },
    lifecycle: {
      agentCreated,
      jobCreated,
      jobAccepted,
      proofHash,
      proofSubmitted,
      proofVerified
    },
    resultingScoreState: {
      agentId: jobAccepted.onChainAgentId,
      successCount: Number(scoreState.successCount),
      failureCount: Number(scoreState.failureCount || 0),
      taskVolume: Number(scoreState.taskVolume),
      reliabilityScore: Number(scoreState.reliabilityScore)
    },
    transactionEvidence: {
      agentCreated: agentCreated.transactionHash ? await txEvidence(agentCreated.transactionHash) : null,
      jobCreated: await txEvidence(jobCreated.transactionHash),
      jobAccepted: await txEvidence(jobAccepted.transactionHash),
      proofSubmitted: await txEvidence(proofSubmitted.transactionHash),
      proofVerified: await txEvidence(proofVerified.transactionHash)
    }
  };

  const out = path.join(__dirname, "..", "contracts", "deployments", "mantleSepolia-e2e-evidence.json");
  fs.writeFileSync(out, JSON.stringify(evidence, null, 2));
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
