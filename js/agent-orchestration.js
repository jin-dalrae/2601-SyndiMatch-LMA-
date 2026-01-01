/**
 * SyndiMatch Agent Orchestration
 * Manages WebSocket connection to Python Agent Server and visualizes workflow
 */

const AgentOrchestration = {
    // Configuration
    ws: null,
    wsUrl: Config?.WS_URL || 'ws://localhost:8000/ws',
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    baseReconnectDelay: 1000,

    // State
    isConnected: false,
    activeSyndication: null,
    workflowLog: [],

    // Workflow Definitions
    workflowStages: [
        { id: 'originator', name: 'Originator Agent', icon: '🏦', description: 'Generates syndication opportunity and broadcasts to participants' },
        { id: 'participant', name: 'Participant Agents', icon: '🏢', description: 'Evaluate opportunity and submit bids based on risk profile' },
        { id: 'negotiation', name: 'Negotiation Agent', icon: '⚡', description: 'Runs Dutch auction to determine clearing spread' },
        { id: 'settlement', name: 'Settlement Agent', icon: '📋', description: 'Confirms allocations and generates documentation' },
        { id: 'payment', name: 'Payment Agent', icon: '💰', description: 'Processes x402 payments and records transactions' }
    ],

    /**
     * Initialize Module
     */
    init() {
        if (this.initialized) return;
        console.log('🤖 Initializing Agent Orchestration...');

        // Connect WS
        if (Config?.ENABLE_WEBSOCKET) {
            this.connectWebSocket();
        }

        // Listeners
        this.setupEventListeners();

        this.initialized = true;
    },

    /**
     * Establish WebSocket Connection
     */
    connectWebSocket() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Agent Server Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                AppState.set('agentConnected', true);
                this.updateUIStatus(true);

                // Subscribe
                this.ws.send(JSON.stringify({ type: 'subscribe', client: 'web-ui' }));
            };

            this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));

            this.ws.onclose = () => {
                if (this.isConnected) console.log('❌ Agent Server Disconnected');
                this.isConnected = false;
                AppState.set('agentConnected', false);
                this.updateUIStatus(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (e) => {
                // Silent error on connection refusal to avoid console spam
                if (this.isConnected) console.warn('WS Error:', e);
            };

        } catch (e) {
            console.warn('WS Connection Failed:', e);
            this.scheduleReconnect();
        }
    },

    /**
     * Exponential Backoff Reconnect
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('⚠️ Max reconnect attempts reached. Agent features limited.');
            return;
        }

        const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;

        setTimeout(() => {
            if (!this.isConnected) this.connectWebSocket();
        }, delay);
    },

    /**
     * Handle Incoming Messages
     */
    handleMessage(msg) {
        if (Config?.DEBUG) console.log('📨 Agent Msg:', msg);

        // Log to workflow
        if (msg.log) {
            this.addLogEntry(msg.source || 'system', msg.log);
        }

        switch (msg.type) {
            case 'syndication_created':
                this.handleNewSyndication(msg.data);
                break;
            case 'bid_placed':
                this.addLogEntry('participant', `${msg.data.participant} placed bid: $${msg.data.amount}M`);
                break;
            case 'market_update':
                this.handleMarketUpdate(msg.data);
                break;
            case 'agent_update':
                // General agent status update
                break;
        }

        this.renderWorkflow();
    },

    handleNewSyndication(data) {
        this.activeSyndication = data;
        this.resetWorkflow();
        this.setStage('originator', 'complete');
        this.setStage('participant', 'active');

        // Sync with AppState
        // AppState.update('syndications', data);
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: data }));
    },

    handleMarketUpdate(data) {
        if (window.MarketConditions) {
            MarketConditions.currentCondition = data.condition;
            AppState.set('marketConditions', data.condition);
        }
    },

    /**
     * Setup Local Event Listeners (Simulation Mode)
     */
    setupEventListeners() {
        // Listen for internal events (Simulation or AutoGenerator)
        window.addEventListener('newSyndication', (e) => {
            if (!this.isConnected) {
                // If not connected to real backend, simulate orchestration
                this.onSimulatedSyndication(e.detail);
            }
        });

        window.addEventListener('bidPlaced', (e) => {
            if (!this.isConnected) {
                this.addLogEntry('participant', `${e.detail.participantName} bid $${e.detail.amount}M`);
                this.renderWorkflow();
            }
        });
    },

    /**
     * Simulate Workflow (Fallback)
     */
    onSimulatedSyndication(synd) {
        this.activeSyndication = synd;
        this.resetWorkflow();
        this.setStage('originator', 'complete');
        this.addLogEntry('originator', `Announced: ${synd.borrower} ($${synd.amount}M)`);

        this.setStage('participant', 'active');

        // Auto-advance visualization based on syndication status
        this.renderWorkflow();
    },

    // ========================================
    // Logging & Visualization
    // ========================================

    addLogEntry(source, message) {
        this.workflowLog.unshift({
            time: new Date(),
            source,
            message
        });
        if (this.workflowLog.length > 50) this.workflowLog.pop();

        // Update UI if visible
        const logContainer = document.getElementById('workflow-log');
        if (logContainer) {
            logContainer.innerHTML = this.renderLogEntries();
        }
    },

    setStage(stageId, status) {
        const stage = this.workflowStages.find(s => s.id === stageId);
        if (stage) {
            stage.status = status;
            this.renderWorkflow();
        }
    },

    resetWorkflow() {
        this.workflowStages.forEach(s => s.status = 'pending');
        this.workflowLog = [];
    },

    updateUIStatus(connected) {
        const el = document.getElementById('agent-connection-status');
        if (el) {
            el.innerHTML = connected
                ? '<span class="text-green-500">● Live Agents</span>'
                : '<span class="text-gray-500">○ Simulated</span>';
            el.className = connected ? 'status-connected' : 'status-disconnected';
        }
    },

    // ========================================
    // Rendering
    // ========================================

    render(container) {
        if (!container) return;

        container.innerHTML = `
            <div class="agent-orchestration-page">
                <div class="header-section">
                    <h2>Agent Orchestration</h2>
                    <div id="agent-connection-status">${this.isConnected ? '● Live' : '○ Simulated'}</div>
                </div>
                
                <!-- Workflow Diagram -->
                <div class="workflow-diagram">
                    ${this.renderStages()}
                </div>
                
                <!-- Log & Details -->
                <div class="orch-split">
                    <div class="log-panel">
                        <h3>Activity Log</h3>
                        <div id="workflow-log" class="workflow-log">
                            ${this.renderLogEntries()}
                        </div>
                    </div>
                    <div class="details-panel">
                        <h3>Active Context</h3>
                        ${this.renderActiveContext()}
                    </div>
                </div>
            </div>
        `;

        this.injectStyles();
    },

    renderStages() {
        return this.workflowStages.map((s, i) => `
            <div class="stage-node ${s.status || 'pending'}">
                <div class="icon">${s.icon}</div>
                <div class="label">${s.name}</div>
                <div class="status-dot"></div>
            </div>
            ${i < this.workflowStages.length - 1 ? '<div class="connector"></div>' : ''}
        `).join('');
    },

    renderLogEntries() {
        if (!this.workflowLog.length) return '<div class="empty-log">Waiting for activity...</div>';
        return this.workflowLog.map(l => `
            <div class="log-entry ${l.source}">
                <span class="time">${l.time.toLocaleTimeString()}</span>
                <span class="source">[${l.source}]</span>
                <span class="msg">${l.message}</span>
            </div>
        `).join('');
    },

    renderActiveContext() {
        if (!this.activeSyndication) return '<div class="empty-state">No Active Syndication</div>';
        const s = this.activeSyndication;
        return `
            <div class="context-card">
                <h4>${s.borrower}</h4>
                <div class="metrics">
                    <div>Amount: $${s.amount}M</div>
                    <div>Spread: ${s.spread}bps</div>
                    <div>ESG: ${s.esg_score || 'N/A'}</div>
                </div>
                <div class="progress-bar">
                    <div class="fill" style="width: ${s.subscription || 0}%"></div>
                </div>
                <div class="sub-text">${s.subscription || 0}% Subscribed</div>
            </div>
        `;
    },

    renderWorkflow() {
        const diagram = document.querySelector('.workflow-diagram');
        if (diagram) diagram.innerHTML = this.renderStages();

        const log = document.getElementById('workflow-log');
        if (log) log.innerHTML = this.renderLogEntries();
    },

    injectStyles() {
        if (document.getElementById('orch-css')) return;
        const css = `
            .agent-orchestration-page { padding: 20px; color: #fff; }
            .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px; }
            .workflow-diagram { display: flex; justify-content: center; align-items: center; padding: 30px; background: #1a1a1a; border-radius: 8px; margin-bottom: 20px; border: 1px solid #333; overflow-x: auto;}
            .stage-node { display: flex; flex-direction: column; align-items: center; min-width: 100px; opacity: 0.5; transition: all 0.3s; }
            .stage-node.active { opacity: 1; transform: scale(1.1); color: #60a5fa; }
            .stage-node.complete { opacity: 1; color: #34d399; }
            .stage-node .icon { font-size: 24px; margin-bottom: 8px; }
            .stage-node .label { font-size: 12px; font-weight: 600; text-align: center; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; margin-top: 8px; }
            .stage-node.active .status-dot { background: #60a5fa; box-shadow: 0 0 8px #60a5fa; }
            .stage-node.complete .status-dot { background: #34d399; }
            .connector { flex: 1; height: 2px; background: #333; margin: 0 10px; min-width: 20px; max-width: 50px; }
            .orch-split { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
            .log-panel, .details-panel { background: #1a1a1a; padding: 15px; border-radius: 8px; border: 1px solid #333; height: 300px; overflow-y: auto; }
            .log-entry { font-size: 12px; margin-bottom: 6px; border-bottom: 1px solid #2a2a2a; padding-bottom: 4px; font-family: monospace; }
            .log-entry .time { color: #666; margin-right: 8px; }
            .log-entry .source { color: #888; margin-right: 8px; font-weight: bold; }
            .log-entry.originator .source { color: #f472b6; }
            .log-entry.participant .source { color: #60a5fa; }
            .context-card h4 { margin: 0 0 10px 0; color: #fff; }
            .metrics { display: grid; grid-template-columns: 1fr; gap: 5px; font-size: 13px; color: #ccc; margin-bottom: 10px; }
            .progress-bar { height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
            .progress-bar .fill { height: 100%; background: #34d399; transition: width 0.5s; }
            .sub-text { font-size: 11px; color: #888; text-align: right; margin-top: 4px; }
            .status-connected { color: #34d399; font-weight: bold; }
            .status-disconnected { color: #9ca3af; }
        `;
        const style = document.createElement('style');
        style.id = 'orch-css';
        style.textContent = css;
        document.head.appendChild(style);
    }
};

window.AgentOrchestration = AgentOrchestration;
