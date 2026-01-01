// ========================================
// Agents Component
// ========================================

const AgentsComponent = {
    init() {
        this.filterId = 'all';
        this.render();
    },

    setFilter(syndId) {
        this.filterId = syndId;
        this.render();
    },

    getFilteredData() {
        if (this.filterId === 'all') {
            return {
                agents: SyndiData.agents,
                decisions: SyndiData.decisions
            };
        }

        const synd = SyndiData.syndications.find(s => s.id === this.filterId);
        // Better empty state if syndication not found
        if (!synd) return {
            agents: { originator: [], participant: [], negotiation: [], settlement: [], payment: [] },
            decisions: []
        };

        // 1. Originator (Dynamic & Strict)
        const originatorName = typeof synd.originator === 'object' ? synd.originator.name : synd.originator;
        let originatorAgent = SyndiData.agents.originator.find(a => a.entity === originatorName);
        if (!originatorAgent) {
            originatorAgent = {
                id: 'OA-LEAD',
                entity: originatorName,
                status: 'active',
                loans: 12,
                success: 95
            };
        }

        // 2. Participants (From real bids)
        const participants = (synd.bids || []).map(bid => ({
            id: bid.participantId || bid.participant || 'UNKNOWN',
            entity: bid.participantName || bid.participant || 'Bidder',
            status: 'active',
            bids: 1,
            winRate: bid.allocation ? 100 : 0,
            note: `Bid: $${bid.amount}M @ ${bid.spread}bps${bid.allocation ? ' (Won)' : ''}`
        }));

        // 3. Negotiation Agent
        const negotiationAgents = [];
        if (['open', 'negotiating'].includes(synd.phase) || synd.status === 'negotiating') {
            negotiationAgents.push({
                id: `NA-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: 'running',
                round: `Rd ${synd.round}`,
                subscription: synd.subscription || 0
            });
        } else if (synd.phase !== 'open') {
            negotiationAgents.push({
                id: `NA-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: 'idle',
                round: 'Complete',
                subscription: synd.subscription || 100
            });
        }

        // 4. Settlement Agent
        const settlementAgents = [];
        if (['closing', 'settlement', 'closed'].includes(synd.phase)) {
            settlementAgents.push({
                id: `SA-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: synd.phase === 'closed' ? 'complete' : 'working',
                stage: synd.phase === 'closed' ? 'Archived' : 'Documentation',
                docs: synd.phase === 'closed' ? 100 : 50
            });
        }

        // 5. Payment Agent
        const paymentAgents = [];
        if (['closed', 'completed'].includes(synd.phase) || synd.status === 'completed') {
            paymentAgents.push({
                id: `PAY-${synd.id.split('-').pop()}`,
                syndId: synd.id,
                status: 'active',
                collected: 100,
                amount: `$${synd.amount}M`
            });
        }

        // Decisions
        const decisions = SyndiData.decisions.filter(d =>
            d.action.includes(synd.id) || d.result.includes(synd.id)
        );

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

    render() {
        this.renderFilter();
        this.renderAgentStatus();
        this.renderDecisionLog();
    },

    renderFilter() {
        const container = document.getElementById('agents-status-container');
        if (!container) return;

        // Build dropdown options
        const syndications = SyndiData.syndications || [];
        const options = syndications.map(s =>
            `<option value="${s.id}" ${this.filterId === s.id ? 'selected' : ''}>${s.id} - ${s.borrower}</option>`
        ).join('');

        // Prepend filter UI
        // Use body class for robust role detection
        const isParticipant = document.body.classList.contains('role-participant');
        const showTrigger = !isParticipant;

        const filterHtml = `
            <div class="agent-filter-toolbar" style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 1rem; background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                <label style="font-weight: 600; font-size: 0.875rem; color: var(--text-secondary);">Filter by Deal:</label>
                <select onchange="AgentsComponent.setFilter(this.value)" style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.875rem; min-width: 250px;">
                    <option value="all" ${this.filterId === 'all' ? 'selected' : ''}>All Operations</option>
                    ${options}
                </select>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">
                    ${this.filterId === 'all' ? 'Showing all active agents' : `Focusing on ${this.filterId}`}
                </span>
                ${showTrigger ? `
                <button class="btn-primary" onclick="window.AgentOrchestration && window.AgentOrchestration.triggerManualRun()" style="margin-left: 1rem; font-size: 0.8rem; padding: 0.5rem 1rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    🚀 New Syndication
                </button>
                ` : ''}
            </div>
            <div id="orchestration-view-container" style="display: none; margin-bottom: 2rem;"></div>
        `;

        container.innerHTML = filterHtml;

        // Render Orchestration View if filtered
        if (this.filterId !== 'all') {
            const synd = SyndiData.syndications.find(s => s.id === this.filterId);
            const orchContainer = document.getElementById('orchestration-view-container');
            if (synd && orchContainer && window.AgentOrchestration) {
                orchContainer.style.display = 'block';
                AgentOrchestration.render(orchContainer);
                AgentOrchestration.setViewingSyndication(synd);
            }
        }
    },

    renderAgentStatus() {
        const container = document.getElementById('agents-status-container');
        if (!container) return;

        const { agents } = this.getFilteredData();

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
        const healthStatus = agent.status === 'warning' ? 'warning' : (agent.status === 'error' ? 'error' : 'healthy');
        const healthIcon = healthStatus === 'healthy' ? '🟢' : (healthStatus === 'warning' ? '🟡' : '🔴');

        let info = '';
        switch (type) {
            case 'originator':
                info = `Loans: ${agent.loans} | Success: ${agent.success}%`;
                break;
            case 'participant':
                info = agent.note || `Bids: ${agent.bids} | Win Rate: ${agent.winRate}%`;
                break;
            case 'negotiation':
                info = `Round: ${agent.round} | Subscription: ${agent.subscription}%`;
                break;
            case 'settlement':
                info = agent.note || `Stage: ${agent.stage} | Docs: ${agent.docs}% signed`;
                break;
            case 'payment':
                info = `Collected: ${agent.collected}% (${agent.amount})`;
                break;
        }

        return `
            <div class="agent-row">
                <span class="agent-id">[${agent.id}]</span>
                <span class="agent-entity">${agent.entity || agent.syndId}</span>
                <span class="agent-info">${info}</span>
                <span class="agent-health">
                    ${healthIcon} ${agent.status === 'running' ? 'Running' : (agent.status === 'processing' ? 'Processing' : (agent.status === 'complete' ? 'Complete' : 'Active'))}
                </span>
            </div>
        `;
    },

    renderDecisionLog() {
        const container = document.getElementById('decision-log');
        if (!container) return;

        const { decisions } = this.getFilteredData();

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
    }
};
