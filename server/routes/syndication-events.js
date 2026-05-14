const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/syndication-events', async (req, res) => {
    try {
        const db = getDB();
        const { limit = 100, type } = req.query;
        const filter = type ? { event_type: { $regex: type, $options: 'i' } } : {};
        const events = await db.collection('syndication_events')
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .toArray();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch syndication events' });
    }
});

router.get('/syndication-events/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const events = await db.collection('syndication_events')
            .find({ syndication_id: req.params.syndId })
            .sort({ timestamp: 1 })
            .toArray();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch syndication events' });
    }
});

module.exports = router;
