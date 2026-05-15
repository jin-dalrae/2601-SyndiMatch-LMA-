// ========================================
// SyndiMatch - Data Layer (Mock + Live Separation)
// ========================================

const SyndiData = {
    // Pipeline statuses (progression order)
    statuses: ['open', 'negotiating', 'closing', 'settlement', 'funding', 'completed'],

    // Status to workflow stage mapping
    stageMap: {
        'open': 'originator',
        'negotiating': 'participant',
        'closing': 'negotiation',
        'settlement': 'settlement',
        'funding': 'payment',
        'completed': 'payment'
    },

    // MOCK DATA (disabled - use simulation engine only)
    mockSyndications: [],

    // REAL DATA (from simulation or backend)
    syndications: [],

    // Use only simulated/real data
    get allSyndications() {
        return this.syndications;
    },

    // Participants
    participants: [],

    allocations: {},
    payments: {},
    transactions: [],

    // Agent status cache
    agents: {
        originator: [],
        participant: [],
        negotiation: [],
        settlement: [],
        payment: []
    },

    decisions: [],
    alerts: { critical: [], warning: [], info: [] },
    heatmap: { ratings: [], sectors: [], data: [] },
    volumeData: [],

    // ========================================
    // Initialization
    // ========================================

    async init() {
        // Always try to load from API on init
        await this.refresh();

        // Start live sync (polling/websockets)
        if (window.WebSocketManager) {
            window.WebSocketManager.connect();
        }
    },

    async refresh() {
        try {
            // Try using API wrapper first
            if (window.API && !window.API.useMockData) {
                const allData = await window.API.get('server', '/all-data');
                if (allData) {
                    this.updateFromLive(allData);
                    return true;
                }
            }

            // Fallback: direct fetch for syndications (limited to prevent timeout)
            const response = await fetch('/api/syndications?limit=100');
            if (response.ok) {
                const syndications = await response.json();
                if (Array.isArray(syndications) && syndications.length > 0) {
                    this.updateFromLive({ syndications });
                    console.log(`✓ Loaded ${syndications.length} syndications from database`);
                    return true;
                }
            }
        } catch (e) {
            console.warn('⚠️ SyndiData sync failed:', e.message);
        }
        return false;
    },

    updateFromLive(json) {
        // Map backend format to frontend format
        if (json.syndications) {
            // Show whatever the API returns (already newest-first and
            // capped server-side). The old code only kept deals created
            // after the browser session started, which left the pipeline
            // empty on every cold load — nothing visible, no progress.
            this.syndications = (json.syndications || []).map(s => ({
                id: s._id || s.syndication_id,
                borrower: s.loan_details?.borrower_name || s.borrower || 'Unknown',
                industry: s.loan_details?.industry || s.industry || 'Unknown',
                amount: (s.loan_details?.total_amount || 0) / 1000000,
                rating: s.loan_details?.credit_rating || s.rating || 'NR',
                originator: s.originator || 'Unknown',
                spread: s.current_spread || s.pricing?.initial_spread || 0,
                subscription: Math.round((s.subscription_rate || 0) * 100),
                status: s.status || 'open',
                round: s.current_round || 0,
                maxRounds: 5,
                bids: s.bids || [],
                isMock: false
            }));
        }

        if (json.participants) {
            this.participants = json.participants.map(p => ({
                id: p._id || p.id,
                name: p.institution?.name || p.entity || p.name || 'Unknown',
                type: p.institution?.type || p.tier || p.type || 'Unknown'
            }));
        }

        this._lastSync = new Date();
        window.dispatchEvent(new CustomEvent('syndiDataRefresh', { detail: this }));
    },

    // ========================================
    // Syndication Management
    // ========================================

    updateSyndication(syndId, updates) {
        const idx = this.syndications.findIndex(s => s.id === syndId);
        if (idx >= 0) {
            Object.assign(this.syndications[idx], updates);
            this.emit('syndicationUpdated', { id: syndId, syndication: this.syndications[idx] });

            // Emit stage change event for orchestration
            window.dispatchEvent(new CustomEvent('syndicationUpdated', {
                detail: { id: syndId, ...this.syndications[idx] }
            }));
        }
    },

    addSyndication(synd) {
        const exists = this.syndications.find(s => s.id === synd.id);
        if (exists) {
            return this.updateSyndication(synd.id, synd);
        }

        // Mark as real data (not mock)
        synd.isMock = false;

        this.syndications.unshift(synd);
        this.emit('syndicationAdded', synd);

        // Emit for orchestration
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: synd }));
    },

    /**
     * Progress a syndication to the next stage based on subscription
     */
    progressSyndication(syndId) {
        const synd = this.syndications.find(s => s.id === syndId);
        if (!synd) return;

        const currentIdx = this.statuses.indexOf(synd.status);

        // Determine next status based on business rules
        let nextStatus = null;

        if (synd.status === 'open' && synd.subscription >= 50) {
            nextStatus = 'negotiating';
            synd.phase = 'pricing';
        } else if (synd.status === 'negotiating' && synd.subscription >= 100) {
            nextStatus = 'closing';
            synd.phase = 'allocation';
        } else if (synd.status === 'closing') {
            nextStatus = 'settlement';
            synd.phase = 'documentation';
        } else if (synd.status === 'settlement') {
            nextStatus = 'funding';
            synd.phase = 'payment';
        } else if (synd.status === 'funding') {
            nextStatus = 'completed';
            synd.phase = 'completed';
        }

        if (nextStatus && nextStatus !== synd.status) {
            const oldStatus = synd.status;
            synd.status = nextStatus;

            console.log(`📈 ${synd.borrower}: ${oldStatus} → ${nextStatus}`);

            this.emit('syndicationUpdated', { id: syndId, syndication: synd });
            window.dispatchEvent(new CustomEvent('syndicationUpdated', {
                detail: { id: syndId, statusChange: { from: oldStatus, to: nextStatus }, ...synd }
            }));

            // Trigger UI refresh
            if (window.PipelineComponent) PipelineComponent.render();

            return true;
        }
        return false;
    },

    addDecision(decision) {
        this.decisions.unshift(decision);
        if (this.decisions.length > 50) this.decisions.pop();
        this.emit('decisionAdded', decision);
    },

    addTransaction(tx) {
        this.transactions.unshift(tx);
        if (this.transactions.length > 50) this.transactions.pop();
        this.emit('transactionAdded', tx);
    },

    /**
     * Clear all simulation data (keep mock)
     */
    reset() {
        this.syndications = [];
        this.transactions = [];
        this.decisions = [];
        console.log('🔄 SyndiData reset (mock data preserved)');
    },

    // ========================================
    // Event System (Pub/Sub)
    // ========================================
    _listeners: {},
    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
    },
    emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
        // Also fire a window event for external components
        window.dispatchEvent(new CustomEvent('syndiData:' + event, { detail: data }));
    }
};

