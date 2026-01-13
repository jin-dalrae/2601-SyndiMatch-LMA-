/**
 * SyndiMatch Agent Orchestration Page
 * Visualizes LangGraph workflow and connects to Python agent server
 */

const AgentOrchestration = {
    // WebSocket connection to Python agent server
    ws: null,
    wsUrl: null,
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    usePolling: true,
    pollIntervalMs: 3000,
    pollTimer: null,
    seenEventIds: new Set(),

    // Agent workflow stages
    workflowStages: [
        { id: 'originator', name: 'Originator Agent', icon: '🏦', description: 'Generates syndication opportunity and broadcasts to participants' },
        { id: 'participant', name: 'Participant Agents', icon: '🏢', description: 'Evaluate opportunity and submit bids based on risk profile' },
        { id: 'negotiation', name: 'Negotiation Agent', icon: '⚡', description: 'Runs Dutch auction to determine clearing spread' },
        { id: 'settlement', name: 'Settlement Agent', icon: '📋', description: 'Confirms allocations and generates documentation' },
        { id: 'payment', name: 'Payment Agent', icon: '💰', description: 'Processes x402 payments and records transactions' }
    ],

    // Current workflow state
    currentStage: null,
    workflowLog: [],
    activeSyndication: null,
    isSimulatedMode: false,  // Track if we're in simulated mode
    manualMode: false,

    /**
     * Normalize syndication data from various sources to a consistent shape
     */
    normalizeSyndication(data) {
        if (!data) return null;

        return {
            id: data.syndication_id || data.id || data._id || 'Unknown',
            borrower: data.loan_details?.borrower_name || data.borrower || 'Unknown Borrower',
            amount: typeof data.loan_details?.total_amount === 'number'
                ? data.loan_details.total_amount / 1000000
                : data.amount || 0,
            rating: data.loan_details?.credit_rating || data.rating || 'N/A',
            spread: data.current_spread || data.pricing?.initial_spread || data.spread || data.loan_details?.spread || null,
            industry: data.loan_details?.industry || data.industry || 'Unknown',
            originator: data.originator || data.originatorName || data.originator_agent_id || 'Unknown',
            status: data.status || 'pending',
            phase: data.phase || data.status || 'open',
            subscription: (data.subscription_rate ? data.subscription_rate * 100 : 0) || data.subscription || 0,
            round: data.current_round || data.round || 1
        };
    },

    /**
     * Initialize the orchestration page
     */
    init() {
        console.log('🤖 Agent Orchestration initialized');
        if (this.usePolling) {
            this.startPolling();
        } else {
            this.connectWebSocket();
        }
        this.setupControlHandlers();

        // Listen for simulation events
        if (window.SimulationEngine) {
            SimulationEngine.on('simulationStart', () => this.onSimulationStart());
            SimulationEngine.on('newSyndication', (data) => this.onNewSyndication(data));
        }

        // Listen for manual syndication triggers
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));
    },

    /**
     * Set up event handlers for controls
     */
    setupControlHandlers() {
        // Use event delegation for buttons that might be re-rendered
        document.addEventListener('click', (e) => {
            const id = e.target.id;
            if (id === 'btn-run-syndication') {
                this.triggerManualRun();
            } else if (id === 'btn-reset-engine') {
                this.resetWorkflow();
            } else if (id === 'btn-step-engine') {
                this.stepWorkflow();
            } else if (id === 'btn-clear-log') {
                this.workflowLog = [];
                this.renderWorkflow();
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target.id === 'check-manual-mode') {
                this.manualMode = e.target.checked;
                this.addLogEntry('system', `Manual Mode: ${this.manualMode ? 'ENABLED' : 'DISABLED'}`);
            }
        });
    },

    /**
     * Step workflow (execute next node)
     */
    stepWorkflow() {
        if (!this.activeSyndication) {
            this.addLogEntry('system', '⚠️ No active syndication to step');
            return;
        }

        this.addLogEntry('system', `Stepping workflow for ${this.activeSyndication.id}...`);
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'step_syndication',
                syndication_id: this.activeSyndication.id
            }));
        } else {
            API.post('server', '/syndications/resume', {
                syndication_id: this.activeSyndication.id
            });
        }
    },

    /**
     * Connect to Python agent WebSocket server
     */
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to Agent Server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.ws.send(JSON.stringify({ type: 'subscribe' }));
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                this.ws.close();
            };

        } catch (error) {
            console.warn('Failed to connect to agent server:', error);
            this.updateConnectionStatus(false);
        }
    },

    /**
     * Attempt to reconnect to WebSocket
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connectWebSocket(), 3000);
        }
    },

    /**
     * Poll syndication events via Node API (no direct agent calls from browser)
     */
    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        const poll = async () => {
            const events = await API.get('server', '/syndication-events?limit=100');
            if (!events) {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                return;
            }
            this.isConnected = true;
            this.updateConnectionStatus(true);
            const ordered = [...events].reverse();
            ordered.forEach((event) => {
                const key = event._id || `${event.event_type}-${event.timestamp}`;
                if (this.seenEventIds.has(key)) return;
                this.seenEventIds.add(key);
                this.handleServerMessage(event);
            });
            if (this.seenEventIds.size > 1000) {
                this.seenEventIds.clear();
            }
        };
        poll();
        this.pollTimer = setInterval(poll, this.pollIntervalMs);
    },

    /**
     * Handle message from Python agent server
     * Updated to handle new domain events from events.py including agent reasoning
     */
    handleServerMessage(message) {
        console.log('📨 Agent message:', message);

        // Handle both legacy format (type) and new format (event_type)
        const eventType = message.event_type || message.type;
        const eventData = message.data || message;

        switch (eventType) {
            // === Connection Events ===
            case 'subscribed':
                this.addLogEntry('system', 'Connected to LangGraph agents');
                break;

            case 'engine_reset':
                this.addLogEntry('system', '🔄 Engine state reset by server');
                this.resetWorkflow(false); // don't re-send reset to server
                break;

            // === Domain Events ===
            case 'SyndicationOpened':
                this.activeSyndication = this.normalizeSyndication(eventData);
                this.setStage('originator', 'complete');
                this.addLogEntry('originator',
                    `${eventData.originator} opened ${eventData.borrower} $${(eventData.amount / 1000000).toFixed(0)}M @ ${eventData.spread}bps`,
                    eventData.reasoning);
                break;

            case 'BidReceived':
                this.setStage('participant', 'active');
                this.addLogEntry('participant',
                    `${eventData.institution_name} bid $${(eventData.amount / 1000000).toFixed(1)}M @ ${eventData.spread}bps (${(eventData.cumulative_subscription * 100).toFixed(0)}% subscribed)`,
                    eventData.reasoning,
                    eventData.sentiment);
                break;

            case 'BidRejected':
                this.addLogEntry('participant', `⏰ ${eventData.institution_name} rejected: ${eventData.reason}`);
                break;

            case 'BiddingCompleted':
                this.setStage('participant', 'complete');
                this.addLogEntry('participant',
                    `Bidding complete: ${eventData.total_bids} bids, ${(eventData.subscription_rate * 100).toFixed(0)}% subscribed`);
                break;

            case 'AuctionRoundCompleted':
                this.setStage('negotiation', 'active');
                this.addLogEntry('negotiation',
                    `Round ${eventData.round_number}/${eventData.max_rounds}: ${eventData.current_spread}bps, ${(eventData.subscription_rate * 100).toFixed(0)}% subscribed`);
                break;

            case 'AuctionCompleted':
                this.setStage('negotiation', 'complete');
                this.addLogEntry('negotiation',
                    `Auction closed: ${eventData.final_spread}bps (${eventData.spread_improvement}bps improvement), ${eventData.winning_bids} winners`);
                break;

            case 'AuctionFailed':
                this.setStage('negotiation', 'complete');
                this.addLogEntry('negotiation', `⚠️ Auction failed: ${eventData.reason} (${(eventData.final_subscription * 100).toFixed(0)}% subscribed)`);
                break;

            case 'SettlementStageCompleted':
                this.setStage('settlement', 'active');
                this.addLogEntry('settlement', `Stage ${eventData.stage_number}/${eventData.total_stages}: ${eventData.stage_name} complete`,
                    eventData.reasoning, eventData.sentiment);
                break;

            case 'SettlementCompleted':
                this.setStage('settlement', 'complete');
                this.addLogEntry('settlement', `Settlement complete: ${eventData.allocations_confirmed} allocations, ${eventData.documents_signed || 0} docs signed`,
                    eventData.reasoning, eventData.sentiment);
                break;

            case 'SettlementFailed':
                this.setStage('settlement', 'complete');
                this.addLogEntry('settlement', `⚠️ Settlement failed at ${eventData.stage_name}: ${eventData.reason}`);
                break;

            case 'PaymentProcessed':
                this.setStage('payment', 'active');
                this.addLogEntry('payment', `${eventData.payment_type}: ${eventData.completed || eventData.payments_processed}/${eventData.total || eventData.total_payments} processed ($${(eventData.amount_collected / 1000000).toFixed(2)}M)`,
                    eventData.reasoning, eventData.sentiment);
                break;

            case 'PaymentFailed':
                this.addLogEntry('payment', `⚠️ Payment failed: ${eventData.payer_institution} $${(eventData.amount / 1000000).toFixed(2)}M: ${eventData.reason}`);
                break;

            case 'SyndicationCompleted':
                this.setStage('payment', 'complete');
                this.addLogEntry('system', `✅ Syndication complete: $${(eventData.total_syndicated / 1000000).toFixed(0)}M`,
                    eventData.reasoning, eventData.sentiment);
                break;

            case 'WorkflowPaused':
                this.addLogEntry('system', `⏸ PAUSED before ${eventData.next_node}. Click Step or Run to continue.`);
                this.setStage(this.getStageIdFromNodeName(eventData.next_node), 'active');
                break;

            case 'syndication_created':
                this.activeSyndication = this.normalizeSyndication(message.data);
                this.setStage('originator', 'active');
                break;

            case 'syndication_started':
                this.addLogEntry('system', message.message);
                break;

            case 'pong':
                break;

            default:
                console.log('Unknown event type:', eventType);
        }

        this.renderWorkflow();
    },

    /**
     * Map internal node name to UI stage ID
     */
    getStageIdFromNodeName(nodeName) {
        const map = {
            'originator': 'originator',
            'participants': 'participant',
            'negotiation': 'negotiation',
            'payment': 'payment',
            'settlement': 'settlement',
            'failed': 'negotiation', // If auction fails, it's still part of negotiation
            'settlement_failed': 'settlement' // If settlement fails, it's still part of settlement
        };
        return map[nodeName] || 'originator';
    },

    /**
     * Handle simulation start
     */
    onSimulationStart() {
        this.resetWorkflow();
        this.addLogEntry('system', 'Simulation started - agents ready');
    },

    /**
     * Handle new syndication from auto-generator
     */
    onNewSyndication(syndication) {
        this.activeSyndication = this.normalizeSyndication(syndication);
        this.resetWorkflow();
        this.setStage('originator', 'complete');

        const s = this.activeSyndication;
        this.addLogEntry('originator', `${s.originator} announced ${s.borrower} $${s.amount}M`);

        // Simulate workflow progression if not connected to Python server
        if (!this.isConnected) {
            this.isSimulatedMode = true;
            this.simulateWorkflow(this.activeSyndication);
        }

        this.renderWorkflow();
    },

    /**
     * Set specific syndication for viewing (Manual Filter)
     */
    setViewingSyndication(synd) {
        this.activeSyndication = synd;
        this.resetWorkflow();

        // Map phase to completed stages
        const phase = synd.phase || 'open';

        if (phase !== 'open') this.setStage('originator', 'complete');
        else this.setStage('originator', 'active');

        if (['negotiating', 'closing', 'closed', 'completed'].includes(phase) || synd.status === 'negotiating') {
            this.setStage('participant', 'complete');
            this.setStage('negotiation', 'active');
        }

        if (['closing', 'closed', 'completed'].includes(phase)) {
            this.setStage('negotiation', 'complete');
            this.setStage('settlement', 'active');
        }

        if (['closed', 'completed'].includes(phase)) {
            this.setStage('settlement', 'complete');
            this.setStage('payment', 'active');
        }

        if (synd.status === 'completed') {
            this.setStage('payment', 'complete');
        }

        this.addLogEntry('system', `Viewing orchestration for ${synd.id}`);
        this.renderWorkflow();
    },

    /**
     * Simulate workflow when Python server is not connected
     * Uses deterministic mock data instead of random values
     */
    simulateWorkflow(syndication) {
        const stages = ['participant', 'negotiation', 'settlement', 'payment'];
        let delay = 500;

        // Mock workflow data (deterministic, not random)
        const mockData = {
            participant: {
                bidCount: 7,
                subscriptionRate: 105
            },
            negotiation: {
                rounds: 3,
                spreadImprovement: 15
            },
            settlement: {
                allocations: 5
            }
        };

        stages.forEach((stage, i) => {
            setTimeout(() => {
                this.setStage(stage, 'active');
                this.addLogEntry(stage, this.getStageMessage(stage, syndication, mockData));
                this.renderWorkflow();

                // Complete after a bit
                setTimeout(() => {
                    this.setStage(stage, 'complete');
                    this.renderWorkflow();
                }, 300);
            }, delay * (i + 1));
        });
    },

    /**
     * Get appropriate message for a workflow stage
     * Uses mock data object instead of Math.random()
     */
    getStageMessage(stage, synd, mockData = {}) {
        const messages = {
            participant: `${mockData.participant?.bidCount || 'Several'} participants submitted bids (${mockData.participant?.subscriptionRate || '~100'}% subscribed)`,
            negotiation: `Dutch auction completed in ${mockData.negotiation?.rounds || 3} rounds at ${synd.spread || 'clearing'} bps`,
            settlement: `Allocations confirmed for ${mockData.settlement?.allocations || 'all'} winning bidders`,
            payment: `Processing commitment fees via x402 USDC`
        };
        return `[SIMULATED] ${messages[stage] || 'Processing...'}`;
    },

    /**
     * Set workflow stage status
     */
    setStage(stageId, status) {
        const stageIndex = this.workflowStages.findIndex(s => s.id === stageId);
        if (stageIndex >= 0) {
            this.workflowStages[stageIndex].status = status;

            // Mark previous stages as complete
            for (let i = 0; i < stageIndex; i++) {
                if (!this.workflowStages[i].status || this.workflowStages[i].status === 'pending') {
                    this.workflowStages[i].status = 'complete';
                }
            }
        }
    },

    /**
     * Reset workflow to initial state
     */
    async resetWorkflow() {
        this.workflowStages.forEach(s => s.status = 'pending');
        this.workflowLog = [];
        this.addLogEntry('system', 'Resetting orchestration engine...');

        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({ type: 'reset_engine' }));
        }

        // Also try REST endpoint for full persistence clear
        await API.post('server', '/orchestrator/reset', {});

        this.renderWorkflow();
    },

    /**
     * Add entry to workflow log including optional reasoning and sentiment
     */
    addLogEntry(source, message, reasoning = null, sentiment = 0.5) {
        const entry = {
            timestamp: new Date(),
            source,
            message,
            reasoning,
            sentiment
        };
        this.workflowLog.push(entry);

        // Keep log manageable
        if (this.workflowLog.length > 50) {
            this.workflowLog.shift();
        }
    },

    /**
     * Update connection status in UI
     */
    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('agent-connection-status');
        if (statusEl) {
            statusEl.innerHTML = connected
                ? '<span class="status-connected">● Connected to LangGraph</span>'
                : '<span class="status-disconnected">○ Disconnected (Simulated Mode)</span>';
        }
    },

    /**
     * Render the orchestration page
     */
    render(container) {
        container.innerHTML = `
            <div class="agent-orchestration-page">
                <div class="page-header">
                    <h2 class="page-title">Agent Orchestration</h2>
                    <div id="agent-connection-status" class="connection-status">
                        ${this.isConnected
                ? '<span class="status-connected">● Connected to LangGraph</span>'
                : '<span class="status-disconnected">○ Disconnected (Simulated Mode)</span>'
            }
                    </div>
                </div>

                <div class="workflow-diagram">
                    ${this.renderWorkflowDiagram()}
                </div>

                <div class="orchestration-controls">
                    <button class="btn-control" id="btn-run-syndication" title="Start new LangGraph run">▶ Run Engine</button>
                    <button class="btn-control btn-secondary" id="btn-reset-engine" title="Reset all stages">🔄 Reset</button>
                    <button class="btn-control btn-secondary" id="btn-step-engine" title="Execute next node only">⚡ Step</button>
                    <div class="control-spacer"></div>
                    <label class="toggle-control">
                        <input type="checkbox" id="check-manual-mode" ${this.manualMode ? 'checked' : ''}>
                        <span class="toggle-label">Manual Step Mode</span>
                    </label>
                </div>

                <div class="orchestration-grid">
                    <div class="workflow-log-section">
                        <div class="section-header-flex">
                            <h3>Workflow Activity</h3>
                            <button class="btn-xs" id="btn-clear-log">Clear</button>
                        </div>
                        <div class="workflow-log" id="workflow-log">
                            ${this.renderWorkflowLog()}
                        </div>
                    </div>

                    <div class="active-syndication-section">
                        <h3>Active Syndication</h3>
                        <div id="active-syndication-container">
                            ${this.renderActiveSyndication()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render workflow diagram
     */
    renderWorkflowDiagram() {
        return `
            <div class="workflow-stages">
                ${this.workflowStages.map((stage, i) => {
            const status = stage.status || 'pending';
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            const tooltip = `${stage.name}: ${statusText}\n${stage.description}`;

            return `
                    <div class="workflow-stage ${status}" title="${tooltip}" data-status="${status}" data-stage="${stage.id}">
                        <div class="stage-icon">${stage.icon}</div>
                        <div class="stage-name">${stage.name}</div>
                        <div class="stage-status-indicator"></div>
                    </div>
                    ${i < this.workflowStages.length - 1 ? '<div class="workflow-connector"></div>' : ''}
                `;
        }).join('')}
            </div>
            <div class="workflow-descriptions">
                ${this.workflowStages.map(stage => `
                    <div class="stage-desc ${stage.status || 'pending'}">${stage.description}</div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Render workflow log
     */
    renderWorkflowLog() {
        if (this.workflowLog.length === 0) {
            return '<p class="no-log">No activity yet. Start the simulation or trigger a syndication manually.</p>';
        }

        return this.workflowLog.slice(-20).map(entry => {
            const isInsight = !!entry.reasoning;
            return `
                <div class="log-entry ${entry.source} ${isInsight ? 'insight' : ''}">
                    <span class="log-time">${entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span class="log-source">${entry.source}</span>
                    <div class="log-content">
                        <span class="log-message">${entry.message}</span>
                        ${entry.reasoning ? `<span class="log-reasoning">💡 ${entry.reasoning}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Render active syndication info
     * Uses normalized data from normalizeSyndication()
     */
    renderActiveSyndication() {
        if (!this.activeSyndication) {
            return '<p class="no-syndication">No active syndication. Waiting for next deal...</p>';
        }

        const s = this.activeSyndication;
        const modeIndicator = this.isSimulatedMode
            ? '<div class="simulated-badge">SIMULATED</div>'
            : '';

        return `
            <div class="syndication-info">
                ${modeIndicator}
                <div class="syndication-id">${s.id}</div>
                <div class="syndication-borrower">${s.borrower}</div>
                <div class="syndication-details">
                    <div><strong>Amount:</strong> $${typeof s.amount === 'number' ? s.amount.toLocaleString() : s.amount}M</div>
                    <div><strong>Rating:</strong> ${s.rating}</div>
                    <div><strong>Spread:</strong> ${s.spread !== null ? s.spread + 'bps' : 'TBD'}</div>
                    <div><strong>Industry:</strong> ${s.industry}</div>
                    <div><strong>Status:</strong> ${s.status}</div>
                </div>
            </div>
        `;
    },

    /**
     * Re-render just the workflow parts
     */
    renderWorkflow() {
        const diagramEl = document.querySelector('.workflow-diagram');
        const logEl = document.getElementById('workflow-log');
        const activeContainer = document.getElementById('active-syndication-container');

        if (diagramEl) {
            diagramEl.innerHTML = this.renderWorkflowDiagram();
        }
        if (logEl) {
            logEl.innerHTML = this.renderWorkflowLog();
            // Auto-scroll to bottom for live monitor experience
            logEl.scrollTop = logEl.scrollHeight;
        }
        if (activeContainer) {
            activeContainer.innerHTML = this.renderActiveSyndication();
        }
    },

    /**
     * Trigger a manual syndication run
     */
    triggerManualRun() {
        const stepMode = !!this.manualMode;
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'run_syndication',
                originator_id: 'OA-001',
                step_mode: stepMode
            }));
            this.addLogEntry('system', `Manual syndication triggered via LangGraph (Step Mode: ${stepMode ? 'ON' : 'OFF'})`);
        } else {
            API.post('server', '/syndications/run', { originator_id: 'OA-001' });
            this.addLogEntry('system', `Manual syndication triggered via API (Step Mode: ${stepMode ? 'ON' : 'OFF'})`);
        }
        this.renderWorkflow();
    }
};

// Add orchestration styles
const orchestrationStyles = document.createElement('style');
orchestrationStyles.textContent = `
    .agent-orchestration-page { padding: 1rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .connection-status { font-size: 0.875rem; }
    .status-connected { color: var(--success); }
    .status-disconnected { color: var(--warning); }
    
    .orchestration-controls { 
        display: flex; 
        align-items: center; 
        gap: 0.75rem; 
        background: var(--bg-card); 
        padding: 0.75rem 1rem; 
        border: 1px solid var(--border-color); 
        border-radius: var(--radius-lg);
        margin-bottom: 1.5rem;
    }
    .control-spacer { flex: 1; }
    .btn-control { 
        padding: 0.5rem 1rem; 
        font-size: 0.8125rem; 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
    }
    .toggle-control { 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
        cursor: pointer; 
        font-size: 0.8125rem; 
        color: var(--text-secondary); 
    }
    .toggle-control input { cursor: pointer; }
    .section-header-flex { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 1rem; 
    }
    .section-header-flex h3 { margin-bottom: 0 !important; }
    
    .workflow-diagram { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 1.5rem; }
    .workflow-stages { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 1rem; }
    .workflow-stage { display: flex; flex-direction: column; align-items: center; padding: 1rem; border-radius: var(--radius-lg); min-width: 120px; transition: all 0.3s ease; }
    .workflow-stage.pending { opacity: 0.5; }
    .workflow-stage.active { background: var(--info-bg); border: 2px solid var(--info); animation: pulseStage 1.5s infinite; }
    .workflow-stage.complete { background: var(--success-bg); }
    .stage-icon { font-size: 2rem; margin-bottom: 0.5rem; }
    .stage-name { font-size: 0.8125rem; font-weight: 600; text-align: center; }
    .stage-status-indicator { width: 8px; height: 8px; border-radius: 50%; margin-top: 0.5rem; }
    .workflow-stage.pending .stage-status-indicator { background: var(--text-muted); }
    .workflow-stage.active .stage-status-indicator { background: var(--info); animation: blink 1s infinite; }
    .workflow-stage.complete .stage-status-indicator { background: var(--success); }
    
    .workflow-connector { width: 40px; height: 2px; background: var(--border-color); }
    .workflow-stage.complete + .workflow-connector { background: var(--success); }
    
    .workflow-descriptions { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .stage-desc { font-size: 0.75rem; color: var(--text-muted); text-align: center; max-width: 150px; }
    .stage-desc.active { color: var(--info); }
    .stage-desc.complete { color: var(--success); }
    
    @keyframes pulseStage { 
        0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); border-color: var(--info); } 
        70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); border-color: var(--primary-light); } 
        100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); border-color: var(--info); } 
    }
    @keyframes blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
    
    .orchestration-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .workflow-log-section, .active-syndication-section { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1rem; }
    .workflow-log-section h3, .active-syndication-section h3 { font-size: 0.875rem; margin-bottom: 1rem; color: var(--text-secondary); }
    .workflow-log { max-height: 350px; overflow-y: auto; scroll-behavior: smooth; }
    .log-entry { display: grid; grid-template-columns: 80px 80px 1fr; gap: 0.5rem; padding: 0.625rem 0.5rem; font-size: 0.8125rem; border-bottom: 1px solid var(--border-color); transition: background 0.2s ease; }
    .log-entry:hover { background: var(--bg-card-hover); }
    .log-entry.insight { border-left: 3px solid var(--info); background: var(--info-bg); }
    .log-time { color: var(--text-muted); font-family: monospace; }
    .log-source { font-weight: 500; text-transform: capitalize; }
    .log-source.originator { color: var(--primary-light); }
    .log-source.participant { color: var(--warning); }
    .log-source.negotiation { color: #8B5CF6; }
    .log-source.settlement { color: #EC4899; }
    .log-source.payment { color: var(--success); }
    .log-source.system { color: var(--text-muted); }
    .log-content { display: flex; flex-direction: column; gap: 0.25rem; }
    .log-message { color: var(--text-primary); font-weight: 500; }
    .log-reasoning { font-size: 0.75rem; color: var(--text-secondary); font-style: italic; line-height: 1.4; }
    .no-log, .no-syndication { color: var(--text-muted); font-size: 0.875rem; }
    
    .syndication-info { background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); position: relative; }
    .syndication-id { font-size: 0.75rem; color: var(--primary-light); margin-bottom: 0.25rem; }
    .syndication-borrower { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; }
    .syndication-details { font-size: 0.875rem; display: grid; gap: 0.25rem; }
    
    .simulated-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: var(--warning); color: #000; font-size: 0.625rem; font-weight: 700; padding: 0.125rem 0.375rem; border-radius: 2px; letter-spacing: 0.5px; }
    
    .orchestration-actions { display: flex; gap: 1rem; }
`;
document.head.appendChild(orchestrationStyles);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AgentOrchestration.init();
});

// Export
window.AgentOrchestration = AgentOrchestration;
