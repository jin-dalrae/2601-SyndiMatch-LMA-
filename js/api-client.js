// ========================================
// SyndiMatch API Client
// One file: HTTP layer (retry, cache, dedupe, rate limit, demo mode)
// + domain methods (getSyndications, getParticipants, agentBid, etc.).
//
// Exposes both window.APIClient (low-level) and window.API (domain methods).
// All call sites use window.API.xxx — keep that signature stable.
// ========================================

const APIClient = {
    baseUrl: (typeof Config !== 'undefined' && Config.API_URL) || 'http://localhost:3001/api',
    agentUrl: (typeof Config !== 'undefined' && Config.AGENT_URL) || 'http://localhost:8000/api',
    demoModeKey: 'syndimatch_demo_mode',
    useMockData: false,

    // Request state
    pendingRequests: new Map(),
    cache: new Map(),
    rateLimiter: {
        requests: [],
        maxPerSecond: (typeof Config !== 'undefined' && Config.RATE_LIMIT_MAX_PER_SECOND) || 10
    },

    init() {
        const demoMode = localStorage.getItem(this.demoModeKey) === 'true';
        this.useMockData = demoMode;
    },

    // ========================================
    // Core HTTP (low level)
    // ========================================

    async _get(endpoint, options = {}) {
        const {
            timeout = (typeof Config !== 'undefined' && Config.API_TIMEOUT) || 10000,
            retries = (typeof Config !== 'undefined' && Config.RETRY_MAX_ATTEMPTS) || 3,
            cache = (typeof Config !== 'undefined' && Config.ENABLE_CACHE !== false),
            cacheTTL = (typeof Config !== 'undefined' && Config.CACHE_TTL) || 300000
        } = options;

        if (cache) {
            const cached = this.getFromCache(endpoint);
            if (cached) {
                if (typeof Config !== 'undefined' && Config.DEBUG) console.log(`📦 Cache hit: ${endpoint}`);
                return cached;
            }
        }

        if (this.pendingRequests.has(endpoint)) {
            if (typeof Config !== 'undefined' && Config.DEBUG) console.log(`⏳ Deduped request: ${endpoint}`);
            return this.pendingRequests.get(endpoint);
        }

        const requestPromise = this._fetchWithRetry(endpoint, { method: 'GET', timeout, retries });
        this.pendingRequests.set(endpoint, requestPromise);

        try {
            const data = await requestPromise;
            if (cache && data) this.setCache(endpoint, data, cacheTTL);
            return data;
        } finally {
            this.pendingRequests.delete(endpoint);
        }
    },

    async _post(endpoint, data, options = {}) {
        const {
            timeout = (typeof Config !== 'undefined' && Config.API_TIMEOUT) || 10000,
            retries = 1
        } = options;
        return this._fetchWithRetry(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            timeout,
            retries
        });
    },

    async _put(endpoint, data, options = {}) {
        const { timeout = 10000, retries = 1 } = options;
        return this._fetchWithRetry(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            timeout,
            retries
        });
    },

    async _delete(endpoint, options = {}) {
        const { timeout = 10000, retries = 1 } = options;
        return this._fetchWithRetry(endpoint, { method: 'DELETE', timeout, retries });
    },

    async _fetchWithRetry(endpoint, config) {
        const { retries = 3, timeout = 10000, ...fetchConfig } = config;
        let lastError = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                await this._checkRateLimit();
                return await this._fetchWithTimeout(endpoint, fetchConfig, timeout);
            } catch (error) {
                lastError = error;
                if (error.status >= 400 && error.status < 500) {
                    throw this._formatError(endpoint, error);
                }
                if (attempt === retries - 1) {
                    throw this._formatError(endpoint, error);
                }
                const delay = Math.pow(2, attempt) * ((typeof Config !== 'undefined' && Config.RETRY_BASE_DELAY) || 1000);
                if (typeof Config !== 'undefined' && Config.DEBUG) {
                    console.log(`🔄 Retry ${attempt + 1}/${retries} for ${endpoint} after ${delay}ms`);
                }
                await this._sleep(delay);
            }
        }
        throw this._formatError(endpoint, lastError);
    },

    async _fetchWithTimeout(endpoint, config, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const headers = this._getHeaders(config.headers);
            const response = await fetch(url, { ...config, headers, signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                error.response = response;
                throw error;
            }
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                const timeoutError = new Error(`Request timeout after ${timeout}ms`);
                timeoutError.isTimeout = true;
                throw timeoutError;
            }
            throw error;
        }
    },

    _getHeaders(customHeaders = {}) {
        const headers = { 'Content-Type': 'application/json', ...customHeaders };
        if (typeof Config !== 'undefined' && Config.AUTH_TOKEN) {
            headers['Authorization'] = `Bearer ${Config.AUTH_TOKEN}`;
        }
        if (typeof Config !== 'undefined' && Config.API_KEY) {
            headers['X-API-Key'] = Config.API_KEY;
        }
        return headers;
    },

    _formatError(endpoint, error) {
        const apiError = {
            endpoint,
            message: error.message,
            status: error.status || 0,
            isTimeout: error.isTimeout || false,
            timestamp: new Date().toISOString()
        };
        if ((typeof Config !== 'undefined' && Config.DEBUG) || (typeof Config !== 'undefined' && Config.LOG_LEVEL === 'error')) {
            console.error('❌ API Error:', apiError);
        }
        if (window.ErrorHandler) window.ErrorHandler.logError('API', apiError);
        return { error: apiError, data: null };
    },

    async _checkRateLimit() {
        const now = Date.now();
        this.rateLimiter.requests = this.rateLimiter.requests.filter(t => now - t < 1000);
        if (this.rateLimiter.requests.length >= this.rateLimiter.maxPerSecond) {
            const oldestRequest = Math.min(...this.rateLimiter.requests);
            const waitTime = 1000 - (now - oldestRequest);
            if (typeof Config !== 'undefined' && Config.DEBUG) {
                console.log(`⏱️ Rate limit hit, waiting ${waitTime}ms`);
            }
            await this._sleep(waitTime);
        }
        this.rateLimiter.requests.push(now);
    },

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // ========================================
    // Cache
    // ========================================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        return cached.data;
    },

    setCache(key, data, ttl) {
        this.cache.set(key, { data, timestamp: Date.now(), ttl });
    },

    invalidateCache(pattern) {
        if (!pattern) { this.cache.clear(); return; }
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) this.cache.delete(key);
        }
    },

    // ========================================
    // Domain layer — call sites use these
    // Legacy signature `get(client, endpoint)` keeps backward compat;
    // `client` arg is ignored (all calls used to route through "server").
    // ========================================

    async get(clientOrEndpoint, maybeEndpoint) {
        const endpoint = maybeEndpoint !== undefined ? maybeEndpoint : clientOrEndpoint;
        if (this.useMockData) return null;
        try {
            const result = await this._get(endpoint);
            return result?.error ? null : result;
        } catch (error) {
            return null;
        }
    },

    async post(clientOrEndpoint, endpointOrData, maybeData) {
        let endpoint, data;
        if (maybeData !== undefined) {
            endpoint = endpointOrData;
            data = maybeData;
        } else {
            endpoint = clientOrEndpoint;
            data = endpointOrData;
        }
        if (this.useMockData) return null;
        try {
            const result = await this._post(endpoint, data);
            return result?.error ? null : result;
        } catch (error) {
            return null;
        }
    },

    // High-level fetchers — fall back to SyndiData mock when API is down
    async getSyndications() {
        const data = await this.get('/syndications');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.syndications : []);
    },

    async getSyndication(id) {
        const data = await this.get(`/syndications/${id}`);
        if (data) return data;
        return typeof SyndiData !== 'undefined' ? SyndiData.syndications.find(s => s.id === id) : null;
    },

    async getBids(syndId) {
        const data = await this.get(`/bids?syndId=${syndId}`);
        if (data) return data;
        return typeof SyndiData !== 'undefined' ? (SyndiData.bids || []) : [];
    },

    async getParticipants() {
        const data = await this.get('/participants');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.participants : []);
    },

    async getPayments() {
        const data = await this.get('/payments');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.transactions : []);
    },

    async getAgents() {
        const data = await this.get('/agents');
        return data || (typeof SyndiData !== 'undefined' ? SyndiData.agents : []);
    },

    async getAllocations(syndId) {
        const data = await this.get(`/allocations/${syndId}`);
        if (data) return data;
        if (typeof SyndiData !== 'undefined' && SyndiData.allocations) {
            const fallback = SyndiData.allocations.find(a => a.syndId === syndId);
            return fallback ? fallback.allocations : null;
        }
        return null;
    },

    async getPortfolio(participantId) {
        return await this.get(`/participants/${participantId}/portfolio`);
    },

    async getX402Balance(address) {
        return await this.get(`/x402/balance/${address}`);
    },

    async getSyndicationEvents(syndId) {
        const data = await this.get(`/syndication-events/${syndId}`);
        return data || [];
    },

    async getAllSyndicationEvents(limit = 100) {
        const data = await this.get(`/syndication-events?limit=${limit}`);
        return data || [];
    },

    async getEscrowDetails(syndId) {
        return await this.get(`/x402/escrow/${syndId}`);
    },

    async agentBid(agentId, syndication) {
        const payload = {
            agent_id: agentId,
            syndication: syndication,
            currentTime: window.SimulationEngine
                ? window.SimulationEngine.getCurrentDate().toISOString()
                : new Date().toISOString()
        };
        return await this.post('/agents/bid', payload);
    },

    async agentAllocate(agentId, syndId, allocation) {
        const payload = { agent_id: agentId, syndication_id: syndId, allocation };
        return await this.post('/agents/allocate', payload);
    },

    // Batch + connection
    async getBatch(endpoints) {
        const promises = endpoints.map(ep => this.get(ep).catch(err => err));
        const results = await Promise.allSettled(promises);
        return results.map((result, i) => ({
            endpoint: endpoints[i],
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },

    async checkConnection() {
        if (localStorage.getItem(this.demoModeKey) === 'true') {
            this.useMockData = true;
            console.log('🎛️ Demo mode enabled (mock data)');
            return false;
        }
        try {
            const readyResponse = await fetch(`${this.baseUrl}/ready`, {
                signal: AbortSignal.timeout(3000)
            }).catch(() => null);
            let response = readyResponse;
            if (!response || !response.ok) {
                response = await fetch(`${this.baseUrl}/health`, {
                    signal: AbortSignal.timeout(3000)
                }).catch(() => null);
            }
            if (response && response.ok) {
                this.useMockData = false;
                console.log('✅ Connected to API backend');
                return true;
            }
        } catch (e) {
            console.log('📋 API not available, using mock data');
        }
        this.useMockData = true;
        return false;
    },

    async setDemoMode(enabled) {
        localStorage.setItem(this.demoModeKey, enabled ? 'true' : 'false');
        this.useMockData = enabled;
        if (!enabled) return await this.checkConnection();
        return true;
    }
};

// Export under both names — APIClient (modern) and API (legacy, what all call sites use)
window.APIClient = APIClient;
window.API = APIClient;

// Bootstrap
if (typeof window !== 'undefined') {
    APIClient.init();
    APIClient.checkConnection();
}
