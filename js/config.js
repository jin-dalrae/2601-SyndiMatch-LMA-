// ========================================
// Configuration Management
// Centralized configuration for all environments
// ========================================

const Config = {
    // API Endpoints
    API_URL: window.ENV?.API_URL || 'http://localhost:3001/api',
    AGENT_URL: window.ENV?.AGENT_URL || 'http://localhost:8000/api',
    WS_URL: window.ENV?.WS_URL || 'ws://localhost:8765',

    // Feature Flags
    ENABLE_MOCK_DATA: window.ENV?.ENABLE_MOCK_DATA === 'true' || false,
    ENABLE_WEBSOCKET: window.ENV?.ENABLE_WEBSOCKET !== 'false',
    ENABLE_AUTO_REFRESH: window.ENV?.ENABLE_AUTO_REFRESH !== 'false',

    // Timeouts & Intervals
    API_TIMEOUT: parseInt(window.ENV?.API_TIMEOUT) || 10000, // 10 seconds
    RETRY_MAX_ATTEMPTS: parseInt(window.ENV?.RETRY_MAX_ATTEMPTS) || 3,
    RETRY_BASE_DELAY: parseInt(window.ENV?.RETRY_BASE_DELAY) || 1000, // 1 second
    UPDATE_INTERVAL: parseInt(window.ENV?.UPDATE_INTERVAL) || 10000, // 10 seconds
    PORTFOLIO_REFRESH_INTERVAL: parseInt(window.ENV?.PORTFOLIO_REFRESH_INTERVAL) || 10000,

    // Rate Limiting
    RATE_LIMIT_MAX_PER_SECOND: parseInt(window.ENV?.RATE_LIMIT_MAX_PER_SECOND) || 10,

    // Caching
    CACHE_TTL: parseInt(window.ENV?.CACHE_TTL) || 300000, // 5 minutes
    ENABLE_CACHE: window.ENV?.ENABLE_CACHE !== 'false',

    // Debug & Monitoring
    DEBUG: window.ENV?.DEBUG === 'true' || false,
    LOG_LEVEL: window.ENV?.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'

    // Authentication
    API_KEY: window.ENV?.API_KEY || null,
    AUTH_TOKEN: window.ENV?.AUTH_TOKEN || null,

    // Environment
    ENVIRONMENT: window.ENV?.ENVIRONMENT || 'development', // 'development', 'staging', 'production'

    // Helper methods
    isDevelopment() {
        return this.ENVIRONMENT === 'development';
    },

    isProduction() {
        return this.ENVIRONMENT === 'production';
    },

    log(...args) {
        if (this.DEBUG || this.LOG_LEVEL === 'debug') {
            console.log('[Config]', ...args);
        }
    }
};

// Log configuration on load (only in development)
if (Config.isDevelopment()) {
    console.log('🔧 Configuration loaded:', {
        environment: Config.ENVIRONMENT,
        apiUrl: Config.API_URL,
        agentUrl: Config.AGENT_URL,
        wsUrl: Config.WS_URL,
        features: {
            mockData: Config.ENABLE_MOCK_DATA,
            websocket: Config.ENABLE_WEBSOCKET,
            autoRefresh: Config.ENABLE_AUTO_REFRESH,
            cache: Config.ENABLE_CACHE
        }
    });
}

// Make available globally
window.Config = Config;
