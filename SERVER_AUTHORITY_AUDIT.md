# Server Authority Audit

## Completed Fix

Backend-signed write routes are no longer enabled by default.

Affected routes:

- `POST /jobs/create`
- `POST /jobs/:id/accept`
- `POST /jobs/:id/submit-proof`
- `POST /jobs/:id/mark-failed`

These now require:

```text
ENABLE_SERVER_SIGNER=true
```

Normal protocol flow uses:

```text
POST /protocol/v1/transactions
```

This returns calldata for the caller wallet to sign.

`backend/src/chain.js` now performs chain-mode startup reachability checks with a read-only JSON-RPC provider. A private key is no longer required for normal backend startup or indexed read APIs.

`.env.example` explicitly sets:

```text
ENABLE_SERVER_SIGNER=false
```

## Remaining Authority

- The hosted backend still serves indexed read APIs.
- If `ENABLE_SERVER_SIGNER=true`, the backend hot wallet regains transaction authority.
- Backend-signed writes still require `PRIVATE_KEY`; production should leave both `ENABLE_SERVER_SIGNER=false` and `PRIVATE_KEY` unset unless running a deliberate development signer.

## Verdict

Server authority is removed from the default production path. Legacy server-signed writes remain in the codebase as an explicitly gated development path.
