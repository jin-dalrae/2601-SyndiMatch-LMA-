/**
 * Admin View Component (Platform Operator & Analytics)
 * Handles Platform Health, Risk Monitoring, and Technology Performance metrics.
 */
const AdminView = {
    init() {
        console.log('📡 Admin Analytics initialized');
    },

    /**
     * Render the main Admin Analytics Dashboard
     */
    renderDashboard(view) {
        const metrics = this.calculatePlatformMetrics();

        view.innerHTML = `
            <div class="admin-dashboard-container">
                <div class="page-header-flex">
                    <h2 class="page-title">Platform Command Center</h2>
                    <div class="header-controls">
                        <span class="system-status"><span class="status-dot green pulse"></span> System Nominal</span>
                        <div class="last-updated">Updated: ${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                <!-- 1. Platform Health (Volume & Revenue) -->
                <div class="wealth-cards admin-cards">
                    <div class="wealth-card">
                        <div class="wealth-label">Total Volume (YTD)</div>
                        <div class="wealth-value">$${metrics.volume.ytd}B</div>
                        <div class="wealth-sub">${metrics.volume.activeDeals} Active Syndications</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Fees Collected</div>
                        <div class="wealth-value highlight">$${metrics.revenue.collected}M</div>
                        <div class="wealth-sub">Avg Rate: ${metrics.revenue.avgRate}%</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Avg Time to Close</div>
                        <div class="wealth-value success">${metrics.efficiency.timeToClose}d</div>
                        <div class="wealth-sub">Industry Avg: 6.5d (Top Quartile)</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Auction Success</div>
                        <div class="wealth-value">${metrics.efficiency.successRate}%</div>
                        <div class="wealth-sub">Avg Oversub: ${metrics.efficiency.oversub}x</div>
                    </div>
                </div>

                <!-- 2. Risk & Quality Grid -->
                <div class="analytics-grid-3">
                    <!-- Subscription Quality -->
                    <div class="metric-card">
                        <h4 class="chart-title">🎯 Subscription Quality</h4>
                        <div class="kpi-list">
                            <div class="kpi-row">
                                <span>Full Subscription Rate</span>
                                <span class="kpi-val ${this.getColor(metrics.risk.fullSubRate, 85)}">${metrics.risk.fullSubRate}%</span>
                            </div>
                            <div class="kpi-row">
                                <span>Avg Fill Rate</span>
                                <span class="kpi-val">${metrics.risk.avgFillRate}%</span>
                            </div>
                            <div class="kpi-row">
                                <span>Avg Participants</span>
                                <span class="kpi-val">${metrics.risk.avgParticipants}</span>
                            </div>
                            <div class="kpi-row">
                                <span>Max Concentration</span>
                                <span class="kpi-val text-warning">${metrics.risk.maxConcentration}%</span>
                            </div>
                        </div>
                    </div>

                    <!-- Market Competitiveness -->
                    <div class="metric-card">
                        <h4 class="chart-title">📈 Spread Analysis</h4>
                        <div class="kpi-list">
                            <div class="kpi-row">
                                <span>Weighted Avg Spread</span>
                                <span class="kpi-val">${metrics.market.avgSpread} bps</span>
                            </div>
                            <div class="kpi-row">
                                <span>Compression Achieved</span>
                                <span class="kpi-val text-success">-${metrics.market.compression} bps</span>
                            </div>
                            <div class="kpi-row">
                                <span>Vs Market (BB)</span>
                                <span class="kpi-val">${metrics.market.benchmarkDiff > 0 ? '+' : ''}${metrics.market.benchmarkDiff} bps</span>
                            </div>
                            <div class="chart-mini-bar">
                                <div class="bar-segment" style="width: ${metrics.market.winRates.banks}%" title="Banks"></div>
                                <div class="bar-segment" style="width: ${metrics.market.winRates.funds}%" title="Funds"></div>
                                <div class="bar-segment" style="width: ${metrics.market.winRates.clos}%" title="CLOs"></div>
                            </div>
                            <div class="chart-legend-row">
                                <span class="legend-item"><span class="dot bank"></span>Banks</span>
                                <span class="legend-item"><span class="dot fund"></span>Funds</span>
                                <span class="legend-item"><span class="dot clo"></span>CLOs</span>
                            </div>
                        </div>
                    </div>

                    <!-- Technology Performance -->
                    <div class="metric-card">
                        <h4 class="chart-title">⚙️ Tech Performance</h4>
                        <div class="kpi-list">
                            <div class="kpi-row">
                                <span>API Latency</span>
                                <span class="kpi-val ${metrics.tech.apiLatency < 200 ? 'text-success' : 'text-danger'}">${metrics.tech.apiLatency}ms</span>
                            </div>
                            <div class="kpi-row">
                                <span>Agent Decision Time</span>
                                <span class="kpi-val">${metrics.tech.agentLatency}s</span>
                            </div>
                            <div class="kpi-row">
                                <span>AI Accuracy</span>
                                <span class="kpi-val highlight">${metrics.tech.aiAccuracy}%</span>
                            </div>
                            <div class="kpi-row">
                                <span>Uptime</span>
                                <span class="kpi-val text-success">${metrics.tech.uptime}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. System Alerts Table -->
                <div class="alerts-section">
                    <h3 class="section-title">Risk Monitor & Alerts</h3>
                    <table class="portfolio-table">
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>Type</th>
                                <th>Message</th>
                                <th>Time</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><span class="status-badge warning">WARNING</span></td>
                                <td>Concentration</td>
                                <td>Participant PA-004 exceeds 25% single-name limit in SYND-2025-001</td>
                                <td>10m ago</td>
                                <td><button class="btn-xs">Review</button></td>
                            </tr>
                            <tr>
                                <td><span class="status-badge success">INFO</span></td>
                                <td>Settlement</td>
                                <td>Block payment $45M settled on chain (Tx: 0x8f...3a)</td>
                                <td>24m ago</td>
                                <td><button class="btn-xs">View</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    calculatePlatformMetrics() {
        return {
            volume: {
                ytd: 24.5, // $Bn
                activeDeals: 8
            },
            revenue: {
                collected: 12.4, // $M
                avgRate: 1.25, // %
            },
            efficiency: {
                timeToClose: 4.2, // days
                successRate: 94.5,
                oversub: 1.25
            },
            risk: {
                fullSubRate: 88,
                avgFillRate: 100,
                avgParticipants: 8.5,
                maxConcentration: 28, // %
            },
            market: {
                avgSpread: 425,
                compression: 35,
                benchmarkDiff: -15, // tight to market
                winRates: {
                    banks: 45,
                    funds: 30,
                    clos: 25
                }
            },
            tech: {
                apiLatency: 145, // ms
                agentLatency: 1.2, // s
                aiAccuracy: 96.5,
                uptime: 99.99
            }
        };
    },

    getColor(val, threshold) {
        return val >= threshold ? 'text-success' : 'text-warning';
    }
};

window.AdminView = AdminView;
