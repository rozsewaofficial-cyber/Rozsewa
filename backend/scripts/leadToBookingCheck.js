/**
 * A partner who unlocked a lead can book the work agreed with the customer:
 * POST /api/leads/:id/booking makes a normal booking (customer + partner,
 * status confirmed, cash after service) linked to the lead, at most one per
 * partner per lead, and completing it charges no commission.
 *
 *   node scripts/leadToBookingCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const ctrl = read('backend', 'controllers', 'leadController.js');
const routes = read('backend', 'routes', 'leadRoutes.js');
const bookingCtrl = read('backend', 'controllers', 'bookingController.js');
const model = read('backend', 'models', 'Booking.js');
const activity = read('backend', 'models', 'LeadActivity.js');
const page = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderLeads.jsx');

const start = ctrl.indexOf('const createBookingFromLead = async');
const handler = ctrl.slice(start, ctrl.indexOf('\n};', start));

check('route: POST /api/leads/:id/booking', () => {
    assert.ok(routes.includes("router.post('/:id/booking',   protect, createBookingFromLead);"));
});
check('only a partner who unlocked the lead, once per lead, with a valid price/date/time', () => {
    assert.ok(/providerCategory === 'sewak'\) \{\s*return res\.status\(403\)/.test(handler));
    assert.ok(/if \(!unlocked\) return res\.status\(403\)/.test(handler));
    assert.ok(/Booking\.findOne\(\{ leadId: lead\._id, providerId: req\.user\._id, status: \{ \$ne: 'cancelled' \} \}\)/.test(handler));
    assert.ok(/res\.status\(409\)/.test(handler));
    assert.ok(/amount < 1/.test(handler) && /bookingDate < todayIst/.test(handler) && /LEAD_BOOKING_TIME\.test/.test(handler));
});
check('the booking is a normal one: customer + partner, confirmed, cash after service, linked to the lead', () => {
    for (const f of ['userId: lead.customer,', 'providerId: req.user._id,', 'leadId: lead._id,', "status: 'confirmed',", "paymentMode: 'after',", 'totalAmount: amount,']) {
        assert.ok(handler.includes(f), f);
    }
    assert.ok(/leadId: \{ type: mongoose\.Schema\.Types\.ObjectId, ref: 'Lead', default: null, index: true \}/.test(model));
    assert.ok(activity.includes("'LEAD_BOOKED',"));
});
check('completing a lead booking charges no commission', () => {
    assert.ok(/const matchedRule = booking\.leadId\s*\? \{ rate: 0, source: 'LEAD', ruleName: 'Lead booking \(no commission\)' \}\s*: await CommissionRuleEngine\.selectRule\(/.test(bookingCtrl));
});
check('the partner Leads page offers Create Booking, then shows the booking', () => {
    assert.ok(page.includes('API.post(`/leads/${bookModal.lead._id}/booking`'));
    assert.ok(/\{lead\.myBooking \? \(/.test(page) && page.includes('to="/provider/bookings"'));
    assert.ok(/for \(const l of leads\) l\.myBooking = bookingByLead\.get\(String\(l\._id\)\) \|\| null;/.test(ctrl));
});

check('admin commission views show lead bookings as their own kind', () => {
    const analytics = read('backend', 'controllers', 'v2CommissionController.js');
    const adminPage = read('frontend', 'src', 'modules', 'admin', 'pages', 'AdminCommission.jsx');
    assert.ok(/const sourceCounts = \{[^}]*LEAD: 0 \};/.test(analytics) && /const sourceRevenue = \{[^}]*LEAD: 0 \};/.test(analytics));
    assert.ok(adminPage.includes("lead: 'Lead (No Commission)',") && adminPage.includes("lead: 'bg-violet-100 text-violet-700',"));
});

console.log(`\n${passed} lead-to-booking checks passed.`);
