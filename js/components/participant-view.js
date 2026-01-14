/**
 * Participant View Component (Analytics & Dashboard)
 * Handles advanced investment analysis, bidding intelligence, and portfolio impact.
 * 
 * REFACTORED: Uses MetricsService for calculations, MarketDataProvider for data.
 * This view only renders - it does not compute business logic.
 */
const ParticipantView = {
    // Default Investment Mandate
    mandate: {
        minRating: 'BB-',
        maxRating: 'A',
        preferredSectors: ['Technology', 'Healthcare', 'Energy', 'Financial Services'],
        excludedSectors: ['Tobacco', 'Gambling'],
        preferredGeo: ['US', 'UK', 'EU'],
        minTicket: 10,
        maxTicket: 100,
        minESG: 70,
        targetYield: 6.5
    },

    init() {
        console.log('📊 Participant Analytics initialized');
    },

    /**
     * Render the detailed Deal Analysis card for a syndication
     */
    renderDealAnalysis(deal) {
        const analysis = this.analyzeDeal(deal);

        return `
            <div class="deal-analysis-grid">
                <!-- 1. Deal Screening Metrics -->
                <div class="analysis-card screening-card">
                    <div class="card-header-sm">
                        <span>🔍 Deal Screening</span>
                        <span class="match-score ${this.getScoreClass(analysis.matchScore)}">
                            Match: ${analysis.matchScore}/100
                        </span>
                    </div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Credit Rating (${deal.rating})</span>
                            <span class="value">${analysis.checks.rating ? '✅' : '❌'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Sector (${deal.industry})</span>
                            <span class="value">${analysis.checks.sector ? '✅' : '❌'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Geography (${deal.geography || 'US'})</span>
                            <span class="value">${analysis.checks.geo ? '✅' : '❌'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">ESG Score (${deal.esg_score || deal.esgScore || '-'})</span>
                            <span class="value">${analysis.checks.esg ? '✅' : '⚠️'}</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Risk-Adjusted Return -->
                <div class="analysis-card return-card">
                    <div class="card-header-sm">📈 Risk-Adjusted Return</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">All-In Yield</span>
                            <span class="value highlight">${analysis.returns.allInYield.toFixed(2)}%</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Spread Premium</span>
                            <span class="value ${analysis.returns.premium >= 0 ? 'positive' : 'negative'}">
                                ${analysis.returns.premium > 0 ? '+' : ''}${analysis.returns.premium} bps
                            </span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Risk-Adj. Return</span>
                            <span class="value">${analysis.returns.riskAdjusted.toFixed(2)}%</span>
                        </div>
                        <div class="metric-row disclaimer">
                            <small>⚠️ Risk adjustment is heuristic, not PD/LGD-based</small>
                        </div>
                    </div>
                </div>

                <!-- 3. Competitive Position -->
                <div class="analysis-card competition-card">
                    <div class="card-header-sm">📊 Competitive Position</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Market Spread</span>
                            <span class="value">${analysis.market.marketSpread} bps</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Fair Value</span>
                            <span class="value">${analysis.market.fairValueSpread} bps</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Trend</span>
                            <span class="value">${analysis.market.trend}</span>
                        </div>
                        ${analysis.market.isSimulated ? `
                        <div class="metric-row disclaimer">
                            <small>⚠️ Market data is simulated</small>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Analyze a deal against the mandate and market data
     * Uses MetricsService for calculations
     */
    analyzeDeal(deal) {
        const MS = window.MetricsService;
        const MDP = window.MarketDataProvider;

        // 1. Calculate Match Score
        let score = 100;
        const checks = {
            rating: this._checkRating(deal.rating),
            sector: this.mandate.preferredSectors.includes(deal.industry) &&
                !this.mandate.excludedSectors.includes(deal.industry),
            geo: this.mandate.preferredGeo.includes(deal.geography || 'US'),
            esg: (deal.esg_score || deal.esgScore || 0) >= this.mandate.minESG
        };

        if (!checks.rating) score -= 40;
        if (!checks.sector) score -= 30;
        if (!checks.geo) score -= 20;
        if (!checks.esg) score -= 15;

        // 2. Return Metrics - USE METRICSSERVICE
        const baseRate = deal.pricing?.base_rate || 'SOFR';
        const allInYield = MS ? MS.calculateAllInYield(baseRate, deal.spread) : 4.5 + deal.spread / 100;

        // Get market data from provider (consistent within session)
        const marketData = MDP ? MDP.getSpreadHeatmapData() : null;
        const isSimulated = MDP ? MDP.isMockMode() : true;

        // Market spread - deterministic based on rating/sector, not random
        const marketSpread = this._estimateMarketSpread(deal, marketData);
        const premium = Math.round(deal.spread - marketSpread);

        // Expected Loss - USE METRICSSERVICE
        const expectedLoss = MS ? MS.getRatingExpectedLoss(deal.rating) : 0.5;
        const riskAdjusted = MS ?
            MS.calculateHeuristicRiskAdjustedYield(allInYield, deal.rating) :
            allInYield - expectedLoss;

        return {
            matchScore: Math.max(0, score),
            checks,
            returns: {
                allInYield,
                riskAdjusted,
                premium
            },
            market: {
                marketSpread: Math.round(marketSpread),
                fairValueSpread: Math.round(marketSpread - 5),
                trend: premium > 10 ? '⬇️ Tightening' : (premium < -10 ? '⬆️ Widening' : '➡️ Stable'),
                isSimulated
            }
        };
    },

    /**
     * Check if rating is within mandate using proper rating scale
     */
    _checkRating(rating) {
        if (!rating) return false;

        const MS = window.MetricsService;
        if (!MS) {
            // Fallback: reject C and D ratings
            return !rating.toUpperCase().startsWith('C') && !rating.toUpperCase().startsWith('D');
        }

        const ratingValue = MS.ratingToNumeric(rating);
        const minValue = MS.ratingToNumeric(this.mandate.minRating);
        const maxValue = MS.ratingToNumeric(this.mandate.maxRating);

        return ratingValue >= minValue && ratingValue <= maxValue;
    },

    /**
     * Estimate market spread based on rating and sector
     * Deterministic - no Math.random()
     */
    _estimateMarketSpread(deal, marketData) {
        // Base spread by rating (deterministic)
        const ratingBaseSpread = {
            'AAA': 150, 'AA+': 175, 'AA': 200, 'AA-': 225,
            'A+': 250, 'A': 275, 'A-': 300,
            'BBB+': 325, 'BBB': 350, 'BBB-': 375,
            'BB+': 400, 'BB': 425, 'BB-': 450,
            'B+': 475, 'B': 500, 'B-': 525
        };

        const baseSpread = ratingBaseSpread[deal.rating] || 400;

        // Sector adjustment (deterministic based on sector name hash)
        const sectorAdjustments = {
            'Technology': -10,
            'Healthcare': -5,
            'Energy': +15,
            'Real Estate': +10,
            'Financial Services': 0,
            'Industrial': +5,
            'Consumer': 0
        };

        const sectorAdj = sectorAdjustments[deal.industry] || 0;

        return baseSpread + sectorAdj;
    },

    getScoreClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 50) return 'score-med';
        return 'score-low';
    },

    /**
     * Render Bidding Intelligence (Auction Room)
     */
    renderBiddingIntelligence(deal, myBid) {
        const intel = this.calculateAuctionDynamics(deal, myBid);

        return `
            <div class="auction-intel-grid">
                <!-- 1. Auction Status -->
                <div class="intel-card status-card">
                    <div class="card-header-sm">
                        <span>📈 Auction Dynamics</span>
                        <span class="badg-sm ${intel.status === 'Winning' ? 'status-success' : 'status-warning'}">
                            ${intel.status}
                        </span>
                    </div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Total Bids</span>
                            <span class="value">${intel.totalBids}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Subscription</span>
                            <span class="value">${intel.subscription}% (${intel.coverRatio}x)</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Clearing Spread</span>
                            <span class="value highlight">${intel.clearingSpread} bps</span>
                        </div>
                    </div>
                    ${intel.isSimulated ? `<div class="disclaimer-row"><small>⚠️ Simulated data</small></div>` : ''}
                </div>

                <!-- 2. Your Rank -->
                <div class="intel-card rank-card">
                    <div class="card-header-sm">🏆 Your Position</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Rank by Spread</span>
                            <span class="value">#${intel.rank.spread} of ${intel.totalBids}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Spread Gap</span>
                            <span class="value ${intel.rank.spreadGap < 0 ? 'text-success' : 'text-danger'}">
                                ${intel.rank.spreadGap} bps
                            </span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Fill Probability</span>
                            <span class="value strength-${Math.floor(intel.fillProb / 20)}">${intel.fillProb}%</span>
                        </div>
                    </div>
                </div>

                <!-- 3. Market Depth -->
                <div class="intel-card depth-card">
                    <div class="card-header-sm">🌊 Market Depth</div>
                    <div class="depth-chart-mini">
                        ${this._renderDepthBars(intel.depthData, myBid)}
                    </div>
                    <div class="depth-labels">
                        <span>Tight</span>
                        <span>Wide</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render depth bars for market depth visualization
     */
    _renderDepthBars(depthData, myBid) {
        if (!depthData || depthData.length === 0) {
            // Fallback static bars
            return `
                <div class="depth-bar" style="height: 40%" title="300-350 bps"></div>
                <div class="depth-bar active" style="height: 75%" title="350-400 bps (You)"></div>
                <div class="depth-bar" style="height: 55%" title="400-450 bps"></div>
                <div class="depth-bar" style="height: 30%" title="450+ bps"></div>
            `;
        }

        return depthData.map(d =>
            `<div class="depth-bar${d.isActive ? ' active' : ''}" 
                  style="height: ${d.height}%" 
                  title="${d.label}"></div>`
        ).join('');
    },

    /**
     * Calculate auction dynamics from actual data when available
     */
    calculateAuctionDynamics(deal, myBid) {
        const MDP = window.MarketDataProvider;
        const MS = window.MetricsService;
        const isSimulated = MDP ? MDP.isMockMode() : true;

        // Try to get actual data from deal
        const bids = deal.bids || [];
        const hasRealData = bids.length > 0;

        let totalBids, subscription, clearingSpread, rank, fillProb;

        if (hasRealData) {
            // Use actual bid data
            totalBids = bids.length;

            // Calculate subscription from actual bids
            const totalBidAmount = bids.reduce((sum, b) => sum + (b.bid_amount || b.amount || 0), 0);
            const target = deal.loan_details?.syndication_target || deal.syndicationTarget || deal.amount || 1;
            subscription = MS ? Math.round(MS.calculateSubscriptionRate(totalBidAmount, target) * 100) : 100;

            // Calculate clearing spread from actual bids
            const spreadStats = MS ? MS.calculateSpreadStats(bids) : { median: deal.spread };
            clearingSpread = Math.round(spreadStats.median);

            // Calculate my rank
            if (myBid) {
                const sortedBids = [...bids].sort((a, b) =>
                    (a.spread_bid || a.spread) - (b.spread_bid || b.spread)
                );
                const myIndex = sortedBids.findIndex(b =>
                    b.participant_agent_id === myBid.participant_agent_id ||
                    b.participantId === myBid.participantId
                );
                rank = {
                    spread: myIndex >= 0 ? myIndex + 1 : totalBids,
                    spreadGap: (myBid.spread_bid || myBid.spread) - clearingSpread
                };

                // Fill probability based on subscription and rank
                if (subscription <= 100) {
                    fillProb = 95; // Under-subscribed, everyone gets filled
                } else {
                    // Over-subscribed: probability decreases with rank
                    fillProb = Math.max(10, 100 - (rank.spread / totalBids) * 100);
                }
            } else {
                rank = { spread: 0, spreadGap: 0 };
                fillProb = 0;
            }
        } else {
            // Use simulated data from MarketDataProvider (session-consistent)
            const simData = MDP ? MDP.getSimulatedAuctionData(deal) : null;

            totalBids = simData?.rounds ? simData.rounds * 3 + 5 : 8;
            subscription = simData?.finalSubscription || 105;
            clearingSpread = deal.spread - 15;

            rank = {
                spread: myBid ? Math.min(3, totalBids) : 0,
                spreadGap: myBid ? (myBid.spread || 0) - clearingSpread : 0
            };
            fillProb = myBid ? (rank.spreadGap <= 0 ? 85 : 35) : 0;
        }

        return {
            status: myBid ? (myBid.spread <= clearingSpread ? 'Winning' : 'Outbid') : 'Watching',
            totalBids,
            subscription,
            coverRatio: (subscription / 100).toFixed(2),
            clearingSpread,
            rank,
            fillProb: Math.round(fillProb),
            isSimulated: !hasRealData,
            depthData: this._calculateDepthData(bids, clearingSpread, myBid)
        };
    },

    /**
     * Calculate depth data for visualization
     */
    _calculateDepthData(bids, clearingSpread, myBid) {
        if (!bids || bids.length === 0) return null;

        // Group bids into buckets
        const buckets = [
            { min: 0, max: 350, count: 0, label: '<350 bps' },
            { min: 350, max: 400, count: 0, label: '350-400 bps' },
            { min: 400, max: 450, count: 0, label: '400-450 bps' },
            { min: 450, max: 9999, count: 0, label: '450+ bps' }
        ];

        bids.forEach(b => {
            const spread = b.spread_bid || b.spread || 0;
            const bucket = buckets.find(bkt => spread >= bkt.min && spread < bkt.max);
            if (bucket) bucket.count++;
        });

        const maxCount = Math.max(...buckets.map(b => b.count), 1);
        const mySpread = myBid ? (myBid.spread_bid || myBid.spread) : null;

        return buckets.map(b => ({
            height: (b.count / maxCount) * 100,
            label: b.label,
            isActive: mySpread && mySpread >= b.min && mySpread < b.max
        }));
    }
};

window.ParticipantView = ParticipantView;
