import { allocateBook, fingerprintAllocation, sha256Hex, type Allocation, type BidInput } from "./domain";

type JsonRecord = Record<string, unknown>;
type Session = { actor: string; role: "reviewer" };

type SyndicationRow = {
  id: string; borrower: string; industry: string; total_amount: number; target_amount: number;
  rating: string; initial_spread_bps: number; clearing_spread_bps: number | null;
  status: string; created_at: string; updated_at: string;
};
type ParticipantRow = {
  id: string; name: string; min_ticket: number; max_ticket: number;
  available_capacity: number; max_concentration_bps: number;
};
type BidRow = {
  id: string; syndication_id: string; participant_id: string; participant_name?: string;
  amount: number; spread_bps: number; min_allocation: number; status: string;
  reasoning: string; policy_version: string; policy_results_json: string;
  source_state_version: string; created_at: string; max_concentration_bps?: number;
};
type ProposalRow = {
  syndication_id: string; version: number; fingerprint: string; status: string;
  target_amount: number; allocated_amount: number; residual_amount: number;
  clearing_spread_bps: number; allocations_json: string; created_at: string; updated_at: string;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { ...JSON_HEADERS, ...SECURITY_HEADERS, ...headers } });
}

function apiError(status: number, code: string, message: string): Response {
  return json({ error: code, message }, status);
}

function secret(env: Env, name: string): string | undefined {
  const value: unknown = Reflect.get(env, name);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function boundedJson(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 16_384) throw new Error("request_too_large");
  const parsed: unknown = await request.json();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json_object");
  return parsed as JsonRecord;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === new URL(request.url).origin;
}

async function sessionFor(request: Request, env: Env): Promise<Session | null> {
  const token = cookie(request, "syndimatch_session");
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.DB.prepare(
    "SELECT actor, role FROM reviewer_sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(tokenHash, new Date().toISOString()).first<Session>();
}

async function requireReviewer(request: Request, env: Env): Promise<Session | Response> {
  if (!sameOrigin(request)) return apiError(403, "forbidden_origin", "Cross-origin mutation rejected");
  const session = await sessionFor(request, env);
  if (!session) return apiError(401, "authentication_required", "Reviewer authentication required");
  return session;
}

function isResponse(value: Session | Response): value is Response {
  return value instanceof Response;
}

function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

function parseAllocations(value: string): Allocation[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("invalid_allocation_record");
  return parsed.filter((row): row is Allocation => {
    if (!row || typeof row !== "object") return false;
    const item = row as Partial<Allocation>;
    return typeof item.allocationId === "string" && typeof item.bidId === "string" &&
      typeof item.participantId === "string" && Number.isSafeInteger(item.finalAllocation) &&
      Number.isSafeInteger(item.finalSpread);
  });
}

async function health(env: Env): Promise<Response> {
  const result = await env.DB.prepare("SELECT 1 AS healthy").first<{ healthy: number }>();
  return json({ status: result?.healthy === 1 ? "healthy" : "degraded", database: "d1", mode: "simulation" });
}

async function allData(env: Env): Promise<Response> {
  const [syndicationsResult, participantsResult, bidsResult, proposalsResult] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM syndications ORDER BY created_at DESC"),
    env.DB.prepare("SELECT * FROM participants ORDER BY name"),
    env.DB.prepare("SELECT b.*, p.name AS participant_name FROM bids b JOIN participants p ON p.id = b.participant_id ORDER BY b.created_at"),
    env.DB.prepare("SELECT * FROM allocation_proposals"),
  ]);
  if (!syndicationsResult || !participantsResult || !bidsResult || !proposalsResult) {
    throw new Error("incomplete_database_batch");
  }
  const syndications = syndicationsResult.results as SyndicationRow[];
  const participants = participantsResult.results as ParticipantRow[];
  const bids = bidsResult.results as BidRow[];
  const proposals = proposalsResult.results as ProposalRow[];

  const mapped = syndications.map((deal) => {
    const dealBids = bids.filter((bid) => bid.syndication_id === deal.id);
    const proposal = proposals.find((item) => item.syndication_id === deal.id);
    const bidTotal = dealBids.reduce((sum, bid) => sum + bid.amount, 0);
    return {
      _id: deal.id,
      syndication_id: deal.id,
      loan_details: {
        borrower_name: deal.borrower, industry: deal.industry, total_amount: deal.total_amount,
        syndication_target: deal.target_amount, credit_rating: deal.rating,
      },
      pricing: { initial_spread: deal.initial_spread_bps },
      current_spread: proposal?.clearing_spread_bps ?? deal.clearing_spread_bps ?? deal.initial_spread_bps,
      subscription_rate: deal.target_amount > 0 ? bidTotal / deal.target_amount : 0,
      status: deal.status,
      bids: dealBids.map((bid) => ({
        _id: bid.id, participant_agent_id: bid.participant_id, institution_name: bid.participant_name,
        bid_amount: bid.amount, spread_bid: bid.spread_bps, bid_status: bid.status,
      })),
      allocations: proposal ? parseAllocations(proposal.allocations_json) : [],
      allocation_version: proposal?.version ?? null,
      allocation_status: proposal?.status ?? null,
      created_at: deal.created_at,
      updated_at: deal.updated_at,
    };
  });
  return json({ syndications: mapped, participants: participants.map((participant) => ({
    _id: participant.id,
    institution: { name: participant.name },
    risk_appetite: {
      min_ticket: participant.min_ticket, max_single_ticket: participant.max_ticket,
      available_capacity: participant.available_capacity,
    },
  })), originators: [], agents: {}, timestamp: new Date().toISOString() });
}

