const express = require('express');
const router = express.Router();
const axios = require('axios');
const { User } = require('../database/models');
const mongoose = require('mongoose');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID; // Set after registering webhook in PayPal dashboard
const PAYPAL_BASE = 'https://api-m.paypal.com';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getPayPalToken() {
    const response = await axios.post(
        `${PAYPAL_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            auth: { username: PAYPAL_CLIENT_ID, password: PAYPAL_CLIENT_SECRET },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );
    return response.data.access_token;
}

// Update monthlyDonationActive on both User and PublicProfile
async function setMonthlyBadge(idPublic, active) {
    // Dynamically require to avoid circular dep issues
    const { PublicProfile } = require('../database/models');
    const user = await User.findOneAndUpdate(
        { id_public: idPublic },
        { monthlyDonationActive: active },
        { new: true }
    );
    if (user) {
        await PublicProfile.updateOne({ id_public: idPublic }, { monthlyDonationActive: active });
        console.log(`[PayPal] Monthly badge ${active ? 'activated' : 'deactivated'} for ${idPublic}`);
    }
    return user;
}

// ── POST /api/payments/paypal/order/create ───────────────────────────────────
// Creates a one-time PayPal order and returns the approval URL.
router.post('/paypal/order/create', async (req, res) => {
    try {
        const idPublic = req.user?.id_public;
        if (!idPublic) return res.status(401).json({ error: 'Cannot identify user from token' });

        const amount = parseFloat(req.body.amount);
        if (!amount || amount < 1 || amount > 10000) {
            return res.status(400).json({ error: 'Amount must be between $1 and $10,000' });
        }

        const token = await getPayPalToken();
        const response = await axios.post(
            `${PAYPAL_BASE}/v2/checkout/orders`,
            {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: { currency_code: 'USD', value: amount.toFixed(2) },
                    description: 'CritterTrack One-Time Donation',
                    custom_id: idPublic
                }],
                application_context: {
                    brand_name: 'CritterTrack',
                    user_action: 'PAY_NOW',
                    return_url: 'https://crittertrack.app/donation?donated=1',
                    cancel_url: 'https://crittertrack.app/donation?cancelled=1'
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'PayPal-Request-Id': `order-${idPublic}-${Date.now()}`
                }
            }
        );

        const approvalLink = response.data.links?.find(l => l.rel === 'approve');
        if (!approvalLink) return res.status(500).json({ error: 'No approval URL from PayPal' });

        res.json({ approvalUrl: approvalLink.href, orderId: response.data.id });
    } catch (err) {
        console.error('[PayPal] Create order error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// ── POST /api/payments/paypal/order/capture ───────────────────────────────────
// Captures an approved order and grants the gift badge.
router.post('/paypal/order/capture', async (req, res) => {
    try {
        const { orderID } = req.body;
        if (!orderID) return res.status(400).json({ error: 'orderID is required' });

        const idPublic = req.user?.id_public;
        if (!idPublic) return res.status(401).json({ error: 'Cannot identify user from token' });

        const token = await getPayPalToken();
        const response = await axios.post(
            `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
            {},
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        if (!['COMPLETED'].includes(response.data.status)) {
            return res.status(400).json({ error: `Order status is '${response.data.status}'` });
        }

        // Grant gift badge
        const { PublicProfile } = require('../database/models');
        const now = new Date();
        await User.findOneAndUpdate({ id_public: idPublic }, { lastDonationDate: now });
        await PublicProfile.updateOne({ id_public: idPublic }, { lastDonationDate: now });

        console.log(`[PayPal] Gift badge granted for ${idPublic}`);
        res.json({ success: true, message: '🎁 Thank you! Your gift badge has been activated.' });
    } catch (err) {
        console.error('[PayPal] Capture order error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to capture order' });
    }
});

