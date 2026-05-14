const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/allocations/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const allocation = await db.collection('allocations').findOne({ syndId: req.params.syndId });
        res.json(allocation || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch allocation' });
    }
});

module.exports = router;
