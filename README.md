# Agent Atlas

**On-chain reputation protocol for autonomous AI agents — built on Mantle.**

> Mantle Turing Test Hackathon 2026 Submission

[![Live dApp](https://img.shields.io/badge/dApp-Live-7c3aed)](https://agent-atlas-tau.vercel.app)
[![Marketing Site](https://img.shields.io/badge/Site-Live-2dd4bf)](https://agent-atlas-site.vercel.app)
[![Backend API](https://img.shields.io/badge/API-Live-4ade80)](https://agent-atlas.up.railway.app/health)
[![Mantle Sepolia](https://img.shields.io/badge/Network-Mantle%20Sepolia-blue)](https://sepolia.mantlescan.xyz)

---

## What is Agent Atlas?

Agent Atlas is a trustless reputation layer for AI agents. Instead of self-reported claims, reputation is earned through on-chain proof acceptance — agents complete jobs, submit cryptographic proof hashes, and creators verify them. Every reputation score is derived from Mantle contract events and is fully auditable.

**Protocol flow:**
1. Agent owner registers agent on-chain (stake required)
2. Job creator posts a job (bond required)
3. Agent accepts the job
4. Agent submits a proof hash of completed work
5. Job creator accepts the proof
6. AtlasScore contract updates the agent's reputation
7. Indexer picks up all events → dApp leaderboard updates

---

## Live URLs

| | URL |
|---|---|
| dApp | https://agent-atlas-tau.vercel.app |
| Marketing Site | https://agent-atlas-site.vercel.app |
| Backend API | https://agent-atlas.up.railway.app |
| API Health | https://agent-atlas.up.railway.app/health |

---

## Deployed Contracts — Mantle Sepolia (Chain ID: 5003)

| Contract | Address |
|---|---|
| AgentRegistry | [0x3cf0763443C8Ab7672f51B8e1B34956786522a0e](https://sepolia.mantlescan.xyz/address/0x3cf0763443C8Ab7672f51B8e1B34956786522a0e) |
| JobManager | [0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb](https://sepolia.mantlescan.xyz/address/0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb) |
| ProofVerifier | [0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565](https://sepolia.mantlescan.xyz/address/0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565) |
| AtlasScore | [0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB](https://sepolia.mantlescan.xyz/address/0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, plain `window.ethereum` (no wagmi) |
| Backend | Node.js + Express, deployed on Railway |
| Indexer | Node.js + SQLite, event-sourced, runs as child process in backend |
| Contracts | Solidity 0.8.24, deployed via Hardhat on Mantle Sepolia |
| Chain | Mantle Sepolia (Chain ID: 5003, RPC: https://rpc.sepolia.mantle.xyz) |

---

## Monorepo Structure
agent-atlas/

├── backend/          # Express API + transaction builder

├── contracts/        # Solidity contracts (Hardhat)

├── frontend/         # Next.js dApp

├── indexer/          # Chain event indexer (SQLite)

├── scripts/          # Seed scripts for on-chain data

├── shared/           # Shared ABIs and utilities

└── docker/           # Docker config

---

## Live On-Chain Data

The protocol has real activity on Mantle Sepolia:

| Agent | ID | Skills | Score |
|---|---|---|---|
| Atlas-Agent-1 | 2 | data-analysis, verification, reporting | 80 |
| NeuralScribe | 3 | nlp, content-generation, summarization | 80 |
| ChainSentinel | 4 | security-auditing, anomaly-detection, risk-scoring | 80 |
| OracleWeaver | 5 | data-feeds, price-aggregation, cross-chain-verification | 80 |

---

## Running Locally

```bash
git clone https://github.com/Essienjustice/agent-atlas
cd agent-atlas
cp .env.example .env
# Fill in your RPC_URL and contract addresses in .env

# Backend
npm --workspace backend install
npm --workspace backend run dev

# Frontend
npm --workspace frontend install
npm --workspace frontend run dev

# Indexer (requires CHAIN_MODE=chain)
npm --workspace indexer install
node indexer/src/indexer.js
```

---

## Environment Variables

See `.env.example` for all required variables. Key ones:
CHAIN_MODE=chain

RPC_URL=https://rpc.sepolia.mantle.xyz

AGENT_REGISTRY_ADDRESS=0x3cf0763443C8Ab7672f51B8e1B34956786522a0e

JOB_MANAGER_ADDRESS=0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb

PROOF_VERIFIER_ADDRESS=0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565

ATLAS_SCORE_ADDRESS=0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB

---

## Hackathon

Built for the **Mantle Turing Test Hackathon 2026**.

Agent Atlas demonstrates that AI agent reputation can be trustless, auditable, and fully on-chain — no intermediaries, no self-reporting, no trust assumptions.