async function decisionReceipts(env: Env, syndicationId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT b.*, p.name AS participant_name FROM bids b JOIN participants p ON p.id = b.participant_id WHERE b.syndication_id = ? ORDER BY b.created_at"
  ).bind(syndicationId).all<BidRow>();
  return json({
    syndication_id: syndicationId,
    receipts: results.map((bid) => ({
      decision_id: bid.id, decision_type: "participant_bid", agent_id: bid.participant_id,
      actor: bid.participant_name, outcome: bid.status,
      recommendation: `Bid $${bid.amount.toLocaleString()} at ${bid.spread_bps} bps`,
      rationale: bid.reasoning, policy_results: JSON.parse(bid.policy_results_json),
      policy_version: bid.policy_version, source_state_version: bid.source_state_version,
      recorded_at: bid.created_at,
    })),
    disclosure: "Receipts expose only policy evidence persisted at decision time.",
  });
}

async function participantDirectory(env: Env): Promise<Array<Record<string, unknown>>> {
  const { results } = await env.DB.prepare("SELECT * FROM participants ORDER BY name").all<ParticipantRow>();
  return results.map((participant) => ({
    id: participant.id,
    _id: participant.id,
    agent_id: participant.id,
    name: participant.name,
    entity: participant.name,
    type: "participant",
    risk_appetite: {
      min_ticket: participant.min_ticket,
      max_single_ticket: participant.max_ticket,
      available_capacity: participant.available_capacity,
    },
  }));
}

async function allEvents(request: Request, env: Env): Promise<Response> {
  const requested = Number(new URL(request.url).searchParams.get("limit") || "50");
  const limit = Number.isSafeInteger(requested) ? Math.min(200, Math.max(1, requested)) : 50;
  const { results } = await env.DB.prepare(
    "SELECT id AS _id, syndication_id, event_type, actor, payload_json, created_at AS timestamp FROM workflow_events ORDER BY created_at DESC LIMIT ?"
  ).bind(limit).all<{ _id: string; syndication_id: string | null; event_type: string; actor: string | null; payload_json: string; timestamp: string }>();
  return json(results.map((event) => ({ ...event, data: JSON.parse(event.payload_json) })));
}

async function proposalResponse(env: Env, syndicationId: string): Promise<Response> {
  const proposal = await env.DB.prepare("SELECT * FROM allocation_proposals WHERE syndication_id = ?")
    .bind(syndicationId).first<ProposalRow>();
  if (!proposal) return apiError(404, "not_found", "Allocation proposal not found");
  const allocations = parseAllocations(proposal.allocations_json);
  const current = await fingerprintAllocation(syndicationId, proposal.version, allocations);
  if (!safeEqual(current, proposal.fingerprint)) return apiError(409, "integrity_failure", "Allocation integrity check failed");
  return json({
    allocationId: `ALLOC-${syndicationId}`, allocationVersion: proposal.version,
    allocationFingerprint: proposal.fingerprint, allocationStatus: proposal.status,
    targetAmount: proposal.target_amount, allocatedAmount: proposal.allocated_amount,
    residualAmount: proposal.residual_amount, clearingSpreadBps: proposal.clearing_spread_bps,
    allocations,
  });
}

