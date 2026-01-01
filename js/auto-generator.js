/**
 * SyndiMatch Auto-Generator
 * Automatically generates syndications based on simulation time
 */

const AutoGenerator = {
    // Active syndications in the simulation
    activeSyndications: [],

    // Generation parameters
    config: {
        minDealsPerMonth: 1,
        maxDealsPerMonth: 3,
        minAmount: 50,  // $50M
        maxAmount: 500, // $500M
        industries: ['Technology', 'Healthcare', 'Energy', 'Real Estate', 'Manufacturing', 'Financial Services'],
        ratings: ['AAA', 'AA+', 'AA', 'A', 'BBB+', 'BBB', 'BB+', 'BB', 'B'],
        ratingWeights: [5, 8, 10, 15, 20, 20, 12, 7, 3], // Probability weights
        borrowerNames: [
            'TechFlow Solutions', 'MediCare Group', 'EnergyPlus Corp', 'PropMax Holdings',
            'IndustrialX Inc', 'FinanceHub Ltd', 'CloudScale Systems', 'BioGenix Pharma',
            'GreenPower Energy', 'RealtyPrime', 'MetalWorks Industries', 'DataStream Corp',
            'HealthFirst Network', 'SolarTech Solutions', 'CapitalVest Partners'
        ]
    },

    // Originator definitions with tier limits
    originators: {
        'OA-001': { name: 'JPMorgan Chase', tier: 'mega', maxAmount: 1000, minSpread: 300 },
        'OA-002': { name: 'Bank of America', tier: 'mega', maxAmount: 800, minSpread: 320 },
        'OA-003': { name: 'Wells Fargo', tier: 'major', maxAmount: 600, minSpread: 340 },
        'OA-004': { name: 'Citi', tier: 'major', maxAmount: 600, minSpread: 330 },
        'OA-005': { name: 'Goldman Sachs', tier: 'mega', maxAmount: 700, minSpread: 350 },
        'OA-006': { name: 'Morgan Stanley', tier: 'major', maxAmount: 500, minSpread: 360 },
        'OA-007': { name: 'Credit Suisse', tier: 'regional', maxAmount: 300, minSpread: 380 },
        'OA-008': { name: 'Deutsche Bank', tier: 'regional', maxAmount: 300, minSpread: 370 }
    },

    // Track last generation date
    lastGenerationMonth: null,
    dealsThisMonth: 0,

    /**
     * Initialize the generator
     */
    init() {
        // Listen for simulation events
        if (window.SimulationEngine) {
            SimulationEngine.on('monthChange', (data) => this.onMonthChange(data));
            SimulationEngine.on('dayChange', (data) => this.onDayChange(data));
            SimulationEngine.on('simulationReset', () => this.reset());
        }

        console.log('🏭 Auto-Generator initialized');
    },

    /**
     * Handle month change - reset deal counter
     */
    onMonthChange(data) {
        const month = data.date.getMonth();
        const year = data.date.getFullYear();
        const monthKey = `${year}-${month}`;

        if (this.lastGenerationMonth !== monthKey) {
            this.lastGenerationMonth = monthKey;
            this.dealsThisMonth = 0;

            // Generate deals for this month
            const numDeals = this.randomInt(this.config.minDealsPerMonth, this.config.maxDealsPerMonth);
            console.log(`📅 New month ${monthKey}: Planning ${numDeals} syndications`);
        }
    },

    /**
     * Handle day change - potentially generate a deal
     */
    onDayChange(data) {
        // Check for phase transitions on existing deals
        this.checkPhaseTransitions(data.date);

        // Random chance to generate a deal each day
        const maxDeals = this.config.maxDealsPerMonth;
        if (this.dealsThisMonth >= maxDeals) return;

        // 10% chance per day, adjusted by remaining deals needed
        const remainingDeals = maxDeals - this.dealsThisMonth;
        const dayOfMonth = data.date.getDate();
        const daysRemaining = 30 - dayOfMonth;

        // Increase probability as month progresses
        const probability = Math.min(0.5, (remainingDeals / Math.max(daysRemaining, 1)) * 0.3);

        if (Math.random() < probability) {
            this.generateSyndication(data.date);
        }
    },

    /**
     * Generate a new syndication with realistic bookbuilding phases
     */
    generateSyndication(date) {
        // Check market conditions for deal frequency
        const marketMult = window.MarketConditions?.conditionEffects[MarketConditions.currentCondition]?.newDealFrequency || 1;
        if (Math.random() > marketMult) {
            // Market conditions prevent this deal
            return null;
        }

        // Pick random originator
        const originatorIds = Object.keys(this.originators);
        const originatorId = originatorIds[this.randomInt(0, originatorIds.length - 1)];
        const originator = this.originators[originatorId];

        // Generate deal parameters
        const rating = this.weightedRandom(this.config.ratings, this.config.ratingWeights);
        const isInvestmentGrade = ['AAA', 'AA+', 'AA', 'A', 'BBB+', 'BBB'].includes(rating);

        // Base spread adjusted for market conditions
        const marketSpreadAdj = window.MarketConditions?.getSpreadAdjustment() || 0;
        const spreadFloor = (isInvestmentGrade ? 300 : 400) + marketSpreadAdj;
        const spreadCeiling = (isInvestmentGrade ? 450 : 600) + marketSpreadAdj;

        // Price talk range (before final pricing)
        const priceTalkMin = this.randomInt(spreadFloor - 25, spreadFloor);
        const priceTalkMax = priceTalkMin + this.randomInt(30, 60);

        // Commitment fee rate based on deal size and rating
        const baseCommitmentFee = isInvestmentGrade ? 0.0075 : 0.0125; // 0.75% or 1.25%
        const commitmentFeeRate = baseCommitmentFee + (Math.random() * 0.005); // Add 0-0.5% variance

        const amount = Math.round(this.randomInt(this.config.minAmount, Math.min(this.config.maxAmount, originator.maxAmount)) / 10) * 10;

        const syndication = {
            id: `SYND-${date.getFullYear()}-${String(this.activeSyndications.length + 1).padStart(3, '0')}`,
            borrower: this.config.borrowerNames[this.randomInt(0, this.config.borrowerNames.length - 1)] + ` ${this.randomInt(100, 999)}`,
            industry: this.config.industries[this.randomInt(0, this.config.industries.length - 1)],
            amount: amount,
            rating: rating,

            // Bookbuilding fields
            phase: 'bookbuilding', // bookbuilding → pricing → allocation → closing
            priceTalk: { min: priceTalkMin, max: priceTalkMax },
            indicationsOfInterest: [],
            finalSpread: null, // Set after bookbuilding

            // Commitment fee
            commitmentFeeRate: commitmentFeeRate,
            totalCommitmentFees: 0,

            // Legacy spread field (set to priceTalk midpoint initially)
            spread: Math.round((priceTalkMin + priceTalkMax) / 2),

            tenor: ['3Y', '5Y', '7Y'][this.randomInt(0, 2)],
            loanType: ['Term Loan B', 'Revolver', 'Bridge Loan'][this.randomInt(0, 2)],
            syndicationTarget: this.randomInt(70, 95),
            originatorId: originatorId,
            originatorName: originator.name,
            status: 'open',
            subscription: 0,

            // Negotiation tracking
            round: 1,
            maxRounds: 3,
            negotiationHistory: [],

            // Market context
            marketCondition: window.MarketConditions?.currentCondition || 'neutral',
            marketVolatility: window.MarketConditions?.volatilityIndex || 50,

            announcedAt: date.toISOString(),
            bookbuildDeadline: new Date(date.getTime() + 5 * 24 * 3600000).toISOString(), // 5 days for bookbuilding
            pricingDate: new Date(date.getTime() + 6 * 24 * 3600000).toISOString(), // Day 6
            closingDate: new Date(date.getTime() + 10 * 24 * 3600000).toISOString(), // Day 10
            bids: []
        };

        this.activeSyndications.push(syndication);

        // Sync with global SyndiData for UI components
        if (typeof SyndiData !== 'undefined' && Array.isArray(SyndiData.syndications)) {
            SyndiData.syndications.push(syndication);
        }

        this.dealsThisMonth++;

        // Record transaction
        if (window.SimulationEngine) {
            SimulationEngine.recordTransaction({
                type: 'syndication_announcement',
                from: originatorId,
                to: null,
                amount: syndication.amount * 1000000,
                dealId: syndication.id,
                description: `${originator.name} announced ${syndication.borrower} $${syndication.amount}M (Price talk: ${priceTalkMin}-${priceTalkMax}bps)`
            });

            // Update originator stats
            SimulationEngine.updateWealth(originatorId, {
                activeDeals: 1
            });
        }

        // Emit event for other systems
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: syndication }));

        console.log(`🆕 New syndication: ${syndication.id} - ${syndication.borrower} $${syndication.amount}M | Price talk: ${priceTalkMin}-${priceTalkMax}bps | Fee: ${(commitmentFeeRate * 100).toFixed(2)}%`);

        return syndication;
    },

    /**
     * Process bookbuilding phase completion
     */
    processBookbuilding(syndication) {
        if (syndication.phase !== 'bookbuilding') return;

        const iois = syndication.indicationsOfInterest;
        const totalIndicated = iois.reduce((sum, ioi) => sum + ioi.amount, 0);
        const oversubscriptionRatio = totalIndicated / syndication.amount;

        // Determine final spread based on demand
        let finalSpread;
        if (oversubscriptionRatio >= 2.0) {
            // Very hot deal - price tight
            finalSpread = syndication.priceTalk.min - 10;
        } else if (oversubscriptionRatio >= 1.5) {
            // Good demand - price at tight end
            finalSpread = syndication.priceTalk.min;
        } else if (oversubscriptionRatio >= 1.0) {
            // Adequate demand - price at midpoint
            finalSpread = Math.round((syndication.priceTalk.min + syndication.priceTalk.max) / 2);
        } else {
            // Weak demand - price at wide end or widen further
            finalSpread = syndication.priceTalk.max + (1 - oversubscriptionRatio) * 25;
        }

        syndication.finalSpread = finalSpread;
        syndication.spread = finalSpread;
        syndication.phase = 'pricing';
        syndication.status = 'negotiating';

        // Emit update
        window.dispatchEvent(new CustomEvent('syndicationUpdate', { detail: syndication }));

        console.log(`📊 ${syndication.id} bookbuilding complete: ${(oversubscriptionRatio * 100).toFixed(0)}% indicated → Final spread: ${finalSpread}bps`);

        return syndication;
    },

    /**
     * Calculate commitment fees for allocation
     */
    calculateCommitmentFee(syndication, allocationAmount) {
        const fee = allocationAmount * syndication.commitmentFeeRate;
        syndication.totalCommitmentFees += fee;
        return fee;
    },

    /**
     * Add a manually created syndication
     */
    addSyndication(syndication) {
        this.activeSyndications.push(syndication);

        // Emit event
        window.dispatchEvent(new CustomEvent('newSyndication', { detail: syndication }));
    },

    /**
     * Get open syndications
     */
    getOpenSyndications() {
        return this.activeSyndications.filter(s => s.status === 'open');
    },

    /**
     * Get syndication by ID
     */
    getSyndication(id) {
        return this.activeSyndications.find(s => s.id === id);
    },

    /**
     * Update syndication status
     */
    updateSyndication(id, updates) {
        const synd = this.getSyndication(id);
        if (synd) {
            Object.assign(synd, updates);

            // If closed, move to completed
            if (updates.status === 'completed' || updates.status === 'closed') {
                window.dispatchEvent(new CustomEvent('syndicationClosed', { detail: synd }));
            }
        }
        return synd;
    },

    /**
     * Add bid to syndication
     */
    addBid(syndicationId, bid) {
        const synd = this.getSyndication(syndicationId);
        if (synd) {
            synd.bids.push(bid);
            synd.subscription = Math.min(100, synd.subscription + (bid.amount / synd.amount) * 100);

            // Check if fully subscribed
            if (synd.subscription >= synd.syndicationTarget) {
                synd.status = 'negotiating';
            }
        }
        return synd;
    },

    /**
     * Check for phase transitions based on date
     */
    checkPhaseTransitions(currentDate) {
        this.activeSyndications.forEach(synd => {
            if (synd.status === 'completed' || synd.status === 'closed') return;

            const now = currentDate.getTime();
            const bookbuildDeadline = new Date(synd.bookbuildDeadline).getTime();
            const pricingDate = new Date(synd.pricingDate).getTime();
            const closingDate = new Date(synd.closingDate).getTime();

            // Transition: Bookbuilding -> Pricing (Negotiating)
            if (synd.phase === 'bookbuilding' && now >= bookbuildDeadline) {
                this.processBookbuilding(synd);
            }
            // Transition: Pricing -> Allocation (Closing)
            else if (synd.phase === 'pricing' && now >= pricingDate) {
                synd.phase = 'allocation';
                synd.status = 'closing';
                window.dispatchEvent(new CustomEvent('syndicationUpdate', { detail: synd }));
            }
            // Transition: Allocation -> Closed (Completed)
            else if (synd.phase === 'allocation' && now >= closingDate) {
                synd.phase = 'closed';
                synd.status = 'completed';

                // Finalize deal wrapper
                if (window.SimulationEngine) {
                    SimulationEngine.updateWealth(synd.originatorId, {
                        totalFeesEarned: synd.totalCommitmentFees,
                        completedDeals: 1,
                        activeDeals: -1
                    });
                }

                window.dispatchEvent(new CustomEvent('syndicationClosed', { detail: synd }));
                window.dispatchEvent(new CustomEvent('syndicationUpdate', { detail: synd }));
            }
        });
    },

    /**
     * Reset generator
     */
    reset() {
        this.activeSyndications = [];
        this.lastGenerationMonth = null;
        this.dealsThisMonth = 0;
        console.log('🔄 Auto-Generator reset');
    },

    /**
     * Random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Weighted random selection
     */
    weightedRandom(items, weights) {
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) return items[i];
        }
        return items[items.length - 1];
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    AutoGenerator.init();
});

// Export
window.AutoGenerator = AutoGenerator;
