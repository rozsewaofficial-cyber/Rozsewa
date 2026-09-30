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
 * Net effect: partner banners always outrank admin banners (a free banner
 * never displaces a paid one), but the slot is never empty.
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

console.log('\nPartner banners outrank admin banners, which outrank the hardcoded default');

check('partner banners and admin banners are kept in separate state', () => {
    assert.ok(/const \[partnerBanners, setPartnerBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setPartnerBanners\(pBanners\)/.test(page));
    assert.ok(/const \[adminBanners, setAdminBanners\] = useState\(\[\]\)/.test(page));
    assert.ok(/setAdminBanners\(aBanners\)/.test(page));
});

check('admin banners are fetched from the admin-managed endpoint, not hardcoded', () => {
    assert.ok(/API\.get\("\/public\/banners"\)/.test(page));
});

check('the fallback cascade is partner → admin → hardcoded default, in that order', () => {
    assert.ok(/const displayBanners = partnerBanners\.length > 0\s*\n?\s*\? partnerBanners\s*\n?\s*: \(adminBanners\.length > 0 \? adminBanners : defaultBanners\)/.test(page),
        'a free admin banner must never be able to outrank a paid partner banner, but the slot must never be fully empty either');
});

check('the top carousel reads displayBanners, not partnerBanners or adminBanners directly', () => {
    const firstIdx = page.indexOf('<PromoBannerCarousel');
    const firstTag = page.slice(firstIdx, page.indexOf('/>', firstIdx) + 2);
    assert.ok(/banners=\{displayBanners\}/.test(firstTag));
});

check('the second carousel (above Bazaar Chats) also reads displayBanners', () => {
    const secondIdx = page.lastIndexOf('<PromoBannerCarousel');
    const secondTag = page.slice(secondIdx, page.indexOf('/>', secondIdx) + 2);
    assert.ok(/banners=\{displayBanners\}/.test(secondTag));
});

console.log(`\n${passed} partner-banner-slot checks passed.\n`);
