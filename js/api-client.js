// ========================================
// Enhanced API Client - Production-Ready
// Replaces api.js with full CRUD, retry, caching, error handling
// ========================================

const APIClient = {
    baseUrl: Config?.API_URL || 'http://localhost:3001/api',
    agentUrl: Config?.AGENT_URL || 'http://localhost:8000/api',
    useMockData: false,

    // Request state
    pendingRequests: new Map(),
    cache: new Map(),
    rateLimiter: {
        requests: [],
        maxPerSecond: Config?.RATE_LIMIT_MAX_PER_SECOND || 10
    },

    // ========================================
    // Core Request Methods
    // ========================================

    /**
     * Enhanced GET with timeout, retry, caching, deduplication
     */
    async get(endpoint, options = {}) {
        const {
            timeout = Config?.API_TIMEOUT || 10000,
            retries = Config?.RETRY_MAX_ATTEMPTS || 3,
            cache = Config?.ENABLE_CACHE !== false,
            cacheTTL = Config?.CACHE_TTL || 300000
        } = options;

        // Check cache first
        if (cache) {
            const cached = this.getFromCache(endpoint);
            if (cached) {
                if (Config?.DEBUG) console.log(`📦 Cache hit: ${endpoint}`);
                return cached;
            }
        }

        // Check for pending request (deduplication)
        if (this.pendingRequests.has(endpoint)) {
            if (Config?.DEBUG) console.log(`⏳ Deduped request: ${endpoint}`);
            return this.pendingRequests.get(endpoint);
        }

        // Create request promise
        const requestPromise = this._fetchWithRetry(endpoint, {
            method: 'GET',
            timeout,
            retries
        });

        // Store pending request
        this.pendingRequests.set(endpoint, requestPromise);

        try {
            const data = await requestPromise;

            // Cache successful response
            if (cache && data) {
                this.setCache(endpoint, data, cacheTTL);
            }

            return data;
        } finally {
            this.pendingRequests.delete(endpoint);
        }
    },

    /**
     * POST request
     */
    async post(endpoint, data, options = {}) {
        const {
            timeout = Config?.API_TIMEOUT || 10000,
            retries = 1 // POST usually shouldn't retry
        } = options;

        return this._fetchWithRetry(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            timeout,
            retries
        });
    },

    /**
     * PUT request
     */
    async put(endpoint, data, options = {}) {
        const {
            timeout = Config?.API_TIMEOUT || 10000,
            retries = 1
        } = options;

        return this._fetchWithRetry(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            timeout,
            retries
        });
    },

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        const {
            timeout = Config?.API_TIMEOUT || 10000,
            retries = 1
        } = options;

        return this._fetchWithRetry(endpoint, {
            method: 'DELETE',
            timeout,
            retries
        });
    },

    // ========================================
    // Internal Methods
    // ========================================

    /**
     * Fetch with retry logic and exponential backoff
     */
    async _fetchWithRetry(endpoint, config) {
        const { retries = 3, timeout = 10000, ...fetchConfig } = config;
        let lastError = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Rate limiting check
                await this._checkRateLimit();

                // Execute fetch with timeout
                const data = await this._fetchWithTimeout(endpoint, fetchConfig, timeout);

                // Success!
                return data;
            } catch (error) {
                lastError = error;

                // Don't retry on client errors (4xx)
                if (error.status >= 400 && error.status < 500) {
                    throw this._formatError(endpoint, error);
                }

                // Last attempt - throw error
                if (attempt === retries - 1) {
                    throw this._formatError(endpoint, error);
                }

                // Exponential backoff
                const delay = Math.pow(2, attempt) * (Config?.RETRY_BASE_DELAY || 1000);
                if (Config?.DEBUG) {
                    console.log(`🔄 Retry ${attempt + 1}/${retries} for ${endpoint} after ${delay}ms`);
                }
                await this._sleep(delay);
            }
        }

        throw this._formatError(endpoint, lastError);
    },

    /**
     * Fetch with timeout using AbortController
     */
    async _fetchWithTimeout(endpoint, config, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const url = `${this.baseUrl}${endpoint}`;
            const headers = this._getHeaders(config.headers);

            const response = await fetch(url, {
                ...config,
                headers,
                signal: controller.signal
            });

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

    /**
     * Get headers with authentication
     */
    _getHeaders(customHeaders = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        // Add authentication if available
        if (Config?.AUTH_TOKEN) {
            headers['Authorization'] = `Bearer ${Config.AUTH_TOKEN}`;
        }

        if (Config?.API_KEY) {
            headers['X-API-Key'] = Config.API_KEY;
        }

        return headers;
    },

    /**
     * Format error with structured data
     */
    _formatError(endpoint, error) {
        const apiError = {
            endpoint,
            message: error.message,
            status: error.status || 0,
            isTimeout: error.isTimeout || false,
            timestamp: new Date().toISOString()
        };

        // Log error if debug enabled
        if (Config?.DEBUG || Config?.LOG_LEVEL === 'error') {
            console.error('❌ API Error:', apiError);
        }

        // Notify error handler if available
        if (window.ErrorHandler) {
            window.ErrorHandler.logError('API', apiError);
        }

        return { error: apiError, data: null };
    },

    /**
     * Rate limiting check
     */
    async _checkRateLimit() {
        const now = Date.now();

        // Remove old requests (older than 1 second)
        this.rateLimiter.requests = this.rateLimiter.requests.filter(t => now - t < 1000);

        // Check if we've hit the limit
        if (this.rateLimiter.requests.length >= this.rateLimiter.maxPerSecond) {
            const oldestRequest = Math.min(...this.rateLimiter.requests);
            const waitTime = 1000 - (now - oldestRequest);

            if (Config?.DEBUG) {
                console.log(`⏱️ Rate limit hit, waiting ${waitTime}ms`);
            }

            await this._sleep(waitTime);
        }

        // Record this request
        this.rateLimiter.requests.push(now);
    },

    /**
     * Sleep utility
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // ========================================
    // Cache Management
    // ========================================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    },

    setCache(key, data, ttl) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    },

    invalidateCache(pattern) {
        if (!pattern) {
            this.cache.clear();
            return;
        }

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    },

    // ========================================
    // Batch Requests
    // ========================================

    async getBatch(endpoints) {
        const promises = endpoints.map(ep => this.get(ep).catch(err => err));
        const results = await Promise.allSettled(promises);

        return results.map((result, i) => ({
            endpoint: endpoints[i],
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },

    // ========================================
    // Connection Check
    // ========================================

    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                this.useMockData = false;
                console.log('✅ Connected to API backend');
                return true;
            }
        } catch (e) {
            console.log('📋 API not available, using mock data');
        }

        this.useMockData = true;
        return false;
    }
};

// Export as global API object (backwards compatible)
window.APIClient = APIClient;

// Check connection on load
if (typeof window !== 'undefined') {
    APIClient.checkConnection();
}
