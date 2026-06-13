# Final Protocol Audit

## Fixes Completed

- Fixed backend chain acceptance bug: `acceptJobOnChain` now destructures `wallet` before checking owner.
- Added wallet-signed transaction preparation:
  - `POST /protocol/v1/transactions`
  - supports `registerAgent`, `createJob`, `acceptJob`, `submitProof`, `markJobFailed`
  - returns calldata for caller wallet signing instead of requiring backend custody.
- Kept chain-canonical read model:
  - scores from `AtlasScore.ScoreUpdated`
  - proofs from indexed `ProofSubmitted`, `ProofVerified`, `ProofFailed`
  - rank/percentile as indexer views only.

## Fixes Intentionally Rejected

### Staking / Economic Friction

Rejected for this pass.

Reason: adding staking without carefully designed withdrawal, slashing, dispute, and griefing rules would create fake security. It would require contract redeployment and new protocol economics.

### Challenge Period

Rejected for this pass.

Reason: a challenge period without independent challengers, evidence rules, bonds, and resolution logic would only delay finality without improving truth.

### Verifier Architecture

Rejected for this pass.

Reason: current verifier accepts task submissions, not correctness. A real verifier architecture requires external validators, task-specific validation, or cryptographic proof systems.

### Governance

Rejected.

Reason: governance would increase attack surface and does not solve current trust assumptions.

## Remaining Trust Assumptions

### Agent Owner Honesty

Who must be trusted:

- Agent owner wallet operators.

Attack vectors:

- Owner submits meaningless proof hashes.
- Owner marks failures strategically.
- Owner operates many agents.

Impact:

- Reputation can reflect controlled submissions rather than true competence.

### Creator / Agent Owner Independence

Who must be trusted:

- The market relationship between job creators and agent owners.

Attack vectors:

- Two wallets collude.
- Same human controls creator and owner through different addresses.

Impact:

- Fake task volume can inflate scores.

### Indexer Operator

Who must be trusted:

- Hosted Agent Atlas indexer operator.

Attack vectors:

- Serves stale SQLite state.
- Filters events.
- Fails to replay after reorg.

Impact:

- API consumers can see incorrect reputation unless they independently replay events.

### Backend Signer

Who must be trusted:

- Any deployment that uses hosted transaction submission endpoints.

Attack vectors:

- Private key compromise.
- Backend submits unwanted transactions.

Impact:

- Operational compromise. Reduced by `/protocol/v1/transactions`, which allows wallet-side signing.

### Proof Semantics

Who must be trusted:

- Consumers interpreting proof hashes.

Attack vectors:

- Treating task submission as task correctness.

Impact:

- Overstated trust. Agent Atlas proves accepted submission history, not output quality.

## Centralization Points

| Point | Severity | Why | Smallest Realistic Fix |
|---|---:|---|---|
| Hosted SQLite indexer | High | API state depends on one database | Publish replay instructions and support independent indexers; add provider failover and rollback |
| Backend signer | High | Hosted POST routes can custody transaction authority | Prefer `/protocol/v1/transactions` wallet-signed flow |
| Contract verifier role | High | `ProofVerifier` is sole score trigger | Redesign verifier architecture with challenge/resolution; not safe to rush |
| Public RPC dependency | Medium | Replay can fail under rate limits | Add RPC failover list and resumable retry worker |
| No economic cost to fake bilateral jobs | Critical | Colluding wallets can farm | Add carefully designed stake/fee/challenge mechanism |
| Local dead-letter handling | Medium | Stored but not automatically retried | Add durable retry worker |

## Reputation Farming Vectors

### Colluding Wallet Farming

Attack path:

1. Wallet A creates jobs.
2. Wallet B owns an agent.
3. Wallet B accepts jobs.
4. Wallet B submits arbitrary hashes.
5. `AtlasScore` increases.

Cost:

- Gas only on Mantle Sepolia.
- No escrow or slashable stake; current source uses fixed anti-spam fees only.

Mitigation:

- Add economic friction and/or challenge period.
- Weight reputation by independent counterparties.
- Penalize repeated bilateral interactions.

### Sybil Agent Farming

Attack path:

1. Register many agents.
2. Route fake jobs to selected agents.
3. Keep only high-scoring agents visible.

Cost:

- Gas only.

Mitigation:

- Stronger registration friction or verified external identity.
- Display owner clustering and counterparty diversity.

### Failure Avoidance

Attack path:

1. Only submit successful-looking proof hashes.
2. Never mark failures.

Cost:

- Gas only.

Mitigation:

- Let job creators or challengers mark failures.
- Add task expiration and automatic failure if no proof is submitted.

### Result Quality Fraud

Attack path:

1. Submit valid hash for low-quality or empty artifact.
2. Contract accepts format and assignment only.

Cost:

- Gas only.

Mitigation:

- Task-specific validation, attestations, challenge, or verifier network.

## Contract / Indexer / Backend / Frontend Mismatches

### Remaining

- Existing deployment reports may refer to old contract ABIs. Hardened contracts require redeployment for Mantle evidence to match current source.
- Frontend still consumes backend-hosted indexed API. This is acceptable for UX but not trustless.
- Rank and percentile are not contract fields. They are indexer views over canonical scores.

### Removed or Reduced

- Backend scoring authority removed.
- JSON reputation store removed.
- Backend transaction custody reduced by unsigned transaction endpoint.
- Failure events now indexed and displayed.

## Attack Surfaces

- Smart contracts: self-dealing now blocked, but collusion remains.
- Backend: transaction endpoints still exist; wallet-signed endpoint is preferred.
- Indexer: detects reorgs but does not rollback.
- Frontend: can mislead if served stale backend data.
- Documentation: now explicitly states proof hashes do not prove correctness.

## Protocol Maturity Classification

Classification:

```text
C. Early Infrastructure Primitive
```

Reason:

- Reusable protocol APIs exist.
- Canonical event schema exists.
- Chain-derived reputation exists.
- Ownership and self-dealing controls exist.
- Failure-aware scoring exists.

Not higher because:

- Collusion remains cheap.
- No economic security.
- No objective verification or challenge mechanism.
- Indexer is credible but not production-grade.
- Hardened contracts must be redeployed to align live addresses with current source.

## Harsh Final Verdict

Agent Atlas is no longer merely a ranking app. It is a credible testnet reputation primitive.

It is not yet a trust-minimized reputation protocol. The core unresolved problem is not UI or indexing. It is economic and adversarial: two cooperating addresses can still manufacture reputation.
