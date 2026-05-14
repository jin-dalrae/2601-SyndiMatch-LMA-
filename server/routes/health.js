const express = require('express');
const { pingDB } = require('../db');

const router = express.Router();

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/ready', async (req, res) => {
    try {
        await pingDB();
        res.json({ status: 'ready' });
    } catch (error) {
        res.status(503).json({ status: 'not_ready', error: 'Database not reachable' });
    }
});

module.exports = router;
