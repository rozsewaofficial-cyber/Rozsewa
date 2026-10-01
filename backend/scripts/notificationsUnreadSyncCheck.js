/**
 * Found during end-to-end browser testing (not the original customer
 * report): after marking all notifications as read or clearing them,
 * Notifications.jsx's own "N unread messages" text and its Mark Read button
 * stayed stale (still showed the old count, button kept showing), and
 * TopNav's bell badge elsewhere in the app didn't update either, since
 * nothing told it to refetch — it only reacts to a 'NEW_NOTIFICATION' event
 * (an increment) or the page's pathname changing.
 *
 * Fixed by having both actions set the local unreadCount to 0 and dispatch
 * a 'NOTIFICATIONS_UPDATED' event; TopNav listens for it and refetches the
 * real count.
 *
 *   node scripts/notificationsUnreadSyncCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Notifications.jsx');
const topNav = feRead('modules/user/components/TopNav.jsx');

console.log('\nMarking read / clearing updates the local unread state, not just the server');

check('handleMarkAllAsRead zeroes unreadCount and announces the change', () => {
    const fn = page.slice(page.indexOf('const handleMarkAllAsRead'), page.indexOf('const handleClearAll'));
    assert.ok(/setUnreadCount\(0\)/.test(fn));
    assert.ok(/window\.dispatchEvent\(new Event\('NOTIFICATIONS_UPDATED'\)\)/.test(fn));
});

check('handleClearAll zeroes unreadCount and announces the change too', () => {
    const fn = page.slice(page.indexOf('const handleClearAll'), page.indexOf('const handleAcceptProposedSchedule') > -1 ? page.indexOf('const handleAcceptProposedSchedule') : page.length);
    assert.ok(/setUnreadCount\(0\)/.test(fn));
    assert.ok(/window\.dispatchEvent\(new Event\('NOTIFICATIONS_UPDATED'\)\)/.test(fn));
});

console.log("\nTopNav's bell badge refetches on that announcement, not just on focus/new-notification");

check("TopNav listens for NOTIFICATIONS_UPDATED and refetches the real count", () => {
    assert.ok(/window\.addEventListener\('NOTIFICATIONS_UPDATED', fetchUnread\)/.test(topNav),
        'without this, the badge stays stale until the next window focus or route change while the user is still on the page that just changed it');
    assert.ok(/window\.removeEventListener\('NOTIFICATIONS_UPDATED', fetchUnread\)/.test(topNav),
        'the listener must be cleaned up like the others in this effect');
});

console.log(`\n${passed} notifications-unread-sync checks passed.\n`);
