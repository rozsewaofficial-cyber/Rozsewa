/**
 * Follow-up to promoBannerRepeatCheck.js: the top carousel used to be wired
 * to a merged `banners` list — free admin promotional banners AND paid
 * partner banners mixed together — so a paying partner's banner could be
 * pushed out of the top slot by a free admin one. Customer complaint: "upper
 * wale banner me bhee promotional banner show ho raha hai" — the top slot
 * should show only the paid partner banners, same as the repeat slot above
 * Bazaar Chats.
 *
 *   node scripts/partnerBannerSlotCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

const page = feRead('modules/user/pages/Index.jsx');

console.log('\nBoth carousel slots show only the paid partner banners');

check('there is no separate merged/admin-promo banner list left to leak into either slot', () => {
    assert.ok(!/const \[banners, setBanners\]/.test(page),
        'the old mixed admin+partner state should be gone entirely, not just unused');
    assert.ok(!/apiBanners/.test(page), 'the admin-promo mapping that fed the mix is gone too');
    assert.ok(!/public\/banners/.test(page), 'and the fetch that pulled admin promo banners in');
});

check('partner banners are kept in their own state', () => {
    assert.ok(/const \[partnerBanners, setPartnerBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setPartnerBanners\(pBanners\)/.test(page));
});

check('the top carousel reads partnerBanners, not a mixed list', () => {
    const firstIdx = page.indexOf('<PromoBannerCarousel');
    const firstTag = page.slice(firstIdx, page.indexOf('/>', firstIdx) + 2);
    assert.ok(/banners=\{partnerBanners\}/.test(firstTag),
        'a free admin promo banner must not be able to occupy the top, paid-visibility slot');
});

check('the second carousel (above Bazaar Chats) also reads partnerBanners', () => {
    const secondIdx = page.lastIndexOf('<PromoBannerCarousel');
    const secondTag = page.slice(secondIdx, page.indexOf('/>', secondIdx) + 2);
    assert.ok(/banners=\{partnerBanners\}/.test(secondTag));
});

console.log(`\n${passed} partner-banner-slot checks passed.\n`);
