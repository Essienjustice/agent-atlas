const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const demoAgents = [
  ["RiskAgent", "USDY,risk,compliance", "erc8004:mantle:risk-agent"],
  ["YieldAgent", "mETH,yield,routing", "erc8004:mantle:yield-agent"],
  ["ResearchAgent", "research,markets,summaries", "erc8004:mantle:research-agent"]
];

const demoJobs = [
  ["USDY Risk Analysis", 120],
  ["mETH Yield Optimization", 150],
  ["Mantle Ecosystem Research", 90]
];

async function main() {
  const network = await hre.ethers.provider.getNetwork();

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();

  const JobManager = await hre.ethers.getContractFactory("JobManager");
  const jobManager = await JobManager.deploy(await agentRegistry.getAddress());
  await jobManager.waitForDeployment();

  const AtlasScore = await hre.ethers.getContractFactory("AtlasScore");
  const atlasScore = await AtlasScore.deploy();
  await atlasScore.waitForDeployment();

  const ProofVerifier = await hre.ethers.getContractFactory("ProofVerifier");
  const proofVerifier = await ProofVerifier.deploy(
    await jobManager.getAddress(),
    await atlasScore.getAddress(),
    await agentRegistry.getAddress()
  );
  await proofVerifier.waitForDeployment();

  await (await jobManager.setVerifier(await proofVerifier.getAddress())).wait();
  await (await atlasScore.setVerifier(await proofVerifier.getAddress())).wait();

  if (process.env.SEED_ON_DEPLOY === "true") {
    for (const args of demoAgents) {
      await (await agentRegistry.registerAgent(...args, { value: hre.ethers.parseEther("0.01") })).wait();
    }
    for (const args of demoJobs) {
      await (await jobManager.createJob(...args, { value: hre.ethers.parseEther("0.005") })).wait();
    }
  }

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    seedOnDeploy: process.env.SEED_ON_DEPLOY === "true",
    contracts: {
      AgentRegistry: {
        address: await agentRegistry.getAddress(),
        deploymentTxHash: agentRegistry.deploymentTransaction()?.hash || null,
        constructorArgs: []
      },
      JobManager: {
        address: await jobManager.getAddress(),
        deploymentTxHash: jobManager.deploymentTransaction()?.hash || null,
        constructorArgs: [await agentRegistry.getAddress()]
      },
      AtlasScore: {
        address: await atlasScore.getAddress(),
        deploymentTxHash: atlasScore.deploymentTransaction()?.hash || null,
        constructorArgs: []
      },
      ProofVerifier: {
        address: await proofVerifier.getAddress(),
        deploymentTxHash: proofVerifier.deploymentTransaction()?.hash || null,
        constructorArgs: [await jobManager.getAddress(), await atlasScore.getAddress(), await agentRegistry.getAddress()]
      }
    }
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${hre.network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));

  console.log(`Deployment written to ${outFile}`);
  console.log(`AGENT_REGISTRY_ADDRESS=${deployment.contracts.AgentRegistry.address}`);
  console.log(`JOB_MANAGER_ADDRESS=${deployment.contracts.JobManager.address}`);
  console.log(`PROOF_VERIFIER_ADDRESS=${deployment.contracts.ProofVerifier.address}`);
  console.log(`ATLAS_SCORE_ADDRESS=${deployment.contracts.AtlasScore.address}`);
  console.log(`AGENT_REGISTRY_DEPLOY_TX=${deployment.contracts.AgentRegistry.deploymentTxHash}`);
  console.log(`JOB_MANAGER_DEPLOY_TX=${deployment.contracts.JobManager.deploymentTxHash}`);
  console.log(`PROOF_VERIFIER_DEPLOY_TX=${deployment.contracts.ProofVerifier.deploymentTxHash}`);
  console.log(`ATLAS_SCORE_DEPLOY_TX=${deployment.contracts.AtlasScore.deploymentTxHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
