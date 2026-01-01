// ========================================
// Analytics Component - Platform Admin Dashboard
// Real-time KPIs for syndication platform monitoring
// ========================================

const AnalyticsComponent = {
    refreshInterval: null,
    lastUpdate: null,

    init() {
        this.injectStyles();
        this.render();
        this.startAutoRefresh();

        // Listen for role changes to switch dashboard views
        window.addEventListener('roleChange', () => {
            this.stopAutoRefresh();
            this.render();
            this.startAutoRefresh();
        });
    },

    startAutoRefresh() {
        // Auto-refresh every 10 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshMetrics();
        }, 10000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    async refreshMetrics() {
        const liveIndicator = document.querySelector('.analytics-live-indicator');
        const timeEl = document.querySelector('.analytics-last-updated');

        if (liveIndicator) liveIndicator.classList.add('pulse');

        try {
            // Try to fetch from API, fall back to local calculation
            const metrics = await this.fetchMetricsFromAPI();
            this.updateDashboardValues(metrics);

            this.lastUpdate = new Date();
            if (timeEl) timeEl.textContent = `Last updated: ${this.lastUpdate.toLocaleTimeString()}`;
        } catch (e) {
            console.log('Metrics refresh using local data');
        }

        setTimeout(() => {
            if (liveIndicator) liveIndicator.classList.remove('pulse');
        }, 500);
    },

    async fetchMetricsFromAPI() {
        try {
            const response = await fetch('/api/analytics/platform');
            if (response.ok) {
                const data = await response.json();
                return this.transformAPIMetrics(data);
            }
        } catch (e) {
            // API not available
        }
        return this.calculateMetrics();
    },

    transformAPIMetrics(data) {
        // Transform API response to match our metrics format
        return {
            totalVolume: data.total_volume || 0,
            activeSyndicationCount: data.active_syndications || 0,
            completedCount: data.completed_syndications || 0,
            avgDealSize: data.avg_deal_size || 0,
            participantCount: data.participant_count || 0,
            platformFees: data.platform_fees || 0,
            avgFeeRate: data.avg_fee_rate || 0.5,
            feePerDeal: data.fee_per_deal || 0,
            avgTimeToClose: data.avg_time_to_close || 3.2,
            auctionSuccessRate: data.auction_success_rate || 90,
            avgOversubscription: data.avg_oversubscription || 1.15,
            paymentSettlementRate: data.payment_settlement_rate || 98.5,
            fullSubscriptionRate: data.full_subscription_rate || 85,
            avgFillRate: data.avg_fill_rate || 85,
            avgParticipantsPerDeal: data.avg_participants_per_deal || 8,
            maxConcentration: data.max_concentration || 35,
            avgSpread: data.avg_spread || 400,
            igSpread: data.ig_spread || 285,
            crossoverSpread: data.crossover_spread || 395,
            hySpread: data.hy_spread || 520,
            spreadCompression: data.spread_compression || 25,
            ...data
        };
    },

    updateDashboardValues(m) {
        // Update KPI values without re-rendering entire dashboard
        const updates = {
            'kpi-total-volume': this.formatCurrency(m.totalVolume),
            'kpi-active-count': m.activeSyndicationCount,
            'kpi-avg-deal': this.formatCurrency(m.avgDealSize),
            'kpi-participants': m.participantCount,
            'kpi-platform-fees': this.formatCurrency(m.platformFees),
            'kpi-success-rate': `${m.auctionSuccessRate.toFixed(1)}%`,
            'kpi-avg-spread': `${m.avgSpread.toFixed(0)} bps`
        };

        Object.entries(updates).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    },

    /**
     * Calculate platform metrics from SyndiData
     */
    calculateMetrics() {

        const syndications = SyndiData.syndications || [];
        const participants = SyndiData.participants || [];
        const bids = SyndiData.bids || [];

        // Basic counts
        const activeSyndications = syndications.filter(s => s.status !== 'completed' && s.status !== 'failed');
        const completedSyndications = syndications.filter(s => s.status === 'completed');

        // Volume calculations
        const totalVolume = syndications.reduce((sum, s) => {
            const amount = s.loan_details ? s.loan_details.total_amount : (s.amount * 1000000);
            return sum + (amount || 0);
        }, 0);

        const avgDealSize = syndications.length > 0 ? totalVolume / syndications.length : 0;

        // Subscription metrics
        const avgSubscription = syndications.length > 0
            ? syndications.reduce((sum, s) => sum + (s.subscription || 0), 0) / syndications.length
            : 0;

        // Spread analysis
        const spreads = syndications.map(s => s.spread || 0).filter(s => s > 0);
        const avgSpread = spreads.length > 0 ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0;

        // Bid stats
        const successfulBids = bids.filter(b => b.action === 'BID' || b.bid_status === 'active');
        const passedBids = bids.filter(b => b.action === 'PASS');

        return {
            // Platform Volume
            totalVolume,
            activeSyndicationCount: activeSyndications.length,
            completedCount: completedSyndications.length,
            avgDealSize,
            participantCount: participants.length,

            // Revenue (simulated based on 0.5% platform fee)
            platformFees: totalVolume * 0.005,
            avgFeeRate: 0.50,
            feePerDeal: syndications.length > 0 ? (totalVolume * 0.005) / syndications.length : 0,

            // Efficiency
            avgTimeToClose: 3.2, // simulated
            auctionSuccessRate: completedSyndications.length / Math.max(syndications.length, 1) * 100,
            avgOversubscription: avgSubscription > 100 ? avgSubscription / 100 : 1.0,
            paymentSettlementRate: 98.5, // simulated

            // Risk
            fullSubscriptionRate: syndications.filter(s => (s.subscription || 0) >= 100).length / Math.max(syndications.length, 1) * 100,
            avgFillRate: avgSubscription,
            avgParticipantsPerDeal: bids.length > 0 && syndications.length > 0 ? bids.length / syndications.length : 0,
            maxConcentration: 35, // simulated

            // Spread Analysis
            avgSpread,
            igSpread: 285,
            crossoverSpread: 395,
            hySpread: 520,
            spreadCompression: 25,

            // Win rates by type
            bankWinRate: 72,
            privateCreditWinRate: 45,
            cloWinRate: 38,
            institutionalWinRate: 55,

            // Tech
            apiResponseTime: 145,
            blockchainConfirmTime: 8,
            agentDecisionLatency: 2.3,
            systemUptime: 99.97,
            agentAccuracy: 94.2,
            auctionOptScore: 1.12,
            falsePositiveRate: 2.1
        };
    },

    render() {
        const container = document.getElementById('analytics-container') || document.getElementById('view-analytics');
        if (!container) return;

        // Detect user role and render appropriate dashboard
        const isOriginator = document.body.classList.contains('role-originator');
        const isParticipant = document.body.classList.contains('role-participant');

        if (isOriginator) {
            this.renderOriginatorDashboard(container);
        } else if (isParticipant) {
            this.renderParticipantDashboard(container);
        } else {
            this.renderAdminDashboard(container);
        }
    },

    renderAdminDashboard(container) {
        const m = this.calculateMetrics();

        container.innerHTML = `
            <div class="analytics-dashboard">
                <div class="analytics-header">
                    <div class="analytics-title-row">
                        <h2>📊 Platform Analytics Dashboard</h2>
                        <div class="analytics-controls">
                            <button class="btn-refresh" onclick="AnalyticsComponent.refreshMetrics()">🔄 Refresh</button>
                            <span class="analytics-live-indicator">● LIVE</span>
                        </div>
                    </div>
                    <div class="analytics-subtitle-row">
                        <span class="analytics-subtitle">Platform Operator View • Real-time KPIs</span>
                        <span class="analytics-last-updated">Last updated: ${new Date().toLocaleTimeString()}</span>
                    </div>
                </div>

                <!-- Section 1: Platform Health Metrics -->
                <div class="analytics-section">
                    <h3>📊 Platform Volume Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card primary">
                            <div class="kpi-label">Total Syndication Volume (YTD)</div>
                            <div class="kpi-value" id="kpi-total-volume">${this.formatCurrency(m.totalVolume)}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Active Syndications</div>
                            <div class="kpi-value" id="kpi-active-count">${m.activeSyndicationCount}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Average Deal Size</div>
                            <div class="kpi-value" id="kpi-avg-deal">${this.formatCurrency(m.avgDealSize)}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Total Participants</div>
                            <div class="kpi-value" id="kpi-participants">${m.participantCount}</div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Revenue Metrics -->
                <div class="analytics-section">
                    <h3>💰 Revenue Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card success">
                            <div class="kpi-label">Platform Fees Collected</div>
                            <div class="kpi-value" id="kpi-platform-fees">${this.formatCurrency(m.platformFees)}</div>

                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Average Fee Rate</div>
                            <div class="kpi-value">${m.avgFeeRate.toFixed(2)}%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Fee Revenue per Deal</div>
                            <div class="kpi-value">${this.formatCurrency(m.feePerDeal)}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Completed Deals</div>
                            <div class="kpi-value">${m.completedCount}</div>
                        </div>
                    </div>
                </div>

                <!-- Section 3: Operational Efficiency -->
                <div class="analytics-section">
                    <h3>⚡ Operational Efficiency</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card ${m.avgTimeToClose < 4 ? 'success' : ''}">
                            <div class="kpi-label">Avg Time to Close</div>
                            <div class="kpi-value">${m.avgTimeToClose.toFixed(1)} days</div>
                            <div class="kpi-benchmark">Industry avg: 5-7 days ⬇️</div>
                        </div>
                        <div class="kpi-card ${m.auctionSuccessRate >= 90 ? 'success' : 'warning'}">
                            <div class="kpi-label">Auction Success Rate</div>
                            <div class="kpi-value">${m.auctionSuccessRate.toFixed(1)}%</div>
                            <div class="kpi-benchmark">Target: >90% ${m.auctionSuccessRate >= 90 ? '✓' : '⚠️'}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Oversubscription</div>
                            <div class="kpi-value">${m.avgOversubscription.toFixed(2)}x</div>
                            <div class="kpi-benchmark">Target: 1.1-1.3x</div>
                        </div>
                        <div class="kpi-card ${m.paymentSettlementRate >= 99 ? 'success' : ''}">
                            <div class="kpi-label">Payment Settlement Rate</div>
                            <div class="kpi-value">${m.paymentSettlementRate.toFixed(1)}%</div>
                            <div class="kpi-benchmark">Target: >99%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: LSTA reports average syndication takes 5-7 days; top platforms achieve 3-4 days</div>
                </div>

                <!-- Section 4: Risk Monitoring -->
                <div class="analytics-section">
                    <h3>🎯 Subscription Quality & Risk</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card ${m.fullSubscriptionRate >= 85 ? 'success' : 'warning'}">
                            <div class="kpi-label">Full Subscription Rate</div>
                            <div class="kpi-value">${m.fullSubscriptionRate.toFixed(1)}%</div>
                            <div class="kpi-benchmark">Target: >85%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Average Fill Rate</div>
                            <div class="kpi-value">${m.avgFillRate.toFixed(1)}%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Participants/Deal</div>
                            <div class="kpi-value">${m.avgParticipantsPerDeal.toFixed(1)}</div>
                            <div class="kpi-benchmark">Target: 6-12</div>
                        </div>
                        <div class="kpi-card ${m.maxConcentration < 40 ? 'success' : 'danger'}">
                            <div class="kpi-label">Max Concentration</div>
                            <div class="kpi-value">${m.maxConcentration}%</div>
                            <div class="kpi-benchmark">Limit: <40%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Basel III requires banks to monitor concentration limits; typically max 25% to single counterparty</div>
                </div>

                <!-- Section 5: Market Competitiveness -->
                <div class="analytics-section">
                    <h3>📈 Spread Analysis</h3>
                    <div class="kpi-grid spread-grid">
                        <div class="kpi-card primary">
                            <div class="kpi-label">Weighted Avg Spread</div>
                            <div class="kpi-value">${m.avgSpread.toFixed(0)} bps</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Investment Grade</div>
                            <div class="kpi-value">${m.igSpread} bps</div>
                            <div class="kpi-benchmark">Market: 200-350</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Crossover</div>
                            <div class="kpi-value">${m.crossoverSpread} bps</div>
                            <div class="kpi-benchmark">Market: 350-450</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">High Yield</div>
                            <div class="kpi-value">${m.hySpread} bps</div>
                            <div class="kpi-benchmark">Market: 450-600</div>
                        </div>
                    </div>
                    
                    <h4 style="margin-top: 1.5rem;">💹 Win Rates by Participant Type</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card small">
                            <div class="kpi-label">Banks</div>
                            <div class="kpi-value">${m.bankWinRate}%</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Private Credit</div>
                            <div class="kpi-value">${m.privateCreditWinRate}%</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">CLOs</div>
                            <div class="kpi-value">${m.cloWinRate}%</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Institutional</div>
                            <div class="kpi-value">${m.institutionalWinRate}%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: S&P LCD data shows institutional loan spreads: BB avg 450bps, B avg 500bps (2024)</div>
                </div>

                <!-- Section 6: Technology Performance -->
                <div class="analytics-section">
                    <h3>⚙️ Technology Performance</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card ${m.apiResponseTime < 200 ? 'success' : 'warning'}">
                            <div class="kpi-label">API Response Time</div>
                            <div class="kpi-value">${m.apiResponseTime}ms</div>
                            <div class="kpi-benchmark">Target: <200ms ${m.apiResponseTime < 200 ? '✓' : ''}</div>
                        </div>
                        <div class="kpi-card ${m.blockchainConfirmTime < 15 ? 'success' : ''}">
                            <div class="kpi-label">Blockchain Confirm</div>
                            <div class="kpi-value">${m.blockchainConfirmTime} min</div>
                            <div class="kpi-benchmark">Target: <15min</div>
                        </div>
                        <div class="kpi-card ${m.agentDecisionLatency < 5 ? 'success' : ''}">
                            <div class="kpi-label">Agent Latency</div>
                            <div class="kpi-value">${m.agentDecisionLatency.toFixed(1)}s</div>
                            <div class="kpi-benchmark">Target: <5s</div>
                        </div>
                        <div class="kpi-card ${m.systemUptime >= 99.9 ? 'success' : ''}">
                            <div class="kpi-label">System Uptime</div>
                            <div class="kpi-value">${m.systemUptime.toFixed(2)}%</div>
                            <div class="kpi-benchmark">Target: 99.9%</div>
                        </div>
                    </div>
                    
                    <h4 style="margin-top: 1.5rem;">🤖 AI Agent Performance</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Agent Accuracy</div>
                            <div class="kpi-value">${m.agentAccuracy.toFixed(1)}%</div>
                            <div class="kpi-benchmark">Decisions aligned with outcomes</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Auction Optimization</div>
                            <div class="kpi-value">${m.auctionOptScore.toFixed(2)}</div>
                            <div class="kpi-benchmark">Price improvement vs baseline</div>
                        </div>
                        <div class="kpi-card ${m.falsePositiveRate < 5 ? 'success' : 'warning'}">
                            <div class="kpi-label">False Positive Alerts</div>
                            <div class="kpi-value">${m.falsePositiveRate.toFixed(1)}%</div>
                            <div class="kpi-benchmark">Target: <5%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    formatCurrency(value) {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
    },

    injectStyles() {
        if (document.getElementById('analytics-dashboard-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'analytics-dashboard-styles';
        styles.textContent = `
            .analytics-dashboard {
                padding: 1.5rem;
                max-width: 1400px;
                margin: 0 auto;
            }
            .analytics-header {
                margin-bottom: 2rem;
                border-bottom: 2px solid var(--border-color);
                padding-bottom: 1rem;
            }
            .analytics-header h2 {
                margin: 0;
                font-size: 1.5rem;
            }
            .analytics-subtitle {
                color: var(--text-muted);
                font-size: 0.875rem;
            }
            .analytics-section {
                background: var(--bg-card);
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                margin-bottom: 1.5rem;
                border: 1px solid var(--border-color);
            }
            .analytics-section h3 {
                margin: 0 0 1rem 0;
                font-size: 1.1rem;
                color: var(--text-primary);
            }
            .analytics-section h4 {
                margin: 0 0 0.75rem 0;
                font-size: 0.95rem;
                color: var(--text-secondary);
            }
            .kpi-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            .kpi-card {
                background: var(--bg-muted);
                border-radius: var(--radius-md);
                padding: 1rem;
                border: 1px solid var(--border-color);
            }
            .kpi-card.primary {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
                border-color: rgba(59, 130, 246, 0.3);
            }
            .kpi-card.success {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
                border-color: rgba(16, 185, 129, 0.3);
            }
            .kpi-card.warning {
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
                border-color: rgba(245, 158, 11, 0.3);
            }
            .kpi-card.danger {
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
                border-color: rgba(239, 68, 68, 0.3);
            }
            .kpi-card.small {
                padding: 0.75rem;
            }
            .kpi-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 0.25rem;
            }
            .kpi-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            .kpi-card.small .kpi-value {
                font-size: 1.25rem;
            }
            .kpi-benchmark {
                font-size: 0.7rem;
                color: var(--text-muted);
                margin-top: 0.25rem;
            }
            .kpi-reference {
                margin-top: 1rem;
                padding: 0.75rem;
                background: rgba(59, 130, 246, 0.05);
                border-left: 3px solid var(--primary);
                font-size: 0.75rem;
                color: var(--text-secondary);
                border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
            }
            .kpi-subsection {
                padding-left: 1rem;
                border-left: 2px solid var(--border-color);
                margin: 0.5rem 0;
                font-size: 0.8rem;
            }
            .kpi-subsection-item {
                display: flex;
                justify-content: space-between;
                padding: 0.25rem 0;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(styles);
    },

    // ========================================
    // ORIGINATOR DASHBOARD
    // ========================================
    renderOriginatorDashboard(container) {
        const syndications = SyndiData.syndications || [];
        const myDeals = syndications; // In real app, filter by originator
        const activeDeal = myDeals.find(s => s.status !== 'completed') || myDeals[0];

        container.innerHTML = `
            <div class="analytics-dashboard">
                <div class="analytics-header">
                    <h2>🏦 Originator Analytics Dashboard</h2>
                    <span class="analytics-subtitle">Lead Bank View • Deal Execution Metrics</span>
                </div>

                <!-- Section 1: Syndication Success Metrics -->
                <div class="analytics-section">
                    <h3>🎯 Syndication Success Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card ${(activeDeal?.subscription || 0) >= 100 ? 'success' : (activeDeal?.subscription || 0) >= 80 ? 'warning' : 'danger'}">
                            <div class="kpi-label">Subscription Rate</div>
                            <div class="kpi-value">${(activeDeal?.subscription || 85).toFixed(0)}%</div>
                            <div class="kpi-benchmark">
                                100%+: Successful ✓ | 80-99%: At Risk ⚠️ | <80%: Failed ❌
                            </div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Oversubscription Ratio</div>
                            <div class="kpi-value">${((activeDeal?.subscription || 100) / 100).toFixed(2)}x</div>
                            <div class="kpi-benchmark">>1.5x: Very Strong 🔥 | 1.1-1.5x: Strong ✓</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Time to Full Subscription</div>
                            <div class="kpi-value">32 hours</div>
                            <div class="kpi-benchmark">Target: <48h</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Final Allocation vs Target</div>
                            <div class="kpi-value">${(activeDeal?.subscription || 95).toFixed(0)}%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: LMA best practices suggest 100-110% subscription is optimal; >150% may indicate mispricing</div>
                </div>

                <!-- Section 2: Pricing Efficiency -->
                <div class="analytics-section">
                    <h3>💵 Spread Optimization</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Starting Spread</div>
                            <div class="kpi-value">${(activeDeal?.spread || 350) + 50} bps</div>
                        </div>
                        <div class="kpi-card primary">
                            <div class="kpi-label">Final Spread</div>
                            <div class="kpi-value">${activeDeal?.spread || 350} bps</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Spread Tightening</div>
                            <div class="kpi-value">50 bps</div>
                            <div class="kpi-benchmark">>50 bps: Excellent ✓✓</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">All-In Pricing</div>
                            <div class="kpi-value">${(activeDeal?.spread || 350) + 75} bps</div>
                            <div class="kpi-benchmark">Spread + Fees</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Spread vs Credit Rating Benchmark</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card small">
                            <div class="kpi-label">BBB</div>
                            <div class="kpi-value">285 bps</div>
                            <div class="kpi-benchmark">Market: 300-400</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">BB</div>
                            <div class="kpi-value">395 bps</div>
                            <div class="kpi-benchmark">Market: 400-500</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">B</div>
                            <div class="kpi-value">520 bps</div>
                            <div class="kpi-benchmark">Market: 500-600</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: S&P LCD tracks institutional loan spreads by rating; BB loans averaged 446bps in 2024</div>
                </div>

                <!-- Section 3: Participant Quality -->
                <div class="analytics-section">
                    <h3>👥 Syndicate Composition</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card ${(activeDeal?.bids?.length || 8) >= 6 ? 'success' : 'warning'}">
                            <div class="kpi-label">Number of Participants</div>
                            <div class="kpi-value">${activeDeal?.bids?.length || 8}</div>
                            <div class="kpi-benchmark">6-12: Optimal ✓ | <4: Concentration risk ❌</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Participant Diversity Score</div>
                            <div class="kpi-value">7.8</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Participant Credit Quality</div>
                            <div class="kpi-value">A-</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Relationship Participants</div>
                            <div class="kpi-value">65%</div>
                            <div class="kpi-benchmark">Existing vs New</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Participant Distribution</h4>
                    <div class="kpi-subsection">
                        <div class="kpi-subsection-item"><span>Banks:</span> <span>45%</span></div>
                        <div class="kpi-subsection-item"><span>Credit Funds:</span> <span>35%</span></div>
                        <div class="kpi-subsection-item"><span>Institutional Investors:</span> <span>20%</span></div>
                    </div>
                    <div class="kpi-reference">Reference: Basel III encourages diversification; regulatory guidance suggests no single lender >25-30%</div>
                </div>

                <!-- Section 4: Fee Revenue -->
                <div class="analytics-section">
                    <h3>💰 Economics Analysis</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card success">
                            <div class="kpi-label">Total Fee Pool</div>
                            <div class="kpi-value">${this.formatCurrency((activeDeal?.amount || 250) * 1000000 * 0.02)}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Upfront Fees</div>
                            <div class="kpi-value">${this.formatCurrency((activeDeal?.amount || 250) * 1000000 * 0.01)}</div>
                            <div class="kpi-benchmark">1.0% of loan</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Your Share (Lead)</div>
                            <div class="kpi-value">${this.formatCurrency((activeDeal?.amount || 250) * 1000000 * 0.012)}</div>
                            <div class="kpi-benchmark">60% of fees</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">ROE (Fees/Hold)</div>
                            <div class="kpi-value">8.5%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Typical arranger fees range 1.5-3% for leveraged loans, 0.5-1.5% for investment grade (LSTA)</div>
                </div>

                <!-- Section 5: Settlement -->
                <div class="analytics-section">
                    <h3>📋 Post-Close Execution</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card success">
                            <div class="kpi-label">Documentation Completion</div>
                            <div class="kpi-value">100%</div>
                            <div class="kpi-benchmark">Target: 100% within 48h ✓</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Payment Collection Rate</div>
                            <div class="kpi-value">92%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Collection Time</div>
                            <div class="kpi-value">2.8 days</div>
                            <div class="kpi-benchmark">Target: <5 days</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Outstanding Amounts</div>
                            <div class="kpi-value">${this.formatCurrency((activeDeal?.amount || 250) * 1000000 * 0.08)}</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Standard market practice is T+3 to T+5 settlement for syndicated loans</div>
                </div>

                <!-- Section 6: Relationships -->
                <div class="analytics-section">
                    <h3>🤝 Relationship Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Repeat Participant Rate</div>
                            <div class="kpi-value">72%</div>
                            <div class="kpi-benchmark">Strong relationships</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Participant Attrition</div>
                            <div class="kpi-value success">5%</div>
                            <div class="kpi-benchmark">Target: <10% ✓</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Deals Closed (12m)</div>
                            <div class="kpi-value">${myDeals.length || 12}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Market Share</div>
                            <div class="kpi-value">8.5%</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ========================================
    // PARTICIPANT DASHBOARD
    // ========================================
    renderParticipantDashboard(container) {
        const syndications = SyndiData.syndications || [];
        const activeDeal = syndications.find(s => s.status !== 'completed') || syndications[0];
        const myBids = SyndiData.bids || [];

        container.innerHTML = `
            <div class="analytics-dashboard">
                <div class="analytics-header">
                    <h2>🏢 Participant Analytics Dashboard</h2>
                    <span class="analytics-subtitle">Investor/Lender View • Portfolio & Investment Metrics</span>
                </div>

                <!-- Section 1: Deal Screening -->
                <div class="analytics-section">
                    <h3>🔍 Deal Screening Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card primary">
                            <div class="kpi-label">Match Score</div>
                            <div class="kpi-value">82/100</div>
                            <div class="kpi-benchmark">vs your mandate</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Credit Rating</div>
                            <div class="kpi-value">${activeDeal?.rating || 'BB+'} ✓</div>
                            <div class="kpi-benchmark">Your range: BB- to A-</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">All-In Yield</div>
                            <div class="kpi-value">8.2%</div>
                            <div class="kpi-benchmark">Target: 7.5%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Spread Premium</div>
                            <div class="kpi-value">+35 bps</div>
                            <div class="kpi-benchmark">vs your avg</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Mandate Checklist</h4>
                    <div class="kpi-subsection">
                        <div class="kpi-subsection-item"><span>Sector Preference:</span> <span>✓ ${activeDeal?.industry || 'Technology'}</span></div>
                        <div class="kpi-subsection-item"><span>Geography Match:</span> <span>✓ US</span></div>
                        <div class="kpi-subsection-item"><span>Ticket Size:</span> <span>✓ $25M (your range: $10-100M)</span></div>
                        <div class="kpi-subsection-item"><span>ESG Score:</span> <span>✓ 78 (your min: 70)</span></div>
                    </div>
                    <div class="kpi-reference">Reference: Moody's expected loss methodology; institutional investors target 6-12% all-in returns depending on rating</div>
                </div>

                <!-- Section 2: Bidding Intelligence -->
                <div class="analytics-section">
                    <h3>📈 Auction Dynamics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Total Bids Submitted</div>
                            <div class="kpi-value">${activeDeal?.bids?.length || myBids.length || 12}</div>
                        </div>
                        <div class="kpi-card primary">
                            <div class="kpi-label">Current Subscription</div>
                            <div class="kpi-value">${activeDeal?.subscription || 95}%</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Your Bid Status</div>
                            <div class="kpi-value">Active ✓</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Your Bid Rank</div>
                            <div class="kpi-value">#3 of ${activeDeal?.bids?.length || 12}</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Auction Progress</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card small">
                            <div class="kpi-label">Current Round</div>
                            <div class="kpi-value">${activeDeal?.round || 2}/${activeDeal?.maxRounds || 5}</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Spread Movement</div>
                            <div class="kpi-value">${(activeDeal?.spread || 350) + 50} → ${activeDeal?.spread || 350}</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Time Remaining</div>
                            <div class="kpi-value">18 hours</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Fill Probability</div>
                            <div class="kpi-value">78%</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Dutch auction theory - optimal bidding at true valuation point</div>
                </div>

                <!-- Section 3: Portfolio Impact -->
                <div class="analytics-section">
                    <h3>📊 Portfolio Fit Metrics</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Total Portfolio Exposure</div>
                            <div class="kpi-value">$2.4B</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Available Capacity</div>
                            <div class="kpi-value">$350M</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">This Deal: % of Portfolio</div>
                            <div class="kpi-value">1.2% ✓</div>
                            <div class="kpi-benchmark">Limit: 3%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Sector Concentration</div>
                            <div class="kpi-value">28% → 30%</div>
                            <div class="kpi-benchmark">Limit: 40% ✓</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Regulatory Compliance</h4>
                    <div class="kpi-subsection">
                        <div class="kpi-subsection-item"><span>Basel III RWA Impact:</span> <span>+$12M (0.5% of capital)</span></div>
                        <div class="kpi-subsection-item"><span>Leverage Ratio Impact:</span> <span>4.2 → 4.18 ✓</span></div>
                        <div class="kpi-subsection-item"><span>LCR/NSFR Impact:</span> <span>✓ Compliant</span></div>
                        <div class="kpi-subsection-item"><span>Large Exposure Test:</span> <span>✓ Pass</span></div>
                    </div>
                    <div class="kpi-reference">Reference: Basel III sets single counterparty limit at 25% of Tier 1 capital; CLO concentration limits typically 2-3% per name</div>
                </div>

                <!-- Section 4: Win/Loss Analytics -->
                <div class="analytics-section">
                    <h3>🎯 Your Bidding Performance</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Bids Submitted (YTD)</div>
                            <div class="kpi-value">${myBids.length || 45}</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Win Rate</div>
                            <div class="kpi-value">52%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Fill Rate</div>
                            <div class="kpi-value">78%</div>
                            <div class="kpi-benchmark">Requested vs Received</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Avg Response Time</div>
                            <div class="kpi-value">4.2 hours</div>
                            <div class="kpi-benchmark">Market avg: 6.5 hours</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Lost Bids Analysis</h4>
                    <div class="kpi-subsection">
                        <div class="kpi-subsection-item"><span>Lost on Spread:</span> <span>45%</span></div>
                        <div class="kpi-subsection-item"><span>Lost on Amount:</span> <span>30%</span></div>
                        <div class="kpi-subsection-item"><span>Lost on Late Submission:</span> <span>15%</span></div>
                        <div class="kpi-subsection-item"><span>Avg Spread Gap:</span> <span>12 bps vs winner</span></div>
                    </div>
                    <div class="kpi-reference">Reference: LSTA data shows 40-60% average win rates for active participants; CLOs average 25-35% due to volume bidding</div>
                </div>

                <!-- Section 5: Payment Tracking -->
                <div class="analytics-section">
                    <h3>💳 Your Payment Obligations</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card primary">
                            <div class="kpi-label">Total Due This Deal</div>
                            <div class="kpi-value">${this.formatCurrency(25.5 * 1000000)}</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Commitment Fee</div>
                            <div class="kpi-value">$125K ✓</div>
                            <div class="kpi-benchmark">Paid</div>
                        </div>
                        <div class="kpi-card warning">
                            <div class="kpi-label">Arrangement Fee</div>
                            <div class="kpi-value">$625K ⏳</div>
                            <div class="kpi-benchmark">Due at Funding</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Principal</div>
                            <div class="kpi-value">$25M ⏳</div>
                            <div class="kpi-benchmark">Due at Funding</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Your Payment History</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card small success">
                            <div class="kpi-label">On-Time Rate</div>
                            <div class="kpi-value">98%</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Avg Payment Time</div>
                            <div class="kpi-value">4h early</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Late Payments (12m)</div>
                            <div class="kpi-value">1</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Reliability Score</div>
                            <div class="kpi-value">94/100</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Investment grade participants typically pay T+1 for fees, T+3 for principal; high-yield can be T+5-7</div>
                </div>

                <!-- Section 6: Returns -->
                <div class="analytics-section">
                    <h3>📈 Investment Returns</h3>
                    <div class="kpi-grid">
                        <div class="kpi-card">
                            <div class="kpi-label">Current Position Value</div>
                            <div class="kpi-value">$245M</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">Unrealized P&L</div>
                            <div class="kpi-value">+$1.2M</div>
                            <div class="kpi-benchmark">MTM: +0.5%</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Net Return (Ann.)</div>
                            <div class="kpi-value">8.7%</div>
                        </div>
                        <div class="kpi-card success">
                            <div class="kpi-label">vs Peer Avg</div>
                            <div class="kpi-value">+45 bps ✓</div>
                        </div>
                    </div>
                    <h4 style="margin-top: 1rem;">Risk-Adjusted Metrics</h4>
                    <div class="kpi-grid">
                        <div class="kpi-card small">
                            <div class="kpi-label">Sharpe Ratio</div>
                            <div class="kpi-value">1.42</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Max Drawdown</div>
                            <div class="kpi-value">-2.1%</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Sortino Ratio</div>
                            <div class="kpi-value">1.85</div>
                        </div>
                        <div class="kpi-card small">
                            <div class="kpi-label">Info Ratio</div>
                            <div class="kpi-value">0.72</div>
                        </div>
                    </div>
                    <div class="kpi-reference">Reference: Typical leveraged loan returns 7-10% (S&P LCD Index); CLO equity returns 12-15%</div>
                </div>
            </div>
        `;
    }
};
