// ========================================
// API Client - Backwards Compatible Wrapper
// Uses new APIClient with legacy method signatures
// ========================================

const API = {
    // legacy properties
    baseUrl: 'http://localhost:3001/api',
    agentUrl: 'http://localhost:8000/api',
    useMockData: false,
    demoModeKey: 'syndimatch_demo_mode',

    // Initialize clients
    init() {
        if (window.APIClient) {
            this.serverClient = window.APIClient; // the global client
        }
        const demoMode = localStorage.getItem(this.demoModeKey) === 'true';
        this.useMockData = demoMode;
    },

    async get(client, endpoint) {
        if (this.useMockData) return null;
        try {
            const activeClient = window.APIClient; // simplified to use global APIClient
            if (!activeClient) throw new Error('API Client not initialized');
            const result = await activeClient.get(endpoint);
            return result?.error ? null : result;
        } catch (error) {
            return null;
        }
    },

    async post(client, endpoint, data) {
        if (this.useMockData) return null;
        try {
            const activeClient = window.APIClient;
            if (!activeClient) throw new Error('API Client not initialized');
            const result = await activeClient.post(endpoint, data);
            return result?.error ? null : result;
        } catch (error) {
            return null;
        }
    },

    // Legacy endpoints
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
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.transactions : []);
    },

    async getAgents() {
        const data = await this.get('server', '/agents');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.agents : []);
    },

    async getAllocations(syndId) {
        const data = await this.get('server', `/allocations/${syndId}`);
        if (data) return data;

        if (typeof SyndiData !== 'undefined' && SyndiData.allocations) {
            const fallback = SyndiData.allocations.find(a => a.syndId === syndId);
            return fallback ? fallback.allocations : null;
        }
        return null;
    },

    async getPortfolio(participantId) {
        const data = await this.get('server', `/participants/${participantId}/portfolio`);
        return data;
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

        try {
            // Use the global APIClient checkConnection if initialized
            if (window.APIClient && typeof window.APIClient.checkConnection === 'function') {
                const connected = await window.APIClient.checkConnection();
                this.useMockData = !connected;
                return connected;
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

// Global export
window.API = API;

// Initialize on load
API.init();
API.checkConnection();
