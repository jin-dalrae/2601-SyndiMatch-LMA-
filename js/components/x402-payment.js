/**
 * SyndiMatch - x402 Payment Component
 * Handles x402 Payment-Required flow in the dashboard
 */

const X402Payment = {
    pendingPayment: null,
    isDevMode: true,

    init() {
        const currentRole = window.RoleRouter?.currentRole || 'platform';
        if (['admin', 'platform', 'originator'].includes(currentRole)) {
            return;
        }

        const container = document.getElementById('payment-pipeline-visual');
        if (container) {
            this.renderPaymentButton(container);
        } else {
            const observer = new MutationObserver((mutations, obs) => {
                const el = document.getElementById('payment-pipeline-visual');
                if (el) {
                    this.renderPaymentButton(el);
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    },

    _getSyndicationContext() {
        return {
            syndId: window.SYNDICATION_ID || AppState?.get('currentSyndicationId') || 'SYND-DEMO-001',
            participantId: RoleRouter?.currentAgentId || AppState?.get('currentAgentId') || null,
            commitmentAmount: 50000000
        };
    },

    renderPaymentButton(container) {
        if (!container) return;
        const context = this._getSyndicationContext();
        const isParticipant = document.body.classList.contains('role-participant');

        container.innerHTML = `
            <div class="x402-payment-section">
                <div class="x402-header">
                    <h4>x402 Payment Gateway</h4>
                    <span class="x402-badge">Base L2 • USDC</span>
                </div>
                ${isParticipant ? `
                <div class="x402-actions">
                    <button class="btn-x402 btn-join" id="btn-join-syndication" ${!context.participantId ? 'disabled' : ''}>
                        Join Syndication (0.5% fee)
                    </button>
                    <button class="btn-x402 btn-trigger-payment" id="btn-trigger-x402" disabled>
                        Trigger x402 Payment
                    </button>
                </div>
                ` : `
                <div class="x402-info">
                    <em>Payment actions are handled by Participant agents automatically.</em>
                </div>
                `}
                <div class="x402-status" id="x402-status" role="status" aria-live="polite"></div>
                <div class="x402-receipts" id="x402-receipts" role="log" aria-label="Payment receipts"></div>
            </div>
        `;

        document.getElementById('btn-join-syndication')?.addEventListener('click', () => this.joinSyndication());
        document.getElementById('btn-trigger-x402')?.addEventListener('click', () => this.executePayment());
        this.loadTransactions();
    },

    async joinSyndication() {
        const statusEl = document.getElementById('x402-status');
        const triggerBtn = document.getElementById('btn-trigger-x402');
        const context = this._getSyndicationContext();

        statusEl.innerHTML = `<div class="x402-loading">Requesting access...</div>`;

        try {
            const res = await API.post('server', '/x402/join-syndication', {
                syndId: context.syndId,
                participantId: context.participantId
            });
            statusEl.innerHTML = `<div class="x402-success">✅ Access granted!</div>`;
        } catch (error) {
            if (error.status === 402 && error.details?.payment) {
                this.pendingPayment = error.details.payment;
                statusEl.innerHTML = `
                    <div class="x402-alert">
                        <strong>HTTP 402: Payment Required</strong>
                        <p>Amount: ${this.pendingPayment.amount} USDC</p>
                    </div>
                `;
                triggerBtn.disabled = false;
                triggerBtn.classList.add('ready');
            } else {
                statusEl.innerHTML = `<div class="x402-error">Error: ${error.message}</div>`;
            }
        }
    },

    async executePayment() {
        if (!this.pendingPayment) return;
        const statusEl = document.getElementById('x402-status');
        statusEl.innerHTML = `<div class="x402-loading">Processing on Base L2...</div>`;

        try {
            const data = await API.post('server', '/x402/pay', {
                paymentId: this.pendingPayment.paymentId,
                walletAddress: `wallet-${this._getSyndicationContext().participantId}`
            });

            if (data.success) {
                statusEl.innerHTML = `<div class="x402-success">✅ Payment successful! Tx: ${data.transaction.txHash.slice(0, 10)}...</div>`;
                this.addReceipt(data);
                this.pendingPayment = null;
                document.getElementById('btn-trigger-x402').disabled = true;
            }
        } catch (error) {
            statusEl.innerHTML = `<div class="x402-error">Payment failed: ${error.message}</div>`;
        }
    },

    addReceipt(data) {
        const receiptsEl = document.getElementById('x402-receipts');
        if (!receiptsEl) return;
        const receipt = document.createElement('div');
        receipt.className = 'x402-receipt';
        receipt.innerHTML = `
            <span>${data.receipt?.syndId || 'Payment'}</span>
            <strong>$${(data.transaction?.amount / 1000000).toFixed(2)}M</strong>
        `;
        receiptsEl.prepend(receipt);
    },

    async loadTransactions() {
        try {
            const transactions = await API.get('server', '/x402/transactions');
            if (transactions && Array.isArray(transactions)) {
                transactions.forEach(tx => this.addReceipt({ transaction: tx, receipt: tx }));
            }
        } catch (e) { }
    }
};

const x402Styles = document.createElement('style');
x402Styles.textContent = `
    .x402-payment-section { background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.2); padding: 1rem; border-radius: 8px; }
    .x402-badge { background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
    .btn-x402 { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; }
    .btn-join { background: var(--primary); color: white; }
    .btn-trigger-payment.ready { background: #10B981; color: white; animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }
`;
document.head.appendChild(x402Styles);

window.X402Payment = X402Payment;
