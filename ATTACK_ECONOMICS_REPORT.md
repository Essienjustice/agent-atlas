# Attack Economics Report

Date: 2026-06-12

Scope: current source code after final hardening pass. These economics apply after redeploying the updated contracts. Previously deployed Mantle Sepolia addresses do not automatically inherit these source changes.

## Parameters

- Anti-spam registration fee: `0.01 MNT` equivalent native value in contract units. It is not withdrawable and is not slashable.
- Anti-spam job creation fee: `0.005 MNT` equivalent native value in contract units. It is not withdrawable and is not escrow.
- Positive credit cap: maximum `3` successful score credits per `(agentId, creator)` pair.
- Proof finality: agent submission alone does not update score; creator must call `acceptProof`.

## Attacks

| Attack | Cost Before | Cost After | Reputation Gained Before | Reputation Gained After | Still Profitable? |
|---|---:|---:|---:|---:|---|
| Free agent spam | Gas only | `0.01` per agent plus gas | Unlimited identities | Unlimited identities only with linear capital cost | Still possible, less cheap |
| Free job spam | Gas only | `0.005` per job plus gas | Unlimited activity surface | Unlimited activity surface only with linear capital cost | Still possible, less cheap |
| Same creator repeatedly boosts one agent | Gas per job/proof | `0.005` per job plus gas | Unlimited positive score growth | Max 3 positive score credits for that creator-agent pair | Not profitable after cap for score farming |
| Agent submits proof without creator approval | Gas only | Gas only | Immediate score update before hardening | No score update until creator acceptance | No |
| Direct self-dealing with same wallet | Gas only | Gas plus required anti-spam fees, but transaction reverts | None, blocked by `creator != agentOwner` | None, still blocked | No |
| Two-wallet collusion | Gas only | `0.01` per agent + `0.005` per job + gas | Unlimited positive score growth | Limited to 3 positive credits per creator-agent pair; can continue only by funding more creator wallets | Still possible with Sybil capital |
| Multi-wallet Sybil creator rotation | Gas only | `0.005` per job per creator plus gas, and operational wallet overhead | Unlimited score growth | Still possible by rotating creators; cost scales linearly with unique creators and jobs | Possibly, if reputation value exceeds cost |
| Failure suppression by colluding creator | Gas only | Gas plus job creation fee | Creator simply accepts all proofs | Creator can still accept low-quality submissions | Yes, not solved |

## Notes

The new economics do not make reputation impossible to farm. They make the cheapest loops more expensive and cap the most obvious repeated bilateral farming pattern.

The system still does not verify off-chain task correctness. A creator can still accept arbitrary hashes. The protocol records accepted task submissions, not objective work quality.

## Test Evidence

```text
npm.cmd --workspace contracts test
4 passing
```

Covered cases:

- Free agent spam rejected without registration fee.
- Free job spam rejected without job creation fee.
- Same creator cannot give more than 3 positive score credits to one agent.
- Different creator can add additional positive credit.
- Self-dealing remains blocked.
- Proof submission alone does not update score.

```text
npm.cmd --workspace backend test
1 passing
```

Covered cases:

- Duplicate event replay does not reset state.
- Score reconstruction from replay produces the same leaderboard score.
- Pair-credit read-model evidence is reconstructed from `ScoreUpdated` events.
