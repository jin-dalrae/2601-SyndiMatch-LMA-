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
            routes: ['originator', 'overview', 'orchestration', 'my-deals', 'create-syndication', 'payments-received', 'analytics', 'settings'],
            defaultRoute: 'originator',
            features: ['create-deal', 'fee-earnings']
        },
        participant: {
            name: 'Participant',
            routes: ['participant', 'overview', 'orchestration', 'available-deals', 'my-bids', 'portfolio', 'earnings', 'analytics', 'settings'],
            defaultRoute: 'participant',
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

        // Check current URL path to determine initial role/route
        const currentPath = window.location.pathname.replace(/^\//, '') || 'overview';

        // Determine role based on current path
        if (currentPath === 'originator' || currentPath.startsWith('originator')) {
            this.currentRole = 'originator';
            this.currentRoute = 'originator';
        } else if (currentPath === 'participant' || currentPath.startsWith('participant')) {
            this.currentRole = 'participant';
            this.currentRoute = 'participant';
        } else {
            this.currentRole = 'platform';
            this.currentRoute = currentPath;
        }

        // Update UI without forcing navigation (let Router handle it)
        this.updateNavigation();
        this.renderViewContent(this.currentRoute);

        console.log(`🔀 RoleRouter initialized with route: ${this.currentRoute}`);
    },

    /**
     * Load agents from API
     */
    async loadAgents() {
        try {
            if (typeof API === 'undefined' || !API.getAgents) return;

            const res = await API.getAgents();
            if (res) {
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
        dropdown.innerHTML = '<option value="platform">Platform Admin (View All)</option>';

        const optGroupOrg = document.createElement('optgroup');
        optGroupOrg.label = 'Originators';

        const optGroupPart = document.createElement('optgroup');
        optGroupPart.label = 'Participants';

        try {
            if (typeof API === 'undefined' || !API.getAgents) return;
            const agents = await API.getAgents();

            if (agents?.originator) {
                agents.originator.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `originator:${a._id || a.id}`;
                    opt.textContent = `[Originator] ${a.name}`;
                    optGroupOrg.appendChild(opt);
                });
            }

            if (agents?.participant) {
                agents.participant.forEach(a => {
                    const opt = document.createElement('option');
                    opt.value = `participant:${a._id || a.id}`;
                    opt.textContent = `[Participant] ${a.name}`;
                    optGroupPart.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Failed to populate role dropdown:', e);
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

        document.body.className = document.body.className
            .replace(/role-\w+/g, '')
            .trim() + ` role-${role}`;

        this.updateNavigation();
        this.navigateTo(this.roles[role].defaultRoute);

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
            'orchestration': 'Orchestration',
            'payments': 'Payments',
            'analytics': 'Analytics',
            'transactions': 'Transactions',
            'my-deals': 'My Deals',
            'create-syndication': 'Originate',
            'originate': 'Originate',
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
        // Alias common routes to match index.html IDs
        let targetId = `view-${route}`;
        if (route === 'create-syndication') targetId = 'view-originate';
        if (route === 'originate') targetId = 'view-originate';

        this.currentRoute = route;

        // Update browser URL using History API
        const newPath = `/${route}`;
        if (window.location.pathname !== newPath) {
            window.history.pushState({}, '', newPath);
        }

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        let targetView = document.getElementById(targetId);
        if (!targetView) {
            targetView = this.createView(route);
        }

        if (targetView) {
            targetView.classList.add('active');
        }

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === route);
        });

        const metricsBar = document.getElementById('metrics-bar');
        if (metricsBar) {
            metricsBar.style.display = (route === 'overview') ? 'flex' : 'none';
        }

        this.renderViewContent(route);
    },

    /**
     * Create role-specific views
     */
    createRoleViews() {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

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

        if (route === 'overview' && this.currentRole === 'platform' && window.AdminView) {
            window.AdminView.renderDashboard(view);
            return;
        }

        // Handle dedicated dashboards
        if (route === 'participant' && window.ParticipantDashboard) {
            window.ParticipantDashboard.render();
            return;
        }

        if (route === 'originator' && window.OriginatorDashboard) {
            window.OriginatorDashboard.render();
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
                if (window.AgentOrchestration) {
                    AgentOrchestration.init();  // Ensure connected to simulation events
                    AgentOrchestration.render(view);
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
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Loan Amount ($M)</label>
                                <input type="number" id="loan-amount" value="250" min="50" max="1000" required>
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
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Initial Spread (bps)</label>
                                <input type="number" id="initial-spread" value="420" min="300" max="600" required>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="RoleRouter.generateSuggestion()">🔄 New Suggestion</button>
                            <button type="submit" class="btn-primary">📢 Announce Syndication</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('create-syndication-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.announceSyndication();
        });
    },

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

    announceSyndication() {
        const syndication = {
            id: `SYND-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            borrower: document.getElementById('borrower-name').value,
            industry: document.getElementById('industry').value,
            amount: parseInt(document.getElementById('loan-amount').value),
            rating: document.getElementById('credit-rating').value,
            spread: parseInt(document.getElementById('initial-spread').value),
            syndicationTarget: parseInt(document.getElementById('synd-target').value),
            originatorId: this.currentAgentId,
            status: 'open',
            announcedAt: new Date().toISOString()
        };

        if (window.SyndiData && SyndiData.syndications) {
            SyndiData.syndications.push(syndication);
        }

        window.dispatchEvent(new CustomEvent('newSyndication', { detail: syndication }));
        alert(`✅ Syndication ${syndication.id} announced!`);
        this.navigateTo('my-deals');
    },

    renderAvailableDeals(view) {
        const deals = (typeof SyndiData !== 'undefined' && SyndiData.syndications)
            ? SyndiData.syndications.filter(s => s.status?.toLowerCase() === 'open')
            : [];

        view.innerHTML = `
            <div class="available-deals-page">
                <h2 class="page-title">Available Syndications</h2>
                <div class="deals-grid">
                    ${deals.length === 0 ? '<p class="no-deals">No open syndications at the moment.</p>' : ''}
                    ${deals.map(deal => `
                        <div class="deal-card">
                            <div class="deal-header">
                                <span class="deal-id">${deal.id}</span>
                                <span class="status-badge open">OPEN</span>
                            </div>
                            <div class="deal-borrower">${deal.borrower}</div>
                            <div class="deal-details">
                                <div>Industry: ${deal.industry}</div>
                                <div>Amount: $${deal.amount}M</div>
                                <div>Spread: ${deal.spread} bps</div>
                            </div>
                            <div class="deal-actions">
                                <button class="btn-primary" onclick="RoleRouter.placeManualBid('${deal.id}')">Place Bid</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    placeManualBid(dealId) {
        alert(`Bidding on ${dealId}...`);
        // Implementation here
    },

    async renderPortfolio(view) {
        try {
            view.innerHTML = '<div class="loading-state">Loading portfolio data...</div>';

            const stats = (window.API && API.getPortfolio)
                ? await API.getPortfolio(this.currentAgentId)
                : this.fallbackPortfolioStats(this.currentAgentId);

            if (!stats) throw new Error('No portfolio data');

            view.innerHTML = `
                <div class="portfolio-page">
                    <div class="page-header-flex">
                        <h2 class="page-title">Portfolio Overview</h2>
                        <div class="last-updated">Last updated: ${new Date().toLocaleTimeString()}</div>
                    </div>

                    <div class="wealth-cards">
                        <div class="wealth-card">
                            <div class="wealth-label">Total Exposure</div>
                            <div class="wealth-value">$${((stats.total_exposure || stats.totalExposure || 0) / 1000000).toFixed(1)}M</div>
                        </div>
                        <div class="wealth-card">
                            <div class="wealth-label">Yield</div>
                            <div class="wealth-value">${(stats.weighted_yield || stats.weightedYield || 0).toFixed(2)}%</div>
                        </div>
                        <div class="wealth-card highlight">
                            <div class="wealth-label">Utilization</div>
                            <div class="wealth-value">${stats.utilization || 0}%</div>
                        </div>
                        <div class="wealth-card success">
                            <div class="wealth-label">ROI (YTD)</div>
                            <div class="wealth-value">+${(stats.roi_ytd || stats.roi || 0).toFixed(1)}%</div>
                        </div>
                    </div>

                    <div class="holdings-section">
                        <h3>Active Holdings</h3>
                        <table class="portfolio-table">
                            <thead>
                                <tr>
                                    <th>Borrower</th>
                                    <th>Sector</th>
                                    <th>Rating</th>
                                    <th>ESG</th>
                                    <th>Allocated</th>
                                    <th>Performance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(stats.holdings || []).map(h => `
                                    <tr>
                                        <td><strong>${h.borrower || h.borrower_name}</strong></td>
                                        <td>${h.industry}</td>
                                        <td><span class="rating-badge">${h.rating || h.credit_rating}</span></td>
                                        <td><span class="esg-score">${h.esg || h.esg_score || 70}</span></td>
                                        <td>$${((h.amount || h.final_allocation || 0) / 1000000).toFixed(1)}M</td>
                                        <td><span class="status-dot green"></span> Performing</td>
                                    </tr>
                                `).join('')}
                                ${(!stats.holdings || stats.holdings.length === 0) ? '<tr><td colspan="6">No holdings yet.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Portfolio render error:', error);
            view.innerHTML = `<div class="error-state">Error loading portfolio: ${error.message}</div>`;
        }
    },

    fallbackPortfolioStats(id) {
        return {
            totalExposure: 250000000,
            weightedYield: 8.2,
            utilization: 45,
            roi: 10.5,
            holdings: []
        };
    },

    renderEarnings(view) {
        const wealth = window.SimulationEngine?.getWealth(this.currentAgentId) || { totalEarnings: 0 };
        view.innerHTML = `
            <div class="earnings-page">
                <h2 class="page-title">Earnings History</h2>
                <div class="wealth-cards">
                    <div class="wealth-card success">
                        <div class="wealth-label">Total Earnings</div>
                        <div class="wealth-value">$${((wealth.totalEarnings || 0) / 1000000).toFixed(2)}M</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderMyDeals(view) {
        const deals = (window.SyndiData?.syndications || []).filter(s => s.originatorId === this.currentAgentId);
        view.innerHTML = `
            <div class="my-deals-page">
                <h2 class="page-title">My Syndications</h2>
                <button class="btn-primary" onclick="RoleRouter.navigateTo('create-syndication')">+ Create New</button>
                <div class="deals-list">
                    ${deals.map(d => `
                        <div class="deal-row">
                            <span>${d.id}</span>
                            <span>${d.borrower}</span>
                            <span>$${d.amount}M</span>
                            <span class="status-badge ${d.status}">${d.status}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderPaymentsReceived(view) {
        view.innerHTML = '<div class="payments-received-page"><h2 class="page-title">Payments Received</h2><p>Feature coming soon.</p></div>';
    },

    renderTransactions(view) {
        const transactions = window.SimulationEngine?.transactions || [];
        view.innerHTML = `
            <div class="transactions-page">
                <h2 class="page-title">Transaction Log</h2>
                <table class="transactions-table">
                    <thead>
                        <tr><th>Time</th><th>Type</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                        ${transactions.slice(-20).reverse().map(tx => `
                            <tr>
                                <td>${new Date(tx.timestamp).toLocaleTimeString()}</td>
                                <td>${tx.type}</td>
                                <td>$${(tx.amount / 1000000).toFixed(2)}M</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderSettings(view) {
        view.innerHTML = '<div class="settings-page"><h2 class="page-title">Settings</h2><p>Agent profile settings.</p></div>';
    },

    getAgentName(id) {
        return this.agentNames[id] || id;
    }
};

const routerStyles = document.createElement('style');
routerStyles.textContent = `
    .view { display: none; padding: 20px; }
    .view.active { display: block; }
    .nav-tab.active { font-weight: bold; border-bottom: 2px solid var(--primary); }
    .wealth-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .wealth-card { background: var(--bg-card); padding: 20px; border-radius: 8px; border: 1px solid var(--border); }
    .wealth-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; }
    .wealth-value { font-size: 24px; font-weight: bold; margin-top: 5px; }
    .deals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .deal-card { background: var(--bg-card); border: 1px solid var(--border); padding: 20px; border-radius: 8px; }
    .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .status-badge.open { background: rgba(16, 185, 129, 0.1); color: #10B981; }
    .portfolio-table { width: 100%; border-collapse: collapse; }
    .portfolio-table th, .portfolio-table td { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); }
    .rating-badge { background: #3B82F6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
`;
document.head.appendChild(routerStyles);

window.RoleRouter = RoleRouter;
