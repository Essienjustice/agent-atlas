const { ethers } = require("ethers");

const agentRegistryAbi = [
  "function registerAgent(string name,string skills,string erc8004Id) external payable returns (uint256)",
  "function agentExists(uint256 agentId) external view returns (bool)",
  "function ownerOf(uint256 agentId) external view returns (address)",
  "event AgentRegistered(uint256 indexed agentId,string name,string skills,string erc8004Id,address indexed owner,uint256 registeredAt)"
];

const jobManagerAbi = [
  "function createJob(string description,uint256 reward) external payable returns (uint256)",
  "function acceptJob(uint256 jobId,uint256 agentId) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 jobId,string description,uint256 reward,uint8 status,uint256 assignedAgentId,address creator,uint256 createdAt))",
  "event JobCreated(uint256 indexed jobId,string description,uint256 reward,address indexed creator)",
  "event JobAccepted(uint256 indexed jobId,uint256 indexed agentId,address indexed agentOwner)",
  "event JobCompleted(uint256 indexed jobId,uint256 indexed agentId)",
  "event JobFailed(uint256 indexed jobId,uint256 indexed agentId,bytes32 reasonHash)"
];

const proofVerifierAbi = [
  "function submitProof(uint256 jobId,uint256 agentId,bytes32 resultHash) external",
  "function acceptProof(uint256 jobId,uint256 agentId) external",
  "function markJobFailed(uint256 jobId,uint256 agentId,bytes32 reasonHash) external",
  "event ProofSubmitted(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)",
  "event ProofVerified(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)",
  "event ProofFailed(uint256 indexed jobId,uint256 indexed agentId,bytes32 reasonHash)"
];

const atlasScoreAbi = [
  "function scores(uint256 agentId) external view returns (uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore)",
  "event ScoreUpdated(uint256 indexed agentId,uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore,uint256 indexed jobId)"
];

function explorerTxUrl(hash) {
  const base = process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz";
  return hash ? `${base.replace(/\/$/, "")}/tx/${hash}` : null;
}

function contractUrl(address) {
  const base = process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz";
  return address ? `${base.replace(/\/$/, "")}/address/${address}` : null;
}

function isChainMode() {
  return process.env.CHAIN_MODE === "chain";
}

function requiredAddresses() {
  return {
    agentRegistry: process.env.AGENT_REGISTRY_ADDRESS,
    jobManager: process.env.JOB_MANAGER_ADDRESS,
    proofVerifier: process.env.PROOF_VERIFIER_ADDRESS,
    atlasScore: process.env.ATLAS_SCORE_ADDRESS
  };
}

function chainId() {
  return Number(process.env.CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID || 5003);
}

function requireChainConfig() {
  const addresses = requiredAddresses();
  const missing = Object.entries({
    RPC_URL: process.env.RPC_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    AGENT_REGISTRY_ADDRESS: addresses.agentRegistry,
    JOB_MANAGER_ADDRESS: addresses.jobManager,
    PROOF_VERIFIER_ADDRESS: addresses.proofVerifier,
    ATLAS_SCORE_ADDRESS: addresses.atlasScore
  }).filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`CHAIN_MODE=chain missing config: ${missing.map(([key]) => key).join(", ")}`);
  }
}

function requireReadConfig() {
  const addresses = requiredAddresses();
  const missing = Object.entries({
    RPC_URL: process.env.RPC_URL,
    AGENT_REGISTRY_ADDRESS: addresses.agentRegistry,
    JOB_MANAGER_ADDRESS: addresses.jobManager,
    PROOF_VERIFIER_ADDRESS: addresses.proofVerifier,
    ATLAS_SCORE_ADDRESS: addresses.atlasScore
  }).filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`CHAIN_MODE=chain missing read config: ${missing.map(([key]) => key).join(", ")}`);
  }
}

