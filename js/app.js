// ========================================
<<<<<<< HEAD
// App.js - Main Application Entry Point
// Orchestrates initialization, state, and routing
// ========================================

const App = {
    // Initialization flag
    initialized: false,
=======
// SyndiMatch - Main Application with Hash Routing
// ========================================

const App = {
    currentView: 'overview',
    currentSyndId: null,  // Track which syndication we're viewing
    currentSubPage: null, // Track sub-page (orchestration, payments, transactions)
>>>>>>> syndication-change

    /**
     * Main Entry Point
     */
    async init() {
        if (this.initialized) return;

<<<<<<< HEAD
        console.log('🚀 Initializing SyndiMatch Platform...');

        // Show loading state
        this.showLoader();
=======
        if (window.AppState && typeof AppState.init === 'function') {
            AppState.init();
        }

        // Initialize all components
        PipelineComponent.init();
        SyndicationDetailComponent.init();
        PaymentsComponent.init();
        AgentsComponent.init();
        AnalyticsComponent.init();
        AlertsComponent.init();
        this.setupDemoToggle();

        // Setup navigation
        this.setupNavigation();
        this.setupHashRouting();
>>>>>>> syndication-change

        try {
            // 1. Initialize State & Router
            Router.init();

<<<<<<< HEAD
            // 2. Subscribe to State Changes
            this.setupSubscribers();

            // 3. Connect to Backend services
            await this.initializeBackend();

            // 4. Initialize Components
            await this.initializeComponents();

            // 5. Setup Navigation
            this.setupNavigation();

            // 6. Start Global Loops (Simulation, Auto-Refresh)
            this.startBackgroundProcesses();

            this.initialized = true;
            console.log('✅ SyndiMatch Ready');

            // Hide loader
            this.hideLoader();

        } catch (error) {
            console.error('❌ Initialization Failed:', error);
            this.showErrorScreen(error);
        }
    },

    /**
     * Initialize Backend Connections
     */
    async initializeBackend() {
        AppState.set('loadingMessage', 'Connecting to backend...');

        // Check API Connection
        const apiConnected = await API.checkConnection();
        AppState.set('connected', apiConnected);

        // Initialize WebSocket (if enabled)
        if (Config?.ENABLE_WEBSOCKET) {
            this.connectWebSocket();
        }

        // Load Initial Data
        if (window.Data) {
            await window.Data.init(); // Uses Data module which now uses API
        }
    },

    /**
     * Initialize UI Components
     */
    async initializeComponents() {
        AppState.set('loadingMessage', 'Loading components...');

        const components = [
            { name: 'Metrics', init: () => window.MetricsComponent?.init() },
            { name: 'Pipeline', init: () => window.PipelineComponent?.init() },
            { name: 'RoleContext', init: () => window.RoleRouter?.init() },
            { name: 'AutoBidder', init: () => window.AutoBidder?.init() },
            // Add other components as they are converted
        ];

        for (const component of components) {
            try {
                if (component.init) {
                    await component.init();
                    if (Config?.DEBUG) console.log(`✓ ${component.name} initialized`);
                }
            } catch (e) {
                console.warn(`⚠️ Failed to initialize ${component.name}:`, e);
                // Don't crash app, just log warning
            }
        }
    },

    /**
     * Setup State Subscribers
     */
    setupSubscribers() {
        // Handle View Switching
        AppState.subscribe('currentView', (viewName) => {
            this.switchView(viewName);
        });

        // Handle Errors
        AppState.subscribe('error', (error) => {
            if (error) this.showToast(error, 'error');
        });

        // Handle Market Condition Changes
        AppState.subscribe('marketConditions', (condition) => {
            document.body.setAttribute('data-market', condition);
        });
    },

    /**
     * WebSocket Connection (Placeholder for Agent Orchestration)
     */
    connectWebSocket() {
        // This will be fully implemented in Phase 3.2
        // For now, checks connection and handles basic events
        console.log('🔌 WebSocket connection pending implementation');
    },

    /**
     * Setup Navigation Event Listeners
     */
    setupNavigation() {
        // Tab Navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.target.dataset.view; // e.g., 'overview'
                if (view) {
                    // Update URL hash via Router
                    // This will trigger AppState update -> switchView
                    if (view === 'overview') Router.navigate('/');
                    else if (view === 'analytics') Router.navigate('/analytics');
                    else Router.navigate(`/${view}`);
=======
        // Handle initial route
        this.handleHashChange();

        console.log('✅ SyndiMatch Dashboard ready');
    },

    setupDemoToggle() {
        const toggle = document.getElementById('demo-mode-toggle');
        const label = document.getElementById('demo-mode-status');
        if (!toggle || !label || !window.API) return;

        const isDemo = localStorage.getItem(API.demoModeKey) === 'true';
        toggle.checked = isDemo;
        label.textContent = isDemo ? 'Demo On' : 'Demo';

        toggle.addEventListener('change', async () => {
            const enabled = toggle.checked;
            await API.setDemoMode(enabled);
            label.textContent = enabled ? 'Demo On' : 'Demo';
        });
    },

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                if (this.currentSyndId) {
                    // If viewing a syndication, update sub-page
                    window.location.hash = `${this.currentSyndId}/${view}`;
                } else {
                    window.location.hash = view;
>>>>>>> syndication-change
                }
            });
        });
    },

