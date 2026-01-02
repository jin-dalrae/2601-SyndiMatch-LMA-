// ========================================
// SyndiMatch - Express Server
// ========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { connectDB, getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
        app.listen(PORT, () => {
            console.log(`🚀 SyndiMatch API running on http://localhost:${PORT}`);
            console.log(`📊 Dashboard available at http://localhost:${PORT}`);
            console.log(`💳 x402 Mock Payment endpoints active`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

