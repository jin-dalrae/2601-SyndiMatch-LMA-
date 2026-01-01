/**
 * SyndiMatch Enhanced Auto-Generator
 * - Loads originators from API
 * - Generates rich deal structures (ESG, Geography, Capital Structure)
 * - Syncs generated deals to backend
 */

const AutoGenerator = {
    activeSyndications: [],
    originators: [], // Loaded from API

    config: {
        minDealsPerMonth: 2,
        maxDealsPerMonth: 5,
        minAmount: 100, // $100M
        maxAmount: 1200, // $1.2B
        sectors: ['Technology', 'Healthcare', 'Energy', 'Real Estate', 'Manufacturing', 'Financial Services', 'Telecom', 'Consumer'],
        geographies: ['North America', 'Europe', 'APAC', 'Latin America'],
        seniority: ['Senior Secured', 'Unitranche', 'Second Lien', 'Mezzanine'],
        ratings: ['AAA', 'AA+', 'AA', 'A', 'BBB+', 'BBB', 'BB+', 'BB', 'B', 'CCC+'],
        ratingWeights: [2, 5, 10, 15, 25, 20, 15, 5, 2, 1],
        avgDurationDays: 14 // Average deal lifecycle
    },

    /**
     * Initialize Generator
     */
    async init() {
        console.log('🏭 Initializing Enhanced Auto-Generator...');

        // 1. Load Originators
        await this.loadOriginators();

        // 2. Setup Simulation Listeners
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', (data) => this.onDayChange(data));
        }

        console.log(`✅ Auto-Generator Ready (Originators: ${this.originators.length})`);
    },

    /**
     * Load Originators from API
     */
    async loadOriginators() {
        try {
            const agents = await API.getAgents();
            if (agents && agents.originator) {
                this.originators = agents.originator;
            } else {
                this.loadDefaultOriginators();
            }
        } catch (e) {
            console.warn('⚠️ API Originators not found, using defaults');
            this.loadDefaultOriginators();
        }
    },

    loadDefaultOriginators() {
        this.originators = [
            { id: 'OA-001', name: 'JPMorgan Chase', tier: 'mega' },
            { id: 'OA-002', name: 'Goldman Sachs', tier: 'mega' },
            { id: 'OA-003', name: 'Bank of America', tier: 'mega' },
            { id: 'OA-004', name: 'Morgan Stanley', tier: 'major' },
            { id: 'OA-005', name: 'Citi', tier: 'major' }
        ];
    },

    /**
     * Daily Tick Handler
     */
    onDayChange(data) {
        // 1. Process existing deal phases
        this.processDealLifecycles(data.date);

        // 2. Check for new deal generation
        this.checkForNewDeals(data.date);
    },

    /**
     * Generate new deal with probabilities
     */
    checkForNewDeals(date) {
        // Market Conditions Handling
        const condition = AppState.get('marketConditions') || 'neutral';
        let prob = 0.15; // Base probability 15% per day ~ 4.5 deals/month

        if (condition === 'bull') prob = 0.25;
        if (condition === 'bear') prob = 0.05;

        if (Math.random() < prob) {
            this.generateSyndication(date);
        }
    },

    /**
     * Generate comprehensive syndication record
     */
    generateSyndication(date) {
        const originator = this.getRandomItem(this.originators);
        const sector = this.getRandomItem(this.config.sectors);
        const rating = this.checkRating(this.weightedRandom(this.config.ratings, this.config.ratingWeights));
        const amount = this.roundAmount(this.randomInt(this.config.minAmount, this.config.maxAmount));

        // Pricing Logic
        const isIG = ['AAA', 'AA', 'A', 'BBB'].some(r => rating.includes(r));
        const baseSpread = isIG ? 150 : 350;
        const spread = baseSpread + this.randomInt(0, 200);

        // ESG Logic (Random skew towards higher scores)
        const esgScore = Math.floor(Math.random() * 30) + 65; // 65-95 range

        const syndication = {
            id: `SYND-${date.getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            borrower: this.generateBorrowerName(sector),
            industry: sector,
            amount: amount,
            rating: rating,
            originatorId: originator.id,
            originatorName: originator.name || originator.entity, // Handle different API formats

            // Deal Structure
            seniority: this.getRandomItem(this.config.seniority),
            geography: this.getRandomItem(this.config.geographies),
            tenorYears: this.randomInt(3, 7),
            amortization: this.randomInt(0, 1) ? '1% per annum' : 'Bullet',

            // Pricing
            spread: spread,
            priceTalk: {
                min: spread - 25,
                max: spread + 25
            },

            // ESG
            esg_score: esgScore,

            // State
            status: 'open',
            phase: 'bookbuilding',
            subscription: 0,
            round: 1,
            maxRounds: 3,

            // Timestamps
            announcedAt: date.toISOString(),
            bookbuildDeadline: new Date(date.getTime() + 3 * 24 * 3600000).toISOString(), // +3 days
            closingDate: new Date(date.getTime() + 10 * 24 * 3600000).toISOString(), // +10 days

            bids: []
        };

        this.activeSyndications.push(syndication);

        // Update Local Store
        if (window.Data && window.Data.syndications) {
            window.Data.syndications.push(syndication);
        }

        // Sync to Backend
        this.syncToBackend(syndication);

        // Notify UI
        console.log(`🆕 Generated Deal: ${syndication.borrower} ($${amount}M, ${rating}) from ${syndication.originatorName}`);
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: syndication }));

        return syndication;
    },

    /**
     * Process Lifecycle transitions
     */
    processDealLifecycles(currentDate) {
        const now = currentDate.getTime();

        this.activeSyndications.forEach(deal => {
            if (deal.status === 'completed' || deal.status === 'closed') return;

            const closeTime = new Date(deal.closingDate).getTime();

            // Check for closing
            if (now >= closeTime && deal.status !== 'closed') {
                this.closeDeal(deal);
            }
        });
    },

    /**
     * Close a deal
     */
    closeDeal(deal) {
        deal.status = 'closed';
        deal.phase = 'funded';

        console.log(`🏁 Deal Closed: ${deal.borrower}`);
        window.dispatchEvent(new CustomEvent('syndicationClosed', { detail: deal }));

        // Mock API update
        // API.updateSyndication(deal.id, { status: 'closed' });
    },

    /**
     * Sync Generated Deal to Backend
     */
    async syncToBackend(syndication) {
        // In simulation mode, we might just log this
        // But if connected to real backend, we should POST
        if (AppState.get('connected')) {
            try {
                // Map to Backend Schema if needed
                // For now, assume backend accepts flexible schema or ignored keys
                await API.post('/syndications', syndication);
            } catch (e) {
                console.warn('Failed to sync generated deal to backend:', e);
            }
        }
    },

    /**
     * Utilities
     */
    getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    roundAmount(val) {
        return Math.round(val / 10) * 10;
    },

    weightedRandom(items, weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r <= 0) return items[i];
        }
        return items[0];
    },

    checkRating(r) { return r || 'BB'; },

    generateBorrowerName(sector) {
        const prefixes = ['Global', 'Advanced', 'Strategic', 'United', 'First', 'Prime', 'Apex', 'Summit'];
        const suffixes = ['Holdings', 'Group', 'Partners', 'Corp', 'Inc', 'Solutions', 'Systems', 'Ventures'];
        return `${this.getRandomItem(prefixes)} ${sector.split(' ')[0]} ${this.getRandomItem(suffixes)}`;
    }
};

window.AutoGenerator = AutoGenerator;

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    AutoGenerator.init();
});
