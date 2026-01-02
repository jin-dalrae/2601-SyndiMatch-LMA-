// ========================================
// SyndiMatch - Mock Data Layer
// ========================================

const SyndiData = {
    // Pipeline statuses
    statuses: ['open', 'negotiating', 'closing', 'settlement', 'funding', 'completed'],

    // Mock syndications
    syndications: [
        {
            id: 'SYND-2025-001', borrower: 'TechFlow Solutions', industry: 'Software/SaaS', amount: 500, rating: 'BB+', originator: 'JPMorgan', spread: 420, subscription: 94, status: 'negotiating', timeRemaining: '32h 15m', round: 3, maxRounds: 5,
            bids: [
                { time: '14:32:18', participant: 'MetLife', action: 'PASS', amount: null, spread: null, reason: 'Rating too low' },
                { time: '14:30:45', participant: 'PNC Bank', action: 'BID', amount: 50, spread: 435 },
                { time: '14:28:12', participant: 'Palmer Square', action: 'BID', amount: 75, spread: 410 },
                { time: '14:25:33', participant: 'BNP Paribas', action: 'BID', amount: 120, spread: 440 },
                { time: '14:23:15', participant: 'Apollo Global', action: 'BID', amount: 150, spread: 420 },
                { time: '14:18:22', participant: 'Ares Management', action: 'BID', amount: 80, spread: 430 },
                { time: '14:15:07', participant: 'MUFG Bank', action: 'BID', amount: 100, spread: 425 }
            ]
        },
        { id: 'SYND-2025-002', borrower: 'Atlas Manufacturing', industry: 'Industrial', amount: 350, rating: 'BBB-', originator: 'BofA', spread: 385, subscription: 100, status: 'settlement', timeRemaining: '—', round: 5, maxRounds: 5 },
        { id: 'SYND-2025-003', borrower: 'Meridian Healthcare', industry: 'Healthcare', amount: 275, rating: 'BB', originator: 'Citi', spread: 450, subscription: 45, status: 'open', timeRemaining: '6h 30m', round: 1, maxRounds: 4 },
        { id: 'SYND-2025-004', borrower: 'Quantum Logistics', industry: 'Transportation', amount: 425, rating: 'BB+', originator: 'JPMorgan', spread: 410, subscription: 78, status: 'negotiating', timeRemaining: '18h 45m', round: 2, maxRounds: 6 },
        { id: 'SYND-2025-005', borrower: 'Evergreen Energy', industry: 'Utilities', amount: 600, rating: 'BBB', originator: 'Wells Fargo', spread: 340, subscription: 62, status: 'open', timeRemaining: '48h 00m', round: 1, maxRounds: 5 },
        { id: 'SYND-2025-006', borrower: 'Pinnacle Retail', industry: 'Consumer', amount: 200, rating: 'B+', originator: 'Goldman', spread: 525, subscription: 100, status: 'funding', timeRemaining: '—', round: 4, maxRounds: 4 },
        { id: 'SYND-2025-007', borrower: 'Horizon Telecom', industry: 'Telecom', amount: 450, rating: 'BB-', originator: 'Citi', spread: 475, subscription: 100, status: 'completed', timeRemaining: '—', round: 5, maxRounds: 5 },
        { id: 'SYND-2025-008', borrower: 'Summit Aerospace', industry: 'Aerospace', amount: 380, rating: 'BBB-', originator: 'BofA', spread: 365, subscription: 88, status: 'closing', timeRemaining: '4h 20m', round: 4, maxRounds: 4 }
    ],

    // Participants
    participants: [
        { id: 'PA-001', name: 'Apollo Global', type: 'Private Credit', bids: 247, winRate: 36, volume: 1800, onTime: 100, avgEarly: 2.5 },
        { id: 'PA-002', name: 'BNP Paribas', type: 'European Bank', bids: 134, winRate: 73, volume: 2900, onTime: 100, avgEarly: 1.8 },
        { id: 'PA-003', name: 'Palmer Square', type: 'CLO Manager', bids: 892, winRate: 28, volume: 1100, onTime: 33, late: 1 },
        { id: 'PA-004', name: 'PNC Bank', type: 'Regional Bank', bids: 89, winRate: 45, volume: 650, onTime: 100, avgEarly: 3.2 },
        { id: 'PA-005', name: 'MetLife', type: 'Insurance', bids: 156, winRate: 52, volume: 1200, onTime: 95, avgEarly: 0.5 },
        { id: 'PA-006', name: 'MUFG Bank', type: 'Japanese Bank', bids: 112, winRate: 86, volume: 3200, onTime: 100, avgEarly: 4.1 },
        { id: 'PA-007', name: 'CalPERS', type: 'Pension Fund', bids: 67, winRate: 73, volume: 2100, onTime: 100, avgEarly: 2.8 },
        { id: 'PA-008', name: 'Ares Management', type: 'Private Credit', bids: 198, winRate: 41, volume: 1500, onTime: 98, avgEarly: 1.2 }
    ],

    // Bids for SYND-2025-001
    bids: [
        { time: '14:32:18', participant: 'MetLife', action: 'PASS', amount: null, spread: null, reason: 'Rating too low' },
        { time: '14:30:45', participant: 'PNC Bank', action: 'BID', amount: 50, spread: 435 },
        { time: '14:28:12', participant: 'Palmer Square', action: 'BID', amount: 75, spread: 410 },
        { time: '14:25:33', participant: 'BNP Paribas', action: 'BID', amount: 120, spread: 440 },
        { time: '14:23:15', participant: 'Apollo Global', action: 'BID', amount: 150, spread: 420 },
        { time: '14:18:22', participant: 'Ares Management', action: 'BID', amount: 80, spread: 430 },
        { time: '14:15:07', participant: 'MUFG Bank', action: 'BID', amount: 100, spread: 425 }
    ],

    // Allocation for completed deals
    allocations: {
        'SYND-2025-007': [
            { participant: 'Originator Hold', amount: 90, percentage: 20, color: '#1E40AF' },
            { participant: 'Apollo Global', amount: 135, percentage: 30, color: '#10B981' },
            { participant: 'BNP Paribas', amount: 90, percentage: 20, color: '#F59E0B' },
            { participant: 'Palmer Square', amount: 67.5, percentage: 15, color: '#EC4899' },
            { participant: 'PNC Bank', amount: 45, percentage: 10, color: '#8B5CF6' },
            { participant: 'Unfilled', amount: 22.5, percentage: 5, color: '#6B7280' }
        ]
    },

    // Payment status
    payments: {
        'SYND-2025-001': [
            { participant: 'Apollo Global', commitment: { status: 'paid', amount: 750000 }, arrangement: { status: 'paid', amount: 3000000 }, principal: { status: 'paid', amount: 150000000 }, total: 153750000, overallStatus: 'PAID' },
            { participant: 'BNP Paribas', commitment: { status: 'paid', amount: 500000 }, arrangement: { status: 'paid', amount: 2000000 }, principal: { status: 'paid', amount: 100000000 }, total: 102500000, overallStatus: 'PAID' },
            { participant: 'Palmer Square', commitment: { status: 'paid', amount: 375000 }, arrangement: { status: 'overdue', amount: 1500000 }, principal: { status: 'pending', amount: 75000000 }, total: 375000, overallStatus: 'LATE' },
            { participant: 'PNC Bank', commitment: { status: 'paid', amount: 250000 }, arrangement: { status: 'pending', amount: 1000000 }, principal: { status: 'pending', amount: 50000000 }, total: 250000, overallStatus: 'PENDING' }
        ]
    },

    // Transaction log
    transactions: [
        { time: '15:30:00', status: 'overdue', participant: 'Palmer Square', amount: 1500000, type: 'Arrangement Fee', due: '12:00:00', lateBy: '3h 30m', penalty: 145.83 },
        { time: '14:25:18', status: 'confirmed', participant: 'BNP Paribas', amount: 500000, type: 'Commitment Fee', tx: '0x5678...efgh', gas: 0.00021, blocks: 12 },
        { time: '14:23:47', status: 'confirmed', participant: 'Apollo Global', amount: 750000, type: 'Commitment Fee', tx: '0x1234...abcd', gas: 0.00023, blocks: 12 },
        { time: '14:15:32', status: 'confirmed', participant: 'PNC Bank', amount: 250000, type: 'Commitment Fee', tx: '0x9abc...def0', gas: 0.00019, blocks: 12 }
    ],

    // Agents
    agents: {
        originator: [
            { id: 'OA-001', entity: 'JPMorgan', status: 'active', loans: 2, success: 94 },
            { id: 'OA-002', entity: 'BofA', status: 'active', loans: 1, success: 96 },
            { id: 'OA-003', entity: 'Citi', status: 'active', loans: 2, success: 91 }
        ],
        participant: [
            { id: 'PA-002', entity: 'Apollo Global', status: 'active', bids: 247, winRate: 36 },
            { id: 'PA-003', entity: 'BNP Paribas', status: 'active', bids: 134, winRate: 73 },
            { id: 'PA-006', entity: 'Palmer Square', status: 'warning', bids: 892, note: 'Payment Late' }
        ],
        negotiation: [
            { id: 'NA-001', syndId: 'SYND-001', status: 'running', round: '3/5', subscription: 94 },
            { id: 'NA-002', syndId: 'SYND-004', status: 'running', round: '2/6', subscription: 68 }
        ],
        settlement: [
            { id: 'SA-001', syndId: 'SYND-002', status: 'processing', stage: '3/5', docs: 75 },
            { id: 'SA-002', syndId: 'SYND-003', status: 'processing', stage: '2/5', note: 'Compliance pending' }
        ],
        payment: [
            { id: 'PAY-001', syndId: 'SYND-001', status: 'processing', collected: 67, amount: '256M/384M' },
            { id: 'PAY-002', syndId: 'SYND-007', status: 'complete', collected: 100, amount: '450M/450M' }
        ]
    },

    // Decision log
    decisions: [
        {
            time: '14:30:22',
            agent: 'Negotiation Agent NA-001',
            action: 'REDUCE SPREAD to 420bps (Round 3)',
            factors: [
                { type: 'positive', text: 'Current subscription: 94% ($375M/$400M)' },
                { type: 'positive', text: 'Target: 100% ($400M)' },
                { type: 'neutral', text: 'Time remaining: 32 hours' },
                { type: 'positive', text: 'Spread improvement: 30bps from start' },
                { type: 'positive', text: '4 competitive bids received' }
            ],
            result: 'Set round 3 spread = 420bps, duration = 2 hours'
        },
        {
            time: '14:23:15',
            agent: 'Participant Agent PA-002 (Apollo)',
            action: 'BID on SYND-2025-001',
            factors: [
                { type: 'positive', text: 'Credit rating BB+ matches risk appetite (B- to BBB+)' },
                { type: 'positive', text: 'Sector: Software/SaaS (preferred sector)' },
                { type: 'positive', text: 'Spread 420bps meets min yield 8%' },
                { type: 'positive', text: 'Available capacity: $700M > $150M bid' },
                { type: 'positive', text: 'Portfolio fit score: 0.92' },
                { type: 'neutral', text: 'ESG rating 72 (neutral - no requirement)' }
            ],
            result: 'Submit bid $150M @ 420bps'
        }
    ],

    // Alerts
    alerts: {
        critical: [
            { syndId: 'SYND-001', message: 'Palmer CLO principal payment overdue: $75M', meta: '3.5 hours late' },
            { syndId: 'SYND-003', message: 'Subscription only 45% with 6 hours to close', meta: 'May need to widen spread' }
        ],
        warning: [
            { syndId: 'SYND-001', message: 'Palmer CLO arrangement fee late: $1.5M', meta: '+$145.83 penalty accrued' },
            { syndId: 'SYND-005', message: 'Only 2 bids received, may need to widen spread', meta: '48 hours remaining' }
        ],
        info: [
            { syndId: 'SYND-007', message: 'Successfully closed at 475bps (25bps improvement)', meta: '100% subscribed' },
            { syndId: 'SYND-004', message: '15 participants viewing, 8 bids submitted', meta: 'Active interest' }
        ]
    },

    // Heatmap data
    heatmap: {
        ratings: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B'],
        sectors: ['Tech', 'Healthcare', 'Industrial', 'Financial', 'Consumer'],
        data: [
            [180, 195, 210, 225, 240],
            [200, 220, 235, 250, 265],
            [240, 260, 280, 300, 320],
            [320, 350, 380, 410, 440],
            [420, 450, 480, 520, 560],
            [550, 590, 630, 680, 730]
        ]
    },

    // Volume chart (30 days)
    volumeData: [120, 85, 150, 200, 175, 90, 60, 180, 220, 195, 140, 165, 210, 185, 95, 170, 230, 205, 160, 145, 190, 240, 215, 180, 135, 200, 255, 225, 195, 170]
};

