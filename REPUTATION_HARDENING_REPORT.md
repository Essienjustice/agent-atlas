# Reputation Hardening Report

## Files Changed

- `contracts/contracts/AgentRegistry.sol`
  - Added canonical `owner` to each agent.
  - Added `ownerOf(agentId)`.
  - Added owner address to `AgentRegistered`.

- `contracts/contracts/JobManager.sol`
  - Added agent-owner lookup.
  - Enforced `msg.sender == agentOwner` in `acceptJob`.
  - Rejected `job.creator == agentOwner`.
  - Added `FAILED` status and `JobFailed`.

- `contracts/contracts/ProofVerifier.sol`
  - Enforced `msg.sender == agentOwner` in `submitProof`.
  - Added `markJobFailed(jobId, agentId, reasonHash)`.
  - Added `ProofFailed`.

- `contracts/contracts/AtlasScore.sol`
  - Added `failureCount`.
  - Added `recordFailedProof`.
  - Updated `ScoreUpdated` to include failures.
  - Updated score formula so failures reduce score.

- `backend/src/chain.js`
  - Updated ABIs.
  - Added agent-owner check before acceptance.
  - Added `markJobFailedOnChain`.

- `backend/src/app.js`
  - Added `POST /jobs/:id/mark-failed`.
  - Kept backend read path indexer-only.

- `indexer/src/store.js`
  - Added owner, failure, reason hash, and failure score fields.
  - Reconstructs `JobFailed`, `ProofFailed`, and updated `ScoreUpdated`.

- `indexer/src/indexer.js`
  - Listens to failure events.
  - Normalizes owner and failure payloads.

- `indexer/src/read-model.js`
  - Exposes successes, failures, success rate, score history, proof hashes, reason hashes, and transaction links from indexed events.

- `shared/src/chain-abis.js`
  - Updated event/function ABIs.

- `frontend/`
  - Replaced correctness-implying language with verified task-submission language.
  - Added failure-aware leaderboard/profile/job UI.

- `contracts/test/agentAtlas.test.js`
  - Added tests for owner-only accept/proof.
  - Added self-dealing rejection test.
  - Added failure scoring test.

## Attack Vectors Eliminated

- Random caller accepting work for someone else's agent.
- Random caller submitting proof for someone else's agent.
- Creator assigning their own registered agent to their own job.
- Purely positive-only reputation history.
- Double counting the same job in `AtlasScore`.

## Attack Vectors Remaining

- Collusion between two different wallets.
- Fake jobs between cooperating parties.
- Low-cost Sybil agents.
- No objective result-quality verification.
- Backend signer centralization for hosted transaction submission.
- Centralized SQLite indexer availability and integrity risk.
- No slashing, escrow, fee, challenge, or dispute mechanism.

## Trust Assumptions

- Agent owner private keys are controlled by legitimate operators.
- Job creators and agent owners are not colluding.
- The deployed verifier address was initialized correctly.
- The indexer is honest or can be independently replayed from chain.
- A proof hash represents a submitted artifact, not necessarily a correct artifact.

## Protocol Limitations

Agent Atlas proves ownership-gated task submission and acceptance/failure accounting. It does not prove task correctness, economic value, independent demand, agent quality, or off-chain artifact integrity beyond the submitted hash.

## Remaining Classification Gap

To reach Early Infrastructure Primitive, Agent Atlas still needs:

- Independent verification or challenge path for task outcomes.
- Economic friction against fake jobs and Sybil agents.
- Production-grade indexer finality/reorg handling.
- A public replay/verification process that judges can run reliably.
- Separation between hosted backend signer and agent owner wallets.
