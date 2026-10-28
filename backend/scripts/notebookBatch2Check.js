/**
 * Notebook points 9-14: WhatsApp alerts, partners staying visible for Insta
 * Work, service-city PIN codes, support-ticket chat updates, bigger home
 * tiles, Google sign-in on iPhone.
 *
 *   node scripts/notebookBatch2Check.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('mongoose').set('bufferCommands', false);
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };

(async () => {
    // ---- 11. service-city PIN codes -------------------------------------
    const Zone = require('../models/Zone');
    let zones = [];
    Zone.find = () => ({ select: () => ({ lean: async () => zones }) });
    const Pin = require('../utils/servicePincodes');

    await check('PIN codes the admin types are cleaned to valid 6-digit codes', async () => {
        assert.deepStrictEqual(Pin.parsePincodes('452001, 452010 ;abc 45200 012345 452001'), ['452001', '452010']);
        assert.deepStrictEqual(Pin.parsePincodes(['452016', 'x', '4520167']), ['452016']);
    });
    await check('nothing is restricted until a zone lists PIN codes', async () => {
        zones = [{ name: 'Indore', pincodes: [] }]; Pin.refresh();
        assert.strictEqual(await Pin.pincodeProblem('999999', { required: true }), null);
        assert.strictEqual((await Pin.summary()).restricted, false);
    });
    await check('once listed, only those PIN codes are accepted', async () => {
        zones = [{ name: 'Indore', pincodes: ['452001', '452010'] }, { name: 'Bhopal', pincodes: [] }]; Pin.refresh();
        assert.strictEqual(await Pin.pincodeProblem('452010'), null);
        assert.match(await Pin.pincodeProblem('110001'), /do not serve PIN code 110001.*Indore/);
        assert.strictEqual(await Pin.pincodeProblem(''), null, 'optional where it is not required');
        assert.match(await Pin.pincodeProblem('', { required: true }), /Enter the PIN code/);
        assert.deepStrictEqual((await Pin.summary()).pincodes, ['452001', '452010']);
    });
    await check('Insta Work and lead requests enforce it, and the apps read the list', async () => {
        assert.ok(read('backend', 'controllers', 'instaCustomerController.js').includes("pincodeProblem(req.body.addressDetails?.pincode, { required: true })"));
        assert.ok(read('backend', 'controllers', 'leadController.js').includes('pincodeProblem(locationDetail?.pincode)'));
        assert.ok(read('frontend', 'src', 'modules', 'user', 'components', 'InstaLocationPicker.jsx').includes('!pinProblem &&'));
        assert.ok(read('backend', 'routes', 'publicRoutes.js').includes("router.get('/service-pincodes'"));
        assert.ok(read('backend', 'routes', 'adminRoutes.js').includes("router.put('/zones/:id'"));
    });

    // ---- 9. WhatsApp alerts ---------------------------------------------
    const wa = require('../services/whatsappService');
    await check('WhatsApp alerts: partners get job, lead and booking alerts, customers only what the booking flow does not send', async () => {
        assert.strictEqual(wa.alertWanted({ userRole: 'provider', type: 'lead', title: 'New lead' }), true);
        assert.strictEqual(wa.alertWanted({ userRole: 'provider', type: 'booking', title: 'New Insta Work job', bookingId: 'b' }), true);
        assert.strictEqual(wa.alertWanted({ userRole: 'user', type: 'booking', title: 'Your worker has arrived' }), true);   // Insta job
        assert.strictEqual(wa.alertWanted({ userRole: 'user', type: 'booking', title: 'Booking confirmed', bookingId: 'b' }), false); // already sent
        assert.strictEqual(wa.alertWanted({ userRole: 'provider', type: 'booking', title: 'Reminder: Cleaning in 15 minutes', bookingId: 'b' }), false);
        assert.strictEqual(wa.alertWanted({ userRole: 'provider', type: 'kyc', title: 'Documents approved' }), false);
    });
    await check('WhatsApp alerts can be switched off and never block a notification', async () => {
        process.env.WHATSAPP_ALERTS = 'off';
        assert.strictEqual(wa.alertWanted({ userRole: 'provider', type: 'lead', title: 'x' }), false);
        delete process.env.WHATSAPP_ALERTS;
        assert.strictEqual(await wa.sendAlert({ userId: 'u', userRole: 'provider', title: 't', message: 'm', type: 'kyc' }), 'skipped (not a WhatsApp alert)');
        const svc = read('backend', 'config', 'notificationService.js');
        assert.ok(/sendAlert\(\{ userId, userRole, title, message, type, bookingId \}\)\s*\.then/.test(svc), 'sent without awaiting');
        assert.ok(read('backend', 'scripts', 'devLocalDb.js').includes("process.env.WHATSAPP_API_KEY = ''"), 'a scratch database never messages real numbers');
    });

    // ---- 10. partners stay visible --------------------------------------
    await check('a partner with Insta Work on keeps pinging from every screen', async () => {
        const presence = read('frontend', 'src', 'components', 'InstaPresence.jsx');
        assert.ok(presence.includes('/insta/provider/ping') && presence.includes('visibilitychange'));
        assert.ok(read('frontend', 'src', 'App.jsx').includes('<InstaPresence />'));
    });

    // ---- 12. support ticket chat ----------------------------------------
    await check('ticket changes are written into the chat, and the chat shows them', async () => {
        const SupportTicket = require('../models/SupportTicket');
        assert.ok(SupportTicket.schema.path('messages').schema.path('sender').enumValues.includes('system'));
        const ctl = read('backend', 'controllers', 'supportController.js');
        for (const marker of ['Ticket raised.', 'STATUS_NOTE[status]', 'Ticket reopened.', 'Our team is calling you now.']) {
            assert.ok(ctl.includes(marker), marker);
        }
        assert.ok(read('frontend', 'src', 'components', 'support', 'SupportTicketThread.jsx').includes('data-ticket-note'));
        const list = read('frontend', 'src', 'modules', 'user', 'pages', 'SupportTickets.jsx');
        assert.ok(list.includes('setOpenTicket(ticket)') && list.includes('resolved: "bg-emerald-100'));
        assert.ok(list.includes('socket.on("SUPPORT_TICKET_UPDATED"'));
    });
    await check('the bottom nav sits under pop-ups, so their buttons can be pressed', async () => {
        const nav = read('frontend', 'src', 'modules', 'user', 'components', 'BottomNav.jsx');
        assert.ok(/fixed bottom-6 left-4 right-4 z-40 md:hidden/.test(nav));
    });

    // ---- 13. home tiles --------------------------------------------------
    await check('the four home tiles are larger', async () => {
        const home = read('frontend', 'src', 'modules', 'user', 'pages', 'Index.jsx');
        const grid = home.slice(home.indexOf('const quickLinksGrid'), home.indexOf('</section>', home.indexOf('const quickLinksGrid')));
        assert.ok(grid.includes('min-h-[88px]') && grid.includes('h-12 w-12') && grid.includes('text-[14px]'));
        assert.ok(!grid.includes('text-[9px]'));
    });

    // ---- 14. Google sign-in on iPhone -----------------------------------
    await check('iPhone Google sign-in retries, explains a failure and warns inside other apps', async () => {
        const login = read('frontend', 'src', 'modules', 'user', 'pages', 'CustomerLogin.jsx');
        assert.ok(login.includes('attempt < 4') && login.includes('onUnavailable'));
        assert.ok(login.includes('inAppBrowser()'));
    });

    console.log(`\n${passed} notebook batch 2 checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
