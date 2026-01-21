/**
 * SyndiMatch Router
 * Simple hash-based client-side router
 */
const Router = {
    routes: {
        '/': 'overview',
        '/overview': 'overview',
        '/syndications/:id': 'syndication-detail',
        '/participants/:id': 'participant-portfolio',
        '/analytics': 'analytics',
        '/settings': 'settings',
        '/originate': 'originate',
        '/originator': 'originator'
    },
    currentRoute: null,

    init() {
        // Handle hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        // Handle initial load
        window.addEventListener('load', () => this.handleRoute());

        console.log('🧭 Router initialized');
    },

    /**
     * Register a route handler (legacy support)
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
        const queryParams = new URLSearchParams(queryString);

        let matchedView = 'overview';
        let params = {};

        // Pattern match logic
        for (const [pattern, view] of Object.entries(this.routes)) {
            // Convert :id patterns to regex
            const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
            const match = path.match(regex);

            if (match) {
                // If the value in routes is a function (legacy .on() support)
                if (typeof view === 'function') {
                    this.currentRoute = path;
                    const combinedParams = { ...Object.fromEntries(queryParams), ...params };
                    view(combinedParams);
                    return;
                }

                matchedView = view;
                // Extract params from path
                const paramNames = (pattern.match(/:(\w+)/g) || []).map(p => p.slice(1));
                match.slice(1).forEach((val, i) => {
                    params[paramNames[i]] = val;
                });
                break;
            }
        }

        // Fallback for sub-routes if not matched (e.g. SYND-xxx/orchestration)
        const syndMatch = path.match(/^(SYND-[^/]+)\/?(orchestration|payments|transactions)?$/i);
        if (syndMatch) {
            matchedView = 'syndication-detail';
            params.id = syndMatch[1];
            params.subPage = syndMatch[2] || 'orchestration';
        }

        // Update AppState
        if (window.AppState) {
            AppState.update({
                currentView: matchedView,
                routeParams: params,
                currentPath: path,
                activeView: matchedView.replace('view-', '')
            });

            if (params.id) {
                AppState.set('activeSyndicationId', params.id);
            }
        }

        this.currentRoute = path;

        // Dispatch event for components that don't use AppState subscription
        window.dispatchEvent(new CustomEvent('routeChanged', {
            detail: { path, view: matchedView, params }
        }));

        console.log(`📍 Route: ${path} -> ${matchedView}`, params);
    }
};

// Expose globally
window.Router = Router;
