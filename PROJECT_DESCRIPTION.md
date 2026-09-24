# SyndiMatch Credit Desk — Product Requirements Document

## 1. Product summary

SyndiMatch Credit Desk is a high-fidelity prototype of an agentic workflow for institutional loan syndication. It shows how a lead arranger can open a deal, how participant agents evaluate it against explicit mandates, how a book reaches a clearing spread, and how a human approves an allocation before simulated settlement.

The product demonstrates **constrained financial agents**, not unattended financial decision-making. Agents may recommend, explain, and prepare work. Deterministic policies and a human approval gate control consequential actions.

### Portfolio positioning

> An agentic credit workflow for loan syndication: policy-constrained recommendations, transparent allocation, human approval, and replayable decision evidence.

## 2. Problem

Loan syndication requires lead arrangers, institutional lenders, operations teams, and legal/compliance teams to coordinate a complex book build. The work is fragmented across email, spreadsheets, bilateral calls, and manually reconciled records. This makes it difficult to answer basic governance questions: who was eligible, why did an institution bid or pass, how was the clearing spread selected, and who approved the final allocation?

## 3. Target users

| User | Primary job | What they need to trust |
| --- | --- | --- |
| Lead arranger | Launch a deal and build a high-quality lender book | Participant coverage, pricing, concentration limits, approval control |
| Participant / credit investor | Evaluate an opportunity within its mandate | Policy compliance, risk/return rationale, capacity protection |
| Credit operations / platform admin | Monitor and audit the workflow | State accuracy, exceptions, an attributable event trail |

## 4. Product principles

1. **Policy before prose.** Hard constraints determine eligibility; language models explain recommendations rather than override limits.
2. **No opaque autonomy.** Every material agent action exposes its input, policy checks, assumptions, outcome, and timestamp.
3. **Human approval for commitment.** Allocation and settlement cannot be represented as autonomous final actions.
4. **One canonical deal state.** The browser, API, agents, and audit trail must describe the same syndication.
5. **Simulation is explicit.** Demo data and simulated payment rails are clearly labeled; no real-money or production claims are implied.

## 5. Core experience: the Deal Room

The Deal Room is the portfolio centerpiece. It supports a single polished end-to-end deal rather than a broad collection of loosely connected dashboard views.

### 5.1 Deal intake

- A lead arranger creates a loan with borrower, amount, rating, sector, target spread, and target close.
- The system stores the deal in canonical workflow state and publishes an opening event.
- The UI marks source data and assumed fields.

### 5.2 Mandate matching and participant evaluation

- Participant agents screen a deal against deterministic constraints: rating floor, sector/geography restrictions, minimum ticket, available capacity, and concentration limits.
- Eligible participants receive a proposed bid; ineligible participants receive a clear pass reason.
- Every decision displays policy checks, rationale, inputs, and a confidence/uncertainty note when a model was used.

### 5.3 Book build and auction

- The Negotiation Agent records successive auction rounds, subscription, active bids, and clearing-spread logic.
- A live book view shows current coverage, bid distribution, concentration warnings, and whether a close condition is satisfied.
- A counterfactual lets the user compare the proposed book with a small spread, capacity, or rating change.

### 5.4 Allocation review and approval

- The system proposes full or pro-rata allocations after policy validation.
- The lead arranger sees concentration, minimum-allocation, and policy exceptions before approving.
- Approval (or override) is captured as an auditable event with actor, reason, timestamp, and before/after allocation.

### 5.5 Simulated settlement and decision replay

- Settlement is clearly labeled **Simulation** and produces traceable workflow receipts, not blockchain or real-money claims.
- A Decision Replay view answers: what did the agent know, which policy applied, what did it recommend, and what would have changed the result?

## 6. Functional requirements

### Required for the renovation

- Canonical API contract for a syndication, bids, allocations, events, and payments.
- Explicit `simulation` status in all payment and settlement UI.
- Decision receipt schema containing `decision_id`, actor/agent, inputs, policy results, rationale, outcome, timestamp, and source state version.
- A human approval endpoint/state for proposed allocations.
- Read-only event timeline and Decision Replay for the selected deal.
- Three deterministic demo scenarios: oversubscribed close, insufficient participation, and an approved human override.

### Quality and safety requirements

