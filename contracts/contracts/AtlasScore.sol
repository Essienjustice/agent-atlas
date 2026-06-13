// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AtlasScore {
    struct Score {
        uint256 successCount;
        uint256 failureCount;
        uint256 taskVolume;
        uint256 reliabilityScore;
    }

    address public verifier;
    address public immutable deployer;
    uint256 public constant MAX_POSITIVE_CREDIT_PER_PAIR = 3;
    mapping(uint256 => Score) public scores;
    mapping(uint256 => bool) public countedJobs;
    mapping(uint256 => mapping(address => uint256)) public positivePairCredits;

    event ScoreUpdated(
        uint256 indexed agentId,
        uint256 successCount,
        uint256 failureCount,
        uint256 taskVolume,
        uint256 reliabilityScore,
        uint256 indexed jobId
    );

    modifier onlyVerifier() {
        require(msg.sender == verifier, "only verifier");
        _;
    }

    constructor() {
        deployer = msg.sender;
    }

    function setVerifier(address verifier_) external {
        require(msg.sender == deployer, "only deployer");
        require(verifier_ != address(0), "verifier required");
        require(verifier == address(0), "verifier set");
        verifier = verifier_;
    }

    function recordVerifiedProof(uint256 agentId, uint256 jobId, address creator, address agentOwner) external onlyVerifier {
        if (countedJobs[jobId]) return;
        countedJobs[jobId] = true;
        if (creator == agentOwner) return;
        if (positivePairCredits[agentId][creator] >= MAX_POSITIVE_CREDIT_PER_PAIR) return;
        positivePairCredits[agentId][creator] += 1;

        Score storage score = scores[agentId];
        score.successCount += 1;
        score.taskVolume += 1;
        score.reliabilityScore = _computeReliability(score.successCount, score.failureCount, score.taskVolume);

        emit ScoreUpdated(agentId, score.successCount, score.failureCount, score.taskVolume, score.reliabilityScore, jobId);
    }

    function recordFailedProof(uint256 agentId, uint256 jobId) external onlyVerifier {
        if (countedJobs[jobId]) return;
        countedJobs[jobId] = true;

        Score storage score = scores[agentId];
        score.failureCount += 1;
        score.taskVolume += 1;
        score.reliabilityScore = _computeReliability(score.successCount, score.failureCount, score.taskVolume);

        emit ScoreUpdated(agentId, score.successCount, score.failureCount, score.taskVolume, score.reliabilityScore, jobId);
    }

    function _computeReliability(uint256 successCount, uint256 failureCount, uint256 taskVolume) private pure returns (uint256) {
        if (taskVolume == 0) return 0;
        uint256 successRate = (successCount * 100) / taskVolume;
        uint256 volumeComponent = taskVolume > 100 ? 100 : taskVolume;
        uint256 failurePenalty = (failureCount * 100) / taskVolume;
        uint256 base = (successRate * 80 + volumeComponent * 20) / 100;
        return failurePenalty >= base ? 0 : base - failurePenalty;
    }
}
