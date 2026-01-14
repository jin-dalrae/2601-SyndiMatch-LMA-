/**
 * SyndiMatch - Role Context Manager
 * Manages user role selection and filters dashboard data accordingly
 */

const RoleContext = {
    // Current role state
    currentRole: 'platform',
    currentAgentId: null,
    currentAgentType: null,

    // Cache of agent data
    agentProfile: null,

    /**
     * Initialize role selector
     */
    init() {
        const dropdown = document.getElementById('role-dropdown');
        if (!dropdown) return;

        dropdown.addEventListener('change', (e) => {
            this.setRole(e.target.value);
        });

        // Load saved role from localStorage
        const savedRole = localStorage.getItem('syndimatch_role');
        if (savedRole) {
            dropdown.value = savedRole;
            this.setRole(savedRole, false);
        }
    },

    /**
     * Set the current viewing role
     */
    async setRole(roleValue, refresh = true) {
        localStorage.setItem('syndimatch_role', roleValue);

        if (roleValue === 'platform') {
            this.currentRole = 'platform';
            this.currentAgentId = null;
            this.currentAgentType = null;
            this.agentProfile = null;
        } else {
            const [type, agentId] = roleValue.split(':');
            this.currentRole = type;
            this.currentAgentId = agentId;
            this.currentAgentType = type;

            // Load agent profile
            await this.loadAgentProfile(agentId, type);
        }

        // Update UI to reflect role
        this.updateRoleUI();

        // Refresh data if needed
        if (refresh) {
            this.refreshDashboard();
        }

        console.log(`Role changed to: ${this.currentRole}`, this.currentAgentId);
    },

    /**
     * Load agent profile from API/mock data
     */
    async loadAgentProfile(agentId, type) {
        try {
            if (type === 'participant') {
                // Try API first
                const agentsData = await API.getAgents();
                const participants = agentsData?.participant || SyndiData?.participants || [];

                // Exact ID match first, then fallback to name prefix match
                this.agentProfile = participants.find(p =>
                    (p.agent_id === agentId || p.id === agentId) ||
                    (p.name?.split(' ')[0] === agentId.split('-')[1])
                );
            } else if (type === 'originator') {
                // Create originator profile from data
                this.agentProfile = {
                    id: agentId,
                    name: this.getOriginatorName(agentId),
                    type: 'originator'
                };
            }
        } catch (e) {
            console.error('Failed to load agent profile:', e);
        }
    },

    /**
     * Get originator name from ID
     */
    getOriginatorName(agentId) {
        const names = {
            'OA-001': 'JPMorgan Chase',
            'OA-002': 'Bank of America',
            'OA-003': 'Citigroup',
            'OA-004': 'Goldman Sachs',
            'OA-005': 'Wells Fargo',
            'OA-006': 'BNP Paribas',
            'OA-007': 'Barclays',
            'OA-008': 'MUFG Bank'
        };
        return names[agentId] || agentId;
    },

    /**
     * Update UI elements based on role
     */
    updateRoleUI() {
        const body = document.body;

        // Remove existing role classes
        body.classList.remove('role-platform', 'role-participant', 'role-originator');

        // Add current role class
        body.classList.add(`role-${this.currentRole}`);

        // Update metrics bar labels if in specific role
        if (this.currentRole === 'participant') {
            this.updateMetricsForParticipant();
        } else if (this.currentRole === 'originator') {
            this.updateMetricsForOriginator();
        } else {
            this.updateMetricsForPlatform();
        }
    },

    /**
     * Filter syndications based on current role
     */
    filterSyndications(syndications) {
        if (this.currentRole === 'platform') {
            return syndications; // Show all
        }

        if (this.currentRole === 'participant') {
            // Show syndications where this participant has bid or been allocated
            return syndications.filter(s => {
                // Check if participant is involved
                const hasBid = s.bids?.some(b => b.participant === this.currentAgentId);
                const hasAllocation = s.allocations?.some(a => a.participant_agent_id === this.currentAgentId);
                const isOpen = s.status === 'open' || s.status === 'negotiating';
                return hasBid || hasAllocation || isOpen;
            });
        }

        if (this.currentRole === 'originator') {
            // Show only syndications from this originator
            return syndications.filter(s => s.originator_agent_id === this.currentAgentId);
        }

        return syndications;
    },

    /**
     * Update metrics for participant view
     */
    updateMetricsForParticipant() {
        // These would come from actual API data
        const metrics = {
            active: 'My Active Bids',
            value: 'My Exposure',
            closed: 'Allocations Won',
            success: 'Win Rate',
            participants: 'Interest Earned YTD',
            payments: 'Fees Paid YTD'
        };

        this.updateMetricLabels(metrics);
    },

    /**
     * Update metrics for originator view
     */
    updateMetricsForOriginator() {
        const metrics = {
            active: 'My Active Deals',
            value: 'Total Originated',
            closed: 'Closed This Month',
            success: 'Syndication Rate',
            participants: 'Unique Participants',
            payments: 'Fees Earned YTD'
        };

        this.updateMetricLabels(metrics);
    },

    /**
     * Update metrics for platform view
     */
    updateMetricsForPlatform() {
        const metrics = {
            active: 'Active Syndications',
            value: 'Total Value in Play',
            closed: 'Closed Today',
            success: 'Success Rate',
            participants: 'Active Participants',
            payments: 'Payments (24h)'
        };

        this.updateMetricLabels(metrics);
    },

    /**
     * Helper to update metric labels
     */
    updateMetricLabels(labels) {
        const cards = document.querySelectorAll('.metric-card');

        cards.forEach((card) => {
            const metricId = card.dataset.metricId;
            const labelEl = card.querySelector('.metric-label');
            if (labelEl && metricId && labels[metricId]) {
                labelEl.textContent = labels[metricId];
            }
        });
    },

    /**
     * Refresh dashboard with filtered data
     */
    refreshDashboard() {
        // Dispatch global event for components to listen to
        window.dispatchEvent(new CustomEvent('roleChanged', {
            detail: {
                role: this.currentRole,
                agentId: this.currentAgentId,
                profile: this.agentProfile
            }
        }));

        // Fallback for direct update if event listeners not yet widespread
        if (typeof PipelineComponent !== 'undefined') PipelineComponent.render();
        if (typeof MetricsComponent !== 'undefined') MetricsComponent.update();
        if (typeof AgentsComponent !== 'undefined') AgentsComponent.render();
    },

    /**
     * Calculate interest income for a participant
     * Interest = Principal * Spread * (Days Held / 365)
     */
    calculateInterestIncome(allocations, daysHeld = 30) {
        let totalInterest = 0;

        allocations.forEach(alloc => {
            const principal = alloc.final_allocation || 0;
            const spreadBps = alloc.final_spread || 400; // basis points
            const spreadDecimal = spreadBps / 10000;

            // Pro-rate interest for days held
            const interest = principal * spreadDecimal * (daysHeld / 365);
            totalInterest += interest;
        });

        return totalInterest;
    },

    /**
     * Get participant portfolio summary
     */
    getParticipantPortfolio(agentId) {
        // This would be fetched from API
        const mockPortfolio = {
            totalExposure: 450000000,
            activeAllocations: 8,
            completedDeals: 23,
            interestEarnedYTD: 12500000,
            feePaidYTD: 4200000,
            averageSpread: 385,
            winRate: 0.42
        };

        return mockPortfolio;
    },

    /**
     * Get originator portfolio summary
     */
    getOriginatorPortfolio(agentId) {
        const mockPortfolio = {
            totalOriginated: 2400000000,
            activeDeals: 3,
            completedDeals: 47,
            feesEarnedYTD: 28500000,
            averageSyndicationRate: 0.94,
            uniqueParticipants: 34
        };

        return mockPortfolio;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    RoleContext.init();
});
