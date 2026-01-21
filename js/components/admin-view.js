/**
 * Admin View Component - Platform Command Center
 * Real-time dashboard for monitoring syndication activity, agent health, and platform metrics.
 */
const AdminView = {
    refreshInterval: null,

    init() {
        console.log('📡 Admin Dashboard initialized');
    },

    /**
     * Render the main Platform Admin Dashboard
     */
    async renderDashboard(view) {
        // Load live data
        const [syndications, events, agents] = await Promise.all([
            this.loadSyndications(),
            this.loadEvents(),
            this.loadAgents()
        ]);

        const metrics = this.calculateLiveMetrics(syndications);
        const agentHealth = this.calculateAgentHealth(agents);

        view.innerHTML = `
            <div class="admin-dashboard-container">
                <!-- Header -->
                <div class="page-header-flex">
                    <h2 class="page-title">Platform Command Center</h2>
                    <div class="header-controls">
                        <span class="system-status"><span class="status-dot green pulse"></span> System Nominal</span>
                        <div class="last-updated">Updated: ${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>

                <!-- Hero Metrics Bar -->
                <div class="admin-metrics-bar">
                    <div class="admin-metric-card">
                        <div class="metric-icon">📊</div>
                        <div class="metric-content">
                            <div class="metric-value">${metrics.activeDeals}</div>
                            <div class="metric-label">Active Deals</div>
                        </div>
                    </div>
                    <div class="admin-metric-card">
                        <div class="metric-icon">💰</div>
                        <div class="metric-content">
                            <div class="metric-value">$${metrics.totalVolume}M</div>
                            <div class="metric-label">In-Flight Volume</div>
                        </div>
                    </div>
                    <div class="admin-metric-card">
                        <div class="metric-icon">🏦</div>
                        <div class="metric-content">
                            <div class="metric-value">$${metrics.feesCollected}K</div>
                            <div class="metric-label">Fees Collected</div>
                        </div>
                    </div>
                    <div class="admin-metric-card">
                        <div class="metric-icon">🤖</div>
                        <div class="metric-content">
                            <div class="metric-value">${agentHealth.active}/${agentHealth.total}</div>
                            <div class="metric-label">Agents Active</div>
                        </div>
                    </div>
                </div>

                <!-- Main Grid: Pipeline + Activity Feed -->
                <div class="admin-main-grid">
                    <!-- Pipeline Kanban -->
                    <div class="admin-pipeline-section">
                        <div class="section-header">
                            <h3>Active Pipeline</h3>
                            <button class="btn-sm btn-primary" onclick="AdminView.refreshDashboard()">↻ Refresh</button>
                        </div>
                        <div class="admin-pipeline-kanban" id="admin-pipeline-kanban">
                            ${this.renderPipelineKanban(syndications)}
                        </div>
                    </div>

                    <!-- Activity Feed -->
                    <div class="admin-activity-section">
                        <div class="section-header">
                            <h3>Activity Feed</h3>
                            <span class="live-indicator">● LIVE</span>
                        </div>
                        <div class="admin-activity-feed" id="admin-activity-feed">
                            ${this.renderActivityFeed(events)}
                        </div>
                    </div>
                </div>

                <!-- Simulation Controls (Admin Only) -->
                <div class="admin-sim-controls" id="admin-sim-controls">
                    <div class="section-header">
                        <h3>Simulation Controls</h3>
                    </div>
                    <div class="sim-controls-row">
                        <div class="sim-control-group">
                            <label>Status</label>
                            <span class="sim-status ${window.SimulationEngine?.state?.isRunning ? 'running' : 'stopped'}">
                                ${window.SimulationEngine?.state?.isRunning ? '▶ Running' : '⏸ Stopped'}
                            </span>
                        </div>
                        <div class="sim-control-group">
                            <label>Sim Date</label>
                            <span class="sim-date">${window.SimulationEngine?.formatDate(window.SimulationEngine?.state?.currentDate) || 'N/A'}</span>
                        </div>
                        <div class="sim-control-group">
                            <label>Speed</label>
                            <input type="range" id="admin-speed-slider" min="5" max="24" 
                                   value="${window.SimulationEngine?.state?.speedMultiplier || 12}" 
                                   onchange="AdminView.setSimSpeed(this.value)">
                            <span id="admin-speed-value">${Math.round((window.SimulationEngine?.state?.speedMultiplier || 12) / 2.4)} Days/s</span>
                        </div>
                        <div class="sim-control-group buttons">
                            <button class="btn-sim btn-start" onclick="AdminView.startSimulation()" 
                                    ${window.SimulationEngine?.state?.isRunning ? 'disabled' : ''}>▶ Start</button>
                            <button class="btn-sim btn-stop" onclick="AdminView.stopSimulation()"
                                    ${!window.SimulationEngine?.state?.isRunning ? 'disabled' : ''}>⏸ Stop</button>
                            <button class="btn-sim btn-reset" onclick="AdminView.resetSimulation()">🔄 Reset</button>
                        </div>
                    </div>
                </div>

                <!-- Quick Links -->
                <div class="admin-quick-links">
                    <a href="/agent-rules" class="quick-link-card" onclick="event.preventDefault(); Router.navigate('/agent-rules');">
                        <span class="quick-link-icon">📋</span>
                        <span class="quick-link-title">Agent Ruleset</span>
                        <span class="quick-link-desc">View agent decision logic</span>
                    </a>
                    <a href="/syndication-process" class="quick-link-card" onclick="event.preventDefault(); Router.navigate('/syndication-process');">
                        <span class="quick-link-icon">🔄</span>
                        <span class="quick-link-title">Process Details</span>
                        <span class="quick-link-desc">Syndication lifecycle guide</span>
                    </a>
                </div>
            </div>

            <style>
                ${this.getStyles()}
            </style>
        `;

        // Start auto-refresh
        this.startAutoRefresh();
    },

    /**
     * Load syndications (exclude completed)
     */
    async loadSyndications() {
        try {
            if (window.API && !API.useMockData) {
                const data = await API.getSyndications();
                return (data || []).filter(s => s.status !== 'completed' && s.status !== 'cancelled');
            }
        } catch (e) {
            console.warn('Failed to load syndications:', e);
        }
        return (window.SyndiData?.syndications || []).filter(s => s.status !== 'completed' && s.status !== 'cancelled');
    },

    /**
     * Load recent events
     */
    async loadEvents() {
        try {
            if (window.API && !API.useMockData) {
                return await API.getAllSyndicationEvents(50);
            }
        } catch (e) {
            console.warn('Failed to load events:', e);
        }
        return [];
    },

    /**
     * Load agent data
     */
    async loadAgents() {
        try {
            if (window.API && !API.useMockData) {
                return await API.getAgents();
            }
        } catch (e) {
            console.warn('Failed to load agents:', e);
        }
        return { originator: [], participant: [], negotiation: [], settlement: [], payment: [] };
    },

    /**
     * Calculate live metrics from syndication data
     */
    calculateLiveMetrics(syndications) {
        const activeDeals = syndications.length;
        const totalVolume = syndications.reduce((sum, s) => sum + (s.amount || 0), 0);
        const feesCollected = Math.round(totalVolume * 5); // 0.5% of volume in thousands

        return {
            activeDeals,
            totalVolume: totalVolume.toFixed(0),
            feesCollected: feesCollected.toFixed(0)
        };
    },

    /**
     * Calculate agent health summary
     */
    calculateAgentHealth(agents) {
        const origCount = agents?.originator?.length || 0;
        const partCount = agents?.participant?.length || 0;
        const negCount = agents?.negotiation?.length || 0;
        const settCount = agents?.settlement?.length || 0;
        const payCount = agents?.payment?.length || 0;

        const total = origCount + partCount + negCount + settCount + payCount;
        const active = total; // Assume all loaded agents are active

        return { active, total: Math.max(total, 5) };
    },

    /**
     * Render Pipeline Kanban (no Completed column)
     */
    renderPipelineKanban(syndications) {
        const stages = ['open', 'negotiating', 'closing', 'settlement', 'funding'];
        const stageLabels = {
            open: 'Open',
            negotiating: 'Negotiating',
            closing: 'Closing',
            settlement: 'Settlement',
            funding: 'Funding'
        };

        return stages.map(stage => {
            const deals = syndications.filter(s => s.status === stage || s.phase === stage);
            return `
                <div class="kanban-column">
                    <div class="kanban-header">
                        <span class="kanban-title">${stageLabels[stage]}</span>
                        <span class="kanban-count">${deals.length}</span>
                    </div>
                    <div class="kanban-cards">
                        ${deals.length > 0 ? deals.map(d => `
                            <div class="kanban-card" onclick="Router.navigate('/${d._id || d.id}/overview')">
                                <div class="kanban-card-id">${d._id || d.id}</div>
                                <div class="kanban-card-borrower">${d.borrower || d.loan_details?.borrower_name || 'Unknown'}</div>
                                <div class="kanban-card-amount">${Utils.formatCurrency((d.amount || 0) * 1000000)}</div>
                                <div class="kanban-card-progress">
                                    <div class="progress-bar-mini">
                                        <div class="progress-fill-mini" style="width: ${d.subscription || 0}%"></div>
                                    </div>
                                    <span>${d.subscription || 0}%</span>
                                </div>
                            </div>
                        `).join('') : '<div class="kanban-empty">No deals</div>'}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render Activity Feed
     */
    renderActivityFeed(events) {
        if (!events || events.length === 0) {
            return '<div class="activity-empty">No recent activity</div>';
        }

        return events.slice(0, 50).map(e => {
            const time = e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : 'N/A';
            const type = e.event_type || 'SYSTEM';
            const typeClass = type.toLowerCase().includes('complete') ? 'success' :
                type.toLowerCase().includes('fail') ? 'error' : 'info';

            return `
                <div class="activity-item">
                    <span class="activity-time">${time}</span>
                    <span class="activity-type ${typeClass}">${type}</span>
                    <span class="activity-synd">${e.syndication_id || ''}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Simulation Control Methods
     */
    startSimulation() {
        if (window.SimulationEngine) {
            SimulationEngine.start();
            this.refreshSimControls();
        }
    },

    stopSimulation() {
        if (window.SimulationEngine) {
            SimulationEngine.stop();
            this.refreshSimControls();
        }
    },

    resetSimulation() {
        if (window.SimulationEngine) {
            SimulationEngine.reset();
            this.refreshSimControls();
            this.refreshDashboard();
        }
    },

    setSimSpeed(value) {
        if (window.SimulationEngine) {
            SimulationEngine.setSpeed(parseInt(value));
            const label = document.getElementById('admin-speed-value');
            if (label) label.textContent = `${Math.round(value / 2.4)} Days/s`;
        }
    },

    refreshSimControls() {
        const controls = document.getElementById('admin-sim-controls');
        if (!controls) return;

        const statusEl = controls.querySelector('.sim-status');
        const dateEl = controls.querySelector('.sim-date');
        const startBtn = controls.querySelector('.btn-start');
        const stopBtn = controls.querySelector('.btn-stop');

        if (statusEl) {
            const running = window.SimulationEngine?.state?.isRunning;
            statusEl.textContent = running ? '▶ Running' : '⏸ Stopped';
            statusEl.className = `sim-status ${running ? 'running' : 'stopped'}`;
        }
        if (dateEl) {
            dateEl.textContent = window.SimulationEngine?.formatDate(window.SimulationEngine?.state?.currentDate) || 'N/A';
        }
        if (startBtn) startBtn.disabled = window.SimulationEngine?.state?.isRunning;
        if (stopBtn) stopBtn.disabled = !window.SimulationEngine?.state?.isRunning;
    },

    /**
     * Auto-refresh dashboard
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            this.refreshDashboard();
        }, 30000); // Every 30 seconds
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    async refreshDashboard() {
        const kanban = document.getElementById('admin-pipeline-kanban');
        const feed = document.getElementById('admin-activity-feed');

        if (kanban) {
            const syndications = await this.loadSyndications();
            kanban.innerHTML = this.renderPipelineKanban(syndications);
        }
        if (feed) {
            const events = await this.loadEvents();
            feed.innerHTML = this.renderActivityFeed(events);
        }

        this.refreshSimControls();

        // Update timestamp
        const updated = document.querySelector('.last-updated');
        if (updated) updated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
    },

    /**
     * Component Styles
     */
    getStyles() {
        return `
            .admin-dashboard-container {
                padding: 1.5rem;
                max-width: 1600px;
                margin: 0 auto;
            }

            .admin-metrics-bar {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 1.5rem;
            }

            .admin-metric-card {
                display: flex;
                align-items: center;
                gap: 1rem;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.25rem;
            }

            .metric-icon {
                font-size: 2rem;
            }

            .metric-value {
                font-size: 1.75rem;
                font-weight: 700;
                color: var(--text-primary);
            }

            .metric-label {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            .admin-main-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1.5rem;
                margin-bottom: 1.5rem;
            }

            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }

            .section-header h3 {
                margin: 0;
                font-size: 1rem;
                font-weight: 700;
            }

            .live-indicator {
                color: #10b981;
                font-size: 0.75rem;
                font-weight: 600;
                animation: pulse 2s infinite;
            }

            .admin-pipeline-kanban {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 0.75rem;
                background: var(--bg-muted);
                border-radius: 12px;
                padding: 1rem;
                min-height: 400px;
            }

            .kanban-column {
                background: var(--bg-card);
                border-radius: 8px;
                padding: 0.75rem;
            }

            .kanban-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.75rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color);
            }

            .kanban-title {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-muted);
            }

            .kanban-count {
                background: var(--primary);
                color: white;
                font-size: 0.7rem;
                font-weight: 700;
                padding: 0.15rem 0.4rem;
                border-radius: 10px;
            }

            .kanban-cards {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .kanban-card {
                background: white;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
            }

            .kanban-card:hover {
                border-color: var(--primary);
                box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
            }

            .kanban-card-id {
                font-size: 0.7rem;
                font-weight: 600;
                color: var(--primary);
                margin-bottom: 0.25rem;
            }

            .kanban-card-borrower {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 0.25rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .kanban-card-amount {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-bottom: 0.5rem;
            }

            .kanban-card-progress {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .progress-bar-mini {
                flex: 1;
                height: 4px;
                background: var(--bg-muted);
                border-radius: 2px;
                overflow: hidden;
            }

            .progress-fill-mini {
                height: 100%;
                background: var(--primary);
                transition: width 0.3s;
            }

            .kanban-card-progress span {
                font-size: 0.7rem;
                font-weight: 600;
                color: var(--primary);
            }

            .kanban-empty {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-align: center;
                padding: 1rem;
            }

            .admin-activity-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1rem;
            }

            .admin-activity-feed {
                max-height: 400px;
                overflow-y: auto;
            }

            .activity-item {
                display: flex;
                gap: 0.75rem;
                padding: 0.5rem 0;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.8rem;
            }

            .activity-time {
                color: var(--text-muted);
                font-family: monospace;
                min-width: 70px;
            }

            .activity-type {
                font-weight: 600;
                min-width: 120px;
            }

            .activity-type.success { color: #10b981; }
            .activity-type.error { color: #ef4444; }
            .activity-type.info { color: var(--primary); }

            .activity-synd {
                color: var(--text-muted);
            }

            .activity-empty {
                text-align: center;
                padding: 2rem;
                color: var(--text-muted);
            }

            .admin-sim-controls {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1rem 1.5rem;
                margin-bottom: 1.5rem;
            }

            .sim-controls-row {
                display: flex;
                align-items: center;
                gap: 2rem;
                flex-wrap: wrap;
            }

            .sim-control-group {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }

            .sim-control-group label {
                font-size: 0.7rem;
                font-weight: 600;
                text-transform: uppercase;
                color: var(--text-muted);
            }

            .sim-status {
                font-weight: 600;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
            }

            .sim-status.running {
                background: #dcfce7;
                color: #166534;
            }

            .sim-status.stopped {
                background: #fef3c7;
                color: #92400e;
            }

            .sim-date {
                font-family: monospace;
                font-weight: 600;
            }

            .sim-control-group.buttons {
                flex-direction: row;
                gap: 0.5rem;
                margin-left: auto;
            }

            .btn-sim {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 6px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn-sim:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .btn-start {
                background: #10b981;
                color: white;
            }

            .btn-stop {
                background: #f59e0b;
                color: white;
            }

            .btn-reset {
                background: var(--bg-muted);
                color: var(--text-primary);
            }

            .admin-quick-links {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }

            .quick-link-card {
                display: flex;
                align-items: center;
                gap: 1rem;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.25rem;
                text-decoration: none;
                transition: all 0.2s;
            }

            .quick-link-card:hover {
                border-color: var(--primary);
                background: var(--bg-muted);
            }

            .quick-link-icon {
                font-size: 2rem;
            }

            .quick-link-title {
                font-size: 1rem;
                font-weight: 700;
                color: var(--text-primary);
            }

            .quick-link-desc {
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            @media (max-width: 1200px) {
                .admin-main-grid {
                    grid-template-columns: 1fr;
                }
                .admin-pipeline-kanban {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            @media (max-width: 768px) {
                .admin-metrics-bar {
                    grid-template-columns: repeat(2, 1fr);
                }
                .admin-pipeline-kanban {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }
};

window.AdminView = AdminView;
