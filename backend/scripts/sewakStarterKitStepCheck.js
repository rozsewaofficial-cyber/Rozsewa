/**
 * After registration (KYC approved, not live yet) a Sewak is told to complete
 * their Starter Kit, but the screen only linked to the kit store once a
 * trainer had found items missing — a new Sewak had no way to buy the kit.
 * The activation screen now always shows the Starter Kit step with the
 * latest order's state, and a Buy Starter Kit / View Kit Order button.
 *
 *   node scripts/sewakStarterKitStepCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dash = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx'), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('the latest kit order (cancelled ones ignored) is loaded for a Sewak', () => {
    assert.ok(/API\.get\("\/kit-store\/orders", \{ params: \{ limit: 5 \} \}\)/.test(dash));
    assert.ok(/\.find\(o => o\.status !== 'cancelled'\) \|\| null\)/.test(dash));
    assert.ok(/fetchTrainingStatus\(\);\s*fetchLatestKitOrder\(\);/.test(dash));
});
check('activation screen: Starter Kit step shown from the start, with the order state', () => {
    assert.ok(/!\(trainingStatus\?\.missingItems\?\.length > 0\) && latestKitOrder !== undefined && \(/.test(dash));
    assert.ok(/Not ordered yet — buy your starter kit to start training/.test(dash));
    for (const s of ['Order placed — waiting for confirmation', 'Order confirmed', 'On the way to you', 'Delivered — bring it to your training centre']) assert.ok(dash.includes(s), s);
});
check('a button to the kit store is always there (Buy Starter Kit / View Kit Order / Order Missing Items)', () => {
    assert.ok(/\{latestKitOrder \? "View Kit Order" : "Buy Starter Kit"\}/.test(dash));
    // Order Missing Items only while nothing is ordered — not an invitation to buy twice.
    assert.ok(/trainingStatus\?\.missingItems\?\.length > 0 && !latestKitOrder \? \(\s*<Link to="\/provider\/kit-store"/.test(dash));
});
check('items the trainer lists as missing show the order already placed', () => {
    assert.ok(/\{latestKitOrder && \(\s*<p[^>]*data-kit-ordered=\{latestKitOrder\.status\}>/.test(dash));
});

console.log(`\n${passed} sewak starter kit step checks passed.`);
