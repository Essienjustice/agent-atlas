// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJobManager {
    function jobExists(uint256 jobId) external view returns (bool);
    function assignedAgent(uint256 jobId) external view returns (uint256);
    function creatorOf(uint256 jobId) external view returns (address);
    function agentOwnerOf(uint256 agentId) external view returns (address);
    function markCompleted(uint256 jobId) external;
    function markFailed(uint256 jobId, bytes32 reasonHash) external;
}

interface IAgentRegistryForProofs {
    function ownerOf(uint256 agentId) external view returns (address);
}

interface IAtlasScore {
    function recordVerifiedProof(uint256 agentId, uint256 jobId, address creator, address agentOwner) external;
    function recordFailedProof(uint256 agentId, uint256 jobId) external;
}

contract ProofVerifier {
    struct Proof {
        uint256 jobId;
        uint256 agentId;
        bytes32 resultHash;
        bool verified;
        bool submitted;
        uint256 verifiedAt;
    }

    IJobManager public jobManager;
    IAtlasScore public atlasScore;
    IAgentRegistryForProofs public agentRegistry;
    mapping(uint256 => Proof) public proofs;
    mapping(uint256 => bool) public verifiedJobs;
    mapping(uint256 => bool) public failedJobs;

    event ProofSubmitted(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash);
    event ProofVerified(uint256 indexed jobId, uint256 indexed agentId, bytes32 resultHash);
    event ProofFailed(uint256 indexed jobId, uint256 indexed agentId, bytes32 reasonHash);

    constructor(address jobManager_, address atlasScore_, address agentRegistry_) {
        jobManager = IJobManager(jobManager_);
        atlasScore = IAtlasScore(atlasScore_);
        agentRegistry = IAgentRegistryForProofs(agentRegistry_);
    }

    function submitProof(uint256 jobId, uint256 agentId, bytes32 resultHash) external {
        require(jobManager.jobExists(jobId), "job missing");
        require(jobManager.assignedAgent(jobId) == agentId, "wrong agent");
        require(agentRegistry.ownerOf(agentId) == msg.sender, "only agent owner");
        require(resultHash != bytes32(0), "hash required");
        require(!proofs[jobId].submitted, "already submitted");
        require(!verifiedJobs[jobId], "already verified");
        require(!failedJobs[jobId], "already failed");

        proofs[jobId] = Proof(jobId, agentId, resultHash, false, true, 0);
        emit ProofSubmitted(jobId, agentId, resultHash);
    }

    function acceptProof(uint256 jobId, uint256 agentId) external {
        Proof storage proof = proofs[jobId];
        require(proof.submitted, "proof missing");
        require(proof.agentId == agentId, "wrong agent");
        require(jobManager.creatorOf(jobId) == msg.sender, "only job creator");
        require(!verifiedJobs[jobId], "already verified");
        require(!failedJobs[jobId], "already failed");

        proof.verified = true;
        proof.verifiedAt = block.timestamp;
        jobManager.markCompleted(jobId);
        verifiedJobs[jobId] = true;
        emit ProofVerified(jobId, agentId, proof.resultHash);
        atlasScore.recordVerifiedProof(agentId, jobId, msg.sender, jobManager.agentOwnerOf(agentId));
    }

    function markJobFailed(uint256 jobId, uint256 agentId, bytes32 reasonHash) external {
        require(jobManager.jobExists(jobId), "job missing");
        require(jobManager.assignedAgent(jobId) == agentId, "wrong agent");
        require(jobManager.creatorOf(jobId) == msg.sender, "only job creator");
        require(reasonHash != bytes32(0), "reason required");
        require(proofs[jobId].submitted, "proof missing");
        require(!verifiedJobs[jobId], "already verified");
        require(!failedJobs[jobId], "already failed");

        failedJobs[jobId] = true;
        jobManager.markFailed(jobId, reasonHash);
        emit ProofFailed(jobId, agentId, reasonHash);
        atlasScore.recordFailedProof(agentId, jobId);
    }
}
