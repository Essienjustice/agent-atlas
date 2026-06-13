# Final Engineering Audit

Date: 2026-06-12

Scope: code, contracts, indexer, backend authority, deployment artifacts, replay evidence, and protocol trust assumptions.

Classification standard: honest Infrastructure Prototype. No fake decentralization, no tokenomics, no governance claims, no unenforceable challenge system.

## Executive Classification

Agent Atlas is an Infrastructure Prototype.

Evidence:

- Contracts are deployed and verified on Mantle Sepolia.
- Reputation score updates are emitted by `AtlasScore` and reconstructed by the indexer.
- Backend read APIs consume indexed chain-derived state.
- Wallet-signed transaction preparation exists and backend-signed writes are disabled by default.
- Replay from the final hardened deployment block reconstructs agents, jobs, proofs, scores, and leaderboard state.

Not production infrastructure:

- Full reorg rollback is not implemented.
- Full from-genesis replay was not completed on the public RPC in the available execution window.
- Reputation can still be farmed by colluding creator and agent-owner wallets.
- Proof hashes prove submission, not correctness of task output.

## Issues

| Issue | Type | Severity | Fixable Today | Fixed | Evidence | Why unresolved items remain unresolved |
|---|---|---:|---|---|---|---|
| Open verifier initialization before `setVerifier` | Engineering / Security | High | Yes | Yes | `contracts/contracts/JobManager.sol`, `contracts/contracts/AtlasScore.sol`, `contracts/test/agentAtlas.test.js` | N/A |
| Backend private key required for read-only startup | Engineering / Centralization | Medium | Yes | Yes | `backend/src/chain.js`, `SERVER_AUTHORITY_AUDIT.md` | N/A |
| Backend-signed write endpoints still exist | Protocol / Centralization | Medium | Partially | Partially | `backend/src/app.js` gates writes behind `ENABLE_SERVER_SIGNER=true`; `.env.example` sets `ENABLE_SERVER_SIGNER=false` | Removed from default production path, but kept as explicit local/dev path. Full removal would break existing scripts and is not required for protocol correctness if disabled. |
| `protocolEvents` filtered after `LIMIT` for `agentId` / `jobId` | Engineering / Indexer correctness | Medium | Yes | Yes | `indexer/src/read-model.js`, `backend/test/lifecycle.test.js` | N/A |
| Failed proof rows mislabeled `reasonHash` as `resultHash` | Engineering / Event reconstruction | Medium | Yes | Yes | `indexer/src/store.js`, `backend/test/lifecycle.test.js` | N/A |
| Reorg detection without rollback | Engineering / Indexer reliability | High | No | No | `indexer/src/store.js` detects block hash mismatch; `INDEXER_CORRECTNESS_REPORT.md` documents missing rollback | Correct rollback requires deleting and replaying all derived state from the fork point. Implementing it safely needs broader replay-state design and tests. A fake rollback would be worse than honest detection. |
| Pending confirmation queue is in-memory | Engineering / Indexer reliability | Medium | No | No | `indexer/src/indexer.js` uses `pendingConfirmations = []`; `FINAL_SUBMISSION_AUDIT.md` documents this | Durable pending queues require schema and recovery semantics. Replay after restart mitigates but does not provide production-grade delivery guarantees. |
| Full from-genesis replay not proven | Engineering / Deployment evidence | Medium | No | No | `REPLAY_EVIDENCE_REPORT.md` records public RPC timeout; final replay from block `39875604` succeeds | Public RPC replay from genesis timed out. Proving this properly needs an archive/RPC provider with stable throughput and longer execution window. |
| Creator/agent-owner collusion | Economic / Protocol | High | Partially | Partially | `JobManager.acceptJob` blocks identical creator and agent owner; `AtlasScore` caps positive credit per creator-agent pair; registration and job creation require anti-spam fees | Creator-wallet rotation remains possible. Stronger mitigation requires canonical counterparty diversity, escrow, or external reputation. Adding off-chain heuristics would create duplicate authority. |
| Sybil agent registration | Economic / Protocol | Medium | Partially | Partially | `AgentRegistry.registerAgent` requires a fixed anti-spam registration fee | The fee creates friction but does not prove unique identity. |
| Proof hash does not prove task correctness | Unsolved research / Protocol | High | No | No | `ProofVerifier.submitProof` validates ownership, assignment, nonzero hash, and uniqueness, not semantic correctness | Arbitrary AI output correctness cannot be trustlessly verified without task-specific verifiers, attestations, or challenge/slashing design. |
| Job creator can refuse to mark failures | Protocol / Economic | Medium | No | No | `ProofVerifier.markJobFailed` is creator-only; no timeout or adjudication exists | Timeout settlement or challenges require clear acceptance/failure semantics and would be misleading if rushed. |
| Low-diversity bilateral farming | Economic / Protocol | Medium | No | No | `AtlasScore` counts one job once but does not discount repeated counterparties | Clean fix requires adding creator/agent-owner pair tracking to `AtlasScore` and redeploying with a new scoring model. Not implemented because it changes protocol economics and needs scoring migration. |
| Deployment/source mismatch after verifier hardening | Engineering / Deployment truth | High | Yes | Yes | `contracts/deployments/mantleSepolia.json`, `DEPLOYMENT_REFRESH_REPORT.md` | N/A |
| ABI mismatch risk between contracts, backend, and indexer | Engineering | Low | Audited | No active mismatch found | `backend/src/chain.js` includes write ABIs; `shared/src/chain-abis.js` includes indexer read/event ABIs; event signatures match contracts | No fix required. |

