export type BidInput = {
  id: string;
  participantId: string;
  amount: number;
  spreadBps: number;
  minAllocation: number;
  maxConcentrationBps: number;
};

export type Allocation = {
  allocationId: string;
  bidId: string;
  participantId: string;
  finalAllocation: number;
  finalSpread: number;
};

export type AllocationResult = {
  allocations: Allocation[];
  allocatedAmount: number;
  residualAmount: number;
};

function requirePositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name}_must_be_positive_integer`);
}

export function allocateBook(
  bids: BidInput[],
  targetAmount: number,
  clearingSpreadBps: number,
): AllocationResult {
  requirePositiveInteger("target_amount", targetAmount);
  requirePositiveInteger("clearing_spread_bps", clearingSpreadBps);

  const eligible = bids
    .filter((bid) => {
      requirePositiveInteger("bid_amount", bid.amount);
      requirePositiveInteger("spread_bps", bid.spreadBps);
      return bid.spreadBps <= clearingSpreadBps;
    })
    .map((bid) => {
      const concentrationCap = Math.floor(targetAmount * bid.maxConcentrationBps / 10_000);
      return { ...bid, limit: Math.min(bid.amount, concentrationCap) };
    })
    .filter((bid) => bid.limit >= bid.minAllocation)
    .sort((a, b) => a.spreadBps - b.spreadBps || a.id.localeCompare(b.id));

  const totalCapacity = eligible.reduce((sum, bid) => sum + bid.limit, 0);
  if (totalCapacity <= targetAmount) {
    const allocations = eligible.map((bid) => toAllocation(bid, bid.limit, clearingSpreadBps));
    return { allocations, allocatedAmount: totalCapacity, residualAmount: targetAmount - totalCapacity };
  }

  let active = eligible;
  while (active.length > 0) {
    const weight = active.reduce((sum, bid) => sum + bid.limit, 0);
    const belowMinimum = active.filter((bid) => Math.floor(targetAmount * bid.limit / weight) < bid.minAllocation);
    if (belowMinimum.length === 0) break;
    const excluded = new Set(belowMinimum.map((bid) => bid.id));
    active = active.filter((bid) => !excluded.has(bid.id));
  }

  if (active.length === 0) return { allocations: [], allocatedAmount: 0, residualAmount: targetAmount };

  const weight = active.reduce((sum, bid) => sum + bid.limit, 0);
  const rows = active.map((bid) => {
    const exact = targetAmount * bid.limit / weight;
    const amount = Math.min(bid.limit, Math.floor(exact));
    return { bid, amount, remainder: exact - amount };
  });
  let allocated = rows.reduce((sum, row) => sum + row.amount, 0);
  let remaining = targetAmount - allocated;

  for (const row of rows.sort((a, b) => b.remainder - a.remainder || a.bid.id.localeCompare(b.bid.id))) {
    if (remaining === 0) break;
    if (row.amount < row.bid.limit) {
      row.amount += 1;
      remaining -= 1;
    }
  }

  const allocations = rows
    .filter((row) => row.amount >= row.bid.minAllocation)
    .sort((a, b) => a.bid.spreadBps - b.bid.spreadBps || a.bid.id.localeCompare(b.bid.id))
    .map((row) => toAllocation(row.bid, row.amount, clearingSpreadBps));
  allocated = allocations.reduce((sum, row) => sum + row.finalAllocation, 0);
  return { allocations, allocatedAmount: allocated, residualAmount: targetAmount - allocated };
}

function toAllocation(bid: BidInput & { limit: number }, amount: number, spread: number): Allocation {
  return {
    allocationId: `ALLOC-${bid.id}`,
    bidId: bid.id,
    participantId: bid.participantId,
    finalAllocation: amount,
    finalSpread: spread,
  };
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintAllocation(syndicationId: string, version: number, allocations: Allocation[]): Promise<string> {
  return sha256Hex(stableStringify({ allocation_version: version, allocations, syndication_id: syndicationId }));
}
