/**
 * SyndiMatch Metrics Service
 * Centralized calculation layer for all financial and portfolio metrics.
 * 
 * PURPOSE:
 * - Single source of truth for metric calculations
 * - Separates calculation logic from view rendering
 * - Enables testing, auditing, and reuse
 * - Documents metric definitions clearly
 * 
 * USAGE:
 * - Views call MetricsService.calculate*() methods
 * - Views do NOT compute metrics directly
 * - Mock data is isolated in MarketDataProvider
 */

const MetricsService = {

    // ===========================================
    // UNIT CONVENTIONS
    // ===========================================
    // Internal: DOLLARS (e.g., 150000000)
    // Display: MILLIONS for amounts (e.g., "$150M")
    // Spreads: BASIS POINTS (e.g., 400 = 4.00%)
    // Rates: PERCENTAGE (e.g., 7.5 = 7.5%)

    /**
     * Convert dollars to millions for display
     */
    toMillions(dollars) {
        return dollars / 1000000;
    },

    /**
     * Convert millions to dollars for calculations
     */
    fromMillions(millions) {
        return millions * 1000000;
    },

    /**
     * Format currency for display
     */
    formatCurrency(dollars, showDecimals = false) {
        const millions = this.toMillions(dollars);
        if (showDecimals) {
            return `$${millions.toFixed(2)}M`;
        }
        return `$${Math.round(millions).toLocaleString()}M`;
    },

    // ===========================================
    // YIELD CALCULATIONS
    // ===========================================

    /**
     * Calculate all-in yield from base rate and spread
     * 
     * @param {string|number} baseRate - Base rate (e.g., "SOFR" or 4.35)
     * @param {number} spreadBps - Spread in basis points
     * @returns {number} All-in yield as percentage
     */
    calculateAllInYield(baseRate, spreadBps) {
        const rate = this.resolveBaseRate(baseRate);
        return rate + (spreadBps / 100);
    },

    /**
     * Resolve base rate string to numeric value
     * NOTE: In production, this would fetch from a rate service
     */
    resolveBaseRate(baseRate) {
        if (typeof baseRate === 'number') return baseRate;

        // Current market approximations (mock - should be fetched from rate service)
        const rates = {
            'SOFR': 4.35,
            'LIBOR': 4.50,
            'PRIME': 7.50,
            'T-BILL': 4.25
        };
        return rates[baseRate?.toUpperCase()] || 4.35;
    },

    /**
     * Calculate risk-adjusted yield (heuristic, not PD/LGD based)
     * 
     * DISCLAIMER: This is a simplified heuristic, not a proper credit model.
     * Real risk-adjusted returns require PD, LGD, and tenor inputs.
     * 
     * @param {number} allInYield - All-in yield percentage
     * @param {string} rating - Credit rating (e.g., "BBB")
     * @returns {number} Heuristic risk-adjusted yield
     */
    calculateHeuristicRiskAdjustedYield(allInYield, rating) {
        // Expected loss assumptions by rating bucket (SIMPLIFIED)
        // Real model would use historical PD/LGD by rating notch and tenor
        const expectedLoss = this.getRatingExpectedLoss(rating);
        return allInYield - expectedLoss;
    },

    /**
     * Get expected loss estimate by rating (HEURISTIC ONLY)
     */
    getRatingExpectedLoss(rating) {
        if (!rating) return 0.5;
        const firstChar = rating.charAt(0).toUpperCase();

        // Rough annual expected loss by rating bucket
        // Source: Historical averages (simplified)
        const lossRates = {
            'A': 0.10,   // Investment grade
            'B': 1.50,   // Speculative grade
            'C': 5.00    // High yield / distressed
        };
        return lossRates[firstChar] || 0.5;
    },

    // ===========================================
    // SUBSCRIPTION & ALLOCATION METRICS
    // ===========================================

    /**
     * Calculate subscription rate
     * @param {number} totalCommitted - Total committed amount (dollars)
     * @param {number} syndicationTarget - Target amount (dollars)
     * @returns {number} Subscription rate as decimal (e.g., 1.05 for 105%)
     */
    calculateSubscriptionRate(totalCommitted, syndicationTarget) {
        if (syndicationTarget <= 0) return 0;
        return totalCommitted / syndicationTarget;
    },

    /**
     * Calculate oversubscription ratio
     */
    calculateOversubscription(totalCommitted, syndicationTarget) {
        const rate = this.calculateSubscriptionRate(totalCommitted, syndicationTarget);
        return Math.max(0, rate - 1);
    },

    /**
     * Calculate pro-rata scale factor for allocation
     */
    calculateScaleFactor(totalBids, targetAmount) {
        if (totalBids <= targetAmount) return 1.0;
        return targetAmount / totalBids;
    },

    // ===========================================
    // SPREAD ANALYTICS
    // ===========================================

    /**
     * Calculate spread statistics from bid array
     * @param {Array} bids - Array of bid objects with spread_bid property
     * @returns {Object} Spread statistics
     */
    calculateSpreadStats(bids) {
        if (!bids || bids.length === 0) {
            return { min: 0, max: 0, avg: 0, median: 0, range: 0 };
        }

        const spreads = bids.map(b => b.spread_bid || b.spread || 0).sort((a, b) => a - b);
        const n = spreads.length;

        return {
            min: spreads[0],
            max: spreads[n - 1],
            avg: spreads.reduce((a, b) => a + b, 0) / n,
            median: this.calculateMedian(spreads),
            range: spreads[n - 1] - spreads[0]
        };
    },

    /**
     * Calculate proper median for sorted array
     */
    calculateMedian(sortedValues) {
        const n = sortedValues.length;
        if (n === 0) return 0;

        const mid = Math.floor(n / 2);
        if (n % 2 === 0) {
            return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
        }
        return sortedValues[mid];
    },

    // ===========================================
    // PORTFOLIO METRICS (Participant)
    // ===========================================

    /**
     * Calculate portfolio concentration by sector
     * @param {Array} allocations - Array of allocation objects with industry
     * @returns {Object} Sector concentration percentages
     */
    calculateSectorConcentration(allocations) {
        if (!allocations || allocations.length === 0) return {};

        const total = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
        const bySector = {};

        for (const alloc of allocations) {
            const sector = alloc.industry || 'Unknown';
            bySector[sector] = (bySector[sector] || 0) + (alloc.amount || 0);
        }

        const concentrations = {};
        for (const [sector, amount] of Object.entries(bySector)) {
            concentrations[sector] = total > 0 ? amount / total : 0;
        }
        return concentrations;
    },

    /**
     * Calculate win rate
     * @param {number} wins - Allocations won
     * @param {number} bids - Bids submitted
     * @returns {number} Win rate as decimal
     */
    calculateWinRate(wins, bids) {
        if (bids <= 0) return 0;
        return wins / bids;
    },

    // ===========================================
    // ORIGINATOR METRICS
    // ===========================================

    /**
     * Calculate success rate
     * @param {number} completed - Successful syndications
     * @param {number} failed - Failed syndications
     * @returns {number} Success rate as percentage (0-100)
     */
    calculateSuccessRate(completed, failed) {
        const total = completed + failed;
        if (total <= 0) return 0;
        return (completed / total) * 100;
    },

    /**
     * Calculate average time to close (in hours)
     * @param {Array} syndications - Array of completed syndications
     * @returns {number} Average hours to close
     */
    calculateAvgTimeToClose(syndications) {
        if (!syndications || syndications.length === 0) return 0;

        const times = syndications
            .filter(s => s.completed_at && s.created_at)
            .map(s => {
                const created = new Date(s.created_at);
                const completed = new Date(s.completed_at);
                return (completed - created) / (1000 * 60 * 60); // Hours
            });

        if (times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    },

    // ===========================================
    // RATING UTILITIES
    // ===========================================

    /**
     * Parse credit rating to numeric scale for comparison
     * Higher number = better credit
     */
    ratingToNumeric(rating) {
        if (!rating) return 0;

        const scale = {
            'AAA': 21, 'AA+': 20, 'AA': 19, 'AA-': 18,
            'A+': 17, 'A': 16, 'A-': 15,
            'BBB+': 14, 'BBB': 13, 'BBB-': 12,
            'BB+': 11, 'BB': 10, 'BB-': 9,
            'B+': 8, 'B': 7, 'B-': 6,
            'CCC+': 5, 'CCC': 4, 'CCC-': 3,
            'CC': 2, 'C': 1, 'D': 0
        };
        return scale[rating.toUpperCase()] || 0;
    },

    /**
     * Check if rating is investment grade
     */
    isInvestmentGrade(rating) {
        return this.ratingToNumeric(rating) >= 12; // BBB- or better
    },

    /**
     * Calculate rating notch distance
     */
    ratingDistance(rating1, rating2) {
        return this.ratingToNumeric(rating1) - this.ratingToNumeric(rating2);
    }
};

// Export
window.MetricsService = MetricsService;
