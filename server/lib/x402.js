// x402 mock payment helpers.
// Simulates Coinbase's HTTP 402 payment-required flow on Base USDC.

const crypto = require('crypto');
const { getDB } = require('../db');

function generateX402PaymentHeader(paymentDetails) {
    const paymentId = `x402-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    return {
        paymentId,
        payTo: process.env.PLATFORM_WALLET || 'platform-syndimatch-wallet',
        network: 'base',
        currency: 'USDC',
        amount: paymentDetails.amount,
        validUntil: new Date(Date.now() + 3600000).toISOString(),
        memo: paymentDetails.memo || 'SyndiMatch fee payment'
    };
}

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

module.exports = { generateX402PaymentHeader, logPaymentEvent, recordCompletedPayment };
