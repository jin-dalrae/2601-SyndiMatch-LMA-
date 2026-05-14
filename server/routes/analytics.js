// Real-time analytics rollups for the dashboard KPI tiles.
// Frontend polls /api/analytics/{platform|originator|participant} every 10s
// and falls back to client-side calc if this 404s. Returning real data here
// silences the polling noise and improves the dashboard numbers.

const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

const FEE_PCT = 0.005; // platform fee for dashboard rollup

async function platformMetrics(db) {
    const [syndications, participants] = await Promise.all([
        db.collection('syndication_original').find({}).toArray(),
        db.collection('participants').find({}, { projection: { _id: 1 } }).toArray()
    ]);

    const totalVolume = syndications.reduce((sum, s) => sum + ((s.amount || 0) * 1_000_000), 0);
    const activeCount = syndications.filter(s => s.status === 'open' || s.status === 'negotiating').length;
    const completed = syndications.filter(s => s.status === 'completed').length;
    const successRate = syndications.length > 0
        ? (completed / syndications.length) * 100
        : 0;
    const avgSpread = syndications.length > 0
        ? syndications.reduce((sum, s) => sum + (s.spread || 0), 0) / syndications.length
        : 0;

    return {
        totalVolume,
        activeCount,
        avgDealSize: syndications.length ? totalVolume / syndications.length : 0,
        participantCount: participants.length,
        platformFees: totalVolume * FEE_PCT,
        successRate,
        avgSpread,
        dealCount: syndications.length
    };
}

async function originatorMetrics(db, originatorId) {
    const filter = originatorId ? { originator_agent_id: originatorId } : {};
    const syndications = await db.collection('syndication_original').find(filter).toArray();

    const totalVolume = syndications.reduce((sum, s) => sum + ((s.amount || 0) * 1_000_000), 0);
    const activeCount = syndications.filter(s => s.status === 'open' || s.status === 'negotiating').length;
    const completed = syndications.filter(s => s.status === 'completed').length;
    const avgSub = syndications.length > 0
        ? syndications.reduce((sum, s) => sum + (s.subscription || 0), 0) / syndications.length
        : 0;

    return {
        totalVolume,
        activeCount,
        completedDeals: completed,
        avgSubscription: avgSub,
        feesEarned: totalVolume * FEE_PCT,
        avgSpread: syndications.length > 0
            ? syndications.reduce((sum, s) => sum + (s.spread || 0), 0) / syndications.length
            : 0,
        dealCount: syndications.length
    };
}

async function participantMetrics(db, participantId) {
    const bidFilter = participantId
        ? { participant_agent_id: participantId, bid_status: 'active' }
        : { bid_status: 'active' };
    const bids = await db.collection('bids').find(bidFilter).toArray();

    const totalExposure = bids.reduce((sum, b) => sum + (b.bid_amount || 0), 0);
    const avgSpread = bids.length > 0
        ? bids.reduce((sum, b) => sum + (b.spread_bid || 0), 0) / bids.length
        : 0;

    return {
        activeBids: bids.length,
        totalCommitted: totalExposure,
        avgYield: avgSpread / 100, // bps to %
        avgSpread,
        portfolioCount: new Set(bids.map(b => b.syndication_id)).size
    };
}

router.get('/analytics/:role', async (req, res) => {
    try {
        const db = getDB();
        const { role } = req.params;
        const { id } = req.query;

        let metrics;
        if (role === 'platform') metrics = await platformMetrics(db);
        else if (role === 'originator') metrics = await originatorMetrics(db, id);
        else if (role === 'participant') metrics = await participantMetrics(db, id);
        else return res.status(400).json({ error: 'Bad Request', message: `Unknown role: ${role}` });

        res.json({ ...metrics, role, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('❌ Analytics failed:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to compute analytics' });
    }
});

module.exports = router;
