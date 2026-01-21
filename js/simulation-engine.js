/**
 * SyndiMatch Simulation Engine
 * Core simulation logic with time controls and state management
 */

const SimulationEngine = {
    // Simulation state
    state: {
        isRunning: false,
        startDate: new Date('2023-01-01T00:00:00'),
        endDate: new Date('2026-01-10T23:59:59'),
        currentDate: new Date('2023-01-01T00:00:00'),
        speedMultiplier: 1, // 1x, 10x, 100x, 1000x
        tickInterval: null,
        lastTickTime: null,
        lastSyndicationWeek: null,
        sessionStartIso: null
    },

    // Initial agent data (reset point)
    initialAgentData: {
        originators: {},
        participants: {}
    },

    // Current agent wealth
    agentWealth: {},

    // Transaction history
    transactions: [],

    // Live data pools
    originatorPool: [],
    participantPool: [],

    // Event listeners
    listeners: [],

    /**
     * Initialize the simulation
     */
    init() {
        this.loadState();
        // this.renderControls(); // Disabled - simulation bar removed
        this.updateDisplay();
        this.loadOriginators();
        this.loadParticipants();

        // Listen for role changes
        window.addEventListener('roleChange', () => {
            // this.renderControls(); // Disabled - simulation bar removed
            this.updateDisplay();
        });

        // Listen for market condition changes - update market display
        if (window.MarketConditions) {
            MarketConditions.on('marketUpdate', () => this.updateMarketDisplay());
            MarketConditions.on('regimeChange', () => this.updateMarketDisplay());
        }

        console.log('🎮 Simulation Engine initialized');
    },

    /**
     * Load saved state from localStorage
     */
    loadState() {
        const saved = localStorage.getItem('syndimatch_simulation');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.state.currentDate = new Date(data.currentDate);
                this.state.speedMultiplier = data.speedMultiplier || 1;
                this.agentWealth = data.agentWealth || {};
                this.transactions = data.transactions || [];
                this.state.lastSyndicationWeek = data.lastSyndicationWeek || null;
                this.state.sessionStartIso = data.sessionStartIso || null;
            } catch (e) {
                console.warn('Failed to load simulation state', e);
            }
        }

        // Initialize agent wealth if not set
        if (Object.keys(this.agentWealth).length === 0) {
            this.initializeAgentWealth();
        }
    },

    /**
     * Save state to localStorage
     */
    saveState() {
        const data = {
            currentDate: this.state.currentDate.toISOString(),
            speedMultiplier: this.state.speedMultiplier,
            agentWealth: this.agentWealth,
            transactions: this.transactions.slice(-1000), // Keep last 1000 transactions
            lastSyndicationWeek: this.state.lastSyndicationWeek,
            sessionStartIso: this.state.sessionStartIso
        };
        localStorage.setItem('syndimatch_simulation', JSON.stringify(data));
    },

    /**
     * Initialize agent wealth with starting capital
     */
    initializeAgentWealth() {
        // Major participants: $500M starting capital
        const majorParticipants = ['PA-001', 'PA-002', 'PA-003', 'PA-004', 'PA-005'];
        majorParticipants.forEach(id => {
            this.agentWealth[id] = {
                initialCapital: 500000000,
                currentWealth: 500000000,
                allocatedCapital: 0,
                totalEarnings: 0,
                totalFeesPaid: 0,
                activeAllocations: []
            };
        });

        // Minor participants: $100M starting capital
        const minorParticipants = ['PA-101', 'PA-102', 'PA-103', 'PA-104', 'PA-105'];
        minorParticipants.forEach(id => {
            this.agentWealth[id] = {
                initialCapital: 100000000,
                currentWealth: 100000000,
                allocatedCapital: 0,
                totalEarnings: 0,
                totalFeesPaid: 0,
                activeAllocations: []
            };
        });

        // Originators: Track fees earned
        const originators = ['OA-001', 'OA-002', 'OA-003', 'OA-004', 'OA-005', 'OA-006', 'OA-007', 'OA-008'];
        originators.forEach(id => {
            this.agentWealth[id] = {
                totalOriginated: 0,
                totalFeesEarned: 0,
                activeDeals: 0,
                completedDeals: 0
            };
        });

        // Store initial state for reset
        this.initialAgentData = JSON.parse(JSON.stringify(this.agentWealth));
    },

    /**
     * Start the simulation
     */
    start() {
        if (this.state.isRunning) return;

        // Always start from a fresh simulation state
        this.reset();

        // Auto-reset if at end
        if (this.state.currentDate >= this.state.endDate) {
            this.reset();
        }

        this.state.isRunning = true;
        this.state.lastTickTime = Date.now();

        // Connect to WebSocket for real-time events
        if (window.WebSocketManager) {
            WebSocketManager.connect();
        }

        // Tick every 100ms real time
        this.state.tickInterval = setInterval(() => this.tick(), 100);

        // Listen for day changes to potentially trigger new syndications
        this.on('dayChange', (data) => this.onDayChange(data));

        this.emit('simulationStart', { date: this.state.currentDate });
        this.updateControls();
        console.log('▶️ Simulation started at', this.formatDate(this.state.currentDate));
    },

    /**
     * Handle day change - potentially trigger new syndications
     */
    onDayChange(data) {
        const weekKey = this.getWeekKey(this.state.currentDate);
        if (weekKey !== this.state.lastSyndicationWeek) {
            this.state.lastSyndicationWeek = weekKey;
            this.triggerNewSyndication();
        }
    },

    /**
     * Trigger a new syndication via the backend
     */
    async triggerNewSyndication() {
        const originator = this.getRandomOriginator();
        try {
            const payload = {
                borrower: this.getRandomBorrower(),
                amount: Utils.randomBetween(100, 500),
                rating: this.getRandomRating(),
                spread: Utils.randomBetween(350, 550),
                industry: this.getRandomIndustry(),
                originator: originator.name,
                originator_agent_id: originator.id,
                role: `originator:${originator.id}`
            };
            const data = await API.post('server', '/syndications', payload);
            if (data) {
                console.log(`🚀 New syndication triggered (${originator.id})`);
            }
        } catch (e) {
            // Fallback: create locally if backend unavailable
            const syndId = `SYND-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
            SyndiData.addSyndication({
                id: syndId,
                borrower: this.getRandomBorrower(),
                amount: Utils.randomBetween(100, 500),
                rating: this.getRandomRating(),
                spread: Utils.randomBetween(350, 550),
                status: 'open',
                subscription: 0,
                participantCount: 0,
                originator: originator.name,
                originator_agent_id: originator.id
            });
            if (window.PipelineComponent) PipelineComponent.render();
        }
    },
    async loadOriginators() {
        if (!window.API || window.API.useMockData) return;
        try {
            const data = await window.API.get('server', '/originators');
            if (Array.isArray(data) && data.length) {
                this.originatorPool = data.map((o) => ({
                    id: o._id || o.id || o.originator_agent_id,
                    name: o.institution?.name || o.name || o.originator || o.bank || 'Unknown'
                })).filter(o => o.id);
            }
        } catch (e) {
            console.warn('⚠️ Originator fetch failed:', e.message);
        }
    },
    async loadParticipants() {
        if (!window.API || window.API.useMockData) return;
        try {
            const data = await window.API.get('server', '/participants');
            if (Array.isArray(data) && data.length) {
                this.participantPool = data.map((p) => ({
                    id: p._id || p.id,
                    name: p.institution?.name || p.name || p.entity || 'Unknown'
                })).filter(p => p.id);
            }
        } catch (e) {
            console.warn('⚠️ Participant fetch failed:', e.message);
        }
    },
    getRandomOriginator() {
        if (this.originatorPool.length) {
            return this.originatorPool[Utils.randomBetween(0, this.originatorPool.length - 1)];
        }
        const originators = [
            { id: 'OA-001', name: 'JPMorgan Chase' },
            { id: 'OA-002', name: 'Bank of America' },
            { id: 'OA-003', name: 'Citigroup' },
            { id: 'OA-004', name: 'Goldman Sachs' },
            { id: 'OA-005', name: 'Wells Fargo' }
        ];
        return originators[Utils.randomBetween(0, originators.length - 1)];
    },
    getWeekKey(date) {
        const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = temp.getUTCDay() || 7;
        temp.setUTCDate(temp.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
        const week = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
        return `${temp.getUTCFullYear()}-W${week}`;
    },

    getRandomBorrower() {
        const borrowers = [
            'Apex Technologies', 'Horizon Medical', 'Summit Logistics', 'Vertex Energy',
            'Pinnacle Software', 'Atlas Manufacturing', 'Meridian Foods', 'Quantum Systems',
            'Nova Pharma', 'Titan Industries', 'Stellar Corp', 'Frontier Holdings'
        ];
        return borrowers[Utils.randomBetween(0, borrowers.length - 1)];
    },

    getRandomIndustry() {
        const industries = [
            'Technology', 'Healthcare', 'Energy', 'Real Estate', 'Industrial',
            'Financial Services', 'Telecom', 'Consumer', 'Infrastructure'
        ];
        return industries[Utils.randomBetween(0, industries.length - 1)];
    },

    getRandomRating() {
        const ratings = ['BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+'];
        return ratings[Utils.randomBetween(0, ratings.length - 1)];
    },

    /**
     * Stop the simulation
     */
    stop() {
        if (!this.state.isRunning) return;

        this.state.isRunning = false;
        if (this.state.tickInterval) {
            clearInterval(this.state.tickInterval);
            this.state.tickInterval = null;
        }

        this.saveState();
        this.emit('simulationStop', { date: this.state.currentDate });
        this.updateControls();
        console.log('⏸️ Simulation stopped at', this.formatDate(this.state.currentDate));
    },

    /**
     * Reset simulation to initial state
     */
    reset() {
        this.stop();

        // Reset time
        this.state.currentDate = new Date(this.state.startDate);
        this.state.lastSyndicationWeek = null;
        this.state.sessionStartIso = new Date().toISOString();

        // Reset agent wealth
        this.agentWealth = JSON.parse(JSON.stringify(this.initialAgentData));

        // Clear transactions
        this.transactions = [];

        // Clear active syndications in auto-generator
        if (window.AutoGenerator) {
            AutoGenerator.reset();
        }

        // Clear pending bids
        if (window.AutoBidder) {
            AutoBidder.pendingBids = [];
        }

        // Clear SyndiData simulation data (preserves mock data)
        if (typeof SyndiData !== 'undefined' && SyndiData.reset) {
            SyndiData.reset();
        }

        // Clear localStorage
        localStorage.removeItem('syndimatch_simulation');

        this.saveState();
        this.updateDisplay();

        // Force UI re-render
        if (window.PipelineComponent) PipelineComponent.render();
        if (window.MetricsComponent) MetricsComponent.updateMetrics({});

        this.emit('simulationReset', { date: this.state.currentDate });

        console.log('🔄 Simulation reset to', this.formatDate(this.state.currentDate));
    },

    /**
     * Simulation tick - called every 100ms real time
     */
    tick() {
        const now = Date.now();
        const realElapsed = now - this.state.lastTickTime;
        this.state.lastTickTime = now;

        // Calculate simulated time advance
        // At 1x: 100ms real = 1 hour simulated
        // At 1000x: 100ms real = 1000 hours simulated
        const simulatedHours = (realElapsed / 100) * this.state.speedMultiplier;
        const simulatedMs = simulatedHours * 3600000;

        // Advance time
        const newDate = new Date(this.state.currentDate.getTime() + simulatedMs);

        // Check if we've reached the end
        if (newDate >= this.state.endDate) {
            this.state.currentDate = new Date(this.state.endDate);
            this.stop();
            this.emit('simulationEnd', { date: this.state.currentDate });
            return;
        }

        const previousDate = this.state.currentDate;
        this.state.currentDate = newDate;

        // Sync with backend every ~2 seconds (20 ticks)
        this.syncCounter = (this.syncCounter || 0) + 1;
        if (this.syncCounter >= 20) {
            this.syncCounter = 0;
            this.syncStateWithBackend();
        }

        // Emit time events
        this.emit('timeTick', {
            date: this.state.currentDate,
            previousDate,
            speedMultiplier: this.state.speedMultiplier
        });

        // Check for day change
        if (previousDate.getDate() !== newDate.getDate()) {
            this.emit('dayChange', { date: this.state.currentDate });
        }

        // Check for month change
        if (previousDate.getMonth() !== newDate.getMonth()) {
            this.emit('monthChange', { date: this.state.currentDate });
            this.saveState(); // Save on month boundaries
        }

        // Update display
        this.updateTimeDisplay();
    },

    async syncStateWithBackend() {
        if (typeof API !== 'undefined' && !API.useMockData && typeof SyndiData !== 'undefined') {
            const success = await SyndiData.refresh();
            if (success) {
                // Trigger UI updates
                if (window.MetricsComponent) MetricsComponent.refreshActiveMetrics();
                if (window.PipelineComponent) PipelineComponent.render();
            }
        }
    },

    /**
     * Set simulation speed
     */
    setSpeed(multiplier) {
        this.state.speedMultiplier = Math.max(1, Math.min(50, multiplier));
        this.updateSpeedDisplay();
        this.emit('speedChange', { speed: this.state.speedMultiplier });
    },

    /**
     * Update market condition display
     */
    updateMarketDisplay() {
        const container = document.getElementById('sim-market-display');
        if (!container) return;

        const marketCondition = window.MarketConditions?.currentCondition || 'neutral';
        const volatility = window.MarketConditions?.volatilityIndex || 50;
        const marketIcon = { bull: '📈', neutral: '➖', bear: '📉' }[marketCondition];
        const marketColor = { bull: '#10b981', neutral: '#6b7280', bear: '#ef4444' }[marketCondition];

        container.innerHTML = `
            <span class="market-icon">${marketIcon}</span>
            <span class="market-label" style="color: ${marketColor}">${marketCondition.toUpperCase()}</span>
            <span class="market-volatility">Vol: ${volatility.toFixed(0)}</span>
        `;
    },

    /**
     * Add event listener
     */
    on(event, callback) {
        this.listeners.push({ event, callback });
    },

    /**
     * Emit event
     */
    emit(event, data) {
        this.listeners
            .filter(l => l.event === event)
            .forEach(l => l.callback(data));
    },

    /**
     * Record a transaction
     */
    recordTransaction(tx) {
        const transaction = {
            id: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: this.state.currentDate.toISOString(),
            ...tx
        };

        this.transactions.push(transaction);

        // Sync with SyndiData for UI
        if (typeof SyndiData !== 'undefined' && Array.isArray(SyndiData.transactions)) {
            SyndiData.transactions.push(transaction);
        }

        this.emit('transaction', transaction);

        return transaction;
    },

    /**
     * Update agent wealth
     */
    updateWealth(agentId, changes) {
        if (!this.agentWealth[agentId]) return;

        Object.entries(changes).forEach(([key, value]) => {
            if (typeof value === 'number' && typeof this.agentWealth[agentId][key] === 'number') {
                this.agentWealth[agentId][key] += value;
            } else {
                this.agentWealth[agentId][key] = value;
            }
        });

        this.emit('wealthChange', { agentId, wealth: this.agentWealth[agentId] });
    },

    /**
     * Get agent wealth
     */
    getWealth(agentId) {
        return this.agentWealth[agentId] || null;
    },

    /**
     * Render simulation controls
     */
    renderControls() {
        // Find or create controls container
        let container = document.getElementById('simulation-controls');
        if (!container) {
            container = document.createElement('div');
            container.id = 'simulation-controls';
            container.className = 'simulation-controls';

            // Insert at top - before header or as first child of body
            const header = document.querySelector('.header');
            if (header) {
                header.before(container);
            } else {
                document.body.prepend(container);
            }
        }

        // Check current role - only admin sees reset button
        const currentRole = window.RoleRouter?.currentRole || 'platform';
        const isAdmin = currentRole === 'platform';

        // Get market condition
        const marketCondition = window.MarketConditions?.currentCondition || 'neutral';
        const volatility = window.MarketConditions?.volatilityIndex || 50;
        const marketIcon = { bull: '📈', neutral: '➖', bear: '📉' }[marketCondition];
        const marketColor = { bull: '#10b981', neutral: '#6b7280', bear: '#ef4444' }[marketCondition];

        container.innerHTML = `
            <div class="sim-time-display">
                <span class="sim-logo">SyndiMatch</span>
                <span class="sim-divider">|</span>
                <div class="sim-date" id="sim-date">${this.formatDate(this.state.currentDate)}</div>
            </div>
            <div class="sim-market-display" id="sim-market-display">
                <span class="market-icon">${marketIcon}</span>
                <span class="market-label" style="color: ${marketColor}">${marketCondition.toUpperCase()}</span>
                <span class="market-volatility">Vol: ${volatility.toFixed(0)}</span>
            </div>
            <div class="sim-speed-control">
                <label>Speed:</label>
                <input type="range" id="sim-speed-slider" min="5" max="24" value="${Math.max(5, Math.min(24, this.state.speedMultiplier))}" step="1">
                <span class="sim-speed-value" id="sim-speed-value">${Math.round(this.state.speedMultiplier / 2.4)} Days/s</span>
            </div>
            <div class="sim-buttons">
                <button class="btn-sim btn-start" id="btn-sim-start" ${this.state.isRunning ? 'disabled' : ''}>▶ Start</button>
                <button class="btn-sim btn-stop" id="btn-sim-stop" ${!this.state.isRunning ? 'disabled' : ''}>⏸ Stop</button>
                ${isAdmin ? '<button class="btn-sim btn-reset" id="btn-sim-reset">🔄 Start Over</button>' : ''}
            </div>
        `;

        // Initial setup of listeners (delegation)
        if (!this.controlsListenersAttached) {
            this.setupControlListeners(container);
            this.controlsListenersAttached = true;
        }

        this.updateDisplay();
    },

    /**
     * Setup event delegation for controls
     */
    setupControlListeners(container) {
        container.addEventListener('click', (e) => {
            const startBtn = e.target.closest('#btn-sim-start');
            const stopBtn = e.target.closest('#btn-sim-stop');
            const resetBtn = e.target.closest('#btn-sim-reset');

            if (startBtn && !startBtn.disabled) this.start();
            if (stopBtn && !stopBtn.disabled) this.stop();
            if (resetBtn) {
                this.stop();
                this.reset();
            }
        });

        container.addEventListener('input', (e) => {
            if (e.target.id === 'sim-speed-slider') {
                this.setSpeed(parseInt(e.target.value));
            }
        });
    },

    /**
     * Update controls based on state
     */
    updateControls() {
        const startBtn = document.getElementById('btn-sim-start');
        const stopBtn = document.getElementById('btn-sim-stop');

        if (startBtn) startBtn.disabled = this.state.isRunning;
        if (stopBtn) stopBtn.disabled = !this.state.isRunning;
    },

    /**
     * Update time display
     */
    updateTimeDisplay() {
        const dateEl = document.getElementById('sim-date');
        if (dateEl) {
            dateEl.textContent = this.formatDate(this.state.currentDate);
        }

        // Update progress bar
        const progressBar = document.getElementById('sim-progress-bar');
        if (progressBar) {
            const total = this.state.endDate.getTime() - this.state.startDate.getTime();
            const current = this.state.currentDate.getTime() - this.state.startDate.getTime();
            const pct = (current / total) * 100;
            progressBar.style.width = `${pct}% `;
        }
    },

    /**
     * Update speed display
     */
    updateSpeedDisplay() {
        const speedValue = document.getElementById('sim-speed-value');
        if (speedValue) {
            // Calculate days per second: Speed / 2.4, rounded to integer (range 2-10)
            const daysPerSec = Math.round(this.state.speedMultiplier / 2.4);
            speedValue.textContent = `${daysPerSec} Days/s`;
        }
    },

    /**
     * Update all displays
     */
    updateDisplay() {
        this.updateTimeDisplay();
        this.updateSpeedDisplay();
        this.updateControls();
    },

    /**
     * Format date for display
     */
    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    /**
     * Get current simulated date
     */
    getCurrentDate() {
        return new Date(this.state.currentDate);
    }
};

// Add simulation control styles
const simStyles = document.createElement('style');
simStyles.textContent = `
    .simulation-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1.5rem;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 249, 255, 0.95));
        border-bottom: 1px solid var(--border-color);
        gap: 1rem;
        height: 60px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .sim-time-display {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.75rem;
        min-width: auto;
    }
    .sim-logo {
        font-size: 1.125rem;
        font-weight: 800;
        color: var(--primary);
        letter-spacing: -0.025em;
    }
    .sim-divider {
        color: var(--border-color);
        font-weight: 300;
    }
    .sim-date {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
        font-family: monospace;
        line-height: 1;
        white-space: nowrap;
    }
    .sim-market-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.75rem;
        background: white;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-color);
        height: 32px;
        margin-right: auto;
    }
    .market-icon {
        font-size: 1rem;
    }
    .market-label {
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .market-volatility {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-family: monospace;
        border-left: 1px solid var(--border-color);
        padding-left: 0.5rem;
    }
    .sim-speed-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: rgba(255, 255, 255, 0.5);
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-full);
        border: 1px solid var(--border-color);
        height: 32px;
    }
    .sim-speed-control label {
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    #sim-speed-slider {
        width: 100px;
        height: 4px;
        accent-color: var(--primary);
        cursor: pointer;
    }
    .sim-speed-value {
        font-weight: 700;
        color: var(--primary);
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--primary);
        font-size: 0.875rem;
        min-width: 60px;
        text-align: right;
    }
    .sim-buttons {
        display: flex;
        gap: 0.5rem;
    }
    .btn-sim {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 0 0.75rem;
        border: none;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        height: 32px;
    }
    .btn-sim:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .btn-start {
        background: var(--success);
        color: white;
    }
    .btn-start:hover:not(:disabled) {
        background: #059669;
        transform: translateY(-1px);
    }
    .btn-stop {
        background: var(--warning);
        color: white;
    }
    .btn-reset {
        background: white;
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
    }
    .btn-reset:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
    }
    @media (max-width: 1024px) {
        .simulation-controls {
            height: auto;
            flex-wrap: wrap;
            padding: 0.75rem;
            gap: 0.75rem;
        }
    }
`;
document.head.appendChild(simStyles);

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    SimulationEngine.init();
});

// Export for other modules
window.SimulationEngine = SimulationEngine;
