<<<<<<< HEAD
// ========================================
// Router - Simple Client-Side Routing
// Handles URL changes and view switching
// ========================================

const Router = {
    routes: {
        '/': 'overview',
        '/syndications/:id': 'syndication-detail',
        '/participants/:id': 'participant-portfolio',
        '/analytics': 'analytics',
        '/settings': 'settings'
    },

    // Initialize router
    init() {
        // Handle initial route
        this.handleRoute(window.location.hash.slice(1) || '/');

        // Listen for hash changes (using hash mode for simplicity without server config)
        window.addEventListener('hashchange', () => {
            this.handleRoute(window.location.hash.slice(1) || '/');
        });

        if (Config?.DEBUG) console.log('🗺️ Router initialized');
=======
/**
 * SyndiMatch Router
 * Simple hash-based client-side router
 */
const Router = {
    routes: {},
    currentRoute: null,

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
        console.log('🧭 Router initialized');
    },

    /**
     * Register a route handler
     */
    on(path, handler) {
        this.routes[path] = handler;
>>>>>>> syndication-change
    },

    /**
     * Navigate to a path
     */
    navigate(path) {
        window.location.hash = path;
    },

    /**
     * Handle route change
     */
<<<<<<< HEAD
    handleRoute(path) {
        if (path === '') path = '/';

        // Find matching route
        let matchedView = 'overview';
        let params = {};

        // Direct match
        if (this.routes[path]) {
            matchedView = this.routes[path];
        } else {
            // Pattern match
            for (const [pattern, view] of Object.entries(this.routes)) {
                const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
                const match = path.match(regex);

                if (match) {
                    matchedView = view;
                    // Extract params
                    const paramNames = (pattern.match(/:(\w+)/g) || []).map(p => p.slice(1));
                    match.slice(1).forEach((val, i) => {
                        params[paramNames[i]] = val;
                    });
                    break;
                }
            }
        }

        // Update AppState
        AppState.update({
            currentView: matchedView,
            routeParams: params,
            currentPath: path
        });

        if (Config?.DEBUG) console.log(`📍 Route: ${path} -> ${matchedView}`, params);
    }
};

// Expose globally
=======
    handleRoute() {
        const hash = window.location.hash.slice(1) || '/';
        const [path, queryString] = hash.split('?');

        const params = new URLSearchParams(queryString);

        // Find matching route
        // Simple exact match for now, could add regex for params
        let handler = this.routes[path];

        // Fallback to default if not found
        if (!handler) {
            handler = this.routes['/'] || this.routes['/overview'];
        }

        if (handler) {
            this.currentRoute = path;
            AppState.set('activeView', path.replace('/', ''));
            handler(Object.fromEntries(params));
        }
    }
};

>>>>>>> syndication-change
window.Router = Router;