// Utility functions
const Utils = {
    formatCurrency: (value, decimals = 0) => {
        if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `$${(value / 1000000).toFixed(decimals)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(decimals)}K`;
        return `$${value.toFixed(decimals)}`;
    },

    getStatusColor: (subscription) => {
        if (subscription >= 80) return 'green';
        if (subscription >= 50) return 'yellow';
        return 'red';
    },

    getProgressClass: (subscription) => {
        if (subscription >= 80) return 'high';
        if (subscription >= 50) return 'medium';
        return 'low';
    },

    randomBetween: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
};

// ========================================
// SyndiData Event System & Update Methods
// ========================================

// Event listeners for real-time updates
SyndiData._listeners = {};

SyndiData.on = function (event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
};

SyndiData.emit = function (event, data) {
    if (this._listeners[event]) {
        this._listeners[event].forEach(cb => cb(data));
    }
};

// Add or update a syndication
SyndiData.updateSyndication = function (syndId, updates) {
    const idx = this.syndications.findIndex(s => s.id === syndId);
    if (idx >= 0) {
        Object.assign(this.syndications[idx], updates);
        this.emit('syndicationUpdated', { syndId, syndication: this.syndications[idx] });
        console.log(`📊 Updated ${syndId}:`, updates);
    }
};

// Add a new syndication
SyndiData.addSyndication = function (synd) {
    // Check if it already exists
    const exists = this.syndications.find(s => s.id === synd.id);
    if (exists) {
        return this.updateSyndication(synd.id, synd);
    }
    this.syndications.unshift(synd); // Add to top
    this.emit('syndicationAdded', synd);
    console.log(`🆕 New syndication: ${synd.id}`);
};

