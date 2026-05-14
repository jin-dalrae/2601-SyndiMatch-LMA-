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
