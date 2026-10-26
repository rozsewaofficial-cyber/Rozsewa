const crypto = require('crypto');
const axios = require('axios');
const TranslationCache = require('../models/TranslationCache');

// Languages the app offers. Anything else is refused rather than passed on
// to Google, so the endpoint can't be used as a general translation service.
const LANGUAGES = {
    hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', bn: 'Bengali',
    ta: 'Tamil', te: 'Telugu', kn: 'Kannada', pa: 'Punjabi'
};

const MAX_TEXTS = 100;          // strings per request
const MAX_LENGTH = 500;         // characters per string
const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';

// Recently used phrases, so a busy screen does not hit the database each time.
const memory = new Map();
const MEMORY_LIMIT = 5000;

// Bump when the way text is prepared changes, so older cached answers (made
// without the protected terms below) are not served any more.
const CACHE_VERSION = 'v4';

// One- and two-word labels (menus, tabs, buttons) have no sentence around them
// for Google to go by, and it picks odd words ("Bookings" came back as "of
// booking"). The common ones are fixed here, in the form Indian apps use.
const OVERRIDES = {
    hi: {
        home: 'होम', services: 'सेवाएँ', bookings: 'बुकिंग', favorites: 'पसंदीदा', profile: 'प्रोफ़ाइल',
        wallet: 'वॉलेट', account: 'खाता', notifications: 'सूचनाएँ', login: 'लॉगिन', logout: 'लॉगआउट',
        'sign up': 'साइन अप', settings: 'सेटिंग्स', support: 'सहायता', accept: 'स्वीकार करें', reject: 'अस्वीकार करें',
        new: 'नया', active: 'सक्रिय', completed: 'पूर्ण', rejected: 'अस्वीकृत', cancelled: 'रद्द', online: 'ऑनलाइन', offline: 'ऑफ़लाइन',
        'view all': 'सभी देखें', 'local expert': 'लोकल एक्सपर्ट'
    }
};
const overrideFor = (lang, text) => OVERRIDES[lang]?.[text.trim().toLowerCase()];

const keyOf = (lang, text) => crypto.createHash('sha1').update(`${CACHE_VERSION}\u0000${lang}\u0000${text}`).digest('hex');

// Words that are this product's own terms. Left to itself Google turns
// "leads" into "clues" and "Sewak" into a dictionary word, so these are kept
// exactly as written and the rest of the sentence is translated around them.
const PROTECTED = /\b(RozSewa|Sewaks?|Insta Work|Leads?|Live|KYC|OTP|GPS|PIN|UPI|Razorpay|Aadhaar|PAN|GST|IFSC|SOS|WhatsApp)\b/gi;

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const protect = (text) => escapeHtml(text).replace(PROTECTED, (m) => `<span translate="no">${m}</span>`);
const unprotect = (html) => String(html).replace(/<\/?span[^>]*>/gi, '');

const remember = (key, value) => {
    if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value);
    memory.set(key, value);
};

/** Google returns HTML entities (&#39;) even for plain text; turn them back. */
const decode = (s) => String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const askGoogle = async (texts, lang) => {
    const { data } = await axios.post(
        GOOGLE_URL,
        { q: texts.map(protect), source: 'en', target: lang, format: 'html' },
        // Key in a header, not the URL, so it never lands in a log line.
        { headers: { 'X-goog-api-key': process.env.GOOGLE_TRANSLATE_API_KEY }, timeout: 8000 }
    );
    return (data?.data?.translations || []).map(t => decode(unprotect(t.translatedText)));
};

// @desc    Translate short UI strings from English
// @route   POST /api/translate   { texts: string[], target: 'hi' }
// @access  Public (rate limited per address)
const translate = async (req, res) => {
    try {
        const { texts, target } = req.body || {};
        if (!LANGUAGES[target]) return res.status(400).json({ message: 'Unsupported language.' });
        if (!Array.isArray(texts) || texts.length === 0) return res.status(400).json({ message: 'texts must be a non-empty array.' });
        if (texts.length > MAX_TEXTS) return res.status(400).json({ message: `At most ${MAX_TEXTS} texts per request.` });

        const clean = texts.map(t => (typeof t === 'string' ? t.trim() : ''));
        if (clean.some(t => t.length > MAX_LENGTH)) return res.status(400).json({ message: `Each text must be ${MAX_LENGTH} characters or fewer.` });

        const out = new Array(clean.length).fill(null);
        const missing = new Map(); // text -> indexes still to fill

        // 1. memory, 2. database
        const unseen = [];
        clean.forEach((t, i) => {
            if (!t) { out[i] = ''; return; }
            const fixed = overrideFor(target, t);
            if (fixed) { out[i] = fixed; return; }
            const hit = memory.get(keyOf(target, t));
            if (hit !== undefined) { out[i] = hit; return; }
            if (!missing.has(t)) { missing.set(t, []); unseen.push(t); }
            missing.get(t).push(i);
        });

        if (unseen.length) {
            const stored = await TranslationCache.find({ key: { $in: unseen.map(t => keyOf(target, t)) } }).select('key text').lean();
            const byKey = new Map(stored.map(s => [s.key, s.text]));
            for (const t of [...unseen]) {
                const v = byKey.get(keyOf(target, t));
                if (v !== undefined) {
                    remember(keyOf(target, t), v);
                    missing.get(t).forEach(i => { out[i] = v; });
                    missing.delete(t);
                }
            }
        }

        // 3. Google, for what has never been translated
        const toAsk = [...missing.keys()];
        if (toAsk.length) {
            if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
                return res.status(503).json({ message: 'Translation is not configured.' });
            }
            let translated;
            try {
                translated = await askGoogle(toAsk, target);
            } catch (err) {
                console.warn('[translate] Google request failed:', err.response?.data?.error?.message || err.message);
                return res.status(502).json({ message: 'Translation is unavailable right now.' });
            }
            if (translated.length !== toAsk.length) return res.status(502).json({ message: 'Translation is unavailable right now.' });

            const docs = [];
            toAsk.forEach((t, n) => {
                const v = translated[n] || t;
                remember(keyOf(target, t), v);
                missing.get(t).forEach(i => { out[i] = v; });
                docs.push({ updateOne: { filter: { key: keyOf(target, t) }, update: { $setOnInsert: { key: keyOf(target, t), lang: target, source: t, text: v } }, upsert: true } });
            });
            try { await TranslationCache.bulkWrite(docs, { ordered: false }); } catch (e) { /* the cache is an optimisation */ }
        }

        res.json({ target, translations: out });
    } catch (err) {
        console.error('[translate]', err.message);
        res.status(500).json({ message: 'Translation failed.' });
    }
};

const languages = (req, res) => res.json({ languages: Object.entries(LANGUAGES).map(([code, name]) => ({ code, name })) });

module.exports = { translate, languages, LANGUAGES, decode, protect, unprotect, overrideFor };
