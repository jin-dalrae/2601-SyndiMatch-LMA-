// ========================================
// AppState - Centralized State Management
// Implements simple Pub/Sub pattern
// ========================================

const AppState = {
    // Initial State
    state: {
        user: null, // Current user/role
        activeSyndication: null, // Currently selected syndication
        syndications: [], // List of syndications
        participants: [], // List of participants
        bids: [], // Active bids
        marketConditions: 'neutral', // Current market state

        // UI State
        isLoading: true,
        loadingMessage: 'Initializing...',
        error: null,
        currentView: 'overview', // overview, syndication-detail, portfolio, etc.
        sidebarOpen: true,

        // System State
        connected: false, // API connection status
        lastUpdated: null
    },

    // Subscribers
    listeners: new Map(),

    /**
     * Get a specific state value
     */
    get(key) {
        return key ? this.state[key] : this.state;
    },

    /**
     * Set state value and notify listeners
     */
    set(key, value) {
        // Deep equality check could go here, for now simple strict check
        if (this.state[key] === value) return;

        const oldValue = this.state[key];
        this.state[key] = value;
        this.state.lastUpdated = new Date();

        // Notify listeners for this specific key
        this.notify(key, value, oldValue);

        if (Config?.DEBUG) {
            console.log(`🔄 State Update: ${key}`, { from: oldValue, to: value });
        }
    },

    /**
     * Update multiple state values at once
     */
    update(updates) {
        for (const [key, value] of Object.entries(updates)) {
            this.set(key, value);
        }
    },

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(key, callback);
    },

    /**
     * Unsubscribe
     */
    unsubscribe(key, callback) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).delete(callback);
        }
    },

    /**
     * Notify listeners
     */
    notify(key, value, oldValue) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value, oldValue);
                } catch (error) {
                    console.error(`❌ Error in state listener for ${key}:`, error);
                }
            });
        }
    },

    /**
     * Reset state to defaults
     */
    reset() {
        // Logic to reset specific parts of state
        this.set('error', null);
        this.set('isLoading', false);
    }
};

// Expose globally
window.AppState = AppState;
