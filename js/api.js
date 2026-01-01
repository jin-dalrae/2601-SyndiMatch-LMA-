// ========================================
// API Client - Fetch data from MongoDB backend
// ========================================

const API = {
    baseUrl: 'http://localhost:3001/api',
    agentUrl: 'http://localhost:8000/api',
    useMockData: true, // Set to false when backend is running

    async get(endpoint) {
        if (this.useMockData) return null;

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn(`API error (${endpoint}):`, error.message);
            return null;
        }
    },

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

    // x402/CDP Data (from Python Agent Server)
    async getX402Balance(address) {
        try {
            const response = await fetch(`${this.agentUrl}/x402/balance/${address}`);
            if (response.ok) return await response.json();
        } catch (e) { console.warn('x402 API unavailable'); }
        // Fallback or return logic could go here, for now let caller handle null
        return null;
    },

    async getEscrowDetails(syndId) {
        try {
            const response = await fetch(`${this.agentUrl}/x402/escrow/${syndId}`);
            if (response.ok) return await response.json();
        } catch (e) { console.warn('x402 API unavailable'); }
        return null;
    },

    // Trigger AI Agent Bid (POST)
    async agentBid(agentId, syndication) {
        if (this.useMockData) return null;
        try {
            const response = await fetch(`${this.agentUrl}/agents/bid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, syndication: syndication })
            });
            if (response.ok) return await response.json();
            throw new Error(`Agent bid failed: ${response.status}`);
        } catch (e) {
            console.warn(`Agent bid error for ${agentId}:`, e.message);
            return null;
        }
    },

    // Notify Agent of Allocation (POST)
    async agentAllocate(agentId, syndId, allocation) {
        if (this.useMockData) return null;
        try {
            await fetch(`${this.agentUrl}/agents/allocate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_id: agentId,
                    syndication_id: syndId,
                    allocation: allocation
                })
            });
        } catch (e) {
            console.warn(`Agent allocation error for ${agentId}:`, e.message);
        }
    },

    // Check if API is available
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
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
    }
};

// Check API connection on load
API.checkConnection();
