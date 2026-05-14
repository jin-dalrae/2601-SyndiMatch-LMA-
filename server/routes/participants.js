const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/participants', async (req, res) => {
    try {
        const db = getDB();
        const participants = await db.collection('participants').find({}).toArray();
        res.json(participants);
    } catch (error) {
        console.error('❌ Failed to fetch participants:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch participants' });
    }
});

router.get('/participants/:participantId/portfolio', async (req, res) => {
    try {
        const db = getDB();
        const { participantId } = req.params;

        const bids = await db.collection('bids')
            .find({ participant_agent_id: participantId, bid_status: 'active' })
            .toArray();

        const syndIds = [...new Set(bids.map(b => b.syndication_id))];
        const syndications = await db.collection('syndications')
            .find({ id: { $in: syndIds } })
            .toArray();

        let totalExposure = 0;
        let totalSpreadWeighted = 0;
        const holdings = [];
        const sectorMap = {};
        const ratingMap = {};
        const geoMap = {};
        let esgTotal = 0;
        let esgCount = 0;

        for (const bid of bids) {
            const synd = syndications.find(s => s.id === bid.syndication_id);
            if (!synd) continue;

            const amount = bid.bid_amount / 1000000;
            totalExposure += amount;
            totalSpreadWeighted += amount * bid.spread_bid;

            // ESG score simulated — would come from real data
            const esgScore = 50 + Math.floor(Math.random() * 40);
            esgTotal += esgScore;
            esgCount++;

            const geography = synd.industry?.includes('Tech') ? 'North America' :
                synd.industry?.includes('Energy') ? 'North America' :
                    synd.industry?.includes('Healthcare') ? 'Europe' : 'North America';

            holdings.push({
                _id: bid._id,
                id: synd.id,
                borrower: synd.borrower,
                borrower_name: synd.borrower,
                industry: synd.industry,
                rating: synd.rating,
                credit_rating: synd.rating,
                esg: esgScore,
                esg_score: esgScore,
                amount,
                final_allocation: bid.bid_amount,
                spread: bid.spread_bid,
                final_spread: bid.spread_bid,
                tenor: '5Y',
                geography
            });

            sectorMap[synd.industry] = (sectorMap[synd.industry] || 0) + amount;
            ratingMap[synd.rating] = (ratingMap[synd.rating] || 0) + amount;
            geoMap[geography] = (geoMap[geography] || 0) + amount;
        }

        const sectors = Object.entries(sectorMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));
        const ratings = Object.entries(ratingMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));
        const geography = Object.entries(geoMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));

        const avgEsg = esgCount > 0 ? Math.round(esgTotal / esgCount) : 70;
        const esgHigh = holdings.filter(h => h.esg >= 75).length;
        const esgMed = holdings.filter(h => h.esg >= 50 && h.esg < 75).length;
        const esgLow = holdings.filter(h => h.esg < 50).length;
        const totalHoldings = holdings.length;

        res.json({
            total_exposure: totalExposure * 1000000,
            available_capacity: 500000000,
            utilization: Math.round((totalExposure * 1000000 / 500000000) * 100),
            deal_count: holdings.length,
            weighted_yield: 8.5,
            weighted_spread: totalExposure > 0 ? totalSpreadWeighted / totalExposure : 400,
            roi_ytd: 10.0 + Math.random() * 5,
            interest_ytd: totalExposure * 1000000 * 0.085 * 0.5,
            avg_esg: avgEsg,
            esg_high_pct: totalHoldings > 0 ? Math.round((esgHigh / totalHoldings) * 100) : 0,
            esg_med_pct: totalHoldings > 0 ? Math.round((esgMed / totalHoldings) * 100) : 0,
            esg_low_pct: totalHoldings > 0 ? Math.round((esgLow / totalHoldings) * 100) : 0,
            geography,
            sectors,
            ratings,
            holdings
        });
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

module.exports = router;
