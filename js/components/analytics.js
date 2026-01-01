// ========================================
// Analytics Component
// ========================================

const AnalyticsComponent = {
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

        const sorted = [...SyndiData.participants].sort((a, b) => b.winRate - a.winRate);
        const top = sorted.slice(0, 8);

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
                                <div class="text-muted" style="font-size: 0.75rem">${p.type}</div>
                            </td>
                            <td><strong style="color: var(--success)">${p.winRate}%</strong></td>
                            <td>${p.bids}</td>
                            <td>${Utils.formatCurrency(p.volume * 1000000)}</td>
                            <td>
                                <span class="${p.onTime < 90 ? 'text-warning' : ''}">${p.onTime}%</span>
                                ${p.late ? `<span class="text-danger"> (${p.late} late)</span>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
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

        const { ratings, sectors, data } = SyndiData.heatmap;

        container.innerHTML = `
            <div class="heatmap-grid">
                <div class="heatmap-header"></div>
                ${sectors.map(s => `<div class="heatmap-header">${s}</div>`).join('')}
                ${ratings.map((rating, ri) => `
                    <div class="heatmap-row-label">${rating}</div>
                    ${data[ri].map(spread => `
                        <div class="heatmap-cell ${this.getHeatLevel(spread)}">${spread}</div>
                    `).join('')}
                `).join('')}
            </div>
            <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--text-muted); text-align: center;">
                Spread (bps) by Credit Rating × Industry Sector
            </div>
        `;
    },

    getHeatLevel(spread) {
        if (spread < 250) return 'level-1';
        if (spread < 350) return 'level-2';
        if (spread < 500) return 'level-3';
        return 'level-4';
    },

    renderVolumeChart() {
        const container = document.getElementById('volume-chart');
        if (!container) return;

        const max = Math.max(...SyndiData.volumeData);

        container.innerHTML = `
            <div class="volume-chart">
                ${SyndiData.volumeData.map((v, i) => `
                    <div class="volume-bar" style="height: ${(v / max) * 100}%" title="Day ${i + 1}: $${v}M"></div>
                `).join('')}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); padding: 0.5rem 1rem;">
                <span>30 days ago</span>
                <span>Today</span>
            </div>
        `;
    }
};
