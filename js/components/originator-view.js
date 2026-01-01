/**
 * Originator View Component (Analytics & Dashboard)
 * Handles Lead Bank/Arranger metrics: Execution, Pricing, Fees, and Composition.
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
                            <span class="label">Vs Rating (${deal.rating})</span>
                            <span class="value">${metrics.benchmarkDiff > 0 ? '+' : ''}${metrics.benchmarkDiff} bps</span>
                        </div>
                    </div>
                </div>

                <!-- 3. Fee Revenue -->
                <div class="analysis-card fee-card">
                    <div class="card-header-sm">💰 Fee Economics</div>
                    <div class="metrics-list">
                        <div class="metric-row">
                            <span class="label">Total Fee Pool</span>
                            <span class="value">$${(metrics.fees.total / 1000000).toFixed(2)}M</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Your Share (Lead)</span>
                            <span class="value highlight">$${(metrics.fees.own / 1000000).toFixed(2)}M</span>
                        </div>
                        <div class="metric-row">
                            <span class="label">Return on Capital</span>
                            <span class="value">${metrics.fees.roe}%</span>
                        </div>
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
                    </div>
                </div>
            </div>
        `;
    },

    calculateMetrics(deal) {
        // Mock calculations based on deal state
        const targetAmount = deal.amount || 100;
        const currentAmount = deal.currentSubscription || (deal.status === 'closed' ? targetAmount * 1.2 : targetAmount * 0.4);

        const subRate = Math.round((currentAmount / targetAmount) * 100);
        const oversub = (subRate / 100).toFixed(2);

        // Benchmarks (BBB = 400bps)
        const benchmark = deal.rating === 'BBB' ? 400 : (deal.rating === 'BB' ? 450 : 350);
        const spread = deal.spread || 400;

        // Fees (2% total pool, Lead keeps 40%)
        const totalFees = deal.amount * 1000000 * 0.02;

        return {
            subscriptionRate: subRate,
            subscriptionStatus: subRate >= 100 ? 'status-success' : (subRate >= 80 ? 'status-warning' : 'status-danger'),
            oversubscriptionRatio: oversub,
            timeToFull: 36, // Mock hours
            allocationRate: Math.min(100, subRate),

            tightening: 25, // Mock bps
            benchmarkDiff: spread - benchmark,

            fees: {
                total: totalFees,
                own: totalFees * 0.4,
                roe: 18.5 // Mock %
            },

            participantCount: 8,
            targetParticipants: 12,
            diversityScore: 8.5,
            newRelationships: 25 // %
        };
    },

    getColor(val, warn, success) {
        if (val >= success) return 'text-success';
        if (val >= warn) return 'text-warning';
        return 'text-danger';
    }
};

window.OriginatorView = OriginatorView;
