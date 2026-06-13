const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { ethers } = require("hardhat");

describe("Agent Atlas", function () {
  async function deploy() {
    const [creator, agentOwner, outsider] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();

    const JobManager = await ethers.getContractFactory("JobManager");
    const jobManager = await JobManager.deploy(await agentRegistry.getAddress());

    const AtlasScore = await ethers.getContractFactory("AtlasScore");
    const atlasScore = await AtlasScore.deploy();

    const ProofVerifier = await ethers.getContractFactory("ProofVerifier");
    const proofVerifier = await ProofVerifier.deploy(
      await jobManager.getAddress(),
      await atlasScore.getAddress(),
      await agentRegistry.getAddress()
    );

    await jobManager.setVerifier(await proofVerifier.getAddress());
    await atlasScore.setVerifier(await proofVerifier.getAddress());

    return { agentRegistry, jobManager, atlasScore, proofVerifier, creator, agentOwner, outsider };
  }

  it("runs the full create, accept, verify, score lifecycle", async function () {
    const { agentRegistry, jobManager, atlasScore, proofVerifier, creator, agentOwner, outsider } = await deploy();

    await expect(agentRegistry.connect(agentOwner).registerAgent("RiskAgent", "risk,usdy", "erc8004:mantle:risk", { value: ethers.parseEther("0.01") }))
      .to.emit(agentRegistry, "AgentRegistered")
      .withArgs(1, "RiskAgent", "risk,usdy", "erc8004:mantle:risk", agentOwner.address, anyValue);

    await expect(jobManager.connect(creator).createJob("Analyze USDY risk", 100, { value: ethers.parseEther("0.005") }))
      .to.emit(jobManager, "JobCreated");

    await expect(jobManager.connect(outsider).acceptJob(1, 1)).to.be.revertedWith("only agent owner");

    await expect(jobManager.connect(agentOwner).acceptJob(1, 1))
      .to.emit(jobManager, "JobAccepted")
      .withArgs(1, 1, agentOwner.address);

    const resultHash = ethers.id("risk-report-ok");
    await expect(proofVerifier.connect(outsider).submitProof(1, 1, resultHash)).to.be.revertedWith("only agent owner");

    await expect(proofVerifier.connect(agentOwner).submitProof(1, 1, resultHash))
      .to.emit(proofVerifier, "ProofSubmitted")
      .withArgs(1, 1, resultHash);

    const pendingScore = await atlasScore.scores(1);
    expect(pendingScore.taskVolume).to.equal(0);
    expect((await jobManager.getJob(1)).status).to.equal(1);

    await expect(proofVerifier.connect(creator).acceptProof(1, 1))
      .to.emit(proofVerifier, "ProofVerified")
      .withArgs(1, 1, resultHash);

    const score = await atlasScore.scores(1);
    expect(score.taskVolume).to.equal(1);
    expect(score.successCount).to.equal(1);
    expect(score.failureCount).to.equal(0);
    expect(score.reliabilityScore).to.be.greaterThan(0);

    await expect(proofVerifier.connect(agentOwner).submitProof(1, 1, resultHash)).to.be.revertedWith("already submitted");
    const finalScore = await atlasScore.scores(1);
    expect(finalScore.taskVolume).to.equal(1);
  });

  it("blocks self-dealing and records failures against reputation", async function () {
    const { agentRegistry, jobManager, atlasScore, proofVerifier, creator, agentOwner } = await deploy();

    await agentRegistry.connect(creator).registerAgent("SelfAgent", "risk", "external:self", { value: ethers.parseEther("0.01") });
    await jobManager.connect(creator).createJob("Self dealing job", 1, { value: ethers.parseEther("0.005") });
    await expect(jobManager.connect(creator).acceptJob(1, 1)).to.be.revertedWith("self dealing");

    await agentRegistry.connect(agentOwner).registerAgent("YieldAgent", "yield", "external:yield", { value: ethers.parseEther("0.01") });
    await jobManager.connect(creator).createJob("Independent job", 1, { value: ethers.parseEther("0.005") });
    await jobManager.connect(agentOwner).acceptJob(2, 2);

    await expect(proofVerifier.connect(agentOwner).markJobFailed(2, 2, ethers.id("failed-sla"))).to.be.revertedWith("only job creator");
    await expect(proofVerifier.connect(creator).markJobFailed(2, 2, ethers.id("failed-sla"))).to.be.revertedWith("proof missing");

    const failureProof = ethers.id("submitted-but-failed");
    await expect(proofVerifier.connect(agentOwner).submitProof(2, 2, failureProof))
      .to.emit(proofVerifier, "ProofSubmitted")
      .withArgs(2, 2, failureProof);

    await expect(proofVerifier.connect(creator).markJobFailed(2, 2, ethers.id("failed-sla")))
      .to.emit(proofVerifier, "ProofFailed")
      .withArgs(2, 2, ethers.id("failed-sla"));
    await expect(proofVerifier.connect(creator).markJobFailed(2, 2, ethers.id("failed-sla-again"))).to.be.revertedWith("already failed");

    const score = await atlasScore.scores(2);
    expect(score.successCount).to.equal(0);
    expect(score.failureCount).to.equal(1);
    expect(score.taskVolume).to.equal(1);
    expect(score.reliabilityScore).to.equal(0);
  });

  it("requires economic friction and caps positive pair credit", async function () {
    const { agentRegistry, jobManager, atlasScore, proofVerifier, creator, agentOwner, outsider } = await deploy();

    await expect(agentRegistry.connect(agentOwner).registerAgent("NoStake", "risk", "external:none")).to.be.revertedWith("stake required");
    await agentRegistry.connect(agentOwner).registerAgent("RiskAgent", "risk", "external:risk", { value: ethers.parseEther("0.01") });
    await expect(jobManager.connect(creator).createJob("No bond", 1)).to.be.revertedWith("bond required");

    for (let i = 1; i <= 4; i += 1) {
      await jobManager.connect(creator).createJob(`Pair job ${i}`, 1, { value: ethers.parseEther("0.005") });
      await jobManager.connect(agentOwner).acceptJob(i, 1);
      await proofVerifier.connect(agentOwner).submitProof(i, 1, ethers.id(`pair-proof-${i}`));
      await proofVerifier.connect(creator).acceptProof(i, 1);
    }

    const score = await atlasScore.scores(1);
    expect(score.successCount).to.equal(3);
    expect(score.taskVolume).to.equal(3);
    expect(await atlasScore.positivePairCredits(1, creator.address)).to.equal(3);

    await jobManager.connect(outsider).createJob("Different creator", 1, { value: ethers.parseEther("0.005") });
    await jobManager.connect(agentOwner).acceptJob(5, 1);
    await proofVerifier.connect(agentOwner).submitProof(5, 1, ethers.id("different-creator-proof"));
    await proofVerifier.connect(outsider).acceptProof(5, 1);

    const finalScore = await atlasScore.scores(1);
    expect(finalScore.successCount).to.equal(4);
    expect(finalScore.taskVolume).to.equal(4);
  });

  it("restricts verifier initialization to the deployer", async function () {
    const [, , outsider] = await ethers.getSigners();
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const agentRegistry = await AgentRegistry.deploy();

    const JobManager = await ethers.getContractFactory("JobManager");
    const jobManager = await JobManager.deploy(await agentRegistry.getAddress());

    const AtlasScore = await ethers.getContractFactory("AtlasScore");
    const atlasScore = await AtlasScore.deploy();

    await expect(jobManager.connect(outsider).setVerifier(outsider.address)).to.be.revertedWith("only deployer");
    await expect(atlasScore.connect(outsider).setVerifier(outsider.address)).to.be.revertedWith("only deployer");
    await expect(jobManager.setVerifier(ethers.ZeroAddress)).to.be.revertedWith("verifier required");
    await expect(atlasScore.setVerifier(ethers.ZeroAddress)).to.be.revertedWith("verifier required");
  });
});
