const express = require('express');
const { getDB } = require('../db');
const { callAgentsService } = require('../lib/agents-proxy');

const router = express.Router();

router.get('/syndications', async (req, res) => {
    try {
        const db = getDB();
        const syndications = await db.collection('syndication_original').find({}).sort({ createdAt: -1 }).toArray();
        res.json(syndications);
    } catch (error) {
        console.error('❌ Failed to fetch syndications:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch syndications' });
    }
});

router.get('/syndications/:id', async (req, res) => {
    try {
        const db = getDB();
        const syndication = await db.collection('syndication_original').findOne({ _id: req.params.id });
        if (!syndication) {
            return res.status(404).json({ error: 'Not Found', message: 'Syndication not found' });
        }
        res.json(syndication);
    } catch (error) {
        console.error(`❌ Failed to fetch syndication ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Decision receipts are intentionally read-only views over workflow records.
// They make the agent's input and outcome reviewable without letting a UI
// fabricate an audit trail.
router.get('/syndications/:id/decision-receipts', async (req, res) => {
    try {
        const db = getDB();
        const syndication = await db.collection('syndication_original').findOne({ _id: req.params.id });
        if (!syndication) {
            return res.status(404).json({ error: 'Not Found', message: 'Syndication not found' });
        }

        const bids = await db.collection('bids')
            .find({ syndication_id: req.params.id })
            .sort({ submitted_at: 1, created_at: 1 })
            .toArray();

        const receipts = bids.map((bid, index) => ({
            decision_id: bid.decision_id || `BID-${req.params.id}-${index + 1}`,
            decision_type: 'participant_bid',
            agent_id: bid.participant_agent_id,
            actor: bid.institution_name || bid.participant_agent_id || 'Participant agent',
            outcome: bid.bid_status || 'active',
            recommendation: bid.bid_amount
                ? `Bid $${Number(bid.bid_amount).toLocaleString()} at ${bid.spread_bid} bps`
                : 'Pass',
            rationale: bid.reasoning || 'No rationale was recorded for this workflow event.',
            policy_results: bid.constraints_violated?.length
                ? bid.constraints_violated.map(constraint => ({ rule: constraint, result: 'failed' }))
                : [{ rule: 'Recorded mandate evaluation', result: 'passed' }],
            source_state_version: syndication.updated_at || syndication.created_at || null,
            recorded_at: bid.submitted_at || bid.created_at || null
        }));

        res.json({
            syndication_id: req.params.id,
            receipts,
            disclosure: 'Receipts are derived from recorded workflow data. Missing rationale or policy inputs are shown explicitly.'
        });
    } catch (error) {
        console.error(`❌ Failed to build decision receipts for ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to build decision receipts' });
    }
});

// A local-demo approval gate. It records the human action separately from the
// allocation proposal, preserving an attributable before/after decision trail.
router.post('/syndications/:id/allocation-approval', async (req, res) => {
    const { approver, decision, reason = '' } = req.body || {};
    if (!approver || typeof approver !== 'string') {
        return res.status(400).json({ error: 'Bad Request', message: 'approver is required' });
    }
    if (!['approved', 'override', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Bad Request', message: 'decision must be approved, override, or rejected' });
    }
    if ((decision === 'override' || decision === 'rejected') && !reason.trim()) {
        return res.status(400).json({ error: 'Bad Request', message: 'A reason is required for an override or rejection' });
    }

    try {
        const db = getDB();
        const allocation = await db.collection('allocations').findOne({ syndication_id: req.params.id });
        if (!allocation) {
            return res.status(409).json({ error: 'Conflict', message: 'No proposed allocation is ready for approval' });
        }

        const approval = {
            syndication_id: req.params.id,
            allocation_id: allocation._id,
            approver,
            decision,
            reason: reason.trim() || null,
            previous_status: allocation.allocation_status || 'provisional',
            created_at: new Date()
        };
        const result = await db.collection('allocation_approvals').insertOne(approval);

        if (decision === 'approved') {
            await db.collection('allocations').updateOne(
                { _id: allocation._id },
                { $set: { allocation_status: 'approved', approved_at: approval.created_at, approved_by: approver } }
            );
        }

        await db.collection('syndication_events').insertOne({
            syndication_id: req.params.id,
            event_type: 'ALLOCATION_APPROVAL_RECORDED',
            timestamp: approval.created_at.toISOString(),
            data: { approver, decision, reason: approval.reason, allocation_id: allocation._id }
        });

        res.status(201).json({
            approval_id: result.insertedId,
            ...approval,
            allocation_status: decision === 'approved' ? 'approved' : approval.previous_status
        });
    } catch (error) {
        console.error(`❌ Failed to record allocation approval for ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to record allocation approval' });
    }
});

router.post('/syndications', async (req, res) => {
    try {
        const db = getDB();
        const body = req.body || {};

        if (body.role && !String(body.role).startsWith('originator:')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only originators can create syndications' });
        }

        const id = body.id || body.syndication_id || `SYND-${Date.now()}`;
        const now = new Date();

        if (!body.originator_agent_id) {
            return res.status(400).json({ error: 'Bad Request', message: 'originator_agent_id is required' });
        }

        const doc = {
            _id: id,
            syndication_id: id,
            borrower: body.borrower || 'Unknown Borrower',
            industry: body.industry || 'Unknown',
            originator: body.originator || 'Unknown',
            originator_agent_id: body.originator_agent_id,
            amount: Number(body.amount) || 0,
            rating: body.rating || 'NR',
            spread: Number(body.spread) || 400,
            status: body.status || 'open',
            phase: body.phase || 'open',
            round: body.round || 1,
            subscription: body.subscription || 0,
            createdAt: now,
            updatedAt: now,
            loan_details: body.loan_details || {
                borrower_name: body.borrower || 'Unknown Borrower',
                industry: body.industry || 'Unknown',
                credit_rating: body.rating || 'NR',
                total_amount: (Number(body.amount) || 0) * 1_000_000,
                syndication_target: (Number(body.amount) || 0) * 1_000_000,
                loan_type: body.loan_type || 'Term Loan B'
            },
            pricing: body.pricing || { base_rate: 'SOFR', initial_spread: Number(body.spread) || 400 },
            timeline: body.timeline || {
                broadcast_date: now.toISOString(),
                target_close_date: new Date(now.getTime() + 48 * 3600 * 1000).toISOString()
            }
        };

        await db.collection('syndication_original').insertOne(doc);
        res.status(201).json(doc);
    } catch (error) {
        console.error('❌ Failed to create syndication:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create syndication' });
    }
});

// Persist a lifecycle transition (client-driven progression).
// Whitelisted fields only — this is not a general document patch.
router.patch('/syndications/:id', async (req, res) => {
    try {
        const db = getDB();
        const allowed = ['status', 'phase', 'subscription', 'round'];
        const patch = { updatedAt: new Date() };
        for (const k of allowed) {
            if (req.body[k] !== undefined) patch[k] = req.body[k];
        }
        const result = await db.collection('syndication_original').updateOne(
            { _id: req.params.id },
            { $set: patch }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'Not Found', message: 'Syndication not found' });
        }
        res.json({ ok: true, id: req.params.id, ...patch });
    } catch (error) {
        console.error(`❌ Failed to patch syndication ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update syndication' });
    }
});

// Trigger a Python agent workflow for a syndication
router.post('/syndications/run', async (req, res) => {
    try {
        const { originator_id = 'OA-001', syndication_id, loan_params } = req.body;
        const result = await callAgentsService('/api/syndication/run', 'POST', {
            originator_id,
            syndication_id,
            loan_params
        });
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to run syndication:', error);
        res.status(500).json({ error: 'Failed to run syndication', message: error.message });
    }
});

router.post('/syndications/resume', async (req, res) => {
    try {
        const { syndication_id } = req.body;
        const result = await callAgentsService('/api/syndication/resume', 'POST', { syndication_id });
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to resume syndication:', error);
        res.status(500).json({ error: 'Failed to resume syndication', message: error.message });
    }
});

router.get('/syndications/:id/status', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/syndication/${req.params.id}`);
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to get syndication status:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

module.exports = router;
