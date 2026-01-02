/**
 * SyndiMatch App State
 * Centralized state management using Pub/Sub pattern
 * 
 * SCOPE: This is a UI/session state container, NOT application state.
 * - UI state: theme, activeView, isLoading, notifications
 * - Session state: currentUser, currentRole
 * 
 * Market state (syndications, bids, allocations) lives in:
 * - SimulationEngine (for simulation mode)
 * - MongoDB via API (for production mode)
 * 
 * Do NOT store syndication lifecycle data here to avoid dual sources of truth.
 */
const AppState = {
    // State Store - UI/session state only
    data: {
        activeView: 'overview',
        currentUser: null,
        currentRole: 'platform',
        isLoading: false,
        theme: 'light',
        marketConditions: 'neutral',
        notifications: [],
        agentConnected: false
    },

    // Subscribers (Map for deduplication)
    subscribers: {},

    // Allowed keys for persistence (whitelist)
    persistableKeys: ['theme', 'currentRole'],

    /**
     * Initialize State
     */
    init() {
        // Load persistable state with whitelist validation
        const saved = localStorage.getItem('syndimatch_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Only merge whitelisted keys to prevent stale/corrupted data injection
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
     * Get State Value (returns copy to prevent external mutation)
     */
    get(key) {
        if (key) {
            const value = this.data[key];
            // Return copy of objects/arrays to prevent mutation
            if (value !== null && typeof value === 'object') {
                return Array.isArray(value) ? [...value] : { ...value };
            }
            return value;
        }
        // Return shallow copy of entire state
        return { ...this.data };
    },

    /**
     * Set State Value and Notify
     */
    set(key, value, persist = false) {
        // Deep equality check for objects/arrays
        if (this._isEqual(this.data[key], value)) return;

        const oldValue = this.data[key];
        this.data[key] = value;

        this.notify(key, value, oldValue);

        if (persist && this.persistableKeys.includes(key)) {
            this.persist();
        }
    },

    /**
     * Batch update multiple keys (single notification cycle)
     */
    batch(updates, persist = false) {
        const changes = [];

        for (const [key, value] of Object.entries(updates)) {
            if (!this._isEqual(this.data[key], value)) {
                const oldValue = this.data[key];
                this.data[key] = value;
                changes.push({ key, newValue: value, oldValue });
            }
        }

        // Notify all changes
        for (const change of changes) {
            this.notify(change.key, change.newValue, change.oldValue);
        }

        if (persist) {
            this.persist();
        }
    },

    /**
     * Subscribe to changes (with deduplication)
     */
    subscribe(key, callback) {
        if (!this.subscribers[key]) {
            this.subscribers[key] = new Set();
        }

        // Set automatically deduplicates - same callback won't be added twice
        this.subscribers[key].add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers[key]?.delete(callback);
        };
    },

    /**
     * Notify subscribers
     */
    notify(key, newValue, oldValue) {
        if (this.subscribers[key]) {
            this.subscribers[key].forEach(cb => {
                try {
                    cb(newValue, oldValue);
                } catch (e) {
                    console.error(`AppState subscriber error for ${key}:`, e);
                }
            });
        }
        // Emit global event for decoupled components
        window.dispatchEvent(new CustomEvent('stateChange', {
            detail: { key, newValue, oldValue }
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
     * Simple equality check (handles primitives, arrays, objects)
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
    }
};

window.AppState = AppState;
