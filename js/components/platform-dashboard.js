/**
 * Platform Admin Dashboard Component
 * Dedicated dashboard for platform administrators at /platform route
 * Features: System overview, agent management, analytics, configuration, audit logs
 */
const PlatformDashboard = {
    currentTab: 'overview',
    refreshInterval: null,
    agents: { originator: [], participant: [], negotiation: [], settlement: [], payment: [] },
    syndications: [],
    events: [],

    tabs: [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'agents', label: 'Agents', icon: '🤖' },
        { id: 'analytics', label: 'Analytics', icon: '📈' },
        { id: 'system', label: 'System', icon: '⚙️' },
        { id: 'audit', label: 'Audit Log', icon: '📋' }
    ],

    async init() {
        console.log('🏛️ Platform Dashboard initialized');
        await this.loadData();
    },

    async loadData() {
        try {
            const [syndications, agents, events] = await Promise.all([
                this.loadSyndications(),
                this.loadAgents(),
                this.loadEvents()
            ]);
            this.syndications = syndications;
            this.agents = agents;
            this.events = events;
        } catch (e) {
            console.warn('Failed to load platform data:', e);
        }
    },

    async loadSyndications() {
        try {
            if (window.API) {
                const data = await API.getSyndications();
                return data || [];
            }
        } catch (e) { console.warn('Syndication load error:', e); }
        return [];
    },

    async loadAgents() {
        try {
            if (window.API) {
                const data = await API.getAgents();
                return data || { originator: [], participant: [], negotiation: [], settlement: [], payment: [] };
            }
        } catch (e) { console.warn('Agents load error:', e); }
        return { originator: [], participant: [], negotiation: [], settlement: [], payment: [] };
    },

    async loadEvents() {
        try {
            if (window.API) {
                const data = await API.getAllSyndicationEvents(100);
                return data || [];
            }
        } catch (e) { console.warn('Events load error:', e); }
        return [];
    },

    async render() {
        const view = document.getElementById('view-platform');
        if (!view) return;

        // Hide default header/metrics when in platform dashboard
        this.showPlatformMode();

        await this.loadData();

        view.innerHTML = `
            <div class="platform-dashboard">
                ${this.renderHeader()}
                ${this.renderTabs()}
                <div class="platform-content" id="platform-content">
                    ${this.renderTabContent()}
                </div>
            </div>
            <style>${this.getStyles()}</style>
        `;

        this.attachEventListeners();
        this.startAutoRefresh();
    },

    showPlatformMode() {
        const header = document.querySelector('.header');
        const metricsBar = document.getElementById('metrics-bar');
        if (header) header.style.display = 'none';
        if (metricsBar) metricsBar.style.display = 'none';
    },

    hidePlatformMode() {
        const header = document.querySelector('.header');
        const metricsBar = document.getElementById('metrics-bar');
        if (header) header.style.display = '';
        if (metricsBar) metricsBar.style.display = '';
    },

    renderHeader() {
        const activeCount = this.syndications.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length;
        const totalAgents = this.getTotalAgentCount();

        return `
            <div class="platform-header">
                <div class="platform-logo">
                    <div class="platform-logo-icon">SM</div>
                    <div class="platform-logo-text">
                        <span class="platform-title">SyndiMatch</span>
                        <span class="platform-subtitle">Platform Admin</span>
                    </div>
                </div>
                <div class="platform-header-stats">
                    <div class="header-stat">
                        <span class="stat-value">${activeCount}</span>
                        <span class="stat-label">Active Deals</span>
                    </div>
                    <div class="header-stat">
                        <span class="stat-value">${totalAgents}</span>
                        <span class="stat-label">Total Agents</span>
                    </div>
                    <div class="header-stat status">
                        <span class="status-dot green pulse"></span>
                        <span class="stat-label">System Nominal</span>
                    </div>
                </div>
                <div class="platform-header-actions">
                    <button class="btn-header" onclick="PlatformDashboard.refreshAll()">↻ Refresh</button>
                    <select class="role-switch" onchange="PlatformDashboard.switchRole(this.value)">
                        <option value="platform" selected>Platform Admin</option>
                        <option value="originator">Switch to Originator</option>
                        <option value="participant">Switch to Participant</option>
                    </select>
                </div>
            </div>
        `;
    },

    renderTabs() {
        return `
            <div class="platform-tabs">
                ${this.tabs.map(tab => `
                    <button class="platform-tab ${this.currentTab === tab.id ? 'active' : ''}" 
                            data-tab="${tab.id}">
                        <span class="tab-icon">${tab.icon}</span>
                        <span class="tab-label">${tab.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    },

    renderTabContent() {
        switch (this.currentTab) {
            case 'overview': return this.renderOverviewTab();
            case 'agents': return this.renderAgentsTab();
            case 'analytics': return this.renderAnalyticsTab();
            case 'system': return this.renderSystemTab();
            case 'audit': return this.renderAuditTab();
            default: return this.renderOverviewTab();
        }
    },

    // ==================== OVERVIEW TAB ====================
    renderOverviewTab() {
        const active = this.syndications.filter(s => s.status !== 'completed' && s.status !== 'cancelled');
        const totalVolume = active.reduce((sum, s) => sum + (s.amount || 0), 0);
        const avgSubscription = active.length > 0
            ? (active.reduce((sum, s) => sum + (s.subscription || 0), 0) / active.length).toFixed(1)
            : 0;

        return `
            <div class="overview-tab">
                <div class="metrics-grid">
                    <div class="metric-card primary">
                        <div class="metric-icon">📊</div>
                        <div class="metric-info">
                            <div class="metric-value">${active.length}</div>
                            <div class="metric-label">Active Syndications</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">💰</div>
                        <div class="metric-info">
                            <div class="metric-value">$${totalVolume}M</div>
                            <div class="metric-label">In-Flight Volume</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">📈</div>
                        <div class="metric-info">
                            <div class="metric-value">${avgSubscription}%</div>
                            <div class="metric-label">Avg Subscription</div>
                        </div>
                    </div>
                    <div class="metric-card success">
                        <div class="metric-icon">✅</div>
                        <div class="metric-info">
                            <div class="metric-value">${this.syndications.filter(s => s.status === 'completed').length}</div>
                            <div class="metric-label">Completed Today</div>
                        </div>
                    </div>
                </div>

                <div class="overview-grid">
                    <div class="pipeline-section">
                        <div class="section-header">
                            <h3>Syndication Pipeline</h3>
                            <span class="live-badge">● LIVE</span>
                        </div>
                        <div class="pipeline-kanban">
                            ${this.renderKanban()}
                        </div>
                    </div>
                    <div class="activity-section">
                        <div class="section-header">
                            <h3>Activity Feed</h3>
                            <span class="event-count">${this.events.length} events</span>
                        </div>
                        <div class="activity-feed">
                            ${this.renderActivityFeed()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderKanban() {
        const stages = ['open', 'negotiating', 'closing', 'settlement', 'funding'];
        const stageLabels = { open: 'Open', negotiating: 'Negotiating', closing: 'Closing', settlement: 'Settlement', funding: 'Funding' };
        const stageColors = { open: '#3B82F6', negotiating: '#F59E0B', closing: '#8B5CF6', settlement: '#10B981', funding: '#06B6D4' };

        return stages.map(stage => {
            const deals = this.syndications.filter(s => s.status === stage || s.phase === stage);
            return `
                <div class="kanban-column">
                    <div class="kanban-header" style="border-color: ${stageColors[stage]}">
                        <span class="kanban-title">${stageLabels[stage]}</span>
                        <span class="kanban-count" style="background: ${stageColors[stage]}">${deals.length}</span>
                    </div>
                    <div class="kanban-cards">
                        ${deals.length > 0 ? deals.slice(0, 5).map(d => `
                            <div class="kanban-card" onclick="Router.navigate('/${d._id || d.id}/overview')">
                                <div class="card-id">${d._id || d.id}</div>
                                <div class="card-borrower">${d.borrower || d.loan_details?.borrower_name || 'Unknown'}</div>
                                <div class="card-amount">$${d.amount || 0}M</div>
                                <div class="card-progress">
                                    <div class="progress-bar"><div class="progress-fill" style="width: ${d.subscription || 0}%"></div></div>
                                    <span>${d.subscription || 0}%</span>
                                </div>
                            </div>
                        `).join('') : '<div class="kanban-empty">No deals</div>'}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderActivityFeed() {
        if (!this.events || this.events.length === 0) {
            return '<div class="activity-empty">No recent activity</div>';
        }

        return this.events.slice(0, 30).map(e => {
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

    // ==================== AGENTS TAB ====================
    renderAgentsTab() {
        const allAgents = [
            ...this.agents.originator.map(a => ({ ...a, role: 'Originator' })),
            ...this.agents.participant.map(a => ({ ...a, role: 'Participant' })),
            ...(this.agents.negotiation || []).map(a => ({ ...a, role: 'Negotiation' })),
            ...(this.agents.settlement || []).map(a => ({ ...a, role: 'Settlement' })),
            ...(this.agents.payment || []).map(a => ({ ...a, role: 'Payment' }))
        ];

        return `
            <div class="agents-tab">
                <div class="agents-summary">
                    <div class="summary-card">
                        <span class="summary-value">${this.agents.originator?.length || 0}</span>
                        <span class="summary-label">Originators</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-value">${this.agents.participant?.length || 0}</span>
                        <span class="summary-label">Participants</span>
                    </div>
                    <div class="summary-card">
                        <span class="summary-value">${(this.agents.negotiation?.length || 0) + (this.agents.settlement?.length || 0) + (this.agents.payment?.length || 0)}</span>
                        <span class="summary-label">System Agents</span>
                    </div>
                    <div class="summary-card success">
                        <span class="summary-value">${allAgents.length}</span>
                        <span class="summary-label">Total Active</span>
                    </div>
                </div>

                <div class="agents-grid">
                    ${allAgents.length > 0 ? allAgents.map(agent => `
                        <div class="agent-card">
                            <div class="agent-header">
                                <span class="agent-id">${agent._id || agent.id || 'N/A'}</span>
                                <span class="agent-role ${agent.role.toLowerCase()}">${agent.role}</span>
                            </div>
                            <div class="agent-name">${agent.name || 'Unknown'}</div>
                            <div class="agent-stats">
                                <div class="agent-stat">
                                    <span class="stat-label">Risk Tolerance</span>
                                    <span class="stat-value">${agent.risk_tolerance || agent.riskTolerance || 'N/A'}</span>
                                </div>
                                <div class="agent-stat">
                                    <span class="stat-label">Capacity</span>
                                    <span class="stat-value">${agent.capacity ? '$' + (agent.capacity / 1000000).toFixed(0) + 'M' : 'N/A'}</span>
                                </div>
                            </div>
                            <div class="agent-status">
                                <span class="status-dot green"></span> Active
                            </div>
                        </div>
                    `).join('') : '<div class="no-agents">No agents found. Start the backend to load agents.</div>'}
                </div>
            </div>
        `;
    },

    // ==================== ANALYTICS TAB ====================
    renderAnalyticsTab() {
        const completed = this.syndications.filter(s => s.status === 'completed');
        const totalVolume = this.syndications.reduce((sum, s) => sum + (s.amount || 0), 0);
        const avgSpread = this.syndications.length > 0
            ? (this.syndications.reduce((sum, s) => sum + (s.spread || s.finalSpread || 400), 0) / this.syndications.length).toFixed(0)
            : 0;

        return `
            <div class="analytics-tab">
                <div class="analytics-kpis">
                    <div class="kpi-card">
                        <div class="kpi-value">$${totalVolume}M</div>
                        <div class="kpi-label">Total Volume</div>
                        <div class="kpi-trend positive">+12% vs last month</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${completed.length}</div>
                        <div class="kpi-label">Completed Deals</div>
                        <div class="kpi-trend positive">On track</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${avgSpread} bps</div>
                        <div class="kpi-label">Avg Spread</div>
                        <div class="kpi-trend neutral">Market rate</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">$${(totalVolume * 0.005).toFixed(1)}M</div>
                        <div class="kpi-label">Platform Fees</div>
                        <div class="kpi-trend positive">+8% vs last month</div>
                    </div>
                </div>

                <div class="analytics-charts">
                    <div class="chart-section">
                        <h3>Syndication Volume by Status</h3>
                        <div class="status-breakdown">
                            ${this.renderStatusBreakdown()}
                        </div>
                    </div>
                    <div class="chart-section">
                        <h3>Top Originators</h3>
                        <div class="top-originators">
                            ${this.renderTopOriginators()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderStatusBreakdown() {
        const statusCounts = {};
        this.syndications.forEach(s => {
            const status = s.status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const total = this.syndications.length || 1;
        const colors = { open: '#3B82F6', negotiating: '#F59E0B', closing: '#8B5CF6', settlement: '#10B981', funding: '#06B6D4', completed: '#22C55E' };

        return Object.entries(statusCounts).map(([status, count]) => `
            <div class="breakdown-row">
                <span class="breakdown-label">${status}</span>
                <div class="breakdown-bar">
                    <div class="breakdown-fill" style="width: ${(count / total * 100).toFixed(0)}%; background: ${colors[status] || '#94A3B8'}"></div>
                </div>
                <span class="breakdown-value">${count}</span>
            </div>
        `).join('');
    },

    renderTopOriginators() {
        const originatorCounts = {};
        this.syndications.forEach(s => {
            const orig = s.originator_agent_id || s.originator || 'Unknown';
            originatorCounts[orig] = (originatorCounts[orig] || 0) + 1;
        });

        return Object.entries(originatorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([orig, count], i) => `
                <div class="originator-row">
                    <span class="rank">#${i + 1}</span>
                    <span class="originator-name">${orig}</span>
                    <span class="deal-count">${count} deals</span>
                </div>
            `).join('') || '<div class="no-data">No data available</div>';
    },

    // ==================== SYSTEM TAB ====================
    renderSystemTab() {
        const isRunning = window.SimulationEngine?.state?.isRunning || false;
        const simDate = window.SimulationEngine?.formatDate?.(window.SimulationEngine?.state?.currentDate) || 'N/A';
        const speed = window.SimulationEngine?.state?.speedMultiplier || 12;

        return `
            <div class="system-tab">
                <div class="system-section">
                    <h3>Simulation Controls</h3>
                    <div class="sim-controls">
                        <div class="sim-status-row">
                            <span class="sim-label">Status:</span>
                            <span class="sim-status ${isRunning ? 'running' : 'stopped'}">
                                ${isRunning ? '▶ Running' : '⏸ Stopped'}
                            </span>
                        </div>
                        <div class="sim-status-row">
                            <span class="sim-label">Sim Date:</span>
                            <span class="sim-date">${simDate}</span>
                        </div>
                        <div class="sim-status-row">
                            <span class="sim-label">Speed:</span>
                            <input type="range" id="speed-slider" min="5" max="24" value="${speed}" 
                                   onchange="PlatformDashboard.setSimSpeed(this.value)">
                            <span id="speed-value">${Math.round(speed / 2.4)} Days/s</span>
                        </div>
                        <div class="sim-buttons">
                            <button class="btn-sim start" onclick="PlatformDashboard.startSim()" ${isRunning ? 'disabled' : ''}>▶ Start</button>
                            <button class="btn-sim stop" onclick="PlatformDashboard.stopSim()" ${!isRunning ? 'disabled' : ''}>⏸ Stop</button>
                            <button class="btn-sim reset" onclick="PlatformDashboard.resetSim()">🔄 Reset</button>
                        </div>
                    </div>
                </div>

                <div class="system-section">
                    <h3>API Status</h3>
                    <div class="api-status">
                        <div class="api-row">
                            <span class="api-name">Node.js Server</span>
                            <span class="api-endpoint">localhost:3001</span>
                            <span class="api-status-badge ${window.API?.useMockData ? 'offline' : 'online'}">${window.API?.useMockData ? 'Mock' : 'Live'}</span>
                        </div>
                        <div class="api-row">
                            <span class="api-name">Python Agents</span>
                            <span class="api-endpoint">localhost:8000</span>
                            <span class="api-status-badge online">Connected</span>
                        </div>
                        <div class="api-row">
                            <span class="api-name">MongoDB</span>
                            <span class="api-endpoint">Atlas</span>
                            <span class="api-status-badge online">Connected</span>
                        </div>
                    </div>
                </div>

                <div class="system-section">
                    <h3>Quick Links</h3>
                    <div class="quick-links">
                        <a href="/agent-rules" class="quick-link" onclick="event.preventDefault(); Router.navigate('/agent-rules');">
                            <span class="link-icon">📋</span> Agent Ruleset
                        </a>
                        <a href="/syndication-process" class="quick-link" onclick="event.preventDefault(); Router.navigate('/syndication-process');">
                            <span class="link-icon">🔄</span> Process Details
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    // ==================== AUDIT TAB ====================
    renderAuditTab() {
        return `
            <div class="audit-tab">
                <div class="audit-header">
                    <h3>System Event Log</h3>
                    <div class="audit-filters">
                        <select class="audit-filter" onchange="PlatformDashboard.filterAudit(this.value)">
                            <option value="all">All Events</option>
                            <option value="bid">Bids</option>
                            <option value="allocation">Allocations</option>
                            <option value="payment">Payments</option>
                            <option value="system">System</option>
                        </select>
                        <button class="btn-export" onclick="PlatformDashboard.exportAudit()">📥 Export</button>
                    </div>
                </div>
                <div class="audit-log">
                    ${this.events.length > 0 ? this.events.slice(0, 50).map(e => `
                        <div class="audit-row">
                            <span class="audit-time">${e.timestamp ? new Date(e.timestamp).toLocaleString() : 'N/A'}</span>
                            <span class="audit-type">${e.event_type || 'SYSTEM'}</span>
                            <span class="audit-synd">${e.syndication_id || '-'}</span>
                            <span class="audit-details">${e.details ? JSON.stringify(e.details).slice(0, 50) : '-'}</span>
                        </div>
                    `).join('') : '<div class="no-events">No events recorded</div>'}
                </div>
            </div>
        `;
    },

    // ==================== HELPERS ====================
    getTotalAgentCount() {
        return (this.agents.originator?.length || 0) +
            (this.agents.participant?.length || 0) +
            (this.agents.negotiation?.length || 0) +
            (this.agents.settlement?.length || 0) +
            (this.agents.payment?.length || 0);
    },

    attachEventListeners() {
        document.querySelectorAll('.platform-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentTab = tab.dataset.tab;
                this.updateTabContent();
            });
        });
    },

    updateTabContent() {
        // Update tab buttons
        document.querySelectorAll('.platform-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === this.currentTab);
        });
        // Update content
        const content = document.getElementById('platform-content');
        if (content) content.innerHTML = this.renderTabContent();
    },

    async refreshAll() {
        await this.loadData();
        this.updateTabContent();

        // Update header stats
        const activeCount = this.syndications.filter(s => s.status !== 'completed' && s.status !== 'cancelled').length;
        const statValue = document.querySelector('.header-stat .stat-value');
        if (statValue) statValue.textContent = activeCount;
    },

    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => this.refreshAll(), 30000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    // Simulation controls
    startSim() {
        if (window.SimulationEngine) {
            SimulationEngine.start();
            this.updateTabContent();
        }
    },

    stopSim() {
        if (window.SimulationEngine) {
            SimulationEngine.stop();
            this.updateTabContent();
        }
    },

    resetSim() {
        if (window.SimulationEngine) {
            SimulationEngine.reset();
            this.refreshAll();
        }
    },

    setSimSpeed(value) {
        if (window.SimulationEngine) {
            SimulationEngine.setSpeed(parseInt(value));
            const label = document.getElementById('speed-value');
            if (label) label.textContent = `${Math.round(value / 2.4)} Days/s`;
        }
    },

    switchRole(role) {
        this.hidePlatformMode();
        if (window.RoleRouter) {
            RoleRouter.switchRole(role, null);
        }
    },

    filterAudit(type) {
        console.log('Filter audit by:', type);
        // Could filter events in future
    },

    exportAudit() {
        const csv = this.events.map(e =>
            `${e.timestamp || ''},${e.event_type || ''},${e.syndication_id || ''},${JSON.stringify(e.details || {})}`
        ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    },

    getStyles() {
        return `
            .platform-dashboard {
                min-height: 100vh;
                background: var(--bg-main, #f8fafc);
            }

            /* Header */
            .platform-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--bg-card, #fff);
                border-bottom: 1px solid var(--border-color, #e2e8f0);
                padding: 1rem 2rem;
            }

            .platform-logo {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }

            .platform-logo-icon {
                width: 48px;
                height: 48px;
                background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
                font-weight: 700;
                color: white;
            }

            .platform-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary, #1e293b);
                display: block;
            }

            .platform-subtitle {
                font-size: 0.75rem;
                color: var(--text-muted, #94a3b8);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .platform-header-stats {
                display: flex;
                gap: 2rem;
            }

            .header-stat {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .header-stat .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--primary, #3B82F6);
            }

            .header-stat .stat-label {
                font-size: 0.75rem;
                color: var(--text-muted);
            }

            .header-stat.status {
                flex-direction: row;
                gap: 0.5rem;
            }

            .platform-header-actions {
                display: flex;
                gap: 1rem;
                align-items: center;
            }

            .btn-header {
                padding: 0.5rem 1rem;
                background: var(--bg-main);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
            }

            .btn-header:hover {
                border-color: var(--primary);
            }

            .role-switch {
                padding: 0.5rem 1rem;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                background: white;
            }

            /* Tabs */
            .platform-tabs {
                display: flex;
                background: var(--bg-card);
                border-bottom: 1px solid var(--border-color);
                padding: 0 2rem;
            }

            .platform-tab {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem 1.5rem;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 500;
                color: var(--text-muted);
                border-bottom: 3px solid transparent;
                transition: all 0.2s;
            }

            .platform-tab:hover {
                color: var(--primary);
            }

            .platform-tab.active {
                color: var(--primary);
                border-color: var(--primary);
            }

            .tab-icon {
                font-size: 1.1rem;
            }

            /* Content */
            .platform-content {
                padding: 2rem;
                max-width: 1600px;
                margin: 0 auto;
            }

            /* Metrics Grid */
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .metric-card {
                display: flex;
                align-items: center;
                gap: 1rem;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
            }

            .metric-card.primary {
                background: linear-gradient(135deg, #3B82F6 0%, #6366F1 100%);
                color: white;
                border: none;
            }

            .metric-card.primary .metric-label {
                color: rgba(255,255,255,0.8);
            }

            .metric-card.success {
                border-color: #22C55E;
            }

            .metric-icon {
                font-size: 2rem;
            }

            .metric-value {
                font-size: 1.75rem;
                font-weight: 700;
            }

            .metric-label {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            /* Overview Grid */
            .overview-grid {
                display: grid;
                grid-template-columns: 2fr 1fr;
                gap: 1.5rem;
            }

            .pipeline-section, .activity-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
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
                font-weight: 600;
            }

            .live-badge {
                color: #22C55E;
                font-size: 0.75rem;
                font-weight: 600;
                animation: pulse 2s infinite;
            }

            /* Kanban */
            .pipeline-kanban {
                display: grid;
                grid-template-columns: repeat(5, 1fr);
                gap: 1rem;
            }

            .kanban-column {
                background: var(--bg-main);
                border-radius: 8px;
                padding: 0.75rem;
            }

            .kanban-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 0.5rem;
                margin-bottom: 0.5rem;
                border-bottom: 2px solid;
            }

            .kanban-title {
                font-size: 0.7rem;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-muted);
            }

            .kanban-count {
                font-size: 0.7rem;
                font-weight: 700;
                color: white;
                padding: 0.15rem 0.5rem;
                border-radius: 10px;
            }

            .kanban-cards {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                min-height: 200px;
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

            .card-id {
                font-size: 0.65rem;
                font-weight: 600;
                color: var(--primary);
                margin-bottom: 0.25rem;
            }

            .card-borrower {
                font-size: 0.8rem;
                font-weight: 600;
                margin-bottom: 0.25rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .card-amount {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-bottom: 0.5rem;
            }

            .card-progress {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.7rem;
                font-weight: 600;
                color: var(--primary);
            }

            .progress-bar {
                flex: 1;
                height: 4px;
                background: var(--bg-main);
                border-radius: 2px;
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                background: var(--primary);
            }

            .kanban-empty {
                text-align: center;
                padding: 2rem 1rem;
                color: var(--text-muted);
                font-size: 0.75rem;
            }

            /* Activity Feed */
            .activity-feed {
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
                min-width: 100px;
            }

            .activity-type.success { color: #22C55E; }
            .activity-type.error { color: #EF4444; }
            .activity-type.info { color: var(--primary); }

            .activity-empty {
                text-align: center;
                padding: 2rem;
                color: var(--text-muted);
            }

            /* Agents Tab */
            .agents-summary {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 2rem;
            }

            .summary-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
            }

            .summary-card.success {
                background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
                color: white;
                border: none;
            }

            .summary-value {
                display: block;
                font-size: 2rem;
                font-weight: 700;
            }

            .summary-label {
                font-size: 0.875rem;
                color: var(--text-muted);
            }

            .summary-card.success .summary-label {
                color: rgba(255,255,255,0.8);
            }

            .agents-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1rem;
            }

            .agent-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.25rem;
            }

            .agent-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }

            .agent-id {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--primary);
                font-family: monospace;
            }

            .agent-role {
                font-size: 0.65rem;
                font-weight: 600;
                text-transform: uppercase;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                background: var(--bg-main);
            }

            .agent-role.originator { background: #DBEAFE; color: #1D4ED8; }
            .agent-role.participant { background: #D1FAE5; color: #059669; }

            .agent-name {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 0.75rem;
            }

            .agent-stats {
                display: flex;
                gap: 1rem;
                margin-bottom: 0.75rem;
                font-size: 0.8rem;
            }

            .agent-stat .stat-label {
                color: var(--text-muted);
                display: block;
                font-size: 0.7rem;
            }

            .agent-status {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.8rem;
                color: #22C55E;
            }

            /* Analytics Tab */
            .analytics-kpis {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1.5rem;
                margin-bottom: 2rem;
            }

            .kpi-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
            }

            .kpi-value {
                font-size: 2rem;
                font-weight: 700;
                color: var(--text-primary);
            }

            .kpi-label {
                font-size: 0.875rem;
                color: var(--text-muted);
                margin-bottom: 0.5rem;
            }

            .kpi-trend {
                font-size: 0.8rem;
                font-weight: 500;
            }

            .kpi-trend.positive { color: #22C55E; }
            .kpi-trend.neutral { color: var(--text-muted); }

            .analytics-charts {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.5rem;
            }

            .chart-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
            }

            .chart-section h3 {
                margin: 0 0 1rem 0;
                font-size: 1rem;
            }

            .breakdown-row {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 0.75rem;
            }

            .breakdown-label {
                width: 100px;
                font-size: 0.8rem;
                text-transform: capitalize;
            }

            .breakdown-bar {
                flex: 1;
                height: 8px;
                background: var(--bg-main);
                border-radius: 4px;
                overflow: hidden;
            }

            .breakdown-fill {
                height: 100%;
                border-radius: 4px;
            }

            .breakdown-value {
                width: 30px;
                text-align: right;
                font-weight: 600;
            }

            .originator-row {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 0.75rem;
                border-bottom: 1px solid var(--border-color);
            }

            .rank {
                font-weight: 700;
                color: var(--primary);
            }

            .originator-name {
                flex: 1;
                font-weight: 500;
            }

            .deal-count {
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            /* System Tab */
            .system-tab {
                display: grid;
                gap: 1.5rem;
            }

            .system-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
            }

            .system-section h3 {
                margin: 0 0 1rem 0;
                font-size: 1rem;
            }

            .sim-controls {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .sim-status-row {
                display: flex;
                align-items: center;
                gap: 1rem;
            }

            .sim-label {
                width: 80px;
                font-size: 0.8rem;
                color: var(--text-muted);
            }

            .sim-status {
                font-weight: 600;
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
            }

            .sim-status.running {
                background: #D1FAE5;
                color: #059669;
            }

            .sim-status.stopped {
                background: #FEF3C7;
                color: #D97706;
            }

            .sim-date {
                font-family: monospace;
                font-weight: 600;
            }

            .sim-buttons {
                display: flex;
                gap: 0.5rem;
                margin-top: 0.5rem;
            }

            .btn-sim {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 6px;
                font-weight: 600;
                cursor: pointer;
            }

            .btn-sim:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .btn-sim.start { background: #22C55E; color: white; }
            .btn-sim.stop { background: #F59E0B; color: white; }
            .btn-sim.reset { background: var(--bg-main); }

            .api-status {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .api-row {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 0.75rem;
                background: var(--bg-main);
                border-radius: 8px;
            }

            .api-name {
                width: 120px;
                font-weight: 500;
            }

            .api-endpoint {
                flex: 1;
                font-family: monospace;
                font-size: 0.85rem;
                color: var(--text-muted);
            }

            .api-status-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 600;
            }

            .api-status-badge.online {
                background: #D1FAE5;
                color: #059669;
            }

            .api-status-badge.offline {
                background: #FEE2E2;
                color: #DC2626;
            }

            .quick-links {
                display: flex;
                gap: 1rem;
            }

            .quick-link {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem 1.5rem;
                background: var(--bg-main);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                text-decoration: none;
                color: var(--text-primary);
                font-weight: 500;
                transition: all 0.2s;
            }

            .quick-link:hover {
                border-color: var(--primary);
            }

            /* Audit Tab */
            .audit-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }

            .audit-filters {
                display: flex;
                gap: 0.5rem;
            }

            .audit-filter {
                padding: 0.5rem 1rem;
                border: 1px solid var(--border-color);
                border-radius: 6px;
            }

            .btn-export {
                padding: 0.5rem 1rem;
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                cursor: pointer;
            }

            .audit-log {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                max-height: 600px;
                overflow-y: auto;
            }

            .audit-row {
                display: grid;
                grid-template-columns: 180px 120px 150px 1fr;
                gap: 1rem;
                padding: 0.75rem 1rem;
                border-bottom: 1px solid var(--border-color);
                font-size: 0.85rem;
            }

            .audit-time {
                font-family: monospace;
                color: var(--text-muted);
            }

            .audit-type {
                font-weight: 600;
            }

            .audit-synd {
                color: var(--primary);
                font-family: monospace;
            }

            .audit-details {
                color: var(--text-muted);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .no-events, .no-agents, .no-data {
                text-align: center;
                padding: 3rem;
                color: var(--text-muted);
            }

            /* Utilities */
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                display: inline-block;
            }

            .status-dot.green {
                background: #22C55E;
            }

            .status-dot.pulse {
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            /* Responsive */
            @media (max-width: 1200px) {
                .overview-grid {
                    grid-template-columns: 1fr;
                }
                .pipeline-kanban {
                    grid-template-columns: repeat(3, 1fr);
                }
                .metrics-grid, .analytics-kpis, .agents-summary {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            @media (max-width: 768px) {
                .platform-header {
                    flex-direction: column;
                    gap: 1rem;
                }
                .pipeline-kanban {
                    grid-template-columns: 1fr;
                }
                .metrics-grid, .analytics-kpis, .agents-summary {
                    grid-template-columns: 1fr;
                }
                .analytics-charts {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }
};

window.PlatformDashboard = PlatformDashboard;
