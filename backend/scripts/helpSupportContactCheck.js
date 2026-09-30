/**
 * Customer complaint: on the Help & Support page, the four contact tiles
 * (WhatsApp / Call Us / Email Us / Raise Ticket) "aren't active" — they were
 * wired to a fake placeholder number (919999999999) and a placeholder email
 * (support@rozsewa.in), so a tap never reached anyone real. Per the user's
 * choice, WhatsApp/Call Us/Raise Ticket all open the same real WhatsApp
 * chat (replacing the inline Raise Ticket form — still available at its own
 * dedicated page, SupportTickets.jsx — and the old tel: link). Email Us was
 * later given its own real mailto:, once the user supplied a real address.
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

check('WhatsApp, Call Us and Raise Ticket share one real WhatsApp handler', () => {
    assert.ok(/const openWhatsAppSupport = \(\) => window\.open\(`https:\/\/wa\.me\/\$\{WHATSAPP_SUPPORT_NUMBER\}`/.test(page),
        'a single handler, so updating the number in one place fixes every tile that uses it');
    const tilesBlock = page.slice(page.indexOf('{/* Contact Methods */}'), page.indexOf('{/* FAQ Search */}'));
    const actionMatches = tilesBlock.match(/action: openWhatsAppSupport/g) || [];
    assert.strictEqual(actionMatches.length, 3, 'WhatsApp, Call Us and Raise Ticket — Email Us has its own real mailto: now');
    assert.ok(!/tel:\+919999999999/.test(tilesBlock),
        'the old placeholder tel: link is gone, not just unreachable');
});

check('the WhatsApp number is real, not the old placeholder', () => {
    assert.ok(/const WHATSAPP_SUPPORT_NUMBER = "919122323770"/.test(page));
    assert.ok(!/919999999999/.test(page), 'the placeholder must not linger anywhere in the file');
});

check('Email Us opens a real mailto:, not WhatsApp', () => {
    const tilesBlock = page.slice(page.indexOf('{/* Contact Methods */}'), page.indexOf('{/* FAQ Search */}'));
    assert.ok(/action: openSupportEmail/.test(tilesBlock));
    assert.ok(/const openSupportEmail = \(\) => window\.location\.href = `mailto:\$\{SUPPORT_EMAIL\}`/.test(page));
    assert.ok(/const SUPPORT_EMAIL = "support@rozsewa\.com"/.test(page));
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
