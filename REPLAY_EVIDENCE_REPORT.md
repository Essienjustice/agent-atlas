# Replay Evidence Report

## Goal

Prove that Agent Atlas can reconstruct state from Mantle events.

## Full Replay Attempt

Command:

```bash
npm run rebuild:indexer
```

Result:

```text
Timed out after 304 seconds on public Mantle Sepolia RPC.
```

Reason:

The public RPC path is not reliable for a from-block-0 replay inside the execution window. This is a provider/runtime limitation, not proof of full production replay.

## Final Hardened Deployment Replay

Command:

```bash
INDEXER_FROM_BLOCK=39875604 npm run rebuild:indexer
```

Output:

```text
Indexer replay checkpoint 39875604-39875844: 7 events
Rebuilt indexer from chain: 7 events through block 39875844.
```

## Reconstructed Statistics

Command:

```bash
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

`system-integrity-check.js` compared indexed score values against `AtlasScore.scores(agentId)` for all indexed agents.

Result:

```text
ok: true
```

## Limitation

The project proves replay from the hardened deployment block. It does not prove reliable from-genesis replay on the public RPC within the available execution window.
