/**
 * A Sewak sees RozSewa's own (universal) banners only — never partners' paid
 * promotional banners — and cannot buy a promotional banner.
 *
 *   node scripts/sewakBannersCheck.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

let passed = 0;
const check = (l, f) => { f(); passed += 1; console.log(`  ok  ${l}`); };

const comp = read('frontend', 'src', 'modules', 'provider', 'components', 'SewakBanners.jsx');
const dash = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderDashboard.jsx');
const promo = read('frontend', 'src', 'modules', 'provider', 'pages', 'ProviderBannerPromotion.jsx');
const ctrl = read('backend', 'controllers', 'providerBannerController.js');

check("the Sewak dashboard shows RozSewa's banners, and only those", () => {
    assert.ok(/API\.get\("\/public\/banners"\)/.test(comp));
    assert.ok(!/provider-banners/.test(comp), 'partner promotional banners are never fetched');
    assert.ok(/\{user\?\.providerCategory === 'sewak' && <SewakBanners \/>\}/.test(dash));
});
check('banner taps do not send a Sewak to customer pages', () => {
    assert.ok(/ctaText: ""/.test(comp));
    assert.ok(/if \(\/\^https\?:\\\/\\\/\/i\.test\(link\)\) window\.open\(link, "_blank", "noopener"\);\s*else if \(link\.startsWith\("\/provider"\)\) navigate\(link\);/.test(comp));
});
check('no Promotions tile for a Sewak; the page explains instead of selling', () => {
    assert.ok(/if \(item\.title === "Promotions" \|\| item\.path === "\/provider\/banner-promotions"\) return user\?\.providerCategory !== 'sewak';/.test(dash));
    assert.ok(/if \(user\?\.providerCategory === 'sewak'\) \{\s*return \(\s*<div[^>]*data-sewak-no-promotions/.test(promo));
});
check('the server refuses a Sewak buying a promotional banner (order, wallet, after payment)', () => {
    assert.ok(/if \(req\.user\?\.providerCategory === 'sewak'\) throw Banners\.httpError\(403,/.test(ctrl));
    assert.ok((ctrl.match(/requirePartner\(req\);/g) || []).length >= 3);
});

console.log(`\n${passed} sewak banner checks passed.`);
