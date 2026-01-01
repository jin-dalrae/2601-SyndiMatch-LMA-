// ========================================
// Comprehensive Agent Seed Data
// Generated participant_agents, negotiation_agents, and allocations
// ========================================

const agentSeedData = {
    // ========================================
    // PARTICIPANT AGENTS (5 Major + 10 Minor for demo)
    // ========================================
    participant_agents: [
        // === MAJOR PARTICIPANTS (PA-001 to PA-005) ===
        {
            _id: 'PA-001',
            tier: 'major',
            institution: {
                name: 'Apollo Global Management',
                type: 'Private Credit Fund',
                headquarters: 'New York, NY',
                aum: 650000000000,
                credit_business_aum: 450000000000
            },
            risk_appetite: {
                total_capital_available: 2500000000,
                current_deployed: 1800000000,
                available_capacity: 700000000,
                max_single_ticket: 300000000,
                min_ticket: 25000000,
                credit_rating_range: { min: 'B-', max: 'BBB+', sweet_spot: 'BB to BB+' },
                target_all_in_yield: 10.5,
                min_acceptable_yield: 8.0
            },
            sector_preferences: {
                preferred: ['Technology', 'Healthcare', 'Business Services', 'Software'],
                neutral: ['Industrial', 'Consumer', 'Financial Services'],
                avoid: ['Oil & Gas', 'Retail', 'Restaurants']
            },
            strategy: {
                investment_style: 'aggressive',
                hold_period_target: '4-7 years',
                portfolio_construction: 'concentrated',
                bidding_behavior: 'fast_decisive',
                spread_sensitivity: 'low'
            },
            constraints: {
                esg_requirements: false,
                sector_concentration_limit: 0.25,
                single_borrower_limit: 0.05
            },
            decision_making: {
                speed: 'very_fast',
                autonomy_level: 'very_high',
                typical_response_time_hours: 2,
                requires_committee_approval_above: 200000000
            },
            performance_history: {
                bids_submitted_ytd: 247,
                allocations_won: 89,
                win_rate: 0.36,
                average_spread_paid: 420
            },
            status: 'active'
        },
        {
            _id: 'PA-002',
            tier: 'major',
            institution: {
                name: 'CalPERS',
                type: 'Public Pension Fund',
                headquarters: 'Sacramento, CA',
                aum: 480000000000,
                loan_portfolio_allocation: 28000000000
            },
            risk_appetite: {
                total_capital_available: 3000000000,
                current_deployed: 2100000000,
                available_capacity: 900000000,
                max_single_ticket: 400000000,
                min_ticket: 50000000,
                credit_rating_range: { min: 'A-', max: 'AAA', sweet_spot: 'A to AA' },
                target_all_in_yield: 5.5,
                min_acceptable_yield: 4.0
            },
            sector_preferences: {
                preferred: ['Infrastructure', 'Utilities', 'Healthcare', 'Government'],
                neutral: ['Industrial', 'Financial Services'],
                avoid: ['Cannabis', 'Weapons', 'Tobacco', 'Fossil Fuels']
            },
            strategy: {
                investment_style: 'conservative',
                hold_period_target: '10-20 years',
                portfolio_construction: 'diversified',
                bidding_behavior: 'methodical_selective',
                spread_sensitivity: 'moderate'
            },
            constraints: {
                esg_requirements: true,
                min_esg_score: 75,
                sector_concentration_limit: 0.15,
                single_borrower_limit: 0.03
            },
            decision_making: {
                speed: 'slow',
                autonomy_level: 'low',
                typical_response_time_hours: 48,
                requires_committee_approval_above: 100000000
            },
            performance_history: {
                bids_submitted_ytd: 67,
                allocations_won: 49,
                win_rate: 0.73,
                average_spread_paid: 285
            },
            status: 'active'
        },
        {
            _id: 'PA-003',
            tier: 'major',
            institution: {
                name: 'BNP Paribas',
                type: 'European Bank',
                headquarters: 'Paris, France',
                aum: 2800000000000,
                corporate_lending_book: 180000000000
            },
            risk_appetite: {
                total_capital_available: 4000000000,
                current_deployed: 2900000000,
                available_capacity: 1100000000,
                max_single_ticket: 500000000,
                min_ticket: 30000000,
                credit_rating_range: { min: 'BBB-', max: 'AAA', sweet_spot: 'BBB+ to A' },
                target_all_in_yield: 5.0,
                min_acceptable_yield: 3.8
            },
            sector_preferences: {
                preferred: ['Renewable Energy', 'Infrastructure', 'Industrial', 'TMT'],
                neutral: ['Healthcare', 'Consumer', 'Financial Services'],
                avoid: ['Coal', 'Weapons', 'Controversial']
            },
            strategy: {
                investment_style: 'moderate',
                hold_period_target: '5-10 years',
                portfolio_construction: 'diversified',
                bidding_behavior: 'relationship_price_conscious',
                spread_sensitivity: 'moderate'
            },
            constraints: {
                esg_requirements: true,
                min_esg_score: 70,
                esg_screening: 'comprehensive',
                sector_concentration_limit: 0.20,
                single_borrower_limit: 0.04,
                regulatory: 'ECB, Basel III'
            },
            decision_making: {
                speed: 'moderate',
                autonomy_level: 'moderate',
                typical_response_time_hours: 18,
                requires_committee_approval_above: 150000000
            },
            performance_history: {
                bids_submitted_ytd: 134,
                allocations_won: 98,
                win_rate: 0.73,
                average_spread_paid: 320
            },
            status: 'active'
        },
        {
            _id: 'PA-004',
            tier: 'major',
            institution: {
                name: 'MUFG Bank',
                type: 'Japanese Bank',
                headquarters: 'Tokyo, Japan',
                aum: 3200000000000,
                international_lending: 420000000000
            },
            risk_appetite: {
                total_capital_available: 5000000000,
                current_deployed: 3200000000,
                available_capacity: 1800000000,
                max_single_ticket: 600000000,
                min_ticket: 75000000,
                credit_rating_range: { min: 'BBB', max: 'AAA', sweet_spot: 'A- to AA' },
                target_all_in_yield: 4.5,
                min_acceptable_yield: 3.5
            },
            sector_preferences: {
                preferred: ['Infrastructure', 'Project Finance', 'Utilities', 'Shipping'],
                neutral: ['Industrial', 'TMT', 'Healthcare'],
                avoid: ['Speculative Tech', 'Crypto', 'Cannabis']
            },
            strategy: {
                investment_style: 'conservative',
                hold_period_target: '7-15 years',
                portfolio_construction: 'concentrated',
                bidding_behavior: 'patient_relationship_focused',
                spread_sensitivity: 'high'
            },
            constraints: {
                esg_requirements: true,
                min_esg_score: 65,
                sector_concentration_limit: 0.25,
                single_borrower_limit: 0.05,
                regulatory: 'FSA Japan, Basel III'
            },
            decision_making: {
                speed: 'very_slow',
                autonomy_level: 'low',
                typical_response_time_hours: 72,
                requires_committee_approval_above: 100000000
            },
            performance_history: {
                bids_submitted_ytd: 112,
                allocations_won: 96,
                win_rate: 0.86,
                average_spread_paid: 245
            },
            status: 'active'
        },
        {
            _id: 'PA-005',
            tier: 'major',
            institution: {
                name: 'Palmer Square Capital',
                type: 'CLO Manager',
                headquarters: 'Kansas City, MO',
                aum: 28000000000,
                clo_aum: 22000000000
            },
            risk_appetite: {
                total_capital_available: 1200000000,
                current_deployed: 900000000,
                available_capacity: 300000000,
                max_single_ticket: 75000000,
                min_ticket: 5000000,
                credit_rating_range: { min: 'B-', max: 'BBB-', sweet_spot: 'B+ to BB' },
                target_all_in_yield: 8.5,
                min_acceptable_yield: 7.0
            },
            sector_preferences: {
                preferred: ['Business Services', 'Healthcare', 'Technology', 'Industrial'],
                neutral: ['Consumer', 'Retail', 'Media'],
                avoid: ['Oil & Gas', 'Mining', 'Airlines']
            },
            strategy: {
                investment_style: 'moderate',
                hold_period_target: '3-5 years',
                portfolio_construction: 'highly_diversified',
                bidding_behavior: 'competitive_fast',
                spread_sensitivity: 'low'
            },
            constraints: {
                esg_requirements: false,
                sector_concentration_limit: 0.08,
                single_borrower_limit: 0.025,
                regulatory: 'SEC, Risk Retention'
            },
            decision_making: {
                speed: 'very_fast',
                autonomy_level: 'very_high',
                typical_response_time_hours: 1,
                requires_committee_approval_above: 50000000
            },
            performance_history: {
                bids_submitted_ytd: 892,
                allocations_won: 250,
                win_rate: 0.28,
                average_spread_paid: 445
            },
            status: 'warning',
            warning_reason: 'Payment Late'
        },

        // === MINOR PARTICIPANTS (PA-101 to PA-110 for demo) ===
        {
            _id: 'PA-101',
            tier: 'minor',
            institution: { name: 'PNC Bank', type: 'US Regional Bank', headquarters: 'Pittsburgh, PA', aum: 560000000000 },
            risk_appetite: { total_capital_available: 800000000, current_deployed: 580000000, available_capacity: 220000000, max_single_ticket: 100000000, min_ticket: 15000000, credit_rating_range: { min: 'BBB-', max: 'A+', sweet_spot: 'BBB to A-' }, target_all_in_yield: 5.8, min_acceptable_yield: 4.5 },
            strategy: { investment_style: 'moderate', bidding_behavior: 'relationship_price_conscious', spread_sensitivity: 'moderate' },
            decision_making: { speed: 'moderate', autonomy_level: 'moderate', typical_response_time_hours: 12 },
            performance_history: { bids_submitted_ytd: 89, allocations_won: 40, win_rate: 0.45, average_spread_paid: 365 },
            status: 'active'
        },
        {
            _id: 'PA-102',
            tier: 'minor',
            institution: { name: 'Ares Management', type: 'Private Credit Fund', headquarters: 'Los Angeles, CA', aum: 420000000000 },
            risk_appetite: { total_capital_available: 1100000000, current_deployed: 780000000, available_capacity: 320000000, max_single_ticket: 200000000, min_ticket: 20000000, credit_rating_range: { min: 'B', max: 'BB+', sweet_spot: 'B+ to BB' }, target_all_in_yield: 11.0, min_acceptable_yield: 9.0 },
            strategy: { investment_style: 'aggressive', bidding_behavior: 'fast_decisive', spread_sensitivity: 'low' },
            decision_making: { speed: 'fast', autonomy_level: 'high', typical_response_time_hours: 4 },
            performance_history: { bids_submitted_ytd: 198, allocations_won: 81, win_rate: 0.41, average_spread_paid: 475 },
            status: 'active'
        },
        {
            _id: 'PA-103',
            tier: 'minor',
            institution: { name: 'MetLife Investment Management', type: 'Insurance Company', headquarters: 'New York, NY', aum: 680000000000 },
            risk_appetite: { total_capital_available: 1500000000, current_deployed: 1200000000, available_capacity: 300000000, max_single_ticket: 250000000, min_ticket: 40000000, credit_rating_range: { min: 'A-', max: 'AAA', sweet_spot: 'A to AA' }, target_all_in_yield: 4.8, min_acceptable_yield: 3.8 },
            strategy: { investment_style: 'conservative', bidding_behavior: 'methodical_selective', spread_sensitivity: 'high' },
            constraints: { esg_requirements: true, min_esg_score: 72 },
            decision_making: { speed: 'slow', autonomy_level: 'moderate', typical_response_time_hours: 36 },
            performance_history: { bids_submitted_ytd: 156, allocations_won: 81, win_rate: 0.52, average_spread_paid: 295 },
            status: 'active'
        },
        {
            _id: 'PA-104',
            tier: 'minor',
            institution: { name: 'Golub Capital', type: 'Business Development Company (BDC)', headquarters: 'New York, NY', aum: 65000000000 },
            risk_appetite: { total_capital_available: 700000000, current_deployed: 520000000, available_capacity: 180000000, max_single_ticket: 80000000, min_ticket: 10000000, credit_rating_range: { min: 'B', max: 'BB+', sweet_spot: 'B+ to BB' }, target_all_in_yield: 10.0, min_acceptable_yield: 8.5 },
            strategy: { investment_style: 'moderate', bidding_behavior: 'competitive_fast', spread_sensitivity: 'low' },
            decision_making: { speed: 'fast', autonomy_level: 'high', typical_response_time_hours: 6 },
            performance_history: { bids_submitted_ytd: 245, allocations_won: 88, win_rate: 0.36, average_spread_paid: 435 },
            status: 'active'
        },
        {
            _id: 'PA-105',
            tier: 'minor',
            institution: { name: 'Davidson Kempner', type: 'Hedge Fund - Distressed', headquarters: 'New York, NY', aum: 38000000000 },
            risk_appetite: { total_capital_available: 600000000, current_deployed: 380000000, available_capacity: 220000000, max_single_ticket: 100000000, min_ticket: 15000000, credit_rating_range: { min: 'CCC', max: 'BB-', sweet_spot: 'CCC+ to B' }, target_all_in_yield: 16.0, min_acceptable_yield: 12.0 },
            strategy: { investment_style: 'very_aggressive', bidding_behavior: 'opportunistic', spread_sensitivity: 'very_low' },
            decision_making: { speed: 'very_fast', autonomy_level: 'very_high', typical_response_time_hours: 2 },
            performance_history: { bids_submitted_ytd: 42, allocations_won: 18, win_rate: 0.43, average_spread_paid: 680 },
            status: 'active'
        }
    ],

    // ========================================
    // NEGOTIATION AGENTS (One per syndication)
    // ========================================
    negotiation_agents: [
        {
            _id: 'NA-SYND-2025-001',
            agent_type: 'negotiation',
            syndication_id: 'SYND-2025-001',
            originator_agent_id: 'OA-001',
            originator: 'JPMorgan Chase',
            created_at: new Date('2025-01-15T09:00:00Z'),
            status: 'active',
            auction_config: {
                auction_type: 'dutch',
                starting_spread: 450,
                minimum_spread: 400,
                spread_decrement: 10,
                round_duration_minutes: 30,
                max_rounds: 5,
                target_subscription: 400000000,
                min_subscription_rate: 0.80,
                oversubscription_handling: 'pro_rata_allocation'
            },
            decision_rules: {
                auto_close_threshold: 1.0,
                early_close_threshold: 0.95,
                price_improvement_logic: 'market_clearing',
                tie_breaking: 'relationship_score_then_timestamp',
                partial_fills_allowed: true,
                minimum_bid_size: 20000000
            },
            negotiation_strategy: {
                urgency_level: 'medium',
                spread_flexibility: 'moderate',
                originator_mandate: 'maximize_subscription_minimize_spread',
                participant_priority: 'relationship'
            },
            performance_tracking: {
                bids_received: 5,
                unique_bidders: 5,
                current_round: 3,
                current_spread: 420,
                total_committed: 395000000,
                subscription_rate: 0.9875,
                last_updated: new Date('2025-01-17T14:30:00Z')
            },
            communication: {
                notification_channels: ['email', 'webhook', 'platform_alert'],
                bid_confirmation_required: true,
                live_auction_feed: true,
                anonymize_bids: false
            }
        },
        {
            _id: 'NA-SYND-2025-002',
            agent_type: 'negotiation',
            syndication_id: 'SYND-2025-002',
            originator_agent_id: 'OA-002',
            originator: 'Bank of America',
            created_at: new Date('2025-01-10T09:00:00Z'),
            status: 'completed',
            auction_config: {
                auction_type: 'dutch',
                starting_spread: 400,
                minimum_spread: 360,
                spread_decrement: 8,
                round_duration_minutes: 45,
                max_rounds: 5,
                target_subscription: 280000000,
                min_subscription_rate: 0.85,
                oversubscription_handling: 'pro_rata_allocation'
            },
            negotiation_strategy: {
                urgency_level: 'low',
                spread_flexibility: 'rigid',
                originator_mandate: 'maximize_subscription_minimize_spread'
            },
            performance_tracking: {
                bids_received: 8,
                unique_bidders: 6,
                current_round: 5,
                current_spread: 385,
                total_committed: 280000000,
                subscription_rate: 1.0,
                last_updated: new Date('2025-01-14T17:00:00Z')
            }
        }
    ],

    // ========================================
    // ALLOCATIONS (Detailed contract format)
    // ========================================
    allocations: [
        {
            _id: 'ALLOC-SYND-2025-001',
            syndication_id: 'SYND-2025-001',
            allocation_status: 'provisional',
            negotiation_agent_id: 'NA-SYND-2025-001',
            settlement_agent_id: 'SA-SYND-2025-001',
            syndication_summary: {
                originator: 'JPMorgan Chase',
                originator_agent_id: 'OA-001',
                borrower_name: 'TechFlow Solutions',
                total_loan_amount: 500000000,
                originator_hold: 100000000,
                syndication_target: 400000000,
                final_syndicated_amount: 375000000,
                final_subscription_rate: 0.9375,
                final_spread: 420,
                closed_at: new Date('2025-01-17T15:45:30Z'),
                funding_date: new Date('2025-01-22T12:00:00Z')
            },
            allocations: [
                {
                    _id: 'ALLOC-001',
                    participant_agent_id: 'PA-001',
                    institution_name: 'Apollo Global Management',
                    institution_type: 'Private Credit Fund',
                    original_bid_amount: 150000000,
                    original_spread_bid: 420,
                    final_allocation: 150000000,
                    allocation_percentage: 0.30,
                    final_spread: 420,
                    allocation_method: 'full_allocation',
                    commitment_status: 'confirmed',
                    commitment_letter_signed: true,
                    commitment_letter_signed_at: new Date('2025-01-17T18:22:15Z'),
                    fees: {
                        commitment_fee: 750000,
                        commitment_fee_percentage: 0.5,
                        commitment_fee_due_date: new Date('2025-01-18T17:00:00Z'),
                        arrangement_fee: 3000000,
                        arrangement_fee_percentage: 2.0,
                        arrangement_fee_due_date: new Date('2025-01-22T12:00:00Z'),
                        total_fees: 3750000
                    },
                    payment_details: {
                        x402_wallet_address: 'participant-PA-001-wallet',
                        escrow_wallet: 'escrow-SYND-2025-001-wallet',
                        principal_wire_instructions: { amount: 150000000, wire_date: new Date('2025-01-22T12:00:00Z') }
                    },
                    settlement_stage: 'payment_collection',
                    settlement_progress: { allocation_confirmed: true, commitment_letter_signed: true, fees_paid: true, legal_docs_signed: true, compliance_cleared: true, funded: false }
                },
                {
                    _id: 'ALLOC-002',
                    participant_agent_id: 'PA-003',
                    institution_name: 'BNP Paribas',
                    institution_type: 'European Bank',
                    original_bid_amount: 120000000,
                    original_spread_bid: 440,
                    final_allocation: 100000000,
                    allocation_percentage: 0.20,
                    final_spread: 420,
                    allocation_method: 'pro_rata',
                    pro_rata_haircut: 0.1667,
                    commitment_status: 'confirmed',
                    commitment_letter_signed: true,
                    fees: { commitment_fee: 500000, arrangement_fee: 2000000, total_fees: 2500000 },
                    settlement_stage: 'payment_collection',
                    settlement_progress: { allocation_confirmed: true, commitment_letter_signed: true, fees_paid: true, legal_docs_signed: false, compliance_cleared: false, funded: false }
                },
                {
                    _id: 'ALLOC-003',
                    participant_agent_id: 'PA-005',
                    institution_name: 'Palmer Square Capital',
                    institution_type: 'CLO Manager',
                    original_bid_amount: 75000000,
                    original_spread_bid: 410,
                    final_allocation: 75000000,
                    allocation_percentage: 0.15,
                    final_spread: 420,
                    allocation_method: 'full_allocation',
                    commitment_status: 'confirmed',
                    fees: { commitment_fee: 375000, arrangement_fee: 1500000, total_fees: 1875000 },
                    settlement_stage: 'payment_collection',
                    settlement_progress: { allocation_confirmed: true, commitment_letter_signed: true, fees_paid: false, legal_docs_signed: false, compliance_cleared: false, funded: false }
                },
                {
                    _id: 'ALLOC-004',
                    participant_agent_id: 'PA-101',
                    institution_name: 'PNC Bank',
                    institution_type: 'US Regional Bank',
                    original_bid_amount: 50000000,
                    original_spread_bid: 435,
                    final_allocation: 50000000,
                    allocation_percentage: 0.10,
                    final_spread: 420,
                    allocation_method: 'full_allocation',
                    commitment_status: 'confirmed',
                    fees: { commitment_fee: 250000, arrangement_fee: 1000000, total_fees: 1250000 },
                    settlement_stage: 'payment_collection',
                    settlement_progress: { allocation_confirmed: true, commitment_letter_signed: true, fees_paid: false, legal_docs_signed: false, compliance_cleared: false, funded: false }
                }
            ],
            auction_results: {
                total_rounds: 3,
                starting_spread: 450,
                final_spread: 420,
                spread_improvement: 30,
                total_bids_received: 5,
                winning_bids: 4,
                oversubscription_ratio: 0.9875,
                clearing_method: 'dutch_auction_market_clearing'
            },
            total_fees_summary: {
                total_commitment_fees: 1875000,
                total_arrangement_fees: 7500000,
                total_fees_to_originator: 9375000,
                fees_paid_to_date: 1875000,
                fees_outstanding: 7500000
            },
            created_at: new Date('2025-01-17T15:45:30Z'),
            last_updated: new Date('2025-01-18T16:00:00Z')
        }
    ]
};

module.exports = agentSeedData;
