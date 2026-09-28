/**
 * Admin complaint: after sending one broadcast successfully ("41 of 41"),
 * sending a second one failed ("0 of 41" in the history, no error shown).
 *
 * notifyUser()'s duplicate-prevention key is
 *   `${userId}_${type}_${idKey}_${titleKey}`
 * where idKey falls back to the literal string 'default' when there's no
 * bookingId/leadId/data.id — which is always true for a broadcast, since a
 * broadcast has no natural per-event id. Two broadcasts to the same
 * audience with the same title within the 24h NotificationLog TTL
 * collapsed onto the identical key, so the second one's atomic dedup check
 * (notificationService.js) returned "already processed" for every
 * recipient — notifyUser returned null, and broadcastController counted
 * each null as a failure. No exception was thrown, so this looked like a
 * silent, unexplained failure rather than a bug with a trail.
 *
 *   node scripts/broadcastRepeatSendCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const controller = read('controllers/broadcastController.js');
const fn = controller.slice(controller.indexOf('const sendNotificationBroadcast'), controller.indexOf('// @desc    Broadcast a WhatsApp message'));

console.log('\nEach broadcast send gets its own dedup identity, not the shared "default"');

check('a fresh identifier is generated once per broadcast request', () => {
    assert.ok(/const broadcastNonce = Date\.now\(\)\.toString\(\)/.test(fn),
        'without this, idKey inside notifyUser always falls back to the literal "default"');
});

check('that identifier is passed as data.id to notifyUser for every recipient', () => {
    assert.ok(/data: \{ id: broadcastNonce \}/.test(fn),
        'notifyUser reads idKey from data.id when there is no bookingId — this is what breaks the collision with a previous, same-titled broadcast');
});

check('the nonce is generated once outside the loop, not per-recipient', () => {
    const nonceIdx = fn.indexOf('const broadcastNonce');
    const loopIdx = fn.indexOf('for (const person of audience)');
    assert.ok(nonceIdx !== -1 && loopIdx !== -1 && nonceIdx < loopIdx,
        'one nonce per broadcast send — every recipient of THIS broadcast should still share one event, just not collide with a DIFFERENT broadcast');
});

console.log(`\n${passed} broadcast-repeat-send checks passed.\n`);
