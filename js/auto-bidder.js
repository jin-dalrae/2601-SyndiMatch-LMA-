/**
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
 */

const AutoBidder = {
    // Participant profiles with bidding preferences
    participants: {
        'PA-001': {
            name: 'Apollo Global',
            riskAppetite: 'aggressive',
            targetYield: 8.5,
            maxAllocation: 150,
            preferredIndustries: ['Technology', 'Healthcare', 'Energy'],
            bidSpeed: 'fast' // 1-2 hours
        },
        'PA-002': {
            name: 'CalPERS',
            riskAppetite: 'conservative',
            targetYield: 6.5,
            maxAllocation: 100,
            preferredIndustries: ['Real Estate', 'Manufacturing'],
            bidSpeed: 'slow' // 12-24 hours
        },
        'PA-003': {
            name: 'BNP Paribas',
            riskAppetite: 'moderate',
            targetYield: 7.5,
            maxAllocation: 80,
            preferredIndustries: ['Financial Services', 'Technology'],
            bidSpeed: 'medium' // 4-8 hours
        },
        'PA-004': {
            name: 'MUFG Bank',
            riskAppetite: 'conservative',
            targetYield: 6.0,
            maxAllocation: 75,
            preferredIndustries: ['Manufacturing', 'Real Estate'],
            bidSpeed: 'medium'
        },
        'PA-005': {
            name: 'Palmer Square',
            riskAppetite: 'aggressive',
            targetYield: 9.5,
            maxAllocation: 100,
            preferredIndustries: ['Technology', 'Healthcare'],
            bidSpeed: 'fast'
        },
        'PA-101': {
            name: 'State Street',
            riskAppetite: 'moderate',
            targetYield: 7.0,
            maxAllocation: 40,
            preferredIndustries: ['Financial Services'],
            bidSpeed: 'medium'
        },
        'PA-102': {
            name: 'PNC Bank',
            riskAppetite: 'conservative',
            targetYield: 6.0,
            maxAllocation: 35,
            preferredIndustries: ['Real Estate', 'Manufacturing'],
            bidSpeed: 'slow'
        },
        'PA-103': {
            name: 'Northern Trust',
            riskAppetite: 'moderate',
            targetYield: 7.5,
            maxAllocation: 45,
            preferredIndustries: ['Healthcare', 'Technology'],
            bidSpeed: 'medium'
        },
        'PA-104': {
            name: 'KeyBank',
            riskAppetite: 'moderate',
            targetYield: 7.0,
            maxAllocation: 30,
            preferredIndustries: ['Real Estate'],
            bidSpeed: 'slow'
        },
        'PA-105': {
            name: 'Fifth Third',
            riskAppetite: 'conservative',
            targetYield: 6.5,
            maxAllocation: 25,
            preferredIndustries: ['Manufacturing'],
            bidSpeed: 'slow'
        }
    },

    // Relationship scores between participants and originators (0-100)
    // Higher scores = better relationships = priority allocations
    relationships: {
        // Initialized dynamically when first accessed
    },

    // Rating acceptance by risk appetite
    ratingAcceptance: {
        conservative: ['AAA', 'AA+', 'AA', 'A'],
        moderate: ['AAA', 'AA+', 'AA', 'A', 'BBB+', 'BBB'],
        aggressive: ['AAA', 'AA+', 'AA', 'A', 'BBB+', 'BBB', 'BB+', 'BB', 'B']
    },

    // Pending bids that can be cancelled
    pendingBids: [],

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
    },

    /**
     * Get relationship score
     */
    getRelationshipScore(participantId, originatorId) {
        if (!this.relationships[participantId]) this.initRelationships();
        return this.relationships[participantId]?.[originatorId] || 50;
    },

    /**
     * Update relationship score
     */
    updateRelationship(participantId, originatorId, delta) {
        if (!this.relationships[participantId]) this.initRelationships();
        if (!this.relationships[participantId][originatorId]) {
            this.relationships[participantId][originatorId] = 50;
        }
        this.relationships[participantId][originatorId] = Math.max(0, Math.min(100,
            this.relationships[participantId][originatorId] + delta
        ));
        console.log(`🤝 Relationship ${participantId}↔${originatorId}: ${delta > 0 ? '+' : ''}${delta} → ${this.relationships[participantId][originatorId]}`);
    },

    /**
     * Initialize the auto-bidder
     */
    init() {
        // Listen for new syndications
        window.addEventListener('newSyndication', (e) => this.onNewSyndication(e.detail));

        // Listen for time ticks to process pending bids
        if (window.SimulationEngine) {
            SimulationEngine.on('timeTick', (data) => this.processPendingBids(data.date));
        }

        // Process existing open syndications
        if (typeof SyndiData !== 'undefined' && SyndiData.syndications) {
            SyndiData.syndications.forEach(synd => {
                if (synd.status === 'open' || synd.status === 'negotiating') {
                    // Check if we need to bid (simple check: random chance or if bids < participants)
                    // Actually just trigger evaluation
                    this.onNewSyndication(synd);
                }
            });
        }

        console.log('🤖 Auto-Bidder initialized');
    },

    /**
     * Handle new syndication announcement
     */
    async onNewSyndication(syndication) {
        console.log(`📢 Auto-Bidder: Evaluating ${syndication.id}`);

        // Each participant evaluates the deal
        for (const [participantId, profile] of Object.entries(this.participants)) {
            const evaluation = await this.evaluateDeal(syndication, participantId, profile);

            if (evaluation.shouldBid) {
                // Schedule bid based on participant speed
                this.scheduleBid(syndication, participantId, profile, evaluation);
            }
        }
    },

    /**
     * Evaluate if participant should bid
     * Now includes relationship scoring and market conditions
     */
    async evaluateDeal(syndication, participantId, profile) {
        // Try Real Agent API first
        if (typeof API !== 'undefined' && !API.useMockData && participantId.startsWith('PA-')) {
            try {
                const agentResult = await API.agentBid(participantId, syndication);

                if (agentResult) {
                    if (agentResult.decision === 'bid') {
                        const bid = agentResult.bid;
                        return {
                            shouldBid: true,
                            score: 95,
                            reasons: [agentResult.reasoning || "AI Decision"],
                            bidAmount: bid.bid_amount / 1000000, // Convert back to Millions
                            bidSpread: bid.spread_bid,
                            relationshipScore: this.getRelationshipScore(participantId, syndication.originatorId),
                            isIndicationOfInterest: syndication.phase === 'bookbuilding'
                        };
                    } else {
                        return { shouldBid: false, reasons: [agentResult.reasoning || "AI Passed"] };
                    }
                }
            } catch (e) {
                console.warn(`AI Bid failed for ${participantId}, falling back to rules`, e);
            }
        }

        const reasons = [];
        let score = 0;

        // Check rating acceptance
        const acceptedRatings = this.ratingAcceptance[profile.riskAppetite];
        const ratingAccepted = acceptedRatings.includes(syndication.rating);
        if (!ratingAccepted) {
            return { shouldBid: false, reasons: ['Rating outside risk profile'] };
        }
        score += 20;
        reasons.push('Rating within tolerance');

        // Check yield (spread) meets target
        const estimatedYield = (syndication.spread || syndication.priceTalk?.max || 400) / 100 + 4;
        if (estimatedYield >= profile.targetYield) {
            score += 30;
            reasons.push(`Yield ${estimatedYield.toFixed(1)}% exceeds ${profile.targetYield}% target`);
        } else {
            score -= 10;
            reasons.push('Below target yield');
        }

        // Check industry preference
        if (profile.preferredIndustries.includes(syndication.industry)) {
            score += 25;
            reasons.push(`${syndication.industry} is preferred sector`);
        } else {
            score += 5;
            reasons.push('Sector diversification');
        }

        // NEW: Relationship scoring
        const relationshipScore = this.getRelationshipScore(participantId, syndication.originatorId);
        const relationshipBonus = (relationshipScore - 50) * 0.3; // -15 to +15
        score += relationshipBonus;
        if (relationshipScore >= 70) {
            reasons.push(`Strong relationship with ${syndication.originatorName}`);
        } else if (relationshipScore <= 30) {
            reasons.push(`Weak relationship with ${syndication.originatorName}`);
        }

        // NEW: Market conditions affect appetite
        const marketCondition = window.MarketConditions?.currentCondition || 'neutral';
        const demandMultiplier = window.MarketConditions?.getDemandMultiplier() || 1.0;

        if (marketCondition === 'bull') {
            score += 10;
            reasons.push('Bull market - increased appetite');
        } else if (marketCondition === 'bear') {
            score -= 15;
            reasons.push('Bear market - reduced appetite');
        }

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
            score += 15;
            reasons.push('Sufficient capacity');
        }

        // Apply market demand multiplier
        score *= demandMultiplier;

        // Random factor
        score += Math.random() * 20 - 10;

        const shouldBid = score >= 40;

        // Calculate bid amount in MILLIONS (for storage) but based on DOLLAR math
        const bidAmountM = shouldBid ? Math.min(
            profile.maxAllocation,
            Math.round(syndication.amount * (0.1 + Math.random() * 0.2))
        ) : 0;

        // Calculate counter-spread (for negotiations)
        const priceTalkMid = syndication.priceTalk
            ? Math.round((syndication.priceTalk.min + syndication.priceTalk.max) / 2)
            : syndication.spread;
        const counterSpread = priceTalkMid + Math.floor(Math.random() * 20) - 10;

        return {
            shouldBid,
            score: Math.round(score),
            reasons,
            bidAmount: bidAmountM,  // In MILLIONS for storage
            bidSpread: counterSpread,
            relationshipScore,
            isIndicationOfInterest: syndication.phase === 'bookbuilding'
        };
    },

    /**
     * Schedule a bid based on participant speed
     */
    scheduleBid(syndication, participantId, profile, evaluation) {
        const delayHours = {
            fast: 1 + Math.random() * 2,    // 1-3 hours
            medium: 4 + Math.random() * 8,  // 4-12 hours
            slow: 12 + Math.random() * 12   // 12-24 hours
        };

        const currentDate = SimulationEngine?.getCurrentDate() || new Date();
        const bidTime = new Date(currentDate.getTime() + delayHours[profile.bidSpeed] * 3600000);

        const pendingBid = {
            id: `BID-${Date.now()}-${participantId}`,
            syndicationId: syndication.id,
            participantId,
            participantName: profile.name,
            amount: evaluation.bidAmount,
            spread: evaluation.bidSpread,
            scheduledTime: bidTime,
            reasons: evaluation.reasons,
            status: 'pending',
            canCancel: true,
            cancelDeadline: new Date(bidTime.getTime() + this.cancelWindowHours * 3600000)
        };

        this.pendingBids.push(pendingBid);

        console.log(`⏳ Scheduled bid from ${profile.name} on ${syndication.id} for ${bidTime.toLocaleString()}`);
    },

    /**
     * Process pending bids based on current simulation time
     */
    processPendingBids(currentDate) {
        const now = currentDate.getTime();

        this.pendingBids.forEach(bid => {
            if (bid.status === 'pending' && bid.scheduledTime.getTime() <= now) {
                this.executeBid(bid);
            }

            // Update cancel window
            if (bid.status === 'executed' && bid.cancelDeadline.getTime() <= now) {
                bid.canCancel = false;
            }
        });

        // Clean up old bids
        this.pendingBids = this.pendingBids.filter(b =>
            b.status !== 'cancelled' &&
            (b.status === 'pending' || b.canCancel)
        );
    },

    /**
     * Execute a bid
     */
    executeBid(bid) {
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
                participantId: bid.participantId,
                participantName: bid.participantName,
                requestedAmount: bid.amount,
                allocation: allocation,
                scaleFactor: scaleFactor,
                relationshipBonus: bid.relationshipMult > 1.1
            };
        });

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

                // Update relationship (successful deal = +5)
                this.updateRelationship(alloc.participantId, syndication.originatorId, 5);

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
    },

    /**
     * Reset bidder state
     */
    reset() {
        this.pendingBids = [];
        this.relationships = {};
        console.log('🔄 Auto-Bidder reset');
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AutoBidder.init();
});

// Export
window.AutoBidder = AutoBidder;