async function login(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "forbidden_origin", "Cross-origin login rejected");
  const configuredHash = secret(env, "REVIEWER_PASSWORD_HASH");
  if (!configuredHash) return apiError(503, "auth_not_configured", "Reviewer login is not configured");
  const windowMilliseconds = 15 * 60 * 1000;
  const windowStartedAt = new Date(Math.floor(Date.now() / windowMilliseconds) * windowMilliseconds).toISOString();
  const clientAddress = request.headers.get("cf-connecting-ip") || "unknown";
  const bucketHash = await sha256Hex(`${clientAddress}:${windowStartedAt}`);
  const rateLimitResults = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO login_attempts (bucket_hash, window_started_at, attempts) VALUES (?, ?, 1)
       ON CONFLICT(bucket_hash) DO UPDATE SET attempts = attempts + 1`
    ).bind(bucketHash, windowStartedAt),
    env.DB.prepare("DELETE FROM login_attempts WHERE window_started_at < ?")
      .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    env.DB.prepare("SELECT attempts FROM login_attempts WHERE bucket_hash = ?").bind(bucketHash),
  ]);
  const attempts = (rateLimitResults[2]?.results[0] as { attempts?: number } | undefined)?.attempts ?? 1;
  if (attempts > 8) {
    return apiError(429, "rate_limited", "Too many login attempts; try again after the current 15-minute window");
  }
  const body = await boundedJson(request);
  if (typeof body.password !== "string" || body.password.length < 12 || body.password.length > 256) {
    return apiError(400, "invalid_credentials", "Invalid reviewer credentials");
  }
  const submittedHash = await sha256Hex(body.password);
  if (!safeEqual(submittedHash, configuredHash)) return apiError(401, "invalid_credentials", "Invalid reviewer credentials");

  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const ttl = Number(env.SESSION_TTL_SECONDS);
  const expires = new Date(now.getTime() + ttl * 1000);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM reviewer_sessions WHERE expires_at <= ?").bind(now.toISOString()),
    env.DB.prepare("INSERT INTO reviewer_sessions VALUES (?, ?, 'reviewer', ?, ?)")
      .bind(tokenHash, env.REVIEWER_ID, expires.toISOString(), now.toISOString()),
  ]);
  return json({ actor: env.REVIEWER_ID, role: "reviewer", expiresAt: expires.toISOString() }, 200, {
    "set-cookie": `syndimatch_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`,
  });
}

async function logout(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) return apiError(403, "forbidden_origin", "Cross-origin logout rejected");
  const token = cookie(request, "syndimatch_session");
  if (token) await env.DB.prepare("DELETE FROM reviewer_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  return json({ success: true }, 200, { "set-cookie": "syndimatch_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" });
}

async function submitBid(request: Request, env: Env, syndicationId: string): Promise<Response> {
  const reviewer = await requireReviewer(request, env);
  if (isResponse(reviewer)) return reviewer;
  const body = await boundedJson(request);
  const participantId = typeof body.participantId === "string" ? body.participantId : null;
  const amount = integer(body.amount);
  const spreadBps = integer(body.spreadBps);
  const minAllocation = integer(body.minAllocation);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!participantId || !amount || !spreadBps || minAllocation === null || !idempotencyKey) {
    return apiError(400, "invalid_bid", "participantId, integer amounts, spread, and Idempotency-Key are required");
  }
  const existing = await env.DB.prepare("SELECT id, amount, spread_bps FROM bids WHERE idempotency_key = ?")
    .bind(idempotencyKey).first();
  if (existing) return json({ bid: existing, idempotentReplay: true });
  const id = `BID-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const policyResults = JSON.stringify([
    { rule: "minimum_ticket", result: "passed" }, { rule: "maximum_single_ticket", result: "passed" },
    { rule: "available_capacity", result: "passed" },
  ]);
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO bids (id,idempotency_key,syndication_id,participant_id,amount,spread_bps,min_allocation,status,reasoning,policy_version,policy_results_json,source_state_version,created_at)
         SELECT ?,?,?,?,?,?,?,'active',?,'participant-mandate-v1',?,?,?
         FROM participants p JOIN syndications s ON s.id = ?
         WHERE p.id = ? AND s.status IN ('open','book_building')
           AND ? BETWEEN p.min_ticket AND p.max_ticket AND p.available_capacity >= ?`
      ).bind(id, idempotencyKey, syndicationId, participantId, amount, spreadBps, minAllocation,
        typeof body.reasoning === "string" ? body.reasoning : "Deterministic demo recommendation.",
        policyResults, now, now, syndicationId, participantId, amount, amount),
      env.DB.prepare(
        "UPDATE participants SET available_capacity = available_capacity - ? WHERE id = ? AND EXISTS (SELECT 1 FROM bids WHERE id = ? AND participant_id = ?)"
      ).bind(amount, participantId, id, participantId),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1 || (results[1]?.meta.changes ?? 0) !== 1) {
      return apiError(409, "mandate_or_capacity_violation", "Bid violates mandate, capacity, uniqueness, or deal status");
    }
  } catch (error: unknown) {
    const replay = await env.DB.prepare("SELECT id, amount, spread_bps FROM bids WHERE idempotency_key = ?")
      .bind(idempotencyKey).first();
    if (replay) return json({ bid: replay, idempotentReplay: true });
    console.warn(JSON.stringify({ event: "bid_rejected", syndicationId, participantId, error: String(error) }));
    return apiError(409, "mandate_or_capacity_violation", "Bid violates mandate, capacity, uniqueness, or deal status");
  }
  return json({ bid: { id, participantId, amount, spreadBps }, idempotentReplay: false }, 201);
}

async function createAllocation(request: Request, env: Env, syndicationId: string): Promise<Response> {
  const reviewer = await requireReviewer(request, env);
  if (isResponse(reviewer)) return reviewer;
  const body = await boundedJson(request);
  const clearingSpreadBps = integer(body.clearingSpreadBps);
  const expectedVersion = integer(body.expectedVersion);
  if (!clearingSpreadBps || clearingSpreadBps <= 0 || expectedVersion === null || expectedVersion < 0) {
    return apiError(400, "invalid_allocation_request", "Positive integer clearingSpreadBps and non-negative expectedVersion required");
  }
  const deal = await env.DB.prepare("SELECT * FROM syndications WHERE id = ?").bind(syndicationId).first<SyndicationRow>();
  if (!deal) return apiError(404, "not_found", "Syndication not found");
  if (!["open", "book_building", "awaiting_approval"].includes(deal.status)) {
    return apiError(409, "deal_not_allocatable", "Settled, approved, or rejected deals cannot be reallocated");
  }
  const { results } = await env.DB.prepare(
    `SELECT b.*, p.max_concentration_bps FROM bids b JOIN participants p ON p.id = b.participant_id
     WHERE b.syndication_id = ? AND b.status = 'active' ORDER BY b.spread_bps, b.created_at`
  ).bind(syndicationId).all<BidRow>();
  const bids: BidInput[] = results.map((bid) => ({
    id: bid.id, participantId: bid.participant_id, amount: bid.amount, spreadBps: bid.spread_bps,
    minAllocation: bid.min_allocation, maxConcentrationBps: bid.max_concentration_bps ?? 2500,
  }));
  const result = allocateBook(bids, deal.target_amount, clearingSpreadBps);
  if (result.allocations.length === 0) return apiError(409, "no_eligible_book", "No bids satisfy clearing spread and minimum allocation");
  const previous = await env.DB.prepare("SELECT version FROM allocation_proposals WHERE syndication_id = ?")
    .bind(syndicationId).first<{ version: number }>();
  if ((previous?.version ?? 0) !== expectedVersion) {
    return apiError(409, "stale_allocation", "Allocation version changed; refresh and retry");
  }
  const version = expectedVersion + 1;
  const fingerprint = await fingerprintAllocation(syndicationId, version, result.allocations);
  const now = new Date().toISOString();
  const proposalStatement = env.DB.prepare(
    `INSERT INTO allocation_proposals
       (syndication_id,version,fingerprint,status,target_amount,allocated_amount,residual_amount,clearing_spread_bps,allocations_json,created_at,updated_at)
     SELECT ?,?,?,'pending_approval',?,?,?,?,?,?,?
     WHERE EXISTS (SELECT 1 FROM syndications WHERE id=? AND status IN ('open','book_building','awaiting_approval'))
     ON CONFLICT(syndication_id) DO UPDATE SET
       version=excluded.version,fingerprint=excluded.fingerprint,status='pending_approval',
       target_amount=excluded.target_amount,allocated_amount=excluded.allocated_amount,
       residual_amount=excluded.residual_amount,clearing_spread_bps=excluded.clearing_spread_bps,
       allocations_json=excluded.allocations_json,updated_at=excluded.updated_at
     WHERE allocation_proposals.version=? AND allocation_proposals.status='pending_approval'`
  ).bind(syndicationId, version, fingerprint, deal.target_amount, result.allocatedAmount, result.residualAmount,
    clearingSpreadBps, JSON.stringify(result.allocations), now, now, syndicationId, expectedVersion);
  const historyStatements = result.allocations.map((allocation) => env.DB.prepare(
    `INSERT INTO allocation_history
     SELECT ?,?,?,?,?,?
     WHERE EXISTS (SELECT 1 FROM allocation_proposals WHERE syndication_id=? AND version=? AND fingerprint=? AND status='pending_approval')`
  ).bind(syndicationId, version, allocation.participantId, allocation.bidId, allocation.finalAllocation,
    allocation.finalSpread, syndicationId, version, fingerprint));
  try {
    const results = await env.DB.batch([
      proposalStatement,
      ...historyStatements,
      env.DB.prepare(
        `UPDATE syndications SET status='awaiting_approval', clearing_spread_bps=?, updated_at=?
         WHERE id=? AND EXISTS (SELECT 1 FROM allocation_proposals WHERE syndication_id=? AND version=? AND fingerprint=? AND status='pending_approval')`
      ).bind(clearingSpreadBps, now, syndicationId, syndicationId, version, fingerprint),
      env.DB.prepare(
        `INSERT INTO workflow_events
         SELECT ?,?, 'ALLOCATION_PROPOSED', ?,?,?
         WHERE EXISTS (SELECT 1 FROM allocation_proposals WHERE syndication_id=? AND version=? AND fingerprint=? AND status='pending_approval')`
      ).bind(crypto.randomUUID(), syndicationId, reviewer.actor, JSON.stringify({ version, fingerprint, ...result }), now,
        syndicationId, version, fingerprint),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1) {
      return apiError(409, "allocation_conflict", "Allocation changed during calculation; refresh and retry");
    }
  } catch (error: unknown) {
    console.warn(JSON.stringify({ event: "allocation_conflict", syndicationId, version, error: String(error) }));
    return apiError(409, "allocation_conflict", "Allocation changed during calculation; refresh and retry");
  }
  return json({ syndicationId, version, fingerprint, ...result, status: "pending_approval" }, 201);
}

async function approveAllocation(request: Request, env: Env, syndicationId: string): Promise<Response> {
  const reviewer = await requireReviewer(request, env);
  if (isResponse(reviewer)) return reviewer;
  const body = await boundedJson(request);
  const version = integer(body.allocationVersion);
  const fingerprint = typeof body.allocationFingerprint === "string" ? body.allocationFingerprint : null;
  const decision = typeof body.decision === "string" ? body.decision : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!version || !fingerprint || !decision || !["approved", "override", "rejected"].includes(decision)) {
    return apiError(400, "invalid_approval", "Current version, fingerprint, and valid decision required");
  }
  if ((decision === "override" || decision === "rejected") && !reason) {
    return apiError(400, "reason_required", "Override and rejection require a reason");
  }
  const proposal = await env.DB.prepare("SELECT * FROM allocation_proposals WHERE syndication_id = ?")
    .bind(syndicationId).first<ProposalRow>();
  if (!proposal || proposal.status !== "pending_approval" || proposal.version !== version) {
    return apiError(409, "stale_allocation", "Allocation changed or was already decided");
  }
  const current = await fingerprintAllocation(syndicationId, version, parseAllocations(proposal.allocations_json));
  if (!safeEqual(current, proposal.fingerprint) || !safeEqual(current, fingerprint)) {
    return apiError(409, "integrity_failure", "Allocation fingerprint is stale or invalid");
  }
  const status = decision === "rejected" ? "rejected" : "approved";
  const now = new Date().toISOString();
  const approvalId = `APP-${syndicationId}-${version}`;
  try {
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE allocation_proposals SET status=?, updated_at=? WHERE syndication_id=? AND version=? AND fingerprint=? AND status='pending_approval'")
        .bind(status, now, syndicationId, version, current),
      env.DB.prepare(
        `INSERT INTO approvals
         SELECT ?,?,?,?,?,?,?,?
         WHERE EXISTS (SELECT 1 FROM allocation_proposals WHERE syndication_id=? AND version=? AND fingerprint=? AND status=?)`
      ).bind(approvalId, syndicationId, version, current, reviewer.actor, decision, reason || null, now,
        syndicationId, version, current, status),
      env.DB.prepare("UPDATE syndications SET status=?, updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM approvals WHERE id=?)")
        .bind(status, now, syndicationId, approvalId),
      env.DB.prepare(
        `INSERT INTO workflow_events
         SELECT ?,?, 'ALLOCATION_DECIDED', ?,?,?
         WHERE EXISTS (SELECT 1 FROM approvals WHERE id=?)`
      ).bind(crypto.randomUUID(), syndicationId, reviewer.actor,
        JSON.stringify({ version, fingerprint: current, decision, reason: reason || null }), now, approvalId),
    ]);
    if ((results[0]?.meta.changes ?? 0) !== 1 || (results[1]?.meta.changes ?? 0) !== 1) {
      return apiError(409, "approval_conflict", "Approval lost a concurrent update race");
    }
  } catch (error: unknown) {
    console.warn(JSON.stringify({ event: "approval_conflict", syndicationId, version, error: String(error) }));
    return apiError(409, "approval_conflict", "Approval was already recorded or became stale");
  }
  return json({ approvalId, syndicationId, allocationVersion: version, allocationFingerprint: current, actor: reviewer.actor, decision, allocationStatus: status }, 201);
}

async function continueWorkflow(request: Request, env: Env, syndicationId: string): Promise<Response> {
  const reviewer = await requireReviewer(request, env);
  if (isResponse(reviewer)) return reviewer;
  const proposal = await env.DB.prepare("SELECT * FROM allocation_proposals WHERE syndication_id = ?")
    .bind(syndicationId).first<ProposalRow>();
  if (!proposal || proposal.status !== "approved") return apiError(409, "approval_required", "Approved current allocation required");
  const allocations = parseAllocations(proposal.allocations_json);
  const current = await fingerprintAllocation(syndicationId, proposal.version, allocations);
  const approval = await env.DB.prepare(
    "SELECT id FROM approvals WHERE syndication_id=? AND allocation_version=? AND allocation_fingerprint=? AND decision IN ('approved','override')"
  ).bind(syndicationId, proposal.version, current).first<{ id: string }>();
  if (!approval || !safeEqual(current, proposal.fingerprint)) return apiError(409, "approval_required", "Exact current allocation approval required");

  const commandId = `SETTLE-${syndicationId}-${proposal.version}`;
  const existing = await env.DB.prepare("SELECT result_json FROM workflow_commands WHERE id=?").bind(commandId).first<{ result_json: string }>();
  if (existing) return json({ ...JSON.parse(existing.result_json) as JsonRecord, idempotentReplay: true });

  const now = new Date().toISOString();
  const receipt = {
    receiptId: commandId,
    syndicationId,
    allocationVersion: proposal.version,
    allocationFingerprint: current,
    allocatedAmount: proposal.allocated_amount,
    residualAmount: proposal.residual_amount,
    mode: "simulation",
    fundsMoved: false,
    completedAt: now,
  };
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO settlements VALUES (?, ?, ?, 'simulated', ?, ?)")
        .bind(commandId, syndicationId, proposal.version, JSON.stringify(receipt), now),
      env.DB.prepare("INSERT INTO workflow_commands VALUES (?, ?, ?, 'completed', ?, ?, ?)")
        .bind(commandId, syndicationId, proposal.version, JSON.stringify(receipt), now, now),
      env.DB.prepare("UPDATE syndications SET status='settled', updated_at=? WHERE id=? AND status='approved'")
        .bind(now, syndicationId),
      env.DB.prepare("INSERT INTO workflow_events VALUES (?, ?, 'SIMULATED_SETTLEMENT_COMPLETED', ?, ?, ?)")
        .bind(crypto.randomUUID(), syndicationId, reviewer.actor, JSON.stringify(receipt), now),
    ]);
  } catch (error: unknown) {
    const replay = await env.DB.prepare("SELECT result_json FROM workflow_commands WHERE id=?").bind(commandId).first<{ result_json: string }>();
    if (replay) return json({ ...JSON.parse(replay.result_json) as JsonRecord, idempotentReplay: true });
    console.error(JSON.stringify({ event: "settlement_failed", syndicationId, error: String(error) }));
    return apiError(500, "settlement_failed", "Simulated settlement could not complete atomically");
  }
  return json({ ...receipt, idempotentReplay: false }, 201);
}

async function events(env: Env, syndicationId: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT id, event_type, actor, payload_json, created_at FROM workflow_events WHERE syndication_id=? ORDER BY created_at"
  ).bind(syndicationId).all<{ id: string; event_type: string; actor: string | null; payload_json: string; created_at: string }>();
  return json(results.map((event) => ({ ...event, data: JSON.parse(event.payload_json) })));
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  if (method === "GET" && path === "/api/health") return health(env);
  if (method === "GET" && path === "/api/ready") return health(env);
  if (method === "GET" && path === "/api/all-data") return allData(env);
  if (method === "GET" && path === "/api/participants") return json(await participantDirectory(env));
  if (method === "GET" && path === "/api/originators") return json([]);
  if (method === "GET" && path === "/api/agents") {
    return json({ originator: [], participant: await participantDirectory(env), negotiation: [], settlement: [], payment: [] });
  }
  if (method === "GET" && path === "/api/syndication-events") return allEvents(request, env);
  if (method === "POST" && path === "/api/auth/login") return login(request, env);
  if (method === "POST" && path === "/api/auth/logout") return logout(request, env);
  if (method === "GET" && path === "/api/auth/me") {
    const session = await sessionFor(request, env);
    return session ? json(session) : apiError(401, "authentication_required", "No active reviewer session");
  }

  const receiptsMatch = path.match(/^\/api\/syndications\/([^/]+)\/decision-receipts$/);
  if (method === "GET" && receiptsMatch?.[1]) return decisionReceipts(env, decodeURIComponent(receiptsMatch[1]));
  const proposalMatch = path.match(/^\/api\/syndications\/([^/]+)\/allocation-proposal$/);
  if (method === "GET" && proposalMatch?.[1]) return proposalResponse(env, decodeURIComponent(proposalMatch[1]));
  const bidMatch = path.match(/^\/api\/syndications\/([^/]+)\/bids$/);
  if (method === "POST" && bidMatch?.[1]) return submitBid(request, env, decodeURIComponent(bidMatch[1]));
  const allocateMatch = path.match(/^\/api\/syndications\/([^/]+)\/allocate$/);
  if (method === "POST" && allocateMatch?.[1]) return createAllocation(request, env, decodeURIComponent(allocateMatch[1]));
  const approvalMatch = path.match(/^\/api\/syndications\/([^/]+)\/allocation-approval$/);
  if (method === "POST" && approvalMatch?.[1]) return approveAllocation(request, env, decodeURIComponent(approvalMatch[1]));
  const continueMatch = path.match(/^\/api\/syndications\/([^/]+)\/continue$/);
  if (method === "POST" && continueMatch?.[1]) return continueWorkflow(request, env, decodeURIComponent(continueMatch[1]));
  const eventsMatch = path.match(/^\/api\/syndication-events\/([^/]+)$/);
  if (method === "GET" && eventsMatch?.[1]) return events(env, decodeURIComponent(eventsMatch[1]));
  return apiError(404, "not_found", "API route not found");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) return await routeApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error: unknown) {
      console.error(JSON.stringify({ event: "unhandled_request_error", path: new URL(request.url).pathname, error: String(error) }));
      return apiError(500, "internal_error", "Request could not be completed");
    }
  },
} satisfies ExportedHandler<Env>;
