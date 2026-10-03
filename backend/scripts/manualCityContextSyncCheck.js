/**
 * Customer complaint: a Bihar-based provider showed up while browsing
 * Indore. Reproduced directly against the real API: passing neither
 * `lat`/`lng` nor `city` to /public/providers returns every verified
 * provider nationwide (getPublicProviders only filters by location when one
 * of those is present) — exactly 3 results including the Bihar provider,
 * vs. 2 correctly-scoped results when city=Indore is actually sent.
 *
 * The city WAS set correctly — the header pill showed "Indore" — but only
 * in sessionStorage. AuthContext's userCity state is seeded from
 * sessionStorage with a lazy useState initializer, which only runs once at
 * mount; LocationGate's manual-entry handlers (as opposed to the live GPS
 * detectLocation() flow) wrote straight to sessionStorage and never called
 * the context's setUserCity, so userCity — the value ShopListing.jsx's
 * fetchProviders actually reads — stayed empty for the rest of the session.
 * Every provider search silently dropped its location filter entirely.
 *
 *   node scripts/manualCityContextSyncCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const gate = feRead('components/LocationGate.jsx');

console.log('\nManually entering a city updates the AuthContext state that searches actually read, not just sessionStorage');

check('LocationGate pulls setUserCity out of useAuth()', () => {
    assert.ok(/const \{ (?:user, )?userLocation, detectLocation, setUserCity \} = useAuth\(\)/.test(gate));
});

check('picking a Nominatim suggestion calls setUserCity, not only sessionStorage', () => {
    const fn = gate.slice(gate.indexOf('const handleSelectSuggestion'), gate.indexOf('const handleSkip'));
    assert.ok(/sessionStorage\.setItem\("rozsewa_user_city"/.test(fn), 'sessionStorage is still written, for reload persistence');
    assert.ok(/setUserCity\(cityName\)/.test(fn),
        'without this, userCity in AuthContext never updates, since its useState initializer only reads sessionStorage once at mount');
});

check('a suggestion\'s full address is trimmed to just the city before being used as a filter', () => {
    const fn = gate.slice(gate.indexOf('const handleSelectSuggestion'), gate.indexOf('const handleSkip'));
    assert.ok(/suggestion\.description\.split\(","\)\[0\]\.trim\(\)/.test(fn),
        'the backend matches the plain city field — "Indore, Indore District, Madhya Pradesh, India" would never match "Indore"');
});

check('typing a city and pressing Enter/submit also calls setUserCity', () => {
    const fn = gate.slice(gate.indexOf('const handleManualSubmit'), gate.indexOf('const performDetection'));
    assert.ok(/setUserCity\(cityName\)/.test(fn));
});

console.log(`\n${passed} manual-city-context-sync checks passed.\n`);
