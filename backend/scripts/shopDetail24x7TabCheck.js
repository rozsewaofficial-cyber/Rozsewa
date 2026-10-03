/**
 * Customer report: "services add krne ke time 24/7 pe click krne ke baad
 * post your requirement show ho rha hai" — on a shop's detail page, clicking
 * the "24x7 Emergency" services tab fell back to "No specific services
 * listed" + "Post Your Requirement" for almost every shop, because that
 * filter required each individual service to carry its own '24x7' tag — an
 * optional checkbox providers rarely set, separate from the provider's
 * overall 24/7-availability toggle (Provider.is24x7).
 *
 * Fixed: when the provider's overall availability is 24/7, the "24x7
 * Emergency" tab now shows every one of its services (they're all available
 * round the clock) instead of requiring the rarely-used per-service tag too.
 * A shop that is NOT 24/7-available, with no service individually tagged
 * '24x7' either, still correctly falls back to "Post Your Requirement" —
 * this isn't a blanket removal of that fallback.
 *
 *   node scripts/shopDetail24x7TabCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');
const beRead = (rel) => fs.readFileSync(path.join(__dirname, '..', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/ShopDetail.jsx');
const homeController = beRead('controllers/homeController.js');

console.log('\nThe public provider endpoint exposes is24x7, so the frontend can read it');

check('getPublicProviderById selects is24x7', () => {
    const fn = homeController.slice(homeController.indexOf('getPublicProviderById'), homeController.indexOf('getPublicProviderById') + 600);
    assert.ok(/\.select\('[^']*\bis24x7\b[^']*'\)/.test(fn),
        'without this, provider.is24x7 is always undefined on the client no matter what the DB says');
});

console.log('\nShopDetail.jsx treats a 24/7-available provider as offering every service round the clock');

check('the provider object carries is24x7 through from the API response', () => {
    assert.ok(/is24x7: found\.is24x7 \|\| found\.isEmergencyEnabled \|\| false/.test(page));
});

check('the 24x7 tab filter is bypassed (shows everything) when the provider is 24/7-available', () => {
    const idx = page.indexOf('Individual Services Section');
    const block = page.slice(idx, idx + 800);
    assert.ok(/serviceFilter === '24x7' && provider\?\.is24x7\) return true/.test(block),
        'a 24/7-available provider should not need every individual service separately tagged 24x7 too');
});

check('a shop that is not 24/7-available and has no 24x7-tagged service still falls back to Post Your Requirement', () => {
    const idx = page.indexOf('Individual Services Section');
    const block = page.slice(idx, idx + 2000);
    assert.ok(/No specific services listed\./.test(block));
    assert.ok(/Post Your Requirement/.test(block));
});

console.log(`\n${passed} shop-detail-24x7-tab checks passed.\n`);
