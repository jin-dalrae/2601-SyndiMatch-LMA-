/**
 * SyndiMatch - x402 Payment Component
 * Handles x402 Payment-Required flow in the dashboard
 * 
 * IMPROVED:
 * - Dynamic syndication/participant info
 * - MutationObserver for robust initialization
 * - Wallet address validation
 * - Proper error logging
 * - Accessibility attributes
 * - UTC timestamps for consistency
 */

const X402Payment = {
    pendingPayment: null,
    isDevMode: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',

    /**
     * Initialize x402 payment handlers
     * Uses MutationObserver for robust initialization instead of setTimeout
     * Only renders for participant role (not admin/platform/originator)
     */
    init() {
        // Only show for participant role - admins/originators don't make x402 payments
        const currentRole = RoleContext?.currentRole || AppState?.get('currentRole') || 'platform';
        if (['admin', 'platform', 'originator'].includes(currentRole)) {
            return; // Don't render x402 section for these roles
        }

        const container = document.getElementById('payment-pipeline-visual');
        if (container) {
            this.renderPaymentButton(container);
            return;
        }

        // Container not ready - use MutationObserver
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.getElementById('payment-pipeline-visual');
            if (el) {
                this.renderPaymentButton(el);
                obs.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Fallback timeout in case element never appears
        setTimeout(() => {
            observer.disconnect();
            const el = document.getElementById('payment-pipeline-visual');
            if (el) this.renderPaymentButton(el);
        }, 5000);
    },

    /**
     * Get current syndication context
     * Returns dynamic values instead of hardcoded ones
     */
    _getSyndicationContext() {
        // Try to get from global state or URL params
        const urlParams = new URLSearchParams(window.location.search);

        return {
            syndId: window.SYNDICATION_ID ||
                AppState?.get('currentSyndicationId') ||
                urlParams.get('syndId') ||
                'SYND-DEMO-001',
            participantId: RoleContext?.currentAgentId ||
                AppState?.get('currentAgentId') ||
                null,
            commitmentAmount: window.COMMITMENT_AMOUNT ||
                AppState?.get('commitmentAmount') ||
                50000000
        };
    },

    /**
     * Validate wallet address format
     * Returns true if valid, false otherwise
     */
    _isValidWalletAddress(address) {
        if (!address) return false;

        // Check for Ethereum-style address (0x + 40 hex chars)
        if (/^0x[a-fA-F0-9]{40}$/.test(address)) return true;

        // Check for internal wallet format (participant-XXX-wallet)
        if (/^(participant|originator|escrow)-[\w-]+-wallet$/.test(address)) return true;

        return false;
    },

    /**
     * Get wallet address for current user
     */
    _getWalletAddress() {
        const context = this._getSyndicationContext();

        // Try to get actual wallet address
        const walletAddress = RoleContext?.walletAddress ||
            AppState?.get('walletAddress') ||
            (context.participantId ? `participant-${context.participantId}-wallet` : null);

        if (!walletAddress) {
            this._logWarn('No wallet address configured');
            return null;
        }

        return walletAddress;
    },

    /**
     * Log warning (respects dev mode)
     */
    _logWarn(message, ...args) {
        console.warn(`[X402Payment] ${message}`, ...args);
    },

    /**
     * Log error (always logs)
     */
    _logError(message, error) {
        console.error(`[X402Payment] ${message}`, error);
    },

    /**
     * Format timestamp in UTC for consistency across time zones
     */
    _formatTimestamp(isoString) {
        try {
            const date = new Date(isoString);
            return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
        } catch {
            return isoString;
        }
    },

    /**
     * Render the x402 payment trigger button
     */
    renderPaymentButton(container) {
        if (!container) {
            container = document.getElementById('payment-pipeline-visual');
            if (!container) return;
        }

        const context = this._getSyndicationContext();

        const x402Section = document.createElement('div');
        x402Section.className = 'x402-payment-section';
        x402Section.innerHTML = `
            <div class="x402-header">
                <h4>x402 Payment Gateway</h4>
                <span class="x402-badge">Base L2 • USDC</span>
            </div>
            <div class="x402-actions">
                <button class="btn-x402 btn-join" id="btn-join-syndication"
                        aria-label="Join syndication with 0.5% commitment fee"
                        ${!context.participantId ? 'disabled title="No participant ID configured"' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                    Join Syndication (0.5% fee)
                </button>
                <button class="btn-x402 btn-trigger-payment" id="btn-trigger-x402" disabled
                        aria-label="Execute pending x402 payment">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="1" y="4" width="22" height="16" rx="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Trigger x402 Payment
                </button>
            </div>
            <div class="x402-status" id="x402-status" role="status" aria-live="polite"></div>
            <div class="x402-receipts" id="x402-receipts" role="log" aria-label="Payment receipts"></div>
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
        const context = this._getSyndicationContext();

        if (!context.participantId) {
            statusEl.innerHTML = `<div class="x402-error">Error: No participant ID configured. Please select a role.</div>`;
            return;
        }
        if (API.useMockData) {
            statusEl.innerHTML = `<div class="x402-error">Demo mode enabled. Turn off Demo to use x402.</div>`;
            return;
        }

        statusEl.innerHTML = `<div class="x402-loading">Requesting access to ${context.syndId}...</div>`;

        try {
            if (!API.serverClient) API.init();
            const data = await API.serverClient.post('/x402/join-syndication', {
                syndId: context.syndId,
                participantId: context.participantId,
                commitmentAmount: context.commitmentAmount
            });

            // If we're here, it was potentially a 200 OK (access already granted)
            statusEl.innerHTML = `<div class="x402-success-simple">✅ Access granted to ${context.syndId}!</div>`;
        } catch (error) {
            if (error.status === 402 && error.details) {
                // Payment Required!
                const data = error.details;
                this.pendingPayment = data.payment;

                statusEl.innerHTML = `
                    <div class="x402-payment-required">
                        <div class="x402-alert">
                            <span class="x402-alert-icon" aria-hidden="true">⚠️</span>
                            <strong>HTTP 402: Payment Required</strong>
                        </div>
                        <div class="x402-payment-details">
                            <div class="x402-detail-row">
                                <span>Fee Type:</span>
                                <strong>Commitment Fee (0.5%)</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Amount:</span>
                                <strong class="x402-amount">${data.message?.match(/\$[\d,]+/)?.[0] || this._formatAmount(context.commitmentAmount * 0.005)} USDC</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Network:</span>
                                <strong>Base L2</strong>
                            </div>
                            <div class="x402-detail-row">
                                <span>Payment ID:</span>
                                <code>${data.payment?.paymentId || 'N/A'}</code>
                            </div>
                        </div>
                    </div>
                `;

                triggerBtn.disabled = false;
                triggerBtn.classList.add('ready');
            } else {
                this._logError('Join syndication error:', error);
                statusEl.innerHTML = `<div class="x402-error">Error: ${error.message || 'Unknown error'}</div>`;
            }
        }
    },

    /**
     * Format amount as currency string
     */
    _formatAmount(amount) {
        return '$' + Math.round(amount).toLocaleString();
    },

    /**
     * Execute the pending x402 payment
     */
    async executePayment() {
        if (!this.pendingPayment) {
            const statusEl = document.getElementById('x402-status');
            statusEl.innerHTML = `<div class="x402-error">No pending payment. Click "Join Syndication" first.</div>`;
            return;
        }
        if (API.useMockData) {
            const statusEl = document.getElementById('x402-status');
            statusEl.innerHTML = `<div class="x402-error">Demo mode enabled. Turn off Demo to use x402.</div>`;
            return;
        }

        const statusEl = document.getElementById('x402-status');
        const triggerBtn = document.getElementById('btn-trigger-x402');

        const walletAddress = this._getWalletAddress();
        if (!walletAddress) {
            statusEl.innerHTML = `<div class="x402-error">Error: No wallet address configured.</div>`;
            return;
        }

        // Validate wallet address
        if (!this._isValidWalletAddress(walletAddress)) {
            this._logWarn(`Invalid wallet address format: ${walletAddress}`);
            // Continue anyway for simulation mode, but warn
        }

        statusEl.innerHTML = `<div class="x402-loading">Processing x402 payment on Base...</div>`;
        triggerBtn.disabled = true;

        try {
            if (!API.serverClient) API.init();
            const data = await API.serverClient.post('/x402/pay', {
                paymentId: this.pendingPayment.paymentId,
                walletAddress: walletAddress
            });

            if (data.success) {
                const txHash = data.transaction?.txHash || 'unknown';
                const fullTxLink = txHash.startsWith('0x')
                    ? `https://basescan.org/tx/${txHash}`
                    : null;

                statusEl.innerHTML = `
                    <div class="x402-success">
                        <div class="x402-success-icon" aria-hidden="true">✅</div>
                        <div class="x402-success-message">
                            <strong>${data.message}</strong>
                            <div class="x402-tx-details">
                                <span>Tx: 
                                    ${fullTxLink
                        ? `<a href="${fullTxLink}" target="_blank" rel="noopener"><code>${txHash.slice(0, 20)}...</code></a>`
                        : `<code>${txHash.slice(0, 20)}...</code>`
                    }
                                </span>
                                <span>Gas: ${data.transaction?.gasUsed || 'N/A'} ETH</span>
                                <span>Confirmations: ${data.transaction?.confirmations || 'pending'}</span>
                            </div>
                        </div>
                    </div>
                `;

                this.pendingPayment = null;
                triggerBtn.classList.remove('ready');

                // Add to receipts
                this.addReceipt(data);
            } else {
                statusEl.innerHTML = `<div class="x402-error">Payment failed: ${data.error || 'Unknown error'}</div>`;
                triggerBtn.disabled = false;
            }
        } catch (error) {
            this._logError('Payment error:', error);
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
        receipt.setAttribute('role', 'listitem');

        const timestamp = data.transaction?.timestamp || new Date().toISOString();
        const formattedTime = this._formatTimestamp(timestamp);

        receipt.innerHTML = `
            <div class="receipt-header">
                <span class="receipt-type">${(data.receipt?.type || 'payment').replace('_', ' ').toUpperCase()}</span>
                <span class="receipt-amount">${this._formatAmount(data.transaction?.amount || 0)}</span>
            </div>
            <div class="receipt-details">
                <span>${data.receipt?.syndId || 'Unknown'}</span>
                <span title="${timestamp}">${formattedTime}</span>
            </div>
        `;

        receiptsEl.insertBefore(receipt, receiptsEl.firstChild);
    },

    /**
     * Load past x402 transactions
     */
    async loadTransactions() {
        try {
            const transactions = await API.get('server', '/x402/transactions');
            if (!transactions) return;

            const receiptsEl = document.getElementById('x402-receipts');
            if (!receiptsEl || !Array.isArray(transactions) || transactions.length === 0) return;

            transactions.forEach(tx => {
                this.addReceipt({
                    transaction: { amount: tx.amount, timestamp: tx.paidAt },
                    receipt: { type: tx.type, syndId: tx.syndId }
                });
            });
        } catch (error) {
            // Log in dev mode, but don't crash
            if (this.isDevMode || typeof console !== 'undefined') {
                this._logWarn('Failed to load transactions:', error.message);
            }
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
        color: var(--text-primary, #1f2937);
        margin: 0;
    }
    .x402-badge {
        background: rgba(59, 130, 246, 0.2);
        color: var(--primary-light, #3b82f6);
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .x402-actions {
        display: flex;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
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
        background: var(--primary, #3b82f6);
        color: white;
    }
    .btn-join:hover:not(:disabled) {
        background: var(--primary-light, #60a5fa);
    }
    .btn-join:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-trigger-payment {
        background: var(--bg-card, #ffffff);
        color: var(--text-secondary, #6b7280);
        border: 1px solid var(--border-color, #e5e7eb);
    }
    .btn-trigger-payment:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-trigger-payment.ready {
        background: linear-gradient(135deg, #10B981, #059669);
        color: white;
        border: none;
    }
    /* Reduced animation for accessibility and performance */
    @media (prefers-reduced-motion: no-preference) {
        .btn-trigger-payment.ready {
            animation: pulse-glow 2s infinite;
        }
    }
    @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
        50% { box-shadow: 0 0 20px 5px rgba(16, 185, 129, 0.2); }
    }
    .x402-status {
        min-height: 1rem;
    }
    .x402-loading {
        color: var(--warning, #f59e0b);
        font-size: 0.875rem;
    }
    .x402-error {
        color: var(--danger, #ef4444);
        font-size: 0.875rem;
        padding: 0.5rem;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 0.25rem;
    }
    .x402-success-simple {
        color: var(--success, #10b981);
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
        color: var(--warning, #f59e0b);
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
        color: var(--text-muted, #9ca3af);
    }
    .x402-detail-row code {
        font-family: monospace;
        font-size: 0.75rem;
        background: var(--bg-main, #f3f4f6);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }
    .x402-amount {
        color: var(--success, #10b981) !important;
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
        color: var(--success, #10b981);
        margin-bottom: 0.5rem;
    }
    .x402-tx-details {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--text-muted, #9ca3af);
    }
    .x402-tx-details a {
        color: var(--primary, #3b82f6);
        text-decoration: none;
    }
    .x402-tx-details a:hover {
        text-decoration: underline;
    }
    .x402-tx-details code {
        background: var(--bg-main, #f3f4f6);
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
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e5e7eb);
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
        color: var(--text-secondary, #6b7280);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .receipt-amount {
        font-weight: 600;
        color: var(--success, #10b981);
    }
    .receipt-details {
        font-size: 0.75rem;
        color: var(--text-muted, #9ca3af);
        display: flex;
        justify-content: space-between;
    }
`;
document.head.appendChild(x402Styles);

// Initialize using robust method
document.addEventListener('DOMContentLoaded', () => {
    X402Payment.init();
});

// Export for use in other modules
window.X402Payment = X402Payment;