<<<<<<< HEAD
    /**
     * Start Background Processes
     */
    startBackgroundProcesses() {
        // Simulation Engine
        if (window.SimulationEngine) {
            window.SimulationEngine.start();
        }
=======
    setupHashRouting() {
        window.addEventListener('hashchange', () => this.handleHashChange());
    },

    handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove #

        if (!hash || hash === 'overview') {
            this.showOverview();
            return;
        }

        // Check if this is a syndication-specific route: SYND-xxx/page
        const syndMatch = hash.match(/^(SYND-[^/]+)\/?(orchestration|payments|transactions)?$/i);

        if (syndMatch) {
            const syndId = syndMatch[1];
            const subPage = syndMatch[2] || 'orchestration';
            this.showSyndicationPage(syndId, subPage);
        } else {
            // Simple view route (analytics, etc.)
            this.switchView(hash);
        }
    },

    showOverview() {
        this.currentSyndId = null;
        this.currentSubPage = null;
        if (window.AppState) AppState.set('activeSyndicationId', null);
        this.updateNavigationForOverview();
        this.switchView('overview');
    },

    showSyndicationPage(syndId, subPage) {
        this.currentSyndId = syndId;
        this.currentSubPage = subPage;
        if (window.AppState) AppState.set('activeSyndicationId', syndId);

        console.log(`📋 Viewing ${syndId} - ${subPage}`);

        // Update navigation to show syndication-specific tabs
        this.updateNavigationForSyndication(syndId, subPage);

        // Create or show syndication detail view
        this.renderSyndicationDetailView(syndId, subPage);
    },

    updateNavigationForOverview() {
        const navContainer = document.querySelector('.nav-tabs');
        if (!navContainer) return;

        navContainer.innerHTML = `
            <button class="nav-tab active" data-view="overview">Overview</button>
            <button class="nav-tab" data-view="analytics">Analytics</button>
        `;

        // Re-attach click handlers
        navContainer.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                window.location.hash = tab.dataset.view;
            });
        });
    },

    updateNavigationForSyndication(syndId, activeSubPage) {
        const navContainer = document.querySelector('.nav-tabs');
        if (!navContainer) return;

        const subPages = ['orchestration', 'payments', 'transactions'];

        navContainer.innerHTML = `
            <button class="nav-tab nav-back" data-view="overview">← Back</button>
            <span class="nav-divider">|</span>
            <span class="nav-synd-id">${syndId}</span>
            <span class="nav-divider">|</span>
            ${subPages.map(page => `
                <button class="nav-tab ${page === activeSubPage ? 'active' : ''}" data-view="${page}">
                    ${page.charAt(0).toUpperCase() + page.slice(1)}
                </button>
            `).join('')}
        `;

        // Inject styles for syndication nav
        this.injectSyndicationNavStyles();

        // Re-attach click handlers
        navContainer.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                if (view === 'overview') {
                    window.location.hash = 'overview';
                } else {
                    window.location.hash = `${syndId}/${view}`;
                }
            });
        });
    },

    injectSyndicationNavStyles() {
        if (document.getElementById('synd-nav-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'synd-nav-styles';
        styles.textContent = `
            .nav-back {
                color: var(--text-muted) !important;
                font-weight: 500;
            }
            .nav-back:hover {
                color: var(--primary) !important;
            }
            .nav-divider {
                color: var(--border-color);
                margin: 0 0.5rem;
                font-weight: 300;
            }
            .nav-synd-id {
                font-weight: 700;
                color: var(--primary);
                font-size: 0.875rem;
                padding: 0.5rem 0.75rem;
                background: rgba(59, 130, 246, 0.1);
                border-radius: 6px;
            }
        `;
        document.head.appendChild(styles);
    },

    renderSyndicationDetailView(syndId, subPage) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Get or create syndication detail view
        let detailView = document.getElementById('view-syndication-detail');
        if (!detailView) {
            detailView = document.createElement('div');
            detailView.id = 'view-syndication-detail';
            detailView.className = 'view';
            document.querySelector('.main-content').appendChild(detailView);
        }

        detailView.classList.add('active');

        // Render content based on sub-page
        switch (subPage) {
            case 'orchestration':
                this.renderSyndicationOrchestration(detailView, syndId);
                break;
            case 'payments':
                this.renderSyndicationPayments(detailView, syndId);
                break;
            case 'transactions':
                this.renderSyndicationTransactions(detailView, syndId);
                break;
        }
    },

    async renderSyndicationOrchestration(container, syndId) {
        // Get syndication data
        const synd = SyndiData.syndications.find(s => s.id === syndId) || {};

        container.innerHTML = `
            <div class="syndication-page">
                <div class="page-header" style="margin-bottom: 1.5rem;">
                    <h2 class="page-title" style="margin: 0; font-size: 1.5rem;">Orchestration: ${syndId}</h2>
                    <p style="margin: 0.5rem 0 0; color: var(--text-muted);">${synd.borrower || 'Unknown Borrower'} • ${Utils.formatCurrency((synd.amount || 0) * 1000000)}</p>
                </div>
                
                <!-- Agent Workflow Pipeline -->
                <div class="agent-workflow-pipeline" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 12px; border: 1px solid var(--border-color);">
                    <div class="workflow-agent" style="flex: 1; text-align: center;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 50%; background: linear-gradient(135deg, #10b981, #059669); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🏛️</div>
                        <div style="font-weight: 700; font-size: 0.875rem;">Originator Agent</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${synd.originator || 'JPMorgan'}</div>
                        <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">ACTIVE</div>
                    </div>
                    <div style="display: flex; align-items: center; color: var(--border-color); font-size: 1.5rem;">→</div>
                    <div class="workflow-agent" style="flex: 1; text-align: center;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">👥</div>
                        <div style="font-weight: 700; font-size: 0.875rem;">Participant Agents</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${synd.participantCount || 0} active</div>
                        <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">BIDDING</div>
                    </div>
                    <div style="display: flex; align-items: center; color: var(--border-color); font-size: 1.5rem;">→</div>
                    <div class="workflow-agent" style="flex: 1; text-align: center;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">⚖️</div>
                        <div style="font-weight: 700; font-size: 0.875rem;">Negotiation Agent</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Allocation Logic</div>
                        <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: ${synd.status === 'negotiating' ? '#fef3c7' : '#f3f4f6'}; color: ${synd.status === 'negotiating' ? '#92400e' : '#6b7280'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${synd.status === 'negotiating' ? 'ACTIVE' : 'WAITING'}</div>
                    </div>
                    <div style="display: flex; align-items: center; color: var(--border-color); font-size: 1.5rem;">→</div>
                    <div class="workflow-agent" style="flex: 1; text-align: center;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6d28d9); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📋</div>
                        <div style="font-weight: 700; font-size: 0.875rem;">Settlement Agent</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">Documentation</div>
                        <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: ${synd.status === 'closing' ? '#dbeafe' : '#f3f4f6'}; color: ${synd.status === 'closing' ? '#1e40af' : '#6b7280'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${synd.status === 'closing' ? 'ACTIVE' : 'WAITING'}</div>
                    </div>
                    <div style="display: flex; align-items: center; color: var(--border-color); font-size: 1.5rem;">→</div>
                    <div class="workflow-agent" style="flex: 1; text-align: center;">
                        <div style="width: 56px; height: 56px; margin: 0 auto 0.75rem; border-radius: 50%; background: linear-gradient(135deg, #ec4899, #db2777); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">💰</div>
                        <div style="font-weight: 700; font-size: 0.875rem;">Payment Agent</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">x402 Protocol</div>
                        <div style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: ${synd.status === 'completed' ? '#dcfce7' : '#f3f4f6'}; color: ${synd.status === 'completed' ? '#166534' : '#6b7280'}; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${synd.status === 'completed' ? 'COMPLETE' : 'WAITING'}</div>
                    </div>
                </div>

                <!-- Syndication Summary -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Status</div>
                        <div style="font-size: 1.25rem; font-weight: 700; text-transform: capitalize;">${synd.status || 'Open'}</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Subscription</div>
                        <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">${synd.subscription || 0}%</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Spread</div>
                        <div style="font-size: 1.25rem; font-weight: 700;">${synd.spread || '—'} bps</div>
                    </div>
                    <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Time Remaining</div>
                        <div style="font-size: 1.25rem; font-weight: 700;">${synd.timeRemaining || '—'}</div>
                    </div>
                </div>

                <!-- Agent Activity and Decision Log -->
                <div class="agents-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <section class="agents-status-section" style="background: var(--bg-card); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color);">
                        <h3 class="section-title" style="margin: 0 0 1rem; font-size: 1rem; font-weight: 700;">Agent Activity</h3>
                        <div id="synd-agents-status"></div>
                    </section>
                    <section class="agents-log-section" style="background: var(--bg-card); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color);">
                        <h3 class="section-title" style="margin: 0 0 1rem; font-size: 1rem; font-weight: 700;">Decision Log</h3>
                        <div class="decision-log" id="synd-decision-log" style="max-height: 400px; overflow-y: auto;"></div>
                    </section>
                </div>
            </div>
        `;

        // Fetch and render agent data
        if (window.AgentsComponent) {
            AgentsComponent.filterId = syndId;
            const data = await AgentsComponent.getFilteredData();

            // Render agents status
            const statusContainer = document.getElementById('synd-agents-status');
            if (statusContainer && data.agents) {
                statusContainer.innerHTML = AgentsComponent.buildAgentCards(data);
            }

            // Render decision log
            const logContainer = document.getElementById('synd-decision-log');
            if (logContainer && data.decisions && data.decisions.length > 0) {
                logContainer.innerHTML = data.decisions.slice(0, 20).map(d => `
                    <div class="log-entry" style="padding: 0.75rem; border-bottom: 1px solid var(--border-color); font-size: 0.875rem;">
                        <div class="log-header" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span class="log-agent" style="font-weight: 600; color: var(--primary);">${d.agent}</span>
                            <span class="log-time" style="color: var(--text-muted); font-size: 0.75rem;">${d.time}</span>
                        </div>
                        <div class="log-action" style="color: var(--text-primary);">${d.action}</div>
                        <div class="log-factors" style="margin-top: 0.25rem;">
                            ${(d.factors || []).map(f => `<span class="factor ${f.type}" style="font-size: 0.75rem; color: var(--text-muted);">${f.text}</span>`).join('')}
                        </div>
                    </div>
                `).join('');
            } else {
                logContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No activity logged yet for this syndication.</div>';
            }
        }
    },

    async renderSyndicationPayments(container, syndId) {
        container.innerHTML = `
            <div class="syndication-page">
                <div class="page-header">
                    <h2 class="page-title">Payments: ${syndId}</h2>
                </div>
                <div class="payments-grid">
                    <section class="payment-pipeline-section">
                        <h3 class="section-title">Payment Flow</h3>
                        <div id="synd-payment-pipeline"></div>
                    </section>
                    <section class="payment-table-section">
                        <h3 class="section-title">Payment Status</h3>
                        <div id="synd-payment-table"></div>
                    </section>
                </div>
            </div>
        `;

        // Try to get payment data for this syndication
        const payments = SyndiData.payments?.[syndId] || SyndiData.payments?.['SYND-2025-001'] || [];

        const pipelineContainer = document.getElementById('synd-payment-pipeline');
        if (pipelineContainer) {
            pipelineContainer.innerHTML = `
                <div class="payment-pipeline-container">
                    <div class="pipeline-flow">
                        <div class="pipeline-stage stage-participants">
                            <div class="pipeline-stage-icon">👥</div>
                            <div class="pipeline-stage-title">Participants</div>
                            <div class="pipeline-stage-amount">${payments.length} Active</div>
                        </div>
                        <div class="pipeline-connector"><div class="connector-flow"></div></div>
                        <div class="pipeline-stage stage-escrow">
                            <div class="pipeline-stage-icon">🔐</div>
                            <div class="pipeline-stage-title">Escrow</div>
                            <div class="pipeline-stage-amount">$${(payments.reduce((s, p) => s + (p.total || 0), 0) / 1000000).toFixed(1)}M</div>
                        </div>
                        <div class="pipeline-connector"><div class="connector-flow"></div></div>
                        <div class="pipeline-stage stage-originator">
                            <div class="pipeline-stage-icon">🏛️</div>
                            <div class="pipeline-stage-title">Originator</div>
                            <div class="pipeline-stage-amount">Funded</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const tableContainer = document.getElementById('synd-payment-table');
        if (tableContainer && payments.length > 0) {
            tableContainer.innerHTML = `
                <table class="payment-table">
                    <thead>
                        <tr>
                            <th>Participant</th>
                            <th>Commitment Fee</th>
                            <th>Arrangement Fee</th>
                            <th>Principal</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td><strong>${p.participant}</strong></td>
                                <td>${Utils.formatCurrency(p.commitment?.amount || 0)}</td>
                                <td>${Utils.formatCurrency(p.arrangement?.amount || 0)}</td>
                                <td>${Utils.formatCurrency(p.principal?.amount || 0)}</td>
                                <td><span class="status-badge ${(p.overallStatus || 'pending').toLowerCase()}">${p.overallStatus || 'Pending'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            tableContainer.innerHTML = '<p class="text-muted">No payment data available for this syndication.</p>';
        }
    },

    async renderSyndicationTransactions(container, syndId) {
        container.innerHTML = `
            <div class="syndication-page">
                <div class="page-header">
                    <h2 class="page-title">Transactions: ${syndId}</h2>
                </div>
                <section class="transaction-section">
                    <h3 class="section-title">Transaction Log (x402)</h3>
                    <div id="synd-tx-log" class="transaction-log"></div>
                </section>
            </div>
        `;

        // Get transactions - filter by syndId if possible
        const allTx = SyndiData.transactions || [];
        const txContainer = document.getElementById('synd-tx-log');

        if (txContainer) {
            if (allTx.length === 0) {
                txContainer.innerHTML = '<p class="text-muted">No transactions recorded yet.</p>';
            } else {
                txContainer.innerHTML = `
                    <div class="tx-feed">
                        <div class="tx-feed-list">
                            ${allTx.map(tx => `
                                <div class="tx-feed-item">
                                    <div class="tx-status-icon tx-status-confirmed">✓</div>
                                    <div class="tx-feed-content">
                                        <div class="tx-feed-main">
                                            <span class="tx-feed-parties">${tx.participant || tx.sender || tx.agent_id || 'System'} → ${tx.recipient || 'Originator'}</span>
                                            <span class="tx-feed-amount">${tx.amount ? '+' + Utils.formatCurrency(tx.amount) : ''}</span>
                                        </div>
                                        <div class="tx-feed-meta">
                                            <span>${tx.type || tx.event_type || 'Transaction'}</span>
                                            <span>${tx.tx || tx.id || 'Confirmed'}</span>
                                            <span>${tx.time || (tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString() : '')}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    },

    switchView(view) {
        // Reset syndication context
        this.currentSyndId = null;
        this.currentSubPage = null;

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
>>>>>>> syndication-change

        // Auto Bidder
        if (window.AutoBidder) {
            // AutoBidder.start(); // If it has a start method
        }

        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === view);
        });
    },

    // Navigate to syndication page (called from pipeline cards)
    navigateToSyndication(syndId, subPage = 'orchestration') {
        window.location.hash = `${syndId}/${subPage}`;
    },

    // ========================================
    // UI Helpers
    // ========================================

    showLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'flex';
    },

