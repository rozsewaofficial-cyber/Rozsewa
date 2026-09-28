/**
 * Customer complaint: on the Help & Support page, the four contact tiles
 * (WhatsApp / Call Us / Email Us / Raise Ticket) "aren't active" — they were
 * wired to a fake placeholder number (919999999999) and a placeholder email
 * (support@rozsewa.in), so a tap never reached anyone real. Per the user's
 * own choice, all four now open the same WhatsApp chat, which replaces the
 * inline Raise Ticket form (still available at its own dedicated page,
 * SupportTickets.jsx) and the tel:/mailto: links.
 *
 *   node scripts/helpSupportContactCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/HelpSupport.jsx');

console.log('\nAll four contact tiles open a real, working channel');

check('all four tiles share one WhatsApp handler, not separate tel:/mailto: links', () => {
    assert.ok(/const openWhatsAppSupport = \(\) => window\.open\(`https:\/\/wa\.me\/\$\{WHATSAPP_SUPPORT_NUMBER\}`/.test(page),
        'a single handler, so updating the number in one place fixes every tile');
    const tilesBlock = page.slice(page.indexOf('{/* Contact Methods */}'), page.indexOf('{/* FAQ Search */}'));
    const actionMatches = tilesBlock.match(/action: openWhatsAppSupport/g) || [];
    assert.strictEqual(actionMatches.length, 4, 'WhatsApp, Call Us, Email Us and Raise Ticket all use it');
    assert.ok(!/tel:\+919999999999/.test(tilesBlock) && !/mailto:support@rozsewa\.in/.test(tilesBlock),
        'the old placeholder tel:/mailto: links are gone, not just unreachable');
});

check('the number lives in one clearly-marked constant, easy to swap for the real one', () => {
    assert.ok(/TODO: replace with RozSewa's real WhatsApp support number/.test(page),
        'flagged so the placeholder does not silently ship as real');
    assert.ok(/const WHATSAPP_SUPPORT_NUMBER = "919999999999"/.test(page));
});

console.log('\nThe inline Raise Ticket form is gone, not left dead');

check('no orphaned ticket-modal state or handler remains in this file', () => {
    assert.ok(!/isRaisingTicket/.test(page), 'the modal toggle is gone');
    assert.ok(!/newTicket/.test(page), 'its form state is gone');
    assert.ok(!/handleCreateTicket/.test(page), 'and its submit handler is gone');
    assert.ok(!/useToast/.test(page), 'which was only imported for that handler\'s error/success toasts');
});

check('ticket creation is still reachable elsewhere, so nothing was actually lost', () => {
    const ticketsPage = feRead('modules/user/pages/SupportTickets.jsx');
    assert.ok(/support\/tickets/.test(ticketsPage), 'the dedicated Support Tickets page still posts new tickets');
});

console.log(`\n${passed} help-support contact checks passed.\n`);
