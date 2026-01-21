/**
 * SyndiMatch - Main Application 
 * Orchestrates initialization, state, and UI updates
 */

const App = {
    initialized: false,
    currentView: 'overview',
    currentSyndId: null,
    currentSubPage: null,

    /**
     * Main Entry Point
     */
    async init() {
        if (this.initialized) return;
        console.log('🚀 Initializing SyndiMatch Platform...');

        // Initialize AppState first
        if (window.AppState && typeof AppState.init === 'function') {
            AppState.init();
        }

        try {
            // 1. Initialize State & Router
            Router.init();

            // 2. Subscribe to State Changes
            this.setupSubscribers();

            // 3. Connect to Backend services
            await this.initializeBackend();

            // 4. Initialize Components
            await this.initializeComponents();

            // 5. Setup extra UI handlers
            this.setupDemoToggle();

            // 6. Start Background Processes
            this.startBackgroundProcesses();

            // 7. Trigger initial view render (components are now ready)
            const currentView = AppState?.get('currentView') || 'landing';
            this.switchView(currentView);

            this.initialized = true;
            console.log('✅ SyndiMatch Ready');

        } catch (error) {
            console.error('❌ Initialization Failed:', error);
            this.showErrorScreen(error);
        }
    },

    /**
     * Initialize Backend Connections
     */
    async initializeBackend() {
        if (window.AppState) AppState.set('loadingMessage', 'Connecting to backend...');

        // Check API Connection
        if (window.API) {
            const apiConnected = await API.checkConnection();
            if (window.AppState) AppState.set('connected', apiConnected);
        }

        // Load Initial Data
        if (window.SyndiData) {
            await window.SyndiData.init();
        }
    },

    /**
     * Initialize UI Components
     */
    async initializeComponents() {
        if (window.AppState) AppState.set('loadingMessage', 'Loading components...');

        // Initialize all standard components
        const components = [
            { name: 'Metrics', el: window.MetricsComponent },
            { name: 'Pipeline', el: window.PipelineComponent },
            { name: 'SyndicationDetail', el: window.SyndicationDetailComponent },
            { name: 'Payments', el: window.PaymentsComponent },
            { name: 'Agents', el: window.AgentsComponent },
            { name: 'Analytics', el: window.AnalyticsComponent },
            { name: 'Alerts', el: window.AlertsComponent },
            { name: 'RoleRouter', el: window.RoleRouter },
            { name: 'AutoBidder', el: window.AutoBidder },
            { name: 'OriginatorDashboard', el: window.OriginatorDashboard },
            { name: 'ParticipantDashboard', el: window.ParticipantDashboard },
            { name: 'LandingPage', el: window.LandingPage }
        ];

        for (const component of components) {
            try {
                if (component.el && typeof component.el.init === 'function') {
                    await component.el.init();
                    console.log(`✓ ${component.name} initialized`);
                }
            } catch (e) {
                console.warn(`⚠️ Failed to initialize ${component.name}:`, e);
            }
        }
    },

    /**
     * Setup State Subscribers
     */
    setupSubscribers() {
        if (!window.AppState) return;

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

        // Handle active syndication changes
        AppState.subscribe('activeSyndicationId', (id) => {
            this.currentSyndId = id;
        });
    },

    /**
     * Setup Demo Toggle
     */
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

    /**
     * Start Background Processes
     */
    startBackgroundProcesses() {
        // Simulation Engine
        if (window.SimulationEngine) {
            window.SimulationEngine.start();
        }

        // Auto Refresh loop for mock updates
        setInterval(() => this.simulateUpdate(), 5000);
    },

    /**
     * Handle view switching logic
     */
    switchView(viewName) {
        if (!viewName) return;
        this.currentView = viewName;

        console.log(`🎬 Switching to view: ${viewName}`);

        // Update Navigation DOM
        this.updateNavigationUI(viewName);

        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show active view
        const viewEl = document.getElementById(`view-${viewName}`);
        if (viewEl) {
            viewEl.classList.add('active');
        } else if (viewName === 'syndication-detail') {
            this.renderSyndicationDetailView();
        }

        // Dispatch local event
        window.dispatchEvent(new CustomEvent('viewChanged', { detail: { view: viewName } }));
    },

    /**
     * Update navigation tab classes
     */
    updateNavigationUI(viewName) {
        // Special case for sub-page navigation in syndication detail
        if (this.currentSyndId) {
            const params = AppState.get('routeParams') || {};
            this.updateNavigationForSyndication(this.currentSyndId, params.subPage || 'orchestration');
            return;
        }

        // Normal overview/analytics navigation
        this.renderDefaultNavigation(viewName);
    },

    renderDefaultNavigation(activeView) {
        const navContainer = document.querySelector('.nav-tabs');
        if (!navContainer) return;

        // Clear and rebuild to ensure consistency (especially when coming back from detail)
        navContainer.innerHTML = `
            <button class="nav-tab ${activeView === 'overview' ? 'active' : ''}" data-view="overview">Overview</button>
            <button class="nav-tab ${activeView === 'analytics' ? 'active' : ''}" data-view="analytics">Analytics</button>
            <button class="nav-tab ${activeView === 'originate' ? 'active' : ''} originator-only" data-view="originate">Originate</button>
        `;

        // Re-attach listeners
        navContainer.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                Router.navigate('/' + tab.dataset.view);
            });
        });
    },

    updateNavigationForSyndication(syndId, activeSubPage) {
        const navContainer = document.querySelector('.nav-tabs');
        if (!navContainer || !syndId) return;

        const subPages = ['orchestration', 'payments', 'transactions'];

        navContainer.innerHTML = `
            <button class="nav-tab nav-back" id="btn-nav-back">← Back</button>
            <span class="nav-divider">|</span>
            <span class="nav-synd-id">${syndId}</span>
            <span class="nav-divider">|</span>
            ${subPages.map(page => `
                <button class="nav-tab ${page === activeSubPage ? 'active' : ''}" data-page="${page}">
                    ${page.charAt(0).toUpperCase() + page.slice(1)}
                </button>
            `).join('')}
        `;

        this.injectSyndicationNavStyles();

        // Attach listeners
        const backBtn = document.getElementById('btn-nav-back');
        if (backBtn) backBtn.addEventListener('click', () => Router.navigate('/overview'));

        navContainer.querySelectorAll('.nav-tab[data-page]').forEach(tab => {
            tab.addEventListener('click', () => {
                Router.navigate(`/${syndId}/${tab.dataset.page}`);
            });
        });
    },

    injectSyndicationNavStyles() {
        if (document.getElementById('synd-nav-styles')) return;
        const styles = document.createElement('style');
        styles.id = 'synd-nav-styles';
        styles.textContent = `
            .nav-back { color: var(--text-muted) !important; font-weight: 500; }
            .nav-back:hover { color: var(--primary) !important; }
            .nav-divider { color: var(--border-color); margin: 0 0.5rem; font-weight: 300; }
            .nav-synd-id { font-weight: 700; color: var(--primary); font-size: 0.875rem; 
                          padding: 0.25rem 0.75rem; background: rgba(37, 99, 235, 0.1); border-radius: 6px; }
        `;
        document.head.appendChild(styles);
    },

    renderSyndicationDetailView() {
        const params = AppState.get('routeParams') || {};
        const syndId = params.id;
        const subPage = params.subPage || 'orchestration';

        // Check if detail view exists, if not created in index.html (it should be though)
        let detailView = document.getElementById('view-syndication-detail');
        if (!detailView) {
            detailView = document.createElement('div');
            detailView.id = 'view-syndication-detail';
            detailView.className = 'view active';
            document.querySelector('.main-content').appendChild(detailView);
        } else {
            detailView.classList.add('active');
        }

        // Delegate rendering to component
        if (window.SyndicationDetailComponent) {
            SyndicationDetailComponent.render(syndId, subPage);
        }
    },

    simulateUpdate() {
        if (!window.SyndiData || !SyndiData.syndications) return;

        // Randomly update a syndication's subscription rate
        const synd = SyndiData.syndications[Math.floor(Math.random() * SyndiData.syndications.length)];
        if (synd && (synd.status === 'negotiating' || synd.status === 'open')) {
            const change = Math.floor(Math.random() * 3) + 1;
            synd.subscription = Math.min(100, (synd.subscription || 0) + change);

            // Re-render pipeline if on overview
            if (this.currentView === 'overview') {
                if (window.PipelineComponent) PipelineComponent.render();
            }
        }
    },

    showErrorScreen(error) {
        document.body.innerHTML = `
            <div class="error-screen" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#fff;color:#111;font-family:var(--font-ui);">
                <div style="font-size:48px;margin-bottom:20px;">⚠️</div>
                <h1 style="margin:0 0 10px 0;">System Initialization Failed</h1>
                <p style="color:#666;max-width:500px;text-align:center;">${error.message}</p>
                <button onclick="window.location.reload()" style="margin-top:20px;padding:12px 24px;background:var(--primary);border:none;border-radius:6px;color:white;cursor:pointer;font-weight:600;">Retry</button>
            </div>
        `;
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 24px; right: 24px;
            padding: 12px 20px; background: white; color: #111;
            border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            border-left: 4px solid var(--primary);
            z-index: 10000; font-family: var(--font-ui); font-size: 0.875rem;
            animation: slideIn 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export Global
window.App = App;
