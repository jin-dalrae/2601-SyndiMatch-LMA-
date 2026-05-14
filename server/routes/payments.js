const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/payments', async (req, res) => {
    try {
        const db = getDB();
        const payments = await db.collection('payment_history').find({}).sort({ time: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

router.get('/payments/summary/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const summary = await db.collection('payment_summaries').findOne({ syndId: req.params.syndId });
        res.json(summary || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payment summary' });
    }
});

module.exports = router;
