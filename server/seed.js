// ========================================
// Database Seed Script
// Populates MongoDB with initial SyndiMatch data
// ========================================

require('dotenv').config();
const { MongoClient } = require('mongodb');

const seedData = {
    syndications: [
        { id: 'SYND-2025-001', borrower: 'TechFlow Solutions', industry: 'Software/SaaS', amount: 500, rating: 'BB+', originator: 'JPMorgan', spread: 420, subscription: 94, status: 'negotiating', timeRemaining: '32h 15m', round: 3, maxRounds: 5, createdAt: new Date() },
        { id: 'SYND-2025-002', borrower: 'Atlas Manufacturing', industry: 'Industrial', amount: 350, rating: 'BBB-', originator: 'BofA', spread: 385, subscription: 100, status: 'settlement', timeRemaining: '—', round: 5, maxRounds: 5, createdAt: new Date() },
        { id: 'SYND-2025-003', borrower: 'Meridian Healthcare', industry: 'Healthcare', amount: 275, rating: 'BB', originator: 'Citi', spread: 450, subscription: 45, status: 'open', timeRemaining: '6h 30m', round: 1, maxRounds: 4, createdAt: new Date() },
        { id: 'SYND-2025-004', borrower: 'Quantum Logistics', industry: 'Transportation', amount: 425, rating: 'BB+', originator: 'JPMorgan', spread: 410, subscription: 78, status: 'negotiating', timeRemaining: '18h 45m', round: 2, maxRounds: 6, createdAt: new Date() },
        { id: 'SYND-2025-005', borrower: 'Evergreen Energy', industry: 'Utilities', amount: 600, rating: 'BBB', originator: 'Wells Fargo', spread: 340, subscription: 62, status: 'open', timeRemaining: '48h 00m', round: 1, maxRounds: 5, createdAt: new Date() },
        { id: 'SYND-2025-006', borrower: 'Pinnacle Retail', industry: 'Consumer', amount: 200, rating: 'B+', originator: 'Goldman', spread: 525, subscription: 100, status: 'funding', timeRemaining: '—', round: 4, maxRounds: 4, createdAt: new Date() },
        { id: 'SYND-2025-007', borrower: 'Horizon Telecom', industry: 'Telecom', amount: 450, rating: 'BB-', originator: 'Citi', spread: 475, subscription: 100, status: 'completed', timeRemaining: '—', round: 5, maxRounds: 5, createdAt: new Date() },
        { id: 'SYND-2025-008', borrower: 'Summit Aerospace', industry: 'Aerospace', amount: 380, rating: 'BBB-', originator: 'BofA', spread: 365, subscription: 88, status: 'closing', timeRemaining: '4h 20m', round: 4, maxRounds: 4, createdAt: new Date() }
    ],

    participant_agents: [
        { id: 'PA-001', name: 'Apollo Global', type: 'Private Credit', bids: 247, winRate: 36, volume: 1800, onTime: 100, avgEarly: 2.5, status: 'active' },
        { id: 'PA-002', name: 'BNP Paribas', type: 'European Bank', bids: 134, winRate: 73, volume: 2900, onTime: 100, avgEarly: 1.8, status: 'active' },
        { id: 'PA-003', name: 'Palmer Square', type: 'CLO Manager', bids: 892, winRate: 28, volume: 1100, onTime: 33, late: 1, status: 'warning' },
        { id: 'PA-004', name: 'PNC Bank', type: 'Regional Bank', bids: 89, winRate: 45, volume: 650, onTime: 100, avgEarly: 3.2, status: 'active' },
        { id: 'PA-005', name: 'MetLife', type: 'Insurance', bids: 156, winRate: 52, volume: 1200, onTime: 95, avgEarly: 0.5, status: 'active' },
        { id: 'PA-006', name: 'MUFG Bank', type: 'Japanese Bank', bids: 112, winRate: 86, volume: 3200, onTime: 100, avgEarly: 4.1, status: 'active' },
        { id: 'PA-007', name: 'CalPERS', type: 'Pension Fund', bids: 67, winRate: 73, volume: 2100, onTime: 100, avgEarly: 2.8, status: 'active' },
        { id: 'PA-008', name: 'Ares Management', type: 'Private Credit', bids: 198, winRate: 41, volume: 1500, onTime: 98, avgEarly: 1.2, status: 'active' }
    ],

    bids: [
        {
            _id: 'BID-2025-001-0001',
            syndication_id: 'SYND-2025-001',
            bid_status: 'active',
            participant_agent_id: 'PA-002',
            institution_name: 'Apollo Global Management',
            institution_type: 'Private Credit Fund',
            bid_amount: 150000000,
            spread_bid: 420,
            all_in_yield: 9.20,
            min_allocation: 100000000,
            max_allocation: 150000000,
            partial_fill_acceptable: true,
            pro_rata_acceptance: true,
            submitted_at: new Date('2025-01-15T10:23:15Z'),
            valid_until: new Date('2025-01-17T17:00:00Z'),
            last_modified: new Date('2025-01-15T10:23:15Z'),
            auction_round: 1,
            is_competitive: true,
            special_conditions: ['Standard syndicate protections'],
            relationship_score: 85,
            commitment_level: 'firm',
            portfolio_fit_score: 0.92,
            risk_adjusted_return: 11.5,
            modification_history: [{ modified_at: new Date('2025-01-15T10:23:15Z'), previous_amount: null, previous_spread: null, new_amount: 150000000, new_spread: 420, reason: 'initial_bid' }]
        },
        {
            _id: 'BID-2025-001-0002',
            syndication_id: 'SYND-2025-001',
            bid_status: 'active',
            participant_agent_id: 'PA-003',
            institution_name: 'BNP Paribas',
            institution_type: 'European Bank',
            bid_amount: 120000000,
            spread_bid: 440,
            all_in_yield: 9.40,
            min_allocation: 80000000,
            max_allocation: 120000000,
            partial_fill_acceptable: true,
            pro_rata_acceptance: true,
            submitted_at: new Date('2025-01-15T10:25:33Z'),
            valid_until: new Date('2025-01-17T17:00:00Z'),
            last_modified: new Date('2025-01-15T10:25:33Z'),
            auction_round: 1,
            is_competitive: true,
            relationship_score: 78,
            commitment_level: 'firm',
            portfolio_fit_score: 0.85,
            risk_adjusted_return: 10.2,
            modification_history: [{ modified_at: new Date('2025-01-15T10:25:33Z'), previous_amount: null, previous_spread: null, new_amount: 120000000, new_spread: 440, reason: 'initial_bid' }]
        },
        {
            _id: 'BID-2025-001-0003',
            syndication_id: 'SYND-2025-001',
            bid_status: 'withdrawn',
            participant_agent_id: 'PA-005',
            institution_name: 'MetLife Insurance',
            institution_type: 'Insurance Company',
            bid_amount: 0,
            spread_bid: null,
            all_in_yield: null,
            submitted_at: new Date('2025-01-15T10:05:18Z'),
            last_modified: new Date('2025-01-15T10:06:45Z'),
            auction_round: 1,
            is_competitive: false,
            relationship_score: 82,
            commitment_level: 'passed',
            internal_notes: 'Credit rating BB+ below our BBB+ minimum threshold',
            portfolio_fit_score: 0.0,
            withdrawal_reason: 'credit_rating_below_threshold',
            modification_history: [{ modified_at: new Date('2025-01-15T10:05:18Z'), action: 'evaluated', decision: 'pass' }, { modified_at: new Date('2025-01-15T10:06:45Z'), action: 'withdrawn', reason: 'credit_rating_below_threshold' }]
        },
        {
            _id: 'BID-2025-001-0004',
            syndication_id: 'SYND-2025-001',
            bid_status: 'active',
            participant_agent_id: 'PA-004',
            institution_name: 'Palmer Square CLO',
            institution_type: 'CLO Manager',
            bid_amount: 75000000,
            spread_bid: 410,
            all_in_yield: 9.10,
            min_allocation: 25000000,
            max_allocation: 75000000,
            partial_fill_acceptable: true,
            pro_rata_acceptance: true,
            submitted_at: new Date('2025-01-15T10:15:33Z'),
            valid_until: new Date('2025-01-17T17:00:00Z'),
            last_modified: new Date('2025-01-15T13:30:22Z'),
            auction_round: 2,
            is_competitive: true,
            relationship_score: 72,
            commitment_level: 'firm',
            portfolio_fit_score: 0.88,
            risk_adjusted_return: 10.8,
            modification_history: [
                { modified_at: new Date('2025-01-15T10:15:33Z'), previous_amount: null, previous_spread: null, new_amount: 50000000, new_spread: 425, reason: 'initial_bid', auction_round: 1 },
                { modified_at: new Date('2025-01-15T13:30:22Z'), previous_amount: 50000000, previous_spread: 425, new_amount: 75000000, new_spread: 410, reason: 'spread_improved_in_round_2', auction_round: 2 }
            ]
        },
        {
            _id: 'BID-2025-001-0005',
            syndication_id: 'SYND-2025-001',
            bid_status: 'active',
            participant_agent_id: 'PA-015',
            institution_name: 'PNC Bank',
            institution_type: 'US Regional Bank',
            bid_amount: 50000000,
            spread_bid: 435,
            all_in_yield: 9.35,
            min_allocation: 40000000,
            max_allocation: 75000000,
            partial_fill_acceptable: true,
            pro_rata_acceptance: true,
            submitted_at: new Date('2025-01-15T11:45:22Z'),
            valid_until: new Date('2025-01-17T17:00:00Z'),
            last_modified: new Date('2025-01-15T11:45:22Z'),
            auction_round: 1,
            is_competitive: true,
            relationship_score: 78,
            commitment_level: 'firm',
            portfolio_fit_score: 0.85,
            risk_adjusted_return: 10.2,
            modification_history: [{ modified_at: new Date('2025-01-15T11:45:22Z'), previous_amount: null, previous_spread: null, new_amount: 50000000, new_spread: 435, reason: 'initial_bid' }]
        }
    ],

    originator_agents: [
        { id: 'OA-001', entity: 'JPMorgan', status: 'active', loans: 2, success: 94 },
        { id: 'OA-002', entity: 'BofA', status: 'active', loans: 1, success: 96 },
        { id: 'OA-003', entity: 'Citi', status: 'active', loans: 2, success: 91 }
    ],

    negotiation_agents: [
        { id: 'NA-001', syndId: 'SYND-2025-001', status: 'running', round: '3/5', subscription: 94 },
        { id: 'NA-002', syndId: 'SYND-2025-004', status: 'running', round: '2/6', subscription: 68 }
    ],

    settlement_agents: [
        { id: 'SA-001', syndId: 'SYND-2025-002', status: 'processing', stage: '3/5', docs: 75 },
        { id: 'SA-002', syndId: 'SYND-2025-003', status: 'processing', stage: '2/5', note: 'Compliance pending' }
    ],

    payment_agents: [
        {
            _id: 'PAY-SYND-2025-001',
            agent_type: 'payment',
            syndication_id: 'SYND-2025-001',
            settlement_agent_id: 'SA-SYND-2025-001',
            originator_agent_id: 'OA-001',
            originator: 'JPMorgan Chase',
            created_at: new Date('2025-01-17T15:45:30Z'),
            status: 'active',
            payment_config: {
                payment_provider: 'coinbase_x402',
                base_currency: 'USD',
                escrow_enabled: true,
                escrow_wallet: 'escrow-SYND-2025-001-wallet',
                originator_wallet: 'originator-OA-001-wallet',
                auto_processing: true,
                require_manual_approval_above: 50000000
            },
            payment_schedule: [
                { payment_type: 'commitment_fee', due_date: new Date('2025-01-18T17:00:00Z'), total_amount_due: 1875000, currency: 'USD', recipient: 'originator-OA-001-wallet', participants_count: 4, status: 'completed' },
                { payment_type: 'arrangement_fee', due_date: new Date('2025-01-22T12:00:00Z'), total_amount_due: 7500000, currency: 'USD', recipient: 'originator-OA-001-wallet', participants_count: 4, status: 'partial' },
                { payment_type: 'principal', due_date: new Date('2025-01-22T12:00:00Z'), total_amount_due: 375000000, currency: 'USD', recipient: 'escrow-SYND-2025-001-wallet', participants_count: 4, status: 'partial' },
                { payment_type: 'borrower_disbursement', due_date: new Date('2025-01-22T14:00:00Z'), total_amount_due: 500000000, currency: 'USD', recipient: 'borrower-techflow-wallet', status: 'pending' }
            ],
            decision_rules: {
                partial_payment_handling: 'accept_and_track',
                late_payment_penalty: { enabled: true, rate_bps: 50, grace_period_hours: 4 },
                default_handling: { auto_notify_originator: true, reallocation_trigger: true, break_fee_collection: true, break_fee_percentage: 2.0 },
                currency_conversion: { enabled: true, rate_provider: 'coinbase_spot', slippage_tolerance: 0.002 }
            },
            performance_tracking: { total_expected: 384375000, total_collected: 256625000, collection_rate: 0.67, payments_on_time: 5, payments_late: 1, payments_defaulted: 0, average_delay_hours: 0.8 }
        },
        {
            _id: 'PAY-SYND-2025-007',
            agent_type: 'payment',
            syndication_id: 'SYND-2025-007',
            settlement_agent_id: 'SA-SYND-2025-007',
            originator_agent_id: 'OA-003',
            originator: 'Citi',
            created_at: new Date('2025-01-10T09:30:00Z'),
            status: 'completed',
            payment_config: {
                payment_provider: 'coinbase_x402',
                base_currency: 'USD',
                escrow_enabled: true,
                escrow_wallet: 'escrow-SYND-2025-007-wallet',
                originator_wallet: 'originator-OA-003-wallet',
                auto_processing: true,
                require_manual_approval_above: 50000000
            },
            payment_schedule: [
                { payment_type: 'commitment_fee', due_date: new Date('2025-01-11T17:00:00Z'), total_amount_due: 2250000, currency: 'USD', recipient: 'originator-OA-003-wallet', participants_count: 5, status: 'completed' },
                { payment_type: 'arrangement_fee', due_date: new Date('2025-01-15T12:00:00Z'), total_amount_due: 9000000, currency: 'USD', recipient: 'originator-OA-003-wallet', participants_count: 5, status: 'completed' },
                { payment_type: 'principal', due_date: new Date('2025-01-15T12:00:00Z'), total_amount_due: 450000000, currency: 'USD', recipient: 'escrow-SYND-2025-007-wallet', participants_count: 5, status: 'completed' },
                { payment_type: 'borrower_disbursement', due_date: new Date('2025-01-15T14:00:00Z'), total_amount_due: 450000000, currency: 'USD', recipient: 'borrower-horizon-wallet', status: 'completed' }
            ],
            decision_rules: {
                partial_payment_handling: 'accept_and_track',
                late_payment_penalty: { enabled: true, rate_bps: 50, grace_period_hours: 4 },
                default_handling: { auto_notify_originator: true, reallocation_trigger: true, break_fee_collection: true, break_fee_percentage: 2.0 },
                currency_conversion: { enabled: true, rate_provider: 'coinbase_spot', slippage_tolerance: 0.002 }
            },
            performance_tracking: { total_expected: 461250000, total_collected: 461250000, collection_rate: 1.0, payments_on_time: 8, payments_late: 0, payments_defaulted: 0, average_delay_hours: 0 }
        }
    ],

    payment_history: [
        {
            _id: 'PAYHIST-2025-001-0001',
            payment_agent_id: 'PAY-SYND-2025-001',
            syndication_id: 'SYND-2025-001',
            allocation_id: 'ALLOC-001',
            payer: { participant_agent_id: 'PA-002', institution_name: 'Apollo Global Management', wallet_address: 'participant-PA-002-wallet' },
            recipient: { type: 'originator', agent_id: 'OA-001', institution_name: 'JPMorgan Chase', wallet_address: 'originator-OA-001-wallet' },
            payment_type: 'commitment_fee',
            amount_due: 750000,
            amount_paid: 750000,
            currency: 'USD',
            due_date: new Date('2025-01-18T17:00:00Z'),
            payment_status: 'completed',
            initiated_at: new Date('2025-01-18T14:23:15Z'),
            completed_at: new Date('2025-01-18T14:23:47Z'),
            payment_delay_hours: 0,
            is_on_time: true,
            transaction: { x402_transaction_id: 'x402-tx-abc123def456', blockchain: 'base', transaction_hash: '0x1234567890abcdef...', confirmation_blocks: 12, gas_paid: 0.00023, gas_currency: 'ETH', exchange_rate: 1.0, amount_sent: 750000, amount_received: 750000, transaction_fee: 5.50 },
            approval: { required: false, approved_by: null, approved_at: null },
            penalties: { late_fee: 0, other_adjustments: 0, total_penalty: 0 },
            reconciliation: { reconciled: true, reconciled_at: new Date('2025-01-18T14:24:00Z'), reconciled_by: 'PAY-SYND-2025-001', discrepancies: [] },
            notifications_sent: [
                { type: 'payment_initiated', sent_to: ['PA-002', 'OA-001'], sent_at: new Date('2025-01-18T14:23:15Z') },
                { type: 'payment_confirmed', sent_to: ['PA-002', 'OA-001'], sent_at: new Date('2025-01-18T14:23:47Z') }
            ],
            created_at: new Date('2025-01-18T14:23:15Z'),
            updated_at: new Date('2025-01-18T14:24:00Z')
        },
        {
            _id: 'PAYHIST-2025-001-0002',
            payment_agent_id: 'PAY-SYND-2025-001',
            syndication_id: 'SYND-2025-001',
            allocation_id: 'ALLOC-002',
            payer: { participant_agent_id: 'PA-003', institution_name: 'BNP Paribas', wallet_address: 'participant-PA-003-wallet' },
            recipient: { type: 'originator', agent_id: 'OA-001', institution_name: 'JPMorgan Chase', wallet_address: 'originator-OA-001-wallet' },
            payment_type: 'commitment_fee',
            amount_due: 500000,
            amount_paid: 500000,
            currency: 'USD',
            due_date: new Date('2025-01-18T17:00:00Z'),
            payment_status: 'completed',
            initiated_at: new Date('2025-01-18T14:25:00Z'),
            completed_at: new Date('2025-01-18T14:25:18Z'),
            payment_delay_hours: 0,
            is_on_time: true,
            transaction: { x402_transaction_id: 'x402-tx-def789ghi012', blockchain: 'base', transaction_hash: '0x5678abcdef123456...', confirmation_blocks: 12, gas_paid: 0.00021, gas_currency: 'ETH', exchange_rate: 1.0, amount_sent: 500000, amount_received: 500000, transaction_fee: 4.80 },
            approval: { required: false, approved_by: null, approved_at: null },
            penalties: { late_fee: 0, other_adjustments: 0, total_penalty: 0 },
            reconciliation: { reconciled: true, reconciled_at: new Date('2025-01-18T14:25:30Z'), reconciled_by: 'PAY-SYND-2025-001', discrepancies: [] },
            notifications_sent: [
                { type: 'payment_initiated', sent_to: ['PA-003', 'OA-001'], sent_at: new Date('2025-01-18T14:25:00Z') },
                { type: 'payment_confirmed', sent_to: ['PA-003', 'OA-001'], sent_at: new Date('2025-01-18T14:25:18Z') }
            ],
            created_at: new Date('2025-01-18T14:25:00Z'),
            updated_at: new Date('2025-01-18T14:25:30Z')
        },
        {
            _id: 'PAYHIST-2025-001-0003',
            payment_agent_id: 'PAY-SYND-2025-001',
            syndication_id: 'SYND-2025-001',
            allocation_id: 'ALLOC-003',
            payer: { participant_agent_id: 'PA-004', institution_name: 'Palmer Square', wallet_address: 'participant-PA-004-wallet' },
            recipient: { type: 'originator', agent_id: 'OA-001', institution_name: 'JPMorgan Chase', wallet_address: 'originator-OA-001-wallet' },
            payment_type: 'arrangement_fee',
            amount_due: 1500000,
            amount_paid: 0,
            currency: 'USD',
            due_date: new Date('2025-01-22T12:00:00Z'),
            payment_status: 'late',
            initiated_at: null,
            completed_at: null,
            payment_delay_hours: 3.5,
            is_on_time: false,
            transaction: null,
            approval: { required: false, approved_by: null, approved_at: null },
            penalties: { late_fee: 145.83, other_adjustments: 0, total_penalty: 145.83 },
            reconciliation: { reconciled: false, reconciled_at: null, reconciled_by: null, discrepancies: ['Payment not received'] },
            notifications_sent: [
                { type: 'payment_reminder', sent_to: ['PA-004'], sent_at: new Date('2025-01-22T11:00:00Z') },
                { type: 'payment_overdue', sent_to: ['PA-004', 'OA-001'], sent_at: new Date('2025-01-22T16:30:00Z') }
            ],
            created_at: new Date('2025-01-22T12:00:00Z'),
            updated_at: new Date('2025-01-22T15:30:00Z')
        }
    ],

    allocations: [
        {
            syndId: 'SYND-2025-007', allocations: [
                { participant: 'Originator Hold', amount: 90, percentage: 20, color: '#1E40AF' },
                { participant: 'Apollo Global', amount: 135, percentage: 30, color: '#10B981' },
                { participant: 'BNP Paribas', amount: 90, percentage: 20, color: '#F59E0B' },
                { participant: 'Palmer Square', amount: 67.5, percentage: 15, color: '#EC4899' },
                { participant: 'PNC Bank', amount: 45, percentage: 10, color: '#8B5CF6' },
                { participant: 'Unfilled', amount: 22.5, percentage: 5, color: '#6B7280' }
            ]
        }
    ]
};

async function seed() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI not set in .env file');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas');

        const db = client.db('syndimatch');

        // Clear and seed each collection
        for (const [collection, data] of Object.entries(seedData)) {
            await db.collection(collection).deleteMany({});
            if (data.length > 0) {
                await db.collection(collection).insertMany(data);
                console.log(`📦 Seeded ${data.length} documents in ${collection}`);
            }
        }

        console.log('\n🎉 Database seeded successfully!');

    } catch (error) {
        console.error('❌ Seed error:', error);
    } finally {
        await client.close();
    }
}

seed();
