/**
 * Syndication Process Details Page
 * Step-by-step visual guide showing how a syndication flows through the platform
 */
const ProcessDetailsPage = {

    render(container) {
        container.innerHTML = `
            <div class="process-page">
                <div class="page-header-flex">
                    <div>
                        <h1 class="page-title">Syndication Process</h1>
                        <p class="page-subtitle">Step-by-step lifecycle of a loan syndication</p>
                    </div>
                    <a href="/" class="btn-back" onclick="event.preventDefault(); Router.navigate('/overview');">← Back to Dashboard</a>
                </div>

                <!-- Process Timeline -->
                <div class="process-timeline">
                    ${this.renderStages()}
                </div>

                <!-- Summary Stats -->
                <div class="process-summary">
                    <div class="summary-card">
                        <div class="summary-icon">⏱️</div>
                        <div class="summary-value">4-6 hours</div>
                        <div class="summary-label">Total Process Time (Simulated)</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-icon">🤖</div>
                        <div class="summary-value">5</div>
                        <div class="summary-label">Agent Types Involved</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-icon">💰</div>
                        <div class="summary-value">0.5%</div>
                        <div class="summary-label">Platform Fee</div>
                    </div>
                </div>
            </div>

            <style>
                ${this.getStyles()}
            </style>
        `;
    },

    renderStages() {
        const stages = [
            {
                number: 1,
                icon: '🏦',
                title: 'Origination',
                status: 'Originator broadcasts deal',
                duration: '~1 hour',
                agents: ['Originator Agent'],
                description: 'The originating bank creates a new syndication opportunity with deal parameters including amount, spread, rating, and timeline. The deal is broadcast to all registered participant agents.',
                actions: [
                    'Set loan parameters (amount, spread, rating)',
                    'Define timeline and subscription targets',
                    'Broadcast to participant network'
                ]
            },
            {
                number: 2,
                icon: '📥',
                title: 'Bookbuilding',
                status: 'Participants evaluate and bid',
                duration: '24-48 hours (sim: ~1 hour)',
                agents: ['Participant Agents'],
                description: 'Participant agents evaluate the opportunity against their strategy profiles. Those that match submit bids with their desired amount and spread.',
                actions: [
                    'Evaluate deal against strategy profile',
                    'Check available capacity',
                    'Submit bid (amount + spread)'
                ]
            },
            {
                number: 3,
                icon: '⚡',
                title: 'Negotiation',
                status: 'Dutch auction rounds',
                duration: '1-3 rounds',
                agents: ['Negotiation Agent'],
                description: 'The Negotiation Agent manages the auction process. If oversubscribed, spreads tighten. Participants can accept new terms or withdraw.',
                actions: [
                    'Monitor subscription levels',
                    'Adjust spread (tighten/widen)',
                    'Process participant responses'
                ]
            },
            {
                number: 4,
                icon: '📊',
                title: 'Allocation',
                status: 'Pro-rata scoring and assignment',
                duration: '~30 minutes',
                agents: ['Negotiation Agent'],
                description: 'Final allocations are calculated using the scoring algorithm. Each participant receives their share, capped at the single-lender limit.',
                actions: [
                    'Calculate allocation scores',
                    'Apply single-lender cap (25%)',
                    'Notify participants of allocations'
                ]
            },
            {
                number: 5,
                icon: '📋',
                title: 'Settlement',
                status: 'Documentation and KYC',
                duration: '24 hours (sim: ~30 min)',
                agents: ['Settlement Agent'],
                description: 'Credit agreements are signed, KYC/AML verification is completed, and participants fund their allocations into the escrow.',
                actions: [
                    'Generate credit agreements',
                    'Verify KYC/AML compliance',
                    'Collect escrow funding'
                ]
            },
            {
                number: 6,
                icon: '💰',
                title: 'Funding',
                status: 'Escrow release and fee collection',
                duration: '~15 minutes',
                agents: ['Payment Agent'],
                description: 'Once 100% funded, the Payment Agent releases escrow to the borrower and collects commitment fees from participants via x402.',
                actions: [
                    'Verify 100% funding',
                    'Release escrow to borrower',
                    'Collect commitment fees (0.5%)'
                ]
            },
            {
                number: 7,
                icon: '📈',
                title: 'Servicing',
                status: 'Ongoing distributions',
                duration: 'Loan term (3-7 years)',
                agents: ['Payment Agent'],
                description: 'The Payment Agent manages ongoing interest and principal distributions to participants on a pro-rata basis throughout the loan term.',
                actions: [
                    'Calculate quarterly interest',
                    'Distribute to participants pro-rata',
                    'Track performance metrics'
                ]
            }
        ];

        return stages.map((stage, index) => `
            <div class="process-stage ${index < stages.length - 1 ? 'has-connector' : ''}">
                <div class="stage-number">${stage.number}</div>
                <div class="stage-content">
                    <div class="stage-header">
                        <span class="stage-icon">${stage.icon}</span>
                        <h3 class="stage-title">${stage.title}</h3>
                        <span class="stage-duration">${stage.duration}</span>
                    </div>
                    <p class="stage-status">${stage.status}</p>
                    <p class="stage-description">${stage.description}</p>
                    <div class="stage-agents">
                        <span class="agents-label">Agents:</span>
                        ${stage.agents.map(a => `<span class="agent-badge">${a}</span>`).join('')}
                    </div>
                    <div class="stage-actions">
                        <span class="actions-label">Actions:</span>
                        <ul>
                            ${stage.actions.map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `).join('');
    },

    getStyles() {
        return `
            .process-page {
                padding: 2rem;
                max-width: 1000px;
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

            .process-timeline {
                margin-top: 2rem;
            }

            .process-stage {
                display: flex;
                gap: 1.5rem;
                position: relative;
                padding-bottom: 2rem;
            }

            .process-stage.has-connector::after {
                content: '';
                position: absolute;
                left: 20px;
                top: 50px;
                bottom: 0;
                width: 2px;
                background: linear-gradient(to bottom, var(--primary), var(--border-color));
            }

            .stage-number {
                width: 42px;
                height: 42px;
                background: var(--primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 1rem;
                flex-shrink: 0;
                z-index: 1;
            }

            .stage-content {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.25rem;
                flex: 1;
            }

            .stage-header {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-bottom: 0.5rem;
            }

            .stage-icon {
                font-size: 1.5rem;
            }

            .stage-title {
                margin: 0;
                font-size: 1.125rem;
                font-weight: 700;
                flex: 1;
            }

            .stage-duration {
                font-size: 0.75rem;
                color: var(--text-muted);
                background: var(--bg-muted);
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
            }

            .stage-status {
                color: var(--primary);
                font-weight: 600;
                font-size: 0.875rem;
                margin: 0 0 0.75rem;
            }

            .stage-description {
                color: var(--text-muted);
                font-size: 0.875rem;
                line-height: 1.6;
                margin: 0 0 1rem;
            }

            .stage-agents {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.75rem;
            }

            .agents-label, .actions-label {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--text-muted);
                text-transform: uppercase;
            }

            .agent-badge {
                background: #dbeafe;
                color: #1e40af;
                font-size: 0.75rem;
                font-weight: 600;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
            }

            .stage-actions ul {
                margin: 0.5rem 0 0;
                padding-left: 1.5rem;
            }

            .stage-actions li {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-bottom: 0.25rem;
            }

            .process-summary {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 1rem;
                margin-top: 2rem;
            }

            .summary-card {
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
            }

            .summary-icon {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }

            .summary-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary);
            }

            .summary-label {
                font-size: 0.8rem;
                color: var(--text-muted);
                margin-top: 0.25rem;
            }

            @media (max-width: 768px) {
                .process-summary {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }
};

window.ProcessDetailsPage = ProcessDetailsPage;
