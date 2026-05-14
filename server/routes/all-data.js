const express = require('express');
const { getDB } = require('../db');
const { callAgentsService } = require('../lib/agents-proxy');

const router = express.Router();

router.get('/all-data', async (req, res) => {
    try {
        const db = getDB();

        const [dbSyndications, dbParticipants, dbOriginators] = await Promise.all([
            db.collection('syndication_original').find({}).sort({ createdAt: -1 }).limit(100).toArray(),
            db.collection('participants').find({}).toArray(),
            db.collection('originator').find({}).toArray()
        ]);

        let agentData = { syndications: [], participants: [], originators: [], agents: {} };
        try {
            agentData = await callAgentsService('/api/all-data', 'GET');
        } catch (e) {
            console.warn('⚠️ Agents service unavailable for all-data, using DB only');
        }

        // Merge: prefer agent live status, ensure all DB records present.
        // Match on _id (string from Mongo) vs id (from agent service).
        const mergedSyndications = [...dbSyndications];
        if (agentData.syndications && agentData.syndications.length > 0) {
            agentData.syndications.forEach(as => {
                const found = mergedSyndications.find(s => s._id === as.id || s.syndication_id === as.id);
                if (found) {
                    found.status = as.status || found.status;
                    found.phase = as.phase || found.phase;
                    found.subscription = as.subscription || found.subscription;
                }
                // Note: previously we'd append unmatched agent syndications. Removed —
                // it caused duplicates because agent service reads the same collection.
            });
        }

        res.json({
            syndications: mergedSyndications,
            participants: dbParticipants.length > 0 ? dbParticipants : (agentData.participants || []),
            originators: dbOriginators.length > 0 ? dbOriginators : (agentData.originators || []),
            agents: agentData.agents || {},
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Failed to construct all-data:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to aggregate data' });
    }
});

module.exports = router;
