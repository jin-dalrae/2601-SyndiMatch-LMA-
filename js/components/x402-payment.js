/**
 * SyndiMatch - x402 Payment Component
 * Handles x402 Payment-Required flow in the dashboard
 */

const X402Payment = {
    pendingPayment: null,

    /**
     * Initialize x402 payment handlers
     */
    init() {
        this.renderPaymentButton();
    },

    /**
     * Render the x402 payment trigger button
     */
    renderPaymentButton() {
        const container = document.getElementById('payment-pipeline-visual');
        if (!container) return;

        // Check if user is a Participant (only they can join/pay)
        const isParticipant = document.body.classList.contains('role-participant');

        const x402Section = document.createElement('div');
        x402Section.className = 'x402-payment-section';
        x402Section.innerHTML = `
            <div class="x402-header">
                <h4>x402 Payment Gateway</h4>
                <span class="x402-badge">Base L2 • USDC</span>
            </div>
            ${isParticipant ? `
            <div class="x402-actions">
                <button class="btn-x402 btn-join" id="btn-join-syndication">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                    Join Syndication (0.5% fee)
                </button>
                <button class="btn-x402 btn-trigger-payment" id="btn-trigger-x402" disabled>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="4" width="22" height="16" rx="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Trigger x402 Payment
                </button>
            </div>
            ` : `
            <div class="x402-info" style="padding: 1rem; color: var(--text-muted); font-size: 0.875rem;">
                <em>Payment actions are handled by Participant agents automatically.</em>
            </div>
            `}
            <div class="x402-status" id="x402-status"></div>
            <div class="x402-receipts" id="x402-receipts"></div>
        `;

        container.insertBefore(x402Section, container.firstChild);

        // Attach event handlers
        document.getElementById('btn-join-syndication')?.addEventListener('click', () => this.joinSyndication());
        document.getElementById('btn-trigger-x402')?.addEventListener('click', () => this.executePayment());

        // Load past transactions
        this.loadTransactions();
    },

    /**
     * Attempt to join a syndication - triggers HTTP 402
     */
    async joinSyndication() {
        const statusEl = document.getElementById('x402-status');
        const triggerBtn = document.getElementById('btn-trigger-x402');

        statusEl.innerHTML = `<div class="x402-loading">Requesting access...</div>`;

        try {
            const response = await fetch(`${API.agentUrl}/x402/join-syndication`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syndId: 'SYND-2025-001',
                    participantId: RoleContext?.currentAgentId || 'PA-001',
                    commitmentAmount: 50000000 // $50M commitment
                })
            });

            if (response.status === 402) {
                // Payment Required!
                const data = await response.json();
                this.pendingPayment = data.payment;

                statusEl.innerHTML = `
                    <div class="x402-payment-required">
                        <div class="x402-alert">
                            <span class="x402-alert-icon">⚠️</span>
                            <strong>HTTP 402: Payment Required</strong>
                        </div>
                        <div class="x402-payment-details">
                            <div class="x402-detail-row">
                                <span>Fee Type:</span>
                                <strong>Commitment Fee (0.5%)</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Amount:</span>
                                <strong class="x402-amount">${data.message.match(/\$[\d,]+/)?.[0] || '$250,000'} USDC</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Network:</span>
                                <strong>Base L2</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Payment ID:</span>
                                <code>${data.payment.paymentId}</code>
                            </div>
                        </div>
                    </div>
                `;

                triggerBtn.disabled = false;
                triggerBtn.classList.add('ready');
            } else {
                statusEl.innerHTML = `<div class="x402-success">Access granted!</div>`;
            }
        } catch (error) {
            console.error('Join syndication error:', error);
            statusEl.innerHTML = `<div class="x402-error">Error: ${error.message}</div>`;
        }
    },

    /**
     * Execute the pending x402 payment
     */
    async executePayment() {
        if (!this.pendingPayment) {
            alert('No pending payment');
            return;
        }

        const statusEl = document.getElementById('x402-status');
        const triggerBtn = document.getElementById('btn-trigger-x402');

        statusEl.innerHTML = `<div class="x402-loading">Processing x402 payment on Base...</div>`;
        triggerBtn.disabled = true;

        try {
            const response = await fetch(`${API.agentUrl}/x402/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentId: this.pendingPayment.paymentId,
                    walletAddress: RoleContext?.currentAgentId || 'participant-wallet'
                })
            });

            const data = await response.json();

            if (data.success) {
                statusEl.innerHTML = `
                    <div class="x402-success">
                        <div class="x402-success-icon">✅</div>
                        <div class="x402-success-message">
                            <strong>${data.message}</strong>
                            <div class="x402-tx-details">
                                <span>Tx: <code>${data.transaction.txHash.slice(0, 20)}...</code></span>
                                <span>Gas: ${data.transaction.gasUsed} ETH</span>
                                <span>Confirmations: ${data.transaction.confirmations}</span>
                            </div>
                        </div>
                    </div>
                `;

                this.pendingPayment = null;
                triggerBtn.classList.remove('ready');

                // Add to receipts
                this.addReceipt(data);
            } else {
                statusEl.innerHTML = `<div class="x402-error">Payment failed: ${data.error}</div>`;
                triggerBtn.disabled = false;
            }
        } catch (error) {
            console.error('Payment error:', error);
            statusEl.innerHTML = `<div class="x402-error">Error: ${error.message}</div>`;
            triggerBtn.disabled = false;
        }
    },

    /**
     * Add receipt to display
     */
    addReceipt(data) {
        const receiptsEl = document.getElementById('x402-receipts');
        if (!receiptsEl) return;

        const receipt = document.createElement('div');
        receipt.className = 'x402-receipt';
        receipt.innerHTML = `
            <div class="receipt-header">
                <span class="receipt-type">${data.receipt.type.replace('_', ' ').toUpperCase()}</span>
                <span class="receipt-amount">$${data.transaction.amount.toLocaleString()}</span>
            </div>
            <div class="receipt-details">
                <span>${data.receipt.syndId}</span>
                <span>${new Date(data.transaction.timestamp).toLocaleTimeString()}</span>
            </div>
        `;

        receiptsEl.insertBefore(receipt, receiptsEl.firstChild);
    },

    /**
     * Load past x402 transactions
     */
    async loadTransactions() {
        try {
            const response = await fetch(`${API.agentUrl}/x402/transactions`);
            const transactions = await response.json();

            const receiptsEl = document.getElementById('x402-receipts');
            if (!receiptsEl || transactions.length === 0) return;

            transactions.forEach(tx => {
                this.addReceipt({
                    transaction: { amount: tx.amount, timestamp: tx.paidAt },
                    receipt: { type: tx.type, syndId: tx.syndId }
                });
            });
        } catch (e) {
            // API not available - ignore
        }
    }
};

// Add CSS for x402 components
const x402Styles = document.createElement('style');
x402Styles.textContent = `
    .x402-payment-section {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 0.75rem;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
    }
    .x402-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
    }
    .x402-header h4 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
    }
    .x402-badge {
        background: rgba(59, 130, 246, 0.2);
        color: var(--primary-light);
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .x402-actions {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }
    .btn-x402 {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        border: none;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .btn-join {
        background: var(--primary);
        color: white;
    }
    .btn-join:hover {
        background: var(--primary-light);
    }
    .btn-trigger-payment {
        background: var(--bg-card);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }
    .btn-trigger-payment:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-trigger-payment.ready {
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        border: none;
        animation: pulse-glow 2s infinite;
    }
    @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        50% { box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.2); }
    }
    .x402-status {
        min-height: 1rem;
    }
    .x402-loading {
        color: var(--warning);
        font-size: 0.875rem;
    }
    .x402-error {
        color: var(--danger);
        font-size: 0.875rem;
    }
    .x402-payment-required {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 0.5rem;
        padding: 1rem;
    }
    .x402-alert {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        color: var(--warning);
        font-size: 0.875rem;
    }
    .x402-payment-details {
        display: grid;
        gap: 0.5rem;
    }
    .x402-detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.875rem;
    }
    .x402-detail-row span {
        color: var(--text-muted);
    }
    .x402-detail-row code {
        font-family: monospace;
        font-size: 0.75rem;
        background: var(--bg-main);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }
    .x402-amount {
        color: var(--success) !important;
        font-size: 1rem !important;
    }
    .x402-success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 0.5rem;
        padding: 1rem;
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
    }
    .x402-success-icon {
        font-size: 1.5rem;
    }
    .x402-success-message strong {
        display: block;
        color: var(--success);
        margin-bottom: 0.5rem;
    }
    .x402-tx-details {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--text-muted);
    }
    .x402-tx-details code {
        background: var(--bg-main);
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
    }
    .x402-receipts {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .x402-receipt {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        padding: 0.75rem;
    }
    .receipt-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
    }
    .receipt-type {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .receipt-amount {
        font-weight: 600;
        color: var(--success);
    }
    .receipt-details {
        font-size: 0.75rem;
        color: var(--text-muted);
        display: flex;
        justify-content: space-between;
    }
`;
document.head.appendChild(x402Styles);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for payments view to be available
    setTimeout(() => X402Payment.init(), 500);
});
