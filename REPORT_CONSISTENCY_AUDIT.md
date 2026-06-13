# Report Consistency Audit

Date: 2026-06-13

## Authoritative Report

`FINAL_DEPLOYMENT_CANONICAL.md` is the only submission-authoritative deployment report.

## Superseded Reports

The following reports are historical only and must not be submitted as active deployment evidence:

- `DEPLOYMENT_VERIFICATION_REPORT.md`
- `VERIFICATION_REPORT.md`
- `DEPLOYMENT_REFRESH_REPORT.md`

Each must be read as:

```text
SUPERSEDED
HISTORICAL ONLY
NOT SUBMISSION EVIDENCE
```

## Active Deployment References

The active deployment artifacts now reference:

- AgentRegistry: `0x3cf0763443C8Ab7672f51B8e1B34956786522a0e`
- JobManager: `0x74EE37e8Da3e483be6aB8a6d8E9a532B7683d4fb`
- ProofVerifier: `0xB9Dd5738Aa5410fe5aa392A83296f7df674Ff565`
- AtlasScore: `0x5fCca16EB477B0720bb91ec8EbF0b4Ef4891b2BB`

## Stale References

Stale addresses remain only in superseded historical reports. They should not be included in judge-facing submission materials except as archived historical notes.

## Architecture Claims

Active reports state:

- AtlasScore is canonical for reputation.
- The indexer reconstructs read state from contract events.
- The backend prepares wallet-signed transactions and serves indexed read APIs.
- The backend does not compute or update reputation.

Verdict: PASS with the ProofVerifier explorer-confirmation warning documented in `FINAL_DEPLOYMENT_CANONICAL.md`.
