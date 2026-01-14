// ========================================
// SyndiMatch - Express Server
// ========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { connectDB, getDB, pingDB } = require('./db');

// Python Agents Service URL (Cloud Run or local)
const AGENTS_SERVICE_URL = process.env.AGENTS_SERVICE_URL || 'http://localhost:8000';

// Helper to call Python agents service
async function callAgentsService(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${AGENTS_SERVICE_URL}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`Agents service returned ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`❌ Agents service call failed (${endpoint}):`, error);
        throw error;
    }
}

const app = express();
// Cloud Run sets PORT automatically, default to 3001 for local dev
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ready', async (req, res) => {
    try {
        await pingDB();
        res.json({ status: 'ready' });
    } catch (error) {
        res.status(503).json({ status: 'not_ready', error: 'Database not reachable' });
    }
});

// Syndications
app.get('/api/syndications', async (req, res) => {
    try {
        const db = getDB();
        // Point to the richer syndication_original collection for the listing
        const syndications = await db.collection('syndication_original').find({}).sort({ createdAt: -1 }).toArray();
        res.json(syndications);
    } catch (error) {
        console.error('❌ Failed to fetch syndications:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch syndications' });
    }
});

app.get('/api/syndications/:id', async (req, res) => {
    try {
        const db = getDB();
        const syndication = await db.collection('syndication_original').findOne({ _id: req.params.id });
        if (!syndication) {
            return res.status(404).json({ error: 'Not Found', message: 'Syndication not found' });
        }
        res.json(syndication);
    } catch (error) {
        console.error(`❌ Failed to fetch syndication ${req.params.id}:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Create a new syndication (used by originator form/demo)
app.post('/api/syndications', async (req, res) => {
    try {
        const db = getDB();
        const body = req.body || {};

        // Basic role guard: only originators allowed
        if (body.role && !String(body.role).startsWith('originator:')) {
            return res.status(403).json({ error: 'Forbidden', message: 'Only originators can create syndications' });
        }

        const id = body.id || body.syndication_id || `SYND-${Date.now()}`;
        const now = new Date();

        if (!body.originator_agent_id) {
            return res.status(400).json({ error: 'Bad Request', message: 'originator_agent_id is required' });
        }

        const doc = {
            _id: id,
            syndication_id: id,
            borrower: body.borrower || 'Unknown Borrower',
            industry: body.industry || 'Unknown',
            originator: body.originator || 'Unknown',
            originator_agent_id: body.originator_agent_id,
            amount: Number(body.amount) || 0,
            rating: body.rating || 'NR',
            spread: Number(body.spread) || 400,
            status: body.status || 'open',
            phase: body.phase || 'open',
            round: body.round || 1,
            subscription: body.subscription || 0,
            createdAt: now,
            updatedAt: now,
            loan_details: body.loan_details || {
                borrower_name: body.borrower || 'Unknown Borrower',
                industry: body.industry || 'Unknown',
                credit_rating: body.rating || 'NR',
                total_amount: (Number(body.amount) || 0) * 1_000_000,
                syndication_target: (Number(body.amount) || 0) * 1_000_000,
                loan_type: body.loan_type || 'Term Loan B'
            },
            pricing: body.pricing || { base_rate: 'SOFR', initial_spread: Number(body.spread) || 400 },
            timeline: body.timeline || {
                broadcast_date: now.toISOString(),
                target_close_date: new Date(now.getTime() + 48 * 3600 * 1000).toISOString()
            }
        };

        await db.collection('syndication_original').insertOne(doc);
        res.status(201).json(doc);
    } catch (error) {
        console.error('❌ Failed to create syndication:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create syndication' });
    }
});

