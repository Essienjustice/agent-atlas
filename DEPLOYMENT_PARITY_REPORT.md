# Deployment Parity Report

Date: 2026-06-13

## Parity Verdict

READY WITH WARNING.

The source was redeployed after the final `ProofVerifier.markJobFailed()` guard was added. Deployment artifacts, runtime `.env`, and fresh evidence now point to the same deployment. Hardhat verification succeeded for all contracts. The project verification confirmation script still reports ProofVerifier source/ABI as not visible, so explorer confirmation for that single contract remains pending.

## Deployed Contracts

| Contract | Address | Deployment Tx | Source Hash |
|---|---|---|---|
| AgentRegistry | `0x3cf0763443C8Ab7672f51B8e1B34956786522a0e` | `0x2185cfa9b042690b29896dc6ada0c9652972ce2d5dd537f53dbcbe04cb9df264` | `7F2D91A455E16E308157BA199AB21852CCDBEC1DD5264687775D43EA62729236` |
| JobManager | `0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb` | `0x0b6747b819bd48bfb990723779819708357705d35abe8b5f469bbc8a5cabaf7f` | `D8BD933A612464881BAA3C5188192E57E6CFEF62216DBCF6E02CE4FEE5951CD2` |
| ProofVerifier | `0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565` | `0x3b1e424466fb197447b1dbf22c69e5a0c1ef0a455a01e1bfe2a3f7f6a7dabc45` | `001752E516B53900292CB79A03193AAE9C7117B84AC58DD129C45EB33ADAFE95` |
| AtlasScore | `0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB` | `0x742ba6e20c339a17a4c654c641669e95691045bb0fb5de72d963c2e56cd2cd56` | `F3844EE2FFF8B44E9FC8DBDEE5062B2EDE5E493676E550A480870CBE38FDFB41` |

## Verification Status

| Contract | Hardhat verify result | Confirmation script result |
|---|---|---|
| AgentRegistry | PASS | source visible, ABI visible |
| JobManager | PASS | source visible, ABI visible |
| AtlasScore | PASS | source visible, ABI visible |
| ProofVerifier | PASS | pending explorer confirmation |

## Commands Executed

```text
npm.cmd --workspace contracts run compile
npm.cmd --workspace contracts run deploy:mantle
npm.cmd --workspace contracts run verify:mantle
node scripts/confirm-verification.js
npm.cmd run deployment:check
```

## Deployment Wiring

```text
AgentRegistry
  -> JobManager(agentRegistry)

AtlasScore

ProofVerifier(jobManager, atlasScore, agentRegistry)
  -> JobManager.setVerifier(proofVerifier)
  -> AtlasScore.setVerifier(proofVerifier)
```

## Remaining Parity Warning

ProofVerifier source verification was accepted by Hardhat, but the Mantlescan API confirmation endpoint had not yet returned source/ABI visibility. Do not claim full explorer confirmation until `node scripts/confirm-verification.js` reports `sourceCodeVisible: true` and `abiVisible: true` for ProofVerifier.
