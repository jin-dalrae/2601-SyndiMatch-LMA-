// ========================================
// Agents Component
// ========================================

const AgentsComponent = {
    statusMap: {
        healthy: 'Active',
        warning: 'Warning',
        error: 'Error',
        running: 'Running',
        processing: 'Processing',
        complete: 'Complete',
        active: 'Active',
        idle: 'Idle',
        working: 'Working'
    },

    healthIconMap: {
        healthy: '🟢',
        active: '🟢',
        running: '🔵',
        processing: '🟡',
        warning: '🟡',
        error: '🔴',
        complete: '🟣',
        idle: '⚪',
        working: '🔵'
    },

    agentLabelMap: {
        BID: 'Bidder',
        ORIGINATOR: 'Originator',
        PAYMENT: 'Payment',
        SETTLEMENT: 'Settlement',
        NEGOTIATION: 'Negotiation',
        SYSTEM: 'System',
        AUCTION: 'Auction',
        SYNDICATION: 'Workflow'
    },

    init() {
        this.filterId = 'all';
        this.render();
    },

    setFilter(syndId) {
        this.filterId = syndId;
        this.render();
    },

    async getFilteredData() {
        if (this.filterId === 'all') {
            // Fetch real data from API for the "all" view
            const [agentsData, allEvents, syndications] = await Promise.all([
                API.getAgents(),
                API.getAllSyndicationEvents(100), // Get latest 100 events
                API.getSyndications()
            ]);

            // Aggregate agents by type with syndication context
            const agents = {
                originator: (agentsData?.originator || []).map(a => ({
                    id: a.agent_id || a.id || a._id || 'OA-LEAD',
                    entity: a.institution?.name || a.entity || a.name || 'Originator',
                    status: a.status || 'active',
                    loans: a.track_record?.deals_closed_ytd || a.deals_completed || a.active_loans || 0,
                    success: a.track_record?.success_rate || a.success_rate || 95
                })),
                participant: (agentsData?.participant || []).map(a => ({
                    id: a.agent_id || a.id || a._id || 'PA-UNKNOWN',
                    entity: a.institution?.name || a.name || a.institution_name || 'Participant',
                    status: a.status || 'active',
                    bids: a.performance_history?.bids_submitted_ytd || a.total_bids || 0,
                    winRate: ((a.performance_history?.win_rate || a.win_rate || 0) * 100).toFixed(1)
                })),
                negotiation: (agentsData?.negotiation || []).map(a => ({
                    id: a.agent_id || a.id || 'NA-1',
                    syndId: a.syndication_id || a.syndId || 'N/A',
                    status: a.status || 'idle',
                    round: a.current_round || 1,
                    subscription: (a.subscription_rate || 0) * 100
                })),
                settlement: (agentsData?.settlement || []).map(a => ({
                    id: a.agent_id || a.id || 'SA-1',
                    syndId: a.syndication_id || a.syndId || 'N/A',
                    status: a.status || 'idle',
                    stage: a.current_stage || 'Pending',
                    docs: a.documents_completed_pct || 0
                })),
                payment: (agentsData?.payment || []).map(a => ({
                    id: a.agent_id || a.id || 'PAY-1',
                    syndId: a.syndication_id || a.syndId || 'N/A',
                    status: a.status || 'idle',
                    collected: (a.collection_rate || 0) * 100,
                    amount: `$${a.total_collected || 0}M`
                }))
            };

            // Map events to decision log format
            const decisions = (allEvents || []).map(e => {
                let actionType = 'neutral';
                const type = e.event_type || 'SYSTEM';
                if (type.includes('FAILED')) actionType = 'negative';
                if (type.includes('COMPLETE') || type.includes('SUCCESS')) actionType = 'positive';

                const dataStr = Object.entries(e.data || {})
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v, null, 2).substring(0, 100) : v}`)
                    .join(', ');

                return {
                    agent: this.agentLabelMap[type.split('_')[0]] || 'System',
                    time: e.timestamp ? new Date(e.timestamp).toISOString().replace('T', ' ').substring(0, 19) : 'N/A',
                    action: type,
                    factors: [{ type: actionType, text: dataStr || 'No additional data' }],
                    result: e.syndication_id ? `Syndication: ${e.syndication_id}` : 'Processed'
                };
            });

            // Return real data (empty states will be shown if no data)
            return { agents, decisions };
        }

        // Fetch real data in parallel
        const [synd, events, agentsData] = await Promise.all([
            API.getSyndication(this.filterId),
            API.getSyndicationEvents(this.filterId),
            API.getAgents()
        ]);

        if (!synd) return {
            agents: { originator: [], participant: [], negotiation: [], settlement: [], payment: [] },
            decisions: []
        };

        // 1. Originator
        const originatorName = typeof synd.originator === 'object' ? synd.originator.name : synd.originator;
        // Try to find in real agents, fallback to mock
        let originatorAgent = (agentsData?.originator || []).find(a => a.name === originatorName) || {
            id: 'OA-LEAD',
            entity: originatorName,
            status: 'active',
            loans: 12,
            success: 95
        };

        // 2. Participants from real bids
        const participants = (synd.bids || []).map(bid => ({
            id: bid.participant_agent_id || bid.participantId || 'UNKNOWN',
            entity: bid.institution_name || bid.participantName || 'Bidder', // specific to backend model
            status: 'active',
            bids: 1,
            winRate: bid.allocation ? 100 : 0,
            note: `Bid: $${bid.bid_amount || bid.amount}M @ ${bid.spread_bid || bid.spread}bps${bid.allocation ? ' (Won)' : ''}`
        }));

        // 3. Negotiation Agent (Derived from synd status)
        const negotiationAgents = [];
        if (synd.status !== 'created') {
            const isRunning = ['open', 'negotiating'].includes(synd.status);
            const negState = synd.negotiation_state || {};
            negotiationAgents.push({
                id: `NA-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: isRunning ? 'running' : 'complete',
                round: `Rd ${negState.auction_round || synd.round || 1}`,
                subscription: (negState.subscription_rate || (synd.subscription || 0)) * 100
            });
        }

        // 4. Settlement Agent
        const settlementAgents = [];
        if (['settlement', 'closed', 'completed'].includes(synd.status) || synd.phase === 'closed') {
            // Check specific settlement stage from events if possible, or just default
            settlementAgents.push({
                id: `SA-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: synd.status === 'completed' ? 'complete' : 'working',
                stage: synd.status === 'completed' ? 'Archived' : 'Documentation',
                docs: synd.documents_signed_count ? (synd.documents_signed_count / (participants.length || 1) * 100) : 50
            });
        }

        // 5. Payment Agent
        const paymentAgents = [];
        if (['payment', 'completed'].includes(synd.status)) {
            const payMetrics = synd.payment_metrics || {};
            paymentAgents.push({
                id: `PAY-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: 'active',
                collected: payMetrics.collection_rate ? payMetrics.collection_rate * 100 : 0,
                amount: `$${payMetrics.total_collected || 0}M`
            });
        }

        // Map backend events to decisions
        const decisions = events.map(e => {
            let actionType = 'neutral';
            const type = e.event_type || 'SYSTEM';

            if (type.includes('FAILED')) actionType = 'negative';
            if (type.includes('COMPLETE')) actionType = 'positive';

            const dataStr = Object.entries(e.data || {})
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v, null, 2).substring(0, 100) : v}`)
                .join(', ');

            return {
                agent: this.agentLabelMap[type.split('_')[0]] || 'System',
                time: new Date(e.timestamp).toISOString().replace('T', ' ').substring(0, 19),
                action: type,
                factors: [{ type: actionType, text: dataStr || 'No data' }],
                result: 'Processed'
            };
        });

        return {
            agents: {
                originator: [originatorAgent],
                participant: participants,
                negotiation: negotiationAgents,
                settlement: settlementAgents,
                payment: paymentAgents
            },
            decisions
        };
    },

    async render() {
        this.renderFilter();

        // Add loading state to containers
        const statusContainer = document.getElementById('agents-status-container');
        const decisionContainer = document.getElementById('decision-log');

        if (statusContainer) statusContainer.innerHTML += '<div class="loading-state">Syncing with orchestration engine...</div>';

        // Fetch async data
        this.data = await this.getFilteredData();

        // Clear loading and render
        if (statusContainer) {
            // Keep the filter (first child) and clear the rest
            const filterBar = statusContainer.querySelector('.agent-filter-toolbar');
            statusContainer.innerHTML = '';
            if (filterBar) statusContainer.appendChild(filterBar);

            // Re-render orchestration container if needed
            const orchContainer = document.createElement('div');
            orchContainer.id = 'orchestration-view-container';
            orchContainer.style.display = this.filterId !== 'all' ? 'block' : 'none';
            orchContainer.style.marginBottom = '2rem';
            statusContainer.appendChild(orchContainer);

            if (this.filterId !== 'all' && window.AgentOrchestration) {
                AgentOrchestration.render(orchContainer);
                // We need to re-fetch the syndication object for this View
                const synd = SyndiData.syndications.find(s => s.id === this.filterId);
                if (synd) AgentOrchestration.setViewingSyndication(synd);
            }
        }

        this.renderAgentStatus();
        this.renderDecisionLog();
    },

    renderFilter() {
        const container = document.getElementById('agents-status-container');
        if (!container) return;

        const syndications = SyndiData.syndications || [];

        // Check role for showing New Syndication button
        const isParticipant = document.body.classList.contains('role-participant');
        const showTrigger = !isParticipant;

        // Build syndication cards grid
        const cardsHtml = syndications.length > 0 ? syndications.map(s => `
            <div class="orch-synd-card" data-synd-id="${s.id}" onclick="window.location.hash='${s.id}/orchestration'">
                <div class="orch-card-header">
                    <span class="orch-card-id">${s.id}</span>
                    <span class="orch-card-status status-${s.status}">${s.status}</span>
                </div>
                <div class="orch-card-borrower">${s.borrower}</div>
                <div class="orch-card-amount">${Utils.formatCurrency(s.amount * 1000000)}</div>
                <div class="orch-card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${Utils.getProgressClass(s.subscription)}" style="width: ${s.subscription}%"></div>
                    </div>
                    <span class="orch-card-pct">${s.subscription}%</span>
                </div>
                <div class="orch-card-footer">
                    <span>👥 ${s.participantCount || 0} participants</span>
                    <span>→ View Details</span>
                </div>
            </div>
        `).join('') : '<div class="empty-state">No active syndications. Start a new one!</div>';

        container.innerHTML = `
            <div class="orch-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">Active Syndications</h2>
                    <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--text-muted);">Click a syndication to view orchestration details</p>
                </div>
                ${showTrigger ? `
                <button class="btn-primary" onclick="window.AgentOrchestration && window.AgentOrchestration.triggerManualRun()" style="font-size: 0.875rem; padding: 0.75rem 1.25rem; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    🚀 New Syndication
                </button>
                ` : ''}
            </div>
            <div class="orch-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                ${cardsHtml}
            </div>
            <style>
                .orch-synd-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.25rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .orch-synd-card:hover {
                    border-color: var(--primary);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
                    transform: translateY(-2px);
                }
                .orch-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }
                .orch-card-id {
                    font-weight: 700;
                    font-size: 0.875rem;
                    color: var(--primary);
                }
                .orch-card-status {
                    font-size: 0.75rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-weight: 600;
                    text-transform: capitalize;
                }
                .orch-card-status.status-open { background: #dcfce7; color: #166534; }
                .orch-card-status.status-negotiating { background: #fef3c7; color: #92400e; }
                .orch-card-status.status-closing { background: #dbeafe; color: #1e40af; }
                .orch-card-status.status-completed { background: #f3e8ff; color: #6b21a8; }
                .orch-card-borrower {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                }
                .orch-card-amount {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    margin-bottom: 0.75rem;
                }
                .orch-card-progress {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                }
                .orch-card-progress .progress-bar {
                    flex: 1;
                    height: 6px;
                    background: var(--bg-muted);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .orch-card-pct {
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--primary);
                }
                .orch-card-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .orch-card-footer span:last-child {
                    color: var(--primary);
                    font-weight: 600;
                }
            </style>
        `;
    },

    renderAgentStatus() {
        const container = document.getElementById('agents-status-container');
        if (!container || !this.data) return;

        const { agents } = this.data;

        const agentGroups = [
            { title: 'Originator Agents', count: agents.originator.length, data: agents.originator, type: 'originator' },
            { title: 'Participant Agents', count: agents.participant.length, data: agents.participant, type: 'participant' },
            { title: 'Negotiation Agents', count: agents.negotiation.length, data: agents.negotiation, type: 'negotiation' },
            { title: 'Settlement Agents', count: agents.settlement.length, data: agents.settlement, type: 'settlement' },
            { title: 'Payment Agents', count: agents.payment.length, data: agents.payment, type: 'payment' }
        ];

        // Append to existing HTML (filter)
        container.insertAdjacentHTML('beforeend', agentGroups.map(group => `
            <div class="agent-group">
                <div class="agent-group-title">${group.title} (${Number.isInteger(group.count) ? group.count : group.count})</div>
                ${group.data.length > 0
                ? group.data.map(agent => this.renderAgentRow(agent, group.type)).join('')
                : '<div style="padding: 0.75rem; color: var(--text-muted); font-style: italic; font-size: 0.875rem;">No active agents found for this view</div>'}
            </div>
        `).join(''));
    },

    renderAgentRow(agent, type) {
        const status = agent.status || 'active';
        const healthIcon = this.healthIconMap[status] || '🟢';
        const displayStatus = this.statusMap[status] || status;

        let info = '';
        switch (type) {
            case 'originator':
                info = `Loans: ${agent.loans} | Success: ${agent.success}%`;
                break;
            case 'participant':
                info = agent.note || `Bids: ${agent.bids} | Win Rate: ${agent.winRate}%`;
                break;
            case 'negotiation':
                info = `Round: ${agent.round} | Subscription: ${(agent.subscription || 0).toFixed(1)}%`;
                break;
            case 'settlement':
                info = agent.note || `Stage: ${agent.stage} | Docs: ${(agent.docs || 0).toFixed(0)}% signed`;
                break;
            case 'payment':
                info = `Collected: ${(agent.collected || 0).toFixed(1)}% (${agent.amount})`;
                break;
        }

        return `
            <div class="agent-row">
                <span class="agent-id">[${agent.id}]</span>
                <span class="agent-entity">${agent.entity || agent.syndId}</span>
                <span class="agent-info">${info}</span>
                <span class="agent-health">
                    ${healthIcon} ${displayStatus}
                </span>
            </div>
        `;
    },

    renderDecisionLog() {
        const container = document.getElementById('decision-log');
        if (!container || !this.data) return;

        const { decisions } = this.data;

        if (decisions.length === 0) {
            container.innerHTML = '<div class="empty-state">No decision logs found for this syndication.</div>';
            return;
        }

        container.innerHTML = decisions.map(decision => `
            <div class="decision-entry">
                <div class="decision-header">
                    <span class="decision-agent">${decision.agent}</span>
                    <span class="decision-time">[${decision.time}]</span>
                </div>
                <div class="decision-action">Decision: ${decision.action}</div>
                <div class="decision-reasoning">
                    <strong>Reasoning:</strong>
                    ${decision.factors.map(f => `
                        <div class="decision-factor ${f.type}">
                            ${f.type === 'positive' ? '✓' : (f.type === 'negative' ? '✗' : '○')} ${f.text}
                        </div>
                    `).join('')}
                </div>
                <div class="decision-result">
                    <strong>Action:</strong> ${decision.result}
                </div>
            </div>
        `).join('');
    },

    // Build agent cards HTML (for use in syndication detail views)
    buildAgentCards(data) {
        const { agents } = data;
        if (!agents) return '<p class="text-muted">No agent data available.</p>';

        const agentGroups = [
            { title: 'Originator', data: agents.originator || [], type: 'originator' },
            { title: 'Participants', data: agents.participant || [], type: 'participant' },
            { title: 'Negotiation', data: agents.negotiation || [], type: 'negotiation' },
            { title: 'Settlement', data: agents.settlement || [], type: 'settlement' },
            { title: 'Payment', data: agents.payment || [], type: 'payment' }
        ];

        return agentGroups.map(group => `
            <div class="agent-group">
                <div class="agent-group-title">${group.title} (${group.data.length})</div>
                ${group.data.length > 0
                ? group.data.map(agent => this.renderAgentRow(agent, group.type)).join('')
                : '<div style="padding: 0.5rem; color: var(--text-muted); font-size: 0.875rem;">No agents</div>'}
            </div>
        `).join('');
    }
};
