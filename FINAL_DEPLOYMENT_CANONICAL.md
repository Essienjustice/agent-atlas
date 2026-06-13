# Final Deployment Canonical

Date: 2026-06-13

This file is the submission-authoritative deployment, verification, and lifecycle evidence reference for Agent Atlas.

All evidence in this report was generated against the current canonical deployment listed below.

All older deployment and verification reports are superseded:

- `DEPLOYMENT_VERIFICATION_REPORT.md`: SUPERSEDED, HISTORICAL ONLY, NOT SUBMISSION EVIDENCE.
- `VERIFICATION_REPORT.md`: SUPERSEDED, HISTORICAL ONLY, NOT SUBMISSION EVIDENCE.
- `DEPLOYMENT_REFRESH_REPORT.md`: SUPERSEDED, HISTORICAL ONLY, NOT SUBMISSION EVIDENCE.

## Network

- Network: Mantle Sepolia
- Chain ID: `5003`
- RPC: `https://rpc.sepolia.mantle.xyz`
- Explorer: `https://sepolia.mantlescan.xyz`

## Verification Dates

- Deployment date: `2026-06-13T14:25:48.123Z`
- Deployment verification date: `2026-06-13T14:39:18.103Z`
- Lifecycle verification date: `2026-06-13T14:41:47.000Z`
- Evidence generation date: `2026-06-13T14:41:47.000Z`
- Indexer replay date: `2026-06-13`

## Authoritative Contracts

| Contract | Address | Deployment Tx | Deployment Block | Source Verification |
|---|---|---:|---:|---|
| AgentRegistry | `0x3cf0763443C8Ab7672f51B8e1B34956786522a0e` | `0x2185cfa9b042690b29896dc6ada0c9652972ce2d5dd537f53dbcbe04cb9df264` | `39908017` | `https://sepolia.mantlescan.xyz/address/0x3cf0763443C8Ab7672f51B8e1B34956786522a0e#code` |
| JobManager | `0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb` | `0x0b6747b819bd48bfb990723779819708357705d35abe8b5f469bbc8a5cabaf7f` | `39908021` | `https://sepolia.mantlescan.xyz/address/0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb#code` |
| AtlasScore | `0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB` | `0x742ba6e20c339a17a4c654c641669e95691045bb0fb5de72d963c2e56cd2cd56` | `39908026` | `https://sepolia.mantlescan.xyz/address/0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB#code` |
| ProofVerifier | `0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565` | `0x3b1e424466fb197447b1dbf22c69e5a0c1ef0a455a01e1bfe2a3f7f6a7dabc45` | `39908031` | `https://sepolia.mantlescan.xyz/address/0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565#code` |

## Source Hash References

| Contract Source | SHA256 |
|---|---|
| `contracts/contracts/AgentRegistry.sol` | `7F2D91A455E16E308157BA199AB21852CCDBEC1DD5264687775D43EA62729236` |
| `contracts/contracts/JobManager.sol` | `D8BD933A612464881BAA3C5188192E57E6CFEF62216DBCF6E02CE4FEE5951CD2` |
| `contracts/contracts/ProofVerifier.sol` | `001752E516B53900292CB79A03193AAE9C7117B84AC58DD129C45EB33ADAFE95` |
| `contracts/contracts/AtlasScore.sol` | `F3844EE2FFF8B44E9FC8DBDEE5062B2EDE5E493676E550A480870CBE38FDFB41` |

## Runtime Configuration

```text
CHAIN_MODE=chain
DEMO_MODE=false
DEMO_DAY=false
AGENT_REGISTRY_ADDRESS=0x3cf0763443C8Ab7672f51B8e1B34956786522a0e
JOB_MANAGER_ADDRESS=0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb
PROOF_VERIFIER_ADDRESS=0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565
ATLAS_SCORE_ADDRESS=0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB
ENABLE_SERVER_SIGNER=false
```

`ENABLE_SERVER_SIGNER=true` is development-only. Submission and production flows should use `POST /protocol/v1/transactions` and caller wallet signatures.

## Deployment Consistency

Generated file:

```text
contracts/deployments/mantleSepolia-deployment-consistency.json
```

Results:

| Check | Result |
|---|---|
| Artifact addresses match runtime addresses | PASS |
| All contract addresses have bytecode | PASS |
| Required ABI methods present | PASS |
| `REGISTRATION_STAKE()` equals `10000000000000000` wei | PASS |
| `JOB_BOND()` equals `5000000000000000` wei | PASS |
| `MAX_POSITIVE_CREDIT_PER_PAIR()` equals `3` | PASS |

## Source Verification Status

Hardhat verification completed for all four contracts. Confirmation API status:

| Contract | Source visible | ABI visible |
|---|---|---|
| AgentRegistry | PASS | PASS |
| JobManager | PASS | PASS |
| AtlasScore | PASS | PASS |
| ProofVerifier | PENDING EXPLORER CONFIRMATION | PENDING EXPLORER CONFIRMATION |

ProofVerifier verification command returned success and printed the source link, but `scripts/confirm-verification.js` still returned `status: 0` for ProofVerifier at the time this report was generated. This is the only remaining verification warning.

## Current Lifecycle Evidence

Generated file:

```text
contracts/deployments/mantleSepolia-e2e-evidence.json
```

Lifecycle:

| Step | Tx Hash | Block | Emitted Events |
|---|---|---:|---|
| Agent registered | `0x7e0f3533ef8d5a42bb1d4e33a3788837e4bd05bfc9a55ada76d1a74c9b5ab243` | `39908498` | `AgentRegistered` |
| Job created | `0xb9ce02482cbb4ba48388029202710481819282bd6e12a2ccbb2d16608776f5da` | `39908502` | `JobCreated` |
| Job accepted | `0xf0b2529f1cc18a37bf28c9e4552b9a6af0acf2ba34fab6dfc7f839bb5888bf52` | `39908507` | `JobAccepted` |
| Proof submitted | `0xf6bd84236902a7902de763fb7ed760e75654aa995eadc64e5e758698d9a3eb93` | `39908512` | `ProofSubmitted` |
| Proof accepted | `0xcb6f0d468441ae3e1e7c8bf53aa8752ad2cffd7d3018272bf6cdbcdc2e99a4d0` | `39908517` | `ProofVerified`, `ScoreUpdated` |

Proof hash:

```text
0xd2fd82ee4bd4ca5a12d4ace71a350ceb500c86189e89cf94c05aad634595b4ee
```

Resulting `AtlasScore.scores(1)`:

```json
{
  "successCount": 1,
  "failureCount": 0,
  "taskVolume": 1,
  "reliabilityScore": 80
}
```

## Replay Evidence

Command:

```text
INDEXER_FROM_BLOCK=39908017 npm run rebuild:indexer
```

Output:

```text
Indexer replay checkpoint 39908017-39908788: 7 events
Rebuilt indexer from chain: 7 events through block 39908788.
```

Command:

```text
npm run integrity:check
```

Output:

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

## Score Consistency

| Source | Agent | Successes | Failures | Volume | Reliability |
|---|---:|---:|---:|---:|---:|
| `ScoreUpdated` event | `1` | `1` | `0` | `1` | `80` |
| `AtlasScore.scores(1)` | `1` | `1` | `0` | `1` | `80` |
| Replayed indexer/API read model | `1` | `1` | `0` | `1` | `80` |

Result: PASS.

## Canonical Authority Statement

- AtlasScore is the canonical reputation score source.
- The indexer reconstructs read state from contract events.
- The backend prepares wallet-signed transactions and serves indexed read APIs.
- The backend must not be described as computing or updating reputation.
