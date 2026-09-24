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
4. **Review allocation** — a proposed full or pro-rata allocation is checked before an arranger records approval, override, or rejection.
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
- **Human approval for commitment:** allocation approval is recorded separately from the proposal it approves.
- **One canonical deal state:** browser views, APIs, agents, and event records should describe the same syndication.
- **Simulation is explicit:** the UI labels simulated settlement and does not make production or real-money claims.

## Current capabilities

- LangGraph-based multi-agent workflow with originator, participant, negotiation, settlement, and payment stages.
- Rule-based participant constraints with optional Anthropic-backed reasoning when configured.
- Multi-round Dutch-auction logic, bid ranking, pro-rata allocation, and workflow events.
- Decision Replay interface in the Deal Room, sourced from recorded bid/workflow data.
- A local-demo allocation approval endpoint and attributable approval event.
- Role-oriented views for platform admins, originators, and participants.
- Explicit simulated payment receipts; the Node x402 routes do not send or verify on-chain transfers.

## Run locally

Requirements: Node.js 18+, Python 3.10+, and MongoDB.

```bash
# Install JavaScript dependencies
npm install

# Create the Python environment
python3 -m venv .venv
.venv/bin/pip install -r agents/requirements.txt

# Configure local environment values
cp .env.example .env

# Seed local demonstration records
.venv/bin/python agents/seed_all.py

# Start the Node API and frontend on port 3001
npm run dev
```

In a second terminal:

```bash
.venv/bin/python -m uvicorn agents.server:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:3001`, then use **Deal Room** in the platform navigation. The frontend production build can be checked with:

```bash
npm run vite:build
```

## Architecture

```text
Browser / Deal Room
        ↓
Node API and static frontend (port 3001)
        ↓
FastAPI agent orchestration (port 8000)
        ↓
MongoDB canonical workflow state + event records
```

- **Node/Express** provides the browser-facing API and static frontend.
- **FastAPI + LangGraph** runs the agent workflow and streams domain events.
- **MongoDB** stores syndications, bids, allocations, payment records, approvals, and audit/event data.
- **Vanilla JavaScript + Vite** powers the current frontend.

## Demo disclosure

This is a local demonstration prototype, not a financial product. It must not be used to originate loans, make investment decisions, custody assets, or move money.

- Demo institutions and figures are illustrative.
- LLM-backed reasoning is optional; deterministic simulation rules remain available without an AI key.
- Payment and settlement screens are simulations. Transaction-like identifiers are demo receipts, not blockchain confirmations.
- Authentication and authorization are out of scope for the local demo and required before any multi-user deployment.

## Validation

```bash
npm run vite:build
python3 -m compileall -q agents
./scripts/smoke-node.sh
./scripts/smoke-agents.sh
```

The smoke tests require their respective local services and MongoDB to be running.

## Repository guide

| Path | Purpose |
| --- | --- |
| `js/components/deal-room.js` | Review-first Deal Room UI |
| `agents/` | LangGraph workflow, participant policies, and FastAPI service |
| `server/routes/syndications.js` | Browser-facing syndication, decision-receipt, and approval endpoints |
| `PROJECT_DESCRIPTION.md` | Product requirements and renovation plan |
| `DEPLOY.md` | Deployment reference; Firebase Hosting is not used by the current workflow |

## License

ISC — see [package.json](package.json).
