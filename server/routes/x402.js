// x402 mock payment endpoints. Simulates Coinbase's HTTP 402 commitment-fee
// flow on Base USDC. No real chain calls — txHashes are randomized.

const express = require('express');
const crypto = require('crypto');
const { getDB } = require('../db');
const { callAgentsService } = require('../lib/agents-proxy');
const { generateX402PaymentHeader, logPaymentEvent, recordCompletedPayment } = require('../lib/x402');

const router = express.Router();

// Read-only proxies to the Python service for chain state
router.get('/x402/balance/:wallet', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/x402/balance/${req.params.wallet}`);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

router.get('/x402/escrow/:syndId', async (req, res) => {
    try {
        const result = await callAgentsService(`/api/x402/escrow/${req.params.syndId}`);
        res.json(result);
    } catch (error) {
        res.status(502).json({ error: 'Agents service unavailable' });
    }
});

// Trigger HTTP 402 commitment-fee flow when a participant joins a syndication.
// Fee = 0.5% of commitment.
router.post('/x402/join-syndication', async (req, res) => {
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

    const feeAmount = Math.round(commitmentAmount * 0.005);
    const paymentDetails = {
        type: 'commitment_fee',
        syndId,
        participantId,
        commitmentAmount,
        amount: feeAmount,
        amountFormatted: `$${feeAmount.toLocaleString()} USDC`,
        feePercentage: '0.5%',
        memo: `Commitment fee for ${syndId}`
    };
    const paymentHeader = generateX402PaymentHeader(paymentDetails);

    try {
        const db = getDB();
        await db.collection('pending_payments').insertOne({
            ...paymentDetails,
            ...paymentHeader,
            status: 'pending',
            createdAt: new Date()
        });
        await logPaymentEvent('join_syndication_request', { syndId, participantId, paymentId: paymentHeader.paymentId });

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
                    step3: 'Call /api/x402/pay with paymentId and txHash'
                }
            });
    } catch (error) {
        console.error('Error creating pending payment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to initiate payment flow' });
    }
});

// Settle a pending x402 payment (mock — no real chain call)
router.post('/x402/pay', async (req, res) => {
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

        const txHash = '0x' + crypto.randomBytes(32).toString('hex');
        const gasUsed = (0.00001 + Math.random() * 0.00005).toFixed(6);

        payment.status = 'completed';
        payment.txHash = txHash;
        payment.paidAt = new Date();
        payment.paidFrom = walletAddress || 'mock-participant-wallet';
        payment.gasUsed = gasUsed;
        payment.confirmations = 12;

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

router.get('/x402/status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    try {
        const db = getDB();
        let payment = await db.collection('pending_payments').findOne({ paymentId });
        if (!payment) payment = await db.collection('completed_payments').findOne({ paymentId });
        if (!payment) return res.status(404).json({ error: 'Not Found', message: 'Payment not found' });
        res.json(payment);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch payment status' });
    }
});

router.get('/x402/transactions', async (req, res) => {
    try {
        const db = getDB();
        const payments = await db.collection('completed_payments').find({}).sort({ paidAt: -1 }).toArray();
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch transactions' });
    }
});

// Trigger break fee (0.2%) for participant dropout
router.post('/x402/break-fee', async (req, res) => {
    const { syndId, participantId, allocatedAmount } = req.body;
    if (!syndId || !participantId || !allocatedAmount) {
        return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const feeAmount = Math.round(allocatedAmount * 0.002);
    const paymentHeader = generateX402PaymentHeader({
        type: 'break_fee',
        amount: feeAmount,
        memo: `Break fee for dropout from ${syndId}`
    });

    try {
        const db = getDB();
        await db.collection('pending_payments').insertOne({
            type: 'break_fee',
            syndId,
            participantId,
            allocatedAmount,
            amount: feeAmount,
            ...paymentHeader,
            status: 'pending',
            createdAt: new Date()
        });
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

module.exports = router;
