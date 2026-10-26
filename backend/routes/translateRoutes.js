const express = require('express');
const router = express.Router();
const { translate, languages } = require('../controllers/translateController');

/**
 * The customer app is browsed before signing in, so translation cannot
 * require a login. Without one, the guard against someone using it as a free
 * translation service (each new phrase costs a Google call) is a per-address
 * limit here, plus the language / length limits in the controller. Phrases
 * already translated cost nothing, so a real person is never near the limit.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 300;
const hits = new Map(); // ip -> { count, resetAt }

const limiter = (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        hits.set(ip, entry);
    }
    entry.count += 1;
    if (hits.size > 5000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    if (entry.count > MAX_REQUESTS) {
        res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ message: 'Too many translation requests. Please try again shortly.' });
    }
    next();
};

router.get('/languages', languages);
router.post('/', limiter, translate);

module.exports = router;
module.exports.limiter = limiter;
module.exports._hits = hits;
