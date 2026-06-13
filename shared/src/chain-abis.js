const agentRegistryAbi = [
  "function REGISTRATION_STAKE() external view returns (uint256)",
  "function ownerOf(uint256 agentId) external view returns (address)",
  "event AgentRegistered(uint256 indexed agentId,string name,string skills,string erc8004Id,address indexed owner,uint256 registeredAt)"
];

const jobManagerAbi = [
  "function JOB_BOND() external view returns (uint256)",
  "event JobCreated(uint256 indexed jobId,string description,uint256 reward,address indexed creator)",
  "event JobAccepted(uint256 indexed jobId,uint256 indexed agentId,address indexed agentOwner)",
  "event JobCompleted(uint256 indexed jobId,uint256 indexed agentId)",
  "event JobFailed(uint256 indexed jobId,uint256 indexed agentId,bytes32 reasonHash)"
];

const proofVerifierAbi = [
  "event ProofSubmitted(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)",
  "event ProofVerified(uint256 indexed jobId,uint256 indexed agentId,bytes32 resultHash)",
  "event ProofFailed(uint256 indexed jobId,uint256 indexed agentId,bytes32 reasonHash)"
];

const atlasScoreAbi = [
  "function scores(uint256 agentId) external view returns (uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore)",
  "event ScoreUpdated(uint256 indexed agentId,uint256 successCount,uint256 failureCount,uint256 taskVolume,uint256 reliabilityScore,uint256 indexed jobId)"
];

module.exports = { agentRegistryAbi, jobManagerAbi, proofVerifierAbi, atlasScoreAbi };
