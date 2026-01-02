// ========================================
// Metrics Component - With Navigation
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
            // Add clickable styling
            card.style.cursor = 'pointer';
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            const metricId = card.dataset.metricId;

            if (metricId && this.routes[metricId]) {
                const route = this.routes[metricId];

                // Click handler
                card.addEventListener('click', () => this.navigateToRoute(route));

                // Keyboard accessibility
                card.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.navigateToRoute(route);
                    }
                });

                // Add tooltip
                card.title = `Click to view ${route.label}`;
            }
        });
    },

    navigateToRoute(route) {
        // Navigate to the target view
        const viewTab = document.querySelector(`[data-view="${route.view}"]`);
        if (viewTab) {
            // Trigger the tab click
            viewTab.click();

            // Apply filter if needed
            this.applyFilter(route.view, route.filter);

            // Visual feedback
            this.showNavigationFeedback(route.label);
        }
    },

    applyFilter(view, filter) {
        // Store current filter for components to use
        window.currentMetricFilter = { view, filter };

        // Dispatch custom event for filter application
        window.dispatchEvent(new CustomEvent('metricFilterChange', {
            detail: { view, filter }
        }));

        // Apply visual filter based on view
        if (view === 'overview' && filter !== 'all') {
            this.highlightPipelineColumn(filter);
        }
    },

    highlightPipelineColumn(status) {
        // Highlight the relevant pipeline column
        const columns = document.querySelectorAll('.pipeline-column');
        columns.forEach(col => {
            col.classList.remove('highlighted');
        });

        // Find column matching the filter
        const targetColumn = document.querySelector(`.column-header.status-${status}`)?.parentElement;
        if (targetColumn) {
            targetColumn.classList.add('highlighted');
            targetColumn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    showNavigationFeedback(label) {
        // Brief toast-like feedback (reuse existing toast if present)
        let toast = document.querySelector('.metric-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'metric-toast';
            document.body.appendChild(toast);
        }

        toast.textContent = `Viewing: ${label}`;
        toast.classList.remove('fade-out');

        // Reset timer if already running
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
        // Simulate real-time metric changes
        if (this._updateInterval) clearInterval(this._updateInterval);

        this._updateInterval = setInterval(() => {
            const variations = {
                payments: ['$886M', '$892M', '$895M', '$901M', '$912M'],
                active: ['7', '8', '9', '8'],
                success: ['94.1%', '94.2%', '94.3%', '94.2%']
            };

            const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

            this.updateMetrics({
                payments: getRandom(variations.payments),
                active: getRandom(variations.active),
                success: getRandom(variations.success)
            });
        }, 8000);
    },

    destroy() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
        if (this._toastTimeout) {
            clearTimeout(this._toastTimeout);
            this._toastTimeout = null;
        }
    }
};

// Add toast and highlight styles
const metricStyles = document.createElement('style');
metricStyles.textContent = `
    .metric-card:hover {
        transform: translateY(-2px);
        border-color: var(--primary-light) !important;
    }
    .metric-card:active {
        transform: translateY(0);
    }
    .metric-toast {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-full);
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 1000;
        animation: toastIn 0.3s ease;
    }
    .metric-toast.fade-out {
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .pipeline-column.highlighted {
        background: rgba(59, 130, 246, 0.1);
        border: 2px solid var(--primary-light);
        animation: highlightPulse 1s ease;
    }
    @keyframes highlightPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); }
        50% { box-shadow: 0 0 20px 5px rgba(59, 130, 246, 0.2); }
    }
    .metric-value.updated {
        animation: valueUpdate 0.5s ease;
    }
    @keyframes valueUpdate {
        0%, 100% { color: var(--text-primary); }
        50% { color: var(--success); }
    }
`;
document.head.appendChild(metricStyles);
