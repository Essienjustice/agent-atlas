// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentRegistry {
    function agentExists(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
}

contract JobManager {
    enum Status {
        OPEN,
        ASSIGNED,
        COMPLETED,
        FAILED
    }

    struct Job {
        uint256 jobId;
        string description;
        uint256 reward;
        Status status;
        uint256 assignedAgentId;
        address creator;
        uint256 createdAt;
    }

    IAgentRegistry public agentRegistry;
    address public verifier;
    address public immutable deployer;
    uint256 public constant JOB_BOND = 0.005 ether;
    uint256 public nextJobId = 1;
    mapping(uint256 => Job) private jobs;

    event JobCreated(uint256 indexed jobId, string description, uint256 reward, address indexed creator);
    event JobAccepted(uint256 indexed jobId, uint256 indexed agentId, address indexed agentOwner);
    event JobCompleted(uint256 indexed jobId, uint256 indexed agentId);
    event JobFailed(uint256 indexed jobId, uint256 indexed agentId, bytes32 reasonHash);

    modifier onlyVerifier() {
        require(msg.sender == verifier, "only verifier");
        _;
    }

    constructor(address agentRegistry_) {
        agentRegistry = IAgentRegistry(agentRegistry_);
        deployer = msg.sender;
    }

    function setVerifier(address verifier_) external {
        require(msg.sender == deployer, "only deployer");
        require(verifier_ != address(0), "verifier required");
        require(verifier == address(0), "verifier set");
        verifier = verifier_;
    }

    function createJob(string calldata description, uint256 reward) external payable returns (uint256 jobId) {
        require(bytes(description).length > 0, "description required");
        require(msg.value >= JOB_BOND, "bond required");
        jobId = nextJobId++;
        jobs[jobId] = Job(jobId, description, reward, Status.OPEN, 0, msg.sender, block.timestamp);
        emit JobCreated(jobId, description, reward, msg.sender);
    }

    function acceptJob(uint256 jobId, uint256 agentId) external {
        Job storage job = jobs[jobId];
        require(job.jobId != 0, "job missing");
        require(job.status == Status.OPEN, "not open");
        require(agentRegistry.agentExists(agentId), "agent missing");
        address agentOwner = agentRegistry.ownerOf(agentId);
        require(msg.sender == agentOwner, "only agent owner");
        require(job.creator != agentOwner, "self dealing");
        job.status = Status.ASSIGNED;
        job.assignedAgentId = agentId;
        emit JobAccepted(jobId, agentId, agentOwner);
    }

    function markCompleted(uint256 jobId) external onlyVerifier {
        Job storage job = jobs[jobId];
        require(job.jobId != 0, "job missing");
        require(job.status == Status.ASSIGNED, "not assigned");
        job.status = Status.COMPLETED;
        emit JobCompleted(jobId, job.assignedAgentId);
    }

    function markFailed(uint256 jobId, bytes32 reasonHash) external onlyVerifier {
        Job storage job = jobs[jobId];
        require(job.jobId != 0, "job missing");
        require(job.status == Status.ASSIGNED, "not assigned");
        job.status = Status.FAILED;
        emit JobFailed(jobId, job.assignedAgentId, reasonHash);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        require(jobs[jobId].jobId != 0, "job missing");
        return jobs[jobId];
    }

    function jobExists(uint256 jobId) external view returns (bool) {
        return jobs[jobId].jobId != 0;
    }

    function assignedAgent(uint256 jobId) external view returns (uint256) {
        return jobs[jobId].assignedAgentId;
    }

    function creatorOf(uint256 jobId) external view returns (address) {
        require(jobs[jobId].jobId != 0, "job missing");
        return jobs[jobId].creator;
    }

    function agentOwnerOf(uint256 agentId) external view returns (address) {
        return agentRegistry.ownerOf(agentId);
    }
}
