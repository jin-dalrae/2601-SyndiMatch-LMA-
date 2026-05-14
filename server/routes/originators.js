const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/originators', async (req, res) => {
    try {
        const db = getDB();
        const originators = await db.collection('originator').find({}).toArray();
        res.json(originators);
    } catch (error) {
        console.error('❌ Failed to fetch originators:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch originators' });
    }
});

module.exports = router;
