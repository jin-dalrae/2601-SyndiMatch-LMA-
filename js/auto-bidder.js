/**
 * SyndiMatch Enhanced Auto-Bidder
 * - Loads profiles from API
 * - Validates constraints (ESG, Sector, Risk)
 * - Implements strategic bidding & portfolio concentration
 */

const AutoBidder = {
    // State
    participants: new Map(), // Loaded from API
    relationships: new Map(), // Map<participantId, Map<originatorId, score>>
    pendingBids: [],

    // Configuration
    config: {
        cancelWindowHours: 24,
        checkInterval: 60000, // 1 minute
        defaultRiskProfile: 'moderate'
    },

    /**
     * Initialize the Auto-Bidder
     */
    async init() {
        console.log('🤖 Initializing Enhanced Auto-Bidder...');

        // 1. Load Participant Profiles
        await this.loadParticipants();

        // 2. Setup Event Listeners
        this.setupEventListeners();

        // 3. Process existing open syndications
        this.processOpenSyndications();

        // 4. Start periodic checks
        if (window.SimulationEngine) {
            SimulationEngine.on('timeTick', (data) => this.processTimeTick(data.date));
        } else {
            setInterval(() => this.processTimeTick(new Date()), this.config.checkInterval);
        }

        console.log(`✅ Auto-Bidder Ready (Managed Agents: ${this.participants.size})`);
    },

    /**
     * Load participants from API
     */
    async loadParticipants() {
        try {
            const participants = await API.getParticipants();
            if (participants && participants.length > 0) {
                participants.forEach(p => {
                    // Normalize ID (API returns _id for MongoDB documents)
                    const id = p.id || p._id;
                    if (id) {
                        // Enrich with bidding strategy defaults if missing
                        const profile = this.enrichProfile({ ...p, id });
                        this.participants.set(id, profile);
                    }
                });
            } else {
                console.warn('⚠️ No participants found from API, using defaults');
                this.loadDefaultParticipants();
            }
        } catch (e) {
            console.error('❌ Failed to load participants:', e);
            this.loadDefaultParticipants();
        }
    },

    /**
     * Enrich participant profile with strategy config
     */
    enrichProfile(participant) {
        // Map backend fields to strategy config or use defaults
        return {
            ...participant,
            riskAppetite: participant.risk_profile || this.config.defaultRiskProfile,
            targetYield: participant.target_yield || 7.0,
            maxAllocation: participant.max_allocation_per_deal || 50, // Millions
            minAllocation: participant.min_allocation_per_deal || 5,
            bidSpeed: this.determineBidSpeed(participant.strategy),
            strategy: participant.strategy || 'balanced',
            esgMinScore: participant.esg_min_score || 0,
            excludedSectors: participant.excluded_sectors || [],
            preferredSectors: participant.preferred_sectors || []
        };
    },

    determineBidSpeed(strategy) {
        switch (strategy) {
            case 'aggressive': return 'fast'; // 1-3 hours
            case 'conservative': return 'slow'; // 24-48 hours
            default: return 'medium'; // 4-12 hours
        }
    },

    /**
     * Handle New Syndication Event
     */
    async onNewSyndication(syndication) {
        console.log(`📢 Auto-Bidder: Analyzing ${syndication.id} (${syndication.borrower})`);

        for (const player of this.participants.values()) {
            await this.evaluateAndBid(player, syndication);
        }
    },

    /**
     * Evaluate Deal and potentially place bid
     */
    async evaluateAndBid(player, syndication) {
        const evaluation = this.evaluateDeal(player, syndication);

        if (evaluation.shouldBid) {
            this.scheduleBid(player, syndication, evaluation);
        }
    },

    /**
     * Core Evaluation Logic
     */
    evaluateDeal(player, syndication) {
        const reasons = [];
        let score = 50; // Base score

        // 1. Hard Constraints (Knock-out criteria)

        // ESG Check
        if (syndication.esg_score && syndication.esg_score < player.esgMinScore) {
            return { shouldBid: false, reason: `ESG Score ${syndication.esg_score} below minimum ${player.esgMinScore}` };
        }

        // Sector Exclusion
        if (player.excludedSectors && player.excludedSectors.includes(syndication.industry)) {
            return { shouldBid: false, reason: `Sector ${syndication.industry} is excluded` };
        }

        // 2. Strategic Scoring

        // Yield Analysis
        const dealYield = (syndication.spread / 100) + 4.5; // Base Rate assumption
        if (dealYield >= player.targetYield) {
            score += 20;
            reasons.push(`Yield ${dealYield.toFixed(2)}% > Target ${player.targetYield}%`);
        } else {
            score -= 15;
            reasons.push(`Yield ${dealYield.toFixed(2)}% < Target`);
        }

        // Relationship Score
        const relScore = this.getRelationshipScore(player.id, syndication.originatorId);
        score += (relScore - 50) * 0.5; // +/- impact
        if (relScore > 70) reasons.push('Strong Originator Relationship');

        // Sector Preference
        if (player.preferredSectors && player.preferredSectors.includes(syndication.industry)) {
            score += 15;
            reasons.push('Preferred Sector');
        }

        // 3. Portfolio Concentration Check (Simulated)
        // In real impl, would check existing portfolio holdings
        if (player.strategy === 'conservative' && Math.random() < 0.3) {
            score -= 10;
            reasons.push('Portfolio concentration check warning');
        }

        // 4. Market Sentiment
        const sentiment = AppState.get('marketConditions') || 'neutral';
        if (sentiment === 'bear' && player.riskAppetite === 'conservative') score -= 20;
        if (sentiment === 'bull' && player.riskAppetite === 'aggressive') score += 15;

        // Decision
        const shouldBid = score >= 65; // Threshold

        // Calculate Bid Parameters
        let bidAmount = 0;
        let bidSpread = syndication.spread;

        if (shouldBid) {
            // Sizing
            const max = player.maxAllocation;
            const sizeFactor = Math.min(1.0, (score - 60) / 40); // 0 to 1 scaling
            bidAmount = Math.max(player.minAllocation, Math.round(max * sizeFactor));

            // Pricing (Spread) strategy
            if (player.strategy === 'aggressive') {
                bidSpread -= 10; // Aggressive agents bid tighter to win
            } else if (player.strategy === 'conservative') {
                bidSpread += 25; // Conservative agents demand premium
            } else {
                bidSpread += (Math.random() * 10 - 5); // Market noise
            }

            bidSpread = Math.round(bidSpread);
        }

        return {
            shouldBid,
            score,
            reasons,
            bidAmount,
            bidSpread,
            relationshipScore: relScore
        };
    },

    /**
     * Schedule a future bid
     */
    scheduleBid(player, syndication, evaluation) {
        const delayHours = this.getBidDelay(player.bidSpeed);
        const delayMs = delayHours * 3600000;

        // Use Simulation time if available, else wall clock
        const now = window.SimulationEngine ? window.SimulationEngine.getCurrentDate().getTime() : Date.now();
        const scheduledTime = new Date(now + delayMs);

        const bid = {
            id: `BID-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            syndicationId: syndication.id,
            participantId: player.id,
            participantName: player.name,
            amount: evaluation.bidAmount,
            spread: evaluation.bidSpread,
            scheduledTime: scheduledTime,
            reasons: evaluation.reasons,
            status: 'pending',
            canCancel: true,
            cancelDeadline: new Date(scheduledTime.getTime() + this.config.cancelWindowHours * 3600000)
        };

        this.pendingBids.push(bid);

        if (Config?.DEBUG) {
            console.log(`⏳ Bid Scheduled: ${player.name} on ${syndication.borrower} @ ${scheduledTime.toLocaleTimeString()}`);
        }

        // Emit event for UI
        window.dispatchEvent(new CustomEvent('bidScheduled', { detail: bid }));
    },

    /**
     * Process Time Tick
     */
    processTimeTick(currentDate) {
        const now = currentDate.getTime();

        // Find due bids
        const dueBids = this.pendingBids.filter(b => b.status === 'pending' && b.scheduledTime.getTime() <= now);

        dueBids.forEach(bid => this.executeBid(bid));

        // Cleanup executed/cancelled bids older than 24h
        // logic omitted for brevity
    },

    /**
     * Execute Logic
     */
    executeBid(bid) {
        bid.status = 'executed';

        // Update Subscription (Mock Logic - in real app would POST to API)
        const syndication = Data.getSyndication(bid.syndicationId);
        if (syndication) {
            // Find if already exists
            if (!syndication.bids) syndication.bids = [];
            syndication.bids.push({
                participantId: bid.participantId,
                participantName: bid.participantName,
                amount: bid.amount,
                spread: bid.spread,
                timestamp: new Date().toISOString()
            });

            // Update subscription rate
            const totalBids = syndication.bids.reduce((sum, b) => sum + b.amount, 0);
            syndication.subscription = Math.min(100, (totalBids / syndication.amount) * 100);

            console.log(`✅ Bid Placed: ${bid.participantName} $${bid.amount}M on ${syndication.borrower}`);

            // POST to API (fire and forget)
            API.agentBid(bid.participantId, syndication).catch(e => console.warn('API Bid Error:', e));

            // Notify UI
            window.dispatchEvent(new CustomEvent('bidPlaced', { detail: bid }));
            window.dispatchEvent(new CustomEvent('syndicationUpdated', { detail: { id: syndication.id } }));
        }
    },

    /**
     * Helpers
     */
    getBidDelay(speed) {
        // Returns delay in Hours
        switch (speed) {
            case 'fast': return 0.5 + Math.random() * 2;
            case 'slow': return 12 + Math.random() * 24;
            default: return 4 + Math.random() * 8;
        }
    },

    getRelationshipScore(participantId, originatorId) {
        if (!this.relationships.has(participantId)) {
            this.relationships.set(participantId, new Map());
        }
        const pMap = this.relationships.get(participantId);
        if (!pMap.has(originatorId)) {
            // Random start score 40-70
            pMap.set(originatorId, 40 + Math.floor(Math.random() * 30));
        }
        return pMap.get(originatorId);
    },

    setupEventListeners() {
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));
    },

    processOpenSyndications() {
        if (window.Data && window.Data.syndications) {
            window.Data.syndications.forEach(s => {
                if (s.status === 'open') this.onNewSyndication(s);
            });
        }
    },

    // Fallback Mock Data
    loadDefaultParticipants() {
        const defaults = [
            { id: 'PA-001', name: 'Apollo Global', strategy: 'aggressive', max_allocation_per_deal: 150 },
            { id: 'PA-002', name: 'BlackRock', strategy: 'balanced', max_allocation_per_deal: 100 },
            { id: 'PA-003', name: 'JP Morgan Asset Mgmt', strategy: 'conservative', max_allocation_per_deal: 80 }
        ];
        defaults.forEach(p => this.participants.set(p.id, this.enrichProfile(p)));
    }
};

window.AutoBidder = AutoBidder;
