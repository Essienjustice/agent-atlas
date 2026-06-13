# Failure Accountability Report

## Weakness Fixed

Previous model:

- Agent owner could mark its own task failed.
- Job creator could not reject a submitted/assigned task.

This was backwards for adversarial reputation.

## Implemented Model

`ProofVerifier.markJobFailed` now requires:

```solidity
jobManager.creatorOf(jobId) == msg.sender
```

The job creator can reject the assigned task and record a `reasonHash`.

## Files Changed

- `contracts/contracts/JobManager.sol`
  - added `creatorOf(jobId)`.

- `contracts/contracts/ProofVerifier.sol`
  - `markJobFailed` now requires job creator authorization.

- `contracts/test/agentAtlas.test.js`
  - verifies agent owner cannot mark failure.
  - verifies job creator can mark failure.

## Remaining Limitation

There is no timeout settlement. If the agent never submits proof and the creator never marks failure, the job can remain assigned. Adding timeout rules safely requires choosing finality windows and handling griefing; that was rejected for this pass.
