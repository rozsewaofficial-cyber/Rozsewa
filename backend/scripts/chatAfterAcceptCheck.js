/**
 * Booking chat opens only after the partner accepts (confirmed / on the way /
 * started), and only the booking's own customer and partner can use it. A
 * pending booking — even a direct one that already names its partner — shows
 * no Chat button and the API refuses to send.
 *
 *   node scripts/chatAfterAcceptCheck.js
 *
 * Runs the real controller with Booking.findById stubbed; no database needed.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const { getMessages, sendMessage } = require('../controllers/chatController');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

const customerId = new mongoose.Types.ObjectId();
const partnerId = new mongoose.Types.ObjectId();
const strangerId = new mongoose.Types.ObjectId();
const bookingId = new mongoose.Types.ObjectId().toString();

let currentBooking = null;
Booking.findById = () => ({ select: async () => currentBooking });
const reportError = console.error;
console.error = () => {}; // the controller logs the stubbed save below
let saved = 0;
Message.prototype.save = async function () { saved += 1; throw new Error('stop after save'); };

const res = () => {
    const r = { code: 200, body: undefined, headers: {} };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.set = (k, v) => { r.headers[k] = v; return r; };
    return r;
};
const asCustomer = (id = customerId) => ({ params: { bookingId }, body: { text: 'hi' }, user: { _id: id, name: 'C' }, query: {} });
const asPartner = (id = partnerId) => ({ params: { bookingId }, body: { text: 'hi' }, provider: { _id: id, name: 'P' }, query: {} });
const booking = (status) => ({ userId: customerId, providerId: partnerId, status });

(async () => {
    await check('a pending booking (partner already named) cannot be messaged', async () => {
        currentBooking = booking('pending');
        for (const req of [asCustomer(), asPartner()]) {
            const r = res(); saved = 0;
            await sendMessage(req, r);
            assert.strictEqual(r.code, 400);
            assert.match(r.body.message, /once the partner accepts/);
            assert.strictEqual(saved, 0);
        }
    });

    await check('a pending booking shows an empty conversation', async () => {
        currentBooking = booking('pending');
        const r = res();
        await getMessages(asCustomer(), r);
        assert.deepStrictEqual(r.body, []);
    });

    await check('confirmed / on the way / started bookings can be messaged', async () => {
        for (const status of ['confirmed', 'on_the_way', 'started']) {
            currentBooking = booking(status);
            const r = res(); saved = 0;
            await sendMessage(asCustomer(), r);
            assert.strictEqual(saved, 1, `${status} should reach save`);
        }
    });

    await check('completed and cancelled bookings are closed for new messages', async () => {
        for (const status of ['completed', 'cancelled']) {
            currentBooking = booking(status);
            const r = res(); saved = 0;
            await sendMessage(asPartner(), r);
            assert.strictEqual(r.code, 400);
            assert.match(r.body.message, /closed/);
            assert.strictEqual(saved, 0);
        }
    });

    await check('someone outside the booking can neither read nor send', async () => {
        currentBooking = booking('confirmed');
        for (const req of [asCustomer(strangerId), asPartner(strangerId)]) {
            const s = res(); saved = 0;
            await sendMessage(req, s);
            assert.strictEqual(s.code, 403);
            assert.strictEqual(saved, 0);
            const g = res();
            await getMessages(req, g);
            assert.strictEqual(g.code, 403);
        }
    });

    await check('an unknown booking id is a 404', async () => {
        currentBooking = null;
        const r = res();
        await sendMessage(asCustomer(), r);
        assert.strictEqual(r.code, 404);
    });

    await check('the frontend shows Chat only for the same statuses', async () => {
        const lib = read('frontend', 'src', 'lib', 'bookingChat.js');
        assert.ok(/CHAT_OPEN_STATUSES = \["confirmed", "on_the_way", "started"\]/.test(lib));
        const tracking = read('frontend', 'src', 'modules', 'user', 'pages', 'LiveTracking.jsx');
        assert.ok(/canChatOnBooking\(bookingDetails\?\.status\) && \(\s*<button\s*onClick=\{\(\) => setIsChatOpen\(true\)\}/.test(tracking));
        const history = read('frontend', 'src', 'modules', 'user', 'pages', 'ServiceHistory.jsx');
        assert.ok(!/status === "pending" && \(\s*<div className="grid grid-cols-1 gap-3">\s*<button onClick=\{\(\) => setIsChatOpen/.test(history));
    });

    console.log(`\n${passed} chat-after-accept checks passed.\n`);
    process.exit(0);
})().catch((e) => { reportError(e); process.exit(1); });
