// ========================================
// Payments Component - Enhanced UI
// ========================================

const PaymentsComponent = {
    state: {
        balances: null,
        activeSyndicationId: null,
        payments: [],
        summary: {}
    },

    init() {
        this.injectStyles();
        this.detectActiveSyndication();
        this.fetchBackendData();
        this.render();

        // Listen for syndication selection events from Orchestration
        window.addEventListener('syndicationSelected', (e) => {
            this.state.activeSyndicationId = e.detail.syndicationId;
            this.fetchBackendData();
        });

        // Delegate "Pay now" button clicks
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-pay-id]');
            if (btn) {
                const paymentId = btn.getAttribute('data-pay-id');
                this._payNow(paymentId);
            }
        });

        // Polling for updates
        setInterval(() => this.fetchBackendData(), 15000);
    },

    detectActiveSyndication() {
        if (window.AppState && AppState.get('currentSyndicationId')) {
            this.state.activeSyndicationId = AppState.get('currentSyndicationId');
        } else if (window.location.hash?.includes('syndicationId=')) {
            const match = window.location.hash.match(/syndicationId=([^&]+)/);
            if (match) this.state.activeSyndicationId = match[1];
        }

        if (!this.state.activeSyndicationId && window.SyndiData?.syndications?.length) {
            this.state.activeSyndicationId = SyndiData.syndications[0].id;
        }
    },

    getActiveSyndicationId() {
        return this.state.activeSyndicationId || 'SYND-2025-001';
    },

    async fetchBackendData() {
        const syndId = this.getActiveSyndicationId();

        try {
            const [payments, summary, escrow, originatorBal] = await Promise.all([
                API.getPayments ? API.getPayments(syndId) : Promise.resolve([]),
                API.get ? API.get('server', `/payments/summary/${syndId}`) : Promise.resolve({}),
                API.getEscrowDetails ? API.getEscrowDetails(syndId) : Promise.resolve(null),
                API.getX402Balance ? API.getX402Balance('originator_01') : Promise.resolve(null)
            ]);

            this.state.payments = Array.isArray(payments) ? payments : (SyndiData.payments?.[syndId] || []);
            this.state.summary = summary || {};

            if (escrow || originatorBal) {
                this.state.balances = {
                    escrow: escrow?.balance ? escrow.balance / 1000000 : (this.state.balances?.escrow || 0),
                    originator: originatorBal?.balance ? originatorBal.balance / 1000000 : (this.state.balances?.originator || 0),
                    borrower: originatorBal?.balance ? (originatorBal.balance / 1000000) * 0.95 : (this.state.balances?.borrower || 0)
                };
            }
        } catch (e) {
            console.warn('Payments data fetch error:', e);
            this.state.payments = SyndiData.payments?.[syndId] || [];
        }

        this.render();
    },

    render() {
        const container = document.getElementById('payment-pipeline-visual');
        if (!container) return;

        const syndId = this.getActiveSyndicationId();
        const syndication = window.SyndiData?.syndications?.find(s => s.id === syndId);

        const activeParticipants = this.state.payments
            ? new Set(this.state.payments.map(p => p.participant || p.payer?.participant_agent_id)).size
            : 0;
        const totalPaid = this.state.summary?.totalPaid ||
            this.state.payments.filter(p => p.status === 'paid' || p.status === 'completed').reduce((sum, p) => sum + (p.amount || p.amount_paid || 0), 0);
        const totalDue = this.state.summary?.totalDue ||
            this.state.payments.reduce((sum, p) => sum + (p.amount || p.amount_due || 0), 0);
        const escrowHeld = this.state.balances?.escrow !== undefined ? this.state.balances.escrow : (totalPaid / 1000000);
        const settleRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

        // Build entire payments section
        container.innerHTML = `
            <!-- Syndication Header -->
            <div class="payments-header-card">
                <div class="payments-header-left">
                    <div class="payments-header-id">${syndId}</div>
                    <div class="payments-header-borrower">${syndication?.borrower || 'Syndication Facility'}</div>
                </div>
                <div class="payments-header-right">
                    <span class="payments-header-meta">${syndication?.originator || 'Lead Bank'}</span>
                    <span class="payments-header-industry">${syndication?.industry || 'Commercial'}</span>
                </div>
            </div>

            <!-- Flow Visualization -->
            <div class="payments-flow-container">
                <div class="payments-flow-stage">
                    <div class="payments-flow-icon participants">👥</div>
                    <div class="payments-flow-label">Participants</div>
                    <div class="payments-flow-value">${activeParticipants} Active</div>
                </div>
                <div class="payments-flow-connector">
                    <div class="payments-flow-line"></div>
                    <div class="payments-flow-arrow">→</div>
                </div>
                <div class="payments-flow-stage">
                    <div class="payments-flow-icon escrow">🔐</div>
                    <div class="payments-flow-label">Escrow</div>
                    <div class="payments-flow-value">$${escrowHeld.toFixed(1)}M</div>
                </div>
                <div class="payments-flow-connector">
                    <div class="payments-flow-line"></div>
                    <div class="payments-flow-arrow">→</div>
                </div>
                <div class="payments-flow-stage">
                    <div class="payments-flow-icon originator">🏛️</div>
                    <div class="payments-flow-label">Originator</div>
                    <div class="payments-flow-value">$${(totalPaid / 1000000).toFixed(1)}M</div>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="payments-kpi-grid">
                <div class="payments-kpi-card">
                    <div class="payments-kpi-label">Total Funded</div>
                    <div class="payments-kpi-value">$${(totalPaid / 1000000).toFixed(1)}M</div>
                </div>
                <div class="payments-kpi-card">
                    <div class="payments-kpi-label">Funding Gap</div>
                    <div class="payments-kpi-value gap">$${((totalDue - totalPaid) / 1000000).toFixed(1)}M</div>
                </div>
                <div class="payments-kpi-card">
                    <div class="payments-kpi-label">Settlement Rate</div>
                    <div class="payments-kpi-value">${settleRate}%</div>
                </div>
                <div class="payments-kpi-card">
                    <div class="payments-kpi-label">Status</div>
                    <div class="payments-kpi-value status-active">● Active</div>
                </div>
            </div>
        `;

        // Render progress bars
        this.renderProgressBars();
        this.renderPaymentTable();
        this.renderTransactionLog();
    },

    renderProgressBars() {
        const container = document.getElementById('payment-progress');
        if (!container) return;

        const byType = this._byType();
        const types = Object.keys(byType);

        if (types.length === 0) {
            container.innerHTML = `<div class="payments-no-data">No payment types recorded yet.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="payments-progress-grid">
                ${types.map(type => `
                    <div class="payments-progress-card">
                        <div class="payments-progress-header">
                            <span class="payments-progress-title">${type.replace(/_/g, ' ').toUpperCase()}</span>
                            <span class="payments-progress-percent">${byType[type].percent}%</span>
                        </div>
                        <div class="payments-progress-bar">
                            <div class="payments-progress-fill" style="width: ${byType[type].percent}%;"></div>
                        </div>
                        <div class="payments-progress-amounts">
                            <span>$${(byType[type].collected / 1000000).toFixed(2)}M</span>
                            <span>of $${(byType[type].total / 1000000).toFixed(2)}M</span>
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
            container.innerHTML = `<div class="payments-no-data">No payments recorded.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="payments-table-wrapper">
                <table class="payments-table">
                    <thead>
                        <tr>
                            <th>Participant</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => {
            const status = (p.status || p.payment_status || 'pending').toLowerCase();
            const isCompleted = status === 'paid' || status === 'completed';
            return `
                                <tr>
                                    <td><strong>${p.participant || p.payer?.participant_agent_id || 'Unknown'}</strong></td>
                                    <td>${(p.type || p.payment_type || 'fee').replace(/_/g, ' ')}</td>
                                    <td>$${((p.amount || p.amount_due || 0) / 1000000).toFixed(2)}M</td>
                                    <td><span class="payments-status-badge ${isCompleted ? 'completed' : 'pending'}">${status.toUpperCase()}</span></td>
                                    <td>${isCompleted ? '<span class="payments-check">✓</span>' : `<button class="payments-btn-pay" data-pay-id="${p.id || p.payment_id}">Pay Now</button>`}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderTransactionLog() {
        const container = document.getElementById('transaction-log');
        if (!container) return;

        const transactions = this.state.payments.filter(p => {
            const status = (p.status || p.payment_status || '').toLowerCase();
            return status === 'paid' || status === 'completed';
        });

        container.innerHTML = `
            <div class="payments-tx-list">
                ${transactions.length === 0
                ? '<div class="payments-no-data">No transactions yet.</div>'
                : transactions.slice(-10).reverse().map(tx => `
                        <div class="payments-tx-item">
                            <div class="payments-tx-icon">💰</div>
                            <div class="payments-tx-content">
                                <div class="payments-tx-main">
                                    <span>${tx.participant || tx.payer?.participant_agent_id || 'Agent'}</span>
                                    <span class="payments-tx-amount">+$${((tx.amount || tx.amount_paid || 0) / 1000000).toFixed(2)}M</span>
                                </div>
                                <div class="payments-tx-meta">
                                    <span>${(tx.type || tx.payment_type || 'Fee').replace(/_/g, ' ')}</span>
                                    <span>${new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')
            }
            </div>
        `;
    },

    _byType() {
        const grouped = {};
        this.state.payments.forEach(p => {
            const t = p.type || p.payment_type || 'other';
            if (!grouped[t]) grouped[t] = { collected: 0, total: 0 };
            grouped[t].total += p.amount || p.amount_due || 0;
            const status = (p.status || p.payment_status || '').toLowerCase();
            if (status === 'paid' || status === 'completed') {
                grouped[t].collected += p.amount || p.amount_paid || 0;
            }
        });
        Object.keys(grouped).forEach(k => {
            grouped[k].percent = grouped[k].total > 0 ? Math.round((grouped[k].collected / grouped[k].total) * 100) : 0;
        });
        return grouped;
    },

    injectStyles() {
        if (document.getElementById('payments-component-styles')) return;
        const style = document.createElement('style');
        style.id = 'payments-component-styles';
        style.textContent = `
            /* === Payments Header === */
            .payments-header-card {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1rem 1.5rem;
                background: linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%);
                border-radius: 12px;
                margin-bottom: 1.5rem;
                color: white;
            }
            .payments-header-id {
                font-size: 1.25rem;
                font-weight: 700;
            }
            .payments-header-borrower {
                font-size: 0.875rem;
                opacity: 0.85;
            }
            .payments-header-right {
                text-align: right;
                font-size: 0.875rem;
            }
            .payments-header-meta {
                display: block;
                font-weight: 600;
            }
            .payments-header-industry {
                opacity: 0.75;
            }

            /* === Flow Visualization === */
            .payments-flow-container {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                padding: 2rem;
                background: var(--bg-card);
                border-radius: 12px;
                border: 1px solid var(--border);
                margin-bottom: 1.5rem;
            }
            .payments-flow-stage {
                text-align: center;
                min-width: 100px;
            }
            .payments-flow-icon {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                margin: 0 auto 0.5rem;
                color: white;
            }
            .payments-flow-icon.participants { background: var(--primary); }
            .payments-flow-icon.escrow { background: #f59e0b; }
            .payments-flow-icon.originator { background: #10b981; }
            .payments-flow-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .payments-flow-value {
                font-size: 1.125rem;
                font-weight: 600;
                margin-top: 0.25rem;
            }
            .payments-flow-connector {
                display: flex;
                align-items: center;
                flex: 1;
                max-width: 120px;
            }
            .payments-flow-line {
                flex: 1;
                height: 2px;
                background: linear-gradient(90deg, var(--primary), #10b981);
            }
            .payments-flow-arrow {
                font-size: 1.25rem;
                color: var(--primary);
                margin-left: 4px;
            }

            /* === KPI Grid === */
            .payments-kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            .payments-kpi-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 1rem;
                text-align: center;
            }
            .payments-kpi-label {
                font-size: 0.7rem;
                text-transform: uppercase;
                color: var(--text-muted);
                letter-spacing: 0.5px;
            }
            .payments-kpi-value {
                font-size: 1.5rem;
                font-weight: 700;
                margin-top: 0.5rem;
            }
            .payments-kpi-value.gap { color: #f59e0b; }
            .payments-kpi-value.status-active { color: #10b981; font-size: 1rem; }

            /* === Progress Bars === */
            .payments-progress-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            .payments-progress-card {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 1rem;
            }
            .payments-progress-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
            }
            .payments-progress-title {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-muted);
            }
            .payments-progress-percent {
                font-size: 0.875rem;
                font-weight: 700;
                color: var(--primary);
            }
            .payments-progress-bar {
                height: 8px;
                background: rgba(0,0,0,0.1);
                border-radius: 4px;
                overflow: hidden;
            }
            .payments-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, var(--primary), #10b981);
                border-radius: 4px;
                transition: width 0.5s ease;
            }
            .payments-progress-amounts {
                display: flex;
                justify-content: space-between;
                font-size: 0.7rem;
                color: var(--text-muted);
                margin-top: 0.5rem;
            }

            /* === Payments Table === */
            .payments-table-wrapper {
                overflow-x: auto;
            }
            .payments-table {
                width: 100%;
                border-collapse: collapse;
            }
            .payments-table th,
            .payments-table td {
                padding: 0.75rem 1rem;
                text-align: left;
                border-bottom: 1px solid var(--border);
            }
            .payments-table th {
                font-size: 0.7rem;
                text-transform: uppercase;
                color: var(--text-muted);
                background: rgba(0,0,0,0.02);
            }
            .payments-status-badge {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                border-radius: 20px;
                font-size: 0.7rem;
                font-weight: 600;
            }
            .payments-status-badge.completed {
                background: rgba(16, 185, 129, 0.1);
                color: #10b981;
            }
            .payments-status-badge.pending {
                background: rgba(245, 158, 11, 0.1);
                color: #f59e0b;
            }
            .payments-check {
                color: #10b981;
                font-weight: bold;
            }
            .payments-btn-pay {
                padding: 0.375rem 0.75rem;
                font-size: 0.75rem;
                font-weight: 600;
                color: white;
                background: var(--primary);
                border: none;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
            }
            .payments-btn-pay:hover {
                background: #4f46e5;
            }

            /* === Transaction Log === */
            .payments-tx-list {
                max-height: 300px;
                overflow-y: auto;
            }
            .payments-tx-item {
                display: flex;
                gap: 0.75rem;
                padding: 0.75rem;
                border-bottom: 1px solid var(--border);
            }
            .payments-tx-item:last-child {
                border-bottom: none;
            }
            .payments-tx-icon {
                font-size: 1.25rem;
            }
            .payments-tx-content {
                flex: 1;
            }
            .payments-tx-main {
                display: flex;
                justify-content: space-between;
                font-weight: 500;
            }
            .payments-tx-amount {
                color: #10b981;
                font-weight: 600;
            }
            .payments-tx-meta {
                display: flex;
                justify-content: space-between;
                font-size: 0.75rem;
                color: var(--text-muted);
                margin-top: 0.25rem;
            }

            /* === No Data === */
            .payments-no-data {
                padding: 2rem;
                text-align: center;
                color: var(--text-muted);
            }

            /* === Grid Layout for Payments View === */
            .payments-grid {
                display: grid;
                gap: 1.5rem;
            }
            .payment-table-section,
            .transaction-log-section {
                background: var(--bg-card);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 1.5rem;
            }
            @media (min-width: 1024px) {
                .payments-lower-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    },

    async _payNow(paymentId) {
        if (!confirm('Execute payment for this item?')) return;
        try {
            await API.post('server', '/payments/pay', { paymentId });
            this.fetchBackendData();
        } catch (e) {
            alert('Payment execution failed. Using simulation fallback.');
            const p = this.state.payments.find(x => (x.id || x.payment_id) === paymentId);
            if (p) {
                p.status = 'paid';
                p.payment_status = 'completed';
                this.render();
            }
        }
    }
};

window.PaymentsComponent = PaymentsComponent;
