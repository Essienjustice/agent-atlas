const JobStatus = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
};

const AtlasEvents = {
  AGENT_REGISTERED: "AgentRegistered",
  JOB_CREATED: "JobCreated",
  JOB_ACCEPTED: "JobAccepted",
  PROOF_SUBMITTED: "ProofSubmitted",
  PROOF_VERIFIED: "ProofVerified",
  PROOF_FAILED: "ProofFailed",
  JOB_FAILED: "JobFailed",
  SCORE_UPDATED: "ScoreUpdated"
};

module.exports = { JobStatus, AtlasEvents };
