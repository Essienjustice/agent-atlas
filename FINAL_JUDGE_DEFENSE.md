# Final Judge Defense

Date: 2026-06-12

Scope: current source code after final hardening pass. The deployed Mantle Sepolia contracts must be refreshed before these defenses apply on-chain.

## Why Isn't Reputation Free To Farm?

Reputation is no longer free to farm in the simplest path because:

- Agent registration requires `REGISTRATION_STAKE = 0.01 ether` in `AgentRegistry`.
- Job creation requires `JOB_BOND = 0.005 ether` in `JobManager`.
- Agent proof submission does not update score by itself.
- The job creator must call `acceptProof` before `ProofVerified` and `ScoreUpdated`.

This adds economic friction but does not create full Sybil resistance.

## Why Can't One Creator Endlessly Boost One Agent?

`AtlasScore` caps positive score credit from the same creator to the same agent:

```text
MAX_POSITIVE_CREDIT_PER_PAIR = 3
```

After three successful accepted submissions for `(agentId, creator)`, additional accepted submissions from that creator remain auditable but do not increase `successCount`, `taskVolume`, or `reliabilityScore`.

This blocks the obvious repeated bilateral farming loop. It does not block a determined attacker from rotating through many funded creator wallets.

## Why Does AtlasScore Remain Canonical?

`AtlasScore` remains the only source of score mutation:

- `recordVerifiedProof` is callable only by `ProofVerifier`.
- `recordFailedProof` is callable only by `ProofVerifier`.
- The indexer does not recalculate `reliabilityScore`.
- The indexer stores `ScoreUpdated` event values and derives presentation views from them.

The indexer mirrors pair-credit evidence only from actual positive `ScoreUpdated` deltas. It does not create an alternative score.

## Why Is The Indexer Trustworthy?

The indexer is trustworthy as a replayable read model, not as a new source of truth.

Current protections:

- Event IDs are `txHash:logIndex`.
- Duplicate events return early and do not mutate read-model state.
- Logs are sorted by block and log index during replay.
- Block hashes are stored for reorg detection.
- Dead letters are persisted in SQLite.
- Score consistency can be checked against `AtlasScore.scores(agentId)`.

Limitations:

- Reorg rollback is not implemented.
- Pending live confirmations are not durably queued.
- Full production-grade indexing would require replay SLAs, rollback, monitoring, and RPC redundancy.

## What Attacks Still Exist?

### Multi-wallet collusion

An attacker can create many creator wallets and use each one up to the positive pair-credit cap.

Why not solved:

- Strong mitigation requires identity, staking/slashing, reputation weighting, or external attestations.
- Those are out of scope and would be fake if rushed.

### Accepted hash does not prove work quality

A creator can accept arbitrary or low-quality outputs.

Why not solved:

- The protocol has no oracle or task-specific verifier.
- It records accepted submissions, not correctness.

### Sybil identities remain possible

Attackers can still register many agents if they pay the fixed registration fee.

Why not solved:

- Fixed registration fee creates cost but not identity uniqueness.
- Strong Sybil resistance requires identity or stronger economics.

### Failure suppression

A colluding creator can choose not to mark failures.

Why not solved:

- Enforceable challenge windows or slashing require more protocol design.
- Adding a fake dispute system would reduce credibility.

### Reorg recovery

The indexer detects but does not automatically roll back reorged state.

Why not solved:

- Correct rollback requires deleting and replaying derived state from the fork point.
- This is an indexer reliability project, not a one-evening patch.

## Final Position

Agent Atlas is not a trustless correctness protocol.

It is an event-sourced reputation prototype where:

- native-token friction reduces spam,
- creator acceptance prevents unilateral agent self-scoring,
- pair caps limit repeated bilateral score farming,
- `AtlasScore` remains the canonical score source,
- indexed APIs expose replayable contract-derived state.

The project is stronger after hardening, but still not production-grade or Sybil-proof.
