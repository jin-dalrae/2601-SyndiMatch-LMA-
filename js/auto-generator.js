/**
 * SyndiMatch Auto-Generator
 * - Generates syndications during simulation
 * - Manages deal lifecycle progression
 * - Syncs with SyndiData for UI updates
 */

const AutoGenerator = {
    enabled: false,
    activeSyndications: [],
    originators: [],

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
        avgDurationDays: 14
    },

    /**
     * Initialize Generator
     */
    async init() {
        console.log('🏭 Initializing Auto-Generator...');

        // Load Originators
        await this.loadOriginators();

        // Setup Simulation Listeners
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', (data) => this.onDayChange(data));
            SimulationEngine.on('timeTick', (data) => this.onTimeTick(data));
        }

        // Listen for bid events to progress syndications
        window.addEventListener('bidPlaced', (e) => this.onBidPlaced(e.detail));

        console.log(`✅ Auto-Generator Ready (Originators: ${this.originators.length})`);
    },

    /**
     * Load Originators from API
     */
    async loadOriginators() {
        try {
            if (window.API && API.getAgents) {
                const agents = await API.getAgents();
                if (agents?.originator) {
                    this.originators = agents.originator;
                    return;
                }
            }
        } catch (e) {
            console.warn('⚠️ API Originators not found, using defaults');
        }
        this.loadDefaultOriginators();
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
     * Daily Tick Handler - Process lifecycles and generate new deals
     */
    onDayChange(data) {
        // 1. Process existing deal phases
        this.processDealLifecycles(data.date);

        // 2. Check for new deal generation
        this.checkForNewDeals(data.date);
    },

    /**
     * Time Tick Handler - Check for stage progression more frequently
     */
    onTimeTick(data) {
        // Check for stage progression every tick (based on subscription)
        this.activeSyndications.forEach(deal => {
            if (deal.status === 'open' || deal.status === 'negotiating') {
                this.checkStageProgression(deal);
            }
        });
    },

    /**
     * Handle bid placed - update subscription and check progression
     */
    onBidPlaced(bid) {
        const deal = this.activeSyndications.find(d => d.id === bid.syndicationId);
        if (!deal) return;

        // Update subscription based on bid
        const bidAmount = bid.amount || 0;
        const subscriptionIncrease = (bidAmount / deal.amount) * 100;
        deal.subscription = Math.min(100, (deal.subscription || 0) + subscriptionIncrease);

        // Update in SyndiData
        if (window.SyndiData) {
            SyndiData.updateSyndication(deal.id, { subscription: deal.subscription });
        }

        // Check for stage progression
        this.checkStageProgression(deal);
    },

    /**
     * Check if a deal should progress to next stage
     */
    checkStageProgression(deal) {
        let shouldProgress = false;
        let newStatus = deal.status;
        let newPhase = deal.phase;

        if (deal.status === 'open' && deal.subscription >= 50) {
            newStatus = 'negotiating';
            newPhase = 'pricing';
            shouldProgress = true;
        } else if (deal.status === 'negotiating' && deal.subscription >= 100) {
            newStatus = 'closing';
            newPhase = 'allocation';
            shouldProgress = true;
        }

        if (shouldProgress) {
            const oldStatus = deal.status;
            deal.status = newStatus;
            deal.phase = newPhase;

            console.log(`📈 ${deal.borrower}: ${oldStatus} → ${newStatus} (${deal.subscription.toFixed(0)}% subscribed)`);

            // Update SyndiData
            if (window.SyndiData) {
                SyndiData.updateSyndication(deal.id, {
                    status: newStatus,
                    phase: newPhase,
                    subscription: deal.subscription
                });
            }

            // Emit stage change event
            window.dispatchEvent(new CustomEvent('syndicationUpdated', {
                detail: { id: deal.id, statusChange: { from: oldStatus, to: newStatus }, ...deal }
            }));

            // Refresh UI
            if (window.PipelineComponent) PipelineComponent.render();
        }
    },

    /**
     * Generate new deals based on market conditions
     */
    checkForNewDeals(date) {
        const condition = window.AppState?.get('marketConditions') || 'neutral';
        let prob = 0.15; // Base probability 15% per day

        if (condition === 'bull') prob = 0.25;
        if (condition === 'bear') prob = 0.05;

        if (Math.random() < prob) {
            this.generateSyndication(date);
        }
    },

    /**
     * Generate a new syndication
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

        // ESG Score (65-95 range)
        const esgScore = Math.floor(Math.random() * 30) + 65;

        const syndication = {
            id: `SYND-${Date.now()}`,
            borrower: this.generateBorrowerName(sector),
            industry: sector,
            amount: amount,
            rating: rating,
            originatorId: originator.id,
            originatorName: originator.name || originator.entity,
            originator: originator.name || originator.entity,

            // Deal Structure
            seniority: this.getRandomItem(this.config.seniority),
            geography: this.getRandomItem(this.config.geographies),
            tenorYears: this.randomInt(3, 7),
            amortization: this.randomInt(0, 1) ? '1% per annum' : 'Bullet',

            // Pricing
            spread: spread,
            priceTalk: { min: spread - 25, max: spread + 25 },

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
            bookbuildDeadline: new Date(date.getTime() + 3 * 24 * 3600000).toISOString(),
            closingDate: new Date(date.getTime() + 10 * 24 * 3600000).toISOString(),

            bids: [],
            isMock: false
        };

        // Track locally
        this.activeSyndications.push(syndication);

        // Add to SyndiData
        if (window.SyndiData) {
            SyndiData.addSyndication(syndication);
        }

        // Sync to Backend (if connected)
        this.syncToBackend(syndication);

        // Notify
        console.log(`🆕 Generated: ${syndication.borrower} ($${amount}M, ${rating}) from ${syndication.originatorName}`);
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: syndication }));

        // Update UI
        if (window.PipelineComponent) PipelineComponent.render();

        return syndication;
    },

    /**
     * Process deal lifecycle transitions based on time
     */
    processDealLifecycles(currentDate) {
        const now = currentDate.getTime();

        this.activeSyndications.forEach(deal => {
            if (deal.status === 'completed' || deal.status === 'closed') return;

            const closeTime = new Date(deal.closingDate).getTime();

            // Auto-close deals past their closing date
            if (now >= closeTime && deal.status !== 'completed') {
                if (deal.subscription >= 100) {
                    this.completeDeal(deal);
                } else if (deal.subscription >= 50) {
                    // Partial close - still complete but with notes
                    deal.notes = `Closed at ${deal.subscription.toFixed(0)}% subscription`;
                    this.completeDeal(deal);
                } else {
                    // Failed to meet minimum - cancel
                    this.cancelDeal(deal);
                }
            }

            // Progress deals that are ready for next stage
            if (deal.status === 'closing') {
                // Move to settlement after 1 day in closing
                const closingStart = new Date(deal.closingStartDate || now).getTime();
                if (now - closingStart > 24 * 3600000) {
                    deal.status = 'settlement';
                    deal.phase = 'documentation';
                    SyndiData.updateSyndication(deal.id, { status: 'settlement', phase: 'documentation' });
                }
            }

            if (deal.status === 'settlement') {
                // Move to funding after 1 day in settlement
                const settlementStart = new Date(deal.settlementStartDate || now).getTime();
                if (now - settlementStart > 24 * 3600000) {
                    deal.status = 'funding';
                    deal.phase = 'payment';
                    SyndiData.updateSyndication(deal.id, { status: 'funding', phase: 'payment' });
                }
            }

            if (deal.status === 'funding') {
                // Complete after 1 day in funding
                const fundingStart = new Date(deal.fundingStartDate || now).getTime();
                if (now - fundingStart > 24 * 3600000) {
                    this.completeDeal(deal);
                }
            }
        });
    },

    /**
     * Complete a deal
     */
    completeDeal(deal) {
        deal.status = 'completed';
        deal.phase = 'completed';

        console.log(`✅ Deal Completed: ${deal.borrower}`);

        if (window.SyndiData) {
            SyndiData.updateSyndication(deal.id, { status: 'completed', phase: 'completed' });
        }

        window.dispatchEvent(new CustomEvent('syndicationCompleted', { detail: deal }));
        if (window.PipelineComponent) PipelineComponent.render();
    },

    /**
     * Cancel a deal
     */
    cancelDeal(deal) {
        deal.status = 'cancelled';
        deal.phase = 'cancelled';

        console.log(`❌ Deal Cancelled: ${deal.borrower} (insufficient subscription)`);

        if (window.SyndiData) {
            SyndiData.updateSyndication(deal.id, { status: 'cancelled', phase: 'cancelled' });
        }

        window.dispatchEvent(new CustomEvent('syndicationCancelled', { detail: deal }));
    },

    /**
     * Sync to Backend
     */
    async syncToBackend(syndication) {
        if (window.AppState?.get('connected') && window.API) {
            try {
                await API.post('server', '/syndications', syndication);
            } catch (e) {
                console.warn('Failed to sync deal to backend:', e);
            }
        }
    },

    // ========================================
    // Utilities
    // ========================================

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
        const prefixes = ['Global', 'Advanced', 'Strategic', 'United', 'First', 'Prime', 'Apex', 'Summit', 'Horizon', 'Vertex'];
        const suffixes = ['Holdings', 'Group', 'Partners', 'Corp', 'Inc', 'Solutions', 'Systems', 'Ventures', 'Industries'];
        return `${this.getRandomItem(prefixes)} ${sector.split(' ')[0]} ${this.getRandomItem(suffixes)}`;
    },

    /**
     * Reset generator state
     */
    reset() {
        this.activeSyndications = [];
        console.log('🔄 Auto-Generator reset');
    }
};

window.AutoGenerator = AutoGenerator;

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    if (AutoGenerator.enabled) {
        AutoGenerator.init();
    }
});
