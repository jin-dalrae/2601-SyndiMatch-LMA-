// ========================================
// Payments Component - Enhanced UI
// ========================================

const PaymentsComponent = {
    state: {
        balances: null
    },

    init() {
        this.injectStyles();
        this.fetchBackendData();
        this.render();
    },

    async fetchBackendData() {
        // Try getting live x402 data for the active syndication
        const syndId = 'SYND-2025-001'; // In a real app, this would be dynamic
        const escrow = await API.getEscrowDetails(syndId);
        const originatorBal = await API.getX402Balance('originator_01');

        if (escrow || originatorBal) {
            this.state.balances = {
                escrow: escrow?.balance ? escrow.balance / 1000000 : 256.6, // Convert USDC base units if needed
                originator: originatorBal?.balance ? originatorBal.balance / 1000000 : 250,
                borrower: originatorBal?.balance ? (originatorBal.balance / 1000000) * 0.95 : 237.5
            };
            this.render();
        }
    },

    render() {
        this.renderPipelineVisual();
        this.renderProgressBars();
        this.renderPaymentTable();
        this.renderTransactionLog();
    },

    injectStyles() {
        if (document.getElementById('payments-enhanced-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'payments-enhanced-styles';
        styles.textContent = `
            /* Enhanced Payment Pipeline */
            .payment-pipeline-container {
                background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-muted) 100%);
                border-radius: var(--radius-lg);
                padding: 2rem;
                margin-bottom: 1.5rem;
                border: 1px solid var(--border-color);
            }
            
            .pipeline-flow {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                position: relative;
            }
            
            .pipeline-stage {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                position: relative;
                z-index: 1;
            }
            
            .pipeline-stage-icon {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2rem;
                margin-bottom: 0.75rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .pipeline-stage:hover .pipeline-stage-icon {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            }
            
            .stage-participants .pipeline-stage-icon {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            }
            
            .stage-escrow .pipeline-stage-icon {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            }
            
            .stage-originator .pipeline-stage-icon {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            }
            
            .stage-borrower .pipeline-stage-icon {
                background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
            }
            
            .pipeline-stage-title {
                font-weight: 600;
                font-size: 0.875rem;
                color: var(--text-primary);
                margin-bottom: 0.25rem;
            }
            
            .pipeline-stage-amount {
                font-size: 1.125rem;
                font-weight: 700;
                color: var(--primary);
            }
            
            .pipeline-stage-sub {
                font-size: 0.75rem;
                color: var(--text-muted);
            }
            
            /* Animated Connectors */
            .pipeline-connector {
                flex: 0 0 60px;
                height: 4px;
                background: var(--border-color);
                position: relative;
                border-radius: 2px;
                overflow: hidden;
            }
            
            .connector-flow {
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, var(--primary), transparent);
                animation: flowPulse 2s ease-in-out infinite;
            }
            
            @keyframes flowPulse {
                0% { left: -100%; }
                50% { left: 100%; }
                100% { left: 100%; }
            }
            
            .connector-arrow {
                position: absolute;
                right: -8px;
                top: 50%;
                transform: translateY(-50%);
                font-size: 0.75rem;
                color: var(--text-muted);
            }
            
            /* Payment Stats Grid */
            .payment-stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            
            .payment-stat-card {
                background: var(--bg-card);
                border-radius: var(--radius-md);
                padding: 1.25rem;
                border: 1px solid var(--border-color);
                text-align: center;
            }
            
            .payment-stat-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 0.5rem;
            }
            
            .payment-stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary);
            }
            
            .payment-stat-trend {
                font-size: 0.75rem;
                margin-top: 0.25rem;
            }
            
            .trend-up { color: #10b981; }
            .trend-down { color: #ef4444; }
            
            /* Enhanced Progress Bars */
            .progress-section {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            
            .progress-card {
                background: var(--bg-card);
                border-radius: var(--radius-md);
                padding: 1rem;
                border: 1px solid var(--border-color);
            }
            
            .progress-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.75rem;
            }
            
            .progress-title {
                font-weight: 600;
                font-size: 0.875rem;
            }
            
            .progress-percent {
                font-size: 0.875rem;
                font-weight: 700;
                color: var(--primary);
            }
            
            .progress-bar-enhanced {
                height: 8px;
                background: var(--bg-muted);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .progress-fill-enhanced {
                height: 100%;
                border-radius: 4px;
                transition: width 0.5s ease;
            }
            
            .fill-green { background: linear-gradient(90deg, #10b981, #34d399); }
            .fill-orange { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .fill-blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
            
            .progress-amounts {
                display: flex;
                justify-content: space-between;
                margin-top: 0.5rem;
                font-size: 0.75rem;
                color: var(--text-muted);
            }
            
            /* Transaction Feed */
            .tx-feed {
                background: var(--bg-card);
                border-radius: var(--radius-md);
                border: 1px solid var(--border-color);
                overflow: hidden;
            }
            
            .tx-feed-header {
                padding: 1rem;
                background: var(--bg-muted);
                border-bottom: 1px solid var(--border-color);
                font-weight: 600;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .tx-feed-live {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.75rem;
                color: #10b981;
            }
            
            .live-dot {
                width: 8px;
                height: 8px;
                background: #10b981;
                border-radius: 50%;
                animation: livePulse 1.5s ease-in-out infinite;
            }
            
            @keyframes livePulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            
            .tx-feed-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .tx-feed-item {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                padding: 1rem;
                border-bottom: 1px solid var(--border-color);
                transition: background 0.2s ease;
            }
            
            .tx-feed-item:hover {
                background: var(--bg-muted);
            }
            
            .tx-feed-item:last-child {
                border-bottom: none;
            }
            
            .tx-status-icon {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.875rem;
                flex-shrink: 0;
            }
            
            .tx-status-confirmed {
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
            }
            
            .tx-status-pending {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
            }
            
            .tx-status-failed {
                background: rgba(239, 68, 68, 0.1);
                color: #ef4444;
            }
            
            .tx-feed-content {
                flex: 1;
            }
            
            .tx-feed-main {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.25rem;
            }
            
            .tx-feed-parties {
                font-weight: 500;
                font-size: 0.875rem;
            }
            
            .tx-feed-amount {
                font-weight: 700;
                color: var(--success);
            }
            
            .tx-feed-meta {
                font-size: 0.75rem;
                color: var(--text-muted);
                display: flex;
                gap: 1rem;
            }
        `;
        document.head.appendChild(styles);
    },

    renderPipelineVisual() {
        const container = document.getElementById('payment-pipeline-visual');
        if (!container) return;

        // Get live data
        const activeParticipants = Object.keys(window.AutoBidder?.participants || {}).length;

        // Use real backend data if available, otherwise mock
        const escrowHeld = this.state.balances?.escrow !== undefined
            ? this.state.balances.escrow.toFixed(1)
            : 256.6;

        const principalFunded = this.state.balances?.originator !== undefined
            ? this.state.balances.originator.toFixed(1)
            : 250;

        const borrowerReceived = this.state.balances?.borrower !== undefined
            ? this.state.balances.borrower.toFixed(1)
            : 237.5;

        container.innerHTML = `
            <div class="payment-pipeline-container">
                <div class="pipeline-flow">
                    <div class="pipeline-stage stage-participants">
                        <div class="pipeline-stage-icon">👥</div>
                        <div class="pipeline-stage-title">Participants</div>
                        <div class="pipeline-stage-amount">${activeParticipants} Active</div>
                        <div class="pipeline-stage-sub">Syndicate Members</div>
                    </div>
                    
                    <div class="pipeline-connector">
                        <div class="connector-flow"></div>
                        <span class="connector-arrow">▶</span>
                    </div>
                    
                    <div class="pipeline-stage stage-escrow">
                        <div class="pipeline-stage-icon">🔐</div>
                        <div class="pipeline-stage-title">Escrow Wallet</div>
                        <div class="pipeline-stage-amount">$${escrowHeld}M</div>
                        <div class="pipeline-stage-sub">USDC Held</div>
                    </div>
                    
                    <div class="pipeline-connector">
                        <div class="connector-flow" style="animation-delay: 0.5s"></div>
                        <span class="connector-arrow">▶</span>
                    </div>
                    
                    <div class="pipeline-stage stage-originator">
                        <div class="pipeline-stage-icon">🏛️</div>
                        <div class="pipeline-stage-title">Originator</div>
                        <div class="pipeline-stage-amount">$${principalFunded}M</div>
                        <div class="pipeline-stage-sub">Principal Funded</div>
                    </div>
                    
                    <div class="pipeline-connector">
                        <div class="connector-flow" style="animation-delay: 1s"></div>
                        <span class="connector-arrow">▶</span>
                    </div>
                    
                    <div class="pipeline-stage stage-borrower">
                        <div class="pipeline-stage-icon">🏢</div>
                        <div class="pipeline-stage-title">Borrower</div>
                        <div class="pipeline-stage-amount">$${borrowerReceived}M</div>
                        <div class="pipeline-stage-sub">Net Received</div>
                    </div>
                </div>
            </div>
            
            <div class="payment-stats-grid">
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Total Funded</div>
                    <div class="payment-stat-value">$256.6M</div>
                    <div class="payment-stat-trend trend-up">↑ 12% this month</div>
                </div>
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Pending</div>
                    <div class="payment-stat-value">$18.4M</div>
                    <div class="payment-stat-trend">2 payments awaiting</div>
                </div>
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Fees Collected</div>
                    <div class="payment-stat-value">$6.9M</div>
                    <div class="payment-stat-trend trend-up">Commitment + Arrangement</div>
                </div>
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Settlement Rate</div>
                    <div class="payment-stat-value">98.2%</div>
                    <div class="payment-stat-trend trend-up">↑ On-time payments</div>
                </div>
            </div>
        `;
    },

    renderProgressBars() {
        const container = document.getElementById('payment-progress');
        if (!container) return;

        const progress = [
            { name: 'Commitment Fees', collected: 1875000, total: 1875000, percent: 100, color: 'green' },
            { name: 'Arrangement Fees', collected: 5000000, total: 7500000, percent: 67, color: 'orange' },
            { name: 'Principal', collected: 250000000, total: 375000000, percent: 67, color: 'blue' }
        ];

        container.innerHTML = `
            <div class="progress-section">
                ${progress.map(p => `
                    <div class="progress-card">
                        <div class="progress-header">
                            <span class="progress-title">${p.name}</span>
                            <span class="progress-percent">${p.percent}%</span>
                        </div>
                        <div class="progress-bar-enhanced">
                            <div class="progress-fill-enhanced fill-${p.color}" style="width: ${p.percent}%"></div>
                        </div>
                        <div class="progress-amounts">
                            <span>${Utils.formatCurrency(p.collected)}</span>
                            <span>${Utils.formatCurrency(p.total)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderPaymentTable() {
        const container = document.getElementById('payment-table-container');
        if (!container) return;

        const payments = SyndiData.payments['SYND-2025-001'];
        if (!payments || payments.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No payment data available</p>';
            return;
        }

        container.innerHTML = `
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Participant</th>
                        <th>Commitment Fee</th>
                        <th>Arrangement Fee</th>
                        <th>Principal</th>
                        <th>Total</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => {
            const participantName = this._resolveParticipantName(p.participant);
            return `
                        <tr>
                            <td><strong>${participantName}</strong></td>
                            <td><span class="payment-status paid">✓ ${Utils.formatCurrency(p.commitment?.amount || 0)}</span></td>
                            <td><span class="payment-status ${p.arrangement?.status || 'pending'}">${this.getStatusIcon(p.arrangement?.status)} ${Utils.formatCurrency(p.arrangement?.amount || 0)}</span></td>
                            <td><span class="payment-status ${p.principal?.status || 'pending'}">${this.getStatusIcon(p.principal?.status)} ${Utils.formatCurrency(p.principal?.amount || 0)}</span></td>
                            <td><strong>${Utils.formatCurrency(p.total || 0)}</strong></td>
                            <td><span class="status-badge ${(p.overallStatus || 'pending').toLowerCase()}">${p.overallStatus || 'PENDING'}</span></td>
                        </tr>
                    `;
        }).join('')}
                </tbody>
            </table>
        `;
    },

    getStatusIcon(status) {
        const icons = { paid: '✓', pending: '⏳', overdue: '⚠️' };
        return icons[status] || '—';
    },

    renderTransactionLog() {
        const container = document.getElementById('transaction-log');
        if (!container) return;

        const transactions = SyndiData.transactions || [];

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="tx-feed">
                    <div class="tx-feed-header">
                        <span>Transaction Feed</span>
                    </div>
                    <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        No transactions yet
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="tx-feed">
                <div class="tx-feed-header">
                    <span>Transaction Feed</span>
                    <div class="tx-feed-live">
                        <span class="live-dot"></span>
                        Live
                    </div>
                </div>
                <div class="tx-feed-list">
                    ${transactions.map(tx => {
            // Resolve participant name from ID or use direct name
            const participantName = this._resolveParticipantName(tx.participant);
            const amount = tx.amount || 0;
            const type = tx.type || 'Payment';
            const time = tx.time || tx.timestamp || '';
            const txHash = tx.tx || tx.txHash || 'Pending';
            const status = tx.status || 'confirmed';

            return `
                        <div class="tx-feed-item">
                            <div class="tx-status-icon tx-status-${status === 'overdue' || status === 'failed' ? 'failed' : status === 'pending' ? 'pending' : 'confirmed'}">
                                ${status === 'overdue' || status === 'failed' ? '⚠️' : status === 'pending' ? '⏳' : '✓'}
                            </div>
                            <div class="tx-feed-content">
                                <div class="tx-feed-main">
                                    <span class="tx-feed-parties">${participantName} → Originator</span>
                                    <span class="tx-feed-amount">+${Utils.formatCurrency(amount)}</span>
                                </div>
                                <div class="tx-feed-meta">
                                    <span>${type}</span>
                                    <span>${txHash}</span>
                                    <span>${time}</span>
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Resolve participant name from ID or return the name directly
     * Checks MongoDB-sourced SyndiData.participants first
     */
    _resolveParticipantName(participantIdOrName) {
        if (!participantIdOrName) return 'Unknown';

        // If it looks like an ID (starts with PA- or contains -), try to look up
        if (participantIdOrName.startsWith('PA-') || participantIdOrName.includes('_agent')) {
            // Look up in SyndiData.participants (from MongoDB)
            const participants = SyndiData.participants || [];
            const found = participants.find(p =>
                p.id === participantIdOrName ||
                p._id === participantIdOrName ||
                p.participant_agent_id === participantIdOrName
            );

            if (found) {
                return found.name || found.institution_name || found.entity || participantIdOrName;
            }

            // Not found - return the ID itself (better than undefined)
            return participantIdOrName;
        }

        // Already a name, return as-is
        return participantIdOrName;
    }
};
