/**
 * SyndiMatch Market Data Provider
 * Isolates mock/simulated data from real data sources.
 * 
 * PURPOSE:
 * - Single location for all mock data
 * - Clear separation between simulation and production modes
 * - Enables easy swap to real data sources
 * - Prevents Math.random() from polluting business logic
 * 
 * USAGE:
 * - Components call MarketDataProvider methods
 * - Provider returns data based on current mode (mock/live)
 * - All randomness is contained here, not in views or services
 */

const MarketDataProvider = {
    // Mode: 'mock' or 'live'
    mode: 'mock',

    // Cache for mock data consistency within a session
    _cache: {},

    /**
     * Set provider mode
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`📊 MarketDataProvider mode: ${mode}`);
    },

    /**
     * Check if in mock mode
     */
    isMockMode() {
        return this.mode === 'mock';
    },

    // ===========================================
    // RATE DATA
    // ===========================================

    /**
     * Get current base rate
     * In production: would fetch from rate service API
     */
    async getBaseRate(rateType = 'SOFR') {
        if (this.mode === 'live') {
            throw new Error(`Live mode not yet implemented for getBaseRate(${rateType})`);
        }

        // Mock rates (as of late 2025)
        const mockRates = {
            'SOFR': 4.35,
            'LIBOR': 4.50,
            'PRIME': 7.50,
            'T-BILL': 4.25,
            'FED_FUNDS': 4.33
        };
        return mockRates[rateType.toUpperCase()] || 4.35;
    },

    // ===========================================
    // MARKET CONDITIONS
    // ===========================================

    /**
     * Get current market condition
     * Used for demand/supply modeling
     */
    async getMarketCondition() {
        if (this._cache.marketCondition) {
            return this._cache.marketCondition;
        }

        // In production: would derive from market indicators
        // For mock: return consistent value per session
        const conditions = ['bull', 'neutral', 'bear'];
        const index = Math.floor(Math.random() * conditions.length);
        this._cache.marketCondition = conditions[index];
        return this._cache.marketCondition;
    },

    /**
     * Invalidate market condition cache to allow fluctuations
     */
    invalidateMarketCondition() {
        delete this._cache.marketCondition;
        console.log('📊 Market condition cache invalidated');
    },

    /**
     * Get demand multiplier based on market conditions
     */
    async getDemandMultiplier() {
        const condition = await this.getMarketCondition();
        const multipliers = {
            'bull': 1.2,
            'neutral': 1.0,
            'bear': 0.8
        };
        return multipliers[condition] || 1.0;
    },

    // ===========================================
    // SPREAD HEATMAP DATA
    // ===========================================

    /**
     * Get spread heatmap data by rating and sector
     * 
     * Returns: { data: number[][], ratings: string[], sectors: string[] }
     * 
     * NOTE: In production, this would aggregate actual transaction data
     * with proper time windows and sample sizes.
     */
    getSpreadHeatmapData(options = {}) {
        const {
            timeWindow = '30d',  // Not used in mock, but documents intent
            aggregation = 'median'  // 'median', 'avg', 'last'
        } = options;

        const ratings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B'];
        const sectors = ['Tech', 'Healthcare', 'Energy', 'Finance', 'Industrial', 'Consumer'];

        // Generate deterministic mock data based on rating/sector
        // Higher rating = tighter spreads, more volatile sectors = wider
        const data = ratings.map((rating, ri) => {
            return sectors.map((sector, si) => {
                const baseSpread = 150 + ri * 50;  // Rating effect
                const sectorAdjust = si * 10;       // Sector effect
                const noise = Math.floor(Math.random() * 5); // Add small variability for realism
                return baseSpread + sectorAdjust + noise;
            });
        });

        return {
            data,
            ratings,
            sectors,
            timeWindow,
            aggregation,
            disclaimer: 'Mock data - single point estimate, no sample size or dispersion'
        };
    },

    // ===========================================
    // PARTICIPANT SIMULATION DATA
    // ===========================================

    /**
     * Generate simulated bid count for a syndication
     * Used ONLY when Python backend is disconnected
     */
    getSimulatedBidCount() {
        // Deterministic within session
        if (!this._cache.bidCount) {
            this._cache.bidCount = 5 + Math.floor(Math.random() * 5);
        }
        return this._cache.bidCount;
    },

    /**
     * Get simulated auction data
     */
    getSimulatedAuctionData(syndication) {
        return {
            rounds: 3,
            spreadImprovement: 15,
            finalSubscription: 105,
            winningBids: 5,
            isSimulated: true
        };
    },

    // ===========================================
    // ANALYTICS MOCK DATA
    // ===========================================

    /**
     * Get mock volume data for charts
     * 
     * NOTE: This is activity volume, not liquidity or risk-adjusted volume.
     * Real analytics would include deal count, avg size, and clearing speed.
     */
    getVolumeChartData(options = {}) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Consistent mock data
        const volumes = [120, 145, 132, 168, 155, 178, 192, 185, 210, 198, 215, 230];

        return {
            labels: months,
            values: volumes,
            unit: 'millions',
            disclaimer: 'Shows activity volume only. Does not reflect liquidity, risk appetite, or pricing power.'
        };
    },

    /**
     * Get mock leaderboard data
     * 
     * CAUTION: Leaderboards without normalization can create perverse incentives.
     */
    getLeaderboardData(options = {}) {
        const {
            metric = 'volume',
            timeWindow = 'ytd'
        } = options;

        return {
            entries: [
                { rank: 1, name: 'JPMorgan Chase', value: 4200, deals: 28 },
                { rank: 2, name: 'Bank of America', value: 3800, deals: 25 },
                { rank: 3, name: 'Citigroup', value: 3500, deals: 23 },
                { rank: 4, name: 'Goldman Sachs', value: 3100, deals: 20 },
                { rank: 5, name: 'Wells Fargo', value: 2800, deals: 18 }
            ],
            metric,
            timeWindow,
            disclaimer: 'Ranking by raw volume. Not normalized by deal difficulty, risk, or tenor.'
        };
    },

    // ===========================================
    // CACHE MANAGEMENT
    // ===========================================

    /**
     * Clear cache (call on simulation reset)
     */
    clearCache() {
        this._cache = {};
        console.log('📊 MarketDataProvider cache cleared');
    },

    /**
     * Reset for new simulation
     */
    reset() {
        this.clearCache();
        console.log('📊 MarketDataProvider reset (mode preserved)');
    }
};

// Export
window.MarketDataProvider = MarketDataProvider;
