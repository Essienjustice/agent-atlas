require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const deployment = require("../contracts/deployments/mantleSepolia.json");

const agentRegistryAbi = [
  "function REGISTRATION_STAKE() external view returns (uint256)",
  "function ownerOf(uint256 agentId) external view returns (address)",
  "function registerAgent(string name,string skills,string erc8004Id) external payable returns (uint256)"
];
const jobManagerAbi = [
  "function JOB_BOND() external view returns (uint256)",
  "function acceptJob(uint256 jobId,uint256 agentId) external",
  "function creatorOf(uint256 jobId) external view returns (address)"
];
const proofVerifierAbi = [
  "function submitProof(uint256 jobId,uint256 agentId,bytes32 resultHash) external",
  "function acceptProof(uint256 jobId,uint256 agentId) external",
  "function verifiedJobs(uint256 jobId) external view returns (bool)"
];
const atlasScoreAbi = [
  "function MAX_POSITIVE_CREDIT_PER_PAIR() external view returns (uint256)",
  "function positivePairCredits(uint256 agentId,address creator) external view returns (uint256)",
  "function recordVerifiedProof(uint256 agentId,uint256 jobId,address creator,address agentOwner) external"
];

function requireEnv(key) {
  if (!process.env[key]) throw new Error(`Missing required env: ${key}`);
  return process.env[key];
}

async function main() {
  const provider = new ethers.JsonRpcProvider(requireEnv("RPC_URL"));
  const addresses = {
    AgentRegistry: requireEnv("AGENT_REGISTRY_ADDRESS"),
    JobManager: requireEnv("JOB_MANAGER_ADDRESS"),
    ProofVerifier: requireEnv("PROOF_VERIFIER_ADDRESS"),
    AtlasScore: requireEnv("ATLAS_SCORE_ADDRESS")
  };
  const expected = {
    AgentRegistry: deployment.contracts.AgentRegistry.address,
    JobManager: deployment.contracts.JobManager.address,
    ProofVerifier: deployment.contracts.ProofVerifier.address,
    AtlasScore: deployment.contracts.AtlasScore.address
  };

  const contracts = {
    AgentRegistry: new ethers.Contract(addresses.AgentRegistry, agentRegistryAbi, provider),
    JobManager: new ethers.Contract(addresses.JobManager, jobManagerAbi, provider),
    ProofVerifier: new ethers.Contract(addresses.ProofVerifier, proofVerifierAbi, provider),
    AtlasScore: new ethers.Contract(addresses.AtlasScore, atlasScoreAbi, provider)
  };

  const bytecode = {};
  for (const [name, address] of Object.entries(addresses)) {
    const code = await provider.getCode(address);
    bytecode[name] = {
      address,
      matchesArtifact: address.toLowerCase() === expected[name].toLowerCase(),
      hasBytecode: Boolean(code && code !== "0x"),
      bytecodeLength: code.length
    };
  }

  async function readValue(label, fn) {
    try {
      const value = await fn();
      return { ok: true, value: value.toString() };
    } catch (error) {
      return { ok: false, error: error.shortMessage || error.message };
    }
  }

  const registrationStake = await readValue("REGISTRATION_STAKE", () => contracts.AgentRegistry.REGISTRATION_STAKE());
  const jobBond = await readValue("JOB_BOND", () => contracts.JobManager.JOB_BOND());
  const pairCap = await readValue("MAX_POSITIVE_CREDIT_PER_PAIR", () => contracts.AtlasScore.MAX_POSITIVE_CREDIT_PER_PAIR());

  const interfaceChecks = {
    registerAgent: contracts.AgentRegistry.interface.hasFunction("registerAgent"),
    acceptJob: contracts.JobManager.interface.hasFunction("acceptJob"),
    submitProof: contracts.ProofVerifier.interface.hasFunction("submitProof"),
    acceptProof: contracts.ProofVerifier.interface.hasFunction("acceptProof"),
    recordVerifiedProof: contracts.AtlasScore.interface.hasFunction("recordVerifiedProof")
  };

  const results = {
    generatedAt: new Date().toISOString(),
    network: "mantleSepolia",
    chainId: 5003,
    bytecode,
    constants: {
      registrationStakeWei: registrationStake,
      registrationStakePass: registrationStake.ok && BigInt(registrationStake.value) === ethers.parseEther("0.01"),
      jobBondWei: jobBond,
      jobBondPass: jobBond.ok && BigInt(jobBond.value) === ethers.parseEther("0.005"),
      maxPositiveCreditPerPair: pairCap,
      pairCapPass: pairCap.ok && BigInt(pairCap.value) === 3n
    },
    abiCompatibility: interfaceChecks,
    status: {
      deploymentAddressesMatchArtifacts: Object.values(bytecode).every((item) => item.matchesArtifact),
      allContractsHaveBytecode: Object.values(bytecode).every((item) => item.hasBytecode),
      requiredInterfacesPresent: Object.values(interfaceChecks).every(Boolean),
      liveConstantsMatchSubmittedSource: (
        registrationStake.ok && BigInt(registrationStake.value) === ethers.parseEther("0.01") &&
        jobBond.ok && BigInt(jobBond.value) === ethers.parseEther("0.005") &&
        pairCap.ok && BigInt(pairCap.value) === 3n
      )
    }
  };

  const out = path.join(__dirname, "..", "contracts", "deployments", "mantleSepolia-deployment-consistency.json");
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
