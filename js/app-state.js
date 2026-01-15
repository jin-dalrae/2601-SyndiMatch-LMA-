/**
 * SyndiMatch App State
 * Centralized state management using Pub/Sub pattern
 */
const AppState = {
    // Initial State
    data: {
        // User/Role state
        currentRole: 'platform',
        currentUser: null,

        // Navigation state
        currentView: 'overview',
        currentPath: '/',
        activeView: 'overview',
        routeParams: {},
        activeSyndicationId: null,

        // UI status state
        isLoading: false,
        loadingMessage: 'Initializing...',
        error: null,
        sidebarOpen: true,

        // System state
        connected: false,
        marketConditions: 'neutral',
        lastUpdated: null,
        theme: 'light',
        notifications: [],
        agentConnected: false
    },

    // Subscribers (Set for deduplication)
    listeners: new Map(),

    // Allowed keys for persistence
    persistableKeys: ['theme', 'currentRole'],

    /**
     * Initialize State
     */
    init() {
        const saved = localStorage.getItem('syndimatch_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                for (const key of this.persistableKeys) {
                    if (parsed[key] !== undefined) {
                        this.data[key] = parsed[key];
                    }
                }
            } catch (e) {
                console.warn('Failed to load saved state:', e.message);
            }
        }
        console.log('📦 AppState initialized');
    },

    /**
     * Get a specific state value
     */
    get(key) {
        if (key) {
            const value = this.data[key];
            if (value !== null && typeof value === 'object') {
                return Array.isArray(value) ? [...value] : { ...value };
            }
            return value;
        }
        return { ...this.data };
    },

    /**
     * Set state value and notify listeners
     */
    set(key, value, persist = false) {
        if (this._isEqual(this.data[key], value)) return;

        const oldValue = this.data[key];
        this.data[key] = value;
        this.data.lastUpdated = new Date();

        this.notify(key, value, oldValue);

        if (persist && this.persistableKeys.includes(key)) {
            this.persist();
        }
    },

    /**
     * Update multiple state values at once
     */
    update(updates, persist = false) {
        const changes = [];

        for (const [key, value] of Object.entries(updates)) {
            if (!this._isEqual(this.data[key], value)) {
                const oldValue = this.data[key];
                this.data[key] = value;
                changes.push({ key, newValue: value, oldValue });
            }
        }

        this.data.lastUpdated = new Date();

        // Notify for all changes
        for (const change of changes) {
            this.notify(change.key, change.newValue, change.oldValue);
        }

        if (persist) {
            this.persist();
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

        // Emit global event for decoupled components
        window.dispatchEvent(new CustomEvent('stateChange', {
            detail: { key, newValue: value, oldValue }
        }));
    },

    /**
     * Persist whitelisted keys to LocalStorage
     */
    persist() {
        const persistable = {};
        for (const key of this.persistableKeys) {
            persistable[key] = this.data[key];
        }
        localStorage.setItem('syndimatch_state', JSON.stringify(persistable));
    },

    /**
     * Simple equality check
     */
    _isEqual(a, b) {
        if (a === b) return true;
        if (a === null || b === null) return false;
        if (typeof a !== typeof b) return false;

        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            return a.every((val, i) => val === b[i]);
        }

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length) return false;
            return keysA.every(key => a[key] === b[key]);
        }

        return false;
    },

    /**
     * Reset state to defaults
     */
    reset() {
        this.set('error', null);
        this.set('isLoading', false);
    }
};

// Expose globally
window.AppState = AppState;
