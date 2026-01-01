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

    init() {
        this.render();

        // Subscribe to simulation updates
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', () => this.render());
        }

        // Listen for global interaction events
        window.addEventListener('newSyndication', () => this.render());
        window.addEventListener('syndicationUpdate', () => this.render());
    },

    render() {
        const container = document.getElementById('pipeline-columns');
        if (!container) return;

        // Skip re-render if syndication detail modal is open to prevent it from closing
        const modal = document.getElementById('modal-overlay');
        if (modal && modal.classList.contains('open')) {
            return; // Don't re-render pipeline while user is viewing details
        }

        // Get current simulation date
        const now = window.SimulationEngine ? SimulationEngine.state.currentDate : new Date();
        const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // Filter syndications - hide completed ones older than 1 month
        const visibleSyndications = SyndiData.syndications.filter(s => {
            if (s.status !== 'completed') return true;
            // Check completion date
            const completedDate = new Date(s.updated_at || s.created_at);
            return completedDate > oneMonthAgo;
        });

        container.innerHTML = SyndiData.statuses.map(status => {
            const items = visibleSyndications.filter(s => s.status === status);
            const config = this.statusConfig[status];

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

        // Add click handlers
        container.querySelectorAll('.synd-card').forEach(card => {
            card.addEventListener('click', () => {
                const syndId = card.dataset.syndId;
                SyndicationDetailComponent.open(syndId);
            });
        });
    },

    renderCard(item) {
        const statusColor = Utils.getStatusColor(item.subscription);
        const progressClass = Utils.getProgressClass(item.subscription);

        return `
            <div class="synd-card" data-synd-id="${item.id}">
                <div class="synd-card-header">
                    <span class="synd-card-id">${item.id}</span>
                    <span class="synd-card-status ${statusColor}"></span>
                </div>
                <div class="synd-card-borrower">${item.borrower}</div>
                <div class="synd-card-amount">${Utils.formatCurrency(item.amount * 1000000)} • ${item.originator}</div>
                <div class="synd-card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${item.subscription}%"></div>
                    </div>
                </div>
                <div class="synd-card-footer">
                    <span class="synd-card-spread">📈 ${item.spread} bps</span>
                    <span class="synd-card-time">⏱ ${item.timeRemaining}</span>
                </div>
            </div>
        `;
    }
};