// ========================================
// WebSocket / Polling Manager
// ========================================
const WebSocketManager = {
    isConnected: false,
    pollIntervalMs: 3000,
    pollTimer: null,
    seenEventIds: new Set(),

    connect() {
        this.startPolling();
        console.log('📡 Real-time sync started (polling mode)');
    },

    startPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        const poll = async () => {
            if (!window.API || window.API.useMockData) return;

            const events = await window.API.get('server', '/syndication-events?limit=50');
            if (!events) return;

            const ordered = [...events].reverse();
            ordered.forEach((event) => {
                const key = event._id || `${event.event_type}-${event.timestamp}`;
                if (this.seenEventIds.has(key)) return;
                this.seenEventIds.add(key);
                this.handleEvent(event);
            });

            // Prevent set from growing too large
            if (this.seenEventIds.size > 500) {
                const arr = Array.from(this.seenEventIds);
                this.seenEventIds = new Set(arr.slice(250));
            }
        };

        poll();
        this.pollTimer = setInterval(poll, this.pollIntervalMs);
    },

    handleEvent(data) {
        const eventType = data.event_type || data.type;
        const syndId = data.syndication_id || data.synd_id;

        console.log(`📨 Event: ${eventType}`, data);

        switch (eventType) {
            case 'SYNDICATION_CREATED':
                SyndiData.addSyndication({
                    id: syndId,
                    borrower: data.data?.borrower_name || data.data?.borrower || 'New Deal',
                    amount: (data.data?.total_amount || data.data?.amount || 0) / 1000000,
                    status: 'open',
                    subscription: 0,
                    spread: data.data?.spread || 400,
                    originator: data.data?.originator || 'Platform'
                });
                break;

            case 'BID_ACCEPTED':
                const synd = SyndiData.syndications.find(s => s.id === syndId);
                if (synd) {
                    const newSub = Math.min(100, (synd.subscription || 0) + (data.data?.percentage || 5));
                    SyndiData.updateSyndication(syndId, {
                        subscription: newSub,
                        status: newSub >= 100 ? 'closing' : 'negotiating'
                    });
                }
                break;

            case 'SYNDICATION_COMPLETE':
                SyndiData.updateSyndication(syndId, { status: 'completed', subscription: 100 });
                break;

            default:
                // Log other events as decisions or transactions
                if (eventType.includes('BID')) {
                    SyndiData.addDecision({
                        time: new Date().toLocaleTimeString(),
                        agent: data.data?.participant_id || 'Agent',
                        action: `${eventType} on ${syndId}`,
                        factors: [{ type: 'info', text: `Details: ${JSON.stringify(data.data)}` }],
                        result: 'Processed'
                    });
                }
        }

        // Trigger UI refresh
        if (window.PipelineComponent) PipelineComponent.render();
    }
};

// Global exports
window.SyndiData = SyndiData;
window.WebSocketManager = WebSocketManager;

// Legacy Utils support
window.Utils = {
    formatCurrency: (value, decimals = 0) => {
        if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `$${(value / 1000000).toFixed(decimals)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(decimals)}K`;
        return `$${value.toFixed(decimals)}`;
    },
    randomBetween: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    getStatusColor: (sub) => {
        if (sub >= 100) return 'green';
        if (sub >= 80) return 'blue';
        if (sub >= 50) return 'orange';
        return 'gray';
    },
    getProgressClass: (sub) => {
        if (sub >= 100) return 'full';
        if (sub >= 75) return 'high';
        if (sub >= 50) return 'medium';
        return 'low';
    }
};