## Fixes Completed In This Audit

### Verifier Initialization Hardening

Files:

- `contracts/contracts/JobManager.sol`
- `contracts/contracts/AtlasScore.sol`
- `contracts/test/agentAtlas.test.js`

Change:

- Added immutable `deployer`.
- Restricted `setVerifier` to deployer.
- Rejected zero verifier address.
- Preserved one-time verifier assignment.

Evidence:

```text
npm.cmd --workspace contracts test
3 passing
```

Security impact:

- Removes a deployment race where a third party could claim the verifier role before the deploy script initialized it.
- Does not add governance or upgrade authority.

### Server Authority Reduction

Files:

- `backend/src/chain.js`
- `.env.example`
- `SERVER_AUTHORITY_AUDIT.md`

Change:

- Chain-mode startup now checks contract bytecode with a read-only provider.
- `PRIVATE_KEY` is no longer required for backend reads.
- `ENABLE_SERVER_SIGNER=false` is explicit in `.env.example`.

Evidence:

- `assertContractsReachable()` calls `requireReadConfig()` and `JsonRpcProvider`, not the signer client.
- Backend-signed writes still return `403` unless `ENABLE_SERVER_SIGNER=true`.

### Indexer Reconstruction Fixes

Files:

- `indexer/src/read-model.js`
- `indexer/src/store.js`
- `backend/test/lifecycle.test.js`
- `INDEXER_CORRECTNESS_REPORT.md`

Change:

- `protocolEvents` filters `event_name`, `agentId`, and `jobId` in SQL before `LIMIT`.
- Failed proof rows keep failure evidence in `reason_hash` and use the zero hash as `result_hash`.

Evidence:

```text
npm.cmd --workspace backend test
1 passing
```

### Final Redeployment And Verification

Files:

- `contracts/deployments/mantleSepolia.json`
- `contracts/deployments/mantleSepolia-e2e-evidence.json`
- `.env`
- `FINAL_DEPLOYMENT_CANONICAL.md`
- `REPLAY_EVIDENCE_REPORT.md`

The current submission-authoritative deployment is documented in `FINAL_DEPLOYMENT_CANONICAL.md`:

| Contract | Address | Deployment Tx |
|---|---|---|
| AgentRegistry | `0x3cf0763443C8Ab7672f51B8e1B34956786522a0e` | `0x2185cfa9b042690b29896dc6ada0c9652972ce2d5dd537f53dbcbe04cb9df264` |
| JobManager | `0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb` | `0x0b6747b819bd48bfb990723779819708357705d35abe8b5f469bbc8a5cabaf7f` |
| ProofVerifier | `0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565` | `0x3b1e424466fb197447b1dbf22c69e5a0c1ef0a455a01e1bfe2a3f7f6a7dabc45` |
| AtlasScore | `0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB` | `0x742ba6e20c339a17a4c654c641669e95691045bb0fb5de72d963c2e56cd2cd56` |

Current end-to-end lifecycle evidence:

- Agent registered: `0x7e0f3533ef8d5a42bb1d4e33a3788837e4bd05bfc9a55ada76d1a74c9b5ab243`
- Job created: `0xb9ce02482cbb4ba48388029202710481819282bd6e12a2ccbb2d16608776f5da`
- Job accepted: `0xf0b2529f1cc18a37bf28c9e4552b9a6af0acf2ba34fab6dfc7f839bb5888bf52`
- Proof submitted: `0xf6bd84236902a7902de763fb7ed760e75654aa995eadc64e5e758698d9a3eb93`
- Proof accepted / score updated: `0xcb6f0d468441ae3e1e7c8bf53aa8752ad2cffd7d3018272bf6cdbcdc2e99a4d0`

Replay evidence:

```text
INDEXER_FROM_BLOCK=39908017 npm run rebuild:indexer
Indexer replay checkpoint 39908017-39908788: 7 events
Rebuilt indexer from chain: 7 events through block 39908788.
```

Integrity evidence:

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

## Judge Attack Questions

### Does Agent Atlas prove AI task correctness?

No.

It proves that an agent owner submitted a nonzero hash for an assigned job, the submission was accepted by the protocol path, and `AtlasScore` updated from that verified submission event.

### Can two wallets farm reputation?

Yes.

The protocol blocks `creator == agentOwner`, but two coordinated wallets can create and accept jobs repeatedly.

### Is the backend authoritative?

Not for reputation. Reputation APIs read indexed `AtlasScore.ScoreUpdated` events.

Backend-signed write endpoints remain in code but are disabled unless `ENABLE_SERVER_SIGNER=true`.

### Can a third party rebuild state?

Yes from the final deployment block using emitted contract events. Full from-genesis replay was attempted and timed out on public RPC, so it is not proven under current evidence.

### Is the indexer production-grade?

No.

It has replay checkpoints, dead letters, block hash storage, duplicate event protection, and confirmation buffering. It lacks full rollback and durable pending confirmation recovery.

## Final Verdict

Agent Atlas is technically credible as an Infrastructure Prototype.

It should not be described as production-ready, fully decentralized, Sybil-resistant, or a correctness oracle for AI work.

Its strongest credible claim is narrower and defensible:

Agent Atlas records agent task submissions on Mantle, updates reputation through a canonical score contract, and exposes replayable event-derived reputation APIs for external systems.
