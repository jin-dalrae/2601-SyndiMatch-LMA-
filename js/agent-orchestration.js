/**
 * SyndiMatch Agent Orchestration
 * Visualizes multi-agent workflow with real-time simulation integration
 */

const AgentOrchestration = {
    // Configuration
    ws: null,
    wsUrl: Config?.WS_URL || 'ws://localhost:8000/ws',
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    baseReconnectDelay: 1000,
    usePolling: Config?.USE_POLLING || false,
    pollIntervalMs: 3000,
    pollTimer: null,
    seenEventIds: new Set(),

    // State
    activeSyndication: null,
    workflowLog: [],
    manualMode: false,
    initialized: false,

    // Workflow Definitions
    workflowStages: [
        { id: 'originator', name: 'Originator', icon: '🏦', description: 'Opens syndication & broadcasts deal', status: 'pending' },
        { id: 'participant', name: 'Participants', icon: '🏢', description: '13 AI agents evaluate & bid', status: 'pending' },
        { id: 'negotiation', name: 'Negotiation', icon: '⚡', description: 'Dutch auction for clearing spread', status: 'pending' },
        { id: 'settlement', name: 'Settlement', icon: '📋', description: 'Confirms allocations & docs', status: 'pending' },
        { id: 'payment', name: 'Payment', icon: '💰', description: 'x402 blockchain payments', status: 'pending' }
    ],

    normalizeSyndication(data) {
        if (!data) return null;
        return {
            id: data.syndication_id || data.id || data._id || 'Unknown',
            borrower: data.loan_details?.borrower_name || data.borrower || 'Unknown Borrower',
            amount: typeof data.loan_details?.total_amount === 'number'
                ? data.loan_details.total_amount / 1000000
                : (data.amount || 0),
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

    init() {
        if (this.initialized) return;
        console.log('🤖 Initializing Agent Orchestration...');

        // Connect to WebSocket or use polling if configured
        if (this.usePolling) {
            this.startPolling();
        } else if (Config?.ENABLE_WEBSOCKET) {
            this.connectWebSocket();
        }

        this.setupControlHandlers();
        this.setupEventListeners();

        // Critical: Connect to local simulation events
        this.connectToSimulation();

        this.initialized = true;
    },

    /**
     * Connect to local SimulationEngine events for real-time updates
     */
    connectToSimulation() {
        // Listen for simulation events
        if (window.SimulationEngine) {
            // Simulation lifecycle
            SimulationEngine.on('simulationStart', () => {
                this.addLogEntry('system', '▶️ Simulation started');
                this.renderWorkflow();
            });

            SimulationEngine.on('simulationStop', () => {
                this.addLogEntry('system', '⏸️ Simulation paused');
                this.renderWorkflow();
            });

            SimulationEngine.on('simulationReset', () => {
                this.resetUI();
                this.addLogEntry('system', '🔄 Simulation reset');
                this.renderWorkflow();
            });

            // Transaction events (bids, payments, etc.)
            SimulationEngine.on('transaction', (tx) => {
                this.handleTransaction(tx);
            });

            // Day change for periodic updates
            SimulationEngine.on('dayChange', (data) => {
                // Update context with current date
                if (this.activeSyndication) {
                    this.updateActiveContext();
                }
            });

            console.log('📡 Connected to SimulationEngine');
        }

        // Listen for SyndiData events
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));
        window.addEventListener('syndicationUpdated', (e) => this.onSyndicationUpdated(e.detail));
        window.addEventListener('bidPlaced', (e) => this.onBidPlaced(e.detail));
        window.addEventListener('bidScheduled', (e) => this.onBidScheduled(e.detail));
    },

    /**
     * Handle transaction from simulation engine
     */
    handleTransaction(tx) {
        if (!tx) return;

        switch (tx.type) {
            case 'bid':
                this.setStage('participant', 'active');
                this.addLogEntry('participant', tx.description || `Bid placed: $${(tx.amount / 1000000).toFixed(1)}M`);
                break;
            case 'allocation':
                this.setStage('negotiation', 'active');
                this.addLogEntry('negotiation', tx.description || 'Allocation confirmed');
                break;
            case 'settlement':
                this.setStage('settlement', 'active');
                this.addLogEntry('settlement', tx.description || 'Settlement initiated');
                break;
            case 'payment':
            case 'fee':
                this.setStage('payment', 'active');
                this.addLogEntry('payment', tx.description || `Payment: $${(tx.amount / 1000000).toFixed(2)}M`);
                break;
            default:
                this.addLogEntry('system', tx.description || `Transaction: ${tx.type}`);
        }

        this.renderWorkflow();
    },

    /**
     * Handle bid scheduled by AutoBidder
     */
    onBidScheduled(bid) {
        const name = bid.participantName || bid.participantId || 'Participant';
        this.addLogEntry('participant', `📋 ${name} scheduling bid: $${bid.amount}M`, bid.reasons?.join(', '));
        this.setStage('participant', 'active');
        this.renderWorkflow();
    },

    /**
     * Handle bid executed
     */
    onBidPlaced(bid) {
        const name = bid.participantName || bid.participantId || 'Participant';
        this.addLogEntry('participant', `✅ ${name} placed $${bid.amount}M bid`);

        // Update active deal context
        if (this.activeSyndication && bid.syndicationId === this.activeSyndication.id) {
            const synd = SyndiData?.syndications?.find(s => s.id === bid.syndicationId);
            if (synd) {
                this.activeSyndication = this.normalizeSyndication(synd);
            }
        }

        this.renderWorkflow();
    },

    /**
     * Handle syndication updated
     */
    onSyndicationUpdated(data) {
        if (!data?.id) return;

        const synd = SyndiData?.syndications?.find(s => s.id === data.id);
        if (synd) {
            // Update stage based on status
            if (synd.subscription >= 100) {
                this.setStage('participant', 'complete');
                this.setStage('negotiation', 'active');
                this.addLogEntry('negotiation', `🎯 Fully subscribed (${synd.subscription.toFixed(0)}%)`);
            }

            if (synd.status === 'closed' || synd.status === 'settled') {
                this.setStage('negotiation', 'complete');
                this.setStage('settlement', 'active');
            }

            if (synd.status === 'completed') {
                this.setStage('settlement', 'complete');
                this.setStage('payment', 'complete');
                this.addLogEntry('system', '✅ Deal completed');
            }

            if (this.activeSyndication?.id === data.id) {
                this.activeSyndication = this.normalizeSyndication(synd);
            }
        }

        this.renderWorkflow();
    },

    updateActiveContext() {
        const contextEl = document.getElementById('orch-context');
        if (contextEl) {
            contextEl.innerHTML = this.renderContext();
        }
    },

    setupControlHandlers() {
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
    },

    setupEventListeners() {
        // Legacy listeners (kept for backward compatibility)
        if (window.SimulationEngine) {
            SimulationEngine.on('simulationStart', () => this.onSimulationStart());
        }
    },

    onSimulationStart() {
        // Legacy handler - now covered by connectToSimulation()
    },

    connectWebSocket() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Agent Server Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.ws.send(JSON.stringify({ type: 'subscribe', client: 'web-ui' }));
            };

            this.ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    this.handleMessage(msg);
                } catch (err) {
                    console.error('Error parsing WS message:', err);
                }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.warn('WS Error:', error);
                this.ws.close();
            };
        } catch (e) {
            console.warn('WS Connection Failed:', e);
            this.scheduleReconnect();
        }
    },

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
        const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;
        setTimeout(() => {
            if (!this.isConnected) this.connectWebSocket();
        }, delay);
    },

    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        const poll = async () => {
            if (!window.API) return;
            const events = await API.get('server', '/syndication-events?limit=50');
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
                this.handleMessage(event);
            });

            if (this.seenEventIds.size > 1000) {
                const arr = Array.from(this.seenEventIds);
                this.seenEventIds = new Set(arr.slice(-500));
            }
        };
        poll();
        this.pollTimer = setInterval(poll, this.pollIntervalMs);
    },

    handleMessage(message) {
        if (!message) return;
        const type = message.event_type || message.type;
        const data = message.data || message;

        if (message.log) {
            this.addLogEntry(message.source || 'system', message.log);
        }

        switch (type) {
            case 'subscribed':
                this.addLogEntry('system', 'Connected to Agent Orchestrator');
                break;
            case 'engine_reset':
                this.addLogEntry('system', '🔄 Engine state reset');
                this.resetUI();
                break;
            case 'syndication_created':
            case 'SyndicationOpened':
                this.activeSyndication = this.normalizeSyndication(data);
                this.setStage('originator', 'complete');
                this.setStage('participant', 'active');
                this.addLogEntry('originator',
                    `${data.borrower || 'New Deal'} opened: $${((data.amount || data.loan_details?.total_amount || 0) / 1000000).toFixed(0)}M`,
                    data.reasoning);
                break;
            case 'BidReceived':
            case 'bid_placed':
                this.setStage('participant', 'active');
                this.addLogEntry('participant',
                    `${data.participant || data.institution_name || 'Participant'} bid $${(data.amount / 1000000).toFixed(1)}M`,
                    data.reasoning);
                break;
            case 'BiddingCompleted':
                this.setStage('participant', 'complete');
                this.setStage('negotiation', 'active');
                this.addLogEntry('negotiation', `Bidding complete: ${(data.subscription_rate * 100).toFixed(0)}% subscribed`);
                break;
            case 'AuctionCompleted':
                this.setStage('negotiation', 'complete');
                this.setStage('settlement', 'active');
                this.addLogEntry('negotiation', `Auction closed at ${data.final_spread}bps`);
                break;
            case 'SettlementCompleted':
                this.setStage('settlement', 'complete');
                this.setStage('payment', 'active');
                this.addLogEntry('settlement', 'Settlement documentation finalized');
                break;
            case 'PaymentProcessed':
            case 'SyndicationCompleted':
                this.setStage('payment', 'complete');
                this.addLogEntry('system', '✅ Syndication pipeline completed');
                break;
            case 'market_update':
                if (window.AppState) AppState.set('marketConditions', data.condition);
                break;
        }

        this.renderWorkflow();
    },

    onNewSyndication(synd) {
        this.activeSyndication = this.normalizeSyndication(synd);
        this.resetUI();
        this.setStage('originator', 'complete');
        this.setStage('participant', 'active');
        this.addLogEntry('originator', `🚀 ${synd.borrower || 'New Deal'} opened: $${synd.amount}M @ ${synd.spread}bps`);
        this.renderWorkflow();
    },

    triggerManualRun() {
        // First try simulation engine
        if (window.SimulationEngine) {
            SimulationEngine.triggerNewSyndication();
            this.addLogEntry('system', '🚀 New syndication triggered via simulation');
            this.renderWorkflow();
            return;
        }

        // Fallback to WebSocket/API
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({ type: 'trigger_run' }));
        } else if (window.API) {
            API.post('server', '/syndications/generate', {});
        }
    },

    stepWorkflow() {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({ type: 'step_engine' }));
        } else {
            // Allow manual step for demo
            this.advanceToNextStage();
        }
    },

    advanceToNextStage() {
        const stages = this.workflowStages;
        for (let i = 0; i < stages.length; i++) {
            if (stages[i].status === 'active') {
                stages[i].status = 'complete';
                if (i + 1 < stages.length) {
                    stages[i + 1].status = 'active';
                    this.addLogEntry(stages[i + 1].id, `${stages[i + 1].name} phase started`);
                }
                break;
            }
        }
        this.renderWorkflow();
    },

    async resetWorkflow() {
        this.resetUI();
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({ type: 'reset_engine' }));
        }
        if (window.API) {
            await API.post('server', '/orchestrator/reset', {}).catch(() => { });
        }
        this.addLogEntry('system', '🔄 Workflow reset');
        this.renderWorkflow();
    },

    resetUI() {
        this.workflowStages.forEach(s => s.status = 'pending');
        this.workflowLog = [];
        this.activeSyndication = null;
    },

    setStage(stageId, status) {
        const stage = this.workflowStages.find(s => s.id === stageId);
        if (stage) stage.status = status;
    },

    addLogEntry(source, message, reasoning = null) {
        this.workflowLog.push({
            timestamp: new Date(),
            source,
            message,
            reasoning
        });
        if (this.workflowLog.length > 50) this.workflowLog.shift();
    },

    updateConnectionStatus(connected) {
        const el = document.getElementById('orch-connection-status');
        if (el) {
            el.className = `orch-status-badge ${connected ? 'live' : 'sim'}`;
            el.innerHTML = connected ? '● Live Agents' : '○ Simulated';
        }
        if (window.AppState) AppState.set('agentConnected', connected);
    },

    // === Rendering ===
    render(container) {
        if (!container) return;
        this.injectStyles();

        // Check if simulation is running
        const simRunning = window.SimulationEngine?.state?.isRunning || false;
        const simStatusText = simRunning ? '● Running' : '○ Stopped';
        const simStatusClass = simRunning ? 'live' : 'sim';

        container.innerHTML = `
            <div class="orch-page">
                <!-- Header -->
                <div class="orch-header">
                    <div class="orch-header-left">
                        <h2 class="orch-title">Agent Orchestration</h2>
                        <div id="orch-connection-status" class="orch-status-badge ${simStatusClass}">
                            ${this.isConnected ? '● Live Agents' : simStatusText}
                        </div>
                    </div>
                    <div class="orch-controls">
                        <button id="btn-run-syndication" class="orch-btn primary">▶ Run Engine</button>
                        <button id="btn-step-engine" class="orch-btn">⚡ Step</button>
                        <button id="btn-reset-engine" class="orch-btn">🔄 Reset</button>
                    </div>
                </div>

                <!-- Pipeline Flow -->
                <div class="orch-pipeline">
                    ${this.renderPipeline()}
                </div>

                <!-- Bottom Grid -->
                <div class="orch-grid">
                    <div class="orch-activity-panel">
                        <div class="orch-panel-header">
                            <h3>Activity Timeline</h3>
                            <button id="btn-clear-log" class="orch-btn-xs">Clear</button>
                        </div>
                        <div id="orch-activity-log" class="orch-activity-log">
                            ${this.renderActivityLog()}
                        </div>
                    </div>
                    <div class="orch-context-panel">
                        <h3>Deal Context</h3>
                        <div id="orch-context">
                            ${this.renderContext()}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderPipeline() {
        return `
            <div class="orch-pipeline-flow">
                ${this.workflowStages.map((stage, i) => `
                    <div class="orch-stage ${stage.status}" title="${stage.description}">
                        <div class="orch-stage-icon">${stage.icon}</div>
                        <div class="orch-stage-name">${stage.name}</div>
                        <div class="orch-stage-dot"></div>
                    </div>
                    ${i < this.workflowStages.length - 1 ? '<div class="orch-connector"><div class="orch-connector-line"></div></div>' : ''}
                `).join('')}
            </div>
        `;
    },

    renderActivityLog() {
        if (this.workflowLog.length === 0) {
            return `
                <div class="orch-empty-state">
                    <div class="orch-empty-icon">🤖</div>
                    <div class="orch-empty-title">Awaiting Activity</div>
                    <div class="orch-empty-text">Click <strong>Start</strong> in the header to begin simulation, or click <strong>Run Engine</strong> to trigger a new syndication.</div>
                </div>
            `;
        }
        return this.workflowLog.slice().reverse().map(entry => {
            const icon = this.getSourceIcon(entry.source);
            return `
                <div class="orch-log-entry">
                    <div class="orch-log-icon">${icon}</div>
                    <div class="orch-log-content">
                        <div class="orch-log-header">
                            <span class="orch-log-source">${entry.source.toUpperCase()}</span>
                            <span class="orch-log-time">${entry.timestamp.toLocaleTimeString()}</span>
                        </div>
                        <div class="orch-log-msg">${entry.message}</div>
                        ${entry.reasoning ? `<div class="orch-log-reason">💡 ${entry.reasoning}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    getSourceIcon(source) {
        const icons = {
            originator: '🏦',
            participant: '🏢',
            negotiation: '⚡',
            settlement: '📋',
            payment: '💰',
            system: '⚙️'
        };
        return icons[source] || '📌';
    },

    renderContext() {
        if (!this.activeSyndication) {
            // Show recent syndications if available
            const recentSynd = SyndiData?.syndications?.find(s => s.status === 'open');
            if (recentSynd) {
                this.activeSyndication = this.normalizeSyndication(recentSynd);
            } else {
                return `
                    <div class="orch-empty-state small">
                        <div class="orch-empty-icon">📊</div>
                        <div class="orch-empty-text">No active deal<br/>Trigger a new syndication to see context</div>
                    </div>
                `;
            }
        }
        const s = this.activeSyndication;
        return `
            <div class="orch-context-card">
                <div class="orch-context-id">${s.id}</div>
                <div class="orch-context-borrower">${s.borrower}</div>
                <div class="orch-context-grid">
                    <div class="orch-context-item">
                        <span class="label">Amount</span>
                        <span class="value">$${s.amount.toFixed(0)}M</span>
                    </div>
                    <div class="orch-context-item">
                        <span class="label">Rating</span>
                        <span class="value">${s.rating}</span>
                    </div>
                    <div class="orch-context-item">
                        <span class="label">Spread</span>
                        <span class="value">${s.spread ? s.spread + 'bps' : '—'}</span>
                    </div>
                    <div class="orch-context-item">
                        <span class="label">Subscription</span>
                        <span class="value orch-sub-${s.subscription >= 100 ? 'full' : s.subscription >= 50 ? 'mid' : 'low'}">${s.subscription.toFixed(0)}%</span>
                    </div>
                </div>
                <div class="orch-sub-bar">
                    <div class="orch-sub-fill" style="width: ${Math.min(100, s.subscription)}%"></div>
                </div>
                <div class="orch-context-status">
                    <span class="orch-status-pill ${s.status}">${s.status.toUpperCase()}</span>
                </div>
            </div>
        `;
    },

    renderWorkflow() {
        const log = document.getElementById('orch-activity-log');
        if (log) log.innerHTML = this.renderActivityLog();

        const context = document.getElementById('orch-context');
        if (context) context.innerHTML = this.renderContext();

        // Update stage statuses
        document.querySelectorAll('.orch-stage').forEach((el, i) => {
            if (this.workflowStages[i]) {
                el.className = `orch-stage ${this.workflowStages[i].status}`;
            }
        });

        // Update connection status based on simulation
        const el = document.getElementById('orch-connection-status');
        if (el && !this.isConnected) {
            const simRunning = window.SimulationEngine?.state?.isRunning || false;
            el.className = `orch-status-badge ${simRunning ? 'live' : 'sim'}`;
            el.innerHTML = simRunning ? '● Simulating' : '○ Stopped';
        }
    },

    injectStyles() {
        if (document.getElementById('orch-v2-styles')) return;
        const style = document.createElement('style');
        style.id = 'orch-v2-styles';
        style.textContent = `
            .orch-page { padding: 1.5rem; }

            /* Header */
            .orch-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
            .orch-header-left { display: flex; align-items: center; gap: 1rem; }
            .orch-title { margin: 0; font-size: 1.5rem; font-weight: 700; }
            .orch-status-badge { font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 20px; }
            .orch-status-badge.live { background: rgba(16,185,129,0.15); color: #10b981; }
            .orch-status-badge.sim { background: rgba(0,0,0,0.1); color: var(--text-muted); }
            .orch-controls { display: flex; gap: 0.5rem; }
            .orch-btn { padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 600; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-card); cursor: pointer; transition: all 0.2s; }
            .orch-btn:hover { background: var(--bg-secondary); }
            .orch-btn.primary { background: var(--primary); color: white; border-color: var(--primary); }
            .orch-btn.primary:hover { background: #4f46e5; }
            .orch-btn-xs { font-size: 0.7rem; padding: 0.25rem 0.5rem; border: 1px solid var(--border); border-radius: 4px; background: transparent; cursor: pointer; }

            /* Pipeline */
            .orch-pipeline { background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.1)); border-radius: 16px; padding: 2rem; margin-bottom: 1.5rem; border: 1px solid var(--border); }
            .orch-pipeline-flow { display: flex; align-items: center; justify-content: space-between; }
            .orch-stage { display: flex; flex-direction: column; align-items: center; min-width: 80px; }
            .orch-stage-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--bg-card); border: 3px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; transition: all 0.3s; }
            .orch-stage-name { margin-top: 0.5rem; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
            .orch-stage-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); margin-top: 0.5rem; transition: all 0.3s; }
            
            /* Stage States */
            .orch-stage.active .orch-stage-icon { border-color: var(--primary); box-shadow: 0 0 20px rgba(99,102,241,0.4); transform: scale(1.1); }
            .orch-stage.active .orch-stage-dot { background: var(--primary); animation: pulse 1.5s infinite; }
            .orch-stage.complete .orch-stage-icon { border-color: #10b981; background: rgba(16,185,129,0.1); }
            .orch-stage.complete .orch-stage-dot { background: #10b981; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

            /* Connector */
            .orch-connector { flex: 1; display: flex; align-items: center; margin: 0 0.5rem; margin-bottom: 2rem; }
            .orch-connector-line { flex: 1; height: 3px; background: linear-gradient(90deg, var(--border), var(--primary), var(--border)); border-radius: 2px; }

            /* Grid */
            .orch-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }
            .orch-activity-panel, .orch-context-panel { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; }
            .orch-panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
            .orch-panel-header h3, .orch-context-panel h3 { margin: 0; font-size: 0.875rem; font-weight: 600; }

            /* Activity Log */
            .orch-activity-log { max-height: 320px; overflow-y: auto; }
            .orch-log-entry { display: flex; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
            .orch-log-entry:last-child { border-bottom: none; }
            .orch-log-icon { font-size: 1.25rem; }
            .orch-log-content { flex: 1; }
            .orch-log-header { display: flex; justify-content: space-between; margin-bottom: 0.25rem; }
            .orch-log-source { font-size: 0.65rem; font-weight: 700; color: var(--primary); text-transform: uppercase; }
            .orch-log-time { font-size: 0.65rem; color: var(--text-muted); font-family: monospace; }
            .orch-log-msg { font-size: 0.85rem; line-height: 1.4; }
            .orch-log-reason { margin-top: 0.5rem; font-size: 0.75rem; font-style: italic; color: var(--text-muted); background: rgba(0,0,0,0.03); padding: 0.5rem; border-radius: 6px; }

            /* Empty State */
            .orch-empty-state { text-align: center; padding: 2rem 1rem; color: var(--text-muted); }
            .orch-empty-state.small { padding: 1rem; }
            .orch-empty-icon { font-size: 2rem; margin-bottom: 0.5rem; }
            .orch-empty-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; }
            .orch-empty-text { font-size: 0.8rem; line-height: 1.5; }

            /* Context */
            .orch-context-card { padding: 0.5rem 0; }
            .orch-context-id { font-size: 1rem; font-weight: 700; color: var(--primary); }
            .orch-context-borrower { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem; }
            .orch-context-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
            .orch-context-item { display: flex; flex-direction: column; }
            .orch-context-item .label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; }
            .orch-context-item .value { font-size: 0.9rem; font-weight: 600; }
            .orch-sub-full { color: #10b981; }
            .orch-sub-mid { color: #f59e0b; }
            .orch-sub-low { color: var(--text-primary); }
            .orch-sub-bar { height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; margin: 0.75rem 0; overflow: hidden; }
            .orch-sub-fill { height: 100%; background: linear-gradient(90deg, var(--primary), #10b981); border-radius: 3px; transition: width 0.5s; }
            .orch-context-status { margin-top: 0.5rem; }
            .orch-status-pill { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700; }
            .orch-status-pill.pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
            .orch-status-pill.open, .orch-status-pill.active { background: rgba(99,102,241,0.15); color: var(--primary); }
            .orch-status-pill.closed, .orch-status-pill.completed { background: rgba(16,185,129,0.15); color: #10b981; }
        `;
        document.head.appendChild(style);
    }
};

window.AgentOrchestration = AgentOrchestration;
