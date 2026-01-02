// ========================================
// Analytics Component
// Refactored to use MarketDataProvider and MetricsService
// ========================================

const AnalyticsComponent = {
    // Configuration for heatmap thresholds (extracted, not hardcoded)
    heatmapConfig: {
        level1Max: 250,  // Tight spreads
        level2Max: 350,  // Normal spreads
        level3Max: 500,  // Wide spreads
        // level4 = everything above level3Max
    },

    init() {
        this.render();
    },

    render() {
        this.renderPerformanceMatrix();
        this.renderHeatmap();
        this.renderVolumeChart();
    },

    renderPerformanceMatrix() {
        const container = document.getElementById('performance-matrix');
        if (!container) return;

        // Use SyndiData if available, else empty
        const participants = typeof SyndiData !== 'undefined' && SyndiData.participants
            ? SyndiData.participants
            : [];

        if (participants.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No participant data available</p>
                </div>
            `;
            return;
        }

        const sorted = [...participants].sort((a, b) => b.winRate - a.winRate);
        const top = sorted.slice(0, 8);

        const formatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 });
        const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

        container.innerHTML = `
            <table class="performance-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Participant</th>
                        <th>Win Rate</th>
                        <th>Bids YTD</th>
                        <th>Volume</th>
                        <th>On-Time %</th>
                    </tr>
                </thead>
                <tbody>
                    ${top.map((p, i) => `
                        <tr>
                            <td>${this.getRankBadge(i)}</td>
                            <td>
                                <div><strong>${p.name}</strong></div>
                                <div class="text-muted small-text">${p.type}</div>
                            </td>
                            <td><strong class="text-success">${formatter.format(p.winRate / 100)}</strong></td>
                            <td>${p.bids}</td>
                            <td>${this._formatVolume(p.volume, currencyFormatter)}</td>
                            <td>
                                <span class="${p.onTime < 90 ? 'text-warning' : ''}">${p.onTime}%</span>
                                ${p.late ? `<span class="text-danger"> (${p.late} late)</span>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="analytics-disclaimer">
                ⚠️ Rankings by raw win rate. Not normalized by deal difficulty, risk, or tenor.
            </div>
        `;
    },

    /**
     * Format volume using MetricsService if available
     */
    _formatVolume(volumeInMillions, formatter) {
        const MS = window.MetricsService;
        if (MS) {
            return MS.formatCurrency(volumeInMillions * 1000000);
        }
        if (formatter) {
            return formatter.format(volumeInMillions * 1000000).replace(/\.00$/, '');
        }
        return `$${volumeInMillions}M`;
    },

    getRankBadge(index) {
        if (index === 0) return '<span class="rank-badge gold">1</span>';
        if (index === 1) return '<span class="rank-badge silver">2</span>';
        if (index === 2) return '<span class="rank-badge bronze">3</span>';
        return `<span style="padding-left: 8px">${index + 1}</span>`;
    },

    renderHeatmap() {
        const container = document.getElementById('spread-heatmap');
        if (!container) return;

        // Use MarketDataProvider to get heatmap data
        const MDP = window.MarketDataProvider;
        let heatmapData;

        if (MDP) {
            heatmapData = MDP.getSpreadHeatmapData();
        } else if (typeof SyndiData !== 'undefined' && SyndiData.heatmap) {
            heatmapData = SyndiData.heatmap;
        } else {
            container.innerHTML = '<div class="empty-state">No heatmap data available</div>';
            return;
        }

        const { ratings, sectors, data, disclaimer } = heatmapData;
        const rows = data || [];

        container.innerHTML = `
            <div class="heatmap-grid" role="grid" aria-label="Spread Heatmap">
                <div class="heatmap-header" role="columnheader"></div>
                ${sectors.map(s => `<div class="heatmap-header" role="columnheader">${s}</div>`).join('')}
                ${ratings.map((rating, ri) => {
            const rowData = rows[ri] || [];
            return `
                        <div class="heatmap-row-label" role="rowheader">${rating}</div>
                        ${sectors.map((_, si) => {
                const spread = rowData[si];
                return `<div class="heatmap-cell ${this.getHeatLevel(spread)}" role="gridcell" aria-label="${rating} ${sectors[si]}: ${spread || '-'} bps">${spread || '-'}</div>`;
            }).join('')}
                    `;
        }).join('')}
            </div>
            <div class="heatmap-footer">
                Spread (bps) by Credit Rating × Industry Sector
            </div>
            ${disclaimer ? `<div class="analytics-disclaimer">⚠️ ${disclaimer}</div>` : ''}
        `;
    },

    /**
     * Get heat level class based on spread
     * Uses configurable thresholds instead of hardcoded values
     */
    getHeatLevel(spread) {
        const cfg = this.heatmapConfig;
        if (spread < cfg.level1Max) return 'level-1';
        if (spread < cfg.level2Max) return 'level-2';
        if (spread < cfg.level3Max) return 'level-3';
        return 'level-4';
    },

    renderVolumeChart() {
        const container = document.getElementById('volume-chart');
        if (!container) return;

        // Use MarketDataProvider for volume data
        const MDP = window.MarketDataProvider;
        let volumeData, disclaimer;

        if (MDP) {
            const chartData = MDP.getVolumeChartData();
            volumeData = chartData.values;
            disclaimer = chartData.disclaimer;
        } else if (typeof SyndiData !== 'undefined' && SyndiData.volumeData) {
            volumeData = SyndiData.volumeData;
            disclaimer = null;
        } else {
            container.innerHTML = '<div class="empty-state">No volume data available</div>';
            return;
        }

        const numericVolumes = volumeData.filter(v => typeof v === 'number');
        const max = numericVolumes.length ? Math.max(...numericVolumes) : 1;
        const today = new Date();

        container.innerHTML = `
            <div class="volume-chart" role="img" aria-label="Syndication Volume over last 30 days">
                ${volumeData.map((v, i) => {
            const date = new Date(today);
            date.setDate(today.getDate() - (volumeData.length - i - 1));
            const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `<div class="volume-bar" style="height: ${(v / max) * 100}%" title="${dateLabel}: $${v}M" role="presentation"></div>`;
        }).join('')}
            </div>
            <div class="volume-chart-labels">
                <span>30 days ago</span>
                <span>Today</span>
            </div>
            ${disclaimer ? `<div class="analytics-disclaimer">⚠️ ${disclaimer}</div>` : ''}
        `;
    }
};

// Add CSS for disclaimers
const analyticsStyles = document.createElement('style');
analyticsStyles.textContent = `
    .analytics-disclaimer {
        font-size: 0.7rem;
        color: var(--text-muted);
        padding: 0.5rem;
        text-align: center;
        font-style: italic;
    }
    .small-text {
        font-size: 0.75rem;
    }
    .text-success {
        color: var(--success);
    }
    .heatmap-footer {
        margin-top: 1rem;
        font-size: 0.75rem;
        color: var(--text-muted);
        text-align: center;
    }
    .volume-chart-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--text-muted);
        padding: 0.5rem 1rem;
    }
    .empty-state {
        padding: 2rem;
        text-align: center;
        color: var(--text-muted);
    }
`;
document.head.appendChild(analyticsStyles);

window.AnalyticsComponent = AnalyticsComponent;
