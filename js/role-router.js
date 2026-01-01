/**
 * SyndiMatch Role Router
 * Manages role-based view switching with unique routes per role
 */

const RoleRouter = {
    // Role definitions with their unique routes
    roles: {
        platform: {
            name: 'Platform Admin',
            routes: ['overview', 'orchestration', 'payments', 'analytics', 'transactions'],
            defaultRoute: 'overview',
            features: ['simulation-controls', 'global-stats', 'all-agents']
        },
        originator: {
            name: 'Originator',
            routes: ['my-deals', 'create-syndication', 'payments-received', 'settings'],
            defaultRoute: 'my-deals',
            features: ['create-deal', 'fee-earnings']
        },
        participant: {
            name: 'Participant',
            routes: ['available-deals', 'my-bids', 'portfolio', 'earnings', 'settings'],
            defaultRoute: 'available-deals',
            features: ['auto-bid', 'cancel-bid', 'wealth-tracking']
        }
    },

    currentRole: 'platform',
    currentAgentId: null,
    currentRoute: null,

    // Dynamic agent maps
    agentNames: {},

    /**
     * Initialize the router
     */
    async init() {
        await this.loadAgents(); // Load agents first
        this.bindRoleSelector();
        this.createRoleViews();
        this.switchRole('platform', null);
    },

    /**
     * Load agents from API
     */
    async loadAgents() {
        try {
            // If running without API, fallback to basic mock
            if (typeof API === 'undefined' || !API.getAgents) return;

            const res = await API.getAgents();
            if (res) {
                // Flatten and map names
                [...res.originator, ...res.participant].forEach(agent => {
                    this.agentNames[agent._id || agent.id] = agent.name;
                });
            }
        } catch (e) {
            console.warn('Failed to load agents for router:', e);
        }
    },

    /**
     * Bind to role selector dropdown
     */
    bindRoleSelector() {
        const dropdown = document.getElementById('role-dropdown');
        if (!dropdown) return;

        // Repopulate dropdown if empty or basic
        if (dropdown.options.length <= 2) {
            this.populateRoleDropdown(dropdown);
        }

        dropdown.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'platform') {
                this.switchRole('platform', null);
            } else {
                const [type, agentId] = value.split(':');
                this.switchRole(type, agentId);
            }
        });
    },

    async populateRoleDropdown(dropdown) {
        // Clear existing except platform
        dropdown.innerHTML = '<option value="platform">Platform Admin (View All)</option>';

        const optGroupOrg = document.createElement('optgroup');
        optGroupOrg.label = 'Originators';

        const optGroupPart = document.createElement('optgroup');
        optGroupPart.label = 'Participants';

        try {
            const agents = await API.getAgents();

            if (agents?.originator) {
                agents.originator.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `originator:${a._id || a.id}`;
                    opt.textContent = `${a.name} (${a._id || a.id})`;
                    optGroupOrg.appendChild(opt);
                });
            }

            if (agents?.participant) {
                agents.participant.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `participant:${a._id || a.id}`;
                    opt.textContent = `${a.name} (${a._id || a.id})`;
                    optGroupPart.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Failed to populate role dropdown:', e);
            // Fallback handled by static HTML
            return;
        }

        dropdown.appendChild(optGroupOrg);
        dropdown.appendChild(optGroupPart);
    },

    /**
     * Switch to a different role
     */
    switchRole(role, agentId) {
        this.currentRole = role;
        this.currentAgentId = agentId;

        // Update body class
        document.body.className = document.body.className
            .replace(/role-\w+/g, '')
            .trim() + ` role-${role}`;

        // Update navigation tabs
        this.updateNavigation();

        // Switch to default route
        this.navigateTo(this.roles[role].defaultRoute);

        // Emit event
        window.dispatchEvent(new CustomEvent('roleChange', {
            detail: { role, agentId }
        }));

        console.log(`🔀 Switched to ${role}${agentId ? ` (${this.getAgentName(agentId)})` : ''}`);
    },

    /**
     * Update navigation tabs for current role
     */
    updateNavigation() {
        const navContainer = document.querySelector('.nav-tabs');
        if (!navContainer) return;

        const roleConfig = this.roles[this.currentRole];

        navContainer.innerHTML = roleConfig.routes.map(route => `
            <button class="nav-tab" data-view="${route}">
                ${this.getRouteLabel(route)}
            </button>
        `).join('');

        // Re-attach click handlers
        navContainer.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.navigateTo(tab.dataset.view);
            });
        });
    },

    /**
     * Get human-readable label for route
     */
    getRouteLabel(route) {
        const labels = {
            'overview': 'Overview',
            'orchestration': '🤖 Orchestration',
            'payments': 'Payments',
            'analytics': 'Analytics',
            'transactions': 'Transactions',
            'my-deals': 'My Deals',
            'create-syndication': '+ Create Deal',
            'payments-received': 'Payments',
            'settings': 'Settings',
            'available-deals': 'Available Deals',
            'my-bids': 'My Bids',
            'portfolio': 'Portfolio',
            'earnings': 'Earnings'
        };
        return labels[route] || route;
    },

    /**
     * Navigate to a route
     */
    navigateTo(route) {
        this.currentRoute = route;

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show target view or create it
        let targetView = document.getElementById(`view-${route}`);
        if (!targetView) {
            targetView = this.createView(route);
        }

        if (targetView) {
            targetView.classList.add('active');
        }

        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === route);
        });

        // Show metrics bar only on overview page
        const metricsBar = document.getElementById('metrics-bar');
        if (metricsBar) {
            metricsBar.style.display = (route === 'overview') ? 'flex' : 'none';
        }

        // Render view content
        this.renderViewContent(route);
    },

    /**
     * Create role-specific views
     */
    createRoleViews() {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        // Create views for all role-specific routes
        const allRoutes = new Set();
        Object.values(this.roles).forEach(r => r.routes.forEach(route => allRoutes.add(route)));

        allRoutes.forEach(route => {
            if (!document.getElementById(`view-${route}`)) {
                const view = document.createElement('div');
                view.id = `view-${route}`;
                view.className = 'view';
                mainContent.appendChild(view);
            }
        });
    },

    /**
     * Create a view container
     */
    createView(route) {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return null;

        const view = document.createElement('div');
        view.id = `view-${route}`;
        view.className = 'view';
        mainContent.appendChild(view);
        return view;
    },

    /**
     * Render content for a specific view
     */
    renderViewContent(route) {
        const view = document.getElementById(`view-${route}`);
        if (!view) return;

        // Platform Admin Dashboard Override
        if (route === 'overview' && this.currentRole === 'platform' && window.AdminView) {
            window.AdminView.renderDashboard(view);
            return;
        }

        switch (route) {
            case 'create-syndication':
                this.renderCreateSyndication(view);
                break;
            case 'available-deals':
                this.renderAvailableDeals(view);
                break;
            case 'my-bids':
                this.renderMyBids(view);
                break;
            case 'portfolio':
                this.renderPortfolio(view);
                break;
            case 'earnings':
                this.renderEarnings(view);
                break;
            case 'my-deals':
                this.renderMyDeals(view);
                break;
            case 'payments-received':
                this.renderPaymentsReceived(view);
                break;
            case 'transactions':
                this.renderTransactions(view);
                break;
            case 'orchestration':
                if (window.AgentsComponent) {
                    AgentsComponent.render();
                }
                break;
            case 'settings':
                this.renderSettings(view);
                break;
        }
    },

    /**
     * Render Create Syndication page (Originator)
     */
    renderCreateSyndication(view) {
        view.innerHTML = `
            <div class="create-syndication-page">
                <h2 class="page-title">Create New Syndication</h2>
                <div class="create-form-container">
                    <div class="ai-suggestion">
                        <span class="ai-badge">🤖 AI Suggested</span>
                        <p>Based on market conditions and your originator profile, we recommend:</p>
                    </div>
                    <form id="create-syndication-form" class="syndication-form">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Borrower Name</label>
                                <input type="text" id="borrower-name" value="TechCorp Industries" required>
                            </div>
                            <div class="form-group">
                                <label>Industry</label>
                                <select id="industry">
                                    <option value="Technology">Technology</option>
                                    <option value="Healthcare">Healthcare</option>
                                    <option value="Energy">Energy</option>
                                    <option value="Real Estate">Real Estate</option>
                                    <option value="Manufacturing">Manufacturing</option>
                                    <option value="Financial Services">Financial Services</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Loan Amount ($M)</label>
                                <input type="number" id="loan-amount" value="250" min="50" max="1000" required>
                                <span class="form-hint">Min: $50M, Max: $1B (based on tier)</span>
                            </div>
                            <div class="form-group">
                                <label>Syndication Target (%)</label>
                                <input type="number" id="synd-target" value="80" min="50" max="95">
                            </div>
                            <div class="form-group">
                                <label>Credit Rating</label>
                                <select id="credit-rating">
                                    <option value="AAA">AAA</option>
                                    <option value="AA+">AA+</option>
                                    <option value="AA">AA</option>
                                    <option value="A">A</option>
                                    <option value="BBB+" selected>BBB+</option>
                                    <option value="BBB">BBB</option>
                                    <option value="BB+">BB+</option>
                                    <option value="BB">BB</option>
                                    <option value="B">B</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Initial Spread (bps)</label>
                                <input type="number" id="initial-spread" value="420" min="300" max="600" required>
                                <span class="form-hint">Floor: 300bps (IG), 400bps (HY)</span>
                            </div>
                            <div class="form-group">
                                <label>Tenor</label>
                                <select id="tenor">
                                    <option value="3Y">3 Years</option>
                                    <option value="5Y" selected>5 Years</option>
                                    <option value="7Y">7 Years</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Loan Type</label>
                                <select id="loan-type">
                                    <option value="Term Loan B" selected>Term Loan B</option>
                                    <option value="Revolver">Revolver</option>
                                    <option value="Bridge Loan">Bridge Loan</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-rules">
                            <h4>Originator Rules</h4>
                            <ul>
                                <li id="rule-amount">✓ Amount within tier limit</li>
                                <li id="rule-spread">✓ Spread above minimum floor</li>
                                <li id="rule-concentration">✓ Industry concentration under 30%</li>
                            </ul>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="RoleRouter.generateSuggestion()">🔄 New Suggestion</button>
                            <button type="submit" class="btn-primary">📢 Announce Syndication</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Attach form handler
        document.getElementById('create-syndication-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.announceSyndication();
        });
    },

    /**
     * Generate AI suggestion for new syndication
     */
    generateSuggestion() {
        const industries = ['Technology', 'Healthcare', 'Energy', 'Real Estate', 'Manufacturing'];
        const ratings = ['BBB+', 'BBB', 'BB+', 'BB', 'A'];
        const amounts = [100, 150, 200, 250, 300, 400, 500];

        document.getElementById('borrower-name').value = `${industries[Math.floor(Math.random() * industries.length)]}Corp ${Math.floor(Math.random() * 1000)}`;
        document.getElementById('industry').value = industries[Math.floor(Math.random() * industries.length)];
        document.getElementById('loan-amount').value = amounts[Math.floor(Math.random() * amounts.length)];
        document.getElementById('credit-rating').value = ratings[Math.floor(Math.random() * ratings.length)];
        document.getElementById('initial-spread').value = 350 + Math.floor(Math.random() * 150);
    },

    /**
     * Announce a new syndication
     */
    announceSyndication() {
        const syndication = {
            id: `SYND-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            borrower: document.getElementById('borrower-name').value,
            industry: document.getElementById('industry').value,
            amount: parseInt(document.getElementById('loan-amount').value),
            rating: document.getElementById('credit-rating').value,
            spread: parseInt(document.getElementById('initial-spread').value),
            tenor: document.getElementById('tenor').value,
            loanType: document.getElementById('loan-type').value,
            syndicationTarget: parseInt(document.getElementById('synd-target').value),
            originatorId: this.currentAgentId,
            status: 'open',
            announcedAt: SimulationEngine?.getCurrentDate()?.toISOString() || new Date().toISOString()
        };

        // Add to auto-generator if available
        if (window.AutoGenerator) {
            window.AutoGenerator.addSyndication(syndication);
        }

        alert(`✅ Syndication ${syndication.id} announced!\n\n${syndication.borrower}\n$${syndication.amount}M at ${syndication.spread}bps`);
        this.navigateTo('my-deals');
    },

    /**
     * Render Available Deals (Participant)
     */
    renderAvailableDeals(view) {
        // Merge AutoGenerator deals with SyndiData mock deals
        const autoDeals = window.AutoGenerator?.activeSyndications || [];
        const mockDeals = (typeof SyndiData !== 'undefined' && SyndiData.syndications)
            ? SyndiData.syndications.filter(s => s.status?.toLowerCase() === 'open')
            : [];

        // Combine and dedupe by id
        const allDeals = [...autoDeals];
        mockDeals.forEach(md => {
            if (!allDeals.find(d => d.id === md.id)) {
                allDeals.push(md);
            }
        });

        view.innerHTML = `
            <div class="available-deals-page">
                <h2 class="page-title">Available Syndications</h2>
                <div class="deals-grid">
                    ${allDeals.length === 0 ? '<p class="no-deals">No open syndications. Start the simulation to generate deals.</p>' : ''}
                    ${allDeals.map(deal => {
            // Use ParticipantView for analytics if available
            const analyticsHtml = window.ParticipantView ? window.ParticipantView.renderDealAnalysis(deal) : '';

            return `
                        <div class="deal-card expanded-card" data-id="${deal.id}">
                            <div class="deal-header">
                                <span class="deal-id">${deal.id}</span>
                                <span class="deal-status status-badge open">OPEN</span>
                            </div>
                            <div class="deal-main-info">
                                <div class="deal-borrower-large">${deal.borrower}</div>
                                <div class="deal-tags">
                                    <span class="tag tag-industry">${deal.industry}</span>
                                    <span class="tag tag-rating">${deal.rating}</span>
                                    <span class="tag tag-tenor">${deal.tenor || '5Y'}</span>
                                </div>
                            </div>
                            
                            <!-- Participant Analytics Section -->
                            ${analyticsHtml}

                            <div class="deal-details-row">
                                <div class="detail-item">
                                    <div class="detail-label">Amount</div>
                                    <div class="detail-value">$${deal.amount}M</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Spread</div>
                                    <div class="detail-value">${deal.spread} bps</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Fees</div>
                                    <div class="detail-value">1.25%</div> 
                                </div>
                            </div>

                            <div class="deal-actions">
                                <span class="auto-bid-status">🤖 Auto-bid enabled</span>
                                <button class="btn-cancel-bid" data-id="${deal.id}">Cancel Bid</button>
                                <button class="btn-primary" onclick="RoleRouter.placeManualBid('${deal.id}')">Place Bid</button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;

        // Attach cancel handlers
        view.querySelectorAll('.btn-cancel-bid').forEach(btn => {
            btn.addEventListener('click', () => this.cancelBid(btn.dataset.id));
        });
    },

    /**
     * Place manual bid (placeholder)
     */
    placeManualBid(dealId) {
        alert(`Bid placement for ${dealId} coming in Phase 2.3!`);
    },

    /**
     * Cancel a bid
     */
    cancelBid(dealId) {
        if (confirm(`Cancel bid on ${dealId}? A 0.2% break fee may apply.`)) {
            // Record break fee transaction
            if (window.SimulationEngine) {
                SimulationEngine.recordTransaction({
                    type: 'break_fee',
                    from: this.currentAgentId,
                    to: 'platform',
                    amount: 10000, // Placeholder
                    dealId
                });
            }
            alert(`Bid on ${dealId} cancelled. Break fee applied.`);
        }
    },

    /**
     * Render My Bids (Participant)
     */
    renderMyBids(view) {
        const bids = window.AutoBidder ? window.AutoBidder.getParticipantBids(this.currentAgentId) : [];

        // Also check if we have mock bids in SyndiData for this agent
        if (typeof SyndiData !== 'undefined' && SyndiData.bids) {
            // This logic is imperfect as SyndiData.bids is loose, but let's try to match by name
            // Assuming currentAgentId maps to a name
            const agentName = this.getAgentName(this.currentAgentId);
            const mockBids = SyndiData.bids.filter(b => b.participant === agentName);
            mockBids.forEach(mb => {
                // Dedupe
                if (!bids.find(b => b.syndicationId === 'SYND-2025-001' && b.amount === mb.amount)) {
                    bids.push({
                        syndicationId: 'SYND-2025-001', // Mock ID
                        borrower: 'TechFlow Solutions', // Mock
                        amount: mb.amount,
                        spread: mb.spread,
                        status: mb.action === 'BID' ? 'executed' : 'passed',
                        canCancel: false
                    });
                }
            });
        }

        view.innerHTML = `
            <div class="my-bids-page">
                <h2 class="page-title">My Bids</h2>
                <table class="bids-table">
                    <thead>
                        <tr>
                            <th>Syndication</th>
                            <th>Borrower</th>
                            <th>Bid Amount</th>
                            <th>Spread</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="my-bids-body">
                        ${bids.length === 0 ? '<tr><td colspan="6" class="text-muted">No bids yet. Bids will appear here as the simulation runs.</td></tr>' : ''}
                        ${bids.map(bid => `
                            <tr>
                                <td>${bid.syndicationId}</td>
                                <td>${bid.borrower || bid.participantName || 'Unknown'}</td> <!-- mixed data models -->
                                <td>$${bid.amount}M</td>
                                <td>${bid.spread || '—'} bps</td>
                                <td><span class="status-badge ${bid.status}">${bid.status}</span></td>
                                <td>
                                    ${bid.canCancel ? `<button class="btn-cancel-bid" data-id="${bid.id}">Cancel</button>` : '—'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Attach handlers
        view.querySelectorAll('.btn-cancel-bid').forEach(btn => {
            btn.addEventListener('click', () => {
                // Call AutoBidder cancel
                if (window.AutoBidder) {
                    window.AutoBidder.cancelBid(btn.dataset.id);
                    this.renderMyBids(view); // Re-render
                }
            });
        });
    },

    getAgentName(id) {
        return this.agentNames[id] || id;
    },

    /**
     * Render Portfolio (Participant)
     */
    async renderPortfolio(view) {
        try {
            view.innerHTML = '<div class="loading-state">Loading portfolio data...</div>';

            // Fetch real portfolio from API
            const stats = await API.getPortfolio(this.currentAgentId);

            if (!stats) throw new Error('No portfolio data returned');

            view.innerHTML = `
                <div class="portfolio-page">
                    <div class="page-header-flex">
                        <h2 class="page-title">Portfolio Overview</h2>
                        <div class="last-updated">Last updated: ${new Date().toLocaleTimeString()}</div>
                    </div>

                    <!-- Summary Cards -->
                    <div class="wealth-cards">
                        <div class="wealth-card">
                            <div class="wealth-label">Total Exposure</div>
                            <div class="wealth-value">$${(stats.total_exposure / 1000000).toFixed(1)}M</div>
                            <div class="wealth-sub">across ${stats.deal_count} active deals</div>
                        </div>
                        <div class="wealth-card">
                            <div class="wealth-label">Weighted Avg Yield</div>
                            <div class="wealth-value">${stats.weighted_yield.toFixed(2)}%</div>
                            <div class="wealth-sub">Spread: ${Math.round(stats.weighted_spread)} bps</div>
                        </div>
                        <div class="wealth-card highlight">
                            <div class="wealth-label">Available Capacity</div>
                            <div class="wealth-value">$${(stats.available_capacity / 1000000).toFixed(1)}M</div>
                            <div class="wealth-sub">Utilization: ${stats.utilization}%</div>
                        </div>
                        <div class="wealth-card success">
                            <div class="wealth-label">Net ROI (YTD)</div>
                            <div class="wealth-value">+${stats.roi_ytd.toFixed(1)}%</div>
                            <div class="wealth-sub">Interest: $${(stats.interest_ytd / 1000000).toFixed(1)}M</div>
                        </div>
                    </div>

                    <!-- Concentration Analysis -->
                    <div class="charts-section" style="margin-top: 2rem;">
                        <h3 class="section-title">Risk Concentration</h3>
                        <div class="analytics-grid">
                            
                            <!-- Sector Exposure -->
                            <div class="metric-card">
                                <h4 class="chart-title">Sector Exposure</h4>
                                <div class="bar-chart-vertical">
                                    ${stats.sectors.map(s => `
                                        <div class="bar-group">
                                            <div class="bar-fill" style="height: ${s.pct}%; background: var(--primary);"></div>
                                            <span class="bar-label">${s.name}</span>
                                            <span class="bar-value">${s.pct}%</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Credit Rating -->
                            <div class="metric-card">
                                <h4 class="chart-title">Credit Quality</h4>
                                <div class="bar-chart-vertical">
                                    ${stats.ratings.map(r => `
                                        <div class="bar-group">
                                            <div class="bar-fill" style="height: ${r.pct}%; background: ${this.getRatingColor(r.name)};"></div>
                                            <span class="bar-label">${r.name}</span>
                                            <span class="bar-value">${r.pct}%</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Active Holdings -->
                    <h3 class="section-title" style="margin-top: 2rem;">Active Holdings</h3>
                    <div class="table-container">
                        <table class="portfolio-table">
                            <thead>
                                <tr>
                                    <th>Borrower</th>
                                    <th>Sector</th>
                                    <th>Rating</th>
                                    <th>Allocated</th>
                                    <th>Spread</th>
                                    <th>Tenor</th>
                                    <th>Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.holdings.length === 0 ? '<tr><td colspan="7" class="text-muted">No active holdings. (Place bids to build portfolio)</td></tr>' : ''}
                                ${stats.holdings.map(h => `
                                    <tr>
                                        <td><strong>${h.borrower}</strong><div class="text-xs text-muted">${h.id}</div></td>
                                        <td>${h.industry}</td>
                                        <td><span class="rating-badge ${h.rating.replace('+', '').replace('-', '').toLowerCase()}">${h.rating}</span></td>
                                        <td>$${h.amount.toFixed(1)}M</td>
                                        <td>${h.spread} bps</td>
                                        <td>${h.tenor}</td>
                                        <td><span class="status-dot green"></span> Performing</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Portfolio render error:', error);
            view.innerHTML = `
                <div class="error-state">
                    <h3>Failed to load portfolio</h3>
                    <p>Could not fetch data for ${this.currentAgentId}</p>
                    <button class="btn-secondary" onclick="RoleRouter.renderPortfolio(document.getElementById('view-portfolio'))">Try Again</button>
                    ${Config.IS_DEV ? `<pre class="debug-info">${error.message}</pre>` : ''}
                </div>
            `;
        }
    },

    // Legacy mock function removed
    /* calculatePortfolioStats(agentId) { ... } */

    getRatingColor(rating) {
        if (rating.startsWith('A')) return '#10B981'; // Green
        if (rating.startsWith('BBB')) return '#3B82F6'; // Blue
        if (rating.startsWith('BB')) return '#F59E0B'; // Orange
        return '#EF4444'; // Red
    },

    /**
     * Render Earnings (Participant) - with transaction history
     */
    renderEarnings(view) {
        const wealth = window.SimulationEngine?.getWealth(this.currentAgentId) || {
            totalEarnings: 0,
            totalFeesPaid: 0
        };

        // Get transactions for this participant
        const allTx = window.SimulationEngine?.transactions || [];
        const myTransactions = allTx.filter(tx =>
            tx.to === this.currentAgentId || tx.from === this.currentAgentId
        ).slice(-30).reverse();

        // Categorize transactions
        const interestPayments = myTransactions.filter(tx => tx.type === 'interest_payment' && tx.to === this.currentAgentId);
        const feesPaid = myTransactions.filter(tx => tx.from === this.currentAgentId);
        const totalInterest = interestPayments.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const totalFees = feesPaid.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        view.innerHTML = `
            <div class="earnings-page">
                <h2 class="page-title">Earnings & Transaction History</h2>
                <div class="wealth-cards">
                    <div class="wealth-card success">
                        <div class="wealth-label">Interest Earned</div>
                        <div class="wealth-value">+$${(totalInterest / 1000000).toFixed(2)}M</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Fees Paid</div>
                        <div class="wealth-value">-$${(totalFees / 1000000).toFixed(2)}M</div>
                    </div>
                    <div class="wealth-card highlight">
                        <div class="wealth-label">Net Earnings</div>
                        <div class="wealth-value ${totalInterest - totalFees >= 0 ? 'positive' : 'negative'}">
                            ${totalInterest - totalFees >= 0 ? '+' : ''}$${((totalInterest - totalFees) / 1000000).toFixed(2)}M
                        </div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Total Transactions</div>
                        <div class="wealth-value">${myTransactions.length}</div>
                    </div>
                </div>

                <h3>Transaction History</h3>
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Counterparty</th>
                            <th>Deal</th>
                            <th>Amount</th>
                            <th>Direction</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myTransactions.length === 0 ? '<tr><td colspan="6" class="text-muted">No transactions yet. As the simulation runs, interest payments and fees will appear here.</td></tr>' : ''}
                        ${myTransactions.map(tx => {
            const isIncoming = tx.to === this.currentAgentId;
            const counterparty = isIncoming ? tx.from : tx.to;
            return `
                            <tr class="${isIncoming ? 'tx-incoming' : 'tx-outgoing'}">
                                <td>${new Date(tx.timestamp).toLocaleDateString()}</td>
                                <td><span class="tx-type-badge">${tx.type.replace('_', ' ')}</span></td>
                                <td>${counterparty || '—'}</td>
                                <td>${tx.dealId || '—'}</td>
                                <td class="tx-amount ${isIncoming ? 'positive' : 'negative'}">
                                    ${isIncoming ? '+' : '-'}$${((tx.amount || 0) / 1000000).toFixed(2)}M
                                </td>
                                <td>${isIncoming ? '<span class="tx-dir in">↓ IN</span>' : '<span class="tx-dir out">↑ OUT</span>'}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Render My Deals (Originator)
     */
    renderMyDeals(view) {
        const deals = window.AutoGenerator?.activeSyndications?.filter(s => s.originatorId === this.currentAgentId) || [];

        view.innerHTML = `
            <div class="my-deals-page">
                <h2 class="page-title">My Syndications</h2>
                <button class="btn-primary" onclick="RoleRouter.navigateTo('create-syndication')">+ Create New Syndication</button>
                <div class="deals-list">
                    ${deals.length === 0 ? '<p class="text-muted">No deals yet. Create your first syndication!</p>' : ''}
                    ${deals.map(deal => `
                        <div class="deal-row">
                            <span class="deal-id">${deal.id}</span>
                            <span class="deal-borrower">${deal.borrower}</span>
                            <span class="deal-amount">$${deal.amount}M</span>
                            <span class="deal-status status-badge ${deal.status}">${deal.status}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render Payments Received (Originator) - with transaction history
     */
    renderPaymentsReceived(view) {
        const wealth = window.SimulationEngine?.getWealth(this.currentAgentId) || {
            totalOriginated: 0,
            totalFeesEarned: 0,
            activeDeals: 0,
            completedDeals: 0
        };

        // Get transactions for this originator
        const allTx = window.SimulationEngine?.transactions || [];
        const myTransactions = allTx.filter(tx =>
            tx.to === this.currentAgentId || tx.from === this.currentAgentId
        ).slice(-30).reverse();

        // Calculate incoming vs outgoing
        const incoming = myTransactions.filter(tx => tx.to === this.currentAgentId);
        const outgoing = myTransactions.filter(tx => tx.from === this.currentAgentId);
        const totalIncoming = incoming.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const totalOutgoing = outgoing.reduce((sum, tx) => sum + (tx.amount || 0), 0);

        view.innerHTML = `
            <div class="payments-received-page">
                <h2 class="page-title">Payments & Transactions</h2>
                <div class="wealth-cards">
                    <div class="wealth-card">
                        <div class="wealth-label">Total Originated</div>
                        <div class="wealth-value">$${(wealth.totalOriginated / 1000000).toFixed(0)}M</div>
                    </div>
                    <div class="wealth-card success">
                        <div class="wealth-label">Fees Earned</div>
                        <div class="wealth-value">+$${(wealth.totalFeesEarned / 1000000).toFixed(2)}M</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Active Deals</div>
                        <div class="wealth-value">${wealth.activeDeals || 0}</div>
                    </div>
                    <div class="wealth-card">
                        <div class="wealth-label">Completed</div>
                        <div class="wealth-value">${wealth.completedDeals || 0}</div>
                    </div>
                </div>
                
                <div class="tx-summary">
                    <div class="tx-summary-item incoming">
                        <span class="tx-arrow">↓</span>
                        <span>Incoming: <strong>$${(totalIncoming / 1000000).toFixed(2)}M</strong></span>
                    </div>
                    <div class="tx-summary-item outgoing">
                        <span class="tx-arrow">↑</span>
                        <span>Outgoing: <strong>$${(totalOutgoing / 1000000).toFixed(2)}M</strong></span>
                    </div>
                </div>

                <h3>Transaction History</h3>
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Counterparty</th>
                            <th>Deal</th>
                            <th>Amount</th>
                            <th>Direction</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${myTransactions.length === 0 ? '<tr><td colspan="6" class="text-muted">No transactions yet. Start the simulation to see activity.</td></tr>' : ''}
                        ${myTransactions.map(tx => {
            const isIncoming = tx.to === this.currentAgentId;
            const counterparty = isIncoming ? tx.from : tx.to;
            return `
                            <tr class="${isIncoming ? 'tx-incoming' : 'tx-outgoing'}">
                                <td>${new Date(tx.timestamp).toLocaleDateString()}</td>
                                <td><span class="tx-type-badge">${tx.type.replace('_', ' ')}</span></td>
                                <td>${counterparty || '—'}</td>
                                <td>${tx.dealId || '—'}</td>
                                <td class="tx-amount ${isIncoming ? 'positive' : 'negative'}">
                                    ${isIncoming ? '+' : '-'}$${((tx.amount || 0) / 1000000).toFixed(2)}M
                                </td>
                                <td>${isIncoming ? '<span class="tx-dir in">↓ IN</span>' : '<span class="tx-dir out">↑ OUT</span>'}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Render Transactions (Admin)
     */
    renderTransactions(view) {
        const transactions = window.SimulationEngine?.transactions || [];

        // Agent name lookup
        const agentNames = {
            // Participants
            'PA-001': 'Apollo Global',
            'PA-002': 'CalPERS',
            'PA-003': 'BNP Paribas AM',
            'PA-004': 'MUFG Bank',
            'PA-005': 'Palmer Square',
            'PA-101': 'State Street',
            'PA-102': 'PNC Bank',
            'PA-103': 'Northern Trust',
            'PA-104': 'KeyBank',
            'PA-105': 'Fifth Third',
            // Originators
            'OA-001': 'JPMorgan Chase',
            'OA-002': 'Bank of America',
            'OA-003': 'Wells Fargo',
            'OA-004': 'Citi',
            'OA-005': 'Goldman Sachs',
            'OA-006': 'Morgan Stanley',
            'OA-007': 'Credit Suisse',
            'OA-008': 'Deutsche Bank',
            'platform': 'Platform'
        };

        const getAgentName = (id) => agentNames[id] || id || '—';

        const getSyndicationInfo = (dealId) => {
            if (!dealId) return '—';
            const synd = window.AutoGenerator?.getSyndication(dealId);
            if (synd) {
                return `<span class="synd-link">${dealId}<br><small>${synd.borrower}</small></span>`;
            }
            return dealId;
        };

        view.innerHTML = `
            <div class="transactions-page">
                <h2 class="page-title">Transaction History</h2>
                <table class="transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>From</th>
                            <th>To</th>
                            <th>Syndication</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.length === 0 ? '<tr><td colspan="6" class="text-muted">No transactions yet. Start the simulation to generate activity.</td></tr>' : ''}
                        ${transactions.slice(-50).reverse().map(tx => `
                            <tr>
                                <td>${new Date(tx.timestamp).toLocaleDateString()}</td>
                                <td><span class="tx-type-badge">${(tx.type || '').replace(/_/g, ' ')}</span></td>
                                <td><strong>${getAgentName(tx.from)}</strong></td>
                                <td><strong>${getAgentName(tx.to)}</strong></td>
                                <td>${getSyndicationInfo(tx.dealId)}</td>
                                <td class="tx-amount">$${((tx.amount || 0) / 1000000).toFixed(2)}M</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Render Settings page
     */
    renderSettings(view) {
        view.innerHTML = `
            <div class="settings-page">
                <h2 class="page-title">Agent Settings</h2>
                <form class="settings-form">
                    <div class="form-group">
                        <label>Risk Appetite</label>
                        <select id="risk-appetite">
                            <option value="conservative">Conservative (AAA-A only)</option>
                            <option value="moderate" selected>Moderate (AAA-BBB)</option>
                            <option value="aggressive">Aggressive (AAA-B)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Target Yield (%)</label>
                        <input type="number" id="target-yield" value="8.5" min="5" max="15" step="0.5">
                    </div>
                    <div class="form-group">
                        <label>Max Single Allocation ($M)</label>
                        <input type="number" id="max-allocation" value="100" min="10" max="500">
                    </div>
                    <div class="form-group">
                        <label>Preferred Industries</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" checked> Technology</label>
                            <label><input type="checkbox" checked> Healthcare</label>
                            <label><input type="checkbox"> Energy</label>
                            <label><input type="checkbox" checked> Real Estate</label>
                            <label><input type="checkbox"> Manufacturing</label>
                        </div>
                    </div>
                    <button type="submit" class="btn-primary">Save Settings</button>
                </form>
            </div>
        `;
    }
};

// Add role-router styles
const routerStyles = document.createElement('style');
routerStyles.textContent = `
    .page-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem; }
    .create-syndication-page, .available-deals-page, .my-bids-page, .portfolio-page, .earnings-page, .my-deals-page, .payments-received-page, .transactions-page, .settings-page {
        padding: 1rem;
    }
    .create-form-container { max-width: 800px; }
    .syndication-form { background: var(--bg-card); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color); }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .form-group label { font-size: 0.875rem; font-weight: 500; color: var(--text-secondary); }
    .form-group input, .form-group select { padding: 0.625rem; background: var(--bg-main); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-primary); font-size: 0.875rem; }
    .form-hint { font-size: 0.75rem; color: var(--text-muted); }
    .form-rules { background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; }
    .form-rules h4 { margin-bottom: 0.5rem; font-size: 0.875rem; }
    .form-rules ul { list-style: none; font-size: 0.8125rem; color: var(--success); }
    .form-actions { display: flex; gap: 1rem; justify-content: flex-end; }
    .btn-primary { background: var(--primary); color: white; padding: 0.625rem 1.5rem; border: none; border-radius: var(--radius-md); cursor: pointer; font-weight: 500; }
    .btn-secondary { background: var(--bg-card); color: var(--text-secondary); padding: 0.625rem 1.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; }
    .ai-suggestion { background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; }
    .deals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
    .deal-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1rem; }
    .deal-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .deal-borrower { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; }
    .deal-details { font-size: 0.875rem; margin-bottom: 1rem; }
    .deal-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border-color); }
    .auto-bid-status { font-size: 0.75rem; color: var(--success); }
    .btn-cancel-bid { background: var(--danger-bg); color: var(--danger); border: none; padding: 0.375rem 0.75rem; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.75rem; }
    .wealth-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .wealth-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.25rem; text-align: center; }
    .wealth-card.highlight { border-color: var(--primary); }
    .wealth-card.success .wealth-value { color: var(--success); }
    .wealth-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.5rem; }
    .wealth-value { font-size: 1.5rem; font-weight: 700; }
    .transactions-table, .bids-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .transactions-table th, .bids-table th { text-align: left; padding: 0.75rem; background: var(--bg-card); border-bottom: 1px solid var(--border-color); }
    .transactions-table td, .bids-table td { padding: 0.75rem; border-bottom: 1px solid var(--border-color); }
    .settings-form { max-width: 500px; background: var(--bg-card); padding: 1.5rem; border-radius: var(--radius-lg); }
    .settings-form .form-group { margin-bottom: 1rem; }
    .checkbox-group { display: flex; flex-wrap: wrap; gap: 1rem; }
    .checkbox-group label { display: flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; }
    .no-deals { color: var(--text-muted); text-align: center; padding: 2rem; }
    .deal-row { display: grid; grid-template-columns: 120px 1fr 100px 100px; gap: 1rem; padding: 0.75rem; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 0.5rem; align-items: center; }
    
    /* Transaction Table Styles */
    .tx-summary { display: flex; gap: 2rem; margin-bottom: 1.5rem; }
    .tx-summary-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); }
    .tx-summary-item.incoming .tx-arrow { color: var(--success); }
    .tx-summary-item.outgoing .tx-arrow { color: var(--danger); }
    .tx-arrow { font-size: 1.25rem; }
    .tx-amount.positive { color: var(--success); font-weight: 600; }
    .tx-amount.negative { color: var(--danger); font-weight: 600; }
    .tx-dir { padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; }
    .tx-dir.in { background: var(--success-bg); color: var(--success); }
    .tx-dir.out { background: var(--danger-bg); color: var(--danger); }
    .tx-type-badge { background: var(--info-bg); color: var(--info); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; text-transform: capitalize; }
    .tx-incoming { background: rgba(5, 150, 105, 0.03); }
    .tx-outgoing { background: rgba(220, 38, 38, 0.03); }
    .wealth-value.positive { color: var(--success); }
    .wealth-value.negative { color: var(--danger); }
`;
document.head.appendChild(routerStyles);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    RoleRouter.init();
});

// Export
window.RoleRouter = RoleRouter;
