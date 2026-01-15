// ========================================
// Pipeline Component
// ========================================

const PipelineComponent = {
    statusConfig: {
        open: { title: 'Open', class: 'status-open' },
        negotiating: { title: 'Negotiating', class: 'status-negotiating' },
        closing: { title: 'Closing', class: 'status-closing' },
        settlement: { title: 'Settlement', class: 'status-settlement' },
        funding: { title: 'Funding', class: 'status-funding' },
        completed: { title: 'Completed', class: 'status-completed' }
    },

    // Track recently updated cards for pulse animation
    recentlyUpdated: new Map(),

    init() {
        this.render();
        this.injectPulseStyles();
        this.setupEventDelegation();

        // Subscribe to simulation updates
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', () => this.render());
        }

        // Subscribe to SyndiData events for real-time updates
        const handleUpdate = (syndId) => {
            if (this.recentlyUpdated.has(syndId)) {
                clearTimeout(this.recentlyUpdated.get(syndId));
            }

            this.recentlyUpdated.set(syndId, setTimeout(() => {
                this.recentlyUpdated.delete(syndId);
                this.render();
            }, 3000));

            this.render();
        };

        if (window.SyndiData) {
            SyndiData.on('syndicationAdded', (synd) => handleUpdate(synd.id));
            SyndiData.on('syndicationUpdated', ({ syndId }) => handleUpdate(syndId));
        }

        // Listen for global interaction events
        window.addEventListener('newSyndication', () => this.render());
        window.addEventListener('syndicationUpdate', () => this.render());
    },

    setupEventDelegation() {
        const container = document.getElementById('pipeline-columns');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const card = e.target.closest('.synd-card');
            if (card) {
                const syndId = card.dataset.syndId;
                if (window.Router) {
                    Router.navigate(`/${syndId}/orchestration`);
                }
            }
        });
    },

    injectPulseStyles() {
        if (document.getElementById('pipeline-pulse-styles')) return;
        const style = document.createElement('style');
        style.id = 'pipeline-pulse-styles';
        style.textContent = `
            @keyframes cardPulse {
                0%, 100% { box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1); }
                50% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4); }
            }
            .synd-card.updated {
                animation: cardPulse 1s ease-in-out 3;
                border-color: var(--primary) !important;
            }
            .synd-card:focus {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    },

    render() {
        const container = document.getElementById('pipeline-columns');
        if (!container || !window.SyndiData) return;

        // Skip re-render if syndication detail modal is open
        const modal = document.getElementById('modal-overlay');
        if (modal && modal.classList.contains('open')) {
            return;
        }

        // Get current simulation date for filtering
        const now = window.SimulationEngine ? (SimulationEngine.state?.currentDate || new Date()) : new Date();
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Use allSyndications getter to pick real data or fallback to mock
        const sourceSyndications = SyndiData.allSyndications || SyndiData.syndications || [];

        // Filter syndications - hide completed ones older than 1 month
        const visibleSyndications = sourceSyndications.filter(s => {
            if (s.status !== 'completed') return true;
            const completedDate = new Date(s.updated_at || s.created_at || now);
            return completedDate > oneMonthAgo;
        });

        container.innerHTML = (SyndiData.statuses || []).map(status => {
            const items = visibleSyndications.filter(s => s.status === status);
            const config = this.statusConfig[status] || { title: status.toUpperCase(), class: '' };

            return `
                <div class="pipeline-column">
                    <div class="column-header ${config.class}">
                        <span class="column-title">${config.title}</span>
                        <span class="column-count">${items.length}</span>
                    </div>
                    <div class="column-cards">
                        ${items.map(item => this.renderCard(item)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCard(item) {
        const sub = item.subscription || 0;
        const statusColor = (window.Utils && Utils.getStatusColor) ? Utils.getStatusColor(sub) : 'blue';
        const progressClass = (window.Utils && Utils.getProgressClass) ? Utils.getProgressClass(sub) : 'medium';
        const isUpdated = this.recentlyUpdated.has(item.id);

        return `
            <div class="synd-card ${isUpdated ? 'updated' : ''}" 
                 data-synd-id="${item.id}" 
                 tabindex="0" 
                 role="button" 
                 aria-label="View syndication ${item.id}">
                <div class="synd-card-header">
                    <span class="synd-card-id">${item.id}</span>
                    <span class="synd-card-status ${statusColor}"></span>
                </div>
                <div class="synd-card-borrower">${item.borrower || 'Unknown Borrower'}</div>
                <div class="synd-card-amount">
                    ${(window.Utils && Utils.formatCurrency) ? Utils.formatCurrency((item.amount || 0) * 1000000) : item.amount} • ${item.originator || 'TBD'}
                </div>
                <div class="synd-card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${sub}%"></div>
                    </div>
                </div>
                <div class="synd-card-footer">
                    <span class="synd-card-spread">📈 ${item.spread || 0} bps</span>
                    <span class="synd-card-time">⏱ ${item.timeRemaining || '—'}</span>
                </div>
            </div>
        `;
    }
};

window.PipelineComponent = PipelineComponent;
