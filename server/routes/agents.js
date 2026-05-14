const express = require('express');
const { getDB } = require('../db');
const { callAgentsService, AGENTS_SERVICE_URL } = require('../lib/agents-proxy');

const router = express.Router();

router.get('/agents', async (req, res) => {
    try {
        const db = getDB();
        const [originator, participant, negotiation, settlement, payment] = await Promise.all([
            db.collection('originator').find({}).toArray(),
            db.collection('participants').find({}).toArray(),
            db.collection('negotiation_agents').find({}).toArray(),
            db.collection('settlement_agents').find({}).toArray(),
            db.collection('payment_agents').find({}).toArray()
        ]);
        res.json({ originator, participant, negotiation, settlement, payment });
    } catch (error) {
        console.error('❌ Failed to fetch agents summary:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch agents data' });
    }
});

router.get('/agents/participants', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/participants');
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

router.get('/agents/originators', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/originators');
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

router.post('/agents/bid', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/bid', 'POST', req.body);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

router.post('/agents/allocate', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/allocate', 'POST', req.body);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

router.get('/agents/health', async (req, res) => {
    try {
        const result = await callAgentsService('/api/health');
        res.json({ ...result, agents_service_url: AGENTS_SERVICE_URL });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            agents_service_url: AGENTS_SERVICE_URL,
            error: 'Agents service unavailable'
        });
    }
});

module.exports = router;
