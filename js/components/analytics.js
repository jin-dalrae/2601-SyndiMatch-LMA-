// ========================================
// Analytics Component - Dashboard Suite
// Real-time KPIs for platform, originator, and participant monitoring
// ========================================

const AnalyticsComponent = {
    refreshInterval: null,
    lastUpdate: null,
    heatmapConfig: {
        level1Max: 250,
        level2Max: 350,
        level3Max: 500,
    },

    init() {
        this.injectStyles();
        this.render();
        this.startAutoRefresh();

        window.addEventListener('roleChange', () => {
            this.stopAutoRefresh();
            this.render();
            this.startAutoRefresh();
        });
    },

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => this.refreshMetrics(), 10000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
    },

    async refreshMetrics() {
        const container = document.getElementById('analytics-container') || document.getElementById('view-analytics');
        if (!container) return;

        try {
            const metrics = await this.fetchMetricsFromAPI();
            this.updateDashboardValues(metrics);
            this.lastUpdate = new Date();
            const timeEl = document.querySelector('.analytics-last-updated');
            if (timeEl) timeEl.textContent = `Last updated: ${this.lastUpdate.toLocaleTimeString()}`;
        } catch (e) {
            // Local data fallback handled by updateDashboardValues
        }
    },

    async fetchMetricsFromAPI() {
        const role = AppState?.get('currentRole') || 'platform';
        try {
            const res = await API.get('server', `/analytics/${role}`);
            return res || this.calculateMetrics();
        } catch (e) {
            return this.calculateMetrics();
        }
    },

    calculateMetrics() {
        const syndications = window.SyndiData?.syndications || [];
        const totalVol = syndications.reduce((sum, s) => sum + (s.amount || 0), 0) * 1000000;

        return {
            totalVolume: totalVol,
            activeCount: syndications.filter(s => s.status === 'open').length,
            avgDealSize: syndications.length ? totalVol / syndications.length : 0,
            participantCount: window.SyndiData?.participants?.length || 15,
            platformFees: totalVol * 0.005,
            successRate: 92.5,
            avgSpread: 412
        };
    },

    updateDashboardValues(m) {
        const updates = {
            'kpi-total-volume': this.formatCurrency(m.totalVolume || 0),
            'kpi-active-count': m.activeCount || 0,
            'kpi-avg-deal': this.formatCurrency(m.avgDealSize || 0),
            'kpi-participants': m.participantCount || 0,
            'kpi-platform-fees': this.formatCurrency(m.platformFees || 0),
            'kpi-success-rate': `${(m.successRate || 0).toFixed(1)}%`,
            'kpi-avg-spread': `${(m.avgSpread || 0).toFixed(0)} bps`
        };

        Object.entries(updates).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        });
    },

    render() {
        const container = document.getElementById('analytics-container') || document.getElementById('view-analytics');
        if (!container) return;

        const role = RoleRouter?.currentRole || 'platform';

        if (role === 'originator') {
            this.renderOriginatorDashboard(container);
        } else if (role === 'participant') {
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
                        <h2>📊 Platform Operations</h2>
                        <span class="analytics-live-indicator">● LIVE</span>
                    </div>
                    <span class="analytics-last-updated">Last updated: ${new Date().toLocaleTimeString()}</span>
                </div>

                <div class="kpi-grid">
                    <div class="kpi-card primary">
                        <div class="kpi-label">Total Volume (YTD)</div>
                        <div class="kpi-value" id="kpi-total-volume">${this.formatCurrency(m.totalVolume)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Active Facilties</div>
                        <div class="kpi-value" id="kpi-active-count">${m.activeCount}</div>
                    </div>
                    <div class="kpi-card success">
                        <div class="kpi-label">Platform Fees</div>
                        <div class="kpi-value" id="kpi-platform-fees">${this.formatCurrency(m.platformFees)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Participants</div>
                        <div class="kpi-value" id="kpi-participants">${m.participantCount}</div>
                    </div>
                </div>

                <div class="analytics-section">
                    <h3>Spread Heatmap (Industry x Rating)</h3>
                    <div id="spread-heatmap"></div>
                    ${this.renderHeatmap()}
                </div>
            </div>
        `;
    },

    renderOriginatorDashboard(container) {
        container.innerHTML = `
            <div class="analytics-dashboard">
                <div class="analytics-header">
                    <h2>🏦 Portfolio & Originator Insights</h2>
                </div>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-label">Deals Closed</div>
                        <div class="kpi-value">12</div>
                    </div>
                    <div class="kpi-card success">
                        <div class="kpi-label">Total Arranged</div>
                        <div class="kpi-value">$2.4B</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Avg Oversubscription</div>
                        <div class="kpi-value">1.4x</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderParticipantDashboard(container) {
        container.innerHTML = `
            <div class="analytics-dashboard">
                <div class="analytics-header">
                    <h2>🧭 Institutional Participant Insights</h2>
                </div>
                <div class="kpi-grid">
                    <div class="kpi-card primary">
                        <div class="kpi-label">Allocation Win Rate</div>
                        <div class="kpi-value">68%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Portfolio Weighted Spread</div>
                        <div class="kpi-value">425 bps</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">ESG Alignment</div>
                        <div class="kpi-value">92%</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderHeatmap() {
        const sectors = ['Tech', 'Energy', 'Health', 'Retail'];
        const ratings = ['AAA', 'AA', 'A', 'BBB'];

        return `
            <div class="heatmap-container">
                <div class="heatmap-grid">
                    <div class="heatmap-corner"></div>
                    ${sectors.map(s => `<div class="heatmap-header">${s}</div>`).join('')}
                    ${ratings.map(r => `
                        <div class="heatmap-label">${r}</div>
                        ${sectors.map(() => `<div class="heatmap-cell level-${Math.floor(Math.random() * 4) + 1}">${250 + Math.floor(Math.random() * 300)}</div>`).join('')}
                    `).join('')}
                </div>
            </div>
        `;
    },

    formatCurrency(val) {
        if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
        if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
        return `$${val.toLocaleString()}`;
    },

    injectStyles() {
        if (document.getElementById('analytics-styles')) return;
        const style = document.createElement('style');
        style.id = 'analytics-styles';
        style.textContent = `
            .analytics-dashboard { padding: 2rem; }
            .analytics-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
            .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem; }
            .kpi-card { background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); }
            .kpi-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }
            .kpi-value { font-size: 2rem; font-weight: bold; }
            .kpi-card.primary { border-left: 4px solid var(--primary); }
            .kpi-card.success { border-left: 4px solid #10b981; }
            .heatmap-grid { display: grid; grid-template-columns: 60px repeat(4, 1fr); gap: 4px; }
            .heatmap-header, .heatmap-label { font-size: 12px; color: var(--text-muted); padding: 8px; text-align: center; }
            .heatmap-cell { height: 40px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: white; border-radius: 3px; }
            .level-1 { background: #065f46; } .level-2 { background: #059669; } .level-3 { background: #10b981; } .level-4 { background: #6ee7b7; color: #065f46; }
        `;
        document.head.appendChild(style);
    }
};

window.AnalyticsComponent = AnalyticsComponent;
