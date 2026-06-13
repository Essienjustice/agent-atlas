# Indexer Reliability Report

## Implemented

### Replay Checkpoints

`indexer/src/indexer.js:replay` stores:

- `lastReplayFromBlock`
- `lastReplayToBlock`
- `lastReplayEventCount`
- `lastBlock`
- `chainTip`
- `confirmations`

These are exposed by:

```text
GET /protocol/v1/status
```

### Durable Dead Letters

`indexer/src/store.js` now creates a `dead_letters` table.

`addDeadLetter` stores:

- label
- error
- payload
- timestamp

The backend exposes:

```text
GET /debug/dead-letters
```

### Confirmation Depth

`INDEXER_CONFIRMATIONS` controls how many blocks behind the chain tip the indexer reads.

Default:

```text
6
```

This reduces the risk of indexing short reorgs.

### Block Hash Storage

`events.block_hash` and `blocks.hash` are persisted.

Every indexed log with a block hash records the block hash for later consistency checks.

### Reorg Detection

`recordBlock` compares stored block hash against incoming block hash.

If a mismatch is found, indexing throws:

```text
REORG_DETECTED
```

The event is written to dead letters.

### Replay Progress Reporting

Replay logs progress by chunk:

```text
Indexer replay checkpoint start-end: N events
```

Status is available through `/protocol/v1/status`.

## Remaining Weaknesses

- Reorgs are detected but not automatically rolled back.
- Dead letters are stored but not automatically retried.
- SQLite is a single-node store.
- Full replay on public RPC may still fail under provider rate limits or connection resets.
- No metrics exporter.
- No multi-indexer consensus.

## Production Gap

The indexer is credible for a testnet protocol primitive, but not production-grade infrastructure. Production readiness requires rollback support, durable retry workers, provider failover, monitoring, and a reproducible deployment process.
