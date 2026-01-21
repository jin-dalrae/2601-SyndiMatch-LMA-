/**
 * Participant Dashboard Component
 * Dedicated dashboard for participants at /participant route
 * Features: Participant selector, available deals, bid form with realistic generation, portfolio, active bids
 */
const ParticipantDashboard = {
    selectedParticipantId: 'PA-001',
    selectedSyndicationId: null,
    refreshInterval: null,
    refreshRate: 3000, // 3 seconds as requested
    participantsLoaded: false,

    // Participant mapping - loaded from database
    participants: {},

    // Participant strategies for realistic bid generation
    participantStrategies: {},

    // Load participants from database
    async loadParticipants() {
        if (this.participantsLoaded) return;

        try {
            const response = await fetch('/api/participants');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.participants = {};
                    this.participantStrategies = {};

                    data.forEach(p => {
                        const id = p._id || p.participant_id || p.id;
                        // Use institution.name if available, otherwise fall back to other name fields
                        const name = p.institution?.name || p.name || p.participant_name || `Participant ${id}`;
                        this.participants[id] = name;

                        // Generate strategy based on participant's strategy.investment_style from database
                        const strategyType = p.strategy?.investment_style || p.strategy || p.investment_strategy ||
                            ['aggressive', 'balanced', 'conservative'][Math.floor(Math.random() * 3)];

                        this.participantStrategies[id] = {
                            strategy: strategyType,
                            riskAppetite: strategyType === 'aggressive' ? 'high' : (strategyType === 'conservative' ? 'low' : 'medium'),
                            maxAllocation: p.risk_appetite?.max_single_ticket ? p.risk_appetite.max_single_ticket / 1000000 : (strategyType === 'aggressive' ? 55 : (strategyType === 'conservative' ? 30 : 40)),
                            minAllocation: p.risk_appetite?.min_ticket ? p.risk_appetite.min_ticket / 1000000 : (strategyType === 'aggressive' ? 12 : (strategyType === 'conservative' ? 5 : 8))
                        };
                    });

                    // Set first participant as default
                    const firstId = Object.keys(this.participants)[0];
                    if (firstId && !this.participants[this.selectedParticipantId]) {
                        this.selectedParticipantId = firstId;
                    }

                    this.participantsLoaded = true;
                    console.log(`✓ Loaded ${Object.keys(this.participants).length} participants from database`);
                    return;
                }
            }
        } catch (err) {
            console.warn('Failed to load participants from API, using defaults:', err);
        }

        // Fallback to defaults
        this.participants = {
            'PA-001': 'Apollo Global',
            'PA-002': 'CalPERS',
            'PA-003': 'BNP Paribas AM',
            'PA-004': 'MUFG Bank',
            'PA-005': 'Palmer Square',
            'PA-101': 'PNC Bank',
            'PA-102': 'Ares Management',
            'PA-103': 'MetLife'
        };
        this.participantStrategies = {
            'PA-001': { strategy: 'aggressive', riskAppetite: 'high', maxAllocation: 50, minAllocation: 10 },
            'PA-002': { strategy: 'conservative', riskAppetite: 'low', maxAllocation: 30, minAllocation: 5 },
            'PA-003': { strategy: 'balanced', riskAppetite: 'medium', maxAllocation: 40, minAllocation: 8 },
            'PA-004': { strategy: 'conservative', riskAppetite: 'low', maxAllocation: 35, minAllocation: 7 },
            'PA-005': { strategy: 'aggressive', riskAppetite: 'high', maxAllocation: 45, minAllocation: 12 },
            'PA-101': { strategy: 'balanced', riskAppetite: 'medium', maxAllocation: 38, minAllocation: 8 },
            'PA-102': { strategy: 'aggressive', riskAppetite: 'high', maxAllocation: 55, minAllocation: 15 },
            'PA-103': { strategy: 'conservative', riskAppetite: 'low', maxAllocation: 25, minAllocation: 5 }
        };
        this.participantsLoaded = true;
    },


    init() {
        // Subscribe to view changes
        if (window.AppState) {
            AppState.subscribe('currentView', (view) => {
                if (view === 'participant') {
                    this.showParticipantMode();
                    this.render();
                    this.startAutoRefresh();
                } else {
                    this.hideParticipantMode();
                    this.stopAutoRefresh();
                }
            });

            // Check if we're already on participant view (initial load)
            const currentView = AppState.get('currentView');
            if (currentView === 'participant') {
                this.showParticipantMode();
                this.render();
                this.startAutoRefresh();
            }
        }

        // Also listen for route changes directly
        window.addEventListener('routeChanged', (e) => {
            if (e.detail?.view === 'participant') {
                this.showParticipantMode();
                this.render();
                this.startAutoRefresh();
            } else {
                this.hideParticipantMode();
            }
        });

        // Listen for role changes to sync participant ID
        window.addEventListener('roleChange', (e) => {
            const { role, agentId } = e.detail || {};
            if (role === 'participant' && agentId) {
                // Sync with role router's selected agent
                if (this.participants[agentId]) {
                    this.selectedParticipantId = agentId;
                    this.selectedSyndicationId = null;
                    console.log(`✓ Participant synced: ${this.participants[agentId]}`);
                }
            }
        });

        // Listen for data updates
        window.addEventListener('syndiDataRefresh', () => {
            if (AppState?.get('currentView') === 'participant') {
                this.updateMetrics();
                this.updateAvailableDeals();
                this.updateActiveBids();
            }
        });

        console.log('Participant Dashboard initialized');
    },

    // Hide the main app header and metrics bar
    showParticipantMode() {
        document.body.classList.add('participant-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        if (header) header.style.display = 'none';
        if (metricsBar) metricsBar.style.display = 'none';
    },

    // Restore the main app header and metrics bar
    hideParticipantMode() {
        document.body.classList.remove('participant-mode');
        const header = document.querySelector('.header');
        const metricsBar = document.querySelector('.metrics-bar');
        if (header) header.style.display = '';
        if (metricsBar) metricsBar.style.display = '';
    },

    async render() {
        const container = document.getElementById('view-participant');
        if (!container) return;

        // Load participants from database first
        await this.loadParticipants();

        container.innerHTML = `
            <div class="participant-dashboard">
                ${this.renderHeader()}
                ${this.renderMetrics()}
                <div class="participant-content">
                    <div class="participant-main">
                        ${this.renderAvailableDeals()}
                        ${this.renderActiveBids()}
                    </div>
                    ${this.renderDetailPanel()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    },

    renderHeader() {
        return `
            <div class="participant-header">
                <a href="/" class="participant-logo">
                    <div class="participant-logo-icon">S</div>
                    <span class="participant-logo-text">SyndiMatch</span>
                </a>
                <div class="participant-selector">
                    <label>Participant:</label>
                    <select id="participant-select">
                        ${Object.entries(this.participants).map(([id, name]) => `
                            <option value="${id}" ${id === this.selectedParticipantId ? 'selected' : ''}>${name}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    },

    renderMetrics() {
        const metrics = this.calculateMetrics();
        return `
            <div class="participant-metrics">
                <div class="participant-metric-card">
                    <div class="participant-metric-label">Active Bids</div>
                    <div class="participant-metric-value">${metrics.activeBids}</div>
                    <div class="participant-metric-change neutral">pending</div>
                </div>
                <div class="participant-metric-card">
                    <div class="participant-metric-label">Total Committed</div>
                    <div class="participant-metric-value">${metrics.totalCommitted > 0 ? this.formatCurrency(metrics.totalCommitted) : '$0'}</div>
                    <div class="participant-metric-change neutral">in bids</div>
                </div>
                <div class="participant-metric-card">
                    <div class="participant-metric-label">Portfolio Holdings</div>
                    <div class="participant-metric-value">${metrics.holdings}</div>
                    <div class="participant-metric-change ${metrics.holdings > 0 ? 'positive' : 'neutral'}">
                        ${metrics.holdings > 0 ? 'active deals' : 'no holdings'}
                    </div>
                </div>
                <div class="participant-metric-card">
                    <div class="participant-metric-label">Available Deals</div>
                    <div class="participant-metric-value">${metrics.availableDeals}</div>
                    <div class="participant-metric-change ${metrics.availableDeals > 0 ? 'positive' : 'neutral'}">
                        ${metrics.availableDeals > 0 ? 'opportunities' : 'no open deals'}
                    </div>
                </div>
                <div class="participant-metric-card">
                    <div class="participant-metric-label">Avg Yield</div>
                    <div class="participant-metric-value">${metrics.avgYield.toFixed(1)}%</div>
                    <div class="participant-metric-change ${metrics.avgYield >= 7.0 ? 'positive' : 'neutral'}">
                        ${metrics.avgYield >= 7.0 ? 'above target' : 'portfolio average'}
                    </div>
                </div>
            </div>
        `;
    },

    renderAvailableDeals() {
        const deals = this.getAvailableDeals();

        return `
            <section class="available-deals-section">
                <div class="section-header-row">
                    <h2>Available Syndications <span class="deals-count">${deals.length}</span></h2>
                    <div class="filter-controls">
                        <select id="industry-filter" class="filter-select">
                            <option value="all">All Industries</option>
                            <option value="Technology">Technology</option>
                            <option value="Healthcare">Healthcare</option>
                            <option value="Energy">Energy</option>
                            <option value="Financial Services">Financial Services</option>
                            <option value="Manufacturing">Manufacturing</option>
                        </select>
                    </div>
                </div>
                <div class="available-deals-list" id="available-deals-list">
                    ${deals.length === 0 ? `
                        <div class="detail-empty-state">
                            <div class="icon">📊</div>
                            <p>No open syndications available at the moment.</p>
                        </div>
                    ` : deals.map(deal => this.renderDealRow(deal)).join('')}
                </div>
            </section>
        `;
    },

    renderDealRow(deal) {
        const isSelected = deal.id === this.selectedSyndicationId;
        const subscription = deal.subscription || 0;
        const progressClass = subscription >= 100 ? 'high' : subscription >= 50 ? 'medium' : 'low';
        const strategy = this.participantStrategies[this.selectedParticipantId];
        const estimatedYield = ((deal.spread || 0) / 100) + 4.5; // Base rate + spread
        const yieldClass = estimatedYield >= 7.0 ? 'high' : estimatedYield >= 5.5 ? 'medium' : 'low';

        return `
            <div class="deal-row ${isSelected ? 'selected' : ''}" data-deal-id="${deal.id}">
                <div class="deal-row-header">
                    <div>
                        <div class="deal-row-id">${deal.id}</div>
                        <div class="deal-row-borrower">${deal.borrower}</div>
                    </div>
                    <span class="deal-row-status ${deal.status}">${deal.status}</span>
                </div>
                <div class="deal-row-details">
                    <span>$${deal.amount}M</span>
                    <span>${deal.rating || 'NR'}</span>
                    <span>${deal.spread || 0} bps</span>
                    <span class="yield-indicator ${yieldClass}">Yield: ${estimatedYield.toFixed(1)}%</span>
                </div>
                <div class="deal-row-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(100, subscription)}%"></div>
                    </div>
                    <span class="progress-text">${subscription}% subscribed</span>
                </div>
                <div class="deal-row-actions">
                    <button class="btn-bid-quick" data-action="bid-quick" data-deal-id="${deal.id}">
                        🎲 Quick Bid
                    </button>
                    <button class="btn-bid-custom" data-action="bid-custom" data-deal-id="${deal.id}">
                        Customize & Bid
                    </button>
                </div>
            </div>
        `;
    },

    renderActiveBids() {
        const bids = this.getParticipantBids();

        return `
            <section class="active-bids-section">
                <div class="active-bids-header">
                    <h2>My Active Bids <span class="bids-count">${bids.length}</span></h2>
                </div>
                <div class="active-bids-list" id="active-bids-list">
                    ${bids.length === 0 ? `
                        <div class="detail-empty-state">
                            <div class="icon">📝</div>
                            <p>No active bids. Select a syndication above to place a bid.</p>
                        </div>
                    ` : bids.map(bid => this.renderBidRow(bid)).join('')}
                </div>
            </section>
        `;
    },

    renderBidRow(bid) {
        const synd = this.getSyndicationById(bid.syndicationId);
        if (!synd) return '';

        return `
            <div class="bid-row">
                <div class="bid-row-header">
                    <div>
                        <div class="bid-row-id">${synd.id}</div>
                        <div class="bid-row-borrower">${synd.borrower}</div>
                    </div>
                    <span class="bid-status-badge ${bid.status || 'pending'}">${bid.status || 'pending'}</span>
                </div>
                <div class="bid-row-details">
                    <span>Amount: $${bid.amount}M</span>
                    <span>Spread: ${bid.spread} bps</span>
                    <span class="bid-time">${this.formatBidTime(bid.timestamp)}</span>
                </div>
            </div>
        `;
    },

    renderDetailPanel() {
        return `
            <aside class="participant-detail-panel">
                <div class="detail-panel-header">
                    <h2>Deal Details</h2>
                    <p>Select a syndication to view details and place a bid</p>
                </div>
                <div id="participant-detail-content">
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
                    <p>Select a syndication from the available deals to view details and place a bid.</p>
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

        const estimatedYield = ((synd.spread || 0) / 100) + 4.5;
        const strategy = this.participantStrategies[this.selectedParticipantId];

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
                            <span class="detail-info-label">Est. Yield</span>
                            <span class="detail-info-value highlight">${estimatedYield.toFixed(2)}%</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Subscription</span>
                            <span class="detail-info-value">${synd.subscription || 0}%</span>
                        </div>
                        <div class="detail-info-item">
                            <span class="detail-info-label">Round</span>
                            <span class="detail-info-value">${synd.round || 1}</span>
                        </div>
                    </div>
                </div>

                <!-- Bid Form -->
                <div class="detail-section">
                    <h3>Place Bid</h3>
                    <form id="participant-bid-form" class="bid-form">
                        <div class="form-group">
                            <label>Bid Amount ($M)</label>
                            <input type="number" id="bid-amount" name="amount" min="1" step="1" required />
                            <small class="form-hint">Allocation: ${strategy.minAllocation}M - ${strategy.maxAllocation}M per deal</small>
                        </div>
                        <div class="form-group">
                            <label>Bid Spread (bps)</label>
                            <input type="number" id="bid-spread" name="spread" min="50" max="1000" step="5" required />
                            <small class="form-hint">Current spread: ${synd.spread || 0} bps</small>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-randomize" id="btn-randomize-bid">
                                🎲 Generate Realistic Bid
                            </button>
                            <button type="submit" class="btn-submit-bid">
                                Submit Bid
                            </button>
                        </div>
                        <div class="form-status" id="bid-form-status"></div>
                    </form>
                </div>

                <!-- Strategy Info -->
                <div class="detail-section">
                    <h3>Your Strategy</h3>
                    <div class="strategy-info">
                        <div class="strategy-item">
                            <span class="strategy-label">Approach:</span>
                            <span class="strategy-value">${strategy.strategy}</span>
                        </div>
                        <div class="strategy-item">
                            <span class="strategy-label">Risk Appetite:</span>
                            <span class="strategy-value">${strategy.riskAppetite}</span>
                        </div>
                        <div class="strategy-item">
                            <span class="strategy-label">Max per Deal:</span>
                            <span class="strategy-value">$${strategy.maxAllocation}M</span>
                        </div>
                    </div>
                </div>

                <div class="last-updated-indicator">
                    <span class="dot"></span>
                    <span>Auto-refreshing every 3s</span>
                </div>
            </div>
        `;
    },

    // Bid Generation Methods
    generateRealisticBid(syndication) {
        const strategy = this.participantStrategies[this.selectedParticipantId];

        // Calculate bid amount based on strategy and syndication size
        const syndicationSize = syndication.amount;
        const minPercent = 0.05; // 5% of syndication size
        const maxPercent = 0.30; // 30% of syndication size

        let bidAmount;
        if (strategy.strategy === 'aggressive') {
            // Aggressive: larger bids (15-30% of syndication)
            bidAmount = syndicationSize * (0.15 + Math.random() * 0.15);
        } else if (strategy.strategy === 'conservative') {
            // Conservative: smaller bids (5-15% of syndication)
            bidAmount = syndicationSize * (0.05 + Math.random() * 0.10);
        } else {
            // Balanced: medium bids (10-20% of syndication)
            bidAmount = syndicationSize * (0.10 + Math.random() * 0.10);
        }

        // Respect participant's allocation limits
        bidAmount = Math.max(strategy.minAllocation, Math.min(strategy.maxAllocation, bidAmount));
        bidAmount = Math.round(bidAmount);

        // Calculate bid spread based on strategy
        const currentSpread = syndication.spread || 400;
        let bidSpread;

        if (strategy.strategy === 'aggressive') {
            // Aggressive: bid lower spread to win (current -25 to -5 bps)
            bidSpread = currentSpread - (5 + Math.random() * 20);
        } else if (strategy.strategy === 'conservative') {
            // Conservative: bid higher spread for better yield (current +5 to +25 bps)
            bidSpread = currentSpread + (5 + Math.random() * 20);
        } else {
            // Balanced: bid around current spread (current -10 to +10 bps)
            bidSpread = currentSpread + ((Math.random() - 0.5) * 20);
        }

        bidSpread = Math.round(bidSpread / 5) * 5; // Round to nearest 5 bps

        return {
            amount: bidAmount,
            spread: bidSpread
        };
    },

    // Data Methods
    calculateMetrics() {
        const bids = this.getParticipantBids();
        const holdings = this.getParticipantHoldings();
        const availableDeals = this.getAvailableDeals();

        const totalCommitted = bids
            .filter(b => b.status === 'pending' || b.status === 'executed')
            .reduce((sum, b) => sum + (b.amount || 0), 0) * 1000000;

        const avgYield = holdings.length > 0
            ? holdings.reduce((sum, h) => {
                const spread = h.spread || 0;
                const yield_ = (spread / 100) + 4.5;
                return sum + yield_;
            }, 0) / holdings.length
            : 6.5; // Default target yield

        return {
            activeBids: bids.filter(b => b.status === 'pending').length,
            totalCommitted: totalCommitted,
            holdings: holdings.length,
            availableDeals: availableDeals.length,
            avgYield: avgYield
        };
    },

    getAvailableDeals() {
        if (!window.SyndiData) return [];
        return SyndiData.syndications.filter(s =>
            s.status === 'open' || s.status === 'negotiating'
        );
    },

    getParticipantBids() {
        if (!window.SyndiData) return [];

        const allBids = [];
        SyndiData.syndications.forEach(synd => {
            if (synd.bids && Array.isArray(synd.bids)) {
                synd.bids.forEach(bid => {
                    if (bid.participant_id === this.selectedParticipantId ||
                        bid.participantId === this.selectedParticipantId) {
                        allBids.push({
                            ...bid,
                            syndicationId: synd.id
                        });
                    }
                });
            }
        });

        return allBids;
    },

    getParticipantHoldings() {
        if (!window.SyndiData) return [];

        const holdings = [];
        SyndiData.syndications.forEach(synd => {
            if (synd.status === 'completed' || synd.status === 'funding') {
                if (synd.allocations && Array.isArray(synd.allocations)) {
                    synd.allocations.forEach(alloc => {
                        if (alloc.participant_id === this.selectedParticipantId) {
                            holdings.push({
                                ...alloc,
                                borrower: synd.borrower,
                                industry: synd.industry,
                                rating: synd.rating,
                                spread: synd.spread
                            });
                        }
                    });
                }
            }
        });

        return holdings;
    },

    getSyndicationById(id) {
        if (!window.SyndiData) return null;
        return SyndiData.syndications.find(s => s.id === id);
    },

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
        // Participant selector
        const selector = document.getElementById('participant-select');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.selectedParticipantId = e.target.value;
                this.selectedSyndicationId = null;
                this.updateMetrics();
                this.updateAvailableDeals();
                this.updateActiveBids();
                this.updateDetailPanel();
            });
        }

        // Deal row clicks
        this.attachDealListeners();

        // Bid form
        const bidForm = document.getElementById('participant-bid-form');
        if (bidForm) {
            bidForm.addEventListener('submit', (e) => this.handleBidSubmit(e));
        }

        // Randomize bid button
        const randomizeBtn = document.getElementById('btn-randomize-bid');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeBidFields());
        }

        // Quick bid and custom bid buttons
        document.querySelectorAll('[data-action="bid-quick"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dealId = btn.dataset.dealId;
                this.handleQuickBid(dealId);
            });
        });

        document.querySelectorAll('[data-action="bid-custom"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dealId = btn.dataset.dealId;
                this.selectedSyndicationId = dealId;
                this.updateDetailPanel();
                // Scroll to detail panel
                document.querySelector('.participant-detail-panel')?.scrollIntoView({ behavior: 'smooth' });
            });
        });
    },

    attachDealListeners() {
        const rows = document.querySelectorAll('.deal-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const dealId = row.dataset.dealId;
                this.selectedSyndicationId = dealId;

                // Update selected state
                document.querySelectorAll('.deal-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');

                this.updateDetailPanel();
            });
        });
    },

    randomizeBidFields() {
        const synd = this.getSyndicationById(this.selectedSyndicationId);
        if (!synd) return;

        const bid = this.generateRealisticBid(synd);

        const amountInput = document.getElementById('bid-amount');
        const spreadInput = document.getElementById('bid-spread');

        if (amountInput) amountInput.value = bid.amount;
        if (spreadInput) spreadInput.value = bid.spread;
    },

    async handleQuickBid(dealId) {
        const synd = this.getSyndicationById(dealId);
        if (!synd) return;

        const bid = this.generateRealisticBid(synd);

        await this.submitBid(dealId, bid.amount, bid.spread);
    },

    async handleBidSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const amount = Number(formData.get('amount'));
        const spread = Number(formData.get('spread'));

        await this.submitBid(this.selectedSyndicationId, amount, spread);
    },

    async submitBid(syndicationId, amount, spread) {
        const statusEl = document.getElementById('bid-form-status');
        const synd = this.getSyndicationById(syndicationId);

        if (!synd) {
            if (statusEl) {
                statusEl.textContent = 'Error: Syndication not found';
                statusEl.className = 'form-status error';
            }
            return;
        }

        try {
            if (statusEl) {
                statusEl.textContent = 'Submitting bid...';
                statusEl.className = 'form-status';
            }

            const bid = {
                participant_id: this.selectedParticipantId,
                participantId: this.selectedParticipantId,
                participant: this.participants[this.selectedParticipantId],
                participantName: this.participants[this.selectedParticipantId],
                amount: amount,
                spread: spread,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            // Add bid to syndication
            if (!synd.bids) synd.bids = [];
            synd.bids.push(bid);

            // Update subscription percentage
            const totalBids = synd.bids.reduce((sum, b) => sum + b.amount, 0);
            synd.subscription = Math.min(100, Math.round((totalBids / synd.amount) * 100));

            // Trigger agent workflow
            await this.triggerAgentWorkflow(syndicationId);

            if (statusEl) {
                statusEl.textContent = 'Bid submitted! Agents processing...';
                statusEl.className = 'form-status success';
            }

            // Show toast
            if (window.App) {
                App.showToast(`Bid placed: $${amount}M @ ${spread}bps`, 'success');
            }

            // Refresh views
            this.updateAvailableDeals();
            this.updateActiveBids();
            this.updateMetrics();

            // Clear status after delay
            setTimeout(() => {
                if (statusEl) statusEl.textContent = '';
            }, 3000);

        } catch (err) {
            console.error('Bid submission error:', err);
            if (statusEl) {
                statusEl.textContent = `Error: ${err.message}`;
                statusEl.className = 'form-status error';
            }
        }
    },

    async triggerAgentWorkflow(syndicationId) {
        // Try API first
        if (window.API && !API.useMockData) {
            try {
                await API.post('server', '/syndications/run', {
                    syndication_id: syndicationId,
                    participant_id: this.selectedParticipantId
                });
                console.log('✓ Agent workflow triggered via API');
                return;
            } catch (err) {
                console.warn('API call failed, trying WebSocket...', err);
            }
        }

        // Try WebSocket
        if (window.AgentOrchestration?.ws) {
            AgentOrchestration.ws.send(JSON.stringify({
                type: 'run_syndication',
                syndication_id: syndicationId,
                participant_id: this.selectedParticipantId,
                step_mode: false
            }));
            console.log('✓ Agent workflow triggered via WebSocket');
        }
    },

    // Auto-refresh Methods
    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval

        this.refreshInterval = setInterval(() => {
            if (AppState?.get('currentView') === 'participant') {
                this.updateMetrics();
                this.updateAvailableDeals();
                this.updateActiveBids();
            }
        }, this.refreshRate);

        console.log(`✓ Auto-refresh started (${this.refreshRate}ms)`);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('✓ Auto-refresh stopped');
        }
    },

    // Update Methods
    updateMetrics() {
        const container = document.querySelector('.participant-metrics');
        if (!container) return;

        const metrics = this.calculateMetrics();
        container.innerHTML = `
            <div class="participant-metric-card">
                <div class="participant-metric-label">Active Bids</div>
                <div class="participant-metric-value">${metrics.activeBids}</div>
                <div class="participant-metric-change neutral">pending</div>
            </div>
            <div class="participant-metric-card">
                <div class="participant-metric-label">Total Committed</div>
                <div class="participant-metric-value">${metrics.totalCommitted > 0 ? this.formatCurrency(metrics.totalCommitted) : '$0'}</div>
                <div class="participant-metric-change neutral">in bids</div>
            </div>
            <div class="participant-metric-card">
                <div class="participant-metric-label">Portfolio Holdings</div>
                <div class="participant-metric-value">${metrics.holdings}</div>
                <div class="participant-metric-change ${metrics.holdings > 0 ? 'positive' : 'neutral'}">
                    ${metrics.holdings > 0 ? 'active deals' : 'no holdings'}
                </div>
            </div>
            <div class="participant-metric-card">
                <div class="participant-metric-label">Available Deals</div>
                <div class="participant-metric-value">${metrics.availableDeals}</div>
                <div class="participant-metric-change ${metrics.availableDeals > 0 ? 'positive' : 'neutral'}">
                    ${metrics.availableDeals > 0 ? 'opportunities' : 'no open deals'}
                </div>
            </div>
            <div class="participant-metric-card">
                <div class="participant-metric-label">Avg Yield</div>
                <div class="participant-metric-value">${metrics.avgYield.toFixed(1)}%</div>
                <div class="participant-metric-change ${metrics.avgYield >= 7.0 ? 'positive' : 'neutral'}">
                    ${metrics.avgYield >= 7.0 ? 'above target' : 'portfolio average'}
                </div>
            </div>
        `;
    },

    updateAvailableDeals() {
        const container = document.getElementById('available-deals-list');
        if (!container) return;

        const deals = this.getAvailableDeals();

        // Update count badge
        const countBadge = document.querySelector('.deals-count');
        if (countBadge) countBadge.textContent = deals.length;

        container.innerHTML = deals.length === 0 ? `
            <div class="detail-empty-state">
                <div class="icon">📊</div>
                <p>No open syndications available at the moment.</p>
            </div>
        ` : deals.map(deal => this.renderDealRow(deal)).join('');

        this.attachDealListeners();

        // Re-attach quick bid buttons
        container.querySelectorAll('[data-action="bid-quick"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dealId = btn.dataset.dealId;
                this.handleQuickBid(dealId);
            });
        });

        container.querySelectorAll('[data-action="bid-custom"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dealId = btn.dataset.dealId;
                this.selectedSyndicationId = dealId;
                this.updateDetailPanel();
                document.querySelector('.participant-detail-panel')?.scrollIntoView({ behavior: 'smooth' });
            });
        });
    },

    updateActiveBids() {
        const container = document.getElementById('active-bids-list');
        if (!container) return;

        const bids = this.getParticipantBids();

        // Update count badge
        const countBadge = document.querySelector('.bids-count');
        if (countBadge) countBadge.textContent = bids.length;

        container.innerHTML = bids.length === 0 ? `
            <div class="detail-empty-state">
                <div class="icon">📝</div>
                <p>No active bids. Select a syndication above to place a bid.</p>
            </div>
        ` : bids.map(bid => this.renderBidRow(bid)).join('');
    },

    updateDetailPanel() {
        const container = document.getElementById('participant-detail-content');
        if (!container) return;

        container.innerHTML = this.renderDetailContent();

        // Re-attach event listeners for the bid form
        const bidForm = document.getElementById('participant-bid-form');
        if (bidForm) {
            bidForm.addEventListener('submit', (e) => this.handleBidSubmit(e));
        }

        const randomizeBtn = document.getElementById('btn-randomize-bid');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => this.randomizeBidFields());
        }
    }
};

window.ParticipantDashboard = ParticipantDashboard;