- The UI must never fabricate a live decision, allocation, payment, or confidence score.
- Workflow APIs must have unambiguous route definitions and return serializable documents.
- A policy failure must prevent a bid/allocation and create an audit event.
- Demo mode must work without an LLM key; model-backed output must fall back safely to deterministic rules.
- Reviewer approval must require an authenticated server-derived identity. The demo may use one reviewer role; a multi-user deployment requires enterprise SSO, granular authorization, and maker-checker separation.

## 7. Non-goals

- Originating or transferring real loans.
- Custody, escrow, USDC transfers, or an on-chain settlement claim.
- Replacing legal, compliance, or credit-committee approval.
- Presenting unverified market-size, time-to-close, or success-rate claims as measured production results.

## 8. Architecture direction

The deployed vertical slice uses one Cloudflare Worker for the browser-facing API and static Deal Room, with D1 as the canonical workflow store. Deterministic TypeScript policy code owns eligibility and allocation. A future model adapter may propose rationale or recommendations, but it may not write around policy, approval, or audit controls. The earlier Node/MongoDB and Python/LangGraph services remain research code and are not a second deployed source of truth.

```text
Deal Room UI → Cloudflare Worker API → D1 canonical state
                       ↓                    ↓
            deterministic policy     events / receipts
                       ↓
             authenticated approval → idempotent simulated continuation
```

## 9. Delivery plan

### Phase 1 — Integrity foundation

- Remove duplicate workflow routes and shadowed methods.
- Standardize canonical collection/API behavior.
- Label simulation consistently and remove production/on-chain claims.
- Bind allocation approval to a versioned proposal fingerprint.
- Make settlement enforce approval at both routing and execution boundaries.
- Validate proposed bid amounts and reserve capacity atomically.

### Phase 2 — Deal Room

- Build a focused deal workspace with intake, book build, allocation review, and event timeline.
- Replace hard-coded feed, allocation, and payment display values with API-backed records or clearly marked sample data.

### Phase 3 — Governed agency

- Add decision receipts, policy result cards, approval/override events, and Decision Replay.
- Add scenario fixtures and tests for success, failure, and human intervention.

## 10. Success criteria

A reviewer can run one demo deal and, without reading source code, explain:

1. Which participants were eligible and why.
2. Why a bid was placed, passed, or excluded.
3. How the clearing spread and allocation were calculated.
4. Which decision required human approval.
5. Which records are simulated versus derived from the workflow.

## 11. Current prototype disclosure

This repository is a deployed demonstration prototype. Its current Worker continuation path is locked to simulation mode and records `fundsMoved: false`; the legacy x402 routes do not execute or verify on-chain transfers. It must be described as a high-fidelity workflow prototype—not as a production financial platform.

## 12. Implementation status

Implemented in the governed vertical slice:

- The same Cloudflare Worker serves the Deal Room and API, with D1 as the canonical deployed store.
- Reviewer login uses a dedicated password digest, HttpOnly/Secure/SameSite session cookies, server-derived actor identity, and per-client login throttling.
- Allocation proposals receive monotonically increasing versions and a stable
  SHA-256 fingerprint over decision-bearing fields.
- Approval, override, and rejection requests must reference the current version
  and fingerprint. Rejected, stale, edited, and unapproved allocations cannot
  authorize settlement.
- Post-approval continuation checks the exact approval itself, persists a durable
  command and simulated receipt, and returns the same result on retry.
- Model-proposed bid amounts are checked against minimum ticket, maximum single
  ticket, and current available capacity immediately before persistence.
- Bid insertion and capacity reservation execute in one atomic D1 batch,
  preventing concurrent requests from overdrawing capacity.
- Allocation applies the clearing spread, per-participant concentration cap,
  minimum allocations, deterministic largest-remainder rounding, and explicit residuals.
- Missing policy evidence is represented as `unknown`, never inferred as passed.
- Browser-side random subscription changes have been removed.

The governed demo slice is end-to-end complete and deployed. Remaining productization work is deliberately broader than this case-study boundary:

- Enterprise SSO, granular roles, maker-checker separation, credential rotation, and centralized security monitoring.
- A deployed model-inference adapter with prompt/version capture, offline evaluations, and fallback telemetry.
- Additional adverse scenarios, scenario comparison, portfolio analytics, and formal recovery testing.
- Integration with authoritative loan systems, document execution, and regulated payment/custody providers; none are part of this simulation.
