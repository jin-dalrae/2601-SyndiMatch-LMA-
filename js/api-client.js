/**
 * SyndiMatch API Client
 * Robust HTTP client with caching, retries, timeouts, and error handling.
 */

class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL || Config.API_URL;
        this.timeout = Config.API_TIMEOUT || 10000;
        this.cache = new Map();
        this.pendingRequests = new Map();

        // Rate limiting
        this.requestQueue = [];
        this.maxRequestsPerSec = 10;
        this.lastRequestTime = 0;
    }

    /**
     * Core Fetch Method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${options.method || 'GET'}:${url}`;

        // Deduplication (GET only)
        if (options.method === 'GET' && this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }

        // Caching (GET only)
        if (options.method === 'GET' && !options.skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < Config.CACHE_TTL) {
                return cached.data;
            }
        }

        // Rate Limiting
        await this.throttle();

        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeout);

        const config = {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getAuthToken()}`,
                ...options.headers
            }
        };

        const requestPromise = (async () => {
            try {
                const response = await this.retryFetch(url, config);
                clearTimeout(id);

                if (!response.ok) {
                    throw await this.createError(response);
                }

                // Handle valid response
                if (response.status === 204) return null;
                const data = await response.json();

                // Cache success (GET only)
                if (options.method === 'GET') {
                    this.cache.set(cacheKey, {
                        timestamp: Date.now(),
                        data
                    });
                }

                return data;

            } catch (error) {
                clearTimeout(id);
                this.handleError(error, endpoint);
                throw error;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        })();

        if (options.method === 'GET') {
            this.pendingRequests.set(cacheKey, requestPromise);
        }

        return requestPromise;
    }

    /**
     * Fetch with Exponential Backoff Retry
     */
    async retryFetch(url, config, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fetch(url, config);
            } catch (error) {
                if (i === retries - 1) throw error;
                if (error.name === 'AbortError') throw error; // Don't retry timeouts

                const delay = Math.pow(2, i) * 1000;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    /**
     * Throttle Requests
     */
    async throttle() {
        const now = Date.now();
        const timeToWait = Math.max(0, 100 - (now - this.lastRequestTime));
        this.lastRequestTime = now + timeToWait;
        if (timeToWait > 0) {
            await new Promise(r => setTimeout(r, timeToWait));
        }
    }

    /**
     * Error Factory
     */
    async createError(response) {
        let message = `HTTP ${response.status}`;
        let details = null;
        try {
            const json = await response.json();
            message = json.error || json.message || message;
            details = json;
        } catch (e) { /* ignore json parse error */ }

        const error = new Error(message);
        error.status = response.status;
        error.details = details;
        return error;
    }

    handleError(error, endpoint) {
        console.error(`API Error [${endpoint}]:`, error.message);
        // Could dispatch global error event here
        window.dispatchEvent(new CustomEvent('api-error', { detail: error }));
    }

    getAuthToken() {
        return localStorage.getItem('auth_token') || 'mock-token';
    }

    // ==========================================
    // Public Methods
    // ==========================================

    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    clearCache() {
        this.cache.clear();
    }
}

// Export singleton
window.APIClient = APIClient;
window.api = new APIClient(); // Helper instance
