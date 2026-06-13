# Evidence Regeneration Report

Date: 2026-06-13

## Generated Files

- `contracts/deployments/mantleSepolia.json`
- `contracts/deployments/mantleSepolia-e2e-evidence.json`
- `contracts/deployments/mantleSepolia-deployment-consistency.json`

## Lifecycle Evidence

| Step | Tx Hash | Block | Event |
|---|---|---:|---|
| AgentRegistered | `0x7e0f3533ef8d5a42bb1d4e33a3788837e4bd05bfc9a55ada76d1a74c9b5ab243` | `39908498` | `AgentRegistered` |
| JobCreated | `0xb9ce02482cbb4ba48388029202710481819282bd6e12a2ccbb2d16608776f5da` | `39908502` | `JobCreated` |
| JobAccepted | `0xf0b2529f1cc18a37bf28c9e4552b9a6af0acf2ba34fab6dfc7f839bb5888bf52` | `39908507` | `JobAccepted` |
| ProofSubmitted | `0xf6bd84236902a7902de763fb7ed760e75654aa995eadc64e5e758698d9a3eb93` | `39908512` | `ProofSubmitted` |
| ProofVerified / ScoreUpdated | `0xcb6f0d468441ae3e1e7c8bf53aa8752ad2cffd7d3018272bf6cdbcdc2e99a4d0` | `39908517` | `ProofVerified`, `ScoreUpdated` |

## Score Consistency

| Source | Agent | Successes | Failures | Volume | Reliability |
|---|---:|---:|---:|---:|---:|
| Contract state | `1` | `1` | `0` | `1` | `80` |
| `ScoreUpdated` event | `1` | `1` | `0` | `1` | `80` |
| Replayed indexer/API read model | `1` | `1` | `0` | `1` | `80` |

Result: PASS.

## Commands Executed

```text
npm.cmd run deployment:check
npm.cmd run chain:evidence
INDEXER_FROM_BLOCK=39908017 npm.cmd run rebuild:indexer
npm.cmd run integrity:check
```

## Replay Output

```text
Indexer replay checkpoint 39908017-39908788: 7 events
Rebuilt indexer from chain: 7 events through block 39908788.
```

## Integrity Output

```json
{
  "ok": true,
  "indexed": {
    "agents": 1,
    "jobs": 1,
    "proofs": 1,
    "scores": 1,
    "events": 7
  },
  "checkedAgents": 1
}
```

## Limitation

Full replay from block `0` timed out in the release shell after 300 seconds. The submission evidence replay was performed from the current deployment block `39908017`.
