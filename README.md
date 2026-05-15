# SyndiMatch

**Imagine a company needs to borrow a LOT of money. Like, $500 million. SyndiMatch is a tool that helps a bunch of banks team up to lend that money together — and it uses AI helper robots to do the slow, boring parts in minutes instead of weeks.**

This README explains what that actually means, in plain words. If you want the business pitch, see [PITCH_DECK.md](PITCH_DECK.md). If you want to deploy it to the internet, see [DEPLOY.md](DEPLOY.md).

---

## First, what is a "syndicated loan"?

Let's start with a story.

A big company — say, a airline — wants to borrow **$500 million** to buy new planes. They go to a bank and ask for the money.

Here's the problem: that's a *huge* amount. If the bank lends all $500 million and the airline can't pay it back, the bank is in serious trouble. That's way too much risk for one bank to take alone.

So the banks do something smart. Instead of one bank lending all $500 million, **lots of banks each lend a slice**:

- Bank A lends $100 million
- Bank B lends $80 million
- Pension fund C lends $75 million
- ...and so on, until the whole $500 million is covered.

Now if something goes wrong, no single lender loses everything. The risk is shared. This "team of lenders splitting one big loan" is called a **syndicated loan**. The whole process of putting that team together is **syndication**.

> Think of it like a $500 class trip that's too expensive for one family. So 20 families each chip in a different amount until the trip is fully paid for. One family organizes it and collects everyone's share.

The family that organizes it has a name in finance: the **lead arranger** (or **originator**). The families who chip in are the **participants**.

---

## Why does this need fixing?

Organizing a syndicated loan today is *painfully slow*. It works mostly through:

- Phone calls
- Emails
- Spreadsheets sent back and forth
- Lawyers checking documents by hand

A single deal can take **4 to 6 weeks** just to get organized. During those weeks, money sits around doing nothing, and everyone's time is wasted on back-and-forth messages. For a $4.7 *trillion* market, that slowness costs a fortune.

It's like if planning that class trip took six weeks of phone tag just to figure out who's paying what.

---

## What SyndiMatch does

SyndiMatch gives every player a smart **AI assistant** (we call them "agents") that does the slow back-and-forth for them, automatically, in minutes.

There are **five kinds of agents**, each with one job. Here's the whole process as a relay race:

| # | Agent | What it does (in plain words) |
|---|-------|-------------------------------|
| 1 | **Originator** | The organizer. Sets up the deal: who's borrowing, how much, and the interest rate. Like the family that plans the class trip. |
| 2 | **Participant** | Each lender's personal robot. It looks at the deal and decides "is this a good deal for us? how much should we chip in?" — based on rules its bank gave it. |
| 3 | **Negotiation** | The auctioneer. Runs a fair bidding round so everyone agrees on the interest rate and who lends how much. |
| 4 | **Settlement** | The paperwork checker. Confirms the final amounts and makes sure the documents are correct. |
| 5 | **Payment** | The money mover. Handles sending the funds when everything is agreed and signed. |

Because robots don't need to sleep or play phone tag, what used to take **weeks now takes hours**. And every decision an agent makes is written down in a log, so humans can always check *why* the robot did what it did.

---

## The life of a deal (the "pipeline")

Every deal moves through stages, like levels in a game. In SyndiMatch you can watch this happen live:

```
OPEN  →  NEGOTIATING  →  CLOSING  →  SETTLEMENT  →  FUNDING  →  COMPLETED
```

1. **Open** — The deal is announced. "Who wants in?"
2. **Negotiating** — Lenders' robots place bids. The price gets worked out.
3. **Closing** — Enough lenders are in. The deal is locked.
4. **Settlement** — Final amounts confirmed, documents checked.
5. **Funding** — The money is moved.
6. **Completed** — Done. The company has its loan.

In this demo, a brand-new deal walks through all six stages on its own in under a minute so you can watch the whole thing happen.

---

## Is this real money?

**No.** This is a **demo** — a working model, like a flight simulator for a video game pilot. It looks and behaves like the real thing, but:

- No real dollars or cryptocurrency move anywhere.
- The "payments" are pretend (we call this the *mock x402* system).
- The companies and banks in the demo are made up.

It's built to *show how the real thing would work*, not to actually move money. (There's a friendly "DRAFT / demo" stamp on the legal pages to make this clear.)

---

## The three people who use it

When you open SyndiMatch, you pick who you want to be (top-right dropdown):

| You play as... | You see... |
|----------------|------------|
| **Platform Admin** | The control room. Every deal, every agent, all at once. |
| **Originator** (a bank) | The "create a deal" desk. You fill a form and announce a new loan. |
| **Participant** (an investor) | The "should I invest?" desk. You browse deals and let your robot bid. |

No sign-up or password needed for the demo.

---

## How to run it on your own computer

You need three things installed first: **Node.js** (version 18 or newer), **Python** (3.10 or newer), and **MongoDB** (a database).

Then, in a terminal, run these one at a time:

```bash
# 1. Start the database
brew services start mongodb-community

# 2. Install the helper code
npm install
python3 -m venv .venv
.venv/bin/pip install -r agents/requirements.txt

# 3. Copy the settings file (the defaults already work)
cp .env.example .env

# 4. Fill the database with pretend deals and banks
.venv/bin/python agents/seed_all.py

# 5. Start the main website (keep this running)
npm run dev

# 6. Open a SECOND terminal and start the AI agents
.venv/bin/python -m uvicorn agents.server:app --host 0.0.0.0 --port 8000

# 7. Open your web browser to:
#    http://localhost:3001
```

That's it. Click **"Try the demo"**, pick a role, and watch the agents work.

> You do **not** need any paid AI keys to run the demo. When no key is set, the agents run in "simulation mode" — they make sensible pretend decisions instead of calling a real AI. Everything still works.

---

## What's under the hood (for the curious)

SyndiMatch is three programs working together, like three departments of a company passing notes:

```
   Your web browser  (the buttons and screens you click)
            │
            ▼
   Node.js server     (the front desk — handles requests, talks to the database)
            │
            ▼
   Python AI agents    (the "brains" — the five robot helpers)
            │
            ▼
   MongoDB              (the filing cabinet — remembers every deal)
```

- The **browser** part is plain HTML, CSS, and JavaScript.
- The **server** is Node.js with Express, storing everything in MongoDB.
- The **agents** are Python, built with a tool called LangGraph that lets AI take turns making decisions.

More detail for developers lives in the comments inside the code and in [DEPLOY.md](DEPLOY.md).

---

## A few honest notes

- This is a learning/demo project, **not** a real financial product. Don't use it to make real money decisions.
- Some numbers on the dashboards are illustrative (made up for the demo).
- The legal pages (Terms, Privacy) are drafts and would need a real lawyer before any real use.

---

## Words grown-ups use, explained simply

| Fancy word | What it really means |
|------------|----------------------|
| **Syndication** | A group of lenders splitting one big loan so no one takes all the risk. |
| **Originator / Lead arranger** | The bank that organizes the deal and invites others in. |
| **Participant** | A lender who chips in part of the loan. |
| **Spread / bps** | The extra interest the borrower pays. "bps" = basis points; 100 bps = 1%. |
| **Subscription** | How "full" a deal is. 100% means enough lenders have joined to cover the whole loan. |
| **Settlement** | Finishing the paperwork and confirming who owes/gets what. |
| **x402** | A way to send digital payments automatically. Here it's *pretend* (mock). |
| **Agent** | An AI helper that makes one kind of decision on someone's behalf. |

---

## License

ISC — see `package.json`.
