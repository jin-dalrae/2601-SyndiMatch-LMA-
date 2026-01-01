/**
 * SyndiMatch Market Conditions Module
 * Simulates market volatility and cycles affecting syndication success
 */

const MarketConditions = {
    // Market state
    currentCondition: 'neutral',
    volatilityIndex: 50, // 0-100 scale
    cycleDay: 0,

    // Market cycle parameters (in simulated days)
    cycleDuration: {
        bull: { min: 60, max: 180 },
        neutral: { min: 30, max: 90 },
        bear: { min: 45, max: 120 }
    },

    // Impact multipliers by market condition
    conditionEffects: {
        bull: {
            spreadAdjustment: -25,      // Tighter spreads
            successRateMultiplier: 1.2, // Higher success
            demandMultiplier: 1.3,      // More participant appetite
            newDealFrequency: 1.4       // More origination
        },
        neutral: {
            spreadAdjustment: 0,
            successRateMultiplier: 1.0,
            demandMultiplier: 1.0,
            newDealFrequency: 1.0
        },
        bear: {
            spreadAdjustment: 50,        // Wider spreads required
            successRateMultiplier: 0.7,  // Lower success
            demandMultiplier: 0.6,       // Less appetite
            newDealFrequency: 0.5        // Fewer new deals
        }
    },

    // Historical conditions for charting
    history: [],

    /**
     * Initialize market conditions
     */
    init() {
        this.currentCondition = 'neutral';
        this.volatilityIndex = 50;
        this.cycleDay = 0;
        this.history = [];

        // Listen for simulation ticks
        if (window.SimulationEngine) {
            SimulationEngine.on('dayChange', (data) => this.onDayChange(data));
            SimulationEngine.on('simulationReset', () => this.reset());
        }

        console.log('📊 Market Conditions initialized');
    },

    /**
     * Reset to initial state
     */
    reset() {
        this.currentCondition = 'neutral';
        this.volatilityIndex = 50;
        this.cycleDay = 0;
        this.history = [];
    },

    /**
     * Handle day change - update market conditions
     */
    onDayChange(data) {
        this.cycleDay++;

        // Random daily volatility adjustment (-5 to +5)
        const dailyChange = (Math.random() - 0.5) * 10;
        this.volatilityIndex = Math.max(0, Math.min(100, this.volatilityIndex + dailyChange));

        // Check for market regime change
        this.checkForRegimeChange();

        // Record history
        this.history.push({
            date: data.date,
            condition: this.currentCondition,
            volatility: this.volatilityIndex
        });

        // Keep history manageable
        if (this.history.length > 365) {
            this.history.shift();
        }

        // Emit event for UI updates
        this.emit('marketUpdate', {
            condition: this.currentCondition,
            volatility: this.volatilityIndex,
            effects: this.getCurrentEffects()
        });
    },

    /**
     * Check if market should change regime
     */
    checkForRegimeChange() {
        const currentCycle = this.cycleDuration[this.currentCondition];
        const cycleDays = currentCycle.min + Math.random() * (currentCycle.max - currentCycle.min);

        // Check if cycle has completed
        if (this.cycleDay >= cycleDays) {
            this.transitionMarket();
            this.cycleDay = 0;
        }

        // Also check for sudden shocks
        if (Math.random() < 0.005) { // 0.5% daily chance of shock
            this.marketShock();
        }
    },

    /**
     * Transition to new market regime
     */
    transitionMarket() {
        const transitions = {
            bull: ['neutral', 'neutral', 'bear'], // More likely to go to neutral
            neutral: ['bull', 'bear'],
            bear: ['neutral', 'neutral', 'bull']
        };

        const options = transitions[this.currentCondition];
        const newCondition = options[Math.floor(Math.random() * options.length)];

        if (newCondition !== this.currentCondition) {
            console.log(`📈 Market regime change: ${this.currentCondition} → ${newCondition}`);
            this.currentCondition = newCondition;

            this.emit('regimeChange', {
                from: this.currentCondition,
                to: newCondition
            });
        }
    },

    /**
     * Sudden market shock event
     */
    marketShock() {
        const isPositive = Math.random() > 0.4; // 60% chance of negative shock

        if (isPositive) {
            this.volatilityIndex = Math.min(100, this.volatilityIndex + 20);
            if (this.currentCondition !== 'bull') {
                this.currentCondition = 'bull';
            }
            console.log('📈 Market shock: Positive catalyst!');
        } else {
            this.volatilityIndex = Math.max(0, this.volatilityIndex + 30);
            if (this.currentCondition !== 'bear') {
                this.currentCondition = 'bear';
            }
            console.log('📉 Market shock: Risk-off event!');
        }

        this.emit('marketShock', { positive: isPositive });
    },

    /**
     * Get current market effects
     */
    getCurrentEffects() {
        return this.conditionEffects[this.currentCondition];
    },

    /**
     * Get spread adjustment for current market
     */
    getSpreadAdjustment() {
        return this.conditionEffects[this.currentCondition].spreadAdjustment;
    },

    /**
     * Get demand multiplier for participant appetite
     */
    getDemandMultiplier() {
        return this.conditionEffects[this.currentCondition].demandMultiplier;
    },

    /**
     * Get success rate modifier
     */
    getSuccessMultiplier() {
        return this.conditionEffects[this.currentCondition].successRateMultiplier;
    },

    /**
     * Check if deal spread is acceptable in current market
     */
    isSpreadAcceptable(offeredSpread, baselineSpread) {
        const requiredSpread = baselineSpread + this.getSpreadAdjustment();
        return offeredSpread >= requiredSpread;
    },

    /**
     * Simple event emitter
     */
    listeners: {},

    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    MarketConditions.init();
});

// Export
window.MarketConditions = MarketConditions;
