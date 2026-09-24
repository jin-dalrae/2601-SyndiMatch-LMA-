const crypto = require('crypto');

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value === undefined ? null : value);
}

function allocationPayload(allocation) {
    return {
        allocation_id: allocation._id ?? null,
        syndication_id: allocation.syndication_id ?? null,
        allocation_version: allocation.allocation_version ?? null,
        allocations: (allocation.allocations || []).map(row => ({
            allocation_id: row._id ?? row.allocation_id ?? null,
            bid_id: row.bid_id ?? null,
            participant_agent_id: row.participant_agent_id ?? null,
            final_allocation: row.final_allocation ?? null,
            final_spread: row.final_spread ?? null
        }))
    };
}

function allocationFingerprint(allocation) {
    return crypto.createHash('sha256').update(stableStringify(allocationPayload(allocation))).digest('hex');
}

function validateApprovalRequest(allocation, request) {
    if (!allocation) return { ok: false, status: 409, message: 'No proposed allocation is ready for approval' };
    if (!Number.isInteger(request.allocationVersion)) {
        return { ok: false, status: 400, message: 'allocationVersion is required' };
    }
    if (!request.allocationFingerprint || typeof request.allocationFingerprint !== 'string') {
        return { ok: false, status: 400, message: 'allocationFingerprint is required' };
    }
    if (allocation.allocation_version !== request.allocationVersion) {
        return { ok: false, status: 409, message: 'Allocation changed; refresh before approving' };
    }
    const currentFingerprint = allocationFingerprint(allocation);
    if (allocation.allocation_fingerprint !== currentFingerprint || request.allocationFingerprint !== currentFingerprint) {
        return { ok: false, status: 409, message: 'Allocation fingerprint is stale or invalid' };
    }
    if (!['pending_approval', 'provisional'].includes(allocation.allocation_status)) {
        return { ok: false, status: 409, message: `Allocation is already ${allocation.allocation_status}` };
    }
    return { ok: true, fingerprint: currentFingerprint };
}

module.exports = { allocationFingerprint, validateApprovalRequest };
