/**
 * Originator View Component (Analytics & Dashboard)
 * Handles Lead Bank/Arranger metrics: Execution, Pricing, Fees, and Composition.
 * 
 * REFACTORED: Uses MetricsService for calculations where available.
 * Extracts calculation logic from rendering.
 */
const OriginatorView = {
    init() {
        console.log('🏦 Originator Analytics initialized');
    },

    /**
     * Render detailed Execution Metrics for a syndication
     */
    renderDealMetrics(deal) {
        const metrics = this.calculateMetrics(deal);

        return `
            <div class="deal-analysis-grid originator-grid">
                <!-- 1. Deal Execution Metrics -->
                <div class="analysis-card execution-card">
                    <div class="card-header-sm">
                        <span>🎯 Execution</span>
                        <span class="badg-sm ${metrics.subscriptionStatus}">
                            ${metrics.subscriptionRate}% Sub
                        </span>
                    </div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Oversubscription</span>
                            <span class="value ${this.getColor(metrics.oversubscriptionRatio, 1.1, 1.5)}">
                                ${metrics.oversubscriptionRatio}x
                            </span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Time to Full</span>
                            <span class="value">${metrics.timeToFull}h</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Allocated vs Target</span>
                            <span class="value">${metrics.allocationRate}%</span>
                        </div>
                    </div>
                </div>

                <!-- 2. Pricing Efficiency -->
                <div class="analysis-card pricing-card">
                    <div class="card-header-sm">💵 Pricing Efficiency</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Final Spread</span>
                            <span class="value">${deal.spread} bps</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Tightening</span>
                            <span class="value positive">-${metrics.tightening} bps</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Vs Benchmark (${deal.rating})</span>
                            <span class="value ${metrics.benchmarkDiff <= 0 ? 'positive' : 'negative'}">
                                ${metrics.benchmarkDiff > 0 ? '+' : ''}${metrics.benchmarkDiff} bps
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 3. Fee Revenue -->
                <div class="analysis-card fee-card">
                    <div class="card-header-sm">💰 Fee Economics</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Total Fee Pool</span>
                            <span class="value">${this._formatCurrency(metrics.fees.total)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Your Share (Lead)</span>
                            <span class="value highlight">${this._formatCurrency(metrics.fees.own)}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Return on Capital</span>
                            <span class="value">${metrics.fees.roe}%</span>
                        </div>
                        ${metrics.fees.roeIsEstimate ? `
                        <div class="metric-row disclaimer">
                            <small>⚠️ ROE is estimated, not audited</small>
                        </div>` : ''}
                    </div>
                </div>

                <!-- 4. Syndicate Composition -->
                <div class="analysis-card composition-card">
                    <div class="card-header-sm">👥 Composition</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Participants</span>
                            <span class="value">${metrics.participantCount} / ${metrics.targetParticipants}</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Diversity Score</span>
                            <span class="value">${metrics.diversityScore}/10</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">New Relationships</span>
                            <span class="value">${metrics.newRelationships}%</span>
                        </div>
                        ${metrics.isSimulated ? `
                        <div class="metric-row disclaimer">
                            <small>⚠️ Composition data is simulated</small>
                        </div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Format currency using MetricsService if available
     */
    _formatCurrency(dollars) {
        const MS = window.MetricsService;
        if (MS) {
            return MS.formatCurrency(dollars, true);
        }
        return `$${(dollars / 1000000).toFixed(2)}M`;
    },

    /**
     * Calculate metrics for a deal
     * Uses actual deal data when available, falls back to estimates
     */
    calculateMetrics(deal) {
        const MS = window.MetricsService;

        // Get actual amounts from deal
        const targetAmount = deal.loan_details?.syndication_target ||
            deal.syndicationTarget ||
            deal.amount ||
            100000000;

        // Try to get actual committed amount from deal
        const actualCommitted = deal.total_committed || deal.totalCommitted;
        const hasRealData = actualCommitted !== undefined;

        const currentAmount = actualCommitted ||
            (deal.status === 'closed' || deal.status === 'completed'
                ? targetAmount * 1.2
                : targetAmount * (deal.subscription_rate || deal.subscriptionRate || 0.4));

        // Calculate subscription rate using MetricsService
        const subRate = MS
            ? Math.round(MS.calculateSubscriptionRate(currentAmount, targetAmount) * 100)
            : Math.round((currentAmount / targetAmount) * 100);

        const oversub = (subRate / 100).toFixed(2);

        // Get spread benchmark using MetricsService rating lookup
        const spread = deal.spread || deal.current_spread || 400;
        const benchmark = this._getRatingBenchmark(deal.rating || deal.loan_details?.credit_rating);
        const benchmarkDiff = spread - benchmark;

        // Calculate tightening from initial to final spread
        const initialSpread = deal.pricing?.initial_spread || deal.priceTalk?.max || spread + 25;
        const tightening = Math.max(0, initialSpread - spread);

        // Fee calculations
        const feeRate = deal.pricing?.commitment_fee || 0.02;
        const totalFees = targetAmount * feeRate;
        const leadShare = 0.4; // Standard lead arranger share

        // Participant count from actual allocations if available
        const allocations = deal.allocations || [];
        const participantCount = allocations.length ||
            (deal.bids ? new Set(deal.bids.map(b => b.participant_agent_id || b.participantId)).size : 8);

        // Calculate diversity score (simple heuristic)
        const diversityScore = this._calculateDiversityScore(allocations);

        return {
            subscriptionRate: subRate,
            subscriptionStatus: subRate >= 100 ? 'status-success' : (subRate >= 80 ? 'status-warning' : 'status-danger'),
            oversubscriptionRatio: oversub,
            timeToFull: this._estimateTimeToFull(deal),
            allocationRate: Math.min(100, subRate),

            tightening,
            benchmarkDiff,

            fees: {
                total: totalFees,
                own: totalFees * leadShare,
                roe: this._estimateROE(totalFees * leadShare, targetAmount * 0.15), // Lead typically holds 15%
                roeIsEstimate: true
            },

            participantCount,
            targetParticipants: Math.ceil(targetAmount / 50000000) + 5, // Rough target
            diversityScore: diversityScore.toFixed(1),
            newRelationships: hasRealData ? this._calculateNewRelationships(allocations) : 25,
            isSimulated: !hasRealData
        };
    },

    /**
     * Get benchmark spread for a rating
     */
    _getRatingBenchmark(rating) {
        if (!rating) return 400;

        // Benchmark spreads by rating (these should ideally come from a market data service)
        const benchmarks = {
            'AAA': 150, 'AA+': 175, 'AA': 200, 'AA-': 225,
            'A+': 250, 'A': 275, 'A-': 300,
            'BBB+': 325, 'BBB': 350, 'BBB-': 375,
            'BB+': 400, 'BB': 425, 'BB-': 450,
            'B+': 475, 'B': 500, 'B-': 550
        };

        return benchmarks[rating] || 400;
    },

    /**
     * Estimate time to reach full subscription
     */
    _estimateTimeToFull(deal) {
        if (deal.completed_at && deal.created_at) {
            const hours = (new Date(deal.completed_at) - new Date(deal.created_at)) / (1000 * 60 * 60);
            return Math.round(hours);
        }
        // Default estimate based on deal size
        const sizeInMillions = (deal.amount || deal.loan_details?.syndication_target || 100000000) / 1000000;
        return Math.round(24 + sizeInMillions / 50 * 12); // Larger deals take longer
    },

    /**
     * Calculate diversity score based on participant types
     */
    _calculateDiversityScore(allocations) {
        if (!allocations || allocations.length === 0) return 7.5; // Default

        // Score based on unique participant types
        const types = new Set(allocations.map(a => a.institution_type || 'Unknown'));
        const typeScore = Math.min(10, types.size * 2);

        // Score based on concentration (Herfindahl-like)
        const totalAmount = allocations.reduce((sum, a) => sum + (a.final_allocation || 0), 0);
        if (totalAmount === 0) return typeScore;

        const hhi = allocations.reduce((sum, a) => {
            const share = (a.final_allocation || 0) / totalAmount;
            return sum + share * share;
        }, 0);

        const concentrationScore = Math.max(0, 10 - hhi * 20);

        return (typeScore + concentrationScore) / 2;
    },

    /**
     * Estimate ROE (simplified)
     */
    _estimateROE(feeRevenue, capitalDeployed) {
        if (capitalDeployed <= 0) return 0;
        // Annualized ROE assuming 90-day average hold
        const holdPeriod = 90 / 365;
        const roe = (feeRevenue / capitalDeployed) / holdPeriod * 100;
        return Math.round(roe * 10) / 10;
    },

    /**
     * Calculate percentage of new relationships
     */
    _calculateNewRelationships(allocations) {
        // This would normally check against historical relationship data
        // For now, estimate based on participant diversity
        if (!allocations || allocations.length === 0) return 0;

        // Assume 25% are typically new
        return 25;
    },

    getColor(val, warn, success) {
        if (val >= success) return 'text-success';
        if (val >= warn) return 'text-warning';
        return 'text-danger';
    }
};

window.OriginatorView = OriginatorView;
