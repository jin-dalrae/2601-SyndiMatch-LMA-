// ========================================
// Payments Component - Enhanced UI
// ========================================

const PaymentsComponent = {
    state: {
        balances: null,
        payments: [],
        summary: {},
        syndicationId: null
    },

    init() {
        this.injectStyles();
        this.detectActiveSyndication();
        this.fetchBackendData();
        this.render();

        // Delegate "Pay now" button clicks
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-pay-id]');
            if (btn) {
                const paymentId = btn.getAttribute('data-pay-id');
                const paymentType = btn.getAttribute('data-pay-type');
                this._payNow(paymentId, paymentType);
            }
        });
    },

    detectActiveSyndication() {
        // Try to read currently viewed syndication from global state/router if available
        if (window.AppState && typeof AppState.get === 'function') {
            const active = AppState.get('activeSyndicationId');
            if (active) this.state.syndicationId = active;
        } else if (window.location.hash?.includes('syndication')) {
            const match = window.location.hash.match(/syndication=([^&]+)/);
            if (match) this.state.syndicationId = decodeURIComponent(match[1]);
        }
        // Fallback to first mock if still unset
        if (!this.state.syndicationId && typeof SyndiData !== 'undefined' && SyndiData.syndications?.length) {
            this.state.syndicationId = SyndiData.syndications[0].id;
        }
    },

    async fetchBackendData() {
        const syndId = this.state.syndicationId || 'SYND-2025-001';

        const [payments, summary, escrow, originatorBal] = await Promise.all([
            API.getPayments().then(list => (list || []).filter(p => p.syndication_id === syndId)),
            API.get(`/payments/summary/${syndId}`),
            API.getEscrowDetails(syndId),
            API.getX402Balance('originator_01')
        ]);

        this.state.payments = payments || [];
        this.state.summary = summary || {};

        if (escrow || originatorBal) {
            this.state.balances = {
                escrow: escrow?.balance ? escrow.balance / 1000000 : 0, // Convert USDC base units if needed
                originator: originatorBal?.balance ? originatorBal.balance / 1000000 : 0,
                borrower: originatorBal?.balance ? (originatorBal.balance / 1000000) * 0.95 : 0
            };
        }
        this.render();
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

        const activeParticipants = Object.keys(window.AutoBidder?.participants || {}).length;

        // Derive amounts from live summary if available
        const totalPaid = this.state.summary?.totalPaid || 0;
        const totalDue = this.state.summary?.totalDue || 0;

        const escrowHeld = this.state.balances?.escrow !== undefined
            ? this.state.balances.escrow.toFixed(1)
            : (totalPaid ? (totalPaid / 1_000_000).toFixed(1) : '0.0');

        const principalFunded = this.state.balances?.originator !== undefined
            ? this.state.balances.originator.toFixed(1)
            : (totalPaid ? (totalPaid / 1_000_000).toFixed(1) : '0.0');

        const borrowerReceived = this.state.balances?.borrower !== undefined
            ? this.state.balances.borrower.toFixed(1)
            : (totalPaid ? ((totalPaid * 0.95) / 1_000_000).toFixed(1) : '0.0');

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
                    <div class="payment-stat-value">$${(totalPaid / 1_000_000).toFixed(1)}M</div>
                    <div class="payment-stat-trend ${totalPaid ? 'trend-up' : ''}">${totalPaid ? 'Live collected' : 'Waiting for payments'}</div>
                </div>
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Pending</div>
                    <div class="payment-stat-value">$${((totalDue - totalPaid) / 1_000_000).toFixed(1)}M</div>
                    <div class="payment-stat-trend">${this._countByStatus('pending')} payments awaiting</div>
                </div>
                <div class="payment-stat-card">
                    <div class="payment-stat-label">Fees Collected</div>
                    <div class="payment-stat-value">$${this._sumByType(['commitment_fee', 'arrangement_fee']).toFixed(2)}M</div>
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

        const byType = this._byType();
        const progress = [
            { name: 'Commitment Fees', ...byType.commitment_fee, color: 'green' },
            { name: 'Arrangement Fees', ...byType.arrangement_fee, color: 'orange' },
            { name: 'Principal', ...byType.principal, color: 'blue' }
        ];

        container.innerHTML = `
            <div class="progress-section">
                ${progress.map(p => `
                    <div class="progress-card">
                        <div class="progress-header">
                            <span class="progress-title">${p.name}</span>
                            <span class="progress-percent">${p.percent || 0}%</span>
                        </div>
                        <div class="progress-bar-enhanced">
                            <div class="progress-fill-enhanced fill-${p.color}" style="width: ${p.percent || 0}%"></div>
                        </div>
                        <div class="progress-amounts">
                            <span>${Utils.formatCurrency(p.collected || 0)}</span>
                            <span>${Utils.formatCurrency(p.total || 0)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderPaymentTable() {
        const container = document.getElementById('payment-table-container');
        if (!container) return;

        const payments = this.state.payments;
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
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.map(p => this._renderPaymentRow(p)).join('')}
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

        const transactions = (this.state.payments || []).filter(p => p.payment_status === 'completed');

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
            const participantName = this._resolveParticipantName(tx.payer?.participant_agent_id || tx.participant);
            const amount = tx.amount_paid || tx.amount_due || tx.amount || 0;
            const type = tx.payment_type || tx.type || 'Payment';
            const time = tx.paid_at || tx.time || tx.timestamp || '';
            const txHash = tx.tx_hash || tx.tx || tx.txHash || 'Pending';
            const status = tx.payment_status || tx.status || 'confirmed';

            return `
                        <div class="tx-feed-item">
                            <div class="tx-status-icon tx-status-${status === 'overdue' || status === 'failed' ? 'failed' : status === 'pending' ? 'pending' : 'confirmed'}">
                                ${status === 'overdue' || status === 'failed' ? '⚠️' : status === 'pending' ? '⏳' : '✓'}
                            </div>
                            <div class="tx-feed-content">
                                <div class="tx-feed-main">
                                    <span class="tx-feed-parties">${participantName} → ${type === 'principal' ? 'Escrow' : 'Originator'}</span>
                                    <span class="tx-feed-amount">+${Utils.formatCurrency(amount)}</span>
                                </div>
                                <div class="tx-feed-meta">
                                    <span>${type}</span>
                                    <span>${time ? new Date(time).toLocaleString() : ''}</span>
                                    <span>${(txHash || '').toString().slice(0, 10)}...</span>
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
    },

    _renderPaymentRow(p) {
        const participantName = this._resolveParticipantName(p.payer?.participant_agent_id || p.participant);
        const status = (p.payment_status || 'pending').toLowerCase();
        const type = p.payment_type || '';

        const commitment = type === 'commitment_fee' ? (p.amount_paid || p.amount_due || 0) : 0;
        const arrangement = type === 'arrangement_fee' ? (p.amount_paid || p.amount_due || 0) : 0;
        const principal = type === 'principal' ? (p.amount_paid || p.amount_due || 0) : 0;

        return `
            <tr>
                <td><strong>${participantName}</strong></td>
                <td><span class="payment-status ${status}">${this.getStatusIcon(status)} ${Utils.formatCurrency(commitment)}</span></td>
                <td><span class="payment-status ${status}">${this.getStatusIcon(status)} ${Utils.formatCurrency(arrangement)}</span></td>
                <td><span class="payment-status ${status}">${this.getStatusIcon(status)} ${Utils.formatCurrency(principal)}</span></td>
                <td><strong>${Utils.formatCurrency(p.amount_paid || p.amount_due || 0)}</strong></td>
                <td><span class="status-badge ${status}">${status.toUpperCase()}</span></td>
                <td>
                    ${status === 'pending'
                        ? `<button class="btn-xs" data-pay-id="${p._id || p.payment_id}" data-pay-type="${type}">Pay now</button>`
                        : ''}
                </td>
            </tr>
        `;
    },

    _byType() {
        const grouped = {
            commitment_fee: { collected: 0, total: 0 },
            arrangement_fee: { collected: 0, total: 0 },
            principal: { collected: 0, total: 0 }
        };

        (this.state.payments || []).forEach(p => {
            const t = p.payment_type || 'commitment_fee';
            if (!grouped[t]) grouped[t] = { collected: 0, total: 0 };
            grouped[t].total += p.amount_due || 0;
            if ((p.payment_status || '').toLowerCase() === 'completed') {
                grouped[t].collected += p.amount_paid || p.amount_due || 0;
            }
        });

        Object.keys(grouped).forEach(t => {
            const g = grouped[t];
            g.percent = g.total > 0 ? Math.round((g.collected / g.total) * 100) : 0;
            g.pendingPct = 100 - g.percent;
        });

        return grouped;
    },

    _countByStatus(status) {
        return (this.state.payments || []).filter(p => (p.payment_status || '').toLowerCase() === status).length;
    },

    _sumByType(types) {
        const payments = this.state.payments || [];
        const sum = payments
            .filter(p => types.includes(p.payment_type))
            .reduce((acc, p) => acc + (p.amount_paid || p.amount_due || 0), 0);
        return sum / 1_000_000; // millions for display
    },

    async _payNow(paymentId, paymentType) {
        try {
            const payment = (this.state.payments || []).find(p => (p._id || p.payment_id) === paymentId);
            if (!payment) return;

            const payload = {
                paymentId,
                walletAddress: payment.payer?.wallet_address || 'mock-participant-wallet'
            };

            // Call mock pay endpoint (Express x402) to keep flows in one place
            const res = await API.post('server', '/x402/pay', payload);
            if (res?.success) {
                // Refresh payments after paying
                await this.fetchBackendData();
            }
        } catch (err) {
            console.error('Pay now failed:', err);
        }
    }
};