// Bids
app.get('/api/bids', async (req, res) => {
    try {
        const db = getDB();
        const { syndId } = req.query;
        const filter = syndId ? { syndId } : {};
        const bids = await db.collection('bids').find(filter).sort({ time: -1 }).toArray();
        res.json(bids);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Participants
app.get('/api/participants', async (req, res) => {
    try {
        const db = getDB();
        // Use 'participants' collection which contains richer data (25 records)
        const participants = await db.collection('participants').find({}).toArray();
        res.json(participants);
    } catch (error) {
        console.error('❌ Failed to fetch participants:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch participants' });
    }
});

// Payments
app.get('/api/payments', async (req, res) => {
    try {
        const db = getDB();
        const payments = await db.collection('payment_history').find({}).sort({ time: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.get('/api/payments/summary/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const summary = await db.collection('payment_summaries').findOne({ syndId: req.params.syndId });
        res.json(summary || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch payment summary' });
    }
});

// Agents Overview
app.get('/api/agents', async (req, res) => {
    try {
        const db = getDB();
        const [originator, participant, negotiation, settlement, payment] = await Promise.all([
            // Point to canonical richer collections
            db.collection('originator').find({}).toArray(),
            db.collection('participants').find({}).toArray(),
            db.collection('negotiation_agents').find({}).toArray(),
            db.collection('settlement_agents').find({}).toArray(),
            db.collection('payment_agents').find({}).toArray()
        ]);
        res.json({ originator, participant, negotiation, settlement, payment });
    } catch (error) {
        console.error('❌ Failed to fetch agents summary:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch agents data' });
    }
});

// Allocations
app.get('/api/allocations/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const allocation = await db.collection('allocations').findOne({ syndId: req.params.syndId });
        res.json(allocation || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch allocation' });
    }
});

// Portfolio Analytics
app.get('/api/participants/:participantId/portfolio', async (req, res) => {
    try {
        const db = getDB();
        const { participantId } = req.params;

        // Get all bids for this participant
        const bids = await db.collection('bids')
            .find({
                participant_agent_id: participantId,
                bid_status: 'active'
            })
            .toArray();

        // Get syndications for these bids
        const syndIds = [...new Set(bids.map(b => b.syndication_id))];
        const syndications = await db.collection('syndications')
            .find({ id: { $in: syndIds } })
            .toArray();

        // Calculate portfolio metrics
        let totalExposure = 0;
        let totalSpreadWeighted = 0;
        const holdings = [];
        const sectorMap = {};
        const ratingMap = {};
        const geoMap = {};
        let esgTotal = 0;
        let esgCount = 0;

        for (const bid of bids) {
            const synd = syndications.find(s => s.id === bid.syndication_id);
            if (!synd) continue;

            const amount = bid.bid_amount / 1000000; // Convert to millions
            totalExposure += amount;
            totalSpreadWeighted += amount * bid.spread_bid;

            // Generate ESG score (simulated - would come from real data)
            const esgScore = 50 + Math.floor(Math.random() * 40); // 50-90 range
            esgTotal += esgScore;
            esgCount++;

            // Determine geography based on industry
            const geography = synd.industry?.includes('Tech') ? 'North America' :
                synd.industry?.includes('Energy') ? 'North America' :
                    synd.industry?.includes('Healthcare') ? 'Europe' : 'North America';

            holdings.push({
                _id: bid._id,
                id: synd.id,
                borrower: synd.borrower,
                borrower_name: synd.borrower,
                industry: synd.industry,
                rating: synd.rating,
                credit_rating: synd.rating,
                esg: esgScore,
                esg_score: esgScore,
                amount: amount,
                final_allocation: bid.bid_amount,
                spread: bid.spread_bid,
                final_spread: bid.spread_bid,
                tenor: '5Y',
                geography: geography
            });

            // Aggregate by sector
            sectorMap[synd.industry] = (sectorMap[synd.industry] || 0) + amount;

            // Aggregate by rating
            ratingMap[synd.rating] = (ratingMap[synd.rating] || 0) + amount;

            // Aggregate by geography
            geoMap[geography] = (geoMap[geography] || 0) + amount;
        }

        // Calculate percentages
        const sectors = Object.entries(sectorMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));

        const ratings = Object.entries(ratingMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));

        const geography = Object.entries(geoMap).map(([name, amt]) => ({
            name,
            pct: Math.round((amt / totalExposure) * 100)
        }));

        // ESG distribution
        const avgEsg = esgCount > 0 ? Math.round(esgTotal / esgCount) : 70;
        const esgHigh = holdings.filter(h => h.esg >= 75).length;
        const esgMed = holdings.filter(h => h.esg >= 50 && h.esg < 75).length;
        const esgLow = holdings.filter(h => h.esg < 50).length;
        const totalHoldings = holdings.length;

        const portfolio = {
            total_exposure: totalExposure * 1000000,
            available_capacity: 500000000, // Mock capacity
            utilization: Math.round((totalExposure * 1000000 / 500000000) * 100),
            deal_count: holdings.length,
            weighted_yield: 8.5,
            weighted_spread: totalExposure > 0 ? totalSpreadWeighted / totalExposure : 400,
            roi_ytd: 10.0 + Math.random() * 5,
            interest_ytd: totalExposure * 1000000 * 0.085 * 0.5, // 6 months interest
            avg_esg: avgEsg,
            esg_high_pct: totalHoldings > 0 ? Math.round((esgHigh / totalHoldings) * 100) : 0,
            esg_med_pct: totalHoldings > 0 ? Math.round((esgMed / totalHoldings) * 100) : 0,
            esg_low_pct: totalHoldings > 0 ? Math.round((esgLow / totalHoldings) * 100) : 0,
            geography,
            sectors,
            ratings,
            holdings
        };

        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch portfolio' });
    }
});

// ========================================
// Python Agents Integration Endpoints
// ========================================

// Run a new syndication (calls Python agents)
app.post('/api/syndications/run', async (req, res) => {
    try {
        const { originator_id = 'OA-001', syndication_id, loan_params } = req.body;
        const result = await callAgentsService('/api/syndication/run', 'POST', {
            originator_id,
            syndication_id,
            loan_params
        });
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to run syndication:', error);
        res.status(500).json({ error: 'Failed to run syndication', message: error.message });
    }
});

// Proxy: Agent data and actions
app.get('/api/agents/participants', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/participants');
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

app.get('/api/agents/originators', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/originators');
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

app.post('/api/agents/bid', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/bid', 'POST', req.body);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

app.post('/api/agents/allocate', async (req, res) => {
    try {
        const result = await callAgentsService('/api/agents/allocate', 'POST', req.body);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

// Proxy: x402 read-only lookups
app.get('/api/x402/balance/:wallet', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/x402/balance/${req.params.wallet}`);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

app.get('/api/x402/escrow/:syndId', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/x402/escrow/${req.params.syndId}`);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

app.post('/api/orchestrator/reset', async (req, res) => {
    try {
        const result = await callAgentsService('/api/orchestrator/reset', 'POST', {});
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

// Resume a syndication
app.post('/api/syndications/resume', async (req, res) => {
    try {
        const { syndication_id } = req.body;
        const result = await callAgentsService('/api/syndication/resume', 'POST', {
            syndication_id
        });
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to resume syndication:', error);
        res.status(500).json({ error: 'Failed to resume syndication', message: error.message });
    }
});

// Get syndication status from agents
app.get('/api/syndications/:id/status', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/syndication/${req.params.id}`);
        res.json(result);
    } catch (error) {
        console.error('❌ Failed to get syndication status:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

// Health check for agents service
app.get('/api/agents/health', async (req, res) => {
    try {
        const result = await callAgentsService('/api/health');
        res.json({ ...result, agents_service_url: AGENTS_SERVICE_URL });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy', 
            agents_service_url: AGENTS_SERVICE_URL,
            error: 'Agents service unavailable' 
        });
    }
});

// Syndication Events (Orchestrator Logs)
// Get all recent syndication events (for "All" view in dashboard)
app.get('/api/syndication-events', async (req, res) => {
    try {
        const db = getDB();
        const { limit = 100, type } = req.query;
        const filter = type ? { event_type: { $regex: type, $options: 'i' } } : {};
        const events = await db.collection('syndication_events')
            .find(filter)
            .sort({ timestamp: -1 }) // Most recent first
            .limit(parseInt(limit))
            .toArray();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch syndication events' });
    }
});

// Get syndication events for a specific syndication
app.get('/api/syndication-events/:syndId', async (req, res) => {
    try {
        const db = getDB();
        const events = await db.collection('syndication_events')
            .find({ syndication_id: req.params.syndId })
            .sort({ timestamp: 1 }) // Chronological order
            .toArray();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch syndication events' });
    }
});

// ========================================
// x402 Mock Payment Endpoints
// Simulates Coinbase x402 Payment-Required flow
// ========================================

// Generate x402 payment header
function generateX402PaymentHeader(paymentDetails) {
    const paymentId = `x402-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    return {
        paymentId,
        payTo: 'platform-syndimatch-wallet',
        network: 'base',
        currency: 'USDC',
        amount: paymentDetails.amount,
        validUntil: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        memo: paymentDetails.memo || 'SyndiMatch fee payment'
    };
}

// Log payment events
async function logPaymentEvent(type, data) {
    try {
        const db = getDB();
        await db.collection('payment_events').insertOne({
            type,
            data,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('❌ Failed to log payment event:', error);
    }
}

// Track participant payment and summary
async function recordCompletedPayment(payment) {
    try {
        const db = getDB();

        const historyDoc = {
            _id: payment.paymentId,
            syndication_id: payment.syndId,
            payment_type: payment.type || 'commitment_fee',
            payer: {
                participant_agent_id: payment.participantId,
                wallet_address: payment.paidFrom || 'mock-participant-wallet'
            },
            amount_due: payment.amount,
            amount_paid: payment.amount,
            currency: payment.currency || 'USDC',
            payment_status: 'completed',
            paid_at: payment.paidAt || new Date(),
            tx_hash: payment.txHash,
            gas_used: payment.gasUsed,
            created_at: payment.createdAt || new Date()
        };

        await db.collection('payment_history').updateOne(
            { _id: historyDoc._id },
            { $set: historyDoc },
            { upsert: true }
        );

        // Update summary
        await db.collection('payment_summaries').updateOne(
            { syndId: payment.syndId },
            {
                $inc: { totalPaid: payment.amount },
                $setOnInsert: { totalDue: 0 }
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Failed to record completed payment:', error);
    }
}

// Protected resource - triggers HTTP 402
app.post('/api/x402/join-syndication', async (req, res) => {
    const { syndId, participantId, commitmentAmount } = req.body;

    if (!syndId || typeof syndId !== 'string') {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid or missing syndication ID' });
    }
    if (!participantId || typeof participantId !== 'string') {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid or missing participant ID' });
    }
    if (!commitmentAmount || typeof commitmentAmount !== 'number') {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid or missing commitment amount' });
    }

    // Calculate 0.5% commitment fee
    const feeAmount = Math.round(commitmentAmount * 0.005);

    // Create payment details
    const paymentDetails = {
        type: 'commitment_fee',
        syndId,
        participantId,
        commitmentAmount,
        amount: feeAmount,
        amountFormatted: `$${(feeAmount).toLocaleString()} USDC`,
        feePercentage: '0.5%',
        memo: `Commitment fee for ${syndId}`
    };

    const paymentHeader = generateX402PaymentHeader(paymentDetails);

    try {
        const db = getDB();
        const pendingPayment = {
            ...paymentDetails,
            ...paymentHeader,
            status: 'pending',
            createdAt: new Date()
        };

        await db.collection('pending_payments').insertOne(pendingPayment);
        await logPaymentEvent('join_syndication_request', { syndId, participantId, paymentId: paymentHeader.paymentId });

        // Return HTTP 402 Payment Required
        res.status(402)
            .set('X-Payment-Required', 'true')
            .set('X-Payment-Id', paymentHeader.paymentId)
            .set('X-Pay-To', paymentHeader.payTo)
            .set('X-Amount', paymentHeader.amount)
            .set('X-Currency', paymentHeader.currency)
            .set('X-Network', paymentHeader.network)
            .json({
                error: 'Payment Required',
                message: `Commitment fee of ${paymentDetails.amountFormatted} required to join syndication`,
                payment: paymentHeader,
                paymentInstructions: {
                    step1: 'Send USDC to the payment address',
                    step2: 'Include paymentId in transaction memo',
                    step3: 'Call /api/x402/confirm with paymentId and txHash'
                }
            });
    } catch (error) {
        console.error('Error creating pending payment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to initiate payment flow' });
    }
});

// Simulate x402 payment (mock - no real blockchain)
app.post('/api/x402/pay', async (req, res) => {
    const { paymentId, walletAddress } = req.body;

    if (!paymentId) {
        return res.status(400).json({ error: 'Bad Request', message: 'Missing payment ID' });
    }

    try {
        const db = getDB();
        const payment = await db.collection('pending_payments').findOne({ paymentId });

        if (!payment) {
            return res.status(404).json({ error: 'Not Found', message: 'Payment not found or already processed' });
        }

        // Simulate blockchain transaction
        const txHash = '0x' + crypto.randomBytes(32).toString('hex');
        const gasUsed = (0.00001 + Math.random() * 0.00005).toFixed(6);

        // Update payment status
        payment.status = 'completed';
        payment.txHash = txHash;
        payment.paidAt = new Date();
        payment.paidFrom = walletAddress || 'mock-participant-wallet';
        payment.gasUsed = gasUsed;
        payment.confirmations = 12;

        // Persist to completed and remove from pending
        await db.collection('completed_payments').insertOne(payment);
        await db.collection('pending_payments').deleteOne({ _id: payment._id });

        await logPaymentEvent('payment_completed', { paymentId, txHash, syndId: payment.syndId });
        await recordCompletedPayment(payment);

        console.log(`✅ x402 Payment completed: ${paymentId} | ${payment.amountFormatted} | ${txHash.slice(0, 16)}...`);

        res.json({
            success: true,
            message: `Paid ${payment.amountFormatted} via x402 USDC on Base`,
            transaction: {
                paymentId,
                txHash,
                amount: payment.amount,
                currency: 'USDC',
                network: 'base',
                gasUsed,
                confirmations: 12,
                timestamp: payment.paidAt.toISOString()
            },
            receipt: {
                type: payment.type,
                syndId: payment.syndId,
                participantId: payment.participantId,
                feePercentage: payment.feePercentage,
                commitmentAmount: payment.commitmentAmount
            }
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process payment' });
    }
});

// Check payment status
app.get('/api/x402/status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;

    try {
        const db = getDB();
        let payment = await db.collection('pending_payments').findOne({ paymentId });
        if (!payment) {
            payment = await db.collection('completed_payments').findOne({ paymentId });
        }

        if (!payment) {
            return res.status(404).json({ error: 'Not Found', message: 'Payment not found' });
        }

        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch payment status' });
    }
});

// Get all completed payments
app.get('/api/x402/transactions', async (req, res) => {
    try {
        const db = getDB();
        const payments = await db.collection('completed_payments').find({}).sort({ paidAt: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch transactions' });
    }
});

// Trigger break fee (for participant dropout)
app.post('/api/x402/break-fee', async (req, res) => {
    const { syndId, participantId, allocatedAmount } = req.body;

    if (!syndId || !participantId || !allocatedAmount) {
        return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    // 0.2% break fee
    const feeAmount = Math.round(allocatedAmount * 0.002);

    const paymentHeader = generateX402PaymentHeader({
        type: 'break_fee',
        amount: feeAmount,
        memo: `Break fee for dropout from ${syndId}`
    });

    try {
        const db = getDB();
        const pendingPayment = {
            type: 'break_fee',
            syndId,
            participantId,
            allocatedAmount,
            amount: feeAmount,
            ...paymentHeader,
            status: 'pending',
            createdAt: new Date()
        };

        await db.collection('pending_payments').insertOne(pendingPayment);
        await logPaymentEvent('break_fee_request', { syndId, participantId, paymentId: paymentHeader.paymentId });

        res.status(402)
            .set('X-Payment-Required', 'true')
            .set('X-Payment-Id', paymentHeader.paymentId)
            .json({
                error: 'Break Fee Required',
                message: `Break fee of $${feeAmount.toLocaleString()} USDC required for early withdrawal`,
                payment: paymentHeader
            });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to initiate break fee flow' });
    }
});

// Start server
async function startServer() {
    try {
        await connectDB();
        // Cloud Run requires listening on 0.0.0.0, not just localhost
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 SyndiMatch API running on http://0.0.0.0:${PORT}`);
            console.log(`📊 Dashboard available at http://0.0.0.0:${PORT}`);
            console.log(`💳 x402 Mock Payment endpoints active`);
            console.log(`🔗 MongoDB connected`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
