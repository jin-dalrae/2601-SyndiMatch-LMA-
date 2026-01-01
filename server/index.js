// ========================================
// SyndiMatch - Express Server
// ========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
        const syndications = await db.collection('syndications').find({}).toArray();
        res.json(syndications);
    } catch (error) {
        console.error('Error fetching syndications:', error);
        res.status(500).json({ error: 'Failed to fetch syndications' });
    }
});

app.get('/api/syndications/:id', async (req, res) => {
    try {
        const db = getDB();
        const syndication = await db.collection('syndications').findOne({ id: req.params.id });
        if (!syndication) {
            return res.status(404).json({ error: 'Syndication not found' });
        }
        res.json(syndication);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch syndication' });
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
        const participants = await db.collection('participant_agents').find({}).toArray();
        res.json(participants);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch participants' });
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

// Agents
app.get('/api/agents', async (req, res) => {
    try {
        const db = getDB();
        const [originator, participant, negotiation, settlement, payment] = await Promise.all([
            db.collection('originator_agents').find({}).toArray(),
            db.collection('participant_agents').find({}).toArray(),
            db.collection('negotiation_agents').find({}).toArray(),
            db.collection('settlement_agents').find({}).toArray(),
            db.collection('payment_agents').find({}).toArray()
        ]);
        res.json({ originator, participant, negotiation, settlement, payment });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch agents' });
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

// In-memory payment state (demo only)
const pendingPayments = new Map();
const completedPayments = [];

// Generate x402 payment header
function generateX402PaymentHeader(paymentDetails) {
    const paymentId = `x402-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
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

// Protected resource - triggers HTTP 402
app.post('/api/x402/join-syndication', (req, res) => {
    const { syndId, participantId, commitmentAmount } = req.body;

    if (!syndId || !participantId || !commitmentAmount) {
        return res.status(400).json({ error: 'Missing required fields' });
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
    pendingPayments.set(paymentHeader.paymentId, { ...paymentDetails, ...paymentHeader, status: 'pending', createdAt: new Date() });

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
});

// Simulate x402 payment (mock - no real blockchain)
app.post('/api/x402/pay', (req, res) => {
    const { paymentId, walletAddress } = req.body;

    const payment = pendingPayments.get(paymentId);
    if (!payment) {
        return res.status(404).json({ error: 'Payment not found or expired' });
    }

    // Simulate blockchain transaction
    const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const gasUsed = (0.00001 + Math.random() * 0.00005).toFixed(6);

    // Update payment status
    payment.status = 'completed';
    payment.txHash = txHash;
    payment.paidAt = new Date();
    payment.paidFrom = walletAddress || 'mock-participant-wallet';
    payment.gasUsed = gasUsed;
    payment.confirmations = 12;

    // Move to completed
    completedPayments.push(payment);
    pendingPayments.delete(paymentId);

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
});

// Check payment status
app.get('/api/x402/status/:paymentId', (req, res) => {
    const { paymentId } = req.params;

    let payment = pendingPayments.get(paymentId);
    if (!payment) {
        payment = completedPayments.find(p => p.paymentId === paymentId);
    }

    if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
});

// Get all completed payments
app.get('/api/x402/transactions', (req, res) => {
    res.json(completedPayments);
});

// Trigger break fee (for participant dropout)
app.post('/api/x402/break-fee', (req, res) => {
    const { syndId, participantId, allocatedAmount } = req.body;

    // 0.2% break fee
    const feeAmount = Math.round(allocatedAmount * 0.002);

    const paymentHeader = generateX402PaymentHeader({
        type: 'break_fee',
        amount: feeAmount,
        memo: `Break fee for dropout from ${syndId}`
    });

    pendingPayments.set(paymentHeader.paymentId, {
        type: 'break_fee',
        syndId,
        participantId,
        allocatedAmount,
        amount: feeAmount,
        ...paymentHeader,
        status: 'pending',
        createdAt: new Date()
    });

    res.status(402)
        .set('X-Payment-Required', 'true')
        .set('X-Payment-Id', paymentHeader.paymentId)
        .json({
            error: 'Break Fee Required',
            message: `Break fee of $${feeAmount.toLocaleString()} USDC required for early withdrawal`,
            payment: paymentHeader
        });
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

