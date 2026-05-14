const express = require('express');
const { callAgentsService } = require('../lib/agents-proxy');

const router = express.Router();

router.post('/orchestrator/reset', async (req, res) => {
    try {
        const result = await callAgentsService('/api/orchestrator/reset', 'POST', {});
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

module.exports = router;
