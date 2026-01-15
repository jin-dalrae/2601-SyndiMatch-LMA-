/**
 * SyndiMatch Enhanced Auto-Bidder
 * Automatically places bids based on participant agent profiles
 * Includes relationship tracking, multi-round negotiations, and portfolio validation
 */

const AutoBidder = {
    // State
    participants: new Map(), // Loaded from API
    relationships: new Map(), // Map<participantId, Map<originatorId, score>>
    pendingBids: [],

    // Configuration
    config: {
        cancelWindowHours: 24,
        checkInterval: 60000,
        defaultRiskProfile: 'moderate'
    },

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
     * Initialize the Auto-Bidder
     */
    async init() {
        console.log('🤖 Initializing Enhanced Auto-Bidder...');

        // 1. Load Participant Profiles
        await this.loadParticipants();

        // 2. Initialize relationships if not already done
        this.initRelationships();

        // 3. Setup Event Listeners
        this.setupEventListeners();

        // 4. Process existing open syndications
        this.processOpenSyndications();

        // 5. Start periodic checks
        if (window.SimulationEngine) {
            SimulationEngine.on('timeTick', (data) => this.processTimeTick(data.date));
        } else {
            setInterval(() => this.processTimeTick(new Date()), this.config.checkInterval);
        }

        console.log(`✅ Auto-Bidder Ready (Managed Agents: ${this.participants.size})`);
    },

    /**
     * Initialize relationship scores
     */
    initRelationships() {
        const defaultOriginators = ['OA-001', 'OA-002', 'OA-003', 'OA-004'];
        for (const [participantId] of this.participants) {
            if (!this.relationships.has(participantId)) {
                this.relationships.set(participantId, new Map());
            }
            const pMap = this.relationships.get(participantId);
            defaultOriginators.forEach(originatorId => {
                if (!pMap.has(originatorId)) {
                    pMap.set(originatorId, 40 + Math.floor(Math.random() * 30));
                }
            });
        }
    },

    /**
     * Load participants from API
     */
    async loadParticipants() {
        try {
            if (typeof API === 'undefined' || !API.getParticipants) {
                this.loadDefaultParticipants();
                return;
            }

            const participants = await API.getParticipants();
            if (participants && participants.length > 0) {
                participants.forEach(p => {
                    const id = p.id || p._id;
                    if (id) {
                        const profile = this.enrichProfile({ ...p, id });
                        this.participants.set(id, profile);
                    }
                });
            } else {
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
        return {
            ...participant,
            riskAppetite: participant.risk_profile || this.config.defaultRiskProfile,
            targetYield: participant.target_yield || 7.0,
            maxAllocation: participant.max_allocation_per_deal || 50,
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
            case 'aggressive': return 'fast';
            case 'conservative': return 'slow';
            default: return 'medium';
        }
    },

    /**
     * Handle New Syndication Event
     */
    async onNewSyndication(syndication) {
        if (!syndication || syndication.status !== 'open') return;
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
        let score = 50;

        // 1. Hard Constraints
        if (syndication.esg_score && syndication.esg_score < player.esgMinScore) {
            return { shouldBid: false, reason: `ESG Score ${syndication.esg_score} < ${player.esgMinScore}` };
        }

        if (player.excludedSectors && player.excludedSectors.includes(syndication.industry)) {
            return { shouldBid: false, reason: `Sector ${syndication.industry} excluded` };
        }

        // 2. Capacity Check
        const wealth = window.SimulationEngine ? SimulationEngine.getWealth(player.id) : null;
        const availableCapital = wealth ? (wealth.currentWealth - (wealth.allocatedCapital || 0)) : this.fromM(500);

        if (availableCapital < this.fromM(player.minAllocation)) {
            return { shouldBid: false, reason: 'Insufficient available capital' };
        }

        // 3. Strategic Scoring
        const dealYield = (syndication.spread / 100) + 4.5;
        if (dealYield >= player.targetYield) {
            score += 20;
            reasons.push(`Yield ${dealYield.toFixed(2)}% >= Target`);
        } else {
            score -= 15;
            reasons.push(`Yield ${dealYield.toFixed(2)}% < Target`);
        }

        const relScore = this.getRelationshipScore(player.id, syndication.originatorId);
        score += (relScore - 50) * 0.5;
        if (relScore > 70) reasons.push('Strong Originator Relationship');

        if (player.preferredSectors && player.preferredSectors.includes(syndication.industry)) {
            score += 15;
            reasons.push('Preferred Sector');
        }

        // 4. Decision Threshold
        const threshold = player.strategy === 'aggressive' ? 55 : 65;
        const shouldBid = score >= threshold;

        // Calculate Bid Parameters
        let bidAmount = 0;
        let bidSpread = syndication.spread;

        if (shouldBid) {
            const max = player.maxAllocation;
            const sizeFactor = Math.min(1.0, (score - threshold) / (100 - threshold));
            bidAmount = Math.max(player.minAllocation, Math.round(max * (0.5 + 0.5 * sizeFactor)));

            // Limit bid to available capital
            const capitalLimitM = this.toM(availableCapital * 0.2);
            bidAmount = Math.min(bidAmount, capitalLimitM);

            if (player.strategy === 'aggressive') {
                bidSpread -= 5;
            } else if (player.strategy === 'conservative') {
                bidSpread += 15;
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
        window.dispatchEvent(new CustomEvent('bidScheduled', { detail: bid }));
    },

    processTimeTick(currentDate) {
        const now = currentDate.getTime();
        const dueBids = this.pendingBids.filter(b => b.status === 'pending' && b.scheduledTime.getTime() <= now);
        dueBids.forEach(bid => this.executeBid(bid));
    },

    executeBid(bid) {
        const syndication = window.SyndiData ? SyndiData.syndications.find(s => s.id === bid.syndicationId) : null;
        // Allow bids during open and negotiating phases
        if (!syndication || (syndication.status !== 'open' && syndication.status !== 'negotiating')) {
            bid.status = 'cancelled';
            return;
        }

        if (!syndication.bids) syndication.bids = [];
        syndication.bids.push({
            participantId: bid.participantId,
            participantName: bid.participantName,
            amount: bid.amount,
            spread: bid.spread,
            timestamp: new Date().toISOString()
        });

        // Update Subscription
        const totalBids = syndication.bids.reduce((sum, b) => sum + b.amount, 0);
        syndication.subscription = Math.min(100, (totalBids / syndication.amount) * 100);

        // Record in Simulation Engine
        if (window.SimulationEngine) {
            SimulationEngine.recordTransaction({
                type: 'bid',
                from: bid.participantId,
                to: syndication.originatorId,
                amount: this.fromM(bid.amount),
                dealId: bid.syndicationId,
                description: `${bid.participantName} bid $${bid.amount}M on ${syndication.borrower}`
            });
        }

        bid.status = 'executed';

        // POST to API
        if (window.API && !API.useMockData) {
            API.agentBid(bid.participantId, syndication).catch(() => { });
        }

        window.dispatchEvent(new CustomEvent('bidPlaced', { detail: bid }));
        window.dispatchEvent(new CustomEvent('syndicationUpdated', { detail: { id: syndication.id } }));
    },

    cancelBid(bidId) {
        const bid = this.pendingBids.find(b => b.id === bidId);
        if (!bid) return { success: false, error: 'Bid not found' };

        const now = window.SimulationEngine ? SimulationEngine.getCurrentDate().getTime() : Date.now();
        if (now > bid.cancelDeadline?.getTime()) {
            return { success: false, error: 'Cancel window expired' };
        }

        const breakFee = this.fromM(bid.amount) * 0.002;
        bid.status = 'cancelled';

        if (window.SimulationEngine) {
            SimulationEngine.recordTransaction({
                type: 'break_fee',
                from: bid.participantId,
                to: 'platform',
                amount: breakFee,
                dealId: bid.syndicationId,
                description: `Break fee for cancelled bid on ${bid.syndicationId}`
            });
            SimulationEngine.updateWealth(bid.participantId, { currentWealth: -breakFee });
        }

        return { success: true, breakFee };
    },

    getParticipantBids(participantId) {
        return this.pendingBids.filter(b => b.participantId === participantId);
    },

    getRelationshipScore(participantId, originatorId) {
        if (!this.relationships.has(participantId)) {
            this.relationships.set(participantId, new Map());
        }
        const pMap = this.relationships.get(participantId);
        if (!pMap.has(originatorId)) {
            pMap.set(originatorId, 50);
        }
        return pMap.get(originatorId);
    },

    getBidDelay(speed) {
        switch (speed) {
            case 'fast': return 0.5 + Math.random() * 2;
            case 'slow': return 12 + Math.random() * 24;
            default: return 4 + Math.random() * 8;
        }
    },

    setupEventListeners() {
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));
    },

    processOpenSyndications() {
        if (window.SyndiData && SyndiData.syndications) {
            SyndiData.syndications.forEach(s => {
                if (s.status === 'open') this.onNewSyndication(s);
            });
        }
    },

    loadDefaultParticipants() {
        const defaults = [
            { id: 'PA-001', name: 'Apollo Global', strategy: 'aggressive', max_allocation_per_deal: 150 },
            { id: 'PA-002', name: 'BlackRock', strategy: 'balanced', max_allocation_per_deal: 100 },
            { id: 'PA-003', name: 'JP Morgan Asset Mgmt', strategy: 'conservative', max_allocation_per_deal: 80 }
        ];
        defaults.forEach(p => this.participants.set(p.id, this.enrichProfile(p)));
        this.initRelationships();
    }
};

window.AutoBidder = AutoBidder;
