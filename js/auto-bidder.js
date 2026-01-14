/**
<<<<<<< HEAD
 * SyndiMatch Enhanced Auto-Bidder
 * - Loads profiles from API
 * - Validates constraints (ESG, Sector, Risk)
 * - Implements strategic bidding & portfolio concentration
=======
 * SyndiMatch Auto-Bidder
 * Automatically places bids based on participant agent profiles
 * Includes relationship tracking and multi-round negotiations
 * 
 * UNIT CONVENTIONS:
 * - Internal calculations: DOLLARS (e.g., 150000000 = $150M)
 * - Profile maxAllocation: MILLIONS (e.g., 150 = $150M) - converted on use
 * - Syndication amounts: MILLIONS (e.g., 500 = $500M) - converted on use
 * - Display/logging: MILLIONS (e.g., "$150M")
 * - Spreads: BASIS POINTS (e.g., 400 = 4.00%)
 * 
 * Helper: toM(dollars) converts dollars to millions for display
 *         fromM(millions) converts millions to dollars for calculation
>>>>>>> syndication-change
 */

const AutoBidder = {
    // State
    participants: new Map(), // Loaded from API
    relationships: new Map(), // Map<participantId, Map<originatorId, score>>
    pendingBids: [],

<<<<<<< HEAD
    // Configuration
    config: {
        cancelWindowHours: 24,
        checkInterval: 60000, // 1 minute
        defaultRiskProfile: 'moderate'
=======
    // Cancel window in simulated hours
    cancelWindowHours: 24,

    /**
     * Unit conversion helpers
     */
    toM(dollars) {
        return dollars / 1000000;
    },

    fromM(millions) {
        return millions * 1000000;
    },

    /**
     * Initialize relationship scores
     */
    initRelationships() {
        const originatorIds = ['OA-001', 'OA-002', 'OA-003', 'OA-004', 'OA-005', 'OA-006', 'OA-007', 'OA-008'];
        Object.keys(this.participants).forEach(participantId => {
            if (!this.relationships[participantId]) {
                this.relationships[participantId] = {};
            }
            originatorIds.forEach(originatorId => {
                if (this.relationships[participantId][originatorId] === undefined) {
                    // Start with random baseline (40-70)
                    this.relationships[participantId][originatorId] = 40 + Math.floor(Math.random() * 30);
                }
            });
        });
>>>>>>> syndication-change
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

<<<<<<< HEAD
        // Relationship Score
        const relScore = this.getRelationshipScore(player.id, syndication.originatorId);
        score += (relScore - 50) * 0.5; // +/- impact
        if (relScore > 70) reasons.push('Strong Originator Relationship');

        // Sector Preference
        if (player.preferredSectors && player.preferredSectors.includes(syndication.industry)) {
=======
        // Check capacity
        // NOTE: All comparisons in DOLLARS for consistency
        const wealth = SimulationEngine?.getWealth(participantId);
        const availableCapital = wealth ? (wealth.currentWealth - (wealth.allocatedCapital || 0)) : 500000000;
        const maxBidDollars = Math.min(
            this.fromM(profile.maxAllocation),  // Convert millions to dollars
            availableCapital * 0.2
        );
        const syndicationDollars = this.fromM(syndication.amount);  // Convert millions to dollars

        if (maxBidDollars >= syndicationDollars * 0.1) {  // Can cover at least 10% of deal
>>>>>>> syndication-change
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

<<<<<<< HEAD
        // Decision
        const shouldBid = score >= 65; // Threshold
=======
        const shouldBid = score >= 40;

        // Calculate bid amount in MILLIONS (for storage) but based on DOLLAR math
        const bidAmountM = shouldBid ? Math.min(
            profile.maxAllocation,
            Math.round(syndication.amount * (0.1 + Math.random() * 0.2))
        ) : 0;
>>>>>>> syndication-change

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
<<<<<<< HEAD
            bidAmount,
            bidSpread,
            relationshipScore: relScore
=======
            bidAmount: bidAmountM,  // In MILLIONS for storage
            bidSpread: counterSpread,
            relationshipScore,
            isIndicationOfInterest: syndication.phase === 'bookbuilding'
>>>>>>> syndication-change
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
<<<<<<< HEAD
        bid.status = 'executed';

        // Update Subscription (Mock Logic - in real app would POST to API)
        const syndication = Data.getSyndication(bid.syndicationId);
        if (syndication) {
            // Find if already exists
            if (!syndication.bids) syndication.bids = [];
            syndication.bids.push({
=======
        const syndication = AutoGenerator?.getSyndication(bid.syndicationId);
        if (!syndication || syndication.status !== 'open') {
            bid.status = 'cancelled';
            return;
        }

        // Initialize bids array if missing
        if (!syndication.bids) {
            syndication.bids = [];
        }

        // Add bid to syndication
        // NOTE: bid.amount is in MILLIONS
        syndication.bids.push({
            participantId: bid.participantId,
            participantName: bid.participantName,
            amount: bid.amount,  // MILLIONS
            spread: bid.spread,  // BASIS POINTS
            timestamp: SimulationEngine?.getCurrentDate()?.toISOString(),
            reasons: bid.reasons
        });

        // Update subscription percentage
        // Both bid.amount and syndication.amount are in MILLIONS, so ratio is correct
        syndication.subscription = Math.min(
            100,
            syndication.subscription + (bid.amount / syndication.amount) * 100
        );

        // Record transaction in DOLLARS (SimulationEngine uses dollars)
        if (window.SimulationEngine) {
            SimulationEngine.recordTransaction({
                type: 'bid',
                from: bid.participantId,
                to: syndication.originatorId,
                amount: this.fromM(bid.amount),  // Convert MILLIONS to DOLLARS
                dealId: bid.syndicationId,
                description: `${bid.participantName} bid $${bid.amount}M on ${syndication.borrower}`
            });
        }

        bid.status = 'executed';

        console.log(`✅ Bid executed: ${bid.participantName} → ${syndication.id} for $${bid.amount}M @ ${bid.spread}bps`);

        // Emit event
        window.dispatchEvent(new CustomEvent('bidPlaced', { detail: bid }));
    },

    /**
     * Cancel a bid (called by participant)
     */
    cancelBid(bidId) {
        const bid = this.pendingBids.find(b => b.id === bidId);
        if (!bid) return { success: false, error: 'Bid not found' };

        if (!bid.canCancel) {
            return { success: false, error: 'Cancel window expired' };
        }

        const currentDate = SimulationEngine?.getCurrentDate() || new Date();

        // Calculate break fee (0.2% of bid amount)
        // bid.amount is MILLIONS, convert to DOLLARS for fee calculation
        const breakFee = this.fromM(bid.amount) * 0.002;  // 0.2% in DOLLARS

        bid.status = 'cancelled';

        // Record break fee transaction
        if (window.SimulationEngine) {
            SimulationEngine.recordTransaction({
                type: 'break_fee',
                from: bid.participantId,
                to: 'platform',
                amount: breakFee,
                dealId: bid.syndicationId,
                description: `Break fee for cancelled bid on ${bid.syndicationId}`
            });

            // Deduct from participant wealth
            SimulationEngine.updateWealth(bid.participantId, {
                currentWealth: -breakFee,
                totalFeesPaid: breakFee
            });
        }

        console.log(`❌ Bid cancelled: ${bid.participantName} on ${bid.syndicationId}. Break fee: $${breakFee.toLocaleString()}`);

        return { success: true, breakFee };
    },

    /**
     * Get bids for a participant
     */
    getParticipantBids(participantId) {
        return this.pendingBids.filter(b => b.participantId === participantId);
    },

    /**
     * Get bids for a syndication
     */
    getSyndicationBids(syndicationId) {
        return this.pendingBids.filter(b => b.syndicationId === syndicationId);
    },

    /**
     * Handle oversubscription - scale allocations with relationship weighting
     */
    scaleAllocations(syndication) {
        const bids = syndication.bids || [];
        if (bids.length === 0) return [];

        const totalBidAmount = bids.reduce((sum, b) => sum + b.amount, 0);
        const targetAmount = syndication.amount * (syndication.syndicationTarget / 100);

        // If not oversubscribed, allocate as-is
        if (totalBidAmount <= targetAmount) {
            return bids.map(bid => ({
                ...bid,
                allocation: bid.amount,
                scaleFactor: 1.0
            }));
        }

        // Oversubscribed - scale with relationship weighting
        const oversubRatio = totalBidAmount / targetAmount;
        console.log(`📊 Deal ${syndication.id} is ${(oversubRatio * 100).toFixed(0)}% oversubscribed`);

        // Calculate weighted bids (relationship bonus)
        const weightedBids = bids.map(bid => {
            const relationship = this.getRelationshipScore(bid.participantId, syndication.originatorId);
            // Higher relationship = better allocation (1.0 to 1.5x weight)
            const relationshipMult = 1 + (relationship / 200);
            return {
                ...bid,
                weight: bid.amount * relationshipMult,
                relationshipMult
            };
        });

        const totalWeight = weightedBids.reduce((sum, b) => sum + b.weight, 0);

        // Allocate proportionally to weighted amounts
        const allocations = weightedBids.map(bid => {
            const allocation = Math.round((bid.weight / totalWeight) * targetAmount);
            const scaleFactor = allocation / bid.amount;

            return {
>>>>>>> syndication-change
                participantId: bid.participantId,
                participantName: bid.participantName,
                amount: bid.amount,
                spread: bid.spread,
                timestamp: new Date().toISOString()
            });

<<<<<<< HEAD
            // Update subscription rate
            const totalBids = syndication.bids.reduce((sum, b) => sum + b.amount, 0);
            syndication.subscription = Math.min(100, (totalBids / syndication.amount) * 100);

            console.log(`✅ Bid Placed: ${bid.participantName} $${bid.amount}M on ${syndication.borrower}`);
=======
        // Record commitment fee transactions for each allocation
        // NOTE: alloc.allocation is in MILLIONS, convert to DOLLARS for transactions
        allocations.forEach(alloc => {
            const commitmentFee = this.fromM(alloc.allocation) * (syndication.commitmentFeeRate || 0.01);

            if (window.SimulationEngine && commitmentFee > 0) {
                SimulationEngine.recordTransaction({
                    type: 'commitment_fee',
                    from: alloc.participantId,
                    to: syndication.originatorId,
                    amount: commitmentFee,  // DOLLARS
                    dealId: syndication.id,
                    description: `Commitment fee for $${alloc.allocation}M allocation`
                });
>>>>>>> syndication-change

            // POST to API (fire and forget)
            API.agentBid(bid.participantId, syndication).catch(e => console.warn('API Bid Error:', e));

<<<<<<< HEAD
            // Notify UI
            window.dispatchEvent(new CustomEvent('bidPlaced', { detail: bid }));
            window.dispatchEvent(new CustomEvent('syndicationUpdated', { detail: { id: syndication.id } }));
        }
=======
                // Notify backend agent (Sync state)
                if (typeof API !== 'undefined' && !API.useMockData && alloc.participantId.startsWith('PA-')) {
                    API.agentAllocate(alloc.participantId, syndication.id, {
                        final_allocation: this.fromM(alloc.allocation),  // DOLLARS
                        allocation_percentage: (alloc.allocation / syndication.amount) * 100,
                        final_spread: syndication.spread || 400  // BASIS POINTS
                    });
                }
            }
        });

        syndication.allocations = allocations;
        syndication.phase = 'closing';

        console.log(`✅ Allocations for ${syndication.id}:`, allocations.map(a =>
            `${a.participantName}: $${a.allocation}M (${(a.scaleFactor * 100).toFixed(0)}%)`
        ).join(', '));

        return allocations;
>>>>>>> syndication-change
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
