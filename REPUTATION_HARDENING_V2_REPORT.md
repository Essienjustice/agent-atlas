# Reputation Hardening V2 Report

## Implemented

### Failure Accountability

Failure marking moved from agent owner to job creator.

Why this matters:

- Agents should not be responsible for reporting their own failures.
- Creators have the adversarial incentive to reject bad submissions.

### Server Authority Reduction

Server-signed transaction routes are disabled unless `ENABLE_SERVER_SIGNER=true`.

Normal integrations use wallet-signed calldata from:

```text
POST /protocol/v1/transactions
```

## Rejected

### Diversity-Weighted Scoring

Rejected for this pass.

Reason:

- Correct implementation requires tracking creator-agent pair diversity in `AtlasScore`.
- Adding it now would require redeployment and a careful score migration story.
- A superficial off-chain diversity metric would create duplicate reputation authority.

### Staking or Fees

Rejected for this pass.

Reason:

- Adding economic friction without withdrawal, slashing, and dispute semantics is misleading.

## Remaining Farming Vectors

- Colluding creator/agent owner pairs.
- Sybil agents.
- Fake low-quality proof hashes.
- Repeated bilateral interactions.

## Smallest Future Real Fix

Add on-chain counterparty diversity tracking to `AtlasScore` and discount repeated creator-owner pairs. This must be contract-canonical, not computed only in the indexer.
