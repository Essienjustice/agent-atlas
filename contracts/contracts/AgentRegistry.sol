// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentRegistry {
    struct Agent {
        uint256 agentId;
        string name;
        string skills;
        string erc8004Id;
        address owner;
        uint256 registeredAt;
        bool exists;
    }

    uint256 public constant REGISTRATION_STAKE = 0.01 ether;
    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private agents;

    event AgentRegistered(
        uint256 indexed agentId,
        string name,
        string skills,
        string erc8004Id,
        address indexed owner,
        uint256 registeredAt
    );

    function registerAgent(
        string calldata name,
        string calldata skills,
        string calldata erc8004Id
    ) external payable returns (uint256 agentId) {
        require(bytes(name).length > 0, "name required");
        require(msg.value >= REGISTRATION_STAKE, "stake required");
        agentId = nextAgentId++;
        agents[agentId] = Agent(agentId, name, skills, erc8004Id, msg.sender, block.timestamp, true);
        emit AgentRegistered(agentId, name, skills, erc8004Id, msg.sender, block.timestamp);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(agents[agentId].exists, "agent missing");
        return agents[agentId];
    }

    function agentExists(uint256 agentId) external view returns (bool) {
        return agents[agentId].exists;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        require(agents[agentId].exists, "agent missing");
        return agents[agentId].owner;
    }
}
