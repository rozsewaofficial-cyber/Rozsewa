/**
 * Customer request: the promotional banner carousel (Udgam Finance, RozSewa
 * Bazaar, etc.) that already shows at the top of Home should also repeat
 * above the Bazaar Chats section further down the page.
 *
 * The original inline carousel used a single bannerScrollRef/currentBanner
 * pair on the page component — rendering it twice as-is would have two
 * DOM nodes fighting over one ref (only the second render wins) and one
 * shared autoplay/pagination-dot index driving both. Extracted it into its
 * own PromoBannerCarousel component that owns its scroll ref and current-
 * index state internally, so two independent instances can coexist.
 *
 *   node scripts/promoBannerRepeatCheck.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const feRead = (rel) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)), 'utf8');
const feExists = (rel) => fs.existsSync(
    path.join(__dirname, '..', '..', 'frontend', 'src', rel.split('/').join(path.sep)));

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ok  ${label}`); };

console.log('\nThe banner carousel is self-contained, so it can render more than once safely');

check('PromoBannerCarousel owns its own scroll ref and current-index state', () => {
    assert.ok(feExists('modules/user/components/PromoBannerCarousel.jsx'));
    const comp = feRead('modules/user/components/PromoBannerCarousel.jsx');
    assert.ok(/const \[currentBanner, setCurrentBanner\] = useState\(0\)/.test(comp));
    assert.ok(/const scrollRef = useRef\(null\)/.test(comp),
        'a ref local to this component instance, not shared with a sibling instance');
});

console.log('\nHome renders it twice: once at the top, once above Bazaar Chats');

check('Index.jsx no longer keeps its own duplicate banner scroll state', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    assert.ok(!/const \[currentBanner, setCurrentBanner\] = useState\(0\)/.test(page),
        'that state now lives inside PromoBannerCarousel, not the page');
    assert.ok(!/const bannerScrollRef = useRef\(null\)/.test(page));
});

check('two independent <PromoBannerCarousel> instances are rendered', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const matches = page.match(/<PromoBannerCarousel banners=\{banners\} defaultBanners=\{defaultBanners\} onBannerClick=\{handleBannerClick\} \/>/g) || [];
    assert.strictEqual(matches.length, 2, 'one at the top, one above Bazaar Chats');
});

check('the second instance sits before the Bazaar Chats block, not after', () => {
    const page = feRead('modules/user/pages/Index.jsx');
    const secondInstanceIdx = page.lastIndexOf('<PromoBannerCarousel');
    const bazaarChatsIdx = page.indexOf('bazaarChats.length > 0');
    assert.ok(secondInstanceIdx !== -1 && bazaarChatsIdx !== -1 && secondInstanceIdx < bazaarChatsIdx);
});

console.log(`\n${passed} promo-banner-repeat checks passed.\n`);
