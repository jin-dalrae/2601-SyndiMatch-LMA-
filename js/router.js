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

window.Router = Router;