// ── POST /api/payments/paypal/subscription/create ────────────────────────────
// Creates a PayPal subscription and returns the approval URL for redirect.
router.post('/paypal/subscription/create', async (req, res) => {
    try {
        const idPublic = req.user?.id_public;

        const token = await getPayPalToken();
        const planId = process.env.PAYPAL_PLAN_ID || 'P-2KK54241433399439NGR5YFQ';

        const subscriptionBody = {
            plan_id: planId,
            application_context: {
                brand_name: 'CritterTrack',
                user_action: 'SUBSCRIBE_NOW',
                payment_method: {
                    payer_selected: 'PAYPAL',
                    payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
                },
                return_url: 'https://crittertrack.app/donation?subscribed=1',
                cancel_url: 'https://crittertrack.app/donation?cancelled=1'
            }
        };
        if (idPublic) subscriptionBody.custom_id = idPublic;

        const requestId = idPublic ? `${idPublic}-${Date.now()}` : `anon-${Date.now()}`;
        const response = await axios.post(
            `${PAYPAL_BASE}/v1/billing/subscriptions`,
            subscriptionBody,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'PayPal-Request-Id': requestId
                }
            }
        );

        const approvalLink = response.data.links?.find(l => l.rel === 'approve');
        if (!approvalLink) return res.status(500).json({ error: 'No approval URL returned from PayPal' });

        res.json({ approvalUrl: approvalLink.href, subscriptionId: response.data.id });
    } catch (err) {
        console.error('[PayPal] Create subscription error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
});

// ── POST /api/payments/paypal/subscription/activate ───────────────────────────
// Called from the frontend after the user approves a subscription.
// Requires authentication.
router.post('/paypal/subscription/activate', async (req, res) => {
    try {
        const { subscriptionID } = req.body;
        if (!subscriptionID) {
            return res.status(400).json({ error: 'subscriptionID is required' });
        }

        const token = await getPayPalToken();
        const subResponse = await axios.get(
            `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionID}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        const subscription = subResponse.data;

        if (!['ACTIVE', 'APPROVED'].includes(subscription.status)) {
            return res.status(400).json({ error: `Subscription status is '${subscription.status}', expected ACTIVE` });
        }

        // Grant badge to the authenticated user (identified by JWT in authMiddleware)
        const idPublic = req.user?.id_public;
        if (!idPublic) {
            return res.status(401).json({ error: 'Cannot identify user from token' });
        }

        await setMonthlyBadge(idPublic, true);

        res.json({ success: true, message: '💎 Monthly supporter badge activated!' });
    } catch (err) {
        console.error('[PayPal] Activate subscription error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to activate subscription' });
    }
});

// ── POST /api/payments/paypal/webhook ─────────────────────────────────────────
// Receives PayPal subscription lifecycle events.
// NOTE: registered in index.js with express.raw() BEFORE bodyParser.json().
// Register this URL in your PayPal dashboard:
//   https://crittertrack-pedigree-production.up.railway.app/api/payments/paypal/webhook
// Then copy the Webhook ID into the PAYPAL_WEBHOOK_ID environment variable.
router.post('/paypal/webhook', async (req, res) => {
    try {
        const rawBody = req.body; // Buffer (express.raw middleware applied in index.js)
        const event = JSON.parse(rawBody.toString('utf8'));

        // Verify signature if PAYPAL_WEBHOOK_ID is configured
        if (PAYPAL_WEBHOOK_ID) {
            const token = await getPayPalToken();
            const verifyRes = await axios.post(
                `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
                {
                    transmission_id: req.headers['paypal-transmission-id'],
                    transmission_time: req.headers['paypal-transmission-time'],
                    cert_url: req.headers['paypal-cert-url'],
                    auth_algo: req.headers['paypal-auth-algo'],
                    transmission_sig: req.headers['paypal-transmission-sig'],
                    webhook_id: PAYPAL_WEBHOOK_ID,
                    webhook_event: event
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (verifyRes.data.verification_status !== 'SUCCESS') {
                console.warn('[PayPal] Webhook signature verification failed');
                return res.status(400).json({ error: 'Webhook verification failed' });
            }
        } else {
            console.warn('[PayPal] PAYPAL_WEBHOOK_ID not set — skipping signature verification');
        }

        const eventType = event.event_type;
        const resource = event.resource || {};

        // custom_id is set on the subscription when the user subscribes
        const customId = resource.custom_id;

        console.log(`[PayPal] Webhook received: ${eventType} | custom_id: ${customId}`);

        if (!customId) {
            // Some events (e.g. payment completed) don't carry custom_id at the top level
            console.warn(`[PayPal] No custom_id on event ${eventType} — cannot identify user`);
            return res.sendStatus(200);
        }

        switch (eventType) {
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                await setMonthlyBadge(customId, true);
                break;

            case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
                await setMonthlyBadge(customId, true);
                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
            case 'BILLING.SUBSCRIPTION.EXPIRED':
                await setMonthlyBadge(customId, false);
                break;

            // Acknowledge but don't act on other events
            default:
                break;
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('[PayPal] Webhook error:', err.response?.data || err.message);
        res.sendStatus(500);
    }
});

module.exports = router;
