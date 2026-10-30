const express = require('express');
const router = express.Router();
const https = require('https');
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const { readKey, writeKey, withWriteLock } = require('./sync');
const ttlStore = require('../utils/ttlStore');

// Online fee payments. The server creates the Razorpay order and verifies the
// payment signature before a fee record is written, so a payment can't be
// recorded from the browser alone.
const KEY_ID = () => process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = () => process.env.RAZORPAY_KEY_SECRET;

function createRazorpayOrder(amountPaise, receipt) {
  const body = JSON.stringify({ amount: amountPaise, currency: 'INR', receipt });
  const auth = Buffer.from(`${KEY_ID()}:${KEY_SECRET()}`).toString('base64');
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.razorpay.com',
      path: '/v1/orders',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Basic ${auth}` }
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error((json.error && json.error.description) || 'Razorpay error'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function balanceFor(studentId) {
  const students = await readKey('students', []);
  const me = students.find(s => s.id === studentId && s.status === 'active');
  if (!me) return null;
  const fees = await readKey('fees', []);
  const paid = fees.filter(f => f.studentId === me.id).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  return { me, balance: (Number(me.totalFee) || 0) - paid };
}

// @route  GET /api/payments/status
router.get('/status', (req, res) => {
  res.json({ success: true, enabled: Boolean(KEY_ID() && KEY_SECRET()) });
});

// @route  POST /api/payments/order   { amount }  (rupees)
router.post('/order', protect, authorize('student'), async (req, res) => {
  if (!KEY_ID() || !KEY_SECRET()) {
    return res.status(503).json({ success: false, message: 'Online payment is not available yet. Please pay at the school office.' });
  }
  const amount = Math.round(Number(req.body.amount));
  try {
    const info = await balanceFor(req.user.studentId);
    if (!info) return res.status(403).json({ success: false, message: 'Your account is not active.' });
    if (!amount || amount < 1) return res.status(400).json({ success: false, message: 'Please enter a valid amount.' });
    if (amount > info.balance) {
      return res.status(400).json({ success: false, message: `Amount cannot exceed the balance due of ₹${info.balance.toLocaleString('en-IN')}.` });
    }
    const order = await createRazorpayOrder(amount * 100, `fee-${info.me.id}-${Date.now()}`.slice(0, 40));
    await ttlStore.set('payorder', order.id, JSON.stringify({ studentId: info.me.id, amount }), 60 * 60 * 1000);
    res.json({ success: true, orderId: order.id, keyId: KEY_ID(), amount, name: info.me.name, phone: info.me.phone || '' });
  } catch (err) {
    console.error('[PAYMENTS] order failed:', err.message);
    res.status(502).json({ success: false, message: 'Could not start the payment. Please try again.' });
  }
});

// @route  POST /api/payments/verify  { orderId, paymentId, signature }
router.post('/verify', protect, authorize('student'), async (req, res) => {
  const { orderId, paymentId, signature } = req.body || {};
  if (!KEY_SECRET() || !orderId || !paymentId || !signature) {
    return res.status(400).json({ success: false, message: 'Payment details are incomplete.' });
  }
  const expected = crypto.createHmac('sha256', KEY_SECRET()).update(`${orderId}|${paymentId}`).digest('hex');
  const valid = expected.length === String(signature).length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  if (!valid) return res.status(400).json({ success: false, message: 'Payment could not be verified.' });

  try {
    const pending = await ttlStore.get('payorder', orderId);
    const order = pending ? JSON.parse(pending) : null;
    if (!order || order.studentId !== req.user.studentId) {
      return res.status(400).json({ success: false, message: 'Payment session expired. If money was deducted, contact the school office with your payment ID.' });
    }
    await ttlStore.del('payorder', orderId);

    const record = await withWriteLock(async () => {
      const info = await balanceFor(order.studentId);
      const fees = await readKey('fees', []);
      const system = await readKey('system', {});
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10).replace(/-/g, '');
      const receipt = 'REC-' + stamp + '-' + String(fees.length + 1).padStart(5, '0');
      const rec = {
        id: receipt, receiptNo: receipt, receipt,
        studentId: order.studentId,
        date: now.toISOString(),
        amount: order.amount,
        method: 'Online', mode: 'Online',
        reference: paymentId,
        balance: Math.max(0, (info ? info.balance : 0) - order.amount),
        academicYear: (info && info.me.academicYear) || system.academicYear
      };
      fees.push(rec);
      await writeKey('fees', fees);
      return rec;
    });
    res.json({ success: true, fee: record });
  } catch (err) {
    console.error('[PAYMENTS] verify failed:', err.message);
    res.status(500).json({ success: false, message: 'Payment received but could not be recorded. Please contact the school office with your payment ID.' });
  }
});

module.exports = router;
