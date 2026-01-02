/**
 * SyndiMatch API Client
 * Robust HTTP client with caching, retries, timeouts, and error handling.
 */

const APIClient = (function () {
    class Client {
        constructor(baseURL) {
            this.baseURL = baseURL || (typeof Config !== 'undefined' ? Config.API_URL : '');
            this.timeout = (typeof Config !== 'undefined' ? Config.API_TIMEOUT : 10000);
            this.cache = new Map();
            this.pendingRequests = new Map();

            // Rate limiting
            this.maxRequestsPerSec = 10;
            this.lastRequestTime = 0;
            this.retryCount = 3;
        }

        /**
         * Core Fetch Method
         */
        async request(endpoint, options = {}) {
            const url = `${this.baseURL}${endpoint}`;
            const method = options.method || 'GET';
            const cacheKey = `${method}:${url}`;

            // Deduplication (GET only)
            if (method === 'GET' && this.pendingRequests.has(cacheKey)) {
                return this.pendingRequests.get(cacheKey);
            }

            // Caching (GET only)
            if (method === 'GET' && !options.skipCache) {
                const cached = this.cache.get(cacheKey);
                const ttl = typeof Config !== 'undefined' ? Config.CACHE_TTL : 60000;
                if (cached && Date.now() - cached.timestamp < ttl) {
                    return cached.data;
                }
            }

            // Rate Limiting
            await this.throttle();

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const config = {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    ...options.headers
                }
            };

            // Allow body to be passed as-is if already a string or Blob/FormData
            if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData || options.body instanceof Blob)) {
                config.body = JSON.stringify(options.body);
            }

            const requestPromise = (async () => {
                try {
                    const response = await this.retryFetch(url, config, options.retries || this.retryCount);

                    if (!response.ok) {
                        throw await this.createError(response);
                    }

                    // Handle valid response
                    if (response.status === 204) return null;

                    // Safe JSON Parse
                    let data = null;
                    try {
                        data = await response.json();
                    } catch (e) {
                        console.warn('API Response was not valid JSON:', endpoint);
                        data = null;
                    }

                    // Cache success (GET only)
                    if (method === 'GET' && data) {
                        this.cache.set(cacheKey, {
                            timestamp: Date.now(),
                            data
                        });
                    }

                    return data;

                } catch (error) {
                    this.handleError(error, endpoint);
                    throw error;
                } finally {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(cacheKey);
                }
            })();

            if (method === 'GET') {
                this.pendingRequests.set(cacheKey, requestPromise);
            }

            return requestPromise;
        }

        /**
         * Fetch with Exponential Backoff Retry
         */
        async retryFetch(url, config, retries) {
            for (let i = 0; i < retries; i++) {
                try {
                    return await fetch(url, config);
                } catch (error) {
                    if (i === retries - 1 || error.name === 'AbortError') throw error;

                    const delay = Math.pow(2, i) * 1000;
                    console.log(`Retrying API [${url}] in ${delay}ms... (Attempt ${i + 1}/${retries})`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        /**
         * Throttle Requests based on maxRequestsPerSec
         */
        async throttle() {
            const now = Date.now();
            const interval = 1000 / this.maxRequestsPerSec;
            const timeToWait = Math.max(0, interval - (now - this.lastRequestTime));

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
                message = json.message || json.error || message;
                details = json;
            } catch (e) { /* ignore json parse error */ }

            const error = new Error(message);
            error.status = response.status;
            error.details = details;
            return error;
        }

        handleError(error, endpoint) {
            console.error(`API Error [${endpoint}]:`, error.message);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api-error', { detail: error }));
            }
        }

        getAuthToken() {
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem('auth_token') || 'mock-token';
            }
            return 'mock-token';
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
                body: data
            });
        }

        async put(endpoint, data, options = {}) {
            return this.request(endpoint, {
                ...options,
                method: 'PUT',
                body: data
            });
        }

        async delete(endpoint, options = {}) {
            return this.request(endpoint, { ...options, method: 'DELETE' });
        }

        clearCache() {
            this.cache.clear();
        }
    }

    return Client;
})();

// Environment-agnostic exposure
if (typeof window !== 'undefined') {
    window.APIClient = APIClient;
    window.api = new APIClient();
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
