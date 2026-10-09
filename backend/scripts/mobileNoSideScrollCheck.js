/**
 * In the iPhone app the partner home slid sideways and the right side was cut
 * off (New / Active, Emergency, the name): a decorative pulse or glow inside
 * a rounded box reached past the screen, and that WebKit does not always clip
 * animated children, so the whole page grew wider.
 *
 *   node scripts/mobileNoSideScrollCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const fe = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

check('no page scrolls sideways: html, body and #root clip horizontal overflow', () => {
    const css = fe('index.css');
    assert.ok(/html,\s*body,\s*#root \{\s*overflow-x: clip;\s*max-width: 100%;\s*\}/.test(css));
    // clip, not hidden: hidden would make the page its own scroll box (sticky
    // header and window scroll tracking would stop working)
    assert.ok(!/html,\s*body[^{]*\{[^}]*overflow-x: hidden/.test(css));
    // iOS before 16 has no `clip`: body's `hidden` (html left visible) goes to the window.
    assert.ok(/@supports not \(overflow-x: clip\) \{\s*body \{\s*overflow-x: hidden;\s*\}\s*\}/.test(css));
});
check('the Emergency pulse and the plan banner glow are clipped by their own box on iPhone too', () => {
    const dash = fe('modules', 'provider', 'pages', 'ProviderDashboard.jsx');
    assert.ok(/whitespace-nowrap transition-all duration-500 relative overflow-hidden isolate \$\{\s*isEmergencyActive/.test(dash));
    assert.ok(/<div className="relative isolate overflow-hidden rounded-\[1\.5rem\] bg-gradient-to-br from-emerald-600/.test(dash));
});

console.log(`\n${passed} mobile side-scroll checks passed.`);