function requireAddressConfig() {
  const addresses = requiredAddresses();
  const missing = Object.entries({
    AGENT_REGISTRY_ADDRESS: addresses.agentRegistry,
    JOB_MANAGER_ADDRESS: addresses.jobManager,
    PROOF_VERIFIER_ADDRESS: addresses.proofVerifier,
    ATLAS_SCORE_ADDRESS: addresses.atlasScore
  }).filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`missing contract config: ${missing.map(([key]) => key).join(", ")}`);
  }
}

function client() {
  requireChainConfig();
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const addresses = requiredAddresses();
  return {
    provider,
    wallet,
    agentRegistry: new ethers.Contract(addresses.agentRegistry, agentRegistryAbi, wallet),
    jobManager: new ethers.Contract(addresses.jobManager, jobManagerAbi, wallet),
    proofVerifier: new ethers.Contract(addresses.proofVerifier, proofVerifierAbi, wallet),
    atlasScore: new ethers.Contract(addresses.atlasScore, atlasScoreAbi, wallet),
    addresses
  };
}

async function assertContractsReachable() {
  if (!isChainMode()) return;
  requireReadConfig();
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  for (const [name, address] of Object.entries(requiredAddresses())) {
    const code = await provider.getCode(address);
    if (!code || code === "0x") throw new Error(`Contract ${name} is unreachable at ${address}`);
  }
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

async function createJobOnChain({ description, reward }) {
  if (!isChainMode()) return { chainMode: false };
  const { jobManager } = client();
  const tx = await jobManager.createJob(description, reward, { value: JOB_BOND_WEI });
  const receipt = await tx.wait(1);
  const event = parseEvent(receipt, jobManager, "JobCreated");
  return {
    chainMode: true,
    onChainJobId: event ? Number(event.args.jobId) : null,
    transactionHash: receipt.hash || receipt.transactionHash,
    transactionUrl: explorerTxUrl(receipt.hash || receipt.transactionHash),
    contractAddress: await jobManager.getAddress(),
    contractUrl: contractUrl(await jobManager.getAddress()),
    blockNumber: Number(receipt.blockNumber)
  };
}

async function acceptJobOnChain({ jobId, agent }) {
  if (!isChainMode()) return { chainMode: false };
  const { agentRegistry, jobManager, wallet } = client();
  const agentId = Number(agent.id);
  if (!(await agentRegistry.agentExists(agentId))) {
    throw new Error(`Agent ${agentId} is not registered on-chain`);
  }
  const owner = await agentRegistry.ownerOf(agentId);
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`Backend signer is not owner of agent ${agentId}`);
  }
  const tx = await jobManager.acceptJob(jobId, agentId);
  const receipt = await tx.wait(1);
  return {
    chainMode: true,
    onChainAgentId: agentId,
    transactionHash: receipt.hash || receipt.transactionHash,
    transactionUrl: explorerTxUrl(receipt.hash || receipt.transactionHash),
    contractAddress: await jobManager.getAddress(),
    contractUrl: contractUrl(await jobManager.getAddress()),
    blockNumber: Number(receipt.blockNumber)
  };
}

const REGISTRATION_STAKE_WEI = 10_000_000_000_000_000n;
const JOB_BOND_WEI = 5_000_000_000_000_000n;

function txRequest(to, data, value = 0n) {
  return {
    chainId: chainId(),
    to,
    data,
    value: `0x${BigInt(value).toString(16)}`
  };
}

