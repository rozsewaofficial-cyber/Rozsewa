const express = require('express');
const router = express.Router();
const {
    verifyBank,
    verifyPAN,
    verifyGST,
    initiateOKYC,
    verifyOKYC,
    verifyCriminal,
    verifyDrivingLicence
} = require('../controllers/verifyController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Every route below spends credit with a paid identity provider and looks up a
 * real person's bank account, PAN, GST, Aadhaar, driving licence or criminal
 * record. All seven were reachable with no sign-in at all — `protect` was
 * imported here and never applied — which made the server an open proxy for
 * identity lookups, billed to us. Each handler's own docblock already said
 * Private.
 *
 * Two of them are only ever used by signed-in staff and partners, so they are
 * simply protected. The other five are also used during provider registration,
 * which happens before there is an account to sign in to; those take whichever
 * door the caller can open.
 */

// A signed-in caller goes through `protect` as normal. Everyone else is
// treated as a registration attempt and rationed hard: enough to fill in a
// form and correct a typo, nowhere near enough to mine the identity APIs.
//
// The counter lives in this process, so it is a brake rather than a lock —
// behind several instances each gets its own allowance. The real fix is to
// move registration's checks behind the mobile-OTP step, after which these
// could all take `protect`.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ANONYMOUS_CHECKS = 12;
const attempts = new Map();

const rationAnonymous = (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    const seen = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
    if (seen.length >= MAX_ANONYMOUS_CHECKS) {
        return res.status(429).json({
            success: false,
            message: 'Too many verification attempts. Please try again later, or sign in.'
        });
    }
    seen.push(now);
    attempts.set(ip, seen);

    // Keep the map from growing without bound on a long-running process.
    if (attempts.size > 5000) {
        for (const [key, times] of attempts) {
            if (!times.some((t) => now - t < WINDOW_MS)) attempts.delete(key);
        }
    }
    next();
};

const signedInOrRationed = (req, res, next) =>
    (req.headers.authorization ? protect : rationAnonymous)(req, res, next);

// Mount at /api/verify

// Needed by provider registration, before an account exists.
router.post('/bank', signedInOrRationed, verifyBank);
router.post('/pan', signedInOrRationed, verifyPAN);
router.post('/gst', signedInOrRationed, verifyGST);
router.post('/okyc/initiate', signedInOrRationed, initiateOKYC);
router.post('/okyc/verify', signedInOrRationed, verifyOKYC);

// Only ever called from screens you must already be signed in to reach.
router.post('/criminal_verification', protect, verifyCriminal);
router.post('/driving_licence', protect, verifyDrivingLicence);

module.exports = router;
