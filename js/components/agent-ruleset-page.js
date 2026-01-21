/**
 * Agent Ruleset Page
 * Reference page displaying all agent types and their decision logic
 */
const AgentRulesetPage = {

    render(container) {
        container.innerHTML = `
            <div class="ruleset-page">
                <div class="page-header-flex">
                    <div>
                        <h1 class="page-title">Agent Ruleset</h1>
                        <p class="page-subtitle">Decision logic and constraints for all AI agents</p>
                    </div>
                    <a href="/" class="btn-back" onclick="event.preventDefault(); Router.navigate('/overview');">← Back to Dashboard</a>
                </div>

                <!-- Participant Agent -->
                <section class="ruleset-section">
                    <div class="ruleset-header">
                        <span class="ruleset-icon">🏛️</span>
                        <h2>Participant Agent</h2>
                    </div>
                    <div class="ruleset-content">
                        <div class="ruleset-grid">
                            <div class="ruleset-card">
                                <h3>Strategy Profile</h3>
                                <table class="ruleset-table">
                                    <tr><td>Investment Style</td><td>Conservative / Balanced / Aggressive</td></tr>
                                    <tr><td>Min Spread</td><td>400 bps (floor)</td></tr>
                                    <tr><td>Max Single Exposure</td><td>$75M per deal</td></tr>
                                    <tr><td>Max Portfolio Exposure</td><td>15% per borrower/industry</td></tr>
                                    <tr><td>Rating Floor</td><td>BB- minimum</td></tr>
                                    <tr><td>ESG Minimum</td><td>60 score threshold</td></tr>
                                </table>
                            </div>
                            <div class="ruleset-card">
                                <h3>Capacity Constraints</h3>
                                <div class="formula-box">
                                    <code>available_capacity = total_capital - allocated_capital</code>
                                    <code>max_bid = min(available_capacity, max_single_exposure)</code>
                                </div>
                            </div>
                            <div class="ruleset-card wide">
                                <h3>Bid Decision Flowchart</h3>
                                <div class="flowchart">
                                    <div class="flow-step">Rating ≥ Floor?</div>
                                    <div class="flow-arrow">↓ Yes</div>
                                    <div class="flow-step">Spread ≥ Min?</div>
                                    <div class="flow-arrow">↓ Yes</div>
                                    <div class="flow-step">Industry Match?</div>
                                    <div class="flow-arrow">↓ Yes</div>
                                    <div class="flow-step">ESG ≥ Threshold?</div>
                                    <div class="flow-arrow">↓ Yes</div>
                                    <div class="flow-step">Capacity Available?</div>
                                    <div class="flow-arrow">↓ Yes</div>
                                    <div class="flow-step result">✅ Place Bid</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Originator Agent -->
                <section class="ruleset-section">
                    <div class="ruleset-header">
                        <span class="ruleset-icon">🏦</span>
                        <h2>Originator Agent</h2>
                    </div>
                    <div class="ruleset-content">
                        <div class="ruleset-grid">
                            <div class="ruleset-card">
                                <h3>Deal Parameters</h3>
                                <table class="ruleset-table">
                                    <tr><td>Total Amount</td><td>$50M - $2B</td></tr>
                                    <tr><td>Target Spread</td><td>200 - 600 bps</td></tr>
                                    <tr><td>Min Subscription</td><td>80-100%</td></tr>
                                    <tr><td>Max Rounds</td><td>1-3</td></tr>
                                    <tr><td>Single Lender Cap</td><td>25-35%</td></tr>
                                </table>
                            </div>
                            <div class="ruleset-card">
                                <h3>Negotiation Rules</h3>
                                <table class="ruleset-table">
                                    <tr><td>Subscription > 100%</td><td>Tighten spread 10-25 bps</td></tr>
                                    <tr><td>Subscription < 80% (R1)</td><td>Widen spread 10-25 bps</td></tr>
                                    <tr><td>Subscription < 50% (R2)</td><td>Cancel or extend</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Negotiation Agent -->
                <section class="ruleset-section">
                    <div class="ruleset-header">
                        <span class="ruleset-icon">⚡</span>
                        <h2>Negotiation Agent</h2>
                    </div>
                    <div class="ruleset-content">
                        <div class="ruleset-grid">
                            <div class="ruleset-card">
                                <h3>Auction Rules</h3>
                                <table class="ruleset-table">
                                    <tr><td>Round Duration</td><td>24-48 hours (sim time)</td></tr>
                                    <tr><td>Spread Adjustment</td><td>10-25 bps per round</td></tr>
                                    <tr><td>Min Participants</td><td>3 lenders required</td></tr>
                                    <tr><td>Oversub Trigger</td><td>110% → start tightening</td></tr>
                                </table>
                            </div>
                            <div class="ruleset-card">
                                <h3>Allocation Algorithm</h3>
                                <div class="formula-box">
                                    <code>score = (timing × 0.20) + (relationship × 0.30) + (spread × 0.25) + (size_fit × 0.25)</code>
                                </div>
                                <p class="formula-note">Allocate pro-rata by score, capped at single_lender_cap</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Settlement Agent -->
                <section class="ruleset-section">
                    <div class="ruleset-header">
                        <span class="ruleset-icon">📋</span>
                        <h2>Settlement Agent</h2>
                    </div>
                    <div class="ruleset-content">
                        <div class="ruleset-grid">
                            <div class="ruleset-card">
                                <h3>Checkpoint Requirements</h3>
                                <table class="ruleset-table">
                                    <tr><td>Documentation</td><td>All parties signed</td></tr>
                                    <tr><td>KYC/AML</td><td>All participants verified</td></tr>
                                    <tr><td>Funding</td><td>100% in escrow</td></tr>
                                </table>
                            </div>
                            <div class="ruleset-card">
                                <h3>Auto-Actions</h3>
                                <table class="ruleset-table">
                                    <tr><td>All docs signed</td><td>→ Move to Funding</td></tr>
                                    <tr><td>100% funded</td><td>→ Release escrow</td></tr>
                                    <tr><td>48hr timeout</td><td>→ Trigger break fee</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Payment Agent -->
                <section class="ruleset-section">
                    <div class="ruleset-header">
                        <span class="ruleset-icon">💰</span>
                        <h2>Payment Agent</h2>
                    </div>
                    <div class="ruleset-content">
                        <div class="ruleset-grid">
                            <div class="ruleset-card">
                                <h3>Fee Schedule</h3>
                                <table class="ruleset-table">
                                    <tr><td>Commitment Fee</td><td>0.5% at funding</td></tr>
                                    <tr><td>Break Fee</td><td>0.2% if dropout</td></tr>
                                    <tr><td>Admin Fee</td><td>0.02% quarterly</td></tr>
                                </table>
                            </div>
                            <div class="ruleset-card">
                                <h3>Distribution Rules</h3>
                                <table class="ruleset-table">
                                    <tr><td>Method</td><td>Pro-rata by allocation</td></tr>
                                    <tr><td>Priority</td><td>Platform fee first</td></tr>
                                    <tr><td>Settlement</td><td>x402 escrow required</td></tr>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <style>
                ${this.getStyles()}
            </style>
        `;
    },

    getStyles() {
        return `
            .ruleset-page {
                padding: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }

            .page-subtitle {
                color: var(--text-muted);
                margin: 0.25rem 0 0;
            }

            .btn-back {
                padding: 0.5rem 1rem;
                background: var(--bg-muted);
                border-radius: 6px;
                text-decoration: none;
                color: var(--text-primary);
                font-size: 0.875rem;
                font-weight: 500;
            }

            .btn-back:hover {
                background: var(--border-color);
            }

            .ruleset-section {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                margin-bottom: 1.5rem;
                overflow: hidden;
            }

            .ruleset-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem 1.5rem;
                background: var(--bg-muted);
                border-bottom: 1px solid var(--border-color);
            }

            .ruleset-icon {
                font-size: 1.5rem;
            }

            .ruleset-header h2 {
                margin: 0;
                font-size: 1.125rem;
                font-weight: 700;
            }

            .ruleset-content {
                padding: 1.5rem;
            }

            .ruleset-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }

            .ruleset-card {
                background: white;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 1rem;
            }

            .ruleset-card.wide {
                grid-column: span 2;
            }

            .ruleset-card h3 {
                margin: 0 0 0.75rem;
                font-size: 0.875rem;
                font-weight: 700;
                color: var(--text-muted);
                text-transform: uppercase;
            }

            .ruleset-table {
                width: 100%;
                font-size: 0.875rem;
            }

            .ruleset-table tr {
                border-bottom: 1px solid var(--border-color);
            }

            .ruleset-table tr:last-child {
                border-bottom: none;
            }

            .ruleset-table td {
                padding: 0.5rem 0;
            }

            .ruleset-table td:first-child {
                font-weight: 600;
                color: var(--text-primary);
            }

            .ruleset-table td:last-child {
                text-align: right;
                color: var(--text-muted);
            }

            .formula-box {
                background: #1e293b;
                border-radius: 6px;
                padding: 1rem;
            }

            .formula-box code {
                display: block;
                color: #10b981;
                font-family: monospace;
                font-size: 0.8rem;
                margin-bottom: 0.5rem;
            }

            .formula-box code:last-child {
                margin-bottom: 0;
            }

            .formula-note {
                margin: 0.75rem 0 0;
                font-size: 0.8rem;
                color: var(--text-muted);
                font-style: italic;
            }

            .flowchart {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.25rem;
            }

            .flow-step {
                background: var(--bg-muted);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 0.5rem 1rem;
                font-size: 0.8rem;
                font-weight: 500;
            }

            .flow-step.result {
                background: #dcfce7;
                border-color: #10b981;
                color: #166534;
            }

            .flow-arrow {
                color: var(--text-muted);
                font-size: 0.75rem;
            }

            @media (max-width: 768px) {
                .ruleset-grid {
                    grid-template-columns: 1fr;
                }
                .ruleset-card.wide {
                    grid-column: span 1;
                }
            }
        `;
    }
};

window.AgentRulesetPage = AgentRulesetPage;
