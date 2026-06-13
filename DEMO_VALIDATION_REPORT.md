# Demo Validation Report

Date: 2026-06-13

## Lifecycle Tested

| Step | Wallet | Result |
|---|---|---|
| Create Agent | Wallet A | PASS, `AgentRegistered` emitted |
| Create Job | Wallet B | PASS, `JobCreated` emitted |
| Accept Job | Wallet A | PASS, `JobAccepted` emitted |
| Submit Proof | Wallet A | PASS, `ProofSubmitted` emitted |
| Accept Proof | Wallet B | PASS, `ProofVerified` and `ScoreUpdated` emitted |

## Transaction Evidence

- Agent registration: `0x7e0f3533ef8d5a42bb1d4e33a3788837e4bd05bfc9a55ada76d1a74c9b5ab243`
- Job creation: `0xb9ce02482cbb4ba48388029202710481819282bd6e12a2ccbb2d16608776f5da`
- Job acceptance: `0xf0b2529f1cc18a37bf28c9e4552b9a6af0acf2ba34fab6dfc7f839bb5888bf52`
- Proof submission: `0xf6bd84236902a7902de763fb7ed760e75654aa995eadc64e5e758698d9a3eb93`
- Proof acceptance: `0xcb6f0d468441ae3e1e7c8bf53aa8752ad2cffd7d3018272bf6cdbcdc2e99a4d0`

## UI State Expectations

- Open job appears after `JobCreated` is indexed.
- Assignment action requires selected agent owner wallet.
- Submit proof requires assigned agent owner wallet.
- Accept submission appears only after proof submission is indexed.
- Accept submission requires job creator wallet.
- After wallet send, UI displays `Waiting for indexed confirmation` and polls `/jobs`.
- Score and leaderboard update after `ScoreUpdated` is indexed.

## Remaining Demo Risks

- Presenter must use distinct creator and agent-owner wallets to avoid self-dealing reverts.
- Indexer confirmation can lag behind wallet transaction confirmation.
- Full replay from block `0` is slow; demo replay should start from the deployment block.
