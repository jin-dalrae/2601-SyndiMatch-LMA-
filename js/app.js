// ========================================
// SyndiMatch - Main Application with Hash Routing
// ========================================

const App = {
    currentView: 'overview',
    currentSyndId: null,  // Track which syndication we're viewing
    currentSubPage: null, // Track sub-page (orchestration, payments, transactions)

    init() {
        console.log('🚀 SyndiMatch Dashboard initializing...');

        // Initialize all components
        PipelineComponent.init();
        SyndicationDetailComponent.init();
        PaymentsComponent.init();
        AgentsComponent.init();
        AnalyticsComponent.init();
        AlertsComponent.init();

        // Setup navigation
        this.setupNavigation();
        this.setupHashRouting();

        // Setup WebSocket simulation
        this.startMockWebSocket();

        // Handle initial route
        this.handleHashChange();

        console.log('✅ SyndiMatch Dashboard ready');
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
                }
            });
        });
    },

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
            // Simple view route (orchestration, payments, analytics)
            this.switchView(hash);
        }
    },

    showOverview() {
        this.currentSyndId = null;
        this.currentSubPage = null;
        this.updateNavigationForOverview();
        this.switchView('overview');
    },

    showSyndicationPage(syndId, subPage) {
        this.currentSyndId = syndId;
        this.currentSubPage = subPage;

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
            <button class="nav-tab" data-view="orchestration">Orchestration</button>
            <button class="nav-tab" data-view="payments">Payments</button>
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
        container.innerHTML = `
            <div class="syndication-page">
                <div class="page-header">
                    <h2 class="page-title">Orchestration: ${syndId}</h2>
                </div>
                <div class="agents-grid">
                    <section class="agents-status-section">
                        <h3 class="section-title">Agent Status</h3>
                        <div id="synd-agents-status"></div>
                    </section>
                    <section class="agents-log-section">
                        <h3 class="section-title">Decision Log</h3>
                        <div class="decision-log" id="synd-decision-log"></div>
                    </section>
                </div>
            </div>
        `;

        // Set filter and render agents component
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
            if (logContainer && data.decisions) {
                logContainer.innerHTML = data.decisions.slice(0, 20).map(d => `
                    <div class="log-entry">
                        <div class="log-header">
                            <span class="log-agent">${d.agent}</span>
                            <span class="log-time">${d.time}</span>
                        </div>
                        <div class="log-action">${d.action}</div>
                        <div class="log-factors">
                            ${(d.factors || []).map(f => `<span class="factor ${f.type}">${f.text}</span>`).join('')}
                        </div>
                        <div class="log-result">${d.result}</div>
                    </div>
                `).join('');
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
                                            <span class="tx-feed-parties">${tx.participant} → Originator</span>
                                            <span class="tx-feed-amount">+${Utils.formatCurrency(tx.amount)}</span>
                                        </div>
                                        <div class="tx-feed-meta">
                                            <span>${tx.type}</span>
                                            <span>${tx.tx || 'Confirmed'}</span>
                                            <span>${tx.time}</span>
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

        // Show target view
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = view;
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

    startMockWebSocket() {
        console.log('📡 Mock WebSocket connection established');

        // Simulate periodic updates
        setInterval(() => {
            this.simulateUpdate();
        }, 10000);
    },

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
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

