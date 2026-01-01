/**
 * Participant View Component (Analytics & Dashboard)
 * Handles advanced investment analysis, bidding intelligence, and portfolio impact.
 */
const ParticipantView = {
    // Default Investment Mandate (Mock Preferences)
    mandate: {
        minRating: 'BB-', // crude ordinal comparison needed
        maxRating: 'A',
        preferredSectors: ['Technology', 'Healthcare', 'Energy', 'Financial Services'],
        excludedSectors: ['Tobacco', 'Gambling'],
        preferredGeo: ['US', 'UK', 'EU'],
        minTicket: 10,
        maxTicket: 100,
        minESG: 70,
        targetYield: 6.5 // %
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
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Analyze a deal against the mandate and market data
     */
    analyzeDeal(deal) {
        // 1. Calculate Match Score
        let score = 100;
        const checks = {
            rating: true,
            sector: this.mandate.preferredSectors.includes(deal.industry),
            geo: this.mandate.preferredGeo.includes(deal.geography || 'US'),
            esg: (deal.esg_score || 0) >= this.mandate.minESG
        };

        if (!checks.sector) score -= 30;
        if (!checks.geo) score -= 20;
        if (!checks.esg) score -= 15;
        // Basic rating check (mock)
        if (deal.rating && deal.rating.startsWith('C')) {
            checks.rating = false;
            score -= 40;
        }

        // 2. Return Metrics
        const baseRate = 4.5; // SOFR mock
        const spreadPct = deal.spread / 10000;
        const allInYield = baseRate + (deal.spread / 100);

        // Mock market data
        const marketSpread = deal.spread + (Math.random() * 50 - 25); // +/- 25bps
        const premium = Math.round(deal.spread - marketSpread);

        // Expected Loss (mock based on rating)
        const expectedLoss = deal.rating?.startsWith('A') ? 0.1 : (deal.rating?.startsWith('B') ? 1.5 : 0.5);

        return {
            matchScore: Math.max(0, score),
            checks,
            returns: {
                allInYield,
                riskAdjusted: allInYield - expectedLoss,
                premium
            },
            market: {
                marketSpread: Math.round(marketSpread),
                fairValueSpread: Math.round(marketSpread - 5),
                trend: premium > 10 ? '⬇️ Tightening' : (premium < -10 ? '⬆️ Widening' : '➡️ Stable')
            }
        };
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
                        <!-- CSS-only Bar Chart -->
                        <div class="depth-bar" style="height: 40%" title="300-350 bps"></div>
                        <div class="depth-bar active" style="height: 75%" title="350-400 bps (You)"></div>
                        <div class="depth-bar" style="height: 55%" title="400-450 bps"></div>
                        <div class="depth-bar" style="height: 30%" title="450+ bps"></div>
                    </div>
                    <div class="depth-labels">
                        <span>Tight</span>
                        <span>Wide</span>
                    </div>
                </div>
            </div>
        `;
    },

    calculateAuctionDynamics(deal, myBid) {
        // Mock auction logic
        const totalBids = Math.floor(Math.random() * 15) + 5;
        const sub = Math.floor(Math.random() * 80) + 80; // 80-160%
        const clearing = deal.spread - 15; // Mock clearing inside

        return {
            status: myBid ? (myBid.spread <= clearing ? 'Winning' : 'Outbid') : 'Watching',
            totalBids,
            subscription: sub,
            coverRatio: (sub / 100).toFixed(2),
            clearingSpread: clearing,
            rank: {
                spread: Math.floor(Math.random() * 5) + 1,
                spreadGap: myBid ? myBid.spread - clearing : 0
            },
            fillProb: myBid ? (myBid.spread <= clearing ? 95 : 25) : 0
        };
    }
};

window.ParticipantView = ParticipantView;
