/**
 * SyndiMatch Router
 * History API-based client-side router (no hash #)
 * Routes persist on page refresh
 */
const Router = {
    routes: {
        '/': 'landing',
        '/landing': 'landing',
        '/overview': 'overview',
        '/orchestration': 'orchestration',
        '/payments': 'payments',
        '/analytics': 'analytics',
        '/transactions': 'transactions',
        '/settings': 'settings',
        '/originate': 'originate',
        '/originator': 'originator',
        '/participant': 'participant',
        '/agent-rules': 'agent-rules',
        '/syndication-process': 'syndication-process',
        '/syndications/:id': 'syndication-detail',
        '/participants/:id': 'participant-portfolio'
    },
    currentRoute: null,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => this.handleRoute());

        // Handle initial page load - use current pathname
        this.handleRoute();

        // Intercept all link clicks for SPA navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link) {
                const href = link.getAttribute('href');
                // Only handle internal links (starting with /)
                if (href && href.startsWith('/') && !href.startsWith('//')) {
                    e.preventDefault();
                    this.navigate(href);
                }
            }
        });

        console.log('🧭 Router initialized (History API)');
    },

    /**
     * Register a route handler (legacy support)
     */
    on(path, handler) {
        this.routes[path] = handler;
    },

    /**
     * Navigate to a path using History API
     */
    navigate(path) {
        // Don't navigate if already on this path
        if (window.location.pathname === path) return;

        window.history.pushState({}, '', path);
        this.handleRoute();
    },

    /**
     * Handle route change
     */
    handleRoute() {
        // Get the actual pathname (no hash)
        const path = window.location.pathname || '/';
        const queryParams = new URLSearchParams(window.location.search);

        let matchedView = null;
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

        // Fallback for sub-routes if not matched (e.g. /SYND-xxx/orchestration)
        const syndMatch = path.match(/^\/(SYND-[^\/]+)\/?(?:orchestration|payments|transactions)?$/i);
        if (syndMatch) {
            matchedView = 'syndication-detail';
            params.id = syndMatch[1];
            params.subPage = syndMatch[2] || 'orchestration';
        }

        // Default to overview if no route matched (not landing, as that requires explicit /)
        if (!matchedView) {
            matchedView = 'overview';
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
