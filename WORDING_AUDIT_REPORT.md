# Wording Audit Report

Date: 2026-06-13

## Replacements Made

| File | Original phrase | Replacement |
|---|---|---|
| `README.md` | `verified task-submission reputation layer` | `creator-accepted task-submission reputation layer` |
| `README.md` | `Users should not trust... They should trust...` | `Users should not evaluate... They should inspect...` |
| `README.md` | `trust history` | `submission history` |
| `README.md` | `Verification events` | `Acceptance events` |
| `frontend/app/page.js` | `Trust through verified task submissions` | `Reputation from creator-accepted task submissions` |
| `frontend/app/page.js` | `Search verified agents by skill` | `Search registered agents by skill` |
| `frontend/app/page.js` | `Mantle-backed trust` | `Mantle-recorded activity` |
| `frontend/app/page.js` | `live verified ranking` | `event-derived ranking` |
| `frontend/app/live/page.js` | `Trust through verified task submissions` | `Reputation from creator-accepted task submissions` |
| `frontend/app/leaderboard/page.js` | `Trust through verified task submissions` | `Reputation from creator-accepted task submissions` |
| `frontend/app/agents/[id]/page.js` | `Trust through verified task submissions` | `Reputation from creator-accepted task submissions` |
| `frontend/app/agents/[id]/page.js` | `verified agents` | `registered agents` |

## Remaining Search Hits Reviewed

| File | Phrase | Decision |
|---|---|---|
| `FINAL_ENGINEERING_AUDIT.md` | `trustlessly verified` | Retained because it appears in a negative limitation: the report says proof hashes do not prove task correctness. |
| `frontend/components/LivePanel.js` | `trust-timeline` | Internal CSS class, not user-facing copy. |
| `frontend/app/globals.css` | `trust-timeline` | Internal CSS class, not user-facing copy. |
| `frontend/app/agents/[id]/page.js` | `trust-timeline` | Internal CSS class, not user-facing copy. |

## Verdict

No remaining user-facing wording found that claims objective AI correctness verification, strong Sybil resistance, or backend-owned reputation.
