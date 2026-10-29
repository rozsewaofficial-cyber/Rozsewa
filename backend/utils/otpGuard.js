const crypto = require('crypto');

// Fixed test logins (store-review / QA accounts). Off unless the environment
// opts in with ALLOW_TEST_OTP=true, so a production server never has a login
// whose code is published in the source.
const TEST_MOBILES = ['9999900000', '8888888888', '9999911111'];
const TEST_OTP = '123456';
const TEST_OTP_ENABLED = process.env.ALLOW_TEST_OTP === 'true';

const isTestMobile = (mobile) => TEST_OTP_ENABLED && TEST_MOBILES.includes(mobile);
const isTestLogin = (mobile, otp) => isTestMobile(mobile) && String(otp) === TEST_OTP;

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

// A 6-digit code can be guessed in minutes if tries are unlimited. Wrong
// guesses are counted per mobile/email; after MAX_FAILS the code cannot be
// tried again until the window passes. (In memory: per server process.)
const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const fails = new Map();

const entry = (key) => {
    const e = fails.get(key);
    if (e && Date.now() - e.first > WINDOW_MS) {
        fails.delete(key);
        return null;
    }
    return e || null;
};

const isLocked = (key) => {
    const e = entry(key);
    return !!e && e.count >= MAX_FAILS;
};

const recordFail = (key) => {
    const e = entry(key);
    if (e) e.count += 1;
    else fails.set(key, { count: 1, first: Date.now() });
};

const clearFails = (key) => fails.delete(key);

// A fresh code can be asked for at most once per RESEND_MS per mobile/email,
// so the SMS provider can't be drained and codes can't be churned for guessing.
const RESEND_MS = 30 * 1000;
const lastSent = new Map();
const canSend = (key) => {
    const last = lastSent.get(key);
    if (last && Date.now() - last < RESEND_MS) return false;
    lastSent.set(key, Date.now());
    return true;
};

setInterval(() => {
    const now = Date.now();
    for (const [k, e] of fails) if (now - e.first > WINDOW_MS) fails.delete(k);
    for (const [k, t] of lastSent) if (now - t > RESEND_MS) lastSent.delete(k);
}, 5 * 60 * 1000).unref();

module.exports = { isTestMobile, isTestLogin, generateOtp, isLocked, recordFail, clearFails, canSend };
