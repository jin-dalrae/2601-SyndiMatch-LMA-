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
    recentlyUpdated: new Map(), // Use Map to store timeout IDs

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
            // Clear existing timeout if it exists
            if (this.recentlyUpdated.has(syndId)) {
                clearTimeout(this.recentlyUpdated.get(syndId));
            }

            this.recentlyUpdated.set(syndId, setTimeout(() => {
                this.recentlyUpdated.delete(syndId);
                this.render(); // Re-render to remove "updated" class
            }, 3000));

            this.render();
        };

        SyndiData.on('syndicationAdded', (synd) => handleUpdate(synd.id));
        SyndiData.on('syndicationUpdated', ({ syndId }) => handleUpdate(syndId));

        // Listen for global interaction events
        window.addEventListener('newSyndication', () => this.render());
        window.addEventListener('syndicationUpdate', () => this.render());
    },

    setupEventDelegation() {
        const container = document.getElementById('pipeline-columns');
        if (!container) return;

        // Use event delegation to prevent listener accumulation and memory leaks
        container.addEventListener('click', (e) => {
            const card = e.target.closest('.synd-card');
            if (card) {
                const syndId = card.dataset.syndId;
                window.location.hash = `${syndId}/orchestration`;
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
            .synd-card.updated::before {
                content: '🔄';
                position: absolute;
                top: -8px;
                right: -8px;
                font-size: 1rem;
                animation: cardPulse 1s ease-in-out infinite;
                z-index: 10;
            }
            /* Keyboard focus states */
            .synd-card:focus {
                outline: 2px solid var(--primary);
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    },

    render() {
        const container = document.getElementById('pipeline-columns');
        if (!container) return;

        // Map statuses with fallback safety
        container.innerHTML = (SyndiData.statuses || []).map(status => {
            const items = (SyndiData.syndications || []).filter(s => s.status === status);
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
        // Safe utility calls with fallbacks
        const sub = item.subscription || 0;
        const statusColor = Utils.getStatusColor(sub);
        const progressClass = Utils.getProgressClass(sub);
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
                    ${Utils.formatCurrency((item.amount || 0) * 1000000)} • ${item.originator || 'TBD'}
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
