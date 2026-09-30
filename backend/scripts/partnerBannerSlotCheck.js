/**
 * Follow-up to promoBannerRepeatCheck.js: the second carousel (above Bazaar
 * Chats) was wired to the same merged `banners` list as the top one — admin
 * promos AND partner-promoted banners mixed together. The customer wants
 * that second slot to show ONLY the paid partner banners (the 1/7/30-day
 * plans from the ProviderBanner module), not a repeat of "all banner".
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

console.log('\nThe two carousels show different things, not the same merged list twice');

check('partner banners are kept in their own state, separate from the merged carousel', () => {
    assert.ok(/const \[partnerBanners, setPartnerBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setPartnerBanners\(pBanners\)/.test(page),
        'pBanners is the provider-banners-only list, before it gets merged with apiBanners');
});

check('the top carousel still shows the full mixed list', () => {
    const firstIdx = page.indexOf('<PromoBannerCarousel');
    const firstTag = page.slice(firstIdx, page.indexOf('/>', firstIdx) + 2);
    assert.ok(/banners=\{banners\}/.test(firstTag));
});

check('the second carousel (above Bazaar Chats) only gets partnerBanners', () => {
    const secondIdx = page.lastIndexOf('<PromoBannerCarousel');
    const secondTag = page.slice(secondIdx, page.indexOf('/>', secondIdx) + 2);
    assert.ok(/banners=\{partnerBanners\}/.test(secondTag),
        'it must not read the same `banners` prop as the top carousel, or it just repeats admin promos too');
});

console.log(`\n${passed} partner-banner-slot checks passed.\n`);
