// ========================================
// Configuration Management
// Centralized configuration for all environments
// ========================================

const Config = {
    // API Endpoints
    API_URL: window.ENV?.API_URL || 'http://localhost:3001/api',
    AGENT_URL: window.ENV?.AGENT_URL || 'http://localhost:8000/api',
    WS_URL: window.ENV?.WS_URL || 'ws://localhost:8000/ws',

    // Feature Flags
    ENABLE_MOCK_DATA: window.ENV?.ENABLE_MOCK_DATA === 'true' || false,
    ENABLE_WEBSOCKET: window.ENV?.ENABLE_WEBSOCKET !== 'false',
    ENABLE_AUTO_REFRESH: window.ENV?.ENABLE_AUTO_REFRESH !== 'false',
    ENABLE_ANALYTICS: true,
    USE_POLLING: false, // Default to WebSocket

    // Timeouts & Intervals
    API_TIMEOUT: parseInt(window.ENV?.API_TIMEOUT) || 15000,
    RETRY_MAX_ATTEMPTS: parseInt(window.ENV?.RETRY_MAX_ATTEMPTS) || 3,
    RETRY_BASE_DELAY: parseInt(window.ENV?.RETRY_BASE_DELAY) || 1000,
    UPDATE_INTERVAL: parseInt(window.ENV?.UPDATE_INTERVAL) || 10000,
    PORTFOLIO_REFRESH_INTERVAL: parseInt(window.ENV?.PORTFOLIO_REFRESH_INTERVAL) || 10000,

    // Caching
    CACHE_TTL: parseInt(window.ENV?.CACHE_TTL) || 60000,
    ENABLE_CACHE: window.ENV?.ENABLE_CACHE !== 'false',

    // Debug & Monitoring
    DEBUG: window.ENV?.DEBUG === 'true' || false,
    LOG_LEVEL: window.ENV?.LOG_LEVEL || 'info',

    // Authentication
    API_KEY: window.ENV?.API_KEY || 'mock-api-key',
    AUTH_TOKEN: window.ENV?.AUTH_TOKEN || null,

    // Environment
    ENVIRONMENT: window.ENV?.ENVIRONMENT || 'development',
    CURRENCY: 'USD',
    DATE_FORMAT: 'en-US',

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
    console.log('🔧 Configuration loaded:', Config);
}

// Make available globally
window.Config = Config;
