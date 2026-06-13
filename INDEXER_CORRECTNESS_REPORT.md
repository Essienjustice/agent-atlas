# Indexer Correctness Report

## Fixes Completed

### Filter Before Limit

`protocolEvents` now applies `event_name`, `agentId`, and `jobId` filtering in SQL before `LIMIT`.

This prevents missing older matching events because unrelated events filled the page.

### Failure Proof Semantics

Failed proof rows no longer mislabel `reasonHash` as `resultHash`.

For failed jobs:

- `reason_hash` stores the failure evidence.
- `result_hash` uses the zero hash placeholder because no successful submitted proof hash exists.

### Confirmation Handling

Live events that have not reached confirmation depth are no longer discarded.

They are stored in an in-memory pending queue and drained after they become sufficiently confirmed.

### Replay Checkpoints

Replay writes chunk checkpoints:

- `lastReplayFromBlock`
- `lastReplayToBlock`
- `lastReplayEventCount`
- `lastBlock`
- `chainTip`
- `confirmations`

### Dead Letters

Processing failures are persisted in SQLite `dead_letters`.

## Still Not Solved

### Full Reorg Rollback

The indexer detects block hash mismatch but does not rollback and replay affected ranges.

This is documented rather than faked.

### Durable Pending Queue

Pending live events are in memory. A process restart before confirmation requires replay to recover them.

### Provider Reliability

No RPC failover is implemented.

## Verdict

Indexer correctness improved for protocol API use. It is still not production-grade because rollback and durable retry workers are missing.