// Add a transaction
SyndiData.addTransaction = function (tx) {
    this.transactions.unshift(tx);
    this.emit('transactionAdded', tx);
};

// Add a decision log entry
SyndiData.addDecision = function (decision) {
    this.decisions.unshift(decision);
    this.emit('decisionAdded', decision);
};

// ========================================
// WebSocket Manager for Real-Time Events
// ========================================

const WebSocketManager = {
    ws: null,
    isConnected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 3000,

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        try {
            this.ws = new WebSocket('ws://localhost:8000/ws');

            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected to orchestrator');
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Subscribe to all syndication events
                this.ws.send(JSON.stringify({ type: 'subscribe', channel: 'syndication_events' }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleEvent(data);
                } catch (e) {
                    console.warn('Failed to parse WebSocket message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.warn('WebSocket error:', error);
            };
        } catch (e) {
            console.warn('Failed to create WebSocket:', e);
        }
    },

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    },

    handleEvent(data) {
        const eventType = data.event_type || data.type;
        const syndId = data.syndication_id || data.synd_id;

        console.log(`📨 Event: ${eventType}`, data);

        switch (eventType) {
            case 'SYNDICATION_CREATED':
            case 'syndication_created':
                SyndiData.addSyndication({
                    id: syndId,
                    borrower: data.data?.borrower || 'New Deal',
                    amount: data.data?.amount || 100,
                    status: 'open',
                    subscription: 0,
                    participantCount: 0,
                    spread: data.data?.spread || 400,
                    rating: data.data?.rating || 'BB',
                    originator: data.data?.originator || 'Platform'
                });
                break;

            case 'BID_SUBMITTED':
            case 'bid_submitted':
                SyndiData.updateSyndication(syndId, {
                    participantCount: (SyndiData.syndications.find(s => s.id === syndId)?.participantCount || 0) + 1
                });
                SyndiData.addDecision({
                    time: new Date().toLocaleTimeString(),
                    agent: `Participant ${data.data?.participant_id || 'Agent'}`,
                    action: `BID on ${syndId}`,
                    factors: [{ type: 'positive', text: `Amount: $${data.data?.amount || 0}M` }],
                    result: 'Bid submitted'
                });
                break;

            case 'BID_ACCEPTED':
            case 'bid_accepted':
                const currentSynd = SyndiData.syndications.find(s => s.id === syndId);
                if (currentSynd) {
                    const newSubscription = Math.min(100, (currentSynd.subscription || 0) + (data.data?.percentage || 10));
                    SyndiData.updateSyndication(syndId, {
                        subscription: newSubscription,
                        status: newSubscription >= 100 ? 'closing' : 'negotiating'
                    });
                }
                break;

            case 'ALLOCATION_COMPLETE':
            case 'allocation_complete':
                SyndiData.updateSyndication(syndId, {
                    status: 'settlement',
                    subscription: 100
                });
                break;

            case 'SYNDICATION_COMPLETE':
            case 'syndication_complete':
                SyndiData.updateSyndication(syndId, {
                    status: 'completed',
                    subscription: 100,
                    timeRemaining: '—'
                });
                break;

            default:
                // Generic event - add to transactions
                SyndiData.addTransaction({
                    time: new Date().toLocaleTimeString(),
                    type: eventType,
                    participant: data.data?.agent_id || 'System',
                    amount: data.data?.amount || 0,
                    syndId: syndId
                });
        }

        // Trigger UI refresh
        if (window.PipelineComponent) {
            PipelineComponent.render();
        }
    },

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }
};

// Export
window.WebSocketManager = WebSocketManager;

