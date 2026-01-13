// ========================================
// API Client - Fetch data from MongoDB backend
// ========================================

const API = {
    baseUrl: 'http://localhost:3001/api',
    agentUrl: 'http://localhost:8000/api',
    useMockData: false,
    demoModeKey: 'syndimatch_demo_mode',

    // Initialize clients
    init() {
        if (window.APIClient) {
            this.serverClient = new window.APIClient(this.baseUrl);
            this.agentClient = new window.APIClient(this.agentUrl);
        }
        const demoMode = localStorage.getItem(this.demoModeKey) === 'true';
        this.useMockData = demoMode;
    },

    async get(client, endpoint) {
        if (this.useMockData) return null;
        try {
            const activeClient = client === 'agent' ? this.agentClient : this.serverClient;
            if (!activeClient) throw new Error('API Client not initialized');
            return await activeClient.get(endpoint);
        } catch (error) {
            // Error already logged by APIClient
            return null;
        }
    },

    async post(client, endpoint, data) {
        if (this.useMockData) return null;
        try {
            const activeClient = client === 'agent' ? this.agentClient : this.serverClient;
            if (!activeClient) throw new Error('API Client not initialized');
            return await activeClient.post(endpoint, data);
        } catch (error) {
            return null;
        }
    },

    async getSyndications() {
        const data = await this.get('server', '/syndications');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.syndications : []);
    },

    async getSyndication(id) {
        const data = await this.get('server', `/syndications/${id}`);
        if (data) return data;
        return typeof SyndiData !== 'undefined' ? SyndiData.syndications.find(s => s.id === id) : null;
    },

    async getBids(syndId) {
        const data = await this.get('server', `/bids?syndId=${syndId}`);
        if (data) return data;
        return typeof SyndiData !== 'undefined' ? (SyndiData.bids || []) : [];
    },

    async getParticipants() {
        const data = await this.get('server', '/participants');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.participants : []);
    },

    async getPayments() {
        const data = await this.get('server', '/payments');
        // Standardize key access between backend (payments) and SyndiData (transactions)
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.transactions : []);
    },

    async getAgents() {
        const data = await this.get('server', '/agents');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.agents : []);
    },

    async getAllocations(syndId) {
        const data = await this.get('server', `/allocations/${syndId}`);
        if (data) return data;

        // Fix for fallback: allocations is an array in seed
        if (typeof SyndiData !== 'undefined' && SyndiData.allocations) {
            const fallback = SyndiData.allocations.find(a => a.syndId === syndId);
            return fallback ? fallback.allocations : null;
        }
        return null;
    },

    // x402/CDP Data (from Python Agent Server)
    async getX402Balance(address) {
        return await this.get('server', `/x402/balance/${address}`);
    },

    async getSyndicationEvents(syndId) {
        const data = await this.get('server', `/syndication-events/${syndId}`);
        return data || [];
    },

    async getAllSyndicationEvents(limit = 100) {
        const data = await this.get('server', `/syndication-events?limit=${limit}`);
        return data || [];
    },

    async getEscrowDetails(syndId) {
        return await this.get('server', `/x402/escrow/${syndId}`);
    },

    // Trigger AI Agent Bid (POST)
    async agentBid(agentId, syndication) {
        const payload = {
            agent_id: agentId,
            syndication: syndication,
            currentTime: window.SimulationEngine
                ? window.SimulationEngine.getCurrentDate().toISOString()
                : new Date().toISOString()
        };
        return await this.post('server', '/agents/bid', payload);
    },

    // Notify Agent of Allocation (POST)
    async agentAllocate(agentId, syndId, allocation) {
        const payload = {
            agent_id: agentId,
            syndication_id: syndId,
            allocation: allocation
        };
        return await this.post('server', '/agents/allocate', payload);
    },

    // Check if API is available
    async checkConnection() {
        if (localStorage.getItem(this.demoModeKey) === 'true') {
            this.useMockData = true;
            console.log('🎛️ Demo mode enabled (mock data)');
            return false;
        }
        if (!this.serverClient) this.init();

        try {
            let response = await fetch(`${this.baseUrl}/ready`);
            if (!response.ok) {
                response = await fetch(`${this.baseUrl}/health`);
            }
            if (response.ok) {
                this.useMockData = false;
                console.log('✅ Connected to API backend');
                return true;
            }
        } catch (e) {
            console.log('📋 Using mock data (API not available)');
        }
        this.useMockData = true;
        return false;
    },
    async setDemoMode(enabled) {
        localStorage.setItem(this.demoModeKey, enabled ? 'true' : 'false');
        this.useMockData = enabled;
        if (!enabled) {
            return await this.checkConnection();
        }
        return true;
    }
};

// Initialize and Check API connection on load
API.checkConnection();
