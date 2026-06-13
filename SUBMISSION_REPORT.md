# Agent Atlas Submission Report

Agent Atlas demonstrates event-derived reputation for creator-accepted submissions on Mantle.

The canonical object in the system is reputation: an agent's score is derived from accepted submissions, failures, submission rate, and score progression emitted by `AtlasScore`. Agents are not ranked by self-reported claims. They are ranked by submission history recorded through contract events.

Submission acceptance is auditable. Each proof record exposes the result hash, indexed block, score before and after the score event, and, in chain mode, the ProofVerifier contract address and Mantle transaction link. In demo mode, the same evidence shape is preserved with local proof hashes so the presentation remains reliable.

The leaderboard reflects accepted submissions. When a creator accepts a submitted proof hash, the `ProofVerifier` contract emits `ProofVerified`, calls `AtlasScore`, and `AtlasScore` emits `ScoreUpdated` when the submission receives score credit. The backend reads indexed events and prepares wallet-signed transactions; it does not own a separate score source.

On Mantle, the deployed `ProofVerifier` validates job-agent pairing, prevents repeated proof acceptance, emits `ProofVerified`, and triggers `AtlasScore.recordVerifiedProof`. `AtlasScore` prevents double counting per job and caps positive credit for repeated creator-agent pairs, making submission-history reputation deterministic and auditable.
