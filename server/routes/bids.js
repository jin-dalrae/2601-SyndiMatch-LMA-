const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/bids', async (req, res) => {
    try {
        const db = getDB();
        const { syndId } = req.query;
        const filter = syndId ? { syndId } : {};
        const bids = await db.collection('bids').find(filter).sort({ time: -1 }).toArray();
        res.json(bids);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

module.exports = router;
