/**
 * SyndiMatch Agent Orchestration Page
 * Visualizes LangGraph workflow and connects to Python agent server
 */

const AgentOrchestration = {
    // WebSocket connection to Python agent server
    ws: null,
    wsUrl: 'ws://localhost:8000/ws',
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,

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

    /**
     * Initialize the orchestration page
     */
    init() {
        this.connectWebSocket();

        // Listen for simulation events
        if (window.SimulationEngine) {
            SimulationEngine.on('simulationStart', () => this.onSimulationStart());
            SimulationEngine.on('newSyndication', (data) => this.onNewSyndication(data));
        }

        // Listen for manual syndication triggers
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));

        console.log('🤖 Agent Orchestration initialized');
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

                // Subscribe to updates
                this.ws.send(JSON.stringify({ type: 'subscribe' }));
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            };

            this.ws.onclose = () => {
                console.log('❌ Disconnected from Agent Server');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.warn('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
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
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), 3000);
        }
    },

    /**
     * Handle message from Python agent server
     */
    handleServerMessage(message) {
        console.log('📨 Agent message:', message);

        switch (message.type) {
            case 'subscribed':
                this.addLogEntry('system', 'Connected to LangGraph agents');
                break;

            case 'syndication_created':
                this.activeSyndication = message.data;
                this.setStage('originator', 'active');
                this.addLogEntry('originator', `Created syndication ${message.data.syndication_id}`);
                break;

            case 'syndication_started':
                this.addLogEntry('system', message.message);
                break;

            case 'bidding_started':
                this.setStage('participant', 'active');
                this.addLogEntry('participant', 'Participants evaluating opportunity...');
                break;

            case 'bid_received':
                this.addLogEntry('participant', `${message.data.participant} bid $${message.data.amount}M`);
                break;

            case 'auction_round':
                this.setStage('negotiation', 'active');
                this.addLogEntry('negotiation', `Round ${message.data.round}: ${message.data.spread}bps, ${message.data.subscription}% subscribed`);
                break;

            case 'allocation_complete':
                this.setStage('settlement', 'active');
                this.addLogEntry('settlement', `Allocated ${message.data.allocations} participants`);
                break;

            case 'payment_processed':
                this.setStage('payment', 'active');
                this.addLogEntry('payment', `Payment ${message.data.payment_id} processed`);
                break;

            case 'syndication_complete':
                this.setStage('payment', 'complete');
                this.addLogEntry('system', `Syndication complete: $${message.data.total_committed}M committed`);
                break;

            case 'pong':
                // Heartbeat response
                break;

            default:
                console.log('Unknown message type:', message.type);
        }

        this.renderWorkflow();
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
        this.activeSyndication = syndication;
        this.resetWorkflow();
        this.setStage('originator', 'complete');
        this.addLogEntry('originator', `${syndication.originatorName || 'Originator'} announced ${syndication.borrower} $${syndication.amount}M`);

        // Simulate workflow progression if not connected to Python server
        if (!this.isConnected) {
            this.simulateWorkflow(syndication);
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
     */
    simulateWorkflow(syndication) {
        const stages = ['participant', 'negotiation', 'settlement', 'payment'];
        let delay = 500;

        stages.forEach((stage, i) => {
            setTimeout(() => {
                this.setStage(stage, 'active');
                this.addLogEntry(stage, this.getStageMessage(stage, syndication));
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
     */
    getStageMessage(stage, synd) {
        const messages = {
            participant: `${Math.floor(Math.random() * 5 + 5)} participants submitted bids`,
            negotiation: `Dutch auction completed at ${synd.spread}bps`,
            settlement: `Allocations confirmed for ${synd.syndicationTarget}% target`,
            payment: `Processing commitment fees via x402 USDC`
        };
        return messages[stage] || 'Processing...';
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
    resetWorkflow() {
        this.workflowStages.forEach(s => s.status = 'pending');
        this.workflowLog = [];
    },

    /**
     * Add entry to workflow log
     */
    addLogEntry(source, message) {
        const entry = {
            timestamp: new Date(),
            source,
            message
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

                <div class="orchestration-grid">
                    <div class="workflow-log-section">
                        <h3>Workflow Activity</h3>
                        <div class="workflow-log" id="workflow-log">
                            ${this.renderWorkflowLog()}
                        </div>
                    </div>

                    <div class="active-syndication-section">
                        <h3>Active Syndication</h3>
                        ${this.renderActiveSyndication()}
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
                ${this.workflowStages.map((stage, i) => `
                    <div class="workflow-stage ${stage.status || 'pending'}">
                        <div class="stage-icon">${stage.icon}</div>
                        <div class="stage-name">${stage.name}</div>
                        <div class="stage-status-indicator"></div>
                    </div>
                    ${i < this.workflowStages.length - 1 ? '<div class="workflow-connector"></div>' : ''}
                `).join('')}
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

        return this.workflowLog.slice(-15).reverse().map(entry => `
            <div class="log-entry ${entry.source}">
                <span class="log-time">${entry.timestamp.toLocaleTimeString()}</span>
                <span class="log-source">${entry.source}</span>
                <span class="log-message">${entry.message}</span>
            </div>
        `).join('');
    },

    /**
     * Render active syndication info
     */
    renderActiveSyndication() {
        if (!this.activeSyndication) {
            return '<p class="no-syndication">No active syndication. Waiting for next deal...</p>';
        }

        const s = this.activeSyndication;
        return `
            <div class="syndication-info">
                <div class="syndication-id">${s.id || s.syndication_id}</div>
                <div class="syndication-borrower">${s.borrower || s.loan_details?.borrower_name}</div>
                <div class="syndication-details">
                    <div><strong>Amount:</strong> $${s.amount || s.loan_details?.total_amount}M</div>
                    <div><strong>Rating:</strong> ${s.rating || s.loan_details?.credit_rating || 'BBB'}</div>
                    <div><strong>Spread:</strong> ${s.spread || s.loan_details?.spread || 420}bps</div>
                    <div><strong>Status:</strong> ${s.status || 'Active'}</div>
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
        const syndEl = document.querySelector('.active-syndication-section');

        if (diagramEl) {
            diagramEl.innerHTML = this.renderWorkflowDiagram();
        }
        if (logEl) {
            logEl.innerHTML = this.renderWorkflowLog();
        }
        if (syndEl) {
            syndEl.innerHTML = `<h3>Active Syndication</h3>${this.renderActiveSyndication()}`;
        }
    },

    /**
     * Trigger a manual syndication run
     */
    triggerManualRun() {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'run_syndication',
                originator_id: 'OA-001'
            }));
            this.addLogEntry('system', 'Manual syndication triggered via LangGraph');
        } else {
            // Use auto-generator
            if (window.AutoGenerator) {
                const synd = AutoGenerator.generateSyndication(SimulationEngine?.getCurrentDate() || new Date());
                this.addLogEntry('system', 'Manual syndication triggered (simulated)');
            }
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
    
    @keyframes pulseStage { 0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.3); } 50% { box-shadow: 0 0 15px 5px rgba(37, 99, 235, 0.2); } }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    
    .orchestration-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .workflow-log-section, .active-syndication-section { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1rem; }
    .workflow-log-section h3, .active-syndication-section h3 { font-size: 0.875rem; margin-bottom: 1rem; color: var(--text-secondary); }
    .workflow-log { max-height: 300px; overflow-y: auto; }
    .log-entry { display: grid; grid-template-columns: 80px 80px 1fr; gap: 0.5rem; padding: 0.5rem; font-size: 0.8125rem; border-bottom: 1px solid var(--border-color); }
    .log-time { color: var(--text-muted); font-family: monospace; }
    .log-source { font-weight: 500; text-transform: capitalize; }
    .log-source.originator { color: var(--primary-light); }
    .log-source.participant { color: var(--warning); }
    .log-source.negotiation { color: #8B5CF6; }
    .log-source.settlement { color: #EC4899; }
    .log-source.payment { color: var(--success); }
    .log-source.system { color: var(--text-muted); }
    .log-message { color: var(--text-secondary); }
    .no-log, .no-syndication { color: var(--text-muted); font-size: 0.875rem; }
    
    .syndication-info { background: var(--bg-main); padding: 1rem; border-radius: var(--radius-md); }
    .syndication-id { font-size: 0.75rem; color: var(--primary-light); margin-bottom: 0.25rem; }
    .syndication-borrower { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; }
    .syndication-details { font-size: 0.875rem; display: grid; gap: 0.25rem; }
    
    .orchestration-actions { display: flex; gap: 1rem; }
`;
document.head.appendChild(orchestrationStyles);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AgentOrchestration.init();
});

// Export
window.AgentOrchestration = AgentOrchestration;
