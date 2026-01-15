// ========================================
// Metrics Component - With Navigation & Calculation
// ========================================

const MetricsComponent = {
    // Route mapping for each metric card
    routes: {
        'metric-active': { view: 'overview', filter: 'active', label: 'Active Syndications' },
        'metric-value': { view: 'overview', filter: 'all', label: 'Total Value' },
        'metric-closed': { view: 'overview', filter: 'completed', label: 'Closed Today' },
        'metric-success': { view: 'analytics', filter: 'performance', label: 'Success Rate' },
        'metric-participants': { view: 'agents', filter: 'participants', label: 'Participants' },
        'metric-payments': { view: 'payments', filter: 'recent', label: 'Payments' }
    },

    init() {
        this.setupClickHandlers();
        this.startLiveUpdates();
    },

    setupClickHandlers() {
        const cards = document.querySelectorAll('.metric-card');
        cards.forEach((card) => {
            card.style.cursor = 'pointer';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            const metricId = card.dataset.metricId;

            if (metricId && this.routes[metricId]) {
                const route = this.routes[metricId];
                card.addEventListener('click', () => this.navigateToRoute(route));
                card.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.navigateToRoute(route);
                    }
                });
                card.title = `Click to view ${route.label}`;
            }
        });
    },

    navigateToRoute(route) {
        if (window.Router) {
            Router.navigate('/' + route.view);
            // Apply filter if needed (decoupled approach)
            window.dispatchEvent(new CustomEvent('metricFilterChange', {
                detail: { view: route.view, filter: route.filter }
            }));
            this.showNavigationFeedback(route.label);
        }
    },

    showNavigationFeedback(label) {
        let toast = document.querySelector('.metric-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'metric-toast';
            document.body.appendChild(toast);
        }

        toast.textContent = `Viewing: ${label}`;
        toast.classList.remove('fade-out');

        if (this._toastTimeout) clearTimeout(this._toastTimeout);

        this._toastTimeout = setTimeout(() => {
            toast.classList.add('fade-out');
            this._toastTimeout = setTimeout(() => {
                if (toast.parentNode) toast.remove();
                this._toastTimeout = null;
            }, 300);
        }, 1500);
    },

    updateMetrics(data) {
        const metrics = {
            'metric-active': data.active || '8',
            'metric-value': data.value || '$2.4B',
            'metric-closed': data.closed || '3',
            'metric-success': data.success || '94.2%',
            'metric-participants': data.participants || '47',
            'metric-payments': data.payments || '$892M'
        };

        Object.entries(metrics).forEach(([metricId, value]) => {
            const card = document.querySelector(`.metric-card[data-metric-id="${metricId}"]`);
            const el = card?.querySelector('.metric-value');
            if (el && el.textContent !== value) {
                el.textContent = value;
                el.classList.add('updated');
                setTimeout(() => el.classList.remove('updated'), 500);
            }
        });
    },

    startLiveUpdates() {
        this.refreshActiveMetrics();

        // Connect to simulation engine if available
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', () => this.refreshActiveMetrics());
        }

        // Periodic refresh as fallback
        setInterval(() => this.refreshActiveMetrics(), 5000);
    },

    refreshActiveMetrics() {
        if (typeof SyndiData === 'undefined' || !SyndiData.syndications) return;

        const activeDeals = SyndiData.syndications.filter(s =>
            s.status !== 'completed' && s.status !== 'failed'
        );
        const activeCount = activeDeals.length;

        const totalValue = activeDeals.reduce((sum, s) => sum + (s.amount || 0) * 1000000, 0);

        const today = window.SimulationEngine ? (SimulationEngine.state?.currentDate || new Date()) : new Date();
        const closedToday = SyndiData.syndications.filter(s => {
            if (s.status !== 'completed') return false;
            const date = new Date(s.updated_at || s.created_at || today);
            return date.toDateString() === today.toDateString();
        }).length;

        const completedCount = SyndiData.syndications.filter(s => s.status === 'completed').length;
        const failedCount = SyndiData.syndications.filter(s => s.status === 'failed').length;
        const totalOutcome = completedCount + failedCount;
        const successRate = totalOutcome > 0 ? ((completedCount / totalOutcome) * 100).toFixed(1) : '100.0';

        const participantSet = new Set();
        SyndiData.syndications.forEach(s => {
            if (s.bids) s.bids.forEach(b => participantSet.add(b.participant));
        });
        const activeParticipants = participantSet.size || 47; // Fallback to realistic mock

        const recentVolume = totalValue * 0.12;

        this.updateMetrics({
            active: activeCount.toString(),
            value: this.formatCurrency(totalValue),
            closed: closedToday.toString(),
            success: `${successRate}%`,
            participants: activeParticipants.toString(),
            payments: this.formatCurrency(recentVolume)
        });
    },

    formatCurrency(value) {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
        return `$${(value || 0).toLocaleString()}`;
    }
};

window.MetricsComponent = MetricsComponent;

// Inject styles
const metricStyles = document.createElement('style');
metricStyles.textContent = `
    .metric-card:hover { transform: translateY(-2px); border-color: var(--primary) !important; }
    .metric-toast { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 0.75rem 1.5rem; border-radius: 50px; font-size: 0.875rem; font-weight: 500; z-index: 1000; animation: toastIn 0.3s ease; }
    .metric-toast.fade-out { opacity: 0; transition: opacity 0.3s ease; }
    @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    .metric-value.updated { animation: valueUpdate 0.5s ease; }
    @keyframes valueUpdate { 0%, 100% { color: var(--text-primary); } 50% { color: #10B981; } }
`;
document.head.appendChild(metricStyles);
