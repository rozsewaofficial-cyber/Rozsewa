/**
 * Support tickets: admin sees which partner raised one, and partner and admin
 * talk on the ticket (Live Chat) and handle a call back (Request a Call).
 *
 * Admin's list populated the partner's `name`, which a Provider doesn't
 * have, so every partner ticket read "Anonymous" with no number. Live Chat
 * and Request a Call only showed a message.
 *
 *   node scripts/supportTicketChatCheck.js
 *
 * Runs the real controller with the models stubbed; no database needed.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
// No database: anything not stubbed fails at once instead of waiting.
require('mongoose').set('bufferCommands', false);
const SupportTicket = require('../models/SupportTicket');
const Provider = require('../models/Provider');
const ctrl = require('../controllers/supportController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

const partner = { _id: 'p1', role: 'provider', ownerName: 'Ravi Kumar', mobile: '9876543210' };
const otherPartner = { _id: 'p2', role: 'provider', ownerName: 'Someone Else' };
const admin = { _id: 'a1', role: 'admin', name: 'Admin' };

let ticket;
const makeTicket = () => ({
    _id: 't1', providerId: { _id: 'p1', ownerName: 'Ravi Kumar', mobile: '9876543210', vendorCode: 'RSVND12345' },
    subject: 'Payout', description: 'Not received', status: 'pending', messages: [],
    markModified() {}, save: async function () { return this; }
});
let populated = [];
SupportTicket.findById = () => {
    const q = { populate(f, sel) { populated.push([f, sel]); return q; }, then: (res, rej) => Promise.resolve(ticket).then(res, rej) };
    return q;
};

const call = (fn, user, params = {}, body = {}) => new Promise((resolve) => {
    const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    fn({ user, params, body, query: {} }, res);
});

(async () => {
    await check("admin's ticket list loads the partner's real name, Partner ID and mobile", async () => {
        let sel = [];
        const chain = { populate(f, s) { sel.push([f, s]); return chain; }, sort() { return chain; }, skip() { return chain; }, limit() { return chain; }, then: (r) => Promise.resolve([]).then(r) };
        SupportTicket.find = () => chain;
        SupportTicket.countDocuments = async () => 0;
        await call(ctrl.getAllTickets, admin);
        const provider = sel.find(([f]) => f === 'providerId')[1];
        for (const field of ['ownerName', 'shopName', 'mobile', 'vendorCode']) assert.ok(provider.includes(field), field);
    });

    await check('a partner and admin chat on the ticket; messages keep sender and time', async () => {
        ticket = makeTicket();
        let r = await call(ctrl.addMessage, partner, { id: 't1' }, { text: 'Payout ID P-1' });
        assert.strictEqual(r.code, 201);
        r = await call(ctrl.addMessage, admin, { id: 't1' }, { text: 'Checking now' });
        assert.strictEqual(r.code, 201);
        assert.deepStrictEqual(ticket.messages.map(m => [m.sender, m.senderName, m.text]), [
            ['provider', 'Ravi Kumar', 'Payout ID P-1'],
            ['admin', 'RozSewa Support', 'Checking now']
        ]);
        assert.strictEqual(ticket.status, 'open', 'an admin reply opens a pending ticket');
        assert.strictEqual((await call(ctrl.addMessage, partner, { id: 't1' }, { text: '   ' })).code, 400);
    });

    await check('a partner writing on a resolved ticket reopens it', async () => {
        ticket = makeTicket(); ticket.status = 'resolved';
        await call(ctrl.addMessage, partner, { id: 't1' }, { text: 'Still not received' });
        assert.strictEqual(ticket.status, 'open');
    });

    await check("another partner can't read, message or cancel on someone's ticket", async () => {
        ticket = makeTicket();
        assert.strictEqual((await call(ctrl.getTicket, otherPartner, { id: 't1' })).code, 404);
        assert.strictEqual((await call(ctrl.addMessage, otherPartner, { id: 't1' }, { text: 'hi' })).code, 404);
        assert.strictEqual((await call(ctrl.requestCall, otherPartner, { id: 't1' }, {})).code, 404);
        assert.strictEqual(ticket.messages.length, 0);
    });

    await check('Request a Call: requested -> in progress -> completed, one at a time', async () => {
        ticket = makeTicket();
        let r = await call(ctrl.requestCall, partner, { id: 't1' }, { preferredTime: 'Evening (4pm - 8pm)' });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(ticket.callRequest.status, 'requested');
        assert.strictEqual(ticket.callRequest.phone, '9876543210');
        assert.strictEqual(ticket.callRequest.preferredTime, 'Evening (4pm - 8pm)');
        const first = ticket.callRequest;
        await call(ctrl.requestCall, partner, { id: 't1' }, {});
        assert.strictEqual(ticket.callRequest, first, 'asking again keeps the open request');
        assert.strictEqual((await call(ctrl.updateCallRequest, partner, { id: 't1' }, { status: 'completed' })).code, 400, 'partner can only cancel');
        await call(ctrl.updateCallRequest, admin, { id: 't1' }, { status: 'in_progress' });
        assert.strictEqual(ticket.callRequest.status, 'in_progress');
        await call(ctrl.updateCallRequest, admin, { id: 't1' }, { status: 'completed' });
        assert.strictEqual(ticket.callRequest.status, 'completed');
        assert.strictEqual((await call(ctrl.updateCallRequest, admin, { id: 't1' }, { status: 'in_progress' })).code, 400, 'a finished request stays finished');
    });

    await check('the partner can cancel their own call request', async () => {
        ticket = makeTicket();
        await call(ctrl.requestCall, partner, { id: 't1' }, {});
        const r = await call(ctrl.updateCallRequest, partner, { id: 't1' }, { status: 'cancelled' });
        assert.strictEqual(r.code, 200);
        assert.strictEqual(ticket.callRequest.status, 'cancelled');
    });

    await check('"Request a Call" can raise a ticket carrying the call request', async () => {
        let created;
        SupportTicket.create = async (d) => { created = d; return { ...d, _id: 't2' }; };
        const r = await call(ctrl.createTicket, partner, {}, { subject: 'Call back request', description: 'Please call', requestCall: true, preferredTime: 'nonsense' });
        assert.strictEqual(r.code, 201);
        assert.strictEqual(created.providerId, 'p1');
        assert.strictEqual(created.callRequest.status, 'requested');
        assert.strictEqual(created.callRequest.preferredTime, ctrl.CALL_TIMES[0], 'unknown time falls back');
    });

    await check('a logged-out ticket is linked to the partner with that mobile', async () => {
        let created;
        SupportTicket.create = async (d) => { created = d; return { ...d, _id: 't3' }; };
        Provider.findOne = (q) => ({ select: () => ({ lean: async () => (q.mobile === '9876543210' ? { _id: 'p1' } : null) }) });
        await call(ctrl.createPublicTicket, undefined, {}, { subject: 's', description: 'd', name: 'Ravi', mobile: '+91 98765 43210', role: 'provider' });
        assert.strictEqual(created.providerId, 'p1');
    });

    await check('the admin push for new tickets has its helper imported', async () => {
        assert.ok(/require\('\.\.\/utils\/adminRecipients'\)/.test(read('backend', 'controllers', 'supportController.js')));
    });

    await check('screens: admin shows partner details and the chat; partner buttons do something', async () => {
        const adminPage = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminSupport.jsx');
        assert.ok(/ticketOwner\(t\)/.test(adminPage) && /owner\.partnerId/.test(adminPage) && /owner\.mobile/.test(adminPage));
        assert.ok(/<SupportTicketThread ticketId=\{t\._id\} viewer="admin"/.test(adminPage));
        const partnerPage = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderSupport.jsx');
        assert.ok(!/Connecting you to our next available executive/.test(partnerPage), 'Live Chat is not just a message');
        assert.ok(!/will call you back within 2-4 hours/.test(partnerPage), 'Request a Call is not just a message');
        assert.ok(/openStart\("chat"\)/.test(partnerPage) && /openStart\("call"\)/.test(partnerPage));
        assert.ok(/<SupportTicketThread/.test(partnerPage));
    });

    await check("customers read support's answers in the ticket chat (they only saw \"1 reply\")", async () => {
        const page = read('frontend', 'src', 'modules', 'user', 'pages', 'SupportTickets.jsx');
        assert.ok(/<SupportTicketThread ticketId=\{openTicket\._id\} viewer="user"/.test(page));
        const customer = { _id: 'u1', role: 'customer', name: 'Asha' };
        ticket = { ...makeTicket(), providerId: undefined, userId: { _id: 'u1', name: 'Asha' } };
        assert.strictEqual((await call(ctrl.getTicket, customer, { id: 't1' })).code, 200);
        assert.strictEqual((await call(ctrl.getTicket, partner, { id: 't1' })).code, 404, "a partner can't read a customer's ticket");
    });

    await check('lists put the latest activity first', async () => {
        const src = read('backend', 'controllers', 'supportController.js');
        assert.strictEqual((src.match(/\.sort\(\{ updatedAt: -1, createdAt: -1 \}\)/g) || []).length, 2);
    });

    console.log(`\n${passed} support ticket checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
