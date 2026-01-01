// ========================================
// API Client - Backwards Compatible Wrapper
// Uses new APIClient with legacy method signatures
// ========================================

const API = {
    // Legacy properties
    get baseUrl() { return APIClient.baseUrl; },
    set baseUrl(val) { APIClient.baseUrl = val; },

    get agentUrl() { return APIClient.agentUrl; },
    set agentUrl(val) { APIClient.agentUrl = val; },

    get useMockData() { return APIClient.useMockData; },
    set useMockData(val) { APIClient.useMockData = val; },

    // Core methods - delegate to new client
    async get(endpoint) {
        const result = await APIClient.get(endpoint);
        // Return null on error for backwards compatibility
        return result?.error ? null : result;
    },

    async post(endpoint, data) {
        const result = await APIClient.post(endpoint, data);
        return result?.error ? null : result;
    },

    // Legacy endpoints
    async getSyndications() {
        const data = await this.get('/syndications');
        return data || SyndiData.syndications;
    },

    async getSyndication(id) {
        const data = await this.get(`/syndications/${id}`);
        return data || SyndiData.syndications.find(s => s.id === id);
    },

    async getBids(syndId) {
        const data = await this.get(`/bids?syndId=${syndId}`);
        return data || SyndiData.bids;
    },

    async getParticipants() {
        const data = await this.get('/participants');
        return data || SyndiData.participants;
    },

    async getPayments() {
        const data = await this.get('/payments');
        return data || SyndiData.transactions;
    },

    async getAgents() {
        const data = await this.get('/agents');
        return data || SyndiData.agents;
    },

    async getAllocations(syndId) {
        const data = await this.get(`/allocations/${syndId}`);
        return data || SyndiData.allocations[syndId];
    },

    async getPortfolio(participantId) {
        const data = await this.get(`/participants/${participantId}/portfolio`);
        return data; // No fallback - let role-router handle mock data
    },

    // x402/CDP Data (from Python Agent Server)
    async getX402Balance(address) {
        try {
            const url = `${this.agentUrl}/x402/balance/${address}`;
            const response = await fetch(url);
            if (response.ok) return await response.json();
        } catch (e) {
            console.warn('x402 API unavailable');
        }
        return null;
    },

    async getEscrowDetails(syndId) {
        try {
            const url = `${this.agentUrl}/x402/escrow/${syndId}`;
            const response = await fetch(url);
            if (response.ok) return await response.json();
        } catch (e) {
            console.warn('x402 API unavailable');
        }
        return null;
    },

    // Trigger AI Agent Bid (POST)
    async agentBid(agentId, syndication) {
        if (this.useMockData) return null;

        const result = await this.post('/agents/bid', {
            agent_id: agentId,
            syndication: syndication,
            currentTime: window.SimulationEngine ? window.SimulationEngine.getCurrentDate().toISOString() : null
        });

        return result;
    },

    // Notify Agent of Allocation (POST)
    async agentAllocate(agentId, syndId, allocation) {
        if (this.useMockData) return null;

        await this.post('/agents/allocate', {
            agent_id: agentId,
            syndication_id: syndId,
            allocation: allocation
        });
    },

    // Check if API is available
    async checkConnection() {
        return await APIClient.checkConnection();
    }
};

// Check API connection on load
API.checkConnection();