<<<<<<< HEAD
    hideLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
=======
    simulateUpdate() {
        // Randomly update a syndication's subscription rate
        const synd = SyndiData.syndications[Math.floor(Math.random() * SyndiData.syndications.length)];
        if (synd.status === 'negotiating' || synd.status === 'open') {
            const change = Utils.randomBetween(1, 3);
            synd.subscription = Math.min(100, synd.subscription + change);

            // Re-render pipeline if on overview
            if (this.currentView === 'overview' && !this.currentSyndId) {
                PipelineComponent.render();
            }
>>>>>>> syndication-change
        }
    },

    showErrorScreen(error) {
        document.body.innerHTML = `
            <div class="error-screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:white;font-family:sans-serif;">
                <div style="font-size:48px;margin-bottom:20px;">⚠️</div>
                <h1 style="margin:0 0 10px 0;">System Initialization Failed</h1>
                <p style="color:#888;max-width:500px;text-align:center;">${error.message}</p>
                <button onclick="window.location.reload()" style="margin-top:20px;padding:10px 20px;background:#3b82f6;border:none;border-radius:4px;color:white;cursor:pointer;">Retry</button>
            </div>
        `;
    },

    switchView(viewName) {
        // Default Logic from original app.js adapted for new state
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

        // Map viewName to DOM elements
        // Logic similar to RoleRouter.render() but driven by state
        const viewId = `view-${viewName}`;
        const viewEl = document.getElementById(viewId);

        if (viewEl) {
            viewEl.classList.add('active');

            // Update Tab State
            const tab = document.querySelector(`.nav-tab[data-view="${viewName}"]`);
            if (tab) tab.classList.add('active');

            // Dispatch event for legacy components
            window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: viewName } }));
        } else if (viewName === 'syndication-detail') {
            // Special handling for detail view
            // Trigger Detail Modal
        }
    },

    showToast(message, type = 'info') {
        // Simple Toast Implementation
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px;
            padding: 12px 24px; background: #333; color: white;
            border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000; animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export Global
window.App = App;
