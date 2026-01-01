// ========================================
// App.js - Main Application Entry Point
// Orchestrates initialization, state, and routing
// ========================================

const App = {
    // Initialization flag
    initialized: false,

    /**
     * Main Entry Point
     */
    async init() {
        if (this.initialized) return;

        console.log('🚀 Initializing SyndiMatch Platform...');

        // Show loading state
        this.showLoader();

        try {
            // 1. Initialize State & Router
            Router.init();

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
                }
            });
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

        // Auto Bidder
        if (window.AutoBidder) {
            // AutoBidder.start(); // If it has a start method
        }
    },

    // ========================================
    // UI Helpers
    // ========================================

    showLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) loader.style.display = 'flex';
    },

    hideLoader() {
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
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
