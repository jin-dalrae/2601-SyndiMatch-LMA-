/**
 * Originator Dashboard Component
 * Dedicated dashboard for originators at /originator route
 * Features: Originator selector, metrics, create form, syndication list, detail panel
 */
const OriginatorDashboard = {
    selectedOriginatorId: 'OA-001',
    selectedSyndicationId: null,
    refreshInterval: null,
    originatorsLoaded: false,

    // Originator mapping - loaded from database
    originators: {},

    // Load originators from database
    async loadOriginators() {
        if (this.originatorsLoaded) return;

        try {
            const response = await fetch('/api/originators');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.originators = {};
                    data.forEach(o => {
                        const id = o._id || o.originator_id || o.id;
                        // Use institution.name if available, otherwise fall back to entity or other name fields
                        const name = o.institution?.name || o.entity || o.name || o.originator_name || `Originator ${id}`;
                        this.originators[id] = name;
                    });

                    const firstId = Object.keys(this.originators)[0];
                    if (firstId && !this.originators[this.selectedOriginatorId]) {
                        this.selectedOriginatorId = firstId;
                    }

                    this.originatorsLoaded = true;
                    console.log(`✓ Loaded ${Object.keys(this.originators).length} originators from database`);
                    return;
                }
            }
        } catch (err) {
            console.warn('Failed to load originators from API, using defaults:', err);
        }

        // Fallback to defaults
        this.originators = {
            'OA-001': 'JPMorgan Chase',
            'OA-002': 'Bank of America',
            'OA-003': 'Citigroup',
            'OA-004': 'Goldman Sachs',
            'OA-005': 'Wells Fargo',
            'OA-006': 'BNP Paribas',
            'OA-007': 'Barclays',
            'OA-008': 'MUFG Bank'
        };
        this.originatorsLoaded = true;
    },

    // Random data for form generation
    randomBorrowers: [
        'TechNova Industries', 'Apex Healthcare', 'Meridian Energy', 'Summit Financial',
        'Atlas Manufacturing', 'Quantum Dynamics', 'Evergreen Holdings', 'Pacific Ventures',
        'Nova Pharmaceuticals', 'Titan Aerospace', 'Pinnacle Logistics', 'Vertex Solutions',
        'Horizon Telecom', 'Sterling Properties', 'Catalyst Innovations', 'Vanguard Systems',
        'Nexus Global', 'Aurora Technologies', 'Spectrum Industries', 'Prime Capital'
    ],

    industries: ['Technology', 'Healthcare', 'Energy', 'Financial Services', 'Manufacturing', 'Real Estate', 'Consumer', 'Telecommunications'],
    ratings: ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B'],

    // Generate random form data
    generateRandomFormData() {
        const borrower = this.randomBorrowers[Math.floor(Math.random() * this.randomBorrowers.length)];
        const industry = this.industries[Math.floor(Math.random() * this.industries.length)];
        const rating = this.ratings[Math.floor(Math.random() * this.ratings.length)];
        const amount = Math.floor(Math.random() * 90 + 10) * 10; // 100-1000 in steps of 10
        const spread = Math.floor(Math.random() * 50 + 20) * 5; // 100-350 in steps of 5

        return { borrower, industry, rating, amount, spread };
    },

    init() {
        // Subscribe to view changes
        if (window.AppState) {
            AppState.subscribe('currentView', (view) => {
                if (view === 'originator') {
                    this.showOriginatorMode();
                    this.render();
                    this.startAutoRefresh();
                } else {
                    this.hideOriginatorMode();
                    this.stopAutoRefresh();
                }
            });

            // Check if we're already on originator view (initial load)
            const currentView = AppState.get('currentView');
            if (currentView === 'originator') {
                this.showOriginatorMode();
                this.render();
                this.startAutoRefresh();
            }
        }

        // Also listen for route changes directly
        window.addEventListener('routeChanged', (e) => {
            if (e.detail?.view === 'originator') {
                this.showOriginatorMode();
                this.render();
                this.startAutoRefresh();
            } else {
                this.hideOriginatorMode();
            }
        });

        // Listen for data updates
        window.addEventListener('syndiDataRefresh', () => {
            if (AppState?.get('currentView') === 'originator') {
                this.updateMetrics();
                this.updateSyndicationsList();
            }
        });

        console.log('Originator Dashboard initialized');
    },

    // Hide the main app header and metrics bar
    showOriginatorMode() {
        document.body.classList.add('originator-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        if (header) header.style.display = 'none';
        if (metricsBar) metricsBar.style.display = 'none';
    },

    // Restore the main app header and metrics bar
    hideOriginatorMode() {
        document.body.classList.remove('originator-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        if (header) header.style.display = '';
        if (metricsBar) metricsBar.style.display = '';
    },

    async render() {
        const container = document.getElementById('view-originator');
        if (!container) return;

        // Load originators from database first
        await this.loadOriginators();

        container.innerHTML = `
            <div class="originator-dashboard">
                ${this.renderHeader()}
                ${this.renderMetrics()}
                <div class="originator-content">
                    <div class="originator-main">
                        ${this.renderCreateForm()}
                        ${this.renderSyndicationsList()}
                    </div>
                    ${this.renderDetailPanel()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    },

    renderHeader() {
        return `
            <div class="originator-header">
                <a href="/" class="originator-logo">
                    <div class="originator-logo-icon">S</div>
                    <span class="originator-logo-text">SyndiMatch</span>
                </a>
                <div class="originator-selector">
                    <label>Originator:</label>
                    <select id="originator-select">
                        ${Object.entries(this.originators).map(([id, name]) => `
                            <option value="${id}" ${id === this.selectedOriginatorId ? 'selected' : ''}>${name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    },

    renderMetrics() {
        const metrics = this.calculateMetrics();
        return `
            <div class="originator-metrics">
                <div class="originator-metric-card">
                    <div class="originator-metric-label">Active Deals</div>
                    <div class="originator-metric-value">${metrics.activeDeals}</div>
                    <div class="originator-metric-change neutral">in progress</div>
                </div>
                <div class="originator-metric-card">
                    <div class="originator-metric-label">Total Value</div>
                    <div class="originator-metric-value">${metrics.totalValue > 0 ? this.formatCurrency(metrics.totalValue) : '$0'}</div>
                    <div class="originator-metric-change neutral">in pipeline</div>
                </div>
                <div class="originator-metric-card">
                    <div class="originator-metric-label">Avg Subscription</div>
                    <div class="originator-metric-value">${metrics.avgSubscription}%</div>
                    <div class="originator-metric-change ${metrics.avgSubscription >= 80 ? 'positive' : 'neutral'}">
                        ${metrics.avgSubscription >= 100 ? 'fully subscribed' : metrics.activeDeals > 0 ? 'across active' : 'no active deals'}
                    </div>
                </div>
                <div class="originator-metric-card">
                    <div class="originator-metric-label">Fees Collected</div>
                    <div class="originator-metric-value">${metrics.feesYTD > 0 ? this.formatCurrency(metrics.feesYTD) : '$0'}</div>
                    <div class="originator-metric-change neutral">from completed</div>
                </div>
                <div class="originator-metric-card">
                    <div class="originator-metric-label">Success Rate</div>
                    <div class="originator-metric-value">${metrics.successRate}%</div>
                    <div class="originator-metric-change ${metrics.successRate >= 90 ? 'positive' : 'neutral'}">
                        ${metrics.successRate > 0 ? 'deals closed' : 'no data yet'}
                    </div>
                </div>
            </div>
        `;
    },

    renderCreateForm() {
        const randomData = this.generateRandomFormData();

        return `
            <section class="create-syndication-section">
                <div class="section-header-row">
                    <h2>Create Syndication</h2>
                    <button type="button" class="btn-randomize" id="btn-randomize" title="Generate random values">
                        🎲 Randomize
                    </button>
                </div>
                <form id="originator-create-form" class="create-form">
                    <div class="form-group">
                        <label>Borrower</label>
                        <input type="text" name="borrower" id="form-borrower" value="${randomData.borrower}" required />
                    </div>
                    <div class="form-group">
                        <label>Industry</label>
                        <select name="industry" id="form-industry">
                            ${this.industries.map(ind => `
                                <option value="${ind}" ${ind === randomData.industry ? 'selected' : ''}>${ind}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount ($M)</label>
                        <input type="number" name="amount" id="form-amount" min="10" step="10" value="${randomData.amount}" required />
                    </div>
                    <div class="form-group">
                        <label>Rating</label>
                        <select name="rating" id="form-rating">
                            ${this.ratings.map(r => `
                                <option value="${r}" ${r === randomData.rating ? 'selected' : ''}>${r}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group full-width">
                        <label>Initial Spread (bps)</label>
                        <input type="number" name="spread" id="form-spread" min="100" max="800" step="5" value="${randomData.spread}" required />
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-create">Create & Announce</button>
                        <span class="form-status" id="originator-form-status"></span>
                    </div>
                </form>
            </section>
        `;
    },

    renderSyndicationsList() {
        const syndications = this.getOriginatorSyndications();
        const activeCount = syndications.filter(s => s.status !== 'completed').length;

        return `
            <section class="syndications-list-section">
                <div class="syndications-list-header">
                    <h2>Active Syndications <span class="syndications-count">${activeCount}</span></h2>
                </div>
                <div class="syndications-list" id="originator-syndications-list">
                    ${syndications.length === 0 ? `
                        <div class="detail-empty-state">
                            <div class="icon">📋</div>
                            <p>No syndications yet. Create your first deal above.</p>
                        </div>
                    ` : syndications.map(synd => this.renderSyndicationRow(synd)).join('')}
                </div>
            </section>
        `;
    },

    renderSyndicationRow(synd) {
        const isSelected = synd.id === this.selectedSyndicationId;
        const subscription = synd.subscription || 0;
        const progressClass = subscription >= 100 ? 'high' : subscription >= 50 ? 'medium' : 'low';
        const bidCount = synd.bids?.length || 0;

        return `
            <div class="syndication-row ${isSelected ? 'selected' : ''}" data-synd-id="${synd.id}">
                <div class="syndication-row-header">
                    <div>
                        <div class="syndication-row-id">${synd.id}</div>
                        <div class="syndication-row-borrower">${synd.borrower}</div>
                    </div>
                    <span class="syndication-row-status ${synd.status}">${synd.status}</span>
                </div>
                <div class="syndication-row-details">
                    <span>$${synd.amount}M</span>
                    <span>${synd.rating || 'NR'}</span>
                    <span>${synd.spread || 0} bps</span>
                </div>
                <div class="syndication-row-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(100, subscription)}%"></div>
                    </div>
                    <span class="progress-text">${subscription}%</span>
                </div>
                <div class="syndication-row-meta">
                    <span>${bidCount} bids</span>
                    <span>Round ${synd.round || 1}</span>
                </div>
            </div>
        `;
    },

    renderDetailPanel() {
        return `
            <aside class="originator-detail-panel">
                <div class="detail-panel-header">
                    <h2>Syndication Details</h2>
                    <p>Select a syndication to view details</p>
                </div>
                <div id="detail-panel-content">
                    ${this.renderDetailContent()}
                </div>
            </aside>
        `;
    },

    renderDetailContent() {
        if (!this.selectedSyndicationId) {
            return `
                <div class="detail-empty-state">
                    <div class="icon">👈</div>
                    <p>Select a syndication from the list to view bids, allocations, and payment status.</p>
                </div>
            `;
        }

        const synd = this.getSyndicationById(this.selectedSyndicationId);
        if (!synd) {
            return `
                <div class="detail-empty-state">
                    <div class="icon">⚠️</div>
                    <p>Syndication not found.</p>
                </div>
            `;
        }

        const bids = synd.bids || [];
        const allocations = synd.allocations || this.calculateAllocationsFromBids(synd, bids);

        return `
            <div class="detail-content">
                <!-- Deal Info -->
                <div class="detail-section">
                    <h3>Deal Information</h3>
                    <div class="detail-info-grid">
                        <div class="detail-info-item">
                            <span class="detail-info-label">Borrower</span>
                            <span class="detail-info-value">${synd.borrower}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Industry</span>
                            <span class="detail-info-value">${synd.industry || 'N/A'}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Amount</span>
                            <span class="detail-info-value highlight">$${synd.amount}M</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Spread</span>
                            <span class="detail-info-value">${synd.spread || 0} bps</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Rating</span>
                            <span class="detail-info-value">${synd.rating || 'NR'}</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Subscription</span>
                            <span class="detail-info-value highlight">${synd.subscription || 0}%</span>
                        </div>
                    </div>
                </div>

                <!-- Recent Bids -->
                <div class="detail-section">
                    <h3>Recent Bids (${bids.length})</h3>
                    ${bids.length === 0 ? `
                        <div class="empty-bids">No bids yet</div>
                    ` : `
                        <div class="bids-list">
                            ${bids.slice(0, 5).map(bid => `
                                <div class="bid-item">
                                    <div>
                                        <span class="bid-participant">${bid.participant || bid.participant_id || 'Unknown'}</span>
                                        <span class="bid-time">${this.formatBidTime(bid.timestamp || bid.time)}</span>
                                    </div>
                                    <span class="bid-amount">$${bid.amount || bid.commitment_amount || 0}M</span>
                                </div>
                            `).join('')}
                            ${bids.length > 5 ? `<div class="bid-item" style="justify-content:center;color:var(--text-muted);">+${bids.length - 5} more bids</div>` : ''}
                        </div>
                    `}
                </div>

                <!-- Allocations (if closing/completed) -->
                ${['closing', 'settlement', 'funding', 'completed'].includes(synd.status) ? `
                <div class="detail-section">
                    <h3>Allocations</h3>
                    ${allocations.length === 0 ? `
                        <div class="empty-bids">No allocations finalized</div>
                    ` : `
                        <div class="allocations-list">
                            ${allocations.slice(0, 5).map(alloc => `
                                <div class="allocation-item">
                                    <span class="allocation-participant">${alloc.participant}</span>
                                    <div>
                                        <span class="allocation-amount">$${alloc.amount}M</span>
                                        <span class="allocation-share">(${alloc.share}%)</span>
                                    </div>
                                </div>
                            `).join('')}
                            ${allocations.length > 5 ? `<div class="allocation-item" style="justify-content:center;color:var(--text-muted);">+${allocations.length - 5} more</div>` : ''}
                        </div>
                    `}
                </div>
                ` : ''}

                <!-- Payment Status -->
                <div class="detail-section">
                    <h3>Payment Status</h3>
                    ${this.renderPaymentStatus(synd)}
                </div>

                <!-- Actions -->
                <div class="detail-actions">
                    <button class="btn-detail-action primary" data-action="view-detail" data-synd-id="${synd.id}">
                        View Full Detail
                    </button>
                    <button class="btn-detail-action secondary" data-action="run-agents" data-synd-id="${synd.id}">
                        Run Agents
                    </button>
                </div>

                <div class="last-updated-indicator">
                    <span class="dot"></span>
                    <span>Auto-refreshing every 10s</span>
                </div>
            </div>
        `;
    },

    renderPaymentStatus(synd) {
        let status = 'pending';
        let label = 'Pending';

        if (synd.status === 'completed') {
            status = 'completed';
            label = 'All Payments Complete';
        } else if (synd.status === 'funding') {
            status = 'processing';
            label = 'Processing Payments';
        } else if (synd.status === 'settlement') {
            status = 'pending';
            label = 'Awaiting Settlement';
        }

        return `
            <span class="payment-status-badge ${status}">
                ${status === 'completed' ? '✓' : status === 'processing' ? '⟳' : '○'} ${label}
            </span>
        `;
    },

    // Data Methods
    calculateMetrics() {
        const syndications = this.getOriginatorSyndications();
        const active = syndications.filter(s => s.status !== 'completed');
        const completed = syndications.filter(s => s.status === 'completed');

        const totalValue = active.reduce((sum, s) => sum + (s.amount || 0), 0);
        const avgSub = active.length > 0
            ? Math.round(active.reduce((sum, s) => sum + (s.subscription || 0), 0) / active.length)
            : 0;

        // Calculate fees from completed deals (2% arrangement fee)
        const feesYTD = completed.reduce((sum, s) => sum + ((s.amount || 0) * 0.02), 0) * 1000000;

        const successRate = syndications.length > 0
            ? Math.round((completed.length / syndications.length) * 100)
            : 0;

        // Count deals created this week (real data)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const dealsThisWeek = syndications.filter(s => {
            const created = s.createdAt ? new Date(s.createdAt) : null;
            return created && created >= oneWeekAgo;
        }).length;

        return {
            activeDeals: active.length,
            activeDealsChange: dealsThisWeek,
            totalValue: totalValue * 1000000,
            avgSubscription: avgSub,
            feesYTD: feesYTD,
            successRate: successRate
        };
    },

    getOriginatorSyndications() {
        if (!window.SyndiData) return [];

        const originatorName = this.originators[this.selectedOriginatorId];
        return SyndiData.syndications.filter(s => {
            // Match by originator name or ID
            return s.originator === originatorName ||
                s.originator_agent_id === this.selectedOriginatorId ||
                s.originatorId === this.selectedOriginatorId;
        });
    },

    getSyndicationById(id) {
        if (!window.SyndiData) return null;
        return SyndiData.syndications.find(s => s.id === id);
    },

    // Calculate allocations from accepted bids (real data)
    calculateAllocationsFromBids(synd, bids) {
        if (!bids || bids.length === 0) return [];

        const totalAmount = synd.amount || 100;
        const allocations = [];

        // Group bids by participant and sum their amounts
        const participantTotals = {};
        bids.forEach(bid => {
            const participant = bid.participant || bid.participant_id || 'Unknown';
            const amount = bid.amount || bid.commitment_amount || 0;
            if (!participantTotals[participant]) {
                participantTotals[participant] = 0;
            }
            participantTotals[participant] += amount;
        });

        // Convert to allocations array
        Object.entries(participantTotals).forEach(([participant, amount]) => {
            allocations.push({
                participant,
                amount,
                share: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0
            });
        });

        // Sort by amount descending
        allocations.sort((a, b) => b.amount - a.amount);

        return allocations;
    },

    // Format bid time from timestamp
    formatBidTime(timestamp) {
        if (!timestamp) return 'Just now';
        const now = new Date();
        const bidTime = new Date(timestamp);
        const diffMs = now - bidTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'Just now';
    },

    formatCurrency(value) {
        if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    },

    // Event Handlers
    attachEventListeners() {
        // Originator selector
        const selector = document.getElementById('originator-select');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.selectedOriginatorId = e.target.value;
                this.selectedSyndicationId = null;
                this.updateMetrics();
                this.updateSyndicationsList();
                this.updateDetailPanel();
            });
        }

        // Create form
        const form = document.getElementById('originator-create-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleCreateSubmit(e));
        }

        // Randomize button
        const randomizeBtn = document.getElementById('btn-randomize');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeFormFields());
        }

        // Syndication row clicks
        this.attachRowListeners();

        // Detail panel actions
        this.attachDetailActionListeners();
    },

    randomizeFormFields() {
        const data = this.generateRandomFormData();

        const borrowerInput = document.getElementById('form-borrower');
        const industrySelect = document.getElementById('form-industry');
        const amountInput = document.getElementById('form-amount');
        const ratingSelect = document.getElementById('form-rating');
        const spreadInput = document.getElementById('form-spread');

        if (borrowerInput) borrowerInput.value = data.borrower;
        if (industrySelect) industrySelect.value = data.industry;
        if (amountInput) amountInput.value = data.amount;
        if (ratingSelect) ratingSelect.value = data.rating;
        if (spreadInput) spreadInput.value = data.spread;
    },

    attachRowListeners() {
        const rows = document.querySelectorAll('.syndication-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const syndId = row.dataset.syndId;
                this.selectedSyndicationId = syndId;

                // Update selected state
                document.querySelectorAll('.syndication-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');

                this.updateDetailPanel();
            });
        });
    },

    attachDetailActionListeners() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const syndId = e.currentTarget.dataset.syndId;

                if (action === 'view-detail' && syndId) {
                    Router.navigate(`/${syndId}/orchestration`);
                } else if (action === 'run-agents' && syndId) {
                    this.runAgents(syndId);
                }
            });
        });
    },

    async handleCreateSubmit(e) {
        e.preventDefault();
        const statusEl = document.getElementById('originator-form-status');
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());

        payload.originator_agent_id = this.selectedOriginatorId;
        payload.originator = this.originators[this.selectedOriginatorId];
        payload.amount = Number(payload.amount) || 0;
        payload.spread = Number(payload.spread) || 0;

        try {
            statusEl.textContent = 'Creating...';
            statusEl.className = 'form-status';

            const synd = await API.post('server', '/syndications', payload);

            if (!synd) {
                // Fallback: create locally for demo
                const localSynd = {
                    id: `SYND-${Date.now()}`,
                    ...payload,
                    subscription: 0,
                    status: 'open',
                    round: 1,
                    bids: [],
                    allocations: [],
                    createdAt: new Date().toISOString()
                };

                if (window.SyndiData) {
                    SyndiData.syndications.unshift(localSynd);
                    window.dispatchEvent(new CustomEvent('newSyndication', { detail: localSynd }));
                }

                statusEl.textContent = 'Created locally (demo mode)';
                statusEl.className = 'form-status success';
            } else {
                // Push real syndication
                if (window.SyndiData) {
                    const entry = {
                        id: synd._id || synd.syndication_id,
                        borrower: synd.borrower,
                        amount: synd.amount,
                        rating: synd.rating,
                        originator: synd.originator,
                        originator_agent_id: synd.originator_agent_id || this.selectedOriginatorId,
                        industry: synd.industry,
                        spread: synd.spread,
                        subscription: synd.subscription || 0,
                        status: synd.status || 'open',
                        round: synd.round || 1,
                        bids: synd.bids || [],
                        allocations: synd.allocations || [],
                        createdAt: synd.created_at || synd.createdAt || new Date().toISOString()
                    };
                    SyndiData.syndications.unshift(entry);
                    window.dispatchEvent(new CustomEvent('newSyndication', { detail: entry }));
                }

                statusEl.textContent = 'Created successfully!';
                statusEl.className = 'form-status success';

                // Trigger agents via WebSocket
                if (window.AgentOrchestration?.ws) {
                    AgentOrchestration.ws.send(JSON.stringify({
                        type: 'run_syndication',
                        originator_id: this.selectedOriginatorId,
                        syndication_id: synd._id || synd.syndication_id,
                        step_mode: false
                    }));
                }
            }

            // Reset form
            e.target.reset();

            // Refresh list
            this.updateSyndicationsList();

            // Clear status after delay
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);

        } catch (err) {
            console.error('Create syndication error:', err);
            statusEl.textContent = `Error: ${err.message}`;
            statusEl.className = 'form-status error';
        }
    },

    async runAgents(syndId) {
        if (window.AgentOrchestration?.ws) {
            AgentOrchestration.ws.send(JSON.stringify({
                type: 'run_syndication',
                originator_id: this.selectedOriginatorId,
                syndication_id: syndId,
                step_mode: false
            }));

            if (window.App) {
                App.showToast('Agent workflow triggered', 'info');
            }
        } else {
            // Fallback: POST to API
            try {
                await API.post('server', '/syndications/run', {
                    syndication_id: syndId,
                    originator_id: this.selectedOriginatorId
                });
                if (window.App) {
                    App.showToast('Agent workflow triggered', 'info');
                }
            } catch (err) {
                console.error('Run agents error:', err);
            }
        }
    },

    // Update Methods
    updateMetrics() {
        const container = document.querySelector('.originator-metrics');
        if (!container) return;

        const metrics = this.calculateMetrics();
        container.innerHTML = `
            <div class="originator-metric-card">
                <div class="originator-metric-label">Active Deals</div>
                <div class="originator-metric-value">${metrics.activeDeals}</div>
                <div class="originator-metric-change neutral">in progress</div>
            </div>
            <div class="originator-metric-card">
                <div class="originator-metric-label">Total Value</div>
                <div class="originator-metric-value">${metrics.totalValue > 0 ? this.formatCurrency(metrics.totalValue) : '$0'}</div>
                <div class="originator-metric-change neutral">in pipeline</div>
            </div>
            <div class="originator-metric-card">
                <div class="originator-metric-label">Avg Subscription</div>
                <div class="originator-metric-value">${metrics.avgSubscription}%</div>
                <div class="originator-metric-change ${metrics.avgSubscription >= 80 ? 'positive' : 'neutral'}">
                    ${metrics.avgSubscription >= 100 ? 'fully subscribed' : metrics.activeDeals > 0 ? 'across active' : 'no active deals'}
                </div>
            </div>
            <div class="originator-metric-card">
                <div class="originator-metric-label">Fees Collected</div>
                <div class="originator-metric-value">${metrics.feesYTD > 0 ? this.formatCurrency(metrics.feesYTD) : '$0'}</div>
                <div class="originator-metric-change neutral">from completed</div>
            </div>
            <div class="originator-metric-card">
                <div class="originator-metric-label">Success Rate</div>
                <div class="originator-metric-value">${metrics.successRate}%</div>
                <div class="originator-metric-change ${metrics.successRate >= 90 ? 'positive' : 'neutral'}">
                    ${metrics.successRate > 0 ? 'deals closed' : 'no data yet'}
                </div>
            </div>
        `;
    },

    updateSyndicationsList() {
        const container = document.getElementById('originator-syndications-list');
        if (!container) return;

        const syndications = this.getOriginatorSyndications();
        const activeCount = syndications.filter(s => s.status !== 'completed').length;

        // Update count badge
        const countBadge = document.querySelector('.syndications-count');
        if (countBadge) countBadge.textContent = activeCount;

        container.innerHTML = syndications.length === 0 ? `
            <div class="detail-empty-state">
                <div class="icon">📋</div>
                <p>No syndications yet. Create your first deal above.</p>
            </div>
        ` : syndications.map(synd => this.renderSyndicationRow(synd)).join('');

        this.attachRowListeners();
    },

    updateDetailPanel() {
        const container = document.getElementById('detail-panel-content');
        if (!container) return;

        container.innerHTML = this.renderDetailContent();
        this.attachDetailActionListeners();
    },

    // Auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => {
            this.updateMetrics();
            this.updateSyndicationsList();
            if (this.selectedSyndicationId) {
                this.updateDetailPanel();
            }
        }, 10000); // 10 seconds
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};

// Export globally
window.OriginatorDashboard = OriginatorDashboard;