function buildUnsignedTransaction({ action, params }) {
  requireAddressConfig();
  const addresses = requiredAddresses();
  if (action === "registerAgent") {
    const iface = new ethers.Interface(agentRegistryAbi);
    return txRequest(addresses.agentRegistry, iface.encodeFunctionData("registerAgent", [
      params.name,
      params.skills,
      params.externalIdentifier || params.erc8004Id || ""
    ]), REGISTRATION_STAKE_WEI);
  }
  if (action === "createJob") {
    const iface = new ethers.Interface(jobManagerAbi);
    return txRequest(addresses.jobManager, iface.encodeFunctionData("createJob", [
      params.description,
      Number(params.reward || 0)
    ]), JOB_BOND_WEI);
  }
  if (action === "acceptJob") {
    const iface = new ethers.Interface(jobManagerAbi);
    return txRequest(addresses.jobManager, iface.encodeFunctionData("acceptJob", [
      Number(params.jobId),
      Number(params.agentId)
    ]));
  }
  if (action === "submitProof") {
    const iface = new ethers.Interface(proofVerifierAbi);
    return txRequest(addresses.proofVerifier, iface.encodeFunctionData("submitProof", [
      Number(params.jobId),
      Number(params.agentId),
      params.resultHash
    ]));
  }
  if (action === "acceptProof") {
    const iface = new ethers.Interface(proofVerifierAbi);
    return txRequest(addresses.proofVerifier, iface.encodeFunctionData("acceptProof", [
      Number(params.jobId),
      Number(params.agentId)
    ]));
  }
  if (action === "markJobFailed") {
    const iface = new ethers.Interface(proofVerifierAbi);
    return txRequest(addresses.proofVerifier, iface.encodeFunctionData("markJobFailed", [
      Number(params.jobId),
      Number(params.agentId),
      params.reasonHash
    ]));
  }
  throw new Error(`unsupported transaction action: ${action}`);
}

async function submitProofOnChain({ jobId, agentId, resultHash }) {
  if (!isChainMode()) return { chainMode: false };
  const { proofVerifier, atlasScore } = client();
  const tx = await proofVerifier.submitProof(jobId, agentId, resultHash);
  const receipt = await tx.wait(1);
  const proofSubmitted = parseEvent(receipt, proofVerifier, "ProofSubmitted");

  return {
    chainMode: true,
    transactionHash: receipt.hash || receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    contractAddress: await proofVerifier.getAddress(),
    transactionUrl: explorerTxUrl(receipt.hash || receipt.transactionHash),
    contractUrl: contractUrl(await proofVerifier.getAddress()),
    events: {
      ProofSubmitted: Boolean(proofSubmitted),
      ProofVerified: false,
      ScoreUpdated: false
    },
    onChainScore: null
  };
}

async function markJobFailedOnChain({ jobId, agentId, reasonHash }) {
  if (!isChainMode()) return { chainMode: false };
  const { proofVerifier, atlasScore } = client();
  const tx = await proofVerifier.markJobFailed(jobId, agentId, reasonHash);
  const receipt = await tx.wait(1);
  const proofFailed = parseEvent(receipt, proofVerifier, "ProofFailed");
  const scoreUpdated = parseEvent(receipt, atlasScore, "ScoreUpdated");
  return {
    chainMode: true,
    transactionHash: receipt.hash || receipt.transactionHash,
    blockNumber: Number(receipt.blockNumber),
    contractAddress: await proofVerifier.getAddress(),
    transactionUrl: explorerTxUrl(receipt.hash || receipt.transactionHash),
    contractUrl: contractUrl(await proofVerifier.getAddress()),
    events: {
      ProofFailed: Boolean(proofFailed),
      ScoreUpdated: Boolean(scoreUpdated)
    },
    onChainScore: scoreUpdated
      ? {
          agentId: Number(scoreUpdated.args.agentId),
          successCount: Number(scoreUpdated.args.successCount),
          failureCount: Number(scoreUpdated.args.failureCount),
          taskVolume: Number(scoreUpdated.args.taskVolume),
          reliabilityScore: Number(scoreUpdated.args.reliabilityScore),
          jobId: Number(scoreUpdated.args.jobId)
        }
      : null
  };
}

module.exports = {
  acceptJobOnChain,
  assertContractsReachable,
  buildUnsignedTransaction,
  contractUrl,
  createJobOnChain,
  explorerTxUrl,
  isChainMode,
  markJobFailedOnChain,
  submitProofOnChain
};
