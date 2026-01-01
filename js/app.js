// ========================================
// SyndiMatch - Main Application
// ========================================

const App = {
    currentView: 'overview',

    init() {
        console.log('🚀 SyndiMatch Dashboard initializing...');

        // Initialize all components
        MetricsComponent.init();
        PipelineComponent.init();
        SyndicationDetailComponent.init();
        PaymentsComponent.init();
        AgentsComponent.init();
        AnalyticsComponent.init();
        AlertsComponent.init();

        // Setup navigation
        this.setupNavigation();

        // Setup WebSocket simulation
        this.startMockWebSocket();

        console.log('✅ SyndiMatch Dashboard ready');
    },

    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.dataset.view;
                this.switchView(view);

                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    },

    switchView(view) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        // Show target view
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = view;
        }
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
            if (this.currentView === 'overview') {
                PipelineComponent.render();
            }
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
