"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay = razorpayKeyId && razorpayKeySecret
    ? new razorpay_1.default({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
    : null;
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
    ? (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey)
    : null;
const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON || '';
const serviceAccountBase64 = process.env.FCM_SERVICE_ACCOUNT_BASE64 || '';
let firebaseReady = false;
try {
    if (serviceAccountJson || serviceAccountBase64) {
        const raw = serviceAccountJson
            ? serviceAccountJson
            : Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(raw);
        firebase_admin_1.default.initializeApp({ credential: firebase_admin_1.default.credential.cert(serviceAccount) });
        firebaseReady = true;
    }
}
catch (err) {
    console.warn('FCM init failed:', err);
}
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'VSYK Chits Backend is running!' });
});
async function sendPushToCustomers(customerIds, payload) {
    if (!firebaseReady || !supabaseAdmin || customerIds.length === 0) {
        return { sent: 0, failed: 0 };
    }
    const { data: tokens } = await supabaseAdmin
        .from('member_device_tokens')
        .select('fcm_token')
        .in('customer_id', customerIds);
    const tokenList = Array.from(new Set((tokens || []).map((t) => t.fcm_token).filter(Boolean)));
    if (tokenList.length === 0)
        return { sent: 0, failed: 0 };
    const response = await firebase_admin_1.default.messaging().sendEachForMulticast({
        tokens: tokenList,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
    });
    return { sent: response.successCount, failed: response.failureCount };
}
async function getGroupMemberCustomerIds(chitGroupId) {
    if (!supabaseAdmin)
        return [];
    const { data } = await supabaseAdmin
        .from('chit_members')
        .select('customer_id')
        .eq('chit_group_id', chitGroupId);
    return (data || []).map((row) => row.customer_id).filter(Boolean);
}
async function runAuctionScheduler() {
    if (!supabaseAdmin)
        return { opened: 0, closed: 0 };
    const nowIso = new Date().toISOString();
    const { data: toOpen } = await supabaseAdmin
        .from('auctions')
        .select('id, chit_group_id, auction_number')
        .eq('status', 'upcoming')
        .lte('scheduled_at', nowIso);
    const openIds = (toOpen || []).map((a) => a.id);
    if (openIds.length > 0) {
        await supabaseAdmin.from('auctions').update({ status: 'live' }).in('id', openIds);
        await supabaseAdmin.from('auction_events').insert(openIds.map((id) => ({
            auction_id: id,
            event_type: 'started',
            performed_by: 'System',
            notes: 'Auction opened automatically',
        })));
        for (const auction of toOpen || []) {
            const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
            await sendPushToCustomers(memberIds, {
                title: 'Auction is Live',
                body: `Auction #${auction.auction_number || ''} is now open for bids.`,
                data: { auctionId: auction.id, type: 'auction_live' },
            });
        }
    }
    const { data: toClose } = await supabaseAdmin
        .from('auctions')
        .select('id, chit_group_id, auction_number')
        .eq('status', 'live')
        .lte('closes_at', nowIso);
    for (const auction of toClose || []) {
        const { data: lowestBid } = await supabaseAdmin
            .from('auction_bids')
            .select('bid_amount, customer_id')
            .eq('auction_id', auction.id)
            .order('bid_amount', { ascending: true })
            .limit(1)
            .maybeSingle();
        let winnerMemberId = null;
        if (lowestBid?.customer_id) {
            const { data: memberRow } = await supabaseAdmin
                .from('chit_members')
                .select('id')
                .eq('chit_group_id', auction.chit_group_id)
                .eq('customer_id', lowestBid.customer_id)
                .maybeSingle();
            winnerMemberId = memberRow?.id ?? null;
        }
        await supabaseAdmin.from('auctions').update({
            status: 'completed',
            current_bid: lowestBid?.bid_amount ?? 0,
            winner_member_id: winnerMemberId,
            ended_at: new Date().toISOString(),
        }).eq('id', auction.id);
        await supabaseAdmin.from('auction_events').insert([{
                auction_id: auction.id,
                event_type: 'auto_closed',
                performed_by: 'System',
                notes: 'Auction closed automatically',
            }]);
        const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
        await sendPushToCustomers(memberIds, {
            title: 'Auction Closed',
            body: `Auction #${auction.auction_number || ''} closed. Waiting for admin confirmation.`,
            data: { auctionId: auction.id, type: 'auction_closed' },
        });
    }
    return { opened: openIds.length, closed: (toClose || []).length };
}
app.post('/api/payments/razorpay/order', async (req, res) => {
    try {
        if (!razorpay) {
            return res.status(500).json({ error: 'Razorpay keys are not configured.' });
        }
        const { amount, currency = 'INR', receipt, notes } = req.body ?? {};
        const parsedAmount = Number(amount);
        if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount.' });
        }
        const order = await razorpay.orders.create({
            amount: Math.round(parsedAmount),
            currency,
            receipt,
            notes,
        });
        return res.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
            keyId: razorpayKeyId,
        });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Failed to create order.' });
    }
});
app.post('/api/payments/razorpay/verify', (req, res) => {
    if (!razorpayKeySecret) {
        return res.status(500).json({ error: 'Razorpay keys are not configured.' });
    }
    const { orderId, paymentId, signature } = req.body ?? {};
    if (!orderId || !paymentId || !signature) {
        return res.status(400).json({ error: 'Missing verification fields.' });
    }
    const expected = crypto_1.default
        .createHmac('sha256', razorpayKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    if (expected !== signature) {
        return res.status(400).json({ verified: false, error: 'Invalid signature.' });
    }
    return res.json({ verified: true });
});
app.post('/api/auctions/scheduler/run', async (_req, res) => {
    try {
        const result = await runAuctionScheduler();
        return res.json({ ok: true, ...result });
    }
    catch (error) {
        return res.status(500).json({ ok: false, error: error?.message || 'Scheduler failed.' });
    }
});
app.post('/api/auctions/notify-winner', async (req, res) => {
    try {
        if (!supabaseAdmin)
            return res.status(500).json({ error: 'Supabase not configured.' });
        const { auctionId } = req.body ?? {};
        if (!auctionId)
            return res.status(400).json({ error: 'auctionId is required.' });
        const { data: auction } = await supabaseAdmin
            .from('auctions')
            .select('id, chit_group_id, auction_number, winner_member_id, current_bid')
            .eq('id', auctionId)
            .maybeSingle();
        if (!auction)
            return res.status(404).json({ error: 'Auction not found.' });
        let winnerCustomerId = null;
        if (auction.winner_member_id) {
            const { data: memberRow } = await supabaseAdmin
                .from('chit_members')
                .select('customer_id')
                .eq('id', auction.winner_member_id)
                .maybeSingle();
            winnerCustomerId = memberRow?.customer_id ?? null;
        }
        if (winnerCustomerId) {
            await sendPushToCustomers([winnerCustomerId], {
                title: 'You Won the Auction',
                body: `Congrats! You won Auction #${auction.auction_number || ''}. Credit will be processed soon.`,
                data: { auctionId: auction.id, type: 'winner_declared' },
            });
        }
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Failed to notify winner.' });
    }
});
app.post('/api/auctions/notify-installments', async (req, res) => {
    try {
        if (!supabaseAdmin)
            return res.status(500).json({ error: 'Supabase not configured.' });
        const { auctionId, message } = req.body ?? {};
        if (!auctionId)
            return res.status(400).json({ error: 'auctionId is required.' });
        const { data: auction } = await supabaseAdmin
            .from('auctions')
            .select('id, chit_group_id, auction_number')
            .eq('id', auctionId)
            .maybeSingle();
        if (!auction)
            return res.status(404).json({ error: 'Auction not found.' });
        const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
        await sendPushToCustomers(memberIds, {
            title: 'Installment Due',
            body: message || `Installment is due for Auction #${auction.auction_number || ''}. Please pay now.`,
            data: { auctionId: auction.id, type: 'installment_due' },
        });
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Failed to notify members.' });
    }
});
app.post('/api/auctions/notify-upcoming', async (req, res) => {
    try {
        if (!supabaseAdmin)
            return res.status(500).json({ error: 'Supabase not configured.' });
        const { auctionId } = req.body ?? {};
        if (!auctionId)
            return res.status(400).json({ error: 'auctionId is required.' });
        const { data: auction } = await supabaseAdmin
            .from('auctions')
            .select('id, chit_group_id, auction_number, scheduled_at')
            .eq('id', auctionId)
            .maybeSingle();
        if (!auction)
            return res.status(404).json({ error: 'Auction not found.' });
        const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
        await sendPushToCustomers(memberIds, {
            title: 'Auction Scheduled',
            body: `Auction #${auction.auction_number || ''} is scheduled soon. Tap to view details.`,
            data: { auctionId: auction.id, type: 'auction_scheduled' },
        });
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Failed to notify members.' });
    }
});
app.post('/api/auctions/apply-settlement', async (req, res) => {
    try {
        if (!supabaseAdmin)
            return res.status(500).json({ error: 'Supabase not configured.' });
        const { auctionId } = req.body ?? {};
        if (!auctionId)
            return res.status(400).json({ error: 'auctionId is required.' });
        const { data: auction } = await supabaseAdmin
            .from('auctions')
            .select('id, chit_group_id, auction_number, final_due_amount, dividend_amount')
            .eq('id', auctionId)
            .maybeSingle();
        if (!auction)
            return res.status(404).json({ error: 'Auction not found.' });
        const { data: members } = await supabaseAdmin
            .from('chit_members')
            .select('id, participation_share')
            .eq('chit_group_id', auction.chit_group_id);
        const updates = (members || []).map(async (member) => {
            const share = Number(member.participation_share || 1);
            const amount = Math.round(Number(auction.final_due_amount || 0) * share);
            const dividend = Math.round(Number(auction.dividend_amount || 0) * share);
            await supabaseAdmin
                .from('payment_schedules')
                .update({
                amount,
                dividend_amount: dividend,
            })
                .eq('chit_member_id', member.id)
                .eq('month_number', auction.auction_number);
        });
        await Promise.all(updates);
        return res.json({ ok: true, updated: (members || []).length });
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Failed to apply settlement.' });
    }
});
setInterval(() => {
    runAuctionScheduler().catch((err) => console.warn('Scheduler error:', err));
}, 60 * 1000);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
