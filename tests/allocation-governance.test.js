const test = require('node:test');
const assert = require('node:assert/strict');
const { allocationFingerprint, validateApprovalRequest } = require('../server/lib/allocation-governance');

function allocation() {
    const value = {
        _id: 'ALLOC-SYND-001', syndication_id: 'SYND-001', allocation_version: 1,
        allocation_status: 'pending_approval',
        allocations: [{ _id: 'ALLOC-BID-1', bid_id: 'BID-1', participant_agent_id: 'PA-1', final_allocation: 60000000, final_spread: 250 }]
    };
    value.allocation_fingerprint = allocationFingerprint(value);
    return value;
}

test('accepts only the exact current allocation proposal', () => {
    const value = allocation();
    assert.equal(value.allocation_fingerprint, 'ed011511a89edabece2c312502a4bebcf7ea29566e8c3b3d049ee3888b548245');
    assert.equal(validateApprovalRequest(value, {
        allocationVersion: 1,
        allocationFingerprint: value.allocation_fingerprint
    }).ok, true);
});

test('rejects a stale version', () => {
    const value = allocation();
    const result = validateApprovalRequest(value, {
        allocationVersion: 0,
        allocationFingerprint: value.allocation_fingerprint
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
});

test('rejects a proposal changed after fingerprinting', () => {
    const value = allocation();
    value.allocations[0].final_allocation += 1;
    assert.equal(validateApprovalRequest(value, {
        allocationVersion: 1,
        allocationFingerprint: value.allocation_fingerprint
    }).ok, false);
});
