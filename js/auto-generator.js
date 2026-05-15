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

        // Adopt externally-created syndications (originator form, seed, sim)
        // into the lifecycle so they progress through the pipeline too.
        window.addEventListener('newSyndication', (e) => this.adoptExternalDeal(e.detail));

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
        // Deal generation only — progression is handled per-tick in onTimeTick.
        // Gated: generation stays off unless explicitly enabled, but the
        // lifecycle driver still runs (init is unconditional).
        if (this.enabled) this.checkForNewDeals(data.date);
    },

    // Wall-clock dwell per back-half stage (real seconds, demo pace).
    // Independent of sim speed so a created deal visibly progresses even
    // when the simulation clock is paused at 0 days/s.
    BACKHALF_DWELL_MS: 8000,
    EARLY_TIME_FALLBACK_MS: 12000,

    // Stage clock keyed by syndication id. SyndiData polling REPLACES deal
    // objects every few seconds, so per-object timestamps reset forever and
    // nothing ever crosses a dwell threshold. Keying by id makes the clock
    // survive object replacement. { [id]: { status, since } }
    stageClock: {},

    STAGE_ORDER: ['open', 'negotiating', 'closing', 'settlement', 'funding', 'completed'],

    _stageRank(s) {
        const i = this.STAGE_ORDER.indexOf(s);
        return i === -1 ? 0 : i;
    },

    /**
     * Resolve the stable clock for a deal, reconciling against the (possibly
     * refreshed) object. If a stale API refresh regressed the status behind
     * what we've already progressed to, re-assert the client state instead
     * of letting it bounce backward.
     */
    _clockFor(deal) {
        const c = this.stageClock[deal.id];
        if (!c) {
            this.stageClock[deal.id] = { status: deal.status, since: Date.now() };
            return this.stageClock[deal.id];
        }
        if (deal.status !== c.status) {
            if (this._stageRank(deal.status) < this._stageRank(c.status)) {
                // Stale refresh dragged it back — re-assert our progression.
                deal.status = c.status;
            } else {
                // Genuine forward move (e.g. agent advanced it) — accept.
                c.status = deal.status;
                c.since = Date.now();
            }
        }
        return c;
    },

    /**
     * Time Tick Handler — single source of progression truth.
     * Iterates the canonical SyndiData list so user-created, seeded, and
     * generated deals are all driven through the same state machine.
     */
    onTimeTick() {
        const deals = (window.SyndiData && SyndiData.allSyndications)
            ? SyndiData.allSyndications
            : this.activeSyndications;

        deals.forEach(deal => {
            if (!deal || !deal.status) return;
            if (deal.status === 'open' || deal.status === 'negotiating') {
                this.checkStageProgression(deal);
            } else if (deal.status === 'closing' || deal.status === 'settlement' || deal.status === 'funding') {
                this.advanceBackHalf(deal);
            }
        });
    },

    /**
     * Adopt an externally-created syndication into the lifecycle.
     * The originator form, the seed loader, and the sim all dispatch
     * `newSyndication`; without this they'd sit at "open" forever because
     * the old progression only iterated this.activeSyndications.
     */
    adoptExternalDeal(deal) {
        if (!deal || !deal.id) return;
        if (!deal.status) deal.status = 'open';
        if (deal.subscription == null) deal.subscription = 0;
        if (!this.stageClock[deal.id]) {
            this.stageClock[deal.id] = { status: deal.status, since: Date.now() };
        }
        if (!this.activeSyndications.some(d => d.id === deal.id)) {
            this.activeSyndications.push(deal);
        }
        console.log(`🪪 Adopted ${deal.id} into pipeline lifecycle`);
    },

    /**
     * Apply a stage transition + propagate to SyndiData and the UI.
     */
    _transition(deal, newStatus, newPhase) {
        const old = deal.status;
        deal.status = newStatus;
        deal.phase = newPhase;
        if (newStatus === 'completed') {
            deal.subscription = Math.max(deal.subscription || 0, 100);
        }
        // Advance the stable clock.
        this.stageClock[deal.id] = { status: newStatus, since: Date.now() };
        if (window.SyndiData) {
            SyndiData.updateSyndication(deal.id, {
                status: newStatus,
                phase: newPhase,
                subscription: deal.subscription
            });
        }
        // Persist so the next /api/syndications poll doesn't regress it.
        if (window.API && typeof API.patch === 'function') {
            API.patch(`/syndications/${deal.id}`, {
                status: newStatus,
                phase: newPhase,
                subscription: deal.subscription
            });
        }
        console.log(`📈 ${deal.borrower || deal.id}: ${old} → ${newStatus} (${Math.round(deal.subscription || 0)}% subscribed)`);
        window.dispatchEvent(new CustomEvent('syndicationUpdated', {
            detail: { id: deal.id, statusChange: { from: old, to: newStatus }, ...deal }
        }));
        if (newStatus === 'completed') {
            window.dispatchEvent(new CustomEvent('syndicationCompleted', { detail: deal }));
        }
        if (window.PipelineComponent) PipelineComponent.render();
    },

    /**
     * Back-half: closing → settlement → funding → completed.
     * Gated on a real-time dwell so it always advances during a demo.
     */
    advanceBackHalf(deal) {
        const clock = this._clockFor(deal);
        if (Date.now() - clock.since < this.BACKHALF_DWELL_MS) return;

        if (deal.status === 'closing') {
            this._transition(deal, 'settlement', 'documentation');
        } else if (deal.status === 'settlement') {
            this._transition(deal, 'funding', 'payment');
        } else if (deal.status === 'funding') {
            this._transition(deal, 'completed', 'completed');
        }
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
     * Front-half: open → negotiating → closing.
     * Primarily subscription-driven (the auto-bidder builds the book),
     * with a real-time fallback so a deal nobody bids on still advances
     * during a demo instead of stalling at "open" forever.
     */
    checkStageProgression(deal) {
        const clock = this._clockFor(deal);
        const inStageMs = Date.now() - clock.since;
        const sub = deal.subscription || 0;

        if (deal.status === 'open' && (sub >= 40 || inStageMs > this.EARLY_TIME_FALLBACK_MS)) {
            this._transition(deal, 'negotiating', 'pricing');
        } else if (deal.status === 'negotiating' && (sub >= 100 || inStageMs > this.EARLY_TIME_FALLBACK_MS)) {
            this._transition(deal, 'closing', 'allocation');
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

// Init on load. init() always runs so the pipeline lifecycle driver
// (onTimeTick → checkStageProgression / advanceBackHalf) is active for
// user-created, seeded, and sim-created deals. Random deal *generation*
// stays gated behind AutoGenerator.enabled inside onDayChange.
document.addEventListener('DOMContentLoaded', () => {
    AutoGenerator.init();
});
