# SyndiMatch Credit Desk

**A high-fidelity prototype for an agentic institutional loan-syndication workflow.**

SyndiMatch shows how a lead arranger can launch a loan, how participant agents evaluate it against explicit investment mandates, how a book builds through an auction, and how a human approves an allocation before settlement is simulated.

> This is a governed-agent workflow, not an autonomous lending system. Agents recommend, explain, and prepare work; deterministic policies and a human approval gate control consequential actions.

For the detailed product plan, see [PROJECT_DESCRIPTION.md](PROJECT_DESCRIPTION.md).

## What is loan syndication?

When a company needs a large loan, one bank may arrange it while a group of institutional lenders each take a portion of the exposure. The arranging bank is the **originator**; the institutions funding portions of the loan are **participants**. The process of finding lenders, building the book, agreeing price, assigning allocations, and completing documentation is loan syndication.

## The product story

The portfolio centerpiece is the **Deal Room** (`/deal-room`). It presents a single deal as a review-first workflow:

1. **Originate** — a lead arranger defines borrower, amount, rating, sector, spread, and target close.
2. **Evaluate** — participant agents screen the opportunity against hard mandate constraints such as rating, sector, geography, ticket size, capacity, and concentration.
3. **Build the book** — eligible participants submit recommendations and the negotiation workflow records auction rounds, coverage, and the current clearing spread.
4. **Review allocation** — a proposed full or pro-rata allocation receives a version and fingerprint before an arranger records approval, override, or rejection.
5. **Replay the decision** — decision receipts expose the recorded outcome, rationale, and policy evidence instead of inventing an explanation after the fact.
6. **Simulate settlement** — the demo produces workflow receipts only. No funds, escrow accounts, USDC, or blockchain transfers move in this repository.

## Agent responsibilities

| Agent | Responsibility | Control boundary |
| --- | --- | --- |
| Originator Agent | Creates and broadcasts the deal | Deal terms remain visible in canonical workflow state |
| Participant Agent | Screens a deal and proposes a bid or pass | Hard mandate constraints take precedence over model output |
| Negotiation Agent | Records auction rounds and prepares clearing/allocation logic | The book and pricing are persisted as workflow records |
| Settlement Agent | Prepares documentation and compliance workflow stages | It does not finalize a loan or move funds |
| Payment Agent | Creates simulated settlement/payment workflow records | Payment rails are simulated and visibly labeled |

## Product principles

- **Policy before prose:** deterministic constraints determine eligibility; a language model may explain a recommendation but cannot override those limits.
- **No opaque autonomy:** a material action should expose input, policy result, rationale, outcome, and timestamp.
- **Human approval for commitment:** approval is bound to the exact allocation version and fingerprint; editing a proposal invalidates approval.
- **One canonical deal state:** browser views, APIs, agents, and event records should describe the same syndication.
- **Simulation is explicit:** the UI labels simulated settlement and does not make production or real-money claims.

## Current capabilities

- One Cloudflare Worker serves the Deal Room and its API, with D1 as the canonical workflow store.
- Deterministic mandate checks, bid validation, concentration caps, pro-rata allocation, and explicit residuals.
- Atomic bid/capacity reservation using D1 batches, including idempotent replay and concurrent-capacity protection.
- Versioned allocation proposals with SHA-256 fingerprints and stale-proposal checks.
- Authenticated reviewer approval, override, and rejection with a rate-limited login and server-derived actor identity.
- Durable, idempotent post-approval continuation with simulated settlement receipts and `fundsMoved: false`.
- Decision Replay sourced from persisted bid evidence and workflow events.
- The earlier Node/MongoDB and Python/LangGraph implementation remains as research material, not the deployed source of truth.

## Run locally

Requirements: Node.js 20+ and a Cloudflare account for deployment. Local preview uses Wrangler's local D1 database.

```bash
npm install
npx wrangler d1 migrations apply syndimatch-governed-workflow --local

# Add a SHA-256 password digest; never put the plaintext password here.
cp .dev.vars.example .dev.vars
npm run preview
```

Open the Wrangler URL, then use **Deal Room** in the platform navigation. Validate the production build with:

```bash
npm run typecheck
npm test
npm run vite:build
```

## Architecture

```text
Browser / Deal Room
        ↓
Cloudflare Worker (static assets + governed API)
        ↓
Cloudflare D1 canonical workflow state + audit events
```

- **Cloudflare Workers** provides the same-origin API, reviewer session boundary, and static frontend.
- **D1** stores deals, participants, bids, allocation history, approvals, commands, receipts, and events.
- **Deterministic TypeScript policy code** calculates the allocation; model output cannot bypass the controls.
- **Vanilla JavaScript + Vite** powers the frontend.

## Demo disclosure

This is a deployed demonstration prototype, not a financial product. It must not be used to originate loans, make investment decisions, custody assets, or move money.

- Demo institutions and figures are illustrative.
- The deployed recommendation and allocation path is deterministic and does not require an AI key.
- Payment and settlement screens are simulations. Transaction-like identifiers are demo receipts, not blockchain confirmations.
- The demo has one authenticated reviewer role. Enterprise SSO, maker-checker separation, and user administration remain out of scope.

## Validation

```bash
npm test
npm run typecheck
npm run vite:build
```

The unit suite exercises both the deployed TypeScript allocation domain and the earlier governance implementation. It covers deterministic rounding and fingerprints, concentration and minimum-allocation constraints, stale or rejected approvals, and oversized recommendations.

## Current limitations

- A single demo reviewer credential is used; production deployments need SSO, granular roles, maker-checker separation, credential rotation, and centralized security monitoring.
- Recommendations use seeded deterministic evidence. A governed model-inference adapter and its evaluations are not deployed.
- D1 is authoritative for the deployed slice; the legacy Node/MongoDB and Python/LangGraph paths are not synchronized with it.
- Settlement is intentionally simulation-only. There is no custody, payment rail, document execution, or real loan booking.
- Scenario comparison, portfolio analytics, and formal disaster-recovery exercises remain future work.

## Repository guide

| Path | Purpose |
| --- | --- |
| `js/components/deal-room.js` | Review-first Deal Room UI |
| `worker/` | Cloudflare API, authentication, allocation policy, and workflow controls |
| `migrations/` | Versioned D1 schema and deterministic demo fixtures |
| `agents/`, `server/` | Earlier LangGraph and Node/MongoDB research implementation |
| `PROJECT_DESCRIPTION.md` | Product requirements and renovation plan |
| `DEPLOY.md` | Cloudflare Worker + D1 deployment reference; Firebase Hosting is not used |

## License

ISC — see [package.json](package.json).
