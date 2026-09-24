import test from "node:test";
import assert from "node:assert/strict";
import { allocateBook, fingerprintAllocation, type BidInput } from "../worker/domain.ts";

const bid = (id: string, amount: number, spreadBps: number, minAllocation = 1, maxConcentrationBps = 10_000): BidInput => ({
  id,
  participantId: `P-${id}`,
  amount,
  spreadBps,
  minAllocation,
  maxConcentrationBps,
});

test("allocation reconciles exactly to target when eligible capacity is sufficient", () => {
  const result = allocateBook([
    bid("A", 80, 200), bid("B", 70, 210), bid("C", 50, 220),
  ], 100, 220);
  assert.equal(result.allocatedAmount + result.residualAmount, 100);
  assert.equal(result.allocatedAmount, 100);
  assert.equal(result.residualAmount, 0);
});

test("allocation excludes bids above clearing spread", () => {
  const result = allocateBook([bid("A", 100, 200), bid("B", 100, 300)], 100, 250);
  assert.deepEqual(result.allocations.map((row) => row.bidId), ["A"]);
});

test("allocation respects concentration caps and makes residual explicit", () => {
  const result = allocateBook([bid("A", 100, 200, 1, 2500), bid("B", 100, 210, 1, 2500)], 100, 220);
  assert.equal(result.allocatedAmount, 50);
  assert.equal(result.residualAmount, 50);
  assert.ok(result.allocations.every((row) => row.finalAllocation <= 25));
});

test("below-minimum pro-rata rows are removed and residual is redistributed", () => {
  const result = allocateBook([bid("A", 90, 200, 60), bid("B", 10, 210, 20)], 80, 220);
  assert.deepEqual(result.allocations.map((row) => row.bidId), ["A"]);
  assert.equal(result.allocations[0]?.finalAllocation, 80);
});

test("fingerprint changes with allocation version or amount", async () => {
  const first = allocateBook([bid("A", 100, 200)], 100, 220).allocations;
  const firstHash = await fingerprintAllocation("SYND-1", 1, first);
  const newVersionHash = await fingerprintAllocation("SYND-1", 2, first);
  const edited = first.map((row) => ({ ...row, finalAllocation: row.finalAllocation - 1 }));
  const editedHash = await fingerprintAllocation("SYND-1", 1, edited);
  assert.notEqual(firstHash, newVersionHash);
  assert.notEqual(firstHash, editedHash);
});
