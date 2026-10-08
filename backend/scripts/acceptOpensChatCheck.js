/**
 * Accepting opens that booking's chat — only after the server confirmed it,
 * once, and the chat is the booking's own (messages are kept per booking).
 *
 *   node scripts/acceptOpensChatCheck.js
 *
 * Reads the code paths; the flows were run in the browser (customer accepts
 * an offer on Live Tracking and in My Bookings, partner accepts from the New
 * Request popup; a refused accept opens nothing).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };
const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');
const after = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i); return i >= 0 && j > i; };

check('Live Tracking: accept -> confirmed -> chat opens; refused accept opens nothing; one tap at a time', () => {
    const s = read('modules', 'user', 'pages', 'LiveTracking.jsx');
    assert.ok(after(s, 'counterDecision: decision,', 'if (decision === "accept") { setChatBookingId(acceptedId); setIsChatOpen(true); }'), 'opened after the request');
    const fn = s.slice(s.indexOf('const handleCounterDecision'), s.indexOf('} finally {', s.indexOf('const handleCounterDecision')));
    const catchBlock = fn.slice(fn.indexOf('} catch (err) {'));
    assert.ok(!/setIsChatOpen\(true\)/.test(catchBlock), 'not on failure');
    assert.ok(/if \(!bookingDetails \|\| deciding\) return;/.test(s));
    assert.ok(/disabled=\{counterTimer <= 0 \|\| deciding\}/.test(s));
    assert.ok(/bookingId=\{chatBookingId \|\| bookingDetails\?\._id/.test(s), "the accepted booking's own chat");
    assert.ok(/const handleAcceptSchedule = async \(\) => \{\s*if \(!bookingDetails \|\| deciding\) return;/.test(s), 'new time: one tap at a time');
});

check('My Bookings: accept -> chat for that booking, details sheet stays shut', () => {
    const s = read('modules', 'user', 'pages', 'ServiceHistory.jsx');
    assert.ok(after(s, "counterDecision: 'accept' });", 'await openChatFor(id);'));
    assert.ok(/if \(acceptingId\) return;/.test(s));
    assert.ok(/bookingId=\{\(chatBooking \|\| selectedBooking\)\?\.id\}/.test(s));
});

check('Partner: accepting a request opens the chat with that customer', () => {
    const list = read('modules', 'provider', 'components', 'RecentBookingsList.jsx');
    assert.ok(/if \(action === 'accept' && \(granted \|\| newStatus\) === 'confirmed'\) setActiveChatBookingId\(id\);/.test(list));
    assert.ok(/window\.addEventListener\('OPEN_BOOKING_CHAT', open\)/.test(list));
    const modal = read('modules', 'provider', 'components', 'IncomingRequestModal.jsx');
    assert.ok(/if \(acceptingRef\.current\) return;/.test(modal));
    assert.ok(/onAction\('accepted', \{ bookingId: request\.bookingId, openChat:/.test(modal));
    const alarm = read('components', 'GlobalAlarm.jsx');
    assert.ok(/navigate\(`\/provider\/bookings\?chat=\$\{info\.bookingId\}`\)/.test(alarm), 'off the dashboard, the Bookings page opens it');
});

console.log(`\n${passed} accept-opens-chat checks passed.`);
