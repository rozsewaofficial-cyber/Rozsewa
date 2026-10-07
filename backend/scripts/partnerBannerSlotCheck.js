/**
 * The top carousel used to be wired to a merged `banners` list — free admin
 * promotional banners AND paid partner banners mixed together — so a paying
 * partner's banner could be pushed out of the top slot by a free admin one.
 * Customer complaint: "upper wale banner me bhee promotional banner show ho
 * raha hai" — fixed by giving partner banners sole priority.
 *
 * That then meant most locations (no active partner banner) showed a blank
 * slot, which read as its own bug ("banner show nhi ho raha hai"). Fixed by
 * falling back to admin banners — but "ye toh pura admin se aayega" (this
 * should come entirely from admin): the fallback itself must be admin-
 * editable (Banner model / AdminBanners.jsx), not another hardcoded array.
 * The hardcoded defaultBanners array only remains as the last resort if the
 * admin hasn't created a banner either.
 *
 * Then (2026-10-07) the owner set the split explicitly: the TOP carousel is
 * managed from /admin/banners (admin promotional banners) and the LOWER one,
 * above Bazaar Chats, from /admin/provider-banners (paid partner banners).
 * Each carousel has its own source, so neither can displace the other; the
 * top one still falls back to the hardcoded defaults so it is never empty.
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

console.log('\nTop carousel = admin banners, lower carousel = paid partner banners');

check('partner banners and admin banners are kept in separate state', () => {
    assert.ok(/const \[partnerBanners, setPartnerBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setPartnerBanners\(pBanners\)/.test(page));
    assert.ok(/const \[adminBanners, setAdminBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setAdminBanners\(aBanners\)/.test(page));
});

check('admin banners are fetched from the admin-managed endpoint, not hardcoded', () => {
    assert.ok(/API\.get\("\/public\/banners"\)/.test(page));
});

check('the top slot is admin banners, falling back to the hardcoded default only when there are none', () => {
    assert.ok(/const topBanners = adminBanners\.length > 0 \? adminBanners : defaultBanners;/.test(page));
    assert.ok(!/displayBanners/.test(page), 'no merged list that lets one source displace the other');
});

check('the top carousel reads topBanners (admin), never partner banners', () => {
    const firstIdx = page.indexOf('<PromoBannerCarousel');
    const firstTag = page.slice(firstIdx, page.indexOf('/>', firstIdx) + 2);
    assert.ok(/banners=\{topBanners\}/.test(firstTag));
});

check('the lower carousel (above Bazaar Chats) reads partnerBanners only', () => {
    const secondIdx = page.lastIndexOf('<PromoBannerCarousel');
    const secondTag = page.slice(secondIdx, page.indexOf('/>', secondIdx) + 2);
    assert.ok(/banners=\{partnerBanners\}/.test(secondTag));
    assert.ok(/onBannerSeen=\{handleBannerSeen\}/.test(secondTag), 'partner views are counted where partner banners show');
});

console.log(`\n${passed} partner-banner-slot checks passed.\n`);
