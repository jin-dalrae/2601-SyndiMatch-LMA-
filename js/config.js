/**
 * SyndiMatch Configuration
 * Centralized environment variables and feature flags
 */
const Config = {
    // Environment
    ENV: window.ENV?.NODE_ENV || 'development',
    IS_DEV: (window.ENV?.NODE_ENV || 'development') === 'development',

    // API Endpoints
    API_URL: window.ENV?.API_URL || 'http://localhost:3001/api',
    WS_URL: window.ENV?.WS_URL || 'ws://localhost:8000/ws',

    // Feature Flags
    ENABLE_MOCK_DATA: false, // Set to false to force API usage
    ENABLE_WEBSOCKET: true,
    ENABLE_ANALYTICS: true,

    // Timeouts & intervals
    API_TIMEOUT: 15000, // 15s
    CACHE_TTL: 60000,   // 1m
    UPDATE_INTERVAL: 10000,

    // Auth (Placeholder)
    API_KEY: window.ENV?.API_KEY || 'mock-api-key',

    // Constants
    CURRENCY: 'USD',
    DATE_FORMAT: 'en-US'
};

// Freeze to prevent modification
Object.freeze(Config);

window.Config = Config;
