/**
 * The in-app language service: only listed languages, bounded input, product
 * terms kept as written, repeated phrases asked of Google once.
 *
 *   node scripts/translateCheck.js
 *
 * Runs the real controller with Google and the database stubbed.
 */
const assert = require('assert');
const axios = require('axios');
require('mongoose').set('bufferCommands', false);
process.env.GOOGLE_TRANSLATE_API_KEY = 'check_key';

const TranslationCache = require('../models/TranslationCache');
const { translate, protect, unprotect, decode, LANGUAGES } = require('../controllers/translateController');

let passed = 0;
const check = async (l, f) => { await f(); passed += 1; console.log(`  ok  ${l}`); };
const call = (body) => new Promise((resolve) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    translate({ body }, res);
});

// Google stub: "Hindi" for every string, remembers what it was asked and how.
const asked = [];
axios.post = async (url, payload, opts) => {
    asked.push({ url, payload, opts });
    return { data: { data: { translations: payload.q.map((q) => ({ translatedText: `HI(${q})` })) } } };
};
const stored = new Map();
TranslationCache.find = () => ({ select: () => ({ lean: async () => [] }) });
TranslationCache.bulkWrite = async (ops) => { ops.forEach((o) => stored.set(o.updateOne.filter.key, true)); };

(async () => {
    await check('only the listed languages are accepted', async () => {
        assert.ok(Object.keys(LANGUAGES).includes('hi'));
        assert.strictEqual((await call({ texts: ['Hi'], target: 'xx' })).code, 400);
        assert.strictEqual((await call({ texts: ['Hi'] })).code, 400);
    });

    await check('input is bounded and must be a list', async () => {
        assert.strictEqual((await call({ texts: [], target: 'hi' })).code, 400);
        assert.strictEqual((await call({ texts: 'Hi', target: 'hi' })).code, 400);
        assert.strictEqual((await call({ texts: ['a'.repeat(501)], target: 'hi' })).code, 400);
        assert.strictEqual((await call({ texts: new Array(101).fill('Hi'), target: 'hi' })).code, 400);
    });

    await check('product terms are protected and put back as written', async () => {
        const p = protect('New leads near you');
        assert.ok(p.includes('<span translate="no">leads</span>'));
        assert.strictEqual(unprotect(p), 'New leads near you');
        for (const term of ['Insta Work', 'Sewak', 'KYC', 'OTP', 'RozSewa', 'Live']) {
            assert.ok(protect(`Open ${term} now`).includes(`<span translate="no">${term}</span>`), term);
        }
        // words that merely contain a term are not touched
        assert.ok(!protect('Pinned panel').includes('<span'));
    });

    await check('text is escaped before it goes to Google, and entities come back', async () => {
        assert.strictEqual(protect('a < b & c'), 'a &lt; b &amp; c');
        assert.strictEqual(decode('You&#39;re &quot;in&quot; &amp; ready'), 'You\'re "in" & ready');
    });

    await check('the key travels in a header, never in the URL', async () => {
        asked.length = 0;
        const r = await call({ texts: ['Accept job'], target: 'hi' });
        assert.strictEqual(r.code, 200);
        assert.deepStrictEqual(r.body.translations, ['HI(Accept job)']);
        assert.ok(!asked[0].url.includes('check_key'));
        assert.strictEqual(asked[0].opts.headers['X-goog-api-key'], 'check_key');
        assert.strictEqual(asked[0].payload.format, 'html');
    });

    await check('a phrase seen before is not asked of Google again', async () => {
        asked.length = 0;
        const r = await call({ texts: ['Accept job', 'Accept job', 'Reject job'], target: 'hi' });
        assert.deepStrictEqual(r.body.translations, ['HI(Accept job)', 'HI(Accept job)', 'HI(Reject job)']);
        assert.strictEqual(asked.length, 1);
        assert.deepStrictEqual(asked[0].payload.q, ['Reject job']);
    });

    await check('blank strings are returned as they are', async () => {
        const r = await call({ texts: ['  ', 'Open'], target: 'hi' });
        assert.strictEqual(r.body.translations[0], '');
    });

    await check('common menu words use the fixed wording and never reach Google', async () => {
        asked.length = 0;
        const r = await call({ texts: ['Bookings', ' wallet ', 'View All'], target: 'hi' });
        assert.deepStrictEqual(r.body.translations, ['बुकिंग', 'वॉलेट', 'सभी देखें']);
        assert.strictEqual(asked.length, 0);
        // another language has no fixed list, so it still goes to Google
        const m = await call({ texts: ['Bookings'], target: 'mr' });
        assert.strictEqual(m.body.translations[0], 'HI(Bookings)');
    });

    await check('without a login, one address is limited, not blocked outright', async () => {
        const routes = require('../routes/translateRoutes');
        routes._hits.clear();
        const once = () => new Promise((resolve) => {
            const res = { code: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json() { resolve(this.code); } };
            routes.limiter({ ip: '9.9.9.9', headers: {} }, res, () => resolve(200));
        });
        let last = 200;
        for (let i = 0; i < 300; i++) last = await once();
        assert.strictEqual(last, 200);                 // the 300th is still fine
        assert.strictEqual(await once(), 429);         // the 301st is not
        routes._hits.clear();
    });

    await check('a Google failure is a clean 502, not a crash', async () => {
        axios.post = async () => { const e = new Error('blocked'); e.response = { data: { error: { message: 'blocked' } } }; throw e; };
        const r = await call({ texts: ['Fresh phrase never seen'], target: 'mr' });
        assert.strictEqual(r.code, 502);
    });

    console.log(`\n${passed} translation checks passed.`);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
