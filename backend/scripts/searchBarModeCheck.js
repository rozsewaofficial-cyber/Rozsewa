/**
 * Customer complaint: search "properly nahi kaam kar raha" — reproduced by
 * switching to Sewak mode on the home screen and searching "Vehicle". The
 * suggestion dropdown offered "Vehicle Repair & Service", a partner-only
 * category (visibleTo: 'partner'). Picking it landed on an empty "Sewak
 * Categories" grid — a dead end that looks exactly like broken search,
 * because SearchBar's suggestion source had no mode filter while the rest
 * of the app (CategoryGrid, ShopListing) already scopes categories to the
 * active Local Expert / Sewak toggle.
 *
 * (SearchBar's suggestion source later moved from /public/categories to
 * /public/search-suggestions, which also covers subcategories/services —
 * see searchSubcategoryServiceCheck.js. The mode-scoping this check pins
 * still applies to that new endpoint.)
 *
 *   node scripts/searchBarModeCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const bar = feRead('modules/user/components/SearchBar.jsx');

console.log('\nSearch suggestions are scoped to the active mode, like the rest of the app');

check('SearchBar accepts a mode prop and sends it to the suggestions request', () => {
    assert.ok(/const SearchBar = \(\{[^}]*\bmode\b/.test(bar), 'mode is a prop, not hardcoded');
    assert.ok(/API\.get\('\/public\/search-suggestions', \{ params: \{ q, \.\.\.\(mode \? \{ mode \} : \{\}\) \} \}\)/.test(bar),
        'sent only when known, so a caller that has not been updated still gets every match');
});

check('the fetch re-runs when mode changes, so toggling Local Expert/Sewak refreshes suggestions', () => {
    assert.ok(/\}, \[query, mode\]\);/.test(bar), 'the effect depends on mode, not just on the typed query');
});

console.log('\nBoth pages that render SearchBar tell it which mode is active');

check('the home page passes its Local Expert / Sewak toggle state', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    assert.ok(/<SearchBar mode=\{serviceMode\}/.test(page));
});

check('the listing page passes the mode read from the URL', () => {
    const page = feRead('modules/user/pages/ShopListing.jsx');
    assert.ok(/<SearchBar mode=\{mode\}/.test(page));
});

console.log(`\n${passed} search-bar mode checks passed.\n`);
