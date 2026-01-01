/**
 * SyndiMatch App State
 * Centralized state management using Pub/Sub pattern
 */
const AppState = {
    // State Store
    data: {
        activeView: 'overview',
        currentUser: null,
        currentRole: 'platform',
        isLoading: false,
        theme: 'light',
        syndications: [],
        marketConditions: 'neutral',
        notifications: [],
        agentConnected: false
    },

    // Subscribers
    subscribers: {},

    /**
     * Initialize State
     */
    init() {
        // Load persistable state
        const saved = localStorage.getItem('syndimatch_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
            } catch (e) {
                console.warn('Failed to load saved state');
            }
        }
        console.log('📦 AppState initialized');
    },

    /**
     * Get State Value
     */
    get(key) {
        return key ? this.data[key] : this.data;
    },

    /**
     * Set State Value and Notify
     */
    set(key, value, persist = false) {
        if (this.data[key] === value) return; // No change

        const oldValue = this.data[key];
        this.data[key] = value;

        this.notify(key, value, oldValue);

        if (persist) {
            this.persist();
        }
    },

    /**
     * Subscribe to changes
     */
    subscribe(key, callback) {
        if (!this.subscribers[key]) {
            this.subscribers[key] = [];
        }
        this.subscribers[key].push(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers[key] = this.subscribers[key].filter(cb => cb !== callback);
        };
    },

    /**
     * Notify subscribers
     */
    notify(key, newValue, oldValue) {
        if (this.subscribers[key]) {
            this.subscribers[key].forEach(cb => cb(newValue, oldValue));
        }
        // Emit global event for decoupled components
        window.dispatchEvent(new CustomEvent('stateChange', {
            detail: { key, newValue, oldValue }
        }));
    },

    /**
     * Persist to LocalStorage
     */
    persist() {
        const persistable = {
            theme: this.data.theme,
            currentRole: this.data.currentRole
        };
        localStorage.setItem('syndimatch_state', JSON.stringify(persistable));
    }
};

window.AppState = AppState;
